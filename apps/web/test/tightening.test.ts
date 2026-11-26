import { expect, it } from 'vitest';
import { KNOTS } from '../src/knot/library.ts';
import { eased, shapeAt, tighteningOf, windowAt } from '../src/knot/tightening.ts';

const { document } = KNOTS['figure-eight']!;
const tightening = tighteningOf(document);
if (!tightening) throw new Error('the figure-eight knot of the library can be tightened');
const { length = 0 } = document.components[0] ?? {};

const run = (points: readonly (readonly number[])[]): number =>
  points.slice(1).reduce((sum, point, i) => sum + Math.hypot(...point.map((x, c) => x - points[i]![c]!)), 0);

it('reads how a knot is tightened: its shapes, each given at the same places of the knot', () => {
  expect(tightening.rope).toBe('rope');
  expect(tightening.shapes).toHaveLength(document.geometry?.tightening?.length ?? 0);
  const count = tightening.shapes[0]?.length ?? 0;
  expect(count).toBeGreaterThan(300);
  for (const shape of tightening.shapes) expect(shape).toHaveLength(count);
  // the rope does not stretch: every shape is as long as the rope
  for (const shape of tightening.shapes) {
    expect(run(shape) / length).toBeGreaterThan(0.99);
    expect(run(shape) / length).toBeLessThan(1.01);
  }
  // every shape begins and ends where its frame does
  expect(tightening.shapes[0]?.[0]).toEqual([-9.6, 0, 0]);
});

it('has nothing to say of a knot whose document does not say how it is tightened', () => {
  const frames = document.geometry?.frames ?? [];
  expect(tighteningOf({ ...document, geometry: { frames } })).toBeNull();
  expect(tighteningOf({ ...document, geometry: { frames, tightening: ['dressed', 'missing'] } })).toBeNull();
});

it('goes from the shape the knot is tied in to the tightest, as points at equal distances along the rope', () => {
  for (const amount of [0, 0.31, 1, 7]) {
    const shape = shapeAt(tightening, amount);
    expect(shape).toHaveLength(tightening.count + 1);
    const gaps = shape.slice(1).map((point, i) => Math.hypot(...point.map((x, c) => x - shape[i]![c]!)));
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.05);
  }
  // it begins as the shape the knot is tied in, and ends as the tightest
  const [first, last] = [tightening.shapes[0]!, tightening.shapes.at(-1)!];
  const near = (a: readonly number[] | undefined, b: readonly number[] | undefined): void =>
    a?.forEach((x, c) => expect(x).toBeCloseTo(b?.[c] ?? NaN, 6));
  near(shapeAt(tightening, 0)[0], first[0]);
  near(shapeAt(tightening, 0).at(-1), first.at(-1));
  near(shapeAt(tightening, 1).at(-1), last.at(-1));
  expect(run(shapeAt(tightening, 0))).toBeCloseTo(run(first), 1);
  expect(run(shapeAt(tightening, 1))).toBeCloseTo(run(last), 1);
});

it('tightens steadily: no part of the knot closes ahead of the rest and opens again', () => {
  // how far the two loops of the figure-eight knot stand from the line of the rope, and how long the
  // rope is, all the way through
  const heights: number[] = [];
  for (let amount = 0; amount <= 1.0001; amount += 0.0125) {
    const shape = shapeAt(tightening, amount);
    heights.push(Math.max(...shape.map((point) => Math.abs(point[1]))));
    // a shape between two shapes of the tightening is not a shorter rope, as it is when each point of
    // the rope is moved straight from its place in one to its place in the next
    expect(run(shape) / length).toBeGreaterThan(0.985);
    expect(run(shape) / length).toBeLessThan(1.01);
  }
  // its loops close steadily until it is about a diameter high
  const lowest = heights.indexOf(Math.min(...heights));
  for (let k = 1; k <= lowest; k++) expect(heights[k]).toBeLessThanOrEqual(heights[k - 1]! + 1e-3);
  // and then, drawn by its ends, it grows a little rounder, by less than a third of a diameter
  for (let k = lowest; k < heights.length; k++) expect(heights[k]).toBeLessThan(heights[lowest]! + 0.3);
  // and it closes at an even pace: no step is many times the one before
  const steps = heights.slice(1, lowest + 1).map((height, k) => heights[k]! - height);
  for (let k = 9; k < steps.length - 9; k++) expect(steps[k]).toBeLessThan(3 * steps[k - 1]! + 0.01);
});

it('takes in the whole rope to begin with, and closes in on the knot as it tightens', () => {
  const widths = tightening.windows.map((window) => window.width);
  // tied, the rope is twenty diameters from end to end, and its own thickness more
  expect(widths[0]).toBeCloseTo(20.2, 1);
  for (let k = 2; k < widths.length; k++) expect(widths[k]).toBeLessThanOrEqual(widths[k - 1]!);
  expect(widths.at(-1)).toBeLessThan(widths[2]!);
  // tight, the knot is under five diameters long, with some rope at each side of it
  expect(widths.at(-1)).toBeLessThan(14);
  expect(widths.at(-1)).toBeGreaterThan(8);
  expect(windowAt(tightening, 0)).toEqual(tightening.windows[0]);
  expect(windowAt(tightening, 1)).toEqual(tightening.windows.at(-1));
  expect(Math.abs(windowAt(tightening, 1).centre[0])).toBeLessThan(0.5);
});

it('moves slowly at both ends of a movement', () => {
  expect([0, 0.5, 1].map(eased)).toEqual([0, 0.5, 1]);
  expect(eased(0.1)).toBeLessThan(0.1);
  expect(eased(0.9)).toBeGreaterThan(0.9);
  expect([-1, 2].map(eased)).toEqual([0, 1]);
});

it('takes longer to draw tight a knot that changes more, but never more than a little longer', () => {
  const seconds = (id: string): number => tighteningOf(KNOTS[id]!.document)?.seconds ?? 0;
  expect(seconds('overhand')).toBeGreaterThanOrEqual(1.8);
  expect(seconds('double-overhand')).toBeGreaterThan(seconds('overhand') + 0.5);
  for (const id of ['overhand', 'double-overhand', 'figure-eight', 'bowline', 'clove-hitch', 'larks-head']) {
    expect(seconds(id)).toBeLessThanOrEqual(1.8 * 1.6 + 1e-9);
  }
});
