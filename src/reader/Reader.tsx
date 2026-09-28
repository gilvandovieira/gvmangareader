import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Cbz } from '../cbz/cbz';
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
import { loadPreferences, savePreferences } from '../storage/preferences';
import { loadProgress, saveProgress } from '../storage/progress';
import { PageSidebar } from './PageSidebar';
import { PageView } from './PageView';
import { leftToRight, spreadAt, stepSpread } from './spreads';

const DIRECTION_LABELS: Record<ReadingDirection, string> = { rtl: 'RTL', ltr: 'LTR' };
const MODE_LABELS: Record<ReadingMode, string> = { single: 'Single', double: 'Double' };
const SPREAD_START_LABELS: Record<SpreadStart, string> = { 'first-alone': 'Cover alone', paired: 'Cover paired' };
const FIT_LABELS: Record<FitMode, string> = {
  contain: 'Contain',
  'fit-width': 'Width',
  'fit-height': 'Height',
};

const buttonClass =
  'rounded-md px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-30 ' +
  'focus-visible:outline-2 focus-visible:outline-sky-500 aria-pressed:bg-neutral-700';

type Props = {
  cbz: Cbz;
  /** Rendered at the start of the toolbar (e.g. the open-file button). */
  actions: ReactNode;
};

export function Reader({ cbz: { manga, zip }, actions }: Props) {
  const total = manga.pages.length;
  /** A page of the current spread; the spread itself is derived from it and the layout. */
  const [index, setIndex] = useState(() => loadProgress(manga.id, total));
  const [preferences, setPreferences] = useState(loadPreferences);
  const { direction, fitMode, readingMode, spreadStart, sidebarOpen, sidebarPosition } = preferences;
  const spread = spreadAt(index, total, { mode: readingMode, start: spreadStart });

  useEffect(() => savePreferences(preferences), [preferences]);
  useEffect(() => saveProgress(manga.id, index), [manga.id, index]);

  /** Turns the page toward a physical side, so ← always means "the page on the left". */
  const turn = useCallback(
    (side: 'left' | 'right') => {
      const forward = (side === 'right') === (direction === 'ltr');
      setIndex((i) => stepSpread(i, forward, total, { mode: readingMode, start: spreadStart }));
    },
    [direction, total, readingMode, spreadStart],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft') turn('left');
      else if (event.key === 'ArrowRight') turn('right');
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [turn]);

  const isFirst = spread[0] === 0;
  const isLast = spread[spread.length - 1] === total - 1;
  const leftIsNext = direction === 'rtl';

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-800 bg-neutral-900 px-3 py-2">
        <button
          type="button"
          className={`${buttonClass} aria-expanded:bg-neutral-700`}
          aria-expanded={sidebarOpen}
          aria-controls="page-sidebar"
          onClick={() => setPreferences((p) => ({ ...p, sidebarOpen: !p.sidebarOpen }))}
        >
          Thumbnails
        </button>
        {actions}
        <h1 className="min-w-0 flex-1 truncate text-sm text-neutral-300" title={manga.title}>
          {manga.title}
        </h1>

        <nav className="flex items-center gap-1" aria-label="Pages">
          <button
            type="button"
            className={buttonClass}
            onClick={() => turn('left')}
            disabled={leftIsNext ? isLast : isFirst}
            aria-label={leftIsNext ? 'Next page' : 'Previous page'}
          >
            ←
          </button>
          <span className="min-w-24 text-center text-sm tabular-nums" aria-live="polite">
            {spread.map((i) => i + 1).join('–')} / {total}
          </span>
          <button
            type="button"
            className={buttonClass}
            onClick={() => turn('right')}
            disabled={leftIsNext ? isFirst : isLast}
            aria-label={leftIsNext ? 'Previous page' : 'Next page'}
          >
            →
          </button>
        </nav>

        <ToggleGroup
          label="Reading direction"
          options={READING_DIRECTIONS}
          labels={DIRECTION_LABELS}
          value={direction}
          onChange={(value) => setPreferences((p) => ({ ...p, direction: value }))}
        />
        <ToggleGroup
          label="Page layout"
          options={READING_MODES}
          labels={MODE_LABELS}
          value={readingMode}
          onChange={(value) => setPreferences((p) => ({ ...p, readingMode: value }))}
        />
        {readingMode === 'double' && (
          <ToggleGroup
            label="First page"
            options={SPREAD_STARTS}
            labels={SPREAD_START_LABELS}
            value={spreadStart}
            onChange={(value) => setPreferences((p) => ({ ...p, spreadStart: value }))}
          />
        )}
        <ToggleGroup
          label="Fit mode"
          options={FIT_MODES}
          labels={FIT_LABELS}
          value={fitMode}
          onChange={(value) => setPreferences((p) => ({ ...p, fitMode: value }))}
        />
      </header>

      <div className={`flex min-h-0 flex-1 ${sidebarPosition === 'right' ? 'flex-row-reverse' : ''}`}>
        <PageSidebar
          zip={zip}
          pages={manga.pages}
          current={spread}
          open={sidebarOpen}
          position={sidebarPosition}
          onSelect={setIndex}
          onMove={(position) => setPreferences((p) => ({ ...p, sidebarPosition: position }))}
        />
        <PageView
          zip={zip}
          pages={leftToRight(spread, direction).map((i) => manga.pages[i])}
          fitMode={fitMode}
          direction={direction}
        />
      </div>
    </div>
  );
}

type ToggleGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
};

function ToggleGroup<T extends string>({ label, options, labels, value, onChange }: ToggleGroupProps<T>) {
  return (
    <div className="flex rounded-lg bg-neutral-800/60 p-0.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={buttonClass}
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
