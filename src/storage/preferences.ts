import { FIT_MODES, READING_DIRECTIONS, type FitMode, type ReadingDirection } from '../model/manga';

export type ReaderPreferences = {
  direction: ReadingDirection;
  fitMode: FitMode;
};

const KEY = 'gvmangareader.preferences';
const DEFAULTS: ReaderPreferences = { direction: 'rtl', fitMode: 'contain' };

export function loadPreferences(): ReaderPreferences {
  try {
    const stored: Partial<ReaderPreferences> = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      direction: READING_DIRECTIONS.find((d) => d === stored.direction) ?? DEFAULTS.direction,
      fitMode: FIT_MODES.find((m) => m === stored.fitMode) ?? DEFAULTS.fitMode,
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
