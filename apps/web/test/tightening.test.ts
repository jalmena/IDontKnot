import { expect, it } from 'vitest';
import { KNOTS } from '../src/knot/library.ts';
import { eased, shapeAt, tighteningOf, windowAt } from '../src/knot/tightening.ts';

const { document } = KNOTS['figure-eight']!;
const tightening = tighteningOf(document);
if (!tightening) throw new Error('the figure-eight knot of the library can be tightened');
const { length = 0 } = document.components[0] ?? {};

it('reads how a knot is tightened: its shapes, each at the same places along the rope', () => {
  expect(tightening.rope).toBe('rope');
  expect(tightening.shapes).toHaveLength(document.geometry?.tightening?.length ?? 0);
  const count = tightening.shapes[0]?.length ?? 0;
  expect(count).toBeGreaterThan(300);
  for (const shape of tightening.shapes) expect(shape).toHaveLength(count);
  // the rope does not stretch: every shape is as long as the rope
  for (const shape of tightening.shapes) {
    let run = 0;
    for (let i = 1; i < shape.length; i++) run += Math.hypot(...shape[i]!.map((x, c) => x - shape[i - 1]![c]!));
    expect(run / length).toBeGreaterThan(0.99);
    expect(run / length).toBeLessThan(1.01);
  }
});

it('has nothing to say of a knot whose document does not say how it is tightened', () => {
  const frames = document.geometry?.frames ?? [];
  expect(tighteningOf({ ...document, geometry: { frames } })).toBeNull();
  expect(tighteningOf({ ...document, geometry: { frames, tightening: ['dressed', 'missing'] } })).toBeNull();
});

it('goes from the shape the knot is tied in to the tightest, point for point', () => {
  expect(shapeAt(tightening, 0)).toEqual(tightening.shapes[0]);
  expect(shapeAt(tightening, 1)).toEqual(tightening.shapes.at(-1));
  expect(shapeAt(tightening, 7)).toEqual(tightening.shapes.at(-1));
  // half way between two shapes, every point is half way between its two places
  const steps = tightening.shapes.length - 1;
  const between = shapeAt(tightening, 0.5 / steps);
  const [a, b] = [tightening.shapes[0]!, tightening.shapes[1]!];
  between.forEach((point, i) => point.forEach((x, c) => expect(x).toBeCloseTo((a[i]![c]! + b[i]![c]!) / 2, 9)));
});

it('takes in the whole rope to begin with, and closes in on the knot as it tightens', () => {
  const widths = tightening.windows.map((window) => window.width);
  // tied, the rope is twenty diameters from end to end, and its own thickness more
  expect(widths[0]).toBeCloseTo(20.2, 1);
  for (let k = 2; k < widths.length; k++) expect(widths[k]).toBeLessThan(widths[k - 1]!);
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
