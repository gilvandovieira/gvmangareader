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
| `.jxl` (JPEG XL)      | Shown only in browsers that decode JPEG XL natively. Others show a message on each page. |

Other entries (`ComicInfo.xml`, text files, `__MACOSX/` and other hidden files) are ignored. CBR (RAR) and CB7 (7z) archives are not supported.

## Development

Requirements: [Node.js](https://nodejs.org/) 24 and [pnpm](https://pnpm.io/) 12 (the exact version is pinned in `package.json`).

```sh
pnpm install
pnpm dev        # start the dev server
pnpm typecheck  # TypeScript check
pnpm build      # typecheck + production build into dist/
pnpm preview    # serve the production build locally
```

Stack: React, TypeScript, Vite, Tailwind CSS and [JSZip](https://stuk.github.io/jszip/). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organized.

## Deployment

The app is a static site published to GitHub Pages by [`.github/workflows/pages.yml`](.github/workflows/pages.yml):

- **Pull requests:** install dependencies, typecheck and build.
- **Pushes to `main`** (or a manual run): the same, then deploy `dist/` to GitHub Pages.

Vite is configured with `base: './'`, so the build uses relative asset paths and works under any repository name or path. In the repository settings, **Pages → Source** must be set to **GitHub Actions**.
