/**
 * A rope as a surface swept along its centerline.
 *
 * The cross-section is carried along the curve with rotation-minimising frames, computed by the
 * double-reflection method (Wang, Jüttler, Zheng, Liu, 2008). Unlike Frenet frames they do not flip
 * where the curve straightens, so the rope does not twist or pinch. For a closed curve the small
 * mismatch where the curve meets itself is spread evenly along its length.
 *
 * The cross-section is either a circle or the outline of three strands laid together, which turn
 * round the rope as it goes: the shape of laid rope, so that light and shadow fall as they do on one.
 *
 * This module is pure: it produces arrays, and knows nothing about the renderer.
 */

import type { Point3 } from '@idontknot/core';

type Vec = [number, number, number];

const sub = (a: readonly number[], b: readonly number[]): Vec => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const dot = (a: readonly number[], b: readonly number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const cross = (a: readonly number[], b: readonly number[]): Vec => [
  a[1]! * b[2]! - a[2]! * b[1]!,
  a[2]! * b[0]! - a[0]! * b[2]!,
  a[0]! * b[1]! - a[1]! * b[0]!,
];
const axpy = (a: readonly number[], s: number, b: readonly number[]): Vec => [
  a[0]! + s * b[0]!,
  a[1]! + s * b[1]!,
  a[2]! + s * b[2]!,
];
const unit = (a: readonly number[]): Vec => {
  const length = Math.hypot(a[0]!, a[1]!, a[2]!) || 1;
  return [a[0]! / length, a[1]! / length, a[2]! / length];
};
const distance = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** The length of the polyline, including the closing segment of a closed one. */
export function curveLength(points: readonly Point3[], closed: boolean): number {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) total += distance(points[i]!, points[i + 1]!);
  return closed && points.length > 1 ? total + distance(points[points.length - 1]!, points[0]!) : total;
}

/**
 * The same curve with points no further apart than `spacing`, by Catmull-Rom interpolation.
 * The original points are kept; new ones are added between them.
 */
export function resample(points: readonly Point3[], closed: boolean, spacing: number): Point3[] {
  const n = points.length;
  const at = (i: number): Point3 => (closed ? points[((i % n) + n) % n]! : points[Math.min(Math.max(i, 0), n - 1)]!);
  const out: Point3[] = [];
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const pieces = Math.max(1, Math.ceil(distance(p1, p2) / spacing));
    for (let k = 0; k < pieces; k++) {
      const t = k / pieces;
      const point = [0, 1, 2].map(
        (axis) =>
          0.5 *
          (2 * p1[axis]! +
            (p2[axis]! - p0[axis]!) * t +
            (2 * p0[axis]! - 5 * p1[axis]! + 4 * p2[axis]! - p3[axis]!) * t * t +
            (3 * p1[axis]! - p0[axis]! - 3 * p2[axis]! + p3[axis]!) * t * t * t),
      );
      out.push(point as unknown as Point3);
    }
  }
  if (!closed) out.push(points[n - 1]!);
  return out;
}

export interface Frames {
  readonly tangents: Vec[];
  readonly normals: Vec[];
  readonly binormals: Vec[];
}

/** One double-reflection step: carries the normal `r` from point `a` (tangent `ta`) to point `b` (tangent `tb`). */
function transport(a: Point3, b: Point3, ta: Vec, tb: Vec, r: Vec): Vec {
  const v1 = sub(b, a);
  const c1 = dot(v1, v1) || 1;
  const rL = axpy(r, (-2 / c1) * dot(v1, r), v1);
  const tL = axpy(ta, (-2 / c1) * dot(v1, ta), v1);
  const v2 = sub(tb, tL);
  const c2 = dot(v2, v2);
  return c2 < 1e-18 ? rL : unit(axpy(rL, (-2 / c2) * dot(v2, rL), v2));
}

export function rotationMinimisingFrames(points: readonly Point3[], closed: boolean): Frames {
  const n = points.length;
  if (n < 2) throw new Error('a curve needs at least two points');
  const tangents: Vec[] = points.map((_, i) => {
    const before = closed ? points[(i - 1 + n) % n]! : points[Math.max(i - 1, 0)]!;
    const after = closed ? points[(i + 1) % n]! : points[Math.min(i + 1, n - 1)]!;
    return unit(sub(after, before));
  });

  const t0 = tangents[0]!;
  const seed: Vec = Math.abs(t0[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const normals: Vec[] = [unit(axpy(seed, -dot(seed, t0), t0))];
  for (let i = 0; i < n - 1; i++) {
    normals.push(transport(points[i]!, points[i + 1]!, tangents[i]!, tangents[i + 1]!, normals[i]!));
  }

  if (closed) {
    // carry the last frame back to the start and measure how far it is from the first
    const back = transport(points[n - 1]!, points[0]!, tangents[n - 1]!, t0, normals[n - 1]!);
    const first = normals[0]!;
    const angle = Math.atan2(dot(cross(first, back), t0), dot(first, back));
    for (let i = 1; i < n; i++) {
      const theta = (-angle * i) / n;
      const r = normals[i]!;
      const side = cross(tangents[i]!, r);
      const turned: Vec = [r[0] * Math.cos(theta), r[1] * Math.cos(theta), r[2] * Math.cos(theta)];
      normals[i] = unit(axpy(turned, Math.sin(theta), side));
    }
  }
  const binormals = normals.map((r, i) => cross(tangents[i]!, r));
  return { tangents, normals, binormals };
}

/**
 * The outline of `strands` round strands laid together, as a radius for each angle, at most 1.
 * Between two strands the outline dips into a groove.
 */
export function strandProfile(angle: number, strands: number): number {
  if (strands < 2) return 1;
  const sector = (2 * Math.PI) / strands;
  const delta = ((((angle + sector / 2) % sector) + sector) % sector) - sector / 2; // angle from the nearest strand's centre
  const centre = 0.45;
  const size = 0.62;
  const reach = centre * Math.cos(delta) + Math.sqrt(size * size - (centre * Math.sin(delta)) ** 2);
  return reach / (centre + size);
}

export interface TubeData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** u runs along the rope and v across each strand, so that a texture of fibres follows the strands. */
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  /** Rows of vertices along the rope and columns round it, counting the repeated last row and column. */
  readonly rows: number;
  readonly columns: number;
  readonly length: number;
}

export interface TubeOptions {
  /** Vertices round the rope. */
  readonly sides?: number;
  /** 0 or 1 for a round tube; 3 for three-strand laid rope. */
  readonly strands?: number;
  /** Length of rope over which a strand goes once round it. */
  readonly layLength?: number;
  /** Length of rope covered by one repeat of the texture. */
  readonly textureLength?: number;
}

export function buildTube(
  points: readonly Point3[],
  closed: boolean,
  radius: number,
  options: TubeOptions = {},
): TubeData {
  const sides = options.sides ?? 30;
  const strands = options.strands ?? 3;
  const layLength = options.layLength ?? 7 * radius;
  const textureLength = options.textureLength ?? 3 * radius;
  const n = points.length;
  const frames = rotationMinimisingFrames(points, closed);

  const along = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) along[i + 1] = along[i]! + distance(points[i]!, points[(i + 1) % n]!);
  const length = closed ? along[n]! : along[n - 1]!;

  // on a closed rope the strands and the texture must meet themselves where the rope does
  const perStrand = Math.max(strands, 1);
  const turns = closed ? Math.max(1, Math.round((perStrand * length) / layLength)) / perStrand : length / layLength;
  const repeats = closed ? Math.max(1, Math.round(length / textureLength)) : length / textureLength;

  // the surface on its own grid, n rows by `sides` columns
  const grid = new Float64Array(n * sides * 3);
  for (let i = 0; i < n; i++) {
    const [px, py, pz] = points[i]!;
    const normal = frames.normals[i]!;
    const binormal = frames.binormals[i]!;
    const twist = 2 * Math.PI * turns * (along[i]! / length);
    for (let j = 0; j < sides; j++) {
      const angle = (2 * Math.PI * j) / sides;
      const reach = radius * strandProfile(angle - twist, strands);
      const [ca, sa] = [Math.cos(angle), Math.sin(angle)];
      const k = (i * sides + j) * 3;
      grid[k] = px + reach * (ca * normal[0] + sa * binormal[0]);
      grid[k + 1] = py + reach * (ca * normal[1] + sa * binormal[1]);
      grid[k + 2] = pz + reach * (ca * normal[2] + sa * binormal[2]);
    }
  }
  const cell = (i: number, j: number): Vec => {
    const k = (i * sides + j) * 3;
    return [grid[k]!, grid[k + 1]!, grid[k + 2]!];
  };

  // the last row and the last column repeat the first, so that the texture can wrap without a seam
  const rows = closed ? n + 1 : n;
  const columns = sides + 1;
  const positions = new Float32Array(rows * columns * 3);
  const normals = new Float32Array(rows * columns * 3);
  const uvs = new Float32Array(rows * columns * 2);
  for (let row = 0; row < rows; row++) {
    const i = row % n;
    const before = closed ? (i - 1 + n) % n : Math.max(i - 1, 0);
    const after = closed ? (i + 1) % n : Math.min(i + 1, n - 1);
    const travelled = row === n ? length : along[i]!;
    for (let column = 0; column < columns; column++) {
      const j = column % sides;
      const here = cell(i, j);
      // the normal of the surface, from its neighbours on the grid; it must point away from the centerline
      const round = sub(cell(i, (j + 1) % sides), cell(i, (j - 1 + sides) % sides));
      const lengthwise = sub(cell(after, j), cell(before, j));
      let normal = unit(cross(round, lengthwise));
      if (dot(normal, sub(here, points[i]!)) < 0) normal = [-normal[0], -normal[1], -normal[2]];

      const k = (row * columns + column) * 3;
      positions.set(here, k);
      normals.set(normal, k);
      const u = repeats * (travelled / length);
      const v =
        strands >= 2
          ? (strands * ((2 * Math.PI * column) / sides - 2 * Math.PI * turns * (travelled / length))) / (2 * Math.PI)
          : column / sides;
      uvs.set([u, v], (row * columns + column) * 2);
    }
  }

  const indices = new Uint32Array((rows - 1) * sides * 6);
  let at = 0;
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < sides; column++) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      indices.set([a, b, c, b, d, c], at); // anticlockwise seen from outside, so the outside is the front
      at += 6;
    }
  }
  return { positions, normals, uvs, indices, rows, columns, length };
}
