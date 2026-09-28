export type Page = {
  index: number;
  /** Entry path inside the archive. */
  path: string;
};

export type Manga = {
  /** Stable identity of the source file, used as the reading-progress key. */
  id: string;
  title: string;
  pages: Page[];
};

export const READING_DIRECTIONS = ['rtl', 'ltr'] as const;
export type ReadingDirection = (typeof READING_DIRECTIONS)[number];

export const FIT_MODES = ['contain', 'fit-width', 'fit-height'] as const;
export type FitMode = (typeof FIT_MODES)[number];

export const READING_MODES = ['single', 'double'] as const;
export type ReadingMode = (typeof READING_MODES)[number];

/** In double mode: whether page 1 is shown alone (like a cover) or paired with page 2. */
export const SPREAD_STARTS = ['first-alone', 'paired'] as const;
export type SpreadStart = (typeof SPREAD_STARTS)[number];
