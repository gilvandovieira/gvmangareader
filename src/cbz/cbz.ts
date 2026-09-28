import JSZip from 'jszip';
import type { Manga, Page } from '../model/manga';

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  jxl: 'image/jxl',
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export type Cbz = {
  manga: Manga;
  zip: JSZip;
};

function extension(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1).toLowerCase();
}

function isPageEntry(entry: JSZip.JSZipObject): boolean {
  if (entry.dir) return false;
  const segments = entry.name.split('/');
  // Skip macOS metadata (__MACOSX/, ._foo.jpg) and other hidden files.
  if (segments.some((segment) => segment.startsWith('.') || segment === '__MACOSX')) return false;
  return extension(entry.name) in IMAGE_TYPES;
}

/** Reads only the zip directory; page images stay compressed until requested. */
export async function openCbz(file: File): Promise<Cbz> {
  const zip = await JSZip.loadAsync(file);
  const paths = Object.values(zip.files)
    .filter(isPageEntry)
    .map((entry) => entry.name)
    .sort(collator.compare);

  if (paths.length === 0) {
    throw new Error('No supported images found in this CBZ.');
  }

  const pages: Page[] = paths.map((path, index) => ({ index, path }));
  const title = file.name.replace(/\.cbz$/i, '');
  return { manga: { title, pages }, zip };
}

export async function readPage(zip: JSZip, page: Page): Promise<Blob> {
  const entry = zip.file(page.path);
  if (!entry) throw new Error(`Missing archive entry: ${page.path}`);
  const data = await entry.async('arraybuffer');
  return new Blob([data], { type: IMAGE_TYPES[extension(page.path)] });
}
