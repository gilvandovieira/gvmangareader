export type Page = {
  index: number;
  /** Entry path inside the archive. */
  path: string;
};

export type Manga = {
  title: string;
  pages: Page[];
};

export const READING_DIRECTIONS = ['rtl', 'ltr'] as const;
export type ReadingDirection = (typeof READING_DIRECTIONS)[number];

export const FIT_MODES = ['contain', 'fit-width', 'fit-height'] as const;
export type FitMode = (typeof FIT_MODES)[number];
