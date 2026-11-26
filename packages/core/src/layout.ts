/**
 * Laying out a knot: from a drawing of one open rope in the plane, with how it passes at each crossing, to
 * the knot's document: the shape in space, the diagram that shape shows, the named parts of the rope and
 * the method that ties it, each placed by the crossings the rope meets along itself.
 *
 * It is how the knots of the library are written. The drawing is the source; the document is made from it.
 */

import { shownAt, type Method, type Step } from './construction.ts';
import {
  KNOT_FORMAT,
  KNOT_FORMAT_VERSION,
  sampleCurve,
  SPAN_PIECES,
  type Curve,
  type CurvePoint,
  type KnotDocument,
  type Part,
} from './document.ts';
import { ropeEndsShareOneFace } from './embedding.ts';
import { diagramFromGeometry, type Point3 } from './geometry.ts';
import type { TightenOptions } from './tighten.ts';

/** A point of the drawing: where it is in the plane and, at a crossing, how the rope passes there, or its height. */
export type LayoutPoint = readonly [x: number, y: number, pass?: 'over' | 'under' | number];

/**
 * A place along the rope: one of its ends, or one of the crossings it meets, counted from 1 along the rope,
 * and some distance beyond it (or, negative, before it).
 */
export type LayoutPlace = 'start' | 'end' | { readonly visit: number; readonly by?: number };

/** A straight rigid thing a rope is tied round: the two ends of its axis, and its radius. */
export interface LayoutThing {
  readonly id: string;
  readonly from: Point3;
  readonly to: Point3;
  readonly radius: number;
}

/**
 * How far apart the points of the axis of a rigid thing are written: near enough that the distance from the
 * rope to the thing is the distance to its nearest point, as the rules of a frame measure it.
 */
const THING_STEP = 0.25;

export interface Layout {
  readonly id: string;
  readonly rope: {
    readonly id?: string;
    readonly radius?: number;
    /** What each end of the rope is: `standing`, `working`, `tail`. */
    readonly start?: string;
    readonly end?: string;
  };
  /** How far above or below the plane the rope passes where the drawing says over or under. */
  readonly height?: number;
  /**
   * What the rope is tied round, if anything: straight rigid things, such as a post or a pole, each by the
   * two ends of its axis and its radius. They are components of the knot, and stay where they are.
   */
  readonly things?: readonly LayoutThing[];
  /** The id of the frame that is made. */
  readonly frame?: string;
  readonly path: readonly LayoutPoint[];
  readonly parts?: readonly {
    readonly id: string;
    readonly type: string;
    readonly from: LayoutPlace;
    readonly to: LayoutPlace;
  }[];
  /**
   * How the knot is drawn tight, where it is not as for every knot: a stiffer rope, for a knot whose loops
   * would otherwise bend it too sharply before they close. Or none: a lashing is drawn tight turn by turn
   * as it is tied, and its drawing is how it is left.
   */
  readonly tightening?: TightenOptions | false;
  /** How the knot is tied by leading the end of the rope along the drawing. */
  readonly method?: {
    readonly id: string;
    /** How much of the rope is laid before the first step. */
    readonly start: number;
    readonly steps: readonly {
      readonly id: string;
      readonly op: string;
      readonly pass?: 'over' | 'under';
      readonly passes?: readonly ('over' | 'under')[];
      readonly to: LayoutPlace;
    }[];
  };
}

// written without a sign on nought, as JSON writes it
const round = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** The document of the knot a drawing shows. It is not checked here: `checkDocument` and `checkFrame` do that. */
export function layOut(layout: Layout): KnotDocument {
  const rope = layout.rope.id ?? 'rope';
  const height = layout.height ?? 0.65;
  const xyz = layout.path.map(([x, y, pass]): Point3 => [
    x,
    y,
    pass === 'over' ? height : pass === 'under' ? -height : (pass ?? 0),
  ]);

  // the material coordinate of each point is the length of the curve as far as it; the curve depends a
  // little on the coordinates, so they are found by going round a few times
  let s = xyz.map((_, i) => i);
  for (let pass = 0; pass < 3; pass++) {
    const sampled = sampleCurve(
      { type: 'catmull-rom', points: xyz.map((p, i): CurvePoint => [...p, s[i] as number]) },
      false,
    );
    const along = [0];
    for (let i = 1; i < sampled.points.length; i++) {
      const [a, b] = [sampled.points[i - 1] as Point3, sampled.points[i] as Point3];
      along.push((along[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    s = xyz.map((_, i) => round(along[i * SPAN_PIECES] as number));
  }
  const length = s[s.length - 1] as number;
  const curve: Curve = {
    type: 'catmull-rom',
    points: xyz.map((p, i): CurvePoint => [round(p[0]), round(p[1]), round(p[2]), s[i] as number]),
  };

  // what the rope is tied round, as straight rigid components, their axes written as polylines
  const things = (layout.things ?? []).map((thing) => {
    const long = Math.hypot(thing.to[0] - thing.from[0], thing.to[1] - thing.from[1], thing.to[2] - thing.from[2]);
    const pieces = Math.max(Math.ceil(long / THING_STEP), 1);
    const points = Array.from({ length: pieces + 1 }, (_, k): CurvePoint => {
      const t = k / pieces;
      const at = (c: 0 | 1 | 2): number => round(thing.from[c] + (thing.to[c] - thing.from[c]) * t);
      return [at(0), at(1), at(2), k === pieces ? round(long) : round(long * t)];
    });
    return { thing, length: round(long), curve: { type: 'polyline', points } as Curve };
  });

  // the diagram is read from the shape, and each crossing the rope meets is placed along the rope
  const sampled = sampleCurve(curve, false);
  const { diagram, visits } = diagramFromGeometry([
    { id: rope, closed: false, points: sampled.points },
    ...things.map(({ thing, curve: axis }) => ({
      id: thing.id,
      kind: 'rigid' as const,
      closed: false,
      points: axis.points.map(([x, y, z]): Point3 => [x, y, z]),
    })),
  ]);
  const met = (visits[rope] ?? []).map((visit) => {
    const i = Math.floor(visit.at);
    const [a, b] = [sampled.s[i] as number, sampled.s[i + 1] ?? (sampled.s[i] as number)];
    return a + (visit.at - i) * (b - a);
  });
  const place = (where: LayoutPlace): number => {
    if (where === 'start') return 0;
    if (where === 'end') return length;
    const at = met[where.visit - 1];
    if (at === undefined)
      throw new Error(`"${layout.id}" meets ${met.length} crossings: there is no crossing ${where.visit}`);
    return round(at + (where.by ?? 0));
  };

  const frame = layout.frame ?? 'dressed';
  const parts: Part[] = (layout.parts ?? []).map((part) => ({
    id: part.id,
    component: rope,
    from: place(part.from),
    to: place(part.to),
    type: part.type,
  }));
  const document: KnotDocument = {
    format: KNOT_FORMAT,
    formatVersion: KNOT_FORMAT_VERSION,
    id: layout.id,
    components: [
      {
        id: rope,
        kind: 'rope',
        closed: false,
        radius: layout.rope.radius ?? 0.5,
        length,
        ends: { start: { role: layout.rope.start ?? 'standing' }, end: { role: layout.rope.end ?? 'tail' } },
      },
      ...things.map(({ thing, length: long }) => ({
        id: thing.id,
        kind: 'rigid' as const,
        closed: false,
        radius: thing.radius,
        length: long,
      })),
    ],
    ...(parts.length > 0 ? { parts } : {}),
    // a rope whose ends both lie outside its knot is taken as held there; one with an end inside, as the
    // tail of a bowline is inside its eye, makes no claim about what knot it would be with its ends joined
    topology: {
      ...(ropeEndsShareOneFace(diagram) ? { closure: 'exterior' } : {}),
      diagram: { crossings: diagram.crossings, strands: diagram.strands },
    },
    geometry: {
      frames: [
        {
          id: frame,
          realises: 'topology',
          curves: { [rope]: curve, ...Object.fromEntries(things.map(({ thing, curve: axis }) => [thing.id, axis])) },
        },
      ],
    },
  };
  if (!layout.method) return document;

  // each step of the method leaves the diagram that the shape shows when the end has come that far
  const steps: Step[] = [];
  for (const step of layout.method.steps) {
    const to = place(step.to);
    const told: Omit<Step, 'result'> = {
      id: step.id,
      op: step.op,
      actor: [rope, 'end'],
      ...(step.pass ? { pass: step.pass } : {}),
      ...(step.passes ? { passes: step.passes } : {}),
      to,
    };
    const so: Method = {
      id: layout.method.id,
      frame,
      start: layout.method.start,
      steps: [{ ...told, result: { crossings: [], strands: {} } }],
    };
    const shown = shownAt(document, so, to);
    if (!shown) throw new Error(`"${layout.id}": the shape cannot be read when the end has come to ${to}`);
    steps.push({ ...told, result: { crossings: shown.crossings, strands: shown.strands } });
  }
  return {
    ...document,
    construction: { methods: [{ id: layout.method.id, frame, start: layout.method.start, steps }] },
  };
}
