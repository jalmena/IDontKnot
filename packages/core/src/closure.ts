/**
 * Joining the two ends of an open rope through space, over the whole knot or under it. When the ends lie
 * in one face of the diagram, joining them outside the knot is the natural choice, and the closure of the
 * document says so. When an end lies inside, as the tail of a bowline lies inside its eye, the way it is
 * joined to the other decides the knot it makes; but a join that passes over everything is the same knot
 * whatever way it takes, and so is one that passes under everything. Those two are well defined.
 */
import type { Point3, Polyline } from './geometry.ts';

export type Side = 'over' | 'under';

/**
 * The rope closed by a join that leaves its end straight up (or down), goes round above (or below) the
 * whole drawing, and comes down to its start. The join is bent out of the line between the two ends, so
 * that seen from the front it is not drawn along a strand of the rope.
 */
export function joinedAcross(rope: Polyline, side: Side): Polyline {
  const [start, end] = [rope.points[0] as Point3, rope.points[rope.points.length - 1] as Point3];
  let [minX, minY, maxX, maxY, reach] = [Infinity, Infinity, -Infinity, -Infinity, 0];
  for (const [x, y, z] of rope.points) {
    [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    reach = Math.max(reach, Math.abs(z));
  }
  const height = (side === 'over' ? 1 : -1) * (reach + Math.hypot(maxX - minX, maxY - minY) + 1);
  // a bend well above the drawing, at a slant to everything in it
  const bend: Point3 = [(minX + maxX) / 2 + 0.37 * (maxX - minX), maxY + 0.61 * (maxY - minY) + 1.3, height];
  const join: Point3[] = [[end[0], end[1], height], bend, [start[0], start[1], height]];
  return { ...rope, closed: true, points: [...rope.points, ...join] };
}
