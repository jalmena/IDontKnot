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
  /**
   * Which ends draw the knot tight: both; or its start alone, the standing part, as a timber hitch is drawn
   * tight by the load on it while its end, twisted round its own turn, is held by nothing but the knot. Either
   * way, what the knot gives up runs out into both its ends.
   */
  readonly drawnBy?: 'both' | 'start';
  /**
   * Stretches of the rope that stay where they are while the knot is drawn tight, from one material coordinate
   * to another, as the turns of a tie round a column stay loose: only its knot is drawn tight. What the knot
   * gives up runs out into the ends of the rope on either side of them. For a knot tied in a bight, measured
   * along its first strand.
   */
  readonly still?: readonly (readonly [from: number, to: number])[];
  /** For a knot tied in a bight: whether, once tight, its pair is turned in its bends, as a dressed figure-eight loop is. */
  readonly dressed?: boolean;
  /**
   * The ways the two ends are drawn, where they are not drawn straight on from where they leave the knot: each end
   * swings round that way as it is drawn. For a knot tied in a bight, its start is both ends of the rope, and its
   * end the bight.
   */
  readonly towards?: { readonly start?: Point3; readonly end?: Point3 };
  /** How many times at most, last, the rope round each hole the knot leaves, seen from the front, is drawn into it. */
  readonly closings?: number;
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
/** How much tighter than its thickness, as it is pressed, a strand of a pair may bend: a little less than a frame lets it. */
const PRESSED_BEND = 0.02;
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
/**
 * How near two stretches of the rope may come, in diameters, going straight from one shape kept to the next,
 * before a shape between them is kept too; and how many shapes are kept at most.
 */
const THROUGH = 0.5;
const MOST_KEPT = 24;
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
  const { spacing, shapes } = drawnTight(points, s, radius, options, 0);
  return { spacing, shapes };
}

/**
 * The shapes a line passes through as it is tightened: a rope, whose bends are eased, which bears on itself
 * along a stretch, lies as on a table and is drawn into the holes it leaves. Or, `ribbon` being more than
 * nothing, the middle of two strands of that rope side by side, flat, that far on either side of it: the
 * strands bear on the strands of the other stretches of the pair, and it is as wide as the two of them.
 */
function drawnTight(
  points: readonly Point3[],
  s: readonly number[],
  radius: number,
  options: TightenOptions,
  ribbon: number,
): Tightening & { readonly turns: readonly number[]; readonly sides: readonly (readonly Point3[])[] } {
  const [fairing, spread, closings] = [FAIRING, SPREAD, options.closings ?? CLOSINGS];
  let lying = LYING;
  const d = 2 * radius;
  // how wide the line is, across: the rope, or the pair side by side; its bends are measured against it
  const wide = d + 2 * ribbon;
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
  const neighbours = Math.round((0.95 * Math.PI * wide) / h);
  const least = SPANS.map((m) => 2 * held * wide * Math.sin((m * h) / (held * wide)));
  // for a pair, the way from its middle to the strand on its left at each particle, as the line last lay; and
  // how far the pair is turned in its bends, as a part of the whole: not at all until the knot is tight
  let sides: readonly Point3[] = [];
  let dress = 0;
  const faces = facing(rods, d);
  const lay = (q: Particle[]): void => {
    if (ribbon > 0) sides = pairSides(q, d, h, dress, faces, sides);
  };
  /**
   * The way from one particle of the line to another where they are nearest: from the one to the other for a
   * rope, and for a pair from a strand of the one to the nearest strand of the other.
   */
  const between = (q: Particle[], i: number, j: number): Particle => {
    const delta = sub(q[j] as Particle, q[i] as Particle);
    // further apart than the pair is wide, no strand of the one comes nearer the other than a diameter
    if (ribbon === 0 || dotOf(delta, delta) > wide * wide) return delta;
    const [a, b] = [sides[i] as Point3, sides[j] as Point3];
    let [best, nearestWay] = [Infinity, delta];
    for (const u of [-ribbon, ribbon]) {
      for (const v of [-ribbon, ribbon]) {
        const way: Particle = [
          delta[0] + v * b[0] - u * a[0],
          delta[1] + v * b[1] - u * a[1],
          delta[2] + v * b[2] - u * a[2],
        ];
        const squared = dotOf(way, way);
        if (squared < best) [best, nearestWay] = [squared, way];
      }
    }
    return nearestWay;
  };
  /** Whether two particles of the line, or their strands, are nearer than a distance. */
  const nearer = (q: Particle[], i: number, j: number, distance: number): boolean => {
    const [a, b] = [q[i] as Particle, q[j] as Particle];
    const reach = distance + 2 * ribbon;
    const squared = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (squared >= reach * reach) return false;
    return ribbon === 0 ? squared < distance * distance : size(between(q, i, j)) < distance;
  };

  const at = (coordinate: number): Particle => {
    let i = 0;
    while (i < s.length - 2 && (s[i + 1] as number) < coordinate) i++;
    const [a, b] = [s[i] as number, s[i + 1] as number];
    return mix(points[i] as Point3, points[i + 1] as Point3, Math.min(Math.max((coordinate - a) / (b - a || 1), 0), 1));
  };
  let p: Particle[] = Array.from({ length: n + 1 }, (_, k) => at(k * h));
  const initial = p;

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
  // stretches that do not move at all, as turns round a thing that only the knot after them is drawn against
  const quiet = (options.still ?? []).map(([a, b]) => [Math.round(a / h), Math.round(b / h)] as const);
  const stays = (i: number): boolean => quiet.some(([a, b]) => i >= a && i <= b);
  const free = (i: number): boolean => i > gripped[0] && i < gripped[1] && !(pinned && still(i)) && !stays(i);
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
    const delta = between(q, i, j);
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
    const reach = (wide + 0.2) ** 2;
    for (let i = 0; i <= n; i++) {
      const a = q[i] as Particle;
      for (let j = i + neighbours; j <= n; j++) {
        const b = q[j] as Particle;
        if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 < reach) pairs.push([i, j]);
      }
    }
    for (let k = 0; k < sweeps; k++) {
      lay(q);
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
    lay(q);
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
        if (nearer(q, i, j, 1.08 * d)) {
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
    // from the middle of a stretch that is not drawn tight, where it hangs; or else from the middle of the knot:
    // what the knot gives up goes to both its ends, even where only its start draws it
    // or from the stretches that do not move: what the knot gives up goes to the ends beyond them
    const [left, right] =
      quiet.length > 0
        ? [Math.min(...quiet.map(([a]) => a)), Math.max(...quiet.map(([, b]) => b))]
        : hold
          ? [hook, hook]
          : [middle, middle];
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
    const [first, last] = knot(q);
    const clear = Math.round((CLEAR * wide) / h);
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
    lay(q);
    for (let i = 0; i <= n; i++) {
      for (let j = i + neighbours; j <= n; j++) {
        if (nearer(q, i, j, nearest * d)) return false;
      }
      for (const rod of rods)
        if (size(sub(q[i] as Particle, onAxis(q[i] as Particle, rod))) < off(rod) - 1e-6) return false;
    }
    const fine = sampleCurve(
      { type: 'catmull-rom', points: q.map((point, k) => [...point, k * h] as const) },
      false,
    ).points;
    for (let i = 1; i < fine.length - 1; i++) {
      if (bend(fine[i - 1] as Point3, fine[i] as Point3, fine[i + 1] as Point3) < sharpest * wide) return false;
    }
    // and each strand of a pair, as it is laid along it, turned as it goes round what it lies on, bends no
    // tighter than the rope may, as it is pressed where it bears on itself
    if (ribbon > 0 && rods.length > 0) {
      for (const strand of strandsOf(q, h, d, ribbon, dress, faces, sides)) {
        const [drawn] = drawnOf(strand, h);
        for (let i = 1; i < drawn.length - 1; i++) {
          if (
            bend(drawn[i - 1] as Point3, drawn[i] as Point3, drawn[i + 1] as Point3) <
            radius * (nearest - PRESSED_BEND)
          )
            return false;
        }
      }
    }
    return true;
  };

  const taken: Particle[][] = [];
  // and, for a pair, the way to its strand on the left in each, as it lay
  const laid: (readonly Point3[])[] = [];
  const turns: number[] = [];
  const inKnot: number[] = [];
  // a knot tied round a thing is not made smaller as a whole: its ends alone draw it tight
  let shrink = rods.length > 0 ? 0 : SHRINK;
  while (taken.length < MOST_STEPS && shrink > LEAST_SHRINK) {
    const [first, last] = knot(p);
    const centre: Particle = [0, 0, 0];
    let counted = 0;
    for (let i = first; i <= last; i++) {
      if (moved(i) === 0 || stays(i)) continue;
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
      if (stays(i)) return [...point];
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
    laid.push(sides);
    turns.push(dress);
    inKnot.push((last - first) * h);
    // the knot gives up no more rope
    if (inKnot.length > 80 && (inKnot[inKnot.length - 81] as number) - (inKnot[inKnot.length - 1] as number) < 0.02 * d)
      break;
  }

  pinned = true;
  // Then the two ends are drawn apart, a little at a time, with the knot between them free to follow: the
  // loops that making it smaller as a whole left open are closed, until the knot gives no more rope.
  const beside = Math.round((1.5 * wide) / h);
  let pull = PULL * d;
  let drawn = 0;
  const most = options.draw ?? DRAWS;
  while (drawn < most && pull > LEAST_PULL * d) {
    const [first, last] = knot(p);
    const [a, b] = [Math.max(first - beside, 1), Math.min(last + beside, n - 1)];
    if (b - a < 4) break;
    const middle = Math.round((first + last) / 2);
    const [start, end] = [
      options.towards?.start ? from(options.towards.start, [0, 0, 0]) : from(p[0] as Particle, p[3] as Particle),
      options.towards?.end ? from(options.towards.end, [0, 0, 0]) : from(p[n] as Particle, p[n - 3] as Particle),
    ];
    let q = p.map((point, i): Particle => {
      const way = i <= a ? start : i >= b && options.drawnBy !== 'start' ? end : null;
      return way ? [point[0] + way[0] * pull, point[1] + way[1] * pull, point[2] + way[2] * pull] : [...point];
    });
    // the end, if it does not draw, is left free
    gripped = [a, options.drawnBy === 'start' ? n + 1 : b];
    relax(q, quiet.length > 0 ? 10 : 40);
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
    laid.push(sides);
    turns.push(dress);
    drawn++;
  }

  // Last, while the knot leaves a hole seen from the front, the rope round each hole is drawn into it: a
  // knot pulled hard shows none.
  const leaveOut = hold ? ([hold[0] * h, hold[1] * h] as const) : undefined;
  // a strand drawn into a hole may have to ride over another: the knot is no longer pressed flat
  lying = 0;
  const closeHoles = (): void => {
    let pace = CLOSE * d;
    let [smallest, since] = [Infinity, 0];
    for (let closed = 0; closed < closings && pace > LEAST_CLOSE * d && since < NO_CLOSER;) {
      // seen on the curve drawn through the particles, as the frame is drawn
      const seen =
        ribbon > 0
          ? holesOfPair(p, h, d, ribbon, dress, faces, rods, sides)
          : holesSeen(...drawnOf(p, h), radius, { ...(leaveOut ? { leaveOut } : {}), around: rods });
      if (seen.area < NO_HOLE * d * d) break;
      // the rope may be too thick, or the knot too locked, to close them: then it is left as it is
      [smallest, since] = seen.area < smallest - NO_HOLE * d * d ? [seen.area, 0] : [smallest, since + 1];
      const [first, last] = knot(p);
      const middle = Math.round((first + last) / 2);
      let q = p.map((point): Particle => [...point]);
      for (const hole of seen.holes) {
        const reach = Math.sqrt(hole.area / Math.PI) + radius + ribbon + BORDER * d;
        // only the rope round it moves, and not an eye: it would be drawn shut
        for (let i = 1; i < n; i++) {
          if (still(i) || stays(i)) continue;
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
      laid.push(sides);
      turns.push(dress);
      closed++;
    }
  };
  closeHoles();

  // A pair, last, is dressed: in each of its bends its outer strand is turned back behind the inner, a little
  // at a time, the knot settling round it; and the holes that leaves are closed again
  if (ribbon > 0 && options.dressed !== false) {
    for (let step = 1; step <= DRESSINGS; step++) {
      const was = dress;
      dress = step / DRESSINGS;
      const [first, last] = knot(p);
      const middle = Math.round((first + last) / 2);
      let q = p.map((point): Particle => [...point]);
      let tries = 0;
      let kept: boolean;
      do {
        relax(q, 30);
        q = straightened(spaced(q, middle));
        kept = sound(q);
      } while (!kept && ++tries < 8);
      if (!kept) {
        dress = was;
        break;
      }
      p = q;
      taken.push(p);
      laid.push(sides);
      turns.push(dress);
    }
    closeHoles();
  }

  // the shapes kept are told apart by how far the rope moves, the strands of a pair as they lay
  const firstLaid = ribbon > 0 ? pairSides(initial, d, h, 0, faces, laid[0]) : [];
  const seen = (q: readonly Point3[], way: readonly Point3[]): readonly Point3[] =>
    ribbon > 0
      ? [-1, 1].flatMap((sign) =>
          q.map((c, i): Point3 => {
            const side = way[i] as Point3;
            return [c[0] + sign * ribbon * side[0], c[1] + sign * ribbon * side[1], c[2] + sign * ribbon * side[2]];
          }),
        )
      : q;
  const kept = evenlyKept(
    seen(initial, firstLaid),
    taken.map((shape, k) => seen(shape, laid[k] as Point3[])),
    options.keep ?? 11,
    d,
  );
  return {
    spacing: h,
    shapes: kept.map((k) => taken[k] as Particle[]),
    turns: kept.map((k) => turns[k] as number),
    sides: kept.map((k) => laid[k] as Point3[]),
  };
}

/**
 * Of the shapes a knot passes through, so many on the way and the last, as far apart as each other in how
 * much the knot changes, so that played one after another at an even pace the knot is drawn tight in one
 * even pull: how far each point moves across the rope, for sliding along it changes nothing that is seen.
 * And more where stretches of the rope go round each other.
 */
function evenlyKept(
  initial: readonly Point3[],
  taken: readonly (readonly Point3[])[],
  most: number,
  d: number,
): number[] {
  // how far the points of a shape have moved across the rope since another, in all
  const across = (shape: readonly Point3[], was: readonly Point3[]): number => {
    const n = shape.length - 1;
    let all = 0;
    for (let i = 0; i <= n; i++) {
      const tangent = from(shape[Math.min(i + 1, n)] as Point3, shape[Math.max(i - 1, 0)] as Point3);
      const moved = sub(shape[i] as Point3, was[i] as Point3);
      const along = dotOf(moved, tangent);
      const off = size([moved[0] - tangent[0] * along, moved[1] - tangent[1] * along, moved[2] - tangent[2] * along]);
      all += off;
    }
    return all;
  };
  const changed = [0];
  let was = initial;
  for (const shape of taken) {
    changed.push((changed.at(-1) as number) + across(shape, was));
    was = shape;
  }
  if (taken.length === 0) return [];
  const total = changed.at(-1) as number;
  const keep = Math.min(most, Math.max(taken.length - 1, 0));
  // the shapes kept, by their place among those taken, the last always
  const kept: number[] = [];
  let next = 1;
  for (let k = 1; k <= keep; k++) {
    while (next < taken.length && (changed[next] as number) < (total * k) / (keep + 1)) next++;
    if (next - 1 !== kept.at(-1)) kept.push(next - 1);
  }
  if (kept.at(-1) !== taken.length - 1) kept.push(taken.length - 1);
  // where going straight from one shape kept to the next would carry the rope through itself, as when one
  // stretch goes round another, the shape halfway between is kept too, until none would, or there is none
  // left between
  const throughItself = (was: readonly Point3[], now: readonly Point3[]): boolean => {
    const n = now.length;
    const step = size(sub(now[1] as Point3, now[0] as Point3)) || d;
    const neighbours = Math.ceil((Math.PI * d) / step);
    const least = (THROUGH * d) ** 2;
    for (const t of [0.25, 0.5, 0.75]) {
      const between = now.map((point, i) => mix(was[i] as Point3, point, t));
      for (let i = 0; i < n; i += 2) {
        for (let j = i + neighbours; j < n; j += 2) {
          const way = sub(between[j] as Point3, between[i] as Point3);
          if (dotOf(way, way) < least) return true;
        }
      }
    }
    return false;
  };
  for (let k = 0; k < kept.length && kept.length < MOST_KEPT; k++) {
    const before = k === 0 ? -1 : (kept[k - 1] as number);
    const here = kept[k] as number;
    if (here - before < 2) continue;
    if (!throughItself(before < 0 ? initial : (taken[before] as readonly Point3[]), taken[here] as readonly Point3[]))
      continue;
    const halfway = ((changed[before + 1] as number) + (changed[here + 1] as number)) / 2;
    let middle = before + 1;
    while (middle < here - 1 && (changed[middle + 1] as number) < halfway) middle++;
    kept.splice(k, 0, middle);
    k--;
  }
  return kept;
}

/**
 * How a doubled rope is dressed: where the pair bends, it is turned about its middle, its outer strand back
 * behind the inner, as the lobes of a dressed figure-eight loop are. The bend is measured, and the turn eased
 * along the rope, over `DRESS_REACH` diameters either side: so measured, the pair is not turned where it bends
 * round a circle of `DRESS_LOOSE` diameters or wider, and is turned `DRESS_TURN` radians where it bends round
 * one of `DRESS_TIGHT` or less.
 */
const DRESS_LOOSE = 4;
const DRESS_TIGHT = 2.2;
const DRESS_TURN = 1.4;
const DRESS_REACH = 2.9;
/** In how many steps a pair is dressed, once the knot is tight. */
const DRESSINGS = 8;

/**
 * The way from the middle of a pair to the strand on its left, at each particle of its middle line: square to
 * the line, and where the pair bends, turned so that the strand outside the bend lies behind the one inside.
 */
function pairSides(
  line: readonly Point3[],
  d: number,
  h: number,
  turn: number,
  faces: (point: Point3) => Point3 = () => TOWARDS_THE_EYE,
  was?: readonly Point3[],
): Point3[] {
  const n = line.length - 1;
  const span = Math.max(Math.round((DRESS_REACH * d) / h), 1);
  // square to the line, in the face of what it lies on: the drawing, or the side of a thing it is tied round, that
  // face turned gently along the line, as the pair turns from lying on the one to lying on the other
  let normals: Point3[] = line.map((point) => faces(point));
  if (normals.some((out) => out !== TOWARDS_THE_EYE)) {
    const reach = Math.max(Math.round((FACE_EASE * d) / h), 1);
    for (let pass = 0; pass < 2; pass++) {
      const sums: Point3[] = [[0, 0, 0]];
      for (const out of normals) {
        const last = sums[sums.length - 1] as Point3;
        sums.push([last[0] + out[0], last[1] + out[1], last[2] + out[2]]);
      }
      normals = normals.map((_, i) => {
        const [lo, hi] = [sums[Math.max(i - reach, 0)] as Point3, sums[Math.min(i + reach, n) + 1] as Point3];
        const way: Point3 = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
        const l = size(way) || 1;
        return [way[0] / l, way[1] / l, way[2] / l];
      });
    }
  }
  const ways = line.map((_, i) => sub(line[Math.min(i + 1, n)] as Point3, line[Math.max(i - 1, 0)] as Point3));
  const lefts = ways.map((along, i): Particle => {
    const out = normals[i] as Point3;
    const left: Particle = [
      out[1] * along[2] - out[2] * along[1],
      out[2] * along[0] - out[0] * along[2],
      out[0] * along[1] - out[1] * along[0],
    ];
    const l = Math.hypot(left[0], left[1], left[2]) || 1;
    return [left[0] / l, left[1] / l, left[2] / l];
  });
  // but where the line runs steeply out of that face, as where it wraps round a strand, that side is no side: there,
  // and a little either side, the side it has before is carried on square to the line, and turned gently into the
  // side it has after, carried back
  const unsure = ways.map((along, i) => {
    const out = normals[i] as Point3;
    const across = dotOf(along, out);
    return Math.sqrt(Math.max(dotOf(along, along) - across * across, 0)) < IN_THE_FACE * (size(along) || 1);
  });
  const margin = Math.max(Math.round(d / h), 1);
  const near = unsure.map((_, i) => unsure.slice(Math.max(i - margin, 0), i + margin + 1).some(Boolean));
  const carried = (start: Point3, run: readonly number[]): Particle[] => {
    let side: Particle = [...start];
    return run.map((k) => {
      const t = from(line[Math.min(k + 1, n)] as Point3, line[Math.max(k - 1, 0)] as Point3);
      const on = dotOf(side, t);
      const square: Particle = [side[0] - on * t[0], side[1] - on * t[1], side[2] - on * t[2]];
      const l = size(square);
      if (l > 1e-9) side = [square[0] / l, square[1] / l, square[2] / l];
      return side;
    });
  };
  for (let i = 0; i <= n;) {
    if (!near[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && near[j + 1]) j++;
    // from the last sure particle before the stretch to the first after it, where there are
    const [a, b] = [Math.max(i - 1, 0), Math.min(j + 1, n)];
    const run = Array.from({ length: b - a + 1 }, (_, k) => a + k);
    const forth = carried(lefts[a] as Point3, run);
    let back = carried(lefts[b] as Point3, [...run].reverse()).reverse();
    if (dotOf(forth[run.length - 1] as Point3, back[run.length - 1] as Point3) < 0)
      back = back.map((side): Particle => [-side[0], -side[1], -side[2]]);
    run.forEach((k, m) => {
      const x = i === 0 ? 1 : j === n ? 0 : m / (run.length - 1 || 1);
      const u = x * x * (3 - 2 * x);
      const [f, g] = [forth[m] as Particle, back[m] as Particle];
      const way: Particle = [f[0] * (1 - u) + g[0] * u, f[1] * (1 - u) + g[1] * u, f[2] * (1 - u) + g[2] * u];
      const l = size(way);
      if (l > 1e-9) lefts[k] = [way[0] / l, way[1] / l, way[2] / l];
    });
    i = j + 1;
  }
  // and never turned over from one particle to the next; nor, where the pair lay before, from how it lay
  if (was?.length === lefts.length) {
    lefts.forEach((left, i) => {
      if (dotOf(left, was[i] as Point3) < 0) lefts[i] = [-left[0], -left[1], -left[2]];
    });
  } else {
    for (let i = 1; i <= n; i++) {
      const [left, before] = [lefts[i] as Particle, lefts[i - 1] as Particle];
      if (dotOf(left, before) < 0) lefts[i] = [-left[0], -left[1], -left[2]];
    }
  }
  let turned = line.map((c, i) => {
    const [lo, hi] = [Math.max(i - span, 0), Math.min(i + span, n)];
    const [a, b] = [line[lo] as Point3, line[hi] as Point3];
    const left = lefts[i] as Particle;
    // how sharply it bends towards its left: one over the radius of the circle through the three points
    const reach = ((hi - lo) / 2) * h;
    const towards =
      (2 *
        (left[0] * (a[0] + b[0] - 2 * c[0]) +
          left[1] * (a[1] + b[1] - 2 * c[1]) +
          left[2] * (a[2] + b[2] - 2 * c[2]))) /
      (reach * reach || 1);
    const amount = (Math.abs(towards) * d - 1 / DRESS_LOOSE) / (1 / DRESS_TIGHT - 1 / DRESS_LOOSE);
    return Math.sign(towards) * DRESS_TURN * turn * Math.min(Math.max(amount, 0), 1);
  });
  // eased along the rope, four times over
  for (let pass = 0; pass < 4; pass++) {
    const sums = [0];
    for (const angle of turned) sums.push((sums.at(-1) as number) + angle);
    turned = turned.map((_, i) => {
      const [lo, hi] = [Math.max(i - span, 0), Math.min(i + span, n)];
      return ((sums[hi + 1] as number) - (sums[lo] as number)) / (hi - lo + 1);
    });
  }
  return lefts.map((left, i) => {
    const angle = turned[i] as number;
    const out = normals[i] as Point3;
    return [
      Math.cos(angle) * left[0] + Math.sin(angle) * out[0],
      Math.cos(angle) * left[1] + Math.sin(angle) * out[1],
      Math.cos(angle) * left[2] + Math.sin(angle) * out[2],
    ];
  });
}

const TOWARDS_THE_EYE: Point3 = [0, 0, 1];
/**
 * How far a pair's middle line must run in the face it lies on, as the part of its way that does, for its side to be
 * square to it in that face; below it, its side is carried on from where it was, as where it wraps round a strand.
 */
const IN_THE_FACE = 0.45;

/** Up to how far from the side of a thing a pair lies wholly on it, and from how far it lies in the drawing, in diameters. */
const ON_THE_THING = 1;
const OFF_THE_THING = 2;
/** Along how much of a pair, either way, in diameters, the face it lies on is eased. */
const FACE_EASE = 2;

/**
 * What a pair lies on, as the way out of it, at a point: the side of a straight thing it is tied round, where it is
 * near it, and the drawing, towards the eye, where it is far from it; and in between, turned gently from the one to
 * the other.
 */
function facing(rods: readonly Rod[], d: number): (point: Point3) => Point3 {
  if (rods.length === 0) return () => TOWARDS_THE_EYE;
  return (point) => {
    let [nearest, out]: [number, Point3] = [Infinity, TOWARDS_THE_EYE];
    for (const rod of rods) {
      const axis = sub(rod.to, rod.from);
      const t = Math.min(Math.max(dotOf(sub(point, rod.from), axis) / (dotOf(axis, axis) || 1), 0), 1);
      const away = sub(point, mix(rod.from, rod.to, t));
      const far = size(away);
      if (far > 1e-9 && far - rod.radius < nearest)
        [nearest, out] = [far - rod.radius, [away[0] / far, away[1] / far, away[2] / far]];
    }
    const x = Math.min(Math.max((OFF_THE_THING * d - nearest) / ((OFF_THE_THING - ON_THE_THING) * d), 0), 1);
    const on = x * x * (3 - 2 * x);
    if (on === 0) return TOWARDS_THE_EYE;
    const way: Point3 = [on * out[0], on * out[1], on * out[2] + (1 - on)];
    const l = size(way);
    // behind the thing, half way out, the two cancel: there it lies on the thing
    return l < 0.3 ? out : [way[0] / l, way[1] / l, way[2] / l];
  };
}

/** The curve drawn through the particles of a shape, as a frame is drawn: its points, and how far along it each is. */
function drawnOf(q: readonly Point3[], h: number): [readonly Point3[], readonly number[]] {
  const drawn = sampleCurve({ type: 'catmull-rom', points: q.map((point, k) => [...point, k * h] as const) }, false);
  return [drawn.points, drawn.s];
}

/** The two strands of a pair, `ribbon` either side of its middle line through the particles, turned by `turn`. */
function strandsOf(
  q: readonly Point3[],
  h: number,
  d: number,
  ribbon: number,
  turn: number,
  faces?: (point: Point3) => Point3,
  was?: readonly Point3[],
): [Particle[], Particle[]] {
  const sides = pairSides(q, d, h, turn, faces, was);
  const strand = (way: number): Particle[] =>
    q.map((c, i) => {
      const side = sides[i] as Point3;
      return [c[0] + way * ribbon * side[0], c[1] + way * ribbon * side[1], c[2] + way * ribbon * side[2]];
    });
  return [strand(1), strand(-1)];
}

/**
 * The holes a pair of strands leaves seen from the front: its two strands are looked at as one rope that goes
 * along the one, across, and back along the other.
 */
function holesOfPair(
  q: readonly Point3[],
  h: number,
  d: number,
  ribbon: number,
  turn: number,
  faces?: (point: Point3) => Point3,
  around: readonly Rod[] = [],
  was?: readonly Point3[],
): ReturnType<typeof holesSeen> {
  const [one, other] = strandsOf(q, h, d, ribbon, turn, faces, was);
  const [[a, as], [b, bs]] = [drawnOf(one, h), drawnOf(other, h)];
  const [far, back] = [(as.at(-1) as number) + d, bs.at(-1) as number];
  return holesSeen([...a, ...[...b].reverse()], [...as, ...[...bs].reverse().map((v) => far + back - v)], d / 2, {
    around,
  });
}

/** How far either side of a stretch of rope the way it goes is measured, in particles. */
const SPAN = 6;
/** How many particles of the eye, at either end, are left for the rope to come round from the pair. */
const EYE_EASE = 7;

/** How many points of a path either side of where the tip of a bight meets its pair are eased, and how often. */
const TIP_EASE = 8;
const TIP_EASINGS = 24;

/** A path eased round one of its points: those near it each drawn, again and again, towards their neighbours. */
function eased(path: Particle[], at: number, reach: number): void {
  const [lo, hi] = [Math.max(at - reach, 1), Math.min(at + reach, path.length - 2)];
  for (let pass = 0; pass < TIP_EASINGS; pass++) {
    const was = path.map((point): Particle => [...point]);
    for (let i = lo; i <= hi; i++) {
      const [a, here, b] = [was[i - 1] as Particle, path[i] as Particle, was[i + 1] as Particle];
      // the further from the meeting, the less
      const weight = 0.5 * (1 - Math.abs(i - at) / (reach + 1));
      for (let c = 0; c < 3; c++)
        here[c] = (here[c] as number) + weight * (((a[c] as number) + (b[c] as number)) / 2 - (here[c] as number));
    }
  }
}

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
 * strands is drawn tight as a pair of strands side by side, and the pair is laid along it again, side by side
 * where it runs straight and in each bend turned, its outer strand behind the inner, as it was drawn tight.
 * The eye where the rope turns back goes with the knot as it is; what the knot gives up runs out into the two
 * strands of its legs. Nothing, for a rope whose strands do not lie together from its ends to the eye.
 */
function tightenInBight(
  points: readonly Point3[],
  s: readonly number[],
  radius: number,
  held: readonly [number, number],
  options: TightenOptions,
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
  // drawn tight, the two strands lie against each other
  const half = Math.min(
    fellows.reduce((sum, j, i) => sum + size(sub(p[j] as Particle, p[i] as Particle)), 0) / (2 * m),
    radius,
  );
  const middle = fellows.map((j, i) => mix(p[i] as Particle, p[j] as Particle, 0.5));
  const along = [0];
  for (let i = 1; i < middle.length; i++)
    along.push((along[i - 1] as number) + size(sub(middle[i] as Point3, middle[i - 1] as Point3)));
  // as a rope of its own: nothing held or paired; tied round what the rope is tied round, and still where its
  // first strand is, measured along the middle line
  const rods = options.around ?? [];
  const faces = facing(rods, d);
  const onMiddle = (coordinate: number): number =>
    along[Math.min(Math.max(Math.round(coordinate / h), 0), m - 1)] as number;
  const plain: TightenOptions = {
    ...(options.spacing !== undefined ? { spacing: options.spacing } : {}),
    ...(options.stiffness !== undefined ? { stiffness: options.stiffness } : {}),
    ...(options.nearest !== undefined ? { nearest: options.nearest } : {}),
    ...(options.draw !== undefined ? { draw: options.draw } : {}),
    ...(options.dressed !== undefined ? { dressed: options.dressed } : {}),
    ...(options.towards ? { towards: options.towards } : {}),
    ...(options.closings !== undefined ? { closings: options.closings } : {}),
    ...(rods.length > 0 ? { around: rods } : {}),
    ...(options.still ? { still: options.still.map(([a, b]) => [onMiddle(a), onMiddle(b)] as const) } : {}),
  };
  // as a flat pair of strands side by side: each strand bears on the strands of the rest of the knot, and the
  // strand inside a bend of the pair may bend as tightly as the rope may
  const sharpest = ((options.sharpest ?? SHARPEST) * d + half) / (d + 2 * half);
  const core = drawnTight(middle, along, radius, { ...plain, keep: 24, sharpest }, half);
  if (core.shapes.length === 0) return null;
  // which side of the middle line the first strand lies on, going from the ends to the eye
  const side =
    Math.sign(dotOf(sub(p[0] as Particle, middle[0] as Particle), pairSides(middle, d, h, 0, faces)[0] as Point3)) || 1;
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
  const outOfEye = from(middle[m - 1] as Point3, middle[Math.max(m - 1 - SPAN, 0)] as Point3);
  const across = sub(p[m - 1] as Particle, p[last] as Particle);
  // the tip of a bight that runs on: the way its two strands come into it, there, and nothing of it left out
  const bothWays = (a: Point3, b: Point3): Point3 => from([a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);
  const intoTip = bothWays(
    from(p[m - 1] as Point3, p[m - 3] as Point3),
    from(p[last] as Point3, p[last + 2] as Point3),
  );
  const ease = options.still ? 1 : EYE_EASE;
  const mouth = mix(p[m - 1] as Particle, p[last] as Particle, 0.5);
  const shapes = core.shapes.map((whole, k) => {
    // the pair runs on from the knot to the eye as far as it did as tied: what the knot gives up runs out into
    // the legs, and the eye stays where it is against the knot; unless stretches of it stay where they are, when
    // what the knot gives up has run out towards the eye already
    const line = options.still ? whole : whole.slice(0, Math.min(knotEnd(whole) + toEye, whole.length));
    // side by side, and in each bend turned, its outer strand behind the inner, as it was drawn tight
    const sides = core.sides[k] as readonly Point3[];
    const [first, second]: [Particle[], Particle[]] = [[], []];
    line.forEach((c, i) => {
      const way = sides[i] as Point3;
      const [x, y, z] = [side * half * way[0], side * half * way[1], side * half * way[2]];
      first.push([c[0] + x, c[1] + y, c[2] + z]);
      second.push([c[0] - x, c[1] - y, c[2] - z]);
    });
    // the eye goes with the knot, as the middle of its mouth goes, and turned to lie on along the pair as it
    // leaves the knot; leaving a little of it on either side free, for the rope to come round smoothly
    const end = mix(first[first.length - 1] as Particle, second[second.length - 1] as Particle, 0.5);
    const leaving = from(line[line.length - 1] as Point3, line[Math.max(line.length - 1 - SPAN, 0)] as Point3);
    // level, for an eye that something stands in; or, for the tip of a bight that runs on from a knot drawn tight
    // against what stays still, the way the pair now comes into it and as it now lies across
    const [one, other] = [first.length - 1, second.length - 1];
    const turnEye = options.still
      ? framed(
          intoTip,
          across,
          bothWays(
            from(first[one] as Point3, first[Math.max(one - 2, 0)] as Point3),
            from(second[other] as Point3, second[Math.max(other - 2, 0)] as Point3),
          ),
          sub(first[one] as Particle, second[other] as Particle),
        )
      : rotation(level(outOfEye), level(leaving));
    const moved = eye.slice(ease, -ease).map((point): Particle => {
      const [x, y, z] = turnEye(sub(point, mouth));
      return [end[0] + x, end[1] + y, end[2] + z];
    });
    const path: Particle[] = [...first, ...moved, ...second.reverse()];
    // the tip of a bight that runs on, eased into the pair on either side, where they meet
    if (options.still) for (const join of [first.length, first.length + moved.length]) eased(path, join, TIP_EASE);
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
  return { spacing: h, shapes: evenlyKept(p, shapes, options.keep ?? 11, d).map((k) => shapes[k] as Particle[]) };
}

const dotOf = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A direction laid flat in the drawing: the eye is turned only in the plane, and stays level. */
function level(direction: Point3): Point3 {
  const l = Math.hypot(direction[0], direction[1]) || 1;
  return [direction[0] / l, direction[1] / l, 0];
}

/**
 * The rotation that turns one way into another, and a way across the first into one across the second: the way
 * across each made square to it.
 */
function framed(was: Point3, wasAcross: Point3, now: Point3, nowAcross: Point3): (point: Point3) => Point3 {
  const frame = (t: Point3, a: Point3): [Point3, Point3, Point3] => {
    const on = dotOf(a, t);
    const square: Particle = [a[0] - on * t[0], a[1] - on * t[1], a[2] - on * t[2]];
    const l = size(square) || 1;
    const s: Point3 = [square[0] / l, square[1] / l, square[2] / l];
    return [t, s, [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]]];
  };
  const [from3, to3] = [frame(was, wasAcross), frame(now, nowAcross)];
  return (v) => {
    const [x, y, z] = from3.map((axis) => dotOf(v, axis)) as [number, number, number];
    const [a, b, c] = to3;
    return [a[0] * x + b[0] * y + c[0] * z, a[1] * x + b[1] * y + c[1] * z, a[2] * x + b[2] * y + c[2] * z];
  };
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
  // a knot tied in a bight is drawn tight dressed, as far as the frames on the way keep the rules
  let dressed: Tightening | null = null;
  const inBight =
    options.paired && held
      ? tightenInBight(curve.points, curve.s, rope.radius ?? 0.5, held, {
          ...options,
          ...(around.length > 0 ? { around } : {}),
        })
      : null;
  if (inBight) {
    const frames = inBight.shapes.map((shape, k) => frameOf(shape, inBight.spacing, `tightening-${k + 1}`));
    const all = { ...document, geometry: { frames: [start, ...frames] } };
    const kept = frames.findIndex((frame) => checkFrame(all, frame).some((issue) => issue.level === 'error'));
    if (kept !== 0) dressed = { ...inBight, shapes: kept < 0 ? inBight.shapes : inBight.shapes.slice(0, kept) };
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
