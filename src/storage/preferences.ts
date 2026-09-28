import {
  FIT_MODES,
  READING_DIRECTIONS,
  READING_MODES,
  SPREAD_STARTS,
  type FitMode,
  type ReadingDirection,
  type ReadingMode,
  type SpreadStart,
} from '../model/manga';

export type ReaderPreferences = {
  direction: ReadingDirection;
  fitMode: FitMode;
  readingMode: ReadingMode;
  spreadStart: SpreadStart;
};

const KEY = 'gvmangareader.preferences';
const DEFAULTS: ReaderPreferences = {
  direction: 'rtl',
  fitMode: 'contain',
  readingMode: 'single',
  spreadStart: 'first-alone',
};

export function loadPreferences(): ReaderPreferences {
  try {
    const stored: Partial<ReaderPreferences> = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      direction: READING_DIRECTIONS.find((d) => d === stored.direction) ?? DEFAULTS.direction,
      fitMode: FIT_MODES.find((m) => m === stored.fitMode) ?? DEFAULTS.fitMode,
      readingMode: READING_MODES.find((m) => m === stored.readingMode) ?? DEFAULTS.readingMode,
      spreadStart: SPREAD_STARTS.find((s) => s === stored.spreadStart) ?? DEFAULTS.spreadStart,
    };
  } catch {
    return DEFAULTS;
  }
}

export function savePreferences(preferences: ReaderPreferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); preferences just won't persist.
  }
}
