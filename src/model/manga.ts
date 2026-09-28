export type Page = {
  index: number;
  /** Entry path inside the archive. */
  path: string;
};

export type Manga = {
  title: string;
  pages: Page[];
};

export type ReadingDirection = 'rtl' | 'ltr';

export type FitMode = 'contain' | 'fit-width' | 'fit-height';
