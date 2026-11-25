/**
 * Tightening a knot: the shapes an open rope passes through as its knot is drawn tight.
 *
 * The rope is followed by particles at equal distances along it. Step by step the knot is made a little
 * smaller, as a whole, and the particles are put back at their distances along the smaller curve: the rope
 * the knot gives up runs out into its two ends, which lengthen, straight. After each step the rope is
 * moved until it keeps the rules of a rope again: it does not pass through itself, it does not bend
 * tighter than it can, and it is a little stiff. When a step cannot be made without breaking them, the
 * knot is tight.
 *
 * Nothing rubs and nothing stretches: this is the shape a knot takes when pulled by both ends, not a
 * measure of how well it holds.
 */

import { framePolylines, sampleCurve, type CurvePoint, type Frame, type KnotDocument } from './document.ts';
import type { Point3 } from './geometry.ts';

export interface TightenOptions {
  /** The distance between the particles that follow the rope, in rope diameters. */
  readonly spacing?: number;
  /** How stiff the rope is: how far, in each pass, a particle is drawn towards the middle of its neighbours. */
  readonly stiffness?: number;
  /** How many shapes on the way to the tightest are kept, at equal steps. */
  readonly keep?: number;
}

export interface Tightening {
  /** The distance along the rope from one particle to the next. */
  readonly spacing: number;
  /** The shapes the rope passes through, the tightest last: each is the particles of the rope, in order. */
  readonly shapes: readonly (readonly Point3[])[];
}

type Particle = [number, number, number];

const sub = (a: Point3, b: Point3): Particle => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
// written out, so that every machine gets the same number
const size = (a: Point3): number => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const mix = (a: Point3, b: Point3, t: number): Particle => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** The unit vector from b to a. */
const from = (a: Point3, b: Point3): Particle => {
  const v = sub(a, b);
  const l = size(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
/** The radius of the circle through three points. */
function bend(a: Point3, b: Point3, c: Point3): number {
  const [u, v] = [sub(b, a), sub(c, a)];
  const area = size([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]) / 2;
  return area < 1e-12 ? Infinity : (size(u) * size(sub(c, b)) * size(v)) / (4 * area);
}

/** How much the knot is made smaller in a step, to begin with; and below what the knot is taken to be tight. */
const SHRINK = 0.006;
const LEAST_SHRINK = 0.0004;
/** The most steps: a rope that is not knotted never comes tight. */
const MOST_STEPS = 3000;
/** The tightest bend the rope is allowed, in diameters, and the spans over which it is held to it, in particles. */
const TIGHTEST_BEND = 0.66;
const SPANS = [1, 2, 4];
/** What a shape must keep to be taken: how near two strands may come and how tight a bend may be, in diameters. */
const NEAREST = 0.985;
const SHARPEST = 0.53;

/**
 * The shapes an open rope passes through as it is tightened. `points` is its centerline and `s` the
 * material coordinate of each point, from 0 to the length of the rope.
 */
export function tighten(
  points: readonly Point3[],
  s: readonly number[],
  radius: number,
  options: TightenOptions = {},
): Tightening {
  const d = 2 * radius;
  const length = s[s.length - 1] ?? 0;
  const n = Math.max(Math.round(length / ((options.spacing ?? 0.25) * d)), 8);
  const h = length / n;
  const stiffness = options.stiffness ?? 0.05;

  // nearer than this along the rope, two particles are neighbours and may be as close as they like
  const neighbours = Math.round((0.95 * Math.PI * d) / h);
  const least = SPANS.map((m) => 2 * TIGHTEST_BEND * d * Math.sin((m * h) / (TIGHTEST_BEND * d)));

  const at = (coordinate: number): Particle => {
    let i = 0;
    while (i < s.length - 2 && (s[i + 1] as number) < coordinate) i++;
    const [a, b] = [s[i] as number, s[i + 1] as number];
    return mix(points[i] as Point3, points[i + 1] as Point3, Math.min(Math.max((coordinate - a) / (b - a || 1), 0), 1));
  };
  let p: Particle[] = Array.from({ length: n + 1 }, (_, k) => at(k * h));

  /** Moves two particles along the line between them until they are a distance apart, or at least that. */
  const apart = (q: Particle[], i: number, j: number, distance: number, exactly: boolean): void => {
    const [a, b] = [q[i] as Particle, q[j] as Particle];
    const delta = sub(b, a);
    const now = size(delta) || 1e-9;
    if (!exactly && now >= distance) return;
    const move = (distance - now) / now / 2;
    for (let c = 0; c < 3; c++) {
      a[c] = (a[c] as number) - (delta[c] as number) * move;
      b[c] = (b[c] as number) + (delta[c] as number) * move;
    }
  };

  /** Moves the particles towards keeping the rules of a rope. */
  const relax = (q: Particle[], sweeps: number): void => {
    const pairs: [number, number][] = [];
    const reach = (d + 0.2) ** 2;
    for (let i = 0; i <= n; i++) {
      const a = q[i] as Particle;
      for (let j = i + neighbours; j <= n; j++) {
        const b = q[j] as Particle;
        if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 < reach) pairs.push([i, j]);
      }
    }
    for (let k = 0; k < sweeps; k++) {
      // it is a little stiff: each particle is drawn towards the middle of its neighbours
      for (let i = 1; i < n; i++) {
        const [before, here, after] = [q[i - 1] as Particle, q[i] as Particle, q[i + 1] as Particle];
        for (let c = 0; c < 3; c++) {
          here[c] =
            (here[c] as number) +
            stiffness * (((before[c] as number) + (after[c] as number)) / 2 - (here[c] as number));
        }
      }
      // it does not stretch
      if (k % 2 === 0) for (let i = 0; i < n; i++) apart(q, i, i + 1, h, true);
      else for (let i = n - 1; i >= 0; i--) apart(q, i, i + 1, h, true);
      // it does not bend tighter than it can
      SPANS.forEach((m, which) => {
        for (let i = m; i + m <= n; i++) apart(q, i - m, i + m, least[which] as number, false);
      });
      // and, last of all, it does not pass through itself
      for (let again = 0; again < 3; again++) for (const [i, j] of pairs) apart(q, i, j, d, false);
    }
  };

  /** The stretch of rope that is the knot: from the first particle that touches another to the last. */
  const knot = (q: Particle[]): [first: number, last: number] => {
    let [first, last] = [n, 0];
    for (let i = 0; i <= n; i++) {
      for (let j = i + neighbours; j <= n; j++) {
        if (size(sub(q[i] as Particle, q[j] as Particle)) < 1.08 * d) {
          first = Math.min(first, i);
          last = Math.max(last, j);
        }
      }
    }
    return first > last ? [0, n] : [first, last];
  };

  /** The particles at their distances along a polyline, from the place of one of them; what is over lengthens the ends. */
  const spaced = (q: Particle[], middle: number): Particle[] => {
    const along = [0];
    for (let i = 1; i <= n; i++)
      along.push((along[i - 1] as number) + size(sub(q[i] as Particle, q[i - 1] as Particle)));
    const total = along[n] as number;
    const [start, end] = [from(q[0] as Particle, q[3] as Particle), from(q[n] as Particle, q[n - 3] as Particle)];
    let segment = 0;
    return q.map((_, i) => {
      const want = (along[middle] as number) + (i - middle) * h;
      if (want <= 0)
        return mix(q[0] as Particle, [q[0]![0] + start[0], q[0]![1] + start[1], q[0]![2] + start[2]], -want);
      if (want >= total) {
        return mix(q[n] as Particle, [q[n]![0] + end[0], q[n]![1] + end[1], q[n]![2] + end[2]], want - total);
      }
      while (segment < n - 1 && (along[segment + 1] as number) < want) segment++;
      const [a, b] = [along[segment] as number, along[segment + 1] as number];
      return mix(q[segment] as Particle, q[segment + 1] as Particle, (want - a) / (b - a || 1));
    });
  };

  /** Whether a shape keeps the rules: measured on the curve drawn through its particles, as a frame is checked. */
  const sound = (q: Particle[]): boolean => {
    for (let i = 0; i <= n; i++) {
      for (let j = i + neighbours; j <= n; j++) {
        if (size(sub(q[i] as Particle, q[j] as Particle)) < NEAREST * d) return false;
      }
    }
    const fine = sampleCurve(
      { type: 'catmull-rom', points: q.map((point, k) => [...point, k * h] as const) },
      false,
    ).points;
    for (let i = 1; i < fine.length - 1; i++) {
      if (bend(fine[i - 1] as Point3, fine[i] as Point3, fine[i + 1] as Point3) < SHARPEST * d) return false;
    }
    return true;
  };

  const taken: Particle[][] = [];
  const inKnot: number[] = [];
  let shrink = SHRINK;
  while (taken.length < MOST_STEPS && shrink > LEAST_SHRINK) {
    const [first, last] = knot(p);
    const centre: Particle = [0, 0, 0];
    for (let i = first; i <= last; i++)
      for (let c = 0; c < 3; c++) centre[c] = (centre[c] as number) + (p[i]![c] as number);
    for (let c = 0; c < 3; c++) centre[c] = (centre[c] as number) / (last - first + 1);
    const middle = Math.round((first + last) / 2);
    // every particle a little nearer the middle of the knot: the curve has the same shape, and is shorter
    let q = p.map((point) => mix(centre, point, 1 - shrink));
    let tries = 0;
    let kept: boolean;
    do {
      relax(q, 10);
      // the particles go back to their distances along the curve; what is left over lengthens the two ends
      q = spaced(q, middle);
      kept = sound(q);
    } while (!kept && ++tries < 8);
    if (!kept) {
      // too much at once, or no more to give: the step is not made, and a smaller one is tried
      shrink /= 2;
      continue;
    }
    p = q;
    taken.push(p);
    inKnot.push((last - first) * h);
    // the knot gives up no more rope
    if (inKnot.length > 80 && (inKnot[inKnot.length - 81] as number) - (inKnot[inKnot.length - 1] as number) < 0.02 * d)
      break;
  }

  const keep = Math.min(options.keep ?? 6, Math.max(taken.length - 1, 0));
  const shapes: Particle[][] = [];
  for (let k = 1; k <= keep; k++) shapes.push(taken[Math.round((k * taken.length) / (keep + 1)) - 1] as Particle[]);
  if (taken.length > 0) shapes.push(taken[taken.length - 1] as Particle[]);
  return { spacing: h, shapes };
}

/** The id given to the tightest frame; the frames on the way to it are `tightening-1`, `tightening-2` and so on. */
export const TIGHT_FRAME = 'tight';

/**
 * The control points of a curve through the particles of a shape: every particle where the rope bends, and
 * one in eight where it runs straight, which a curve through them does as well with fewer.
 */
function controlPoints(shape: readonly Point3[], spacing: number, length: number): CurvePoint[] {
  const n = shape.length - 1;
  const straight = (i: number): boolean =>
    i <= 0 || i >= n || bend(shape[i - 1] as Point3, shape[i] as Point3, shape[i + 1] as Point3) > 1e4;
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  const points: CurvePoint[] = [];
  shape.forEach((point, i) => {
    const bent = [-2, -1, 0, 1, 2].some((k) => !straight(i + k));
    if (i !== 0 && i !== n && i % 8 !== 0 && !bent) return;
    points.push([round(point[0]), round(point[1]), round(point[2]), i === n ? length : round(i * spacing)]);
  });
  return points;
}

/**
 * The frames that the knot of a document passes through as it is tightened from one of its frames: a few
 * on the way and, last, the tightest, which says it realises the topology if the frame it started from
 * does. Only for a document that is one open rope: for any other, nothing.
 */
export function tighteningFrames(document: KnotDocument, start: Frame, options: TightenOptions = {}): Frame[] {
  const [rope] = document.components;
  if (document.components.length !== 1 || !rope || rope.kind !== 'rope' || rope.closed || !rope.length) return [];
  const [curve] = framePolylines(document, start);
  if (!curve) return [];
  const { spacing, shapes } = tighten(curve.points, curve.s, rope.radius ?? 0.5, options);
  return shapes.map((shape, k) => {
    const tightest = k === shapes.length - 1;
    return {
      id: tightest ? TIGHT_FRAME : `tightening-${k + 1}`,
      ...(tightest && start.realises ? { realises: start.realises } : {}),
      curves: { [rope.id]: { type: 'catmull-rom', points: controlPoints(shape, spacing, rope.length as number) } },
    };
  });
}
