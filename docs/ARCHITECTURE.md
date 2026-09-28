# Architecture

GV Manga Reader is a single-page React app with no backend. Everything happens in the browser: the CBZ file comes from a file picker, and pages are decoded by the browser's image decoder, or by a WebAssembly JPEG XL decoder where the browser has none.

## Layout

```text
src/
├── app/       App shell: file picker, open/error state
├── cbz/       Reading CBZ archives with JSZip
├── image/     Turning page Blobs into something an <img> can show
│   └── jpegxl/  Native JXL detection and the WASM decoder worker
├── model/     Manga, Page and reader setting types
├── reader/    Reader UI: toolbar, spreads, page view, thumbnail sidebar
└── storage/   Reader preferences and per-book progress in localStorage
```

## Opening a file

`openCbz(file)` in `src/cbz/cbz.ts`:

1. Calls `JSZip.loadAsync(file)`. This reads the ZIP directory, not the image data.
2. Keeps entries with a supported image extension, and skips directories, `__MACOSX/` and hidden files (such as `._page.jpg`).
3. Sorts the entry paths with `Intl.Collator` using `{ numeric: true }`, so `p2` comes before `p10`.
4. Returns a `Manga` (`id`, `title` and `pages`) together with the `JSZip` instance. The `id` is `name|size|lastModified` of the file.

A `Page` is just an index and the entry path inside the archive. No image is decompressed at this point.

## Showing a page

Each page goes through the same steps:

```text
CBZ entry → readPage() → raw Blob → prepareImage() → displayable Blob → Blob URL → <img>
```

`readPage(zip, page)` decompresses a single entry and wraps it in a `Blob` whose MIME type comes from the file extension. It knows nothing about displaying images.

`prepareImage(blob, { signal, background })` in `src/image/prepareImage.ts` returns a Blob the browser can show. Every format except JPEG XL is returned unchanged. For `image/jxl`:

- `supportsNativeJxl()` decodes a 21-byte JXL image with `new Image()` and `decode()`. The result is cached for the rest of the page's lifetime. This tests the real decoder instead of guessing from the user agent.
- With native support, the original Blob is returned.
- Without it, `decodeJxl()` sends the Blob to a Web Worker (`src/image/jpegxl/worker.ts`). The worker decodes it with `@jsquash/jxl` (libjxl built for WebAssembly, single-threaded, so it needs no cross-origin isolation), draws the pixels on an `OffscreenCanvas` and returns a PNG Blob. PNG is lossless and costs about 10% of the decode time; the decode itself is most of the work.

The worker, and with it the WASM file, is created on the first JXL page that needs it. It decodes one page at a time. Waiting jobs stay in a queue on the main thread, and a job whose `AbortSignal` has fired is dropped before it reaches the worker, so paging quickly through a JXL book decodes only the page you stop on. If the worker fails to load, the current page reports an error and the next JXL page starts a new worker.

Jobs marked `background` (thumbnails) go to a second worker with its own queue. A decode can't be interrupted once it has started, so with one shared worker a page could wait up to a second behind a thumbnail. The second worker is created with the first thumbnail that needs it.

The `usePageUrl` hook in `src/reader/usePageUrl.ts` runs this pipeline and manages the page's Blob URL:

- When the page changes, it reads and prepares the new page and creates a URL with `URL.createObjectURL`.
- If the page changes again before that finishes, it aborts the work and discards the result without creating a URL.
- While a page is loading it reports `loading`. The page view then marks that page's element `aria-busy` and, after 200 ms, dims the previous page, so a slow decode is not mistaken for the new page.
- The previous URL stays on screen until the next one is ready, so turning pages doesn't flash an empty screen.
- A URL is revoked with `URL.revokeObjectURL` only after its replacement has been rendered, or when the reader unmounts. Revoking earlier can break an `<img>` that is still loading the URL during fast page turns.

As a result, each side of the page view holds one Blob URL: one in single mode, two in a double spread.

If a page can't be read or decoded, the reader shows a message in its place and navigation keeps working. Errors from `readPage` and the WASM decoder arrive through the hook; an image the browser itself can't decode is caught by the `<img>` error event.

## Reader

`src/reader/Reader.tsx` owns the current page index and the reader preferences, and renders the toolbar, `PageSidebar` and `PageView`.

- **Spreads** are computed by pure functions in `src/reader/spreads.ts`. The state is a single page index; `spreadAt(index, pageCount, layout)` returns the pages shown with it, in reading order: `[index]` in single mode, otherwise pairs that start at page 2 (`first-alone`: 1, 2+3, 4+5, …) or at page 1 (`paired`: 1+2, 3+4, …), with an odd last page alone. Because the spread is derived, switching layout keeps you on the same page.
- **Navigation** works on physical sides. `turn('left')` and `turn('right')` move forward or backward depending on the reading direction, by a whole spread: `stepSpread()` goes to the first page of the next or previous spread. Both the toolbar buttons and the <kbd>←</kbd>/<kbd>→</kbd> keys use them. Clicking a thumbnail sets the index to that page, so the spread containing it is shown.
- **Page view** (`src/reader/PageView.tsx`) gets the spread in screen order from `leftToRight()`, which reverses it for RTL, and renders one `PageImage` per side, each with its own `usePageUrl`. The sides are keyed by position, so each keeps its previous image until its next one is ready. When the spread changes the view scrolls to the top, and in RTL to the right edge, where reading starts.
- **Fit modes** are CSS only. The spread sits in a scrollable flex container and fits the viewport (Contain), its width or its height. In Contain and Width the pages share the width equally; in Height each keeps its own width. In a two-page Contain spread the left page uses `object-right` and the right page `object-left`, so the pages touch at the spine. Centering uses `m-auto` so spreads that overflow can still be scrolled to their edges.
- **Preferences** (direction, fit mode, reading mode, spread start, sidebar open and position) are loaded from and saved to `localStorage` by `src/storage/preferences.ts`. Each field is validated on its own, and invalid or unavailable storage falls back to the defaults: RTL, Contain, Single, Cover alone, sidebar on the left, open on screens at least 768 px wide.
- **Progress** is stored by `src/storage/progress.ts` under a separate key per book, `gvmangareader.progress:<manga.id>`, and holds only the page index. The reader restores it on open and saves it whenever the page changes. A stored index outside the book is clamped to the first or last page, and anything else invalid starts at page 1. Storage errors are ignored, so reading works without storage. Keys are never removed; each book adds a few dozen bytes.

## Thumbnail sidebar

`src/reader/PageSidebar.tsx` renders a button for every page: a fixed 2:3 box for the thumbnail and the page number. The pages of the current spread get `aria-current="page"` and a highlight, and the first of them is scrolled into view when the page changes.

Thumbnails are loaded lazily. Each box has an `IntersectionObserver` whose root is the sidebar's scrolling list, with a margin of half its height. Only a thumbnail that comes within that margin starts loading: `readPage()`, then `prepareImage()` with `background: true`, then `makeThumbnail()` in `src/image/makeThumbnail.ts`, which draws the image 224 px wide on an `OffscreenCanvas` and encodes a JPEG. The full-size image never gets a Blob URL; only the small JPEG does. A thumbnail that scrolls out of range before it is done is aborted.

Loaded thumbnails stay while the book is open, so scrolling back does not decode the page again. Collapsing the sidebar only hides it (`hidden`), so thumbnails survive that too, and a hidden sidebar intersects nothing, so nothing new loads while it is collapsed. All thumbnail URLs are revoked when the reader unmounts, which happens when another book is opened. Thumbnails of the real test volume average about 21 kB, so a 168-page book with every thumbnail loaded holds about 3.5 MB.

There is no virtual scrolling: a few hundred buttons with empty boxes are cheap, and the observer keeps the expensive part lazy.

## Deliberate omissions

These are left out until they are needed: routing, IndexedDB, a PWA/offline mode, preloading the next page, detecting landscape (already two-page) images in double mode, virtual scrolling in the sidebar, a multithreaded JXL decoder (it would require cross-origin isolation), and an archive abstraction for CBR/CB7. With a single archive format, CBZ code is called directly.

## Tests

`pnpm test` runs Playwright. The `unit` project tests the spread functions in Node, without a browser. The end-to-end tests run against the Vite dev server in two Chromium projects: `wasm-jxl` (no native JPEG XL, so the WASM path) and `native-jxl` (started with `--enable-features=JXLImageFormat`). They cover page formats, progress, double-page spreads and the sidebar. The lazy-thumbnail test builds a 60-page CBZ in the browser with JSZip and tracks Blob URLs by wrapping `URL.createObjectURL` and `URL.revokeObjectURL`. The fixture `tests/fixtures/mixed.cbz` is generated by `make-fixtures.sh` and holds a lossy JXL, a PNG, a JPEG, a corrupt JXL and a JXL transcoded losslessly from JPEG, plus a `ComicInfo.xml` that must be ignored.
