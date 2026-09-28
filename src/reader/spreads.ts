import type { ReadingDirection, ReadingMode, SpreadStart } from '../model/manga';

export type SpreadLayout = { mode: ReadingMode; start: SpreadStart };

/**
 * Returns the indexes of the pages shown together with `index`, in reading order: one page in
 * single mode, otherwise two, except for a lone first page (`first-alone`) or an odd last page.
 */
export function spreadAt(index: number, pageCount: number, { mode, start }: SpreadLayout): number[] {
  if (mode === 'single') return [index];
  const offset = start === 'first-alone' ? 1 : 0;
  if (index < offset) return [0];
  const first = index - ((index - offset) % 2);
  return first + 1 < pageCount ? [first, first + 1] : [first];
}

/** The first page of the next (`forward`) or previous spread, or of the current one at either end. */
export function stepSpread(index: number, forward: boolean, pageCount: number, layout: SpreadLayout): number {
  const spread = spreadAt(index, pageCount, layout);
  if (forward) {
    const next = spread[spread.length - 1] + 1;
    return next < pageCount ? next : spread[0];
  }
  return spread[0] > 0 ? spreadAt(spread[0] - 1, pageCount, layout)[0] : spread[0];
}

/** Orders a spread from left to right on screen: right-to-left books show the first page on the right. */
export function leftToRight<T>(spread: readonly T[], direction: ReadingDirection): T[] {
  return direction === 'rtl' ? [...spread].reverse() : [...spread];
}
