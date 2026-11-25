/**
 * A rope that is fed along the way of a knot: while the knot is tied, the rope does not appear where its
 * end is led. All of it is there from the beginning: what has not yet come into the knot lies straight
 * behind the start of the way, and slides in as the end goes forward. Pure.
 */
import { cutCurve, type FrameCurve, type Point3 } from '@idontknot/core';

/**
 * The rope when its end has been led to `position` along the way of the knot, a curve of a rope `length`
 * long: the way as far as there, and before it, straight back from its start, the rest of the rope.
 */
export function fed(way: FrameCurve, position: number, length: number): FrameCurve {
  const laid = cutCurve(way, position);
  const behind = length - Math.min(Math.max(position, 0), length);
  const [first, second] = [laid.points[0], laid.points[1]];
  if (behind < 1e-6 || !first || !second) return laid;
  const back = [first[0] - second[0], first[1] - second[1], first[2] - second[2]] as const;
  const size = Math.hypot(...back) || 1;
  const far: Point3 = [
    first[0] + (back[0] / size) * behind,
    first[1] + (back[1] / size) * behind,
    first[2] + (back[2] / size) * behind,
  ];
  // the material that is at each point of the way is further along the rope by what is still behind
  return { ...laid, points: [far, ...laid.points], s: [0, ...laid.s.map((s) => s + behind)] };
}
