import {
  FIT_MODES,
  READING_DIRECTIONS,
  READING_MODES,
  SIDEBAR_POSITIONS,
  SPREAD_STARTS,
  type FitMode,
  type ReadingDirection,
  type ReadingMode,
  type SidebarPosition,
  type SpreadStart,
} from '../model/manga';

export type ReaderPreferences = {
  direction: ReadingDirection;
  fitMode: FitMode;
  readingMode: ReadingMode;
  spreadStart: SpreadStart;
  sidebarOpen: boolean;
  sidebarPosition: SidebarPosition;
};

const KEY = 'gvmangareader.preferences';
const DEFAULTS: ReaderPreferences = {
  direction: 'rtl',
  fitMode: 'contain',
  readingMode: 'single',
  spreadStart: 'first-alone',
  // On phones the sidebar would take a third of the screen, so it starts collapsed there.
  sidebarOpen: matchMedia('(min-width: 768px)').matches,
  sidebarPosition: 'left',
};

export function loadPreferences(): ReaderPreferences {
  try {
    const stored: Partial<ReaderPreferences> = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      direction: READING_DIRECTIONS.find((d) => d === stored.direction) ?? DEFAULTS.direction,
      fitMode: FIT_MODES.find((m) => m === stored.fitMode) ?? DEFAULTS.fitMode,
      readingMode: READING_MODES.find((m) => m === stored.readingMode) ?? DEFAULTS.readingMode,
      spreadStart: SPREAD_STARTS.find((s) => s === stored.spreadStart) ?? DEFAULTS.spreadStart,
      sidebarOpen: typeof stored.sidebarOpen === 'boolean' ? stored.sidebarOpen : DEFAULTS.sidebarOpen,
      sidebarPosition: SIDEBAR_POSITIONS.find((p) => p === stored.sidebarPosition) ?? DEFAULTS.sidebarPosition,
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
