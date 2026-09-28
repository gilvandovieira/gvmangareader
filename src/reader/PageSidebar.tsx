import type JSZip from 'jszip';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { readPage } from '../cbz/cbz';
import { makeThumbnail } from '../image/makeThumbnail';
import { prepareImage } from '../image/prepareImage';
import type { Page, SidebarPosition } from '../model/manga';

// Twice the displayed width, for high-density screens.
const THUMBNAIL_WIDTH = 224;

type Props = {
  zip: JSZip;
  pages: Page[];
  /** Indexes of the pages in the current spread. */
  current: number[];
  open: boolean;
  position: SidebarPosition;
  onSelect: (index: number) => void;
  onMove: (position: SidebarPosition) => void;
};

/**
 * Thumbnails of every page. Collapsing only hides the sidebar, so loaded thumbnails survive it;
 * they are released when the reader closes.
 */
export function PageSidebar({ zip, pages, current, open, position, onSelect, onMove }: Props) {
  const list = useRef<HTMLOListElement>(null);
  const currentItem = useRef<HTMLLIElement>(null);
  const first = current[0];
  const other = position === 'left' ? 'right' : 'left';

  useEffect(() => {
    if (open) currentItem.current?.scrollIntoView({ block: 'nearest' });
  }, [first, open]);

  return (
    <nav
      id="page-sidebar"
      aria-label="Page thumbnails"
      hidden={!open}
      className={`flex w-36 shrink-0 flex-col border-neutral-800 bg-neutral-900 ${position === 'left' ? 'border-r' : 'border-l'}`}
    >
      <button
        type="button"
        className="m-2 mb-0 rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-sky-500"
        onClick={() => onMove(other)}
      >
        Move to {other}
      </button>
      <ol ref={list} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {pages.map((page) => (
          <li key={page.index} ref={page.index === first ? currentItem : undefined}>
            <button
              type="button"
              aria-label={`Page ${page.index + 1}`}
              aria-current={current.includes(page.index) ? 'page' : undefined}
              className={
                'group flex w-full flex-col items-center gap-1 rounded-md p-1.5 text-xs text-neutral-400 tabular-nums ' +
                'hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-sky-500 ' +
                'aria-[current=page]:bg-neutral-800 aria-[current=page]:text-sky-300'
              }
              onClick={() => onSelect(page.index)}
            >
              <Thumbnail zip={zip} page={page} root={list} />
              {page.index + 1}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

type ThumbnailProps = { zip: JSZip; page: Page; root: RefObject<HTMLElement | null> };

function Thumbnail({ zip, page, root }: ThumbnailProps) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const { url, error } = useThumbnailUrl(zip, page, near);

  // Load only thumbnails within half a sidebar height of the visible ones. A hidden sidebar
  // intersects nothing, so collapsing it also cancels pending loads.
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root: root.current,
      rootMargin: '50% 0px',
    });
    observer.observe(box.current!);
    return () => observer.disconnect();
  }, [root]);

  return (
    <div
      ref={box}
      className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-sm bg-neutral-800 ring-sky-500 group-aria-[current=page]:ring-2"
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : (
        error && (
          <span className="text-base text-red-400" title={error}>
            !
          </span>
        )
      )}
    </div>
  );
}

/** Creates the thumbnail once `enabled` turns true, and keeps its Blob URL until unmount. */
function useThumbnailUrl(zip: JSZip, page: Page, enabled: boolean): { url?: string; error?: string } {
  const [thumbnail, setThumbnail] = useState<{ url?: string; error?: string }>({});
  const settled = thumbnail.url !== undefined || thumbnail.error !== undefined;

  useEffect(() => {
    if (!enabled || settled) return;
    const controller = new AbortController();
    const { signal } = controller;
    readPage(zip, page)
      .then((blob) => prepareImage(blob, { signal, background: true }))
      // The full-size image is dropped here; only the small JPEG gets a Blob URL.
      .then((blob) => makeThumbnail(blob, THUMBNAIL_WIDTH))
      .then(
        (blob) => {
          if (!signal.aborted) setThumbnail({ url: URL.createObjectURL(blob) });
        },
        (error: unknown) => {
          if (!signal.aborted) setThumbnail({ error: error instanceof Error ? error.message : String(error) });
        },
      );
    return () => controller.abort();
  }, [zip, page, enabled, settled]);

  useEffect(() => {
    const { url } = thumbnail;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [thumbnail]);

  return thumbnail;
}
