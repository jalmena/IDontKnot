/**
 * From geometry to topology: the diagram of a set of curves in space, seen from +z.
 *
 * A curve is a polyline, the form every geometric algorithm works on. The diagram is computed exactly
 * for a view in general position. Views that are not (two strands touching where they cross) are reported.
 */

import type { Component, Diagram, Pass, Sign, Visit } from './diagram.ts';

export type Point3 = readonly [x: number, y: number, z: number];

export interface Polyline {
  readonly id: string;
  readonly kind?: 'rope' | 'rigid';
  readonly closed: boolean;
  readonly points: readonly Point3[];
}

/** Where along a polyline a visit happens: the index of the segment plus the fraction along it. */
export interface PlacedVisit {
  readonly crossing: string;
  readonly pass: Pass;
  readonly at: number;
}

export interface GeometryIssue {
  readonly kind: 'touching' | 'overlap';
  readonly message: string;
}

export interface Extraction {
  readonly diagram: Diagram;
  readonly visits: Readonly<Record<string, readonly PlacedVisit[]>>;
  readonly issues: readonly GeometryIssue[];
}

interface Segment {
  readonly curve: number;
  readonly index: number;
  readonly a: Point3;
  readonly b: Point3;
}

interface Found {
  readonly curveA: number;
  readonly atA: number;
  readonly curveB: number;
  readonly atB: number;
  readonly aIsOver: boolean;
  readonly sign: Sign;
}

/**
 * The diagram of the curves as seen from +z. `minDepthGap` is the smallest difference in z at a crossing
 * for which over and under are still considered distinct.
 */
export function diagramFromGeometry(curves: readonly Polyline[], options: { minDepthGap?: number } = {}): Extraction {
  const minDepthGap = options.minDepthGap ?? 1e-9;
  const issues: GeometryIssue[] = [];
  const segments: Segment[] = [];
  const segmentCount: number[] = [];
  curves.forEach((curve, c) => {
    const n = curve.points.length;
    const count = curve.closed ? n : n - 1;
    segmentCount.push(Math.max(count, 0));
    for (let i = 0; i < count; i++) {
      segments.push({ curve: c, index: i, a: curve.points[i] as Point3, b: curve.points[(i + 1) % n] as Point3 });
    }
  });

  const found: Found[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i] as Segment;
    for (let j = i + 1; j < segments.length; j++) {
      const t = segments[j] as Segment;
      if (s.curve === t.curve) {
        const count = segmentCount[s.curve] as number;
        const gap = t.index - s.index;
        const wraps = (curves[s.curve] as Polyline).closed && gap === count - 1;
        if (gap <= 1 || wraps) continue; // neighbours share a point; they do not cross
      }
      const rx = s.b[0] - s.a[0];
      const ry = s.b[1] - s.a[1];
      const qx = t.b[0] - t.a[0];
      const qy = t.b[1] - t.a[1];
      const denominator = rx * qy - ry * qx;
      const dx = t.a[0] - s.a[0];
      const dy = t.a[1] - s.a[1];
      if (Math.abs(denominator) < 1e-14) {
        if (Math.abs(dx * ry - dy * rx) < 1e-12 && overlapOnLine(s, t)) {
          issues.push({ kind: 'overlap', message: 'two strands lie on top of each other in this view' });
        }
        continue;
      }
      const u = (dx * qy - dy * qx) / denominator; // along s
      const v = (dx * ry - dy * rx) / denominator; // along t
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue; // half-open, so a crossing at a vertex is counted once
      const zs = s.a[2] + u * (s.b[2] - s.a[2]);
      const zt = t.a[2] + v * (t.b[2] - t.a[2]);
      if (Math.abs(zs - zt) < minDepthGap) {
        issues.push({
          kind: 'touching',
          message: 'two strands meet where they cross: over and under cannot be told apart',
        });
        continue;
      }
      const aIsOver = zs > zt;
      const cross = aIsOver ? rx * qy - ry * qx : qx * ry - qy * rx; // over × under
      found.push({
        curveA: s.curve,
        atA: s.index + u,
        curveB: t.curve,
        atB: t.index + v,
        aIsOver,
        sign: cross > 0 ? 1 : -1,
      });
    }
  }

  found.sort((x, y) => x.curveA - y.curveA || x.atA - y.atA);
  const placed: PlacedVisit[][] = curves.map(() => []);
  const crossings = found.map((f, index) => {
    const id = `c${index + 1}`;
    (placed[f.curveA] as PlacedVisit[]).push({ crossing: id, pass: f.aIsOver ? 'o' : 'u', at: f.atA });
    (placed[f.curveB] as PlacedVisit[]).push({ crossing: id, pass: f.aIsOver ? 'u' : 'o', at: f.atB });
    return { id, sign: f.sign };
  });

  const components: Component[] = [];
  const strands: Record<string, Visit[]> = {};
  const visits: Record<string, PlacedVisit[]> = {};
  curves.forEach((curve, c) => {
    const ordered = (placed[c] as PlacedVisit[]).sort((x, y) => x.at - y.at);
    components.push({ id: curve.id, kind: curve.kind ?? 'rope', closed: curve.closed });
    strands[curve.id] = ordered.map((visit) => [visit.crossing, visit.pass] as const);
    visits[curve.id] = ordered;
  });
  return { diagram: { components, crossings, strands }, visits, issues };
}

function overlapOnLine(s: Segment, t: Segment): boolean {
  const axis = Math.abs(s.b[0] - s.a[0]) >= Math.abs(s.b[1] - s.a[1]) ? 0 : 1;
  const [s0, s1] = [Math.min(s.a[axis], s.b[axis]), Math.max(s.a[axis], s.b[axis])];
  const [t0, t1] = [Math.min(t.a[axis], t.b[axis]), Math.max(t.a[axis], t.b[axis])];
  return Math.min(s1, t1) - Math.max(s0, t0) > 1e-12;
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export interface TorusOptions {
  /** Points per loop. */
  readonly samples?: number;
  /** Distance from the axis of the torus to the centre of its tube. */
  readonly major?: number;
  /** Radius of the tube of the torus. */
  readonly minor?: number;
}

/**
 * The (p, q) torus link as closed polylines: rope that winds p times round the axis of a torus and q times
 * through its hole. It has gcd(p, q) loops, each of them a torus knot; when p and q are coprime it is one knot.
 * Seen from +z it has (p - 1) q crossings, all positive, and is the closure of the braid word `torusBraidWord(p, q)`.
 */
export function torusLink(p: number, q: number, options: TorusOptions = {}): Polyline[] {
  if (!Number.isInteger(p) || !Number.isInteger(q) || p < 1 || q < 1) {
    throw new Error('p and q must be positive integers');
  }
  const loops = gcd(p, q);
  const [p1, q1] = [p / loops, q / loops];
  const samples = options.samples ?? 60 * Math.max(p1, q1);
  const major = options.major ?? 2;
  const minor = options.minor ?? 0.8;
  return Array.from({ length: loops }, (_, loop) => {
    const points: Point3[] = [];
    for (let k = 0; k < samples; k++) {
      // a small offset keeps crossings away from sample points
      const t = (2 * Math.PI * (k + 0.37)) / samples;
      const round = p1 * t;
      // each loop is the same curve, shifted round the tube of the torus
      const through = q1 * t - (2 * Math.PI * loop) / (loops * p1);
      const radius = major + minor * Math.cos(through);
      points.push([radius * Math.cos(round), radius * Math.sin(round), -minor * Math.sin(through)]);
    }
    return { id: `k${loop}`, closed: true, points };
  });
}

/** The (p, q) torus knot: `torusLink` for coprime p and q, which is a single loop. */
export function torusKnot(p: number, q: number, options: TorusOptions = {}): Polyline {
  if (!Number.isInteger(p) || !Number.isInteger(q) || p < 1 || q < 1 || gcd(p, q) !== 1) {
    throw new Error('p and q must be positive and coprime');
  }
  return torusLink(p, q, options)[0] as Polyline;
}
