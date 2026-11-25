/**
 * A knot being tightened, as the views need it: the shapes its rope passes through, sampled at the same
 * places along the rope so that one can be turned into the next point for point, and what the view takes
 * in at each. Pure: it knows nothing about the views or the clock.
 */
import { framePolylines, type FrameCurve, type KnotDocument, type Point3 } from '@idontknot/core';
import { pointAt } from './parts.ts';

export interface Tightening {
  /** The component that is tightened. */
  readonly rope: string;
  /** The shapes of the rope, from the one it is tied in to the tightest, each at the same places along it. */
  readonly shapes: readonly (readonly Point3[])[];
  /** What the view takes in at each shape: the knot, and a little of the rope at each side of it. */
  readonly windows: readonly Window[];
}

/** A box in the x-y plane, by its middle and its size. */
export interface Window {
  readonly centre: Point3;
  readonly width: number;
  readonly height: number;
}

/** The distance along the rope between the places a shape is sampled at, in rope diameters. */
const STEP = 0.15;
/** How much rope the view takes in at each side of a knot that is being tightened, in rope diameters. */
const BESIDE = 2.8;

/** How a knot of one rope is tightened, if its document says. */
export function tighteningOf(document: KnotDocument): Tightening | null {
  const ids = document.geometry?.tightening ?? [];
  const frames = ids.flatMap((id) => document.geometry?.frames.filter((frame) => frame.id === id) ?? []);
  const [component] = document.components;
  if (frames.length < 2 || frames.length !== ids.length || document.components.length !== 1 || !component?.length) {
    return null;
  }
  const d = 2 * (component.radius ?? 0.5);
  const count = Math.round(component.length / (STEP * d));
  const curves = frames.flatMap((frame) => framePolylines(document, frame).slice(0, 1));
  if (curves.length !== frames.length) return null;
  const shapes = curves.map((curve: FrameCurve) =>
    Array.from({ length: count + 1 }, (_, k) => pointAt(curve, (k * (component.length as number)) / count)),
  );
  const beside = Math.round(BESIDE / STEP);
  const windows = shapes.map((shape, which) => windowOf(which === 0 ? shape : knotOf(shape, beside), d / 2));
  return { rope: component.id, shapes, windows };
}

/** How far a point may lie from a straight line and still be on it, in the units of the shape. */
const STRAIGHT = 0.06;

/** How many points of a shape, counted from its first, lie on one straight line. */
function straightRun(shape: readonly Point3[]): number {
  const from = shape[0] as Point3;
  let run = 1;
  for (let end = 2; end < shape.length; end++) {
    const to = shape[end] as Point3;
    const line = [to[0] - from[0], to[1] - from[1], to[2] - from[2]] as const;
    const size = Math.hypot(...line) || 1;
    // every point so far must be near the line from the first to this one
    let straight = true;
    for (let i = 1; i < end && straight; i++) {
      const point = shape[i] as Point3;
      const v = [point[0] - from[0], point[1] - from[1], point[2] - from[2]] as const;
      const cross = Math.hypot(
        v[1] * line[2] - v[2] * line[1],
        v[2] * line[0] - v[0] * line[2],
        v[0] * line[1] - v[1] * line[0],
      );
      straight = cross / size <= STRAIGHT;
    }
    if (!straight) break;
    run = end;
  }
  return run;
}

/** The part of a shape that is not its two straight ends, with some points of each end beside it. */
function knotOf(shape: readonly Point3[], beside: number): readonly Point3[] {
  const first = straightRun(shape);
  const last = shape.length - 1 - straightRun([...shape].reverse());
  if (first >= last) return shape;
  return shape.slice(Math.max(first - beside, 0), Math.min(last + beside, shape.length - 1) + 1);
}

function windowOf(points: readonly Point3[], margin: number): Window {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
  }
  return {
    centre: [(minX + maxX) / 2, (minY + maxY) / 2, 0],
    width: maxX - minX + 2 * margin,
    height: maxY - minY + 2 * margin,
  };
}

// written so that the two ends of a movement are exactly the two shapes
const mix = (a: number, b: number, t: number): number => a * (1 - t) + b * t;

/** Between which two shapes a knot is, when it is tightened by `amount` from 0 (as tied) to 1 (tight), and how far. */
function place(tightening: Tightening, amount: number): [from: number, to: number, t: number] {
  const last = tightening.shapes.length - 1;
  const at = Math.min(Math.max(amount, 0), 1) * last;
  const from = Math.min(Math.floor(at), last - 1);
  return [from, from + 1, at - from];
}

/** The shape of the rope when the knot is tightened by `amount`, from 0 (as it was tied) to 1 (tight). */
export function shapeAt(tightening: Tightening, amount: number): Point3[] {
  const [from, to, t] = place(tightening, amount);
  const [a, b] = [tightening.shapes[from] as readonly Point3[], tightening.shapes[to] as readonly Point3[]];
  return a.map((point, i) => {
    const other = b[i] as Point3;
    return [mix(point[0], other[0], t), mix(point[1], other[1], t), mix(point[2], other[2], t)];
  });
}

/** What the view takes in when the knot is tightened by `amount`. */
export function windowAt(tightening: Tightening, amount: number): Window {
  const [from, to, t] = place(tightening, amount);
  const [a, b] = [tightening.windows[from] as Window, tightening.windows[to] as Window];
  return {
    centre: [mix(a.centre[0], b.centre[0], t), mix(a.centre[1], b.centre[1], t), mix(a.centre[2], b.centre[2], t)],
    width: mix(a.width, b.width, t),
    height: mix(a.height, b.height, t),
  };
}

/** Slow at both ends and quick between them: how far along a movement is, from how much of its time has passed. */
export function eased(time: number): number {
  const t = Math.min(Math.max(time, 0), 1);
  return t * t * (3 - 2 * t);
}
