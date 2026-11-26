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
  checkFrame,
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
 * How far, in each pass, the bending of the rope is evened out along it: a kink between gentler bends is
 * eased out, and a zigzag finer than the rope goes in one pass.
 */
const FAIRING = 1;
/**
 * Where two strands push each other apart, how much of the push the particle beside each one bears, and
 * the next one the square of it: a rope bears on another along a stretch of it, not at a point.
 */
const SPREAD = 0.7;
/**
 * How far, in each pass, the rope is drawn towards the depth it lies at on the whole, as a knot lies on a
 * table: gently, so that it keeps the face it was tied with and still closes.
 */
const LYING = 0.002;
/**
 * Closing the holes the knot leaves seen from the front: how far the rope round a hole is drawn into it each
 * time, in diameters, to begin with and at least; how many times at most, and after how many without the holes
 * growing smaller it is left; how far from a hole's edge the rope is drawn, in diameters; and below what area,
 * in square diameters, no hole is seen.
 */
const CLOSE = 0.02;
const LEAST_CLOSE = 0.002;
const CLOSINGS = 400;
const NO_CLOSER = 40;
const BORDER = 0.35;
const NO_HOLE = 0.002;
/**
 * The narrowest hole that is seen, in diameters: the circle that fits in it. Narrower, it is no more than the
 * line where two ropes lie against each other.
 */
const NARROWEST = 0.05;
/**
 * How far from the knot the ends of a rope drawn tight run straight, in diameters; and how far from straight,
 * at most, a stretch of an end may be to be taken as one that is drawn straight.
 */
const CLEAR = 2;
const NEARLY = 0.25;
/** The side of the cells in which the front is looked at for holes, in diameters. */
const HOLE_CELL = 0.05;

/** A hole seen from the front: its area and where its middle is. */
export interface Hole {
  readonly area: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The holes a rope leaves seen from the front, from +z: the background it closes round, which is not reached
 * from outside the knot, and in which a circle of a twentieth of a diameter fits. `leaveOut` is a stretch of it,
 * from one material coordinate to another, that is not looked at: an eye, which is meant to be open. Things
 * it is tied round are solid. Areas are in the units of the points, and are what is left of each hole once
 * its edge is drawn in by half the narrowest.
 */
export function holesSeen(
  points: readonly Point3[],
  s: readonly number[],
  radius: number,
  options: { readonly leaveOut?: readonly [number, number]; readonly around?: readonly Rod[] } = {},
): { readonly area: number; readonly holes: readonly Hole[] } {
  const d = 2 * radius;
  const margin = (NARROWEST / 2) * d;
  const skip = options.leaveOut;
  const kept = points.map((_, i) => !(skip && (s[i] as number) > skip[0] && (s[i] as number) < skip[1]));
  // the knot: where the rope comes near itself
  let [low, high] = [Infinity, -Infinity];
  for (let i = 0; i < points.length; i++) {
    if (!kept[i]) continue;
    for (let j = i + 1; j < points.length; j++) {
      if (!kept[j] || (s[j] as number) - (s[i] as number) < 1.6 * d) continue;
      if (size(sub(points[i] as Point3, points[j] as Point3)) < 1.3 * d) {
        [low, high] = [Math.min(low, s[i] as number), Math.max(high, s[j] as number)];
      }
    }
  }
  if (low > high) return { area: 0, holes: [] };
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  points.forEach((point, i) => {
    if (!kept[i] || (s[i] as number) < low - d || (s[i] as number) > high + d) return;
    [x0, x1, y0, y1] = [Math.min(x0, point[0]), Math.max(x1, point[0]), Math.min(y0, point[1]), Math.max(y1, point[1])];
  });
  [x0, x1, y0, y1] = [x0 - 2 * d, x1 + 2 * d, y0 - 2 * d, y1 + 2 * d];
  const cell = HOLE_CELL * d;
  const [w, h] = [Math.ceil((x1 - x0) / cell), Math.ceil((y1 - y0) / cell)];
  const solid = new Uint8Array(w * h);
  // every cell whose middle is within a radius of a piece of the rope, or of a thing, seen from the front
  const paint = (a: Point3, b: Point3, r: number): void => {
    const [left, right] = [
      Math.max(Math.floor((Math.min(a[0], b[0]) - r - x0) / cell), 0),
      Math.min(Math.ceil((Math.max(a[0], b[0]) + r - x0) / cell), w - 1),
    ];
    const [bottom, top] = [
      Math.max(Math.floor((Math.min(a[1], b[1]) - r - y0) / cell), 0),
      Math.min(Math.ceil((Math.max(a[1], b[1]) + r - y0) / cell), h - 1),
    ];
    const [vx, vy] = [b[0] - a[0], b[1] - a[1]];
    const squared = vx * vx + vy * vy || 1e-12;
    for (let gy = bottom; gy <= top; gy++) {
      for (let gx = left; gx <= right; gx++) {
        const [px, py] = [x0 + (gx + 0.5) * cell - a[0], y0 + (gy + 0.5) * cell - a[1]];
        const t = Math.min(Math.max((px * vx + py * vy) / squared, 0), 1);
        if ((px - t * vx) ** 2 + (py - t * vy) ** 2 <= r * r) solid[gy * w + gx] = 1;
      }
    }
  };
  for (let i = 0; i + 1 < points.length; i++) {
    if (kept[i] && kept[i + 1]) paint(points[i] as Point3, points[i + 1] as Point3, radius + margin);
  }
  for (const rod of options.around ?? []) paint(rod.from, rod.to, rod.radius + margin);
  // the background, cell by cell: what is reached from the edge is outside, and what is not is a hole
  const seen = new Uint8Array(w * h);
  const fill = (starts: number[], each: (k: number) => void): void => {
    const stack = starts;
    while (stack.length > 0) {
      const k = stack.pop() as number;
      if (seen[k] || solid[k]) continue;
      seen[k] = 1;
      each(k);
      const x = k % w;
      if (x > 0) stack.push(k - 1);
      if (x < w - 1) stack.push(k + 1);
      if (k >= w) stack.push(k - w);
      if (k < w * (h - 1)) stack.push(k + w);
    }
  };
  const edge: number[] = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
  fill(edge, () => undefined);
  const holes: Hole[] = [];
  for (let k = 0; k < w * h; k++) {
    if (seen[k] || solid[k]) continue;
    let [count, sx, sy] = [0, 0, 0];
    fill([k], (at) => {
      count++;
      sx += x0 + ((at % w) + 0.5) * cell;
      sy += y0 + (Math.floor(at / w) + 0.5) * cell;
    });
    holes.push({ area: count * cell * cell, x: sx / count, y: sy / count });
  }
  return { area: holes.reduce((sum, hole) => sum + hole.area, 0), holes };
}

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
  return drawnTight(points, s, radius, options, true);
}

/**
 * The shapes a line passes through as it is tightened: a rope, whose bends are eased, which bears on itself
 * along a stretch, lies as on a table and is drawn into the holes it leaves; or the middle of two strands
 * side by side, which are laid along it bend by bend, and which is only moved as the particles of a rope are.
 */
function drawnTight(
  points: readonly Point3[],
  s: readonly number[],
  radius: number,
  options: TightenOptions,
  rope: boolean,
): Tightening {
  const [fairing, spread, closings] = rope ? [FAIRING, SPREAD, CLOSINGS] : [0, 0, 0];
  let lying = rope ? LYING : 0;
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
  // once the knot is as small as it goes as a whole, an eye stays where it is, as round what stands in it;
  // its two sides near the knot still go with the knot
  let pinned = false;
  const near = Math.round((HELD_REACH * d) / h);
  const still = (i: number): boolean => hold !== null && i >= hold[0] + near && i <= hold[1] - near;
  const free = (i: number): boolean => i > gripped[0] && i < gripped[1] && !(pinned && still(i));
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

  /**
   * Moves two strands apart along the line between two of their particles until those are at least a
   * distance apart: each particle moves, and the particles beside it with it, less and less.
   */
  const bear = (q: Particle[], i: number, j: number, distance: number): void => {
    const delta = sub(q[j] as Particle, q[i] as Particle);
    const now = size(delta) || 1e-9;
    if (now >= distance) return;
    const [wa, wb] = [free(i) ? 1 : 0, free(j) ? 1 : 0];
    if (wa + wb === 0) return;
    const move = (distance - now) / now / (wa + wb);
    for (const [k, way] of [
      [i, -wa],
      [j, wb],
    ] as const) {
      if (way === 0) continue;
      for (let o = -2; o <= 2; o++) {
        const m = k + o;
        if (m < 0 || m > n || !free(m)) continue;
        const share = o === 0 ? 1 : Math.abs(o) === 1 ? spread : spread * spread;
        if (share === 0) continue;
        const point = q[m] as Particle;
        for (let c = 0; c < 3; c++) point[c] = (point[c] as number) + way * (delta[c] as number) * move * share;
      }
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
    // the knot, which lies as on a table; its two ends are drawn straight
    const [lies, lain] = rods.length === 0 && lying > 0 ? knot(q) : [1, 0];
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
      // its bending changes gently along it: a kink between gentler bends is eased out
      const was = q.map((point): Particle => [...point]);
      for (let i = 2; i <= n - 2 && fairing > 0; i++) {
        if (!free(i)) continue;
        const here = q[i] as Particle;
        for (let c = 0; c < 3; c++) {
          const fourth =
            (was[i - 2]![c] as number) -
            4 * (was[i - 1]![c] as number) +
            6 * (was[i]![c] as number) -
            4 * (was[i + 1]![c] as number) +
            (was[i + 2]![c] as number);
          here[c] = (here[c] as number) - (fairing * fourth) / 16;
        }
      }
      // it lies as on a table, pressed gently towards one depth; round a thing, the thing holds it instead
      if (lies <= lain) {
        let depth = 0;
        for (let i = lies; i <= lain; i++) depth += q[i]![2] as number;
        depth /= lain - lies + 1;
        for (let i = lies; i <= lain; i++) {
          if (free(i)) q[i]![2] = (q[i]![2] as number) + (depth - (q[i]![2] as number)) * lying;
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
      for (let again = 0; again < 3; again++) for (const [i, j] of pairs) bear(q, i, j, (nearest + SPARE) * d);
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

  /**
   * The two ends of a rope drawn tight are straight: the stretch of each that runs nearly straight from where
   * it ends, short of the knot, is laid on the line from there to its end, at the distances along it that its
   * particles keep. Only once the knot is as small as it goes as a whole: before, the rope a loop is made of
   * may still run nearly straight.
   */
  const straightened = (q: Particle[]): Particle[] => {
    if (!rope) return q;
    const [first, last] = knot(q);
    const clear = Math.round((CLEAR * d) / h);
    const out = q.map((point): Particle => [...point]);
    for (const [end, limit, step] of [
      [0, first - clear, 1],
      [n, last + clear, -1],
    ] as const) {
      const tip = q[end] as Particle;
      // how far from its end the rope stays near the line from its end
      let run = end;
      for (let k = end + 2 * step; step > 0 ? k <= limit : k >= limit; k += 2 * step) {
        const line = sub(q[k] as Particle, tip);
        const long = size(line) || 1;
        let near = true;
        for (let i = end + step; i !== k && near; i += step) {
          const v = sub(q[i] as Particle, tip);
          const off = size([
            v[1] * line[2] - v[2] * line[1],
            v[2] * line[0] - v[0] * line[2],
            v[0] * line[1] - v[1] * line[0],
          ]);
          near = off / long <= NEARLY * d;
        }
        if (!near) break;
        run = k;
      }
      if (Math.abs(run - end) < 3) continue;
      const base = q[run] as Particle;
      const way = from(tip, base);
      for (let i = run - step; step > 0 ? i >= end : i <= end; i -= step) {
        const along = Math.abs(i - run) * h;
        out[i] = [base[0] + way[0] * along, base[1] + way[1] * along, base[2] + way[2] * along];
      }
    }
    return out;
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

  pinned = true;
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
      q = straightened(spaced(q, middle));
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

  // Last, while the knot leaves a hole seen from the front, the rope round each hole is drawn into it: a
  // knot pulled hard shows none.
  const leaveOut = hold ? ([hold[0] * h, hold[1] * h] as const) : undefined;
  // a strand drawn into a hole may have to ride over another: the knot is no longer pressed flat
  lying = 0;
  let pace = CLOSE * d;
  let [smallest, since] = [Infinity, 0];
  for (let closed = 0; closed < closings && pace > LEAST_CLOSE * d && since < NO_CLOSER;) {
    // seen on the curve drawn through the particles, as the frame is drawn
    const drawn = sampleCurve({ type: 'catmull-rom', points: p.map((point, k) => [...point, k * h] as const) }, false);
    const seen = holesSeen(drawn.points, drawn.s, radius, { ...(leaveOut ? { leaveOut } : {}), around: rods });
    if (seen.area < NO_HOLE * d * d) break;
    // the rope may be too thick, or the knot too locked, to close them: then it is left as it is
    [smallest, since] = seen.area < smallest - NO_HOLE * d * d ? [seen.area, 0] : [smallest, since + 1];
    const [first, last] = knot(p);
    const middle = Math.round((first + last) / 2);
    let q = p.map((point): Particle => [...point]);
    for (const hole of seen.holes) {
      const reach = Math.sqrt(hole.area / Math.PI) + radius + BORDER * d;
      // only the rope round it moves, and not an eye: it would be drawn shut
      for (let i = 1; i < n; i++) {
        if (still(i)) continue;
        const [x, y] = [hole.x - (p[i]![0] as number), hole.y - (p[i]![1] as number)];
        const away = Math.hypot(x, y);
        if (away > reach || away < 1e-9) continue;
        q[i]![0] = (q[i]![0] as number) + (x / away) * pace;
        q[i]![1] = (q[i]![1] as number) + (y / away) * pace;
      }
    }
    // the rope drawn into a hole presses on what is round it, which takes longer to settle
    let tries = 0;
    let kept: boolean;
    do {
      relax(q, 30);
      q = straightened(spaced(q, middle));
      kept = sound(q);
    } while (!kept && ++tries < 8);
    if (!kept) {
      pace /= 2;
      continue;
    }
    p = q;
    taken.push(p);
    closed++;
  }

  const keep = Math.min(options.keep ?? 6, Math.max(taken.length - 1, 0));
  const shapes: Particle[][] = [];
  for (let k = 1; k <= keep; k++) shapes.push(taken[Math.round((k * taken.length) / (keep + 1)) - 1] as Particle[]);
  if (taken.length > 0) shapes.push(taken[taken.length - 1] as Particle[]);
  return { spacing: h, shapes };
}

/**
 * How a doubled rope is dressed when drawn tight: in a bend as sharp as this or sharper (a curvature, per
 * diameter), each pair is turned this far, in radians, its outer strand back behind the inner; the bend is
 * measured over so many particles either side.
 */
const DRESS_BEND = 0.4;
const DRESS_TURN = 1.5;
const DRESS_SPAN = 6;
/** How many particles of the eye, at either end, are left for the rope to come round from the pair. */
const EYE_EASE = 7;
/**
 * The tightest the middle line of a pair is bent, in its own diameters; and how wide it is taken to be, as a
 * part of the width of the pair side by side: a pair turned in a bend takes a little less.
 */
const PAIR_SHARPEST = 0.52;
const PAIR_WIDTH = 0.9;

/** A polyline at its distances along it, from `from` to `to`, as so many points at equal steps. */
function evenly(line: readonly Point3[], from: number, to: number, count: number): Particle[] {
  const along = [0];
  for (let i = 1; i < line.length; i++)
    along.push((along[i - 1] as number) + size(sub(line[i] as Point3, line[i - 1] as Point3)));
  let segment = 0;
  return Array.from({ length: count + 1 }, (_, k) => {
    const want = from + ((to - from) * k) / count;
    while (segment < line.length - 2 && (along[segment + 1] as number) < want) segment++;
    const [a, b] = [along[segment] as number, along[segment + 1] as number];
    return mix(
      line[segment] as Point3,
      line[segment + 1] as Point3,
      Math.min(Math.max((want - a) / (b - a || 1), 0), 1),
    );
  });
}

/**
 * The shapes a knot tied in a bight passes through as it is drawn tight, dressed. The middle line of its two
 * strands is drawn tight as one rope, as wide as the pair and as thick, and the pair is laid along it again:
 * side by side where it runs straight, and in each bend turned so that its outer strand lies a little behind
 * the inner, as the lobes of a dressed figure-eight loop do, by `turn` of the whole. The eye where the rope
 * turns back goes with the knot as it is; what the knot gives up runs out into the two strands of its legs.
 * Nothing, for a rope whose strands do not lie together from its ends to the eye.
 */
function tightenInBight(
  points: readonly Point3[],
  s: readonly number[],
  radius: number,
  held: readonly [number, number],
  options: TightenOptions,
  turn: number,
): Tightening | null {
  const d = 2 * radius;
  const length = s[s.length - 1] ?? 0;
  const n = Math.max(Math.round(length / ((options.spacing ?? 0.25) * d)), 8);
  const h = length / n;
  const p = evenly(points, 0, length, n);
  const [h0, h1] = [Math.round(held[0] / h), Math.round(held[1] / h)];
  // each particle of the first strand and its fellow on the second, from the ends of the rope to the eye
  const fellows: number[] = [];
  for (let i = 0, fellow = -1; i < h0; i++) {
    const [lo, hi] = fellow < 0 ? [h1, n] : [Math.max(h1, fellow - 6), fellow];
    let [best, nearestTo] = [Infinity, -1];
    for (let j = lo; j <= hi; j++) {
      const apart = size(sub(p[i] as Particle, p[j] as Particle));
      if (apart < best) [best, nearestTo] = [apart, j];
    }
    if (best > 1.3 * d) break;
    fellows.push(nearestTo);
    fellow = nearestTo;
  }
  const m = fellows.length;
  if (m < 8) return null;
  const last = fellows[m - 1] as number;
  const half = fellows.reduce((sum, j, i) => sum + size(sub(p[j] as Particle, p[i] as Particle)), 0) / (2 * m);
  // the middle line of the pair, drawn tight as one round rope as wide as the pair
  const middle = fellows.map((j, i) => mix(p[i] as Particle, p[j] as Particle, 0.5));
  const along = [0];
  for (let i = 1; i < middle.length; i++)
    along.push((along[i - 1] as number) + size(sub(middle[i] as Point3, middle[i - 1] as Point3)));
  // as a rope of its own: nothing held, paired or tied round
  const plain: TightenOptions = {
    ...(options.spacing !== undefined ? { spacing: options.spacing } : {}),
    ...(options.stiffness !== undefined ? { stiffness: options.stiffness } : {}),
    ...(options.keep !== undefined ? { keep: options.keep } : {}),
    ...(options.sharpest !== undefined ? { sharpest: options.sharpest } : {}),
    ...(options.draw !== undefined ? { draw: options.draw } : {}),
  };
  // as wide as two strands side by side, from the middle of the pair; and they are not pressed into each other
  // and bent less tightly than a rope may be, for the strand inside each bend of it bends more tightly still
  const core = drawnTight(
    middle,
    along,
    (half + radius) * PAIR_WIDTH,
    { ...plain, nearest: 1, sharpest: Math.max(plain.sharpest ?? SHARPEST, PAIR_SHARPEST) },
    false,
  );
  if (core.shapes.length === 0) return null;
  // which side of the middle line the first strand lies on, going from the ends to the eye
  const leftOf = (line: readonly Point3[], k: number): Particle => {
    const t = from(line[Math.min(k + 1, line.length - 1)] as Point3, line[Math.max(k - 1, 0)] as Point3);
    const l = Math.hypot(t[0], t[1]) || 1;
    return [-t[1] / l, t[0] / l, 0];
  };
  const firstLeft = leftOf(middle, 0);
  const side = Math.sign(dotOf(sub(p[0] as Particle, middle[0] as Particle), firstLeft)) || 1;
  // the last particle of the middle line that is in the knot, touching another part of it
  const knotEnd = (line: readonly Point3[]): number => {
    const near = Math.round((Math.PI * (half + radius)) / (core.spacing || 1));
    let end = 0;
    for (let i = 0; i < line.length; i++) {
      for (let j = 0; j < i - near; j++) {
        if (size(sub(line[i] as Point3, line[j] as Point3)) < 2.6 * (half + radius)) end = i;
      }
    }
    return end;
  };
  const tied: readonly Point3[] = core.shapes[0] ?? middle;
  // and at least so far that it leaves the last crossing before it comes to the eye
  const toEye = Math.max(tied.length - knotEnd(tied), Math.round((4 * (half + radius)) / (core.spacing || 1)));
  const eye = p.slice(m - 1, last + 1);
  // the way the pair leaves the knot for the eye, as tied
  const outOfEye = level(from(middle[m - 1] as Point3, middle[Math.max(m - 1 - DRESS_SPAN, 0)] as Point3));
  const mouth = mix(p[m - 1] as Particle, p[last] as Particle, 0.5);
  const shapes = core.shapes.map((shape, k) => {
    const amount = (turn * (k + 1)) / core.shapes.length;
    // the pair runs on from the knot to the eye as far as it did as tied: what the knot gives up runs out into
    // the legs, and the eye stays where it is against the knot
    const whole = shape;
    const line = whole.slice(0, Math.min(knotEnd(whole) + toEye, whole.length));
    // how far each pair is turned, and which way: in a bend, its outer strand back, behind the inner; and along
    // the rope, gradually. The middle line is drawn tight as a round rope as wide as the pair, so that the pair,
    // turned any way about it, keeps clear of the others
    const turned = line.map((c, i) => {
      const left = leftOf(line, i);
      const [lo, hi] = [
        line[Math.max(i - DRESS_SPAN, 0)] as Point3,
        line[Math.min(i + DRESS_SPAN, line.length - 1)] as Point3,
      ];
      const bend: Particle = [lo[0] + hi[0] - 2 * c[0], lo[1] + hi[1] - 2 * c[1], 0];
      const span = (Math.min(i + DRESS_SPAN, line.length - 1) - Math.max(i - DRESS_SPAN, 0)) / 2;
      const step = size(sub(hi, lo)) / (2 * span || 1);
      // how sharply the pair bends towards the side of its first strand: the inner strand comes forward, and
      // through a turn from one way to the other, gradually, for the bend passes through nothing
      const towards = (2 * side * dotOf(left, bend)) / ((span * step) ** 2 || 1);
      return DRESS_TURN * Math.min(Math.max(towards / (DRESS_BEND / d), -1), 1) * amount;
    });
    for (let pass = 0; pass < 4; pass++) {
      const was = [...turned];
      for (let i = 0; i < turned.length; i++) {
        let [sum, count] = [0, 0];
        for (let j = Math.max(i - DRESS_SPAN, 0); j <= Math.min(i + DRESS_SPAN, turned.length - 1); j++) {
          sum += was[j] as number;
          count++;
        }
        turned[i] = sum / count;
      }
    }
    const [first, second]: [Particle[], Particle[]] = [[], []];
    line.forEach((c, i) => {
      const left = leftOf(line, i);
      const angle = turned[i] as number;
      const offset: Particle = [
        side * half * Math.cos(angle) * left[0],
        side * half * Math.cos(angle) * left[1],
        half * Math.sin(angle),
      ];
      first.push([c[0] + offset[0], c[1] + offset[1], c[2] + offset[2]]);
      second.push([c[0] - offset[0], c[1] - offset[1], c[2] - offset[2]]);
    });
    // the eye goes with the knot, as the middle of its mouth goes, and turned to lie on along the pair as it
    // leaves the knot; leaving a little of it on either side free, for the rope to come round smoothly
    const end = mix(first[first.length - 1] as Particle, second[second.length - 1] as Particle, 0.5);
    const leaving = level(
      from(line[line.length - 1] as Point3, line[Math.max(line.length - 1 - DRESS_SPAN, 0)] as Point3),
    );
    const turnEye = rotation(outOfEye, leaving);
    const moved = eye.slice(EYE_EASE, -EYE_EASE).map((point): Particle => {
      const [x, y, z] = turnEye(sub(point, mouth));
      return [end[0] + x, end[1] + y, end[2] + z];
    });
    const path: Particle[] = [...first, ...moved, ...second.reverse()];
    // what the knot gives up, or takes, is the two legs', straight on from where they are
    const total = path.slice(1).reduce((sum, point, i) => sum + size(sub(point, path[i] as Particle)), 0);
    const spare = (length - total) / 2;
    const [a, b] = [path[0] as Particle, path[path.length - 1] as Particle];
    const [outA, outB] = [from(a, path[3] as Particle), from(b, path[path.length - 4] as Particle)];
    const reach = Math.max(spare, 0);
    const longer = [
      [a[0] + outA[0] * reach, a[1] + outA[1] * reach, a[2] + outA[2] * reach] as Particle,
      ...path,
      [b[0] + outB[0] * reach, b[1] + outB[1] * reach, b[2] + outB[2] * reach] as Particle,
    ];
    const trim = Math.max(-spare, 0);
    return evenly(longer, trim, total + 2 * reach - trim, n);
  });
  return { spacing: h, shapes };
}

const dotOf = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A direction laid flat in the drawing: the eye is turned only in the plane, and stays level. */
function level(direction: Point3): Point3 {
  const l = Math.hypot(direction[0], direction[1]) || 1;
  return [direction[0] / l, direction[1] / l, 0];
}

/** The rotation that turns one direction into another, about the line square to both. */
function rotation(was: Point3, now: Point3): (point: Point3) => Point3 {
  const axis: Point3 = [
    was[1] * now[2] - was[2] * now[1],
    was[2] * now[0] - was[0] * now[2],
    was[0] * now[1] - was[1] * now[0],
  ];
  const sine = size(axis);
  const cosine = dotOf(was, now);
  if (sine < 1e-9) return (point) => point;
  const k: Point3 = [axis[0] / sine, axis[1] / sine, axis[2] / sine];
  return (v) => {
    const cross: Point3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
    const along = dotOf(k, v) * (1 - cosine);
    return [0, 1, 2].map(
      (c) => (v[c] as number) * cosine + (cross[c] as number) * sine + (k[c] as number) * along,
    ) as unknown as Point3;
  };
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
  // what the rope is tied round stays where it is
  const things = Object.fromEntries(
    rigid.flatMap((thing) => (start.curves[thing.id] ? [[thing.id, start.curves[thing.id]]] : [])),
  );
  // a rope that may come nearer to itself than its thickness is pressed thinner by the difference
  const pressed = Math.round((1 - (options.nearest ?? NEAREST)) * 1000) / 1000;
  const frameOf = (shape: readonly Point3[], spacing: number, id: string): Frame => ({
    id,
    ...(pressed > 0.05 ? { pressed } : {}),
    curves: {
      [rope.id]: { type: 'catmull-rom', points: controlPoints(shape, spacing, rope.length as number) },
      ...things,
    },
  });
  // a knot tied in a bight is drawn tight dressed, as far as every frame on the way keeps the rules
  let dressed: Tightening | null = null;
  if (options.paired && held) {
    for (const turn of [1, 0.75, 0.5, 0.25, 0]) {
      const made = tightenInBight(curve.points, curve.s, rope.radius ?? 0.5, held, options, turn);
      if (!made) break;
      const frames = made.shapes.map((shape, k) => frameOf(shape, made.spacing, `tightening-${k + 1}`));
      const all = { ...document, geometry: { frames: [start, ...frames] } };
      if (frames.every((frame) => checkFrame(all, frame).every((issue) => issue.level !== 'error'))) {
        dressed = made;
        break;
      }
    }
  }
  const { spacing, shapes } =
    dressed ??
    tighten(curve.points, curve.s, rope.radius ?? 0.5, {
      ...options,
      ...(held ? { held } : {}),
      ...(around.length > 0 ? { around } : {}),
    });
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
