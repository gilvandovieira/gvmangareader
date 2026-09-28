const KEY_PREFIX = 'gvmangareader.progress:';

/** Identifies a book across sessions. Renaming or re-saving the file starts a new book. */
export function bookId(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

/** Returns the saved page index clamped to `[0, pageCount - 1]`, or 0 if nothing valid is stored. */
export function loadProgress(id: string, pageCount: number): number {
  try {
    const stored = Number(localStorage.getItem(KEY_PREFIX + id));
    return Number.isInteger(stored) ? Math.min(Math.max(stored, 0), pageCount - 1) : 0;
  } catch {
    return 0;
  }
}

export function saveProgress(id: string, index: number): void {
  try {
    localStorage.setItem(KEY_PREFIX + id, String(index));
  } catch {
    // Storage can be unavailable or full; reading continues, the page just won't be restored.
  }
}
