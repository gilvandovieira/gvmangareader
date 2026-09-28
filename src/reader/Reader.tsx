import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Cbz } from '../cbz/cbz';
import { FIT_MODES, READING_DIRECTIONS, type FitMode, type ReadingDirection } from '../model/manga';
import { loadPreferences, savePreferences } from '../storage/preferences';
import { usePageUrl } from './usePageUrl';

const DIRECTION_LABELS: Record<ReadingDirection, string> = { rtl: 'RTL', ltr: 'LTR' };
const FIT_LABELS: Record<FitMode, string> = {
  contain: 'Contain',
  'fit-width': 'Width',
  'fit-height': 'Height',
};
const IMAGE_CLASSES: Record<FitMode, string> = {
  contain: 'h-full w-full object-contain',
  'fit-width': 'w-full',
  'fit-height': 'h-full w-auto max-w-none shrink-0',
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
  const [index, setIndex] = useState(0);
  const [preferences, setPreferences] = useState(loadPreferences);
  const { direction, fitMode } = preferences;
  const total = manga.pages.length;
  const { url, error } = usePageUrl(zip, manga.pages[index]);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => savePreferences(preferences), [preferences]);

  useEffect(() => {
    viewport.current?.scrollTo(0, 0);
  }, [url]);

  /** Turns the page toward a physical side, so ← always means "the page on the left". */
  const turn = useCallback(
    (side: 'left' | 'right') => {
      const forward = (side === 'right') === (direction === 'ltr');
      setIndex((i) => Math.min(Math.max(i + (forward ? 1 : -1), 0), total - 1));
    },
    [direction, total],
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

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const leftIsNext = direction === 'rtl';

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-800 bg-neutral-900 px-3 py-2">
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
          <span className="min-w-16 text-center text-sm tabular-nums" aria-live="polite">
            {index + 1} / {total}
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
          label="Fit mode"
          options={FIT_MODES}
          labels={FIT_LABELS}
          value={fitMode}
          onChange={(value) => setPreferences((p) => ({ ...p, fitMode: value }))}
        />
      </header>

      <div ref={viewport} className="flex min-h-0 flex-1 overflow-auto">
        {error ? (
          <p className="m-auto text-sm text-red-400" role="alert">
            Could not load page {index + 1}: {error}
          </p>
        ) : url ? (
          <img src={url} alt={`Page ${index + 1}`} className={`m-auto ${IMAGE_CLASSES[fitMode]}`} />
        ) : (
          <p className="m-auto text-sm text-neutral-500">Loading…</p>
        )}
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
