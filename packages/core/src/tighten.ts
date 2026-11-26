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

import {
  documentDiagram,
  framePolylines,
  identicalDiagrams,
  sampleCurve,
  type CurvePoint,
  type Frame,
  type KnotDocument,
} from './document.ts';
import { diagramFromGeometry, type Point3 } from './geometry.ts';

export interface TightenOptions {
  /** The distance between the particles that follow the rope, in rope diameters. */
  readonly spacing?: number;
  /** How stiff the rope is: how far, in each pass, a particle is drawn towards the middle of its neighbours. */
  readonly stiffness?: number;
  /** How many shapes on the way to the tightest are kept, at equal steps. */
  readonly keep?: number;
  /**
   * How near two strands may come, in rope diameters: 1 is rope that keeps its thickness, and less is rope
   * that is pressed thinner where it bears on itself, as rope is in a knot drawn hard.
   */
  readonly nearest?: number;
  /** The radius of the tightest bend a shape may have, in rope diameters. */
  readonly sharpest?: number;
  /**
   * How many times, at most, the two ends are drawn apart after the knot has been made as small as it
   * goes as a whole: each time by a twentieth of a diameter or less.
   */
  readonly draw?: number;
  /**
   * A stretch of the rope that is not drawn tight with the knot, from one material coordinate to another:
   * an eye, in which something stands. It is not made smaller: it goes with the knot as it is, by its two
   * ends. The rope of the knot before it runs out into the start of the rope, and the rope after it into
   * its end.
   */
  readonly held?: readonly [from: number, to: number];
  /**
   * Straight rigid things the rope is tied round, such as a post: it does not pass into them, and they do
   * not move. A knot tied round one is drawn tight by its ends alone: made smaller as a whole, it would be
   * drawn into the thing.
   */
  readonly around?: readonly Rod[];
  /**
   * A knot tied in a bight, its rope doubled on itself: each point of the rope is kept beside the point as
   * far from the other end, so that the two strands lie together all the way, as such a knot is dressed.
   * The stretch that is held, where the rope turns back on itself, is left as it is.
   */
  readonly paired?: boolean;
}

/** A straight rigid thing: the two ends of its axis, and its radius. */
export interface Rod {
  readonly from: Point3;
  readonly to: Point3;
  readonly radius: number;
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
/**
 * The tightest bend the rope is held to as it is moved, as so many times the tightest a shape may have;
 * and the spans over which it is held to it, in particles.
 */
const BEND_HELD = 0.66 / 0.53;
const SPANS = [1, 2, 4];
/**
 * What a shape must keep to be taken: how near two strands may come and how tight a bend may be, in
 * diameters. By default the rope is pressed a tenth thinner where it bears on itself, as rope is in a knot
 * drawn hard: a rope that kept all its thickness would leave the knot looser than a real one.
 */
const NEAREST = 0.9;
const SHARPEST = 0.48;
/** How stiff the rope is, and how many times its ends are drawn at most, unless it is said otherwise. */
const STIFFNESS = 0.02;
const DRAWS = 400;
/** How far apart, at most, the two strands of a doubled rope are kept, from middle to middle, in diameters. */
const PAIRED = 1.15;
/** How far, in each pass, the two strands of a doubled rope are brought to one depth: gently, so that the knot still closes. */
const FLAT = 0.03;
/** How far from a stretch that is held the rope moves as freely as elsewhere, in diameters. */
const HELD_REACH = 3;
/** How far each end is drawn at a time, in diameters, to begin with; and below what the knot is taken to give no more. */
const PULL = 0.05;
const LEAST_PULL = 0.004;
/** How much further apart than they may come two strands are moved, in diameters: what a shape has to spare. */
const SPARE = 0.015;

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
  const stiffness = options.stiffness ?? STIFFNESS;
  const nearest = options.nearest ?? NEAREST;
  const sharpest = options.sharpest ?? SHARPEST;
  const held = BEND_HELD * sharpest;
  const rods = options.around ?? [];
  // the rope may be pressed against a thing as it is against itself
  const off = (rod: Rod): number => rod.radius + radius * nearest;
  /** The point of the axis of a rod nearest to a point. */
  const onAxis = (point: Point3, rod: Rod): Particle => {
    const axis = sub(rod.to, rod.from);
    const along = axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2];
    const v = sub(point, rod.from);
    const t = along > 0 ? Math.min(Math.max((v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2]) / along, 0), 1) : 0;
    return mix(rod.from, rod.to, t);
  };

  // nearer than this along the rope, two particles are neighbours and may be as close as they like
  const neighbours = Math.round((0.95 * Math.PI * d) / h);
  const least = SPANS.map((m) => 2 * held * d * Math.sin((m * h) / (held * d)));

  const at = (coordinate: number): Particle => {
    let i = 0;
    while (i < s.length - 2 && (s[i + 1] as number) < coordinate) i++;
    const [a, b] = [s[i] as number, s[i + 1] as number];
    return mix(points[i] as Point3, points[i + 1] as Point3, Math.min(Math.max((coordinate - a) / (b - a || 1), 0), 1));
  };
  let p: Particle[] = Array.from({ length: n + 1 }, (_, k) => at(k * h));

  // while the ends are drawn, the particles of the two ends are held: from the first to `gripped[0]`,
  // and from `gripped[1]` to the last. Otherwise none is.
  let gripped: [number, number] = [-1, n + 1];
  // a stretch that is not drawn tight, and the particle at its middle, from which the rope is laid again
  const hold: [number, number] | null = options.held
    ? [Math.max(Math.round(options.held[0] / h), 1), Math.min(Math.round(options.held[1] / h), n - 1)]
    : null;
  const hook = hold ? Math.round((hold[0] + hold[1]) / 2) : -1;
  // how much of a step a particle takes when the knot is made smaller: none in a stretch that is not drawn
  // tight, and more and more with its distance from one, so that the rope does not bend sharply at its ends
  const moved = (i: number): number => {
    if (hold === null) return 1;
    const away = i < hold[0] ? hold[0] - i : i > hold[1] ? i - hold[1] : 0;
    return Math.min((away * h) / (HELD_REACH * d), 1);
  };
  const free = (i: number): boolean => i > gripped[0] && i < gripped[1];
  // in a doubled rope, each particle and its fellow on the other strand: the one beside it as the knot is
  // tied, for the two strands are not of one length, the one inside each bend being shorter
  const couples: [number, number, number][] = [];
  if (options.paired) {
    const [last, first] = hold ? [hold[0], hold[1]] : [Math.floor(n / 2), Math.ceil(n / 2)];
    // the fellow of the first particle is the nearest on the other strand; each next one's is found a
    // little further back along it, for the other strand runs the other way
    let fellow = -1;
    for (let i = 0; i < last; i++) {
      const [from, to] = fellow < 0 ? [first, n] : [Math.max(first, fellow - 6), fellow];
      let [best, nearestTo] = [Infinity, -1];
      for (let j = from; j <= to; j++) {
        const apartNow = size(sub(p[i] as Particle, p[j] as Particle));
        if (apartNow < best) [best, nearestTo] = [apartNow, j];
      }
      fellow = nearestTo;
      // kept no further apart than they lie as tied, or than strands side by side, whichever is more
      if (best < 1.3 * d) couples.push([i, nearestTo, Math.max(best, PAIRED * d)]);
    }
  }
  const partner = new Int32Array(n + 1).fill(-1);
  for (const [i, j] of couples) [partner[i], partner[j]] = [j, i];

  /** Moves two particles along the line between them until they are a distance apart, or at least that. */
  const apart = (q: Particle[], i: number, j: number, distance: number, exactly: boolean): void => {
    const [a, b] = [q[i] as Particle, q[j] as Particle];
    const delta = sub(b, a);
    const now = size(delta) || 1e-9;
    if (!exactly && now >= distance) return;
    const [wa, wb] = [free(i) ? 1 : 0, free(j) ? 1 : 0];
    if (wa + wb === 0) return;
    const move = (distance - now) / now / (wa + wb);
    for (let c = 0; c < 3; c++) {
      a[c] = (a[c] as number) - (delta[c] as number) * move * wa;
      b[c] = (b[c] as number) + (delta[c] as number) * move * wb;
    }
  };

  /** Moves two particles along the line between them until they are no further apart than a distance. */
  const together = (q: Particle[], i: number, j: number, distance: number): void => {
    const [a, b] = [q[i] as Particle, q[j] as Particle];
    const delta = sub(b, a);
    const now = size(delta) || 1e-9;
    if (now <= distance) return;
    const [wa, wb] = [free(i) ? 1 : 0, free(j) ? 1 : 0];
    if (wa + wb === 0) return;
    const move = (distance - now) / now / (wa + wb);
    for (let c = 0; c < 3; c++) {
      a[c] = (a[c] as number) - (delta[c] as number) * move * wa;
      b[c] = (b[c] as number) + (delta[c] as number) * move * wb;
    }
  };

  /** Moves the particles towards keeping the rules of a rope. */
  const relax = (q: Particle[], sweeps: number): void => {
    // the strands of a doubled rope slide along each other as the knot closes, the outer one round each bend
    // being longer: each particle's fellow is found again, near the one it had
    for (const couple of couples) {
      const [i, was] = couple;
      let [best, nearestTo] = [Infinity, was];
      for (let j = Math.max(was - 4, 0); j <= Math.min(was + 4, n); j++) {
        if (Math.abs(j - i) < neighbours) continue;
        const apartNow = size(sub(q[i] as Particle, q[j] as Particle));
        if (apartNow < best) [best, nearestTo] = [apartNow, j];
      }
      couple[1] = nearestTo;
    }
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
        if (!free(i)) continue;
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
      // and, last of all, it does not pass through itself, nor into what it is tied round
      for (let again = 0; again < 3; again++) for (const [i, j] of pairs) apart(q, i, j, (nearest + SPARE) * d, false);
      // the two strands of a doubled rope lie together, side by side
      for (const [i, j, most] of couples) {
        together(q, i, j, most);
        // and flat, side by side, neither riding on the other: as deep in the drawing as each other
        const [a, b] = [q[i] as Particle, q[j] as Particle];
        const middle = ((a[2] as number) + (b[2] as number)) / 2;
        if (free(i)) a[2] = (a[2] as number) + (middle - (a[2] as number)) * FLAT;
        if (free(j)) b[2] = (b[2] as number) + (middle - (b[2] as number)) * FLAT;
      }
      for (const rod of rods) {
        const clear = off(rod) + SPARE * d;
        for (let i = 0; i <= n; i++) {
          if (!free(i)) continue;
          const point = q[i] as Particle;
          const centre = onAxis(point, rod);
          const away = sub(point, centre);
          const now = size(away);
          if (now >= clear || now < 1e-9) continue;
          for (let c = 0; c < 3; c++) point[c] = (centre[c] as number) + ((away[c] as number) * clear) / now;
        }
      }
    }
  };

  /** The stretch of rope that is the knot: from the first particle that touches another, or a thing, to the last. */
  const knot = (q: Particle[]): [first: number, last: number] => {
    let [first, last] = [n, 0];
    for (let i = 0; i <= n; i++) {
      if (
        rods.some((rod) => size(sub(q[i] as Particle, onAxis(q[i] as Particle, rod))) < 1.08 * (rod.radius + radius))
      ) {
        first = Math.min(first, i);
        last = Math.max(last, i);
      }
      const fellow = partner[i] as number;
      for (let j = i + neighbours; j <= n; j++) {
        // the other strand of a doubled rope, lying beside it, is not a knot
        if (fellow >= 0 && Math.abs(j - fellow) < neighbours) continue;
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
    // from the middle of a stretch that is not drawn tight, where it hangs; or else from the middle of the knot
    const [left, right] = hold ? [hook, hook] : [middle, middle];
    let segment = 0;
    return q.map((point, i) => {
      if (i >= left && i <= right) return point;
      const want = i < left ? (along[left] as number) - (left - i) * h : (along[right] as number) + (i - right) * h;
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
        if (size(sub(q[i] as Particle, q[j] as Particle)) < nearest * d) return false;
      }
      for (const rod of rods)
        if (size(sub(q[i] as Particle, onAxis(q[i] as Particle, rod))) < off(rod) - 1e-6) return false;
    }
    const fine = sampleCurve(
      { type: 'catmull-rom', points: q.map((point, k) => [...point, k * h] as const) },
      false,
    ).points;
    for (let i = 1; i < fine.length - 1; i++) {
      if (bend(fine[i - 1] as Point3, fine[i] as Point3, fine[i + 1] as Point3) < sharpest * d) return false;
    }
    return true;
  };

  const taken: Particle[][] = [];
  const inKnot: number[] = [];
  // a knot tied round a thing is not made smaller as a whole: its ends alone draw it tight
  let shrink = rods.length > 0 ? 0 : SHRINK;
  while (taken.length < MOST_STEPS && shrink > LEAST_SHRINK) {
    const [first, last] = knot(p);
    const centre: Particle = [0, 0, 0];
    let counted = 0;
    for (let i = first; i <= last; i++) {
      if (moved(i) === 0) continue;
      counted++;
      for (let c = 0; c < 3; c++) centre[c] = (centre[c] as number) + (p[i]![c] as number);
    }
    for (let c = 0; c < 3; c++) centre[c] = (centre[c] as number) / (counted || 1);
    const middle = Math.round((first + last) / 2);
    // every particle a little nearer the middle of the knot: the curve has the same shape, and is shorter
    // a stretch that is not drawn tight goes with the knot instead, as its two ends go: whole
    const carried: Particle = [0, 0, 0];
    if (hold) {
      const [a, b] = [p[hold[0]] as Particle, p[hold[1]] as Particle];
      for (let c = 0; c < 3; c++)
        carried[c] = shrink * ((centre[c] as number) - ((a[c] as number) + (b[c] as number)) / 2);
    }
    let q = p.map((point, i): Particle => {
      const own = moved(i);
      const to = mix(centre, point, 1 - shrink * own);
      return [to[0] + (1 - own) * carried[0], to[1] + (1 - own) * carried[1], to[2] + (1 - own) * carried[2]];
    });
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

  // Then the two ends are drawn apart, a little at a time, with the knot between them free to follow: the
  // loops that making it smaller as a whole left open are closed, until the knot gives no more rope.
  const beside = Math.round((1.5 * d) / h);
  let pull = PULL * d;
  let drawn = 0;
  const most = options.draw ?? DRAWS;
  while (drawn < most && pull > LEAST_PULL * d) {
    const [first, last] = knot(p);
    const [a, b] = [Math.max(first - beside, 1), Math.min(last + beside, n - 1)];
    if (b - a < 4) break;
    const middle = Math.round((first + last) / 2);
    const [start, end] = [from(p[0] as Particle, p[3] as Particle), from(p[n] as Particle, p[n - 3] as Particle)];
    let q = p.map((point, i): Particle => {
      const way = i <= a ? start : i >= b ? end : null;
      return way ? [point[0] + way[0] * pull, point[1] + way[1] * pull, point[2] + way[2] * pull] : [...point];
    });
    gripped = [a, b];
    relax(q, 40);
    gripped = [-1, n + 1];
    let tries = 0;
    let kept: boolean;
    do {
      relax(q, 6);
      q = spaced(q, middle);
      kept = sound(q);
    } while (!kept && ++tries < 6);
    if (!kept) {
      pull /= 2;
      continue;
    }
    p = q;
    taken.push(p);
    drawn++;
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
 * does. Only for a document that is one open rope, with or without straight rigid things it is tied round,
 * which stay where they are: for any other, nothing.
 */
export function tighteningFrames(document: KnotDocument, start: Frame, options: TightenOptions = {}): Frame[] {
  const ropes = document.components.filter((component) => component.kind === 'rope');
  const [rope] = ropes;
  if (ropes.length !== 1 || !rope || rope.closed || !rope.length) return [];
  const curves = framePolylines(document, start);
  const curve = curves.find((each) => each.id === rope.id);
  if (!curve) return [];
  const rigid = document.components.filter((component) => component.kind === 'rigid');
  const around = rigid.flatMap((thing): Rod[] => {
    const axis = curves.find((each) => each.id === thing.id);
    const [from, to] = [axis?.points[0], axis?.points.at(-1)];
    return from && to ? [{ from, to, radius: thing.radius ?? 0.5 }] : [];
  });
  // the eye of a knot is not drawn tight with it: something stands in it
  const eye = document.parts?.find((part) => part.component === rope.id && part.type === 'eye');
  const held = options.held ?? (eye ? ([eye.from, eye.to] as const) : undefined);
  const { spacing, shapes } = tighten(curve.points, curve.s, rope.radius ?? 0.5, {
    ...options,
    ...(held ? { held } : {}),
    ...(around.length > 0 ? { around } : {}),
  });
  // what the rope is tied round stays where it is
  const things = Object.fromEntries(
    rigid.flatMap((thing) => (start.curves[thing.id] ? [[thing.id, start.curves[thing.id]]] : [])),
  );
  // a rope that may come nearer to itself than its thickness is pressed thinner by the difference
  const pressed = Math.round((1 - (options.nearest ?? NEAREST)) * 1000) / 1000;
  const frames = shapes.map((shape, k): Frame => ({
    id: k === shapes.length - 1 ? TIGHT_FRAME : `tightening-${k + 1}`,
    ...(pressed > 0.05 ? { pressed } : {}),
    curves: {
      [rope.id]: { type: 'catmull-rom', points: controlPoints(shape, spacing, rope.length as number) },
      ...things,
    },
  }));
  // the tightest says it realises the topology when the frame it started from does, and seen from the front
  // it does: a rope drawn tight round a thing may twist where it turns round it, and show a loop that the
  // knot does not have
  const tightest = frames.at(-1);
  const declared = documentDiagram(document);
  if (tightest && start.realises && declared) {
    const { diagram, issues } = diagramFromGeometry(framePolylines(document, tightest));
    if (issues.length === 0 && identicalDiagrams(declared, diagram)) {
      // written where it always has been, after the id
      const { id, ...rest } = tightest;
      frames[frames.length - 1] = { id, realises: start.realises, ...rest };
    }
  }
  return frames;
}
