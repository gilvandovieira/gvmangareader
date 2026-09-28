# Architecture

GV Manga Reader is a single-page React app with no backend. Everything happens in the browser: the CBZ file comes from a file picker, and pages are decoded by the browser's image decoder.

## Layout

```text
src/
├── app/       App shell: file picker, open/error state
├── cbz/       Reading CBZ archives with JSZip
├── model/     Manga, Page and reader setting types
├── reader/    Reader UI and the page-image hook
└── storage/   Reader preferences in localStorage
```

## Opening a file

`openCbz(file)` in `src/cbz/cbz.ts`:

1. Calls `JSZip.loadAsync(file)`. This reads the ZIP directory, not the image data.
2. Keeps entries with a supported image extension, and skips directories, `__MACOSX/` and hidden files (such as `._page.jpg`).
3. Sorts the entry paths with `Intl.Collator` using `{ numeric: true }`, so `p2` comes before `p10`.
4. Returns a `Manga` (`title` and `pages`) together with the `JSZip` instance.

A `Page` is just an index and the entry path inside the archive. No image is decompressed at this point.

## Showing a page

`readPage(zip, page)` decompresses a single entry and wraps it in a `Blob` whose MIME type comes from the file extension.

The `usePageUrl` hook in `src/reader/usePageUrl.ts` manages the page's Blob URL:

- When the page changes, it reads the new page and creates a URL with `URL.createObjectURL`.
- If the page changes again before a read finishes, that result is discarded without creating a URL.
- The previous URL stays on screen until the next one is ready, so turning pages doesn't flash an empty screen.
- A URL is revoked with `URL.revokeObjectURL` only after its replacement has been rendered, or when the reader unmounts. Revoking earlier can break an `<img>` that is still loading the URL during fast page turns.

As a result, only one Blob URL is alive at any time.

If the browser can't decode an image (for example JPEG XL in a browser without JXL support), the `<img>` error event makes the reader show a message instead of a broken image.

## Reader

`src/reader/Reader.tsx` owns the current page index and the reader preferences.

- **Navigation** works on physical sides. `turn('left')` and `turn('right')` move forward or backward depending on the reading direction. Both the toolbar buttons and the <kbd>←</kbd>/<kbd>→</kbd> keys use them.
- **Fit modes** are CSS only. The image sits in a scrollable flex container and gets `object-contain`, full width or full height. Centering uses `m-auto` so pages that overflow can still be scrolled to their edges.
- **Preferences** (direction and fit mode) are loaded from and saved to `localStorage` by `src/storage/preferences.ts`. Invalid or unavailable storage falls back to the defaults: RTL and Contain.

## Deliberate omissions

These are left out until they are needed: routing, IndexedDB, a PWA/offline mode, Web Workers, WASM decoders, and an archive abstraction for CBR/CB7. With a single archive format, CBZ code is called directly.
