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
├── reader/    Reader UI and the page-image hook
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

`prepareImage(blob, signal)` in `src/image/prepareImage.ts` returns a Blob the browser can show. Every format except JPEG XL is returned unchanged. For `image/jxl`:

- `supportsNativeJxl()` decodes a 21-byte JXL image with `new Image()` and `decode()`. The result is cached for the rest of the page's lifetime. This tests the real decoder instead of guessing from the user agent.
- With native support, the original Blob is returned.
- Without it, `decodeJxl()` sends the Blob to a Web Worker (`src/image/jpegxl/worker.ts`). The worker decodes it with `@jsquash/jxl` (libjxl built for WebAssembly, single-threaded, so it needs no cross-origin isolation), draws the pixels on an `OffscreenCanvas` and returns a PNG Blob. PNG is lossless and costs about 10% of the decode time; the decode itself is most of the work.

The worker, and with it the WASM file, is created on the first JXL page that needs it. It decodes one page at a time. Waiting jobs stay in a queue on the main thread, and a job whose `AbortSignal` has fired is dropped before it reaches the worker, so paging quickly through a JXL book decodes only the page you stop on. If the worker fails to load, the current page reports an error and the next JXL page starts a new worker.

The `usePageUrl` hook in `src/reader/usePageUrl.ts` runs this pipeline and manages the page's Blob URL:

- When the page changes, it reads and prepares the new page and creates a URL with `URL.createObjectURL`.
- If the page changes again before that finishes, it aborts the work and discards the result without creating a URL.
- While a page is loading it reports `loading`. The reader then marks the viewport `aria-busy` and, after 200 ms, dims the previous page, so a slow decode is not mistaken for the new page.
- The previous URL stays on screen until the next one is ready, so turning pages doesn't flash an empty screen.
- A URL is revoked with `URL.revokeObjectURL` only after its replacement has been rendered, or when the reader unmounts. Revoking earlier can break an `<img>` that is still loading the URL during fast page turns.

As a result, only one Blob URL is alive at any time.

If a page can't be read or decoded, the reader shows a message in its place and navigation keeps working. Errors from `readPage` and the WASM decoder arrive through the hook; an image the browser itself can't decode is caught by the `<img>` error event.

## Reader

`src/reader/Reader.tsx` owns the current page index and the reader preferences.

- **Navigation** works on physical sides. `turn('left')` and `turn('right')` move forward or backward depending on the reading direction. Both the toolbar buttons and the <kbd>←</kbd>/<kbd>→</kbd> keys use them.
- **Fit modes** are CSS only. The image sits in a scrollable flex container and gets `object-contain`, full width or full height. Centering uses `m-auto` so pages that overflow can still be scrolled to their edges.
- **Preferences** (direction and fit mode) are loaded from and saved to `localStorage` by `src/storage/preferences.ts`. Invalid or unavailable storage falls back to the defaults: RTL and Contain.
- **Progress** is stored by `src/storage/progress.ts` under a separate key per book, `gvmangareader.progress:<manga.id>`, and holds only the page index. The reader restores it on open and saves it whenever the page changes. A stored index outside the book is clamped to the first or last page, and anything else invalid starts at page 1. Storage errors are ignored, so reading works without storage. Keys are never removed; each book adds a few dozen bytes.

## Deliberate omissions

These are left out until they are needed: routing, IndexedDB, a PWA/offline mode, preloading the next page, a multithreaded JXL decoder (it would require cross-origin isolation), and an archive abstraction for CBR/CB7. With a single archive format, CBZ code is called directly.

## Tests

`pnpm test` runs Playwright against the Vite dev server in two Chromium projects: `wasm-jxl` (no native JPEG XL, so the WASM path) and `native-jxl` (started with `--enable-features=JXLImageFormat`). The fixture `tests/fixtures/mixed.cbz` is generated by `make-fixtures.sh` and holds a lossy JXL, a PNG, a JPEG, a corrupt JXL and a JXL transcoded losslessly from JPEG, plus a `ComicInfo.xml` that must be ignored.
