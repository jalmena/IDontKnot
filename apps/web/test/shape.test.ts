import { framePolylines } from '@idontknot/core';
import { expect, it } from 'vitest';
import { KNOTS } from '../src/knot/library.ts';
import { fitOf, ropesOf, shownFrame } from '../src/knot/shape.ts';

const { document } = KNOTS['figure-eight']!;

it('shows a knot in the shape its method of tying is told on', () => {
  const frame = shownFrame(document);
  expect(frame?.id).toBe(document.construction?.methods[0]?.frame);
  // a knot that the library does not say how to tie is shown in its first shape
  const untold = { ...document, construction: undefined };
  expect(shownFrame(untold)?.id).toBe(document.geometry?.frames[0]?.id);
  expect(shownFrame({ ...untold, geometry: { frames: [] } })).toBeUndefined();
});

it('turns the curves of a shape into ropes of the material that is chosen', () => {
  const curves = framePolylines(document, shownFrame(document)!);
  const ropes = ropesOf(document, curves, 'sisal');
  expect(ropes).toHaveLength(1);
  expect(ropes[0]).toMatchObject({ closed: false, radius: 0.5, material: 'sisal', index: 0 });
  expect(ropes[0]?.points).toBe(curves[0]?.points);
});

it('takes in the whole rope and its thickness, with the margins it is given', () => {
  const curves = framePolylines(document, shownFrame(document)!);
  const fit = fitOf(curves);
  // the figure-eight knot lies along x, from one end of the rope to the other, half a diameter beyond each
  expect(fit.width).toBeCloseTo(20.2, 1);
  expect(fit.centre[0]).toBeCloseTo(0, 6);
  expect(fit.centre[2]).toBe(0);
  expect(fit.clear).toBeUndefined();
  const clear = { top: 1, right: 2, bottom: 3, left: 4 };
  expect(fitOf(curves, clear).clear).toBe(clear);
});
