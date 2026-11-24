/**
 * A rope as a tube swept along its centerline.
 *
 * The cross-section is carried along the curve with rotation-minimising frames, computed by the
 * double-reflection method (Wang, Jüttler, Zheng, Liu, 2008). Unlike Frenet frames they do not flip
 * where the curve straightens, so the tube does not twist or pinch. For a closed curve the small
 * mismatch where the curve meets itself is spread evenly along its length.
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
      normals[i] = unit(
        axpy([r[0] * Math.cos(theta), r[1] * Math.cos(theta), r[2] * Math.cos(theta)], Math.sin(theta), side),
      );
    }
  }
  const binormals = normals.map((r, i) => cross(tangents[i]!, r));
  return { tangents, normals, binormals };
}

export interface TubeData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** A shade per vertex, drawn as three helical strands so that the rope reads as laid rope. */
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
  readonly rings: number;
  readonly sides: number;
}

export interface TubeOptions {
  readonly sides?: number;
  readonly color?: readonly [number, number, number];
  /** Turns of the strands per ring of the tube. */
  readonly lay?: number;
}

export function buildTube(
  points: readonly Point3[],
  closed: boolean,
  radius: number,
  options: TubeOptions = {},
): TubeData {
  const sides = options.sides ?? 18;
  const [red, green, blue] = options.color ?? [0.953, 0.918, 0.827];
  const lay = options.lay ?? 0.035;
  const rings = points.length;
  // on a closed rope the strands must meet themselves: a whole number of strand widths round the loop
  const layPerRing = closed ? Math.max(1, Math.round(rings * lay * 3)) / (3 * rings) : lay;
  const frames = rotationMinimisingFrames(points, closed);

  const positions = new Float32Array(rings * sides * 3);
  const normals = new Float32Array(rings * sides * 3);
  const colors = new Float32Array(rings * sides * 3);
  for (let i = 0; i < rings; i++) {
    const [px, py, pz] = points[i]!;
    const n = frames.normals[i]!;
    const b = frames.binormals[i]!;
    for (let j = 0; j < sides; j++) {
      const angle = (2 * Math.PI * j) / sides;
      const [ca, sa] = [Math.cos(angle), Math.sin(angle)];
      const dx = ca * n[0] + sa * b[0];
      const dy = ca * n[1] + sa * b[1];
      const dz = ca * n[2] + sa * b[2];
      const k = (i * sides + j) * 3;
      positions[k] = px + radius * dx;
      positions[k + 1] = py + radius * dy;
      positions[k + 2] = pz + radius * dz;
      normals[k] = dx;
      normals[k + 1] = dy;
      normals[k + 2] = dz;
      // three strands: darker in the grooves between them
      const phase = j / sides + i * layPerRing;
      const shade = 0.62 + 0.38 * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * 3 * phase), 0.7);
      colors[k] = red * shade;
      colors[k + 1] = green * shade;
      colors[k + 2] = blue * shade;
    }
  }

  const bands = closed ? rings : rings - 1;
  const indices = new Uint32Array(bands * sides * 6);
  let at = 0;
  for (let i = 0; i < bands; i++) {
    const next = (i + 1) % rings;
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + ((j + 1) % sides);
      const c = next * sides + j;
      const d = next * sides + ((j + 1) % sides);
      indices.set([a, c, b, b, c, d], at);
      at += 6;
    }
  }
  return { positions, normals, colors, indices, rings, sides };
}
