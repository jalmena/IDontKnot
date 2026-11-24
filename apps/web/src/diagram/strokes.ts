/**
 * The 2D diagram of curves seen from +z, drawn the way knot diagrams are: where a rope passes under
 * another, its line is broken. Pure: it turns curves and their crossing visits into lines to draw.
 */

import type { PlacedVisit, Polyline } from '@idontknot/core';

export type Point2 = readonly [x: number, y: number];

export interface Stroke {
  readonly component: string;
  readonly points: Point2[];
}

export interface CrossingLabel {
  readonly id: string;
  readonly at: Point2;
  /** The way from the crossing into the gap between its two ropes that faces away from the middle of the drawing. */
  readonly clear: Point2;
}

interface Measured {
  readonly xy: Point2[];
  /** Length along the projected curve up to each point; one entry more than points when closed. */
  readonly along: number[];
  readonly total: number;
}

function measure(curve: Polyline): Measured {
  const xy = curve.points.map(([x, y]): Point2 => [x, y]);
  const count = curve.closed ? xy.length : xy.length - 1;
  const along = [0];
  for (let i = 0; i < count; i++) {
    const [a, b] = [xy[i]!, xy[(i + 1) % xy.length]!];
    along.push(along[i]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { xy, along, total: along[along.length - 1]! };
}

/** The length along the curve at "segment index plus fraction". */
function lengthAt(m: Measured, at: number): number {
  const i = Math.min(Math.floor(at), m.along.length - 2);
  return m.along[i]! + (at - i) * (m.along[i + 1]! - m.along[i]!);
}

/** The point at a length along the curve. */
function pointAt(m: Measured, length: number): Point2 {
  let i = 0;
  while (i < m.along.length - 2 && m.along[i + 1]! < length) i += 1;
  const span = m.along[i + 1]! - m.along[i]! || 1;
  const t = (length - m.along[i]!) / span;
  const [a, b] = [m.xy[i]!, m.xy[(i + 1) % m.xy.length]!];
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

/** The curve from one length to another, through every point between them. */
function piece(m: Measured, from: number, to: number): Point2[] {
  const points = [pointAt(m, from)];
  for (let i = 1; i < m.along.length - 1; i++) {
    if (m.along[i]! > from && m.along[i]! < to) points.push(m.xy[i % m.xy.length]!);
  }
  points.push(pointAt(m, to));
  return points;
}

/**
 * The lines of the diagram. Each curve is drawn whole except for a gap of half-width `gap`
 * around every place where it passes under.
 */
export function diagramStrokes(
  curves: readonly Polyline[],
  visits: Readonly<Record<string, readonly PlacedVisit[]>>,
  gap: number,
): Stroke[] {
  const strokes: Stroke[] = [];
  for (const curve of curves) {
    const m = measure(curve);
    const unders = (visits[curve.id] ?? [])
      .filter((visit) => visit.pass === 'u')
      .map((visit) => lengthAt(m, visit.at))
      .sort((a, b) => a - b);
    if (unders.length === 0) {
      strokes.push({ component: curve.id, points: piece(m, 0, m.total) });
      continue;
    }
    // the kept stretches run from just after one gap to just before the next
    for (let k = 0; k < unders.length; k++) {
      const from = unders[k]! + gap;
      const next = k + 1 < unders.length ? unders[k + 1]! : curve.closed ? unders[0]! + m.total : m.total + gap;
      const to = next - gap;
      if (to <= from) continue;
      if (to <= m.total) {
        strokes.push({ component: curve.id, points: piece(m, from, to) });
      } else {
        // a closed curve: this stretch runs through the point where the curve meets itself
        const first = from < m.total ? piece(m, from, m.total) : [];
        const rest = piece(m, Math.max(from - m.total, 0), to - m.total);
        strokes.push({ component: curve.id, points: [...first, ...rest] });
      }
    }
    if (!curve.closed && unders[0]! - gap > 0) {
      strokes.unshift({ component: curve.id, points: piece(m, 0, unders[0]! - gap) });
    }
  }
  return strokes;
}

/**
 * Where each crossing is, taken from the rope that passes over it, and which way its number can be
 * written clear of both ropes: along the line that halves the angle between them, on the side away from
 * `centre`.
 */
export function crossingLabels(
  curves: readonly Polyline[],
  visits: Readonly<Record<string, readonly PlacedVisit[]>>,
  centre: Point2 = [0, 0],
): CrossingLabel[] {
  const found = new Map<string, { at?: Point2; ways: Point2[] }>();
  for (const curve of curves) {
    const m = measure(curve);
    const step = m.total / 2000;
    for (const visit of visits[curve.id] ?? []) {
      const length = lengthAt(m, visit.at);
      const [before, after] = [pointAt(m, Math.max(length - step, 0)), pointAt(m, Math.min(length + step, m.total))];
      const size = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1;
      const crossing = found.get(visit.crossing) ?? { ways: [] };
      crossing.ways.push([(after[0] - before[0]) / size, (after[1] - before[1]) / size]);
      if (visit.pass === 'o') crossing.at = pointAt(m, length);
      found.set(visit.crossing, crossing);
    }
  }
  const labels: CrossingLabel[] = [];
  for (const [id, { at, ways }] of found) {
    if (!at) continue;
    const [a, b] = [ways[0] ?? [1, 0], ways[1] ?? [0, 1]];
    const outward: Point2 = [at[0] - centre[0], at[1] - centre[1]];
    let clear: Point2 = [0, 1];
    let best = -Infinity;
    for (const [x, y] of [
      [a[0] + b[0], a[1] + b[1]],
      [a[0] - b[0], a[1] - b[1]],
      [-a[0] - b[0], -a[1] - b[1]],
      [b[0] - a[0], b[1] - a[1]],
    ] as const) {
      const size = Math.hypot(x, y);
      if (size < 1e-9) continue;
      const facing = (x * outward[0] + y * outward[1]) / size;
      if (facing > best) [best, clear] = [facing, [x / size, y / size]];
    }
    labels.push({ id, at, clear });
  }
  return labels.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}
