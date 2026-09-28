import { expect, test } from '@playwright/test';
import { leftToRight, spreadAt, stepSpread, type SpreadLayout } from '../src/reader/spreads';

const single: SpreadLayout = { mode: 'single', start: 'first-alone' };
const firstAlone: SpreadLayout = { mode: 'double', start: 'first-alone' };
const paired: SpreadLayout = { mode: 'double', start: 'paired' };

/** Every spread of a book, found by stepping forward from page 0. */
function allSpreads(pageCount: number, layout: SpreadLayout): number[][] {
  const spreads = [spreadAt(0, pageCount, layout)];
  for (let i = 0; ; ) {
    const next = stepSpread(i, true, pageCount, layout);
    if (next === spreadAt(i, pageCount, layout)[0]) return spreads;
    spreads.push(spreadAt(next, pageCount, layout));
    i = next;
  }
}

test('single mode shows one page at a time', () => {
  expect(allSpreads(3, single)).toEqual([[0], [1], [2]]);
});

test('first-alone shows page 1 alone, then pairs 2+3, 4+5, …', () => {
  expect(allSpreads(5, firstAlone)).toEqual([[0], [1, 2], [3, 4]]);
  expect(allSpreads(6, firstAlone)).toEqual([[0], [1, 2], [3, 4], [5]]);
  expect(allSpreads(1, firstAlone)).toEqual([[0]]);
});

test('paired starts with 1+2', () => {
  expect(allSpreads(5, paired)).toEqual([[0, 1], [2, 3], [4]]);
  expect(allSpreads(4, paired)).toEqual([[0, 1], [2, 3]]);
});

test('any page resolves to the spread that contains it', () => {
  expect(spreadAt(2, 5, firstAlone)).toEqual([1, 2]);
  expect(spreadAt(1, 5, paired)).toEqual([0, 1]);
  expect(spreadAt(4, 5, paired)).toEqual([4]);
});

test('stepping moves by whole spreads and stops at the ends', () => {
  expect(stepSpread(2, true, 5, firstAlone)).toBe(3); // from 2+3 to 4+5
  expect(stepSpread(2, false, 5, firstAlone)).toBe(0); // from 2+3 back to 1
  expect(stepSpread(3, false, 6, firstAlone)).toBe(1); // from 4+5 back to 2+3, not to 3
  expect(stepSpread(0, false, 5, firstAlone)).toBe(0);
  expect(stepSpread(4, true, 5, firstAlone)).toBe(3);
});

test('right-to-left spreads put the first page on the right', () => {
  expect(leftToRight([11, 12], 'ltr')).toEqual([11, 12]);
  expect(leftToRight([11, 12], 'rtl')).toEqual([12, 11]);
});
