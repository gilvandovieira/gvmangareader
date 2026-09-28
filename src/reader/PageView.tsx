import type JSZip from 'jszip';
import { useEffect, useRef, useState } from 'react';
import type { FitMode, Page, ReadingDirection } from '../model/manga';
import { usePageUrl } from './usePageUrl';

// The spread fits the viewport (contain), its width (fit-width) or its height (fit-height).
const SPREAD_CLASSES: Record<FitMode, string> = {
  contain: 'h-full w-full',
  'fit-width': 'w-full items-center',
  'fit-height': 'h-full shrink-0',
};
// Pages share the spread's width equally, except in fit-height, where each keeps its own width.
const IMAGE_CLASSES: Record<FitMode, string> = {
  contain: 'h-full min-w-0 flex-1 object-contain',
  'fit-width': 'min-w-0 flex-1',
  'fit-height': 'h-full w-auto max-w-none shrink-0',
};
// Two contained pages are pushed against each other, so artwork across the spine lines up.
const SPINE_CLASSES = ['object-right', 'object-left'];

type Props = {
  zip: JSZip;
  /** The pages of the current spread, from left to right on screen. */
  pages: Page[];
  fitMode: FitMode;
  direction: ReadingDirection;
};

export function PageView({ zip, pages, fitMode, direction }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const spreadKey = pages.map((page) => page.index).join();

  useEffect(() => {
    const element = viewport.current;
    // Start at the top, and in right-to-left books at the right edge, where reading begins.
    element?.scrollTo(direction === 'rtl' ? element.scrollWidth : 0, 0);
  }, [spreadKey, direction]);

  return (
    <div ref={viewport} className="flex min-h-0 min-w-0 flex-1 overflow-auto">
      <div className={`m-auto flex ${SPREAD_CLASSES[fitMode]}`}>
        {pages.map((page, slot) => (
          // Keyed by slot, so each side keeps showing its previous page until the next one is ready.
          <PageImage
            key={slot}
            zip={zip}
            page={page}
            className={`${IMAGE_CLASSES[fitMode]} ${pages.length === 2 ? SPINE_CLASSES[slot] : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

type PageImageProps = { zip: JSZip; page: Page; className: string };

function PageImage({ zip, page, className }: PageImageProps) {
  const { url, error, loading } = usePageUrl(zip, page);
  const [undecodableUrl, setUndecodableUrl] = useState<string>();
  const number = page.index + 1;
  const messageClass = 'm-auto max-w-sm min-w-0 flex-1 px-4 text-center text-sm';

  if (error) {
    return (
      <p className={`${messageClass} text-red-400`} role="alert">
        Could not load page {number}: {error}
      </p>
    );
  }
  if (url && url === undecodableUrl) {
    return (
      <p className={`${messageClass} text-red-400`} role="alert">
        Page {number} could not be displayed. This browser may not support its image format (
        {page.path.slice(page.path.lastIndexOf('.'))}).
      </p>
    );
  }
  if (!url) {
    return (
      <p className={`${messageClass} text-neutral-500`} aria-busy>
        Loading…
      </p>
    );
  }
  return (
    <img
      src={url}
      alt={`Page ${number}`}
      aria-busy={loading}
      // While the next page is decoding, dim the previous one (after a delay, so fast turns don't flicker).
      className={`transition-opacity ${className} ${loading ? 'opacity-40 delay-200' : ''}`}
      onError={() => setUndecodableUrl(url)}
    />
  );
}
