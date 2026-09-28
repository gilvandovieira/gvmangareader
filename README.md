# GV Manga Reader

A manga reader for `.cbz` files that runs entirely in your browser. There is no server, no account and no upload: the archive is opened locally and never leaves your device.

**Live app:** https://gilvandovieira.github.io/gvmangareader/

## Features

- Open a local `.cbz` file.
- Pages are decompressed one at a time, only when shown, so large volumes open quickly.
- Pages are ordered with natural sort (`page2` comes before `page10`).
- Right-to-left (manga) or left-to-right reading direction.
- Fit modes: **Contain** (whole page), **Width** and **Height**.
- Keyboard navigation with <kbd>←</kbd> and <kbd>→</kbd>.
- Page counter (`page / total`).
- Reading direction and fit mode are remembered in the browser (`localStorage`).
- Each book reopens at the page where you left off.
- JPEG XL pages work in every browser: natively where supported, otherwise through a WebAssembly decoder.

## Usage

1. Open the [live app](https://gilvandovieira.github.io/gvmangareader/) or run it locally (see below).
2. Click **Open CBZ** and choose a file.
3. Turn pages with the arrow buttons in the toolbar or the arrow keys.

The arrow keys follow the physical side of the page. In **RTL** mode, <kbd>←</kbd> goes to the next page and <kbd>→</kbd> to the previous one, like turning pages in a printed manga. In **LTR** mode it is the other way around.

## Supported files

A CBZ is a ZIP archive of images. These entries are shown as pages:

| Extension             | Notes                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- |
| `.jpg`, `.jpeg`       |                                                                                         |
| `.png`                |                                                                                         |
| `.webp`               |                                                                                         |
| `.gif`                |                                                                                         |
| `.avif`               |                                                                                         |
| `.jxl` (JPEG XL)      | Decoded natively where the browser supports it, otherwise by a WASM decoder (see below). |

Other entries (`ComicInfo.xml`, text files, `__MACOSX/` and other hidden files) are ignored. CBR (RAR) and CB7 (7z) archives are not supported.

### JPEG XL

Most browsers can't show JPEG XL yet. The reader tests this once per visit by decoding a tiny JXL image. Where it fails, JXL pages are decoded by [libjxl compiled to WebAssembly](https://github.com/jamsinclair/jSquash/tree/main/packages/jxl) in a Web Worker and shown as PNG. The decoder (about 320 kB gzipped) is downloaded only when the first such page is opened.

The WASM decoder is single-threaded: a 2160×3072 page takes about 1.3 s to appear, a 1350×1920 page about 0.8 s. Native decoding is roughly three times faster.

## Reading progress

The current page is saved in `localStorage` for each book. A book is identified by its file name, size and last-modified time, so a renamed or re-saved file starts again from page 1. Progress is kept only in this browser.

## Development

Requirements: [Node.js](https://nodejs.org/) 24 and [pnpm](https://pnpm.io/) 12 (the exact version is pinned in `package.json`).

```sh
pnpm install
pnpm dev        # start the dev server
pnpm typecheck  # TypeScript check
pnpm build      # typecheck + production build into dist/
pnpm preview    # serve the production build locally
pnpm test       # end-to-end tests in Chromium (Playwright)
```

The tests run twice: in plain Chromium, which uses the WASM decoder, and with Chromium's JPEG XL support turned on (`--enable-features=JXLImageFormat`). They need Playwright's Chromium (`pnpm exec playwright install chromium`). The fixture `tests/fixtures/mixed.cbz` mixes JXL, PNG, JPEG and a corrupt JXL page; `tests/fixtures/make-fixtures.sh` regenerates it.

Stack: React, TypeScript, Vite, Tailwind CSS, [JSZip](https://stuk.github.io/jszip/) and [@jsquash/jxl](https://github.com/jamsinclair/jSquash/tree/main/packages/jxl). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organized.

## Deployment

The app is a static site published to GitHub Pages by [`.github/workflows/pages.yml`](.github/workflows/pages.yml):

- **Pull requests:** install dependencies, typecheck and build.
- **Pushes to `main`** (or a manual run): the same, then deploy `dist/` to GitHub Pages.

Vite is configured with `base: './'`, so the build uses relative asset paths and works under any repository name or path. In the repository settings, **Pages → Source** must be set to **GitHub Actions**.
