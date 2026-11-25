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
  const step = Math.hypot(...back) || 1;
  const at = (distance: number): Point3 => [
    first[0] + (back[0] / step) * distance,
    first[1] + (back[1] / step) * distance,
    first[2] + (back[2] / step) * distance,
  ];
  // The rope behind is given point by point, as far apart as the points of the way are: a view that draws a
  // smooth curve through the points of a rope goes astray where they are suddenly much further apart, or
  // much nearer. So a last bit that is shorter than half a step is joined to the first step of the way.
  const short = behind < step / 2;
  const count = short ? 1 : Math.max(1, Math.round(behind / step));
  const points: Point3[] = [];
  const s: number[] = [];
  for (let k = count; k >= 1; k--) {
    points.push(at((behind * k) / count));
    s.push(behind - (behind * k) / count);
  }
  const kept = short ? 1 : 0; // the start of the way itself is left out when the bit behind it is that short
  // the material that is at each point of the way is further along the rope by what is still behind
  return {
    ...laid,
    points: [...points, ...laid.points.slice(kept)],
    s: [...s, ...laid.s.slice(kept).map((coordinate) => coordinate + behind)],
  };
}
