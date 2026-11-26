/**
 * What a knot is shown tied to, and where: a plate that a stopper keeps the rope from running through, or a
 * post that an eye is dropped over. They are placed from the shape the rope has, so that they stay with the
 * knot as it is tied and tightened. Pure: it knows nothing about the views.
 */
import type { Point3 } from '@idontknot/core';
import { PLATE_THICKNESS, POST_RADIUS, type SceneObject } from '../viewer/things.ts';

const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const size = (a: Point3): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Point3): Point3 => {
  const l = size(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A rope as the views draw it: its centerline, the material coordinate of each point, and its thickness. */
export interface RopeShape {
  readonly points: readonly Point3[];
  readonly s: readonly number[];
  readonly radius: number;
}

/** The point of a rope at a material coordinate, and the way the rope runs there. */
function along(rope: RopeShape, at: number): { point: Point3; tangent: Point3 } {
  const { points, s } = rope;
  let i = 0;
  while (i < points.length - 2 && (s[i + 1] as number) < at) i++;
  const [a, b] = [points[i] as Point3, points[i + 1] as Point3];
  const [from, to] = [s[i] as number, s[i + 1] as number];
  const t = to > from ? Math.min(Math.max((at - from) / (to - from), 0), 1) : 0;
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    tangent: unit(sub(b, a)),
  };
}

/** Where the rope first comes to lie against itself, along it: where its standing part enters the knot. */
function entersKnot(rope: RopeShape): number {
  const d = 2 * rope.radius;
  const apart = 0.95 * Math.PI * d;
  const { points, s } = rope;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if ((s[j] as number) - (s[i] as number) < apart) continue;
      if (size(sub(points[i] as Point3, points[j] as Point3)) < 1.2 * d) return s[i] as number;
    }
  }
  return 0;
}

/**
 * A plate across the standing part, a little short of where it enters the knot: the knot rests against it,
 * and keeps the rope from running out through its hole.
 */
export function plateFor(rope: RopeShape): SceneObject {
  const d = 2 * rope.radius;
  const at = Math.max(entersKnot(rope) - (0.8 + PLATE_THICKNESS / 2) * d, 0);
  const { point, tangent } = along(rope, at);
  return { kind: 'plate', at: point, axis: tangent, scale: d };
}

/**
 * A post standing through an eye, at its end furthest from the knot, against the inside of the rope. It
 * stands across the plane the knot is drawn in.
 */
export function postFor(rope: RopeShape, eye: readonly [from: number, to: number]): SceneObject {
  const d = 2 * rope.radius;
  const inside = rope.points.filter((_, i) => (rope.s[i] as number) > eye[0] && (rope.s[i] as number) < eye[1]);
  if (inside.length < 3)
    return { kind: 'post', at: along(rope, (eye[0] + eye[1]) / 2).point, axis: [0, 0, 1], scale: d };
  const mouth = along(rope, eye[0]).point;
  const far = inside.reduce((best, point) => (size(sub(point, mouth)) > size(sub(best, mouth)) ? point : best));
  const middle: Point3 = [0, 1, 2].map(
    (c) => inside.reduce((sum, point) => sum + point[c]!, 0) / inside.length,
  ) as unknown as Point3;
  // into the eye from its far end, in the plane of the drawing
  const inward = unit([middle[0] - far[0], middle[1] - far[1], 0]);
  const reach = (POST_RADIUS + 0.65) * d;
  return { kind: 'post', at: [far[0] + inward[0] * reach, far[1] + inward[1] * reach, 0], axis: [0, 0, 1], scale: d };
}
