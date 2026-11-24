/**
 * The named parts of a rope as shapes to draw: the stretch of centerline each one covers, and a point of
 * it to hang its name on. Pure: it knows nothing about the views.
 */
import type { FrameCurve, Part, Point3 } from '@idontknot/core';

export interface PartShape {
  readonly id: string;
  readonly type: string;
  /** The stretch as fractions of the length of its rope. */
  readonly from: number;
  readonly to: number;
  /** The centerline of the stretch. */
  readonly points: readonly Point3[];
  /** The point its name hangs on: the middle of a straight part, the top of a loop. */
  readonly anchor: Point3;
}

/** Kinds of part that go round: their name sits at their highest point, outside them. */
const ROUND = new Set(['loop', 'eye', 'bight', 'turn']);

/** The point of a sampled curve at a material coordinate. */
export function pointAt(curve: FrameCurve, s: number): Point3 {
  const last = curve.points.length - 1;
  let i = 0;
  while (i < last - 1 && (curve.s[i + 1] as number) < s) i++;
  const [from, to] = [curve.s[i] as number, curve.s[i + 1] as number];
  const t = to > from ? Math.min(Math.max((s - from) / (to - from), 0), 1) : 0;
  const [a, b] = [curve.points[i] as Point3, curve.points[i + 1] as Point3];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function partShape(part: Part, curve: FrameCurve, length: number): PartShape {
  const inside = curve.points.filter((_, i) => (curve.s[i] as number) > part.from && (curve.s[i] as number) < part.to);
  const points = [pointAt(curve, part.from), ...inside, pointAt(curve, part.to)];
  const anchor = ROUND.has(part.type)
    ? points.reduce((highest, point) => (point[1] > highest[1] ? point : highest))
    : pointAt(curve, (part.from + part.to) / 2);
  return { id: part.id, type: part.type, from: part.from / length, to: part.to / length, points, anchor };
}

export type Bounds = readonly [minX: number, minY: number, maxX: number, maxY: number];

/** The box in the x-y plane that holds these curves, with a margin all round. */
export function boundsOf(curves: readonly { readonly points: readonly Point3[] }[], margin: number): Bounds {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const curve of curves) {
    for (const [x, y] of curve.points) {
      [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    }
  }
  return [minX - margin, minY - margin, maxX + margin, maxY + margin];
}
