/**
 * A knot being tightened, as the views need it: the shapes its rope passes through, sampled at the same
 * places along the rope so that one can be turned into the next point for point, and what the view takes
 * in at each. Pure: it knows nothing about the views or the clock.
 */
import {
  diagramFromGeometry,
  framePolylines,
  SPAN_PIECES,
  type FrameCurve,
  type KnotDocument,
  type Point3,
} from '@idontknot/core';
import { pointAt } from './parts.ts';

export interface Tightening {
  /** The component that is tightened. */
  readonly rope: string;
  /**
   * The shapes of the rope, from the one it is tied in to the tightest, each given at the same places of
   * the knot: as many points between one crossing the rope meets and the next, in every shape. A point of
   * one shape and the same point of the next are then the same place of the knot, and not the same rope:
   * as a knot tightens its rope slides through it, and a point of the rope goes a long way round.
   */
  readonly shapes: readonly (readonly Point3[])[];
  /** How many stretches of equal length a shape is drawn in. */
  readonly count: number;
  /** Where along the rope each shape meets its first crossing: where its standing part comes into the knot. */
  readonly entries: readonly number[];
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

/** What has been worked out for each document: working it out takes a moment for a knot with many shapes. */
const known = new WeakMap<KnotDocument, Tightening | null>();

/** How a knot of one rope is tightened, if its document says. */
export function tighteningOf(document: KnotDocument): Tightening | null {
  if (!known.has(document)) known.set(document, work(document));
  return known.get(document) ?? null;
}

/**
 * The curve to look for crossings on: a shape given by many points is its own control points, which are
 * close enough together; only one given by few is cut finer, as the views draw it.
 */
function forCrossings(curve: FrameCurve): FrameCurve {
  const each = curve.points.length > 1500 ? SPAN_PIECES : 1;
  if (each === 1) return curve;
  const keep = (_: unknown, i: number): boolean => i % each === 0 || i === curve.points.length - 1;
  return { ...curve, points: curve.points.filter(keep), s: curve.s.filter(keep) };
}

function work(document: KnotDocument): Tightening | null {
  const ids = document.geometry?.tightening ?? [];
  const frames = ids.flatMap((id) => document.geometry?.frames.filter((frame) => frame.id === id) ?? []);
  // one rope, and maybe things it is tied round, which stay where they are
  const ropes = document.components.filter((each) => each.kind === 'rope');
  const [component] = ropes;
  if (frames.length < 2 || frames.length !== ids.length || ropes.length !== 1 || !component?.length) return null;
  const length = component.length;
  const d = 2 * (component.radius ?? 0.5);
  const count = Math.round(length / (STEP * d));
  const curves = frames.flatMap((frame) =>
    framePolylines(document, frame).filter((curve) => curve.id === component.id),
  );
  if (curves.length !== frames.length) return null;

  // where along the rope each shape meets its crossings: the places of the knot that every shape has
  const met = curves.map((full: FrameCurve): number[] | null => {
    const curve = forCrossings(full);
    const { visits, issues } = diagramFromGeometry([curve]);
    if (issues.length > 0) return null;
    const along = (visits[curve.id] ?? []).map(({ at }) => {
      const i = Math.min(Math.floor(at), curve.s.length - 2);
      return (curve.s[i] as number) + (at - i) * ((curve.s[i + 1] as number) - (curve.s[i] as number));
    });
    return [0, ...along, length];
  });
  // shapes that do not all meet the same crossings can only be matched by the rope itself
  const alike = met.every((marks) => marks !== null && marks.length === met[0]?.length);
  const marks = met.map((each) => (alike && each ? each : [0, length]));
  const stretches = (marks[0] as number[]).length - 1;
  const points = Array.from({ length: stretches }, (_, j) =>
    Math.max(
      2,
      Math.ceil(Math.max(...marks.map((each) => (each[j + 1] as number) - (each[j] as number))) / (STEP * d)),
    ),
  );
  const shapes = curves.map((curve: FrameCurve, which) => {
    const each = marks[which] as number[];
    const shape: Point3[] = [];
    for (let j = 0; j < stretches; j++) {
      const [from, to] = [each[j] as number, each[j + 1] as number];
      for (let i = 0; i < (points[j] as number); i++)
        shape.push(pointAt(curve, from + ((to - from) * i) / (points[j] as number)));
    }
    shape.push(pointAt(curve, length));
    return shape;
  });
  const beside = Math.round(BESIDE / STEP);
  const windows = shapes.map((shape, which) => {
    const even = evenly(shape, count);
    return windowOf(which === 0 ? even : knotOf(even, beside), d / 2);
  });
  const entries = marks.map((each) => (each.length > 2 ? (each[1] as number) : 0));
  return { rope: component.id, shapes, count, windows, entries };
}

/** The same curve as so many stretches of equal length. */
function evenly(points: readonly Point3[], count: number): Point3[] {
  const along = [0];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1] as Point3, points[i] as Point3];
    along.push((along[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = along[along.length - 1] as number;
  const even: Point3[] = [];
  let i = 0;
  for (let k = 0; k <= count; k++) {
    const want = (total * k) / count;
    while (i < points.length - 2 && (along[i + 1] as number) < want) i++;
    const [from, to] = [along[i] as number, along[i + 1] as number];
    const t = to > from ? Math.min(Math.max((want - from) / (to - from), 0), 1) : 0;
    const [a, b] = [points[i] as Point3, points[i + 1] as Point3];
    even.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  return even;
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

/**
 * The shape of the rope when the knot is tightened by `amount`, from 0 (as it was tied) to 1 (tight), as
 * points at equal distances along the rope. It passes through every shape of the tightening, and between
 * two of them goes smoothly: without a start or a stop at each.
 */
export function shapeAt(tightening: Tightening, amount: number): Point3[] {
  const [from, to, t] = place(tightening, amount);
  const { shapes } = tightening;
  const [before, a, b, after] = [
    shapes[Math.max(from - 1, 0)] as readonly Point3[],
    shapes[from] as readonly Point3[],
    shapes[to] as readonly Point3[],
    shapes[Math.min(to + 1, shapes.length - 1)] as readonly Point3[],
  ];
  // the curve through four values that are equally far apart in time, between the second and the third
  const through = (p0: number, p1: number, p2: number, p3: number): number =>
    0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  const points = a.map((point, i): Point3 => {
    const [p0, p2, p3] = [before[i] as Point3, b[i] as Point3, after[i] as Point3];
    return [
      through(p0[0], point[0], p2[0], p3[0]),
      through(p0[1], point[1], p2[1], p3[1]),
      through(p0[2], point[2], p2[2], p3[2]),
    ];
  });
  return evenly(points, tightening.count);
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

/** Where the standing part comes into the knot when it is tightened by `amount`, along the rope. */
export function entryAt(tightening: Tightening, amount: number): number {
  const [from, to, t] = place(tightening, amount);
  const [a, b] = [tightening.entries[from] as number, tightening.entries[to] as number];
  return a + (b - a) * t;
}
