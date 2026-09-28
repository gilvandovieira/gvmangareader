import type JSZip from 'jszip';
import { useEffect, useState } from 'react';
import { readPage } from '../cbz/cbz';
import type { Page } from '../model/manga';

type LoadedPage = { page?: Page; url?: string; error?: string };

/**
 * Inflates one page into a Blob URL. The previous URL stays in `url` until the next page is
 * ready, so page turns don't flash empty, and is revoked only after it has left the DOM.
 */
export function usePageUrl(zip: JSZip, page: Page): { url?: string; error?: string } {
  const [loaded, setLoaded] = useState<LoadedPage>({});

  useEffect(() => {
    let cancelled = false;
    readPage(zip, page).then(
      (blob) => {
        if (!cancelled) setLoaded({ page, url: URL.createObjectURL(blob) });
      },
      (error: unknown) => {
        if (!cancelled) setLoaded({ page, error: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [zip, page]);

  // Cleanup runs after the next URL is committed, or on unmount.
  useEffect(() => {
    const { url } = loaded;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [loaded]);

  return { url: loaded.url, error: loaded.page === page ? loaded.error : undefined };
}
