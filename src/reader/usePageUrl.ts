import type JSZip from 'jszip';
import { useEffect, useState } from 'react';
import { readPage } from '../cbz/cbz';
import { prepareImage } from '../image/prepareImage';
import type { Page } from '../model/manga';

type LoadedPage = { page?: Page; url?: string; error?: string };

/**
 * Inflates one page, makes it displayable and exposes it as a Blob URL. The previous URL stays in
 * `url` until the next page is ready, so page turns don't flash empty, and is revoked only after it
 * has left the DOM.
 */
export function usePageUrl(zip: JSZip, page: Page): { url?: string; error?: string; loading: boolean } {
  const [loaded, setLoaded] = useState<LoadedPage>({});

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    readPage(zip, page)
      .then((blob) => prepareImage(blob, signal))
      .then(
        (blob) => {
          if (!signal.aborted) setLoaded({ page, url: URL.createObjectURL(blob) });
        },
        (error: unknown) => {
          if (!signal.aborted) setLoaded({ page, error: error instanceof Error ? error.message : String(error) });
        },
      );
    return () => controller.abort();
  }, [zip, page]);

  // Cleanup runs after the next URL is committed, or on unmount.
  useEffect(() => {
    const { url } = loaded;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [loaded]);

  const current = loaded.page === page;
  return { url: loaded.url, error: current ? loaded.error : undefined, loading: !current };
}
