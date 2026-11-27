/**
 * A rope that is fed along the way of a knot: while the knot is tied, the rope does not appear where its
 * end is led. All of it is there from the beginning: what has not yet come into the knot lies straight
 * behind the start of the way, and slides in as the end goes forward. Pure.
 */
import { curveFrom, cutCurve, type FrameCurve, type Point3 } from '@idontknot/core';

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

const towards = (a: Point3, b: Point3): Point3 => {
  const v: Point3 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * The rope led with its bight, the bight having come to `position` from each end along the way of the knot, a
 * curve of a rope `length` long: the way from the start of the rope as far as there, the bight turned round
 * ahead of it, and back along the way to the end of the rope; and before each end, straight back from it, the
 * rope that has not come in yet. Distances along it are lengths of rope from its far start.
 */
export function fedByBight(way: FrameCurve, position: number, length: number): FrameCurve {
  return byBight(way, position, length, true);
}

/** The rope led with its bight as far as `position` from each end, without what has not come in yet. */
export function laidByBight(way: FrameCurve, position: number, length: number): FrameCurve {
  return byBight(way, position, length, false);
}

function byBight(way: FrameCurve, position: number, length: number, behind: boolean): FrameCurve {
  const half = length / 2;
  const at = Math.min(Math.max(position, 0), half);
  if (at >= half - 1e-6) return way;
  const there = cutCurve(way, at).points;
  const back = curveFrom(way, length - at).points;
  const [lead, before] = [there.at(-1), there.at(-2)];
  const [turn, start, end] = [back[0], way.points[0], way.points.at(-1)];
  if (!lead || !before || !turn || !start || !end || way.points.length < 2) return way;
  // the bight, turned round ahead of the two stretches, as far round as they are apart
  const ahead = towards(lead, before);
  const middle: Point3 = [(lead[0] + turn[0]) / 2, (lead[1] + turn[1]) / 2, (lead[2] + turn[2]) / 2];
  const apart = Math.hypot(turn[0] - lead[0], turn[1] - lead[1], turn[2] - lead[2]) / 2;
  const across = towards(lead, middle);
  const bight: Point3[] = [];
  for (let k = 1; k < 8; k++) {
    const angle = (Math.PI * k) / 8;
    bight.push([
      middle[0] + apart * (Math.cos(angle) * across[0] + Math.sin(angle) * ahead[0]),
      middle[1] + apart * (Math.cos(angle) * across[1] + Math.sin(angle) * ahead[1]),
      middle[2] + apart * (Math.cos(angle) * across[2] + Math.sin(angle) * ahead[2]),
    ]);
  }
  const laid: Point3[] = [...there, ...bight, ...back];
  // what has not come in yet: as long, from each end, as the bight is short of the middle, less what the bight
  // turned round ahead takes
  // as far apart as the points of the way are: a curve drawn through points goes astray where they are not
  const next = way.points[1] as Point3;
  const step = Math.hypot(next[0] - start[0], next[1] - start[1], next[2] - start[2]) || 0.5;
  const rest = behind ? Math.max(half - at - (Math.PI * apart) / 2, 0) : 0;
  const straight = (from: Point3, away: Point3): Point3[] => {
    const count = Math.max(Math.round(rest / step), rest > 1e-6 ? 1 : 0);
    return Array.from({ length: count }, (_, k): Point3 => {
      const far = (rest * (k + 1)) / count;
      return [from[0] + away[0] * far, from[1] + away[1] * far, from[2] + away[2] * far];
    });
  };
  const outOfStart = towards(start, way.points[1] as Point3);
  const outOfEnd = towards(end, way.points.at(-2) as Point3);
  const points = [...straight(start, outOfStart).reverse(), ...laid, ...straight(end, outOfEnd)];
  // and the rope does not stretch: each point is as far along it as the rope that runs to it
  const s = [0];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1] as Point3, points[i] as Point3];
    s.push((s[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { ...way, points, s };
}
