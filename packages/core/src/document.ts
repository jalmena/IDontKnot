/**
 * Knot documents: the self-contained description of one rope configuration.
 * See docs/spec/knot-document-model.md.
 *
 * Implemented here: components, parts, the topology layer, and geometry frames with their curves and the
 * rules they must keep (G1 to G5). Not yet: shapes of rigid objects, the construction layer, the JSON Schema.
 */

import { checkStructure, type Component, type Crossing, type Diagram, type Issue, type Visit } from './diagram.ts';
import type { Method } from './construction.ts';
import { isPlanar } from './embedding.ts';
import { diagramFromGeometry, type Point3, type Polyline } from './geometry.ts';

export const KNOT_FORMAT = 'idk-knot';
export const KNOT_FORMAT_VERSION = '0.1.0';

export interface DocumentComponent extends Component {
  /** Half the thickness of the rope. Lengths are in diameters of the reference rope, so this is usually 0.5. */
  readonly radius?: number;
  /** The length of the rope: the material coordinate of its end. */
  readonly length?: number;
}

/** A stretch of rope with a name, located by material coordinate. */
export interface Part {
  readonly id: string;
  readonly component: string;
  readonly from: number;
  readonly to: number;
  readonly type: string;
}

/** The kinds of part the specification names. The list is open: another value is kept, and noted. */
export const PART_TYPES = ['standing-part', 'working-end', 'bight', 'loop', 'turn', 'eye', 'tail'] as const;

/** A control point of a curve: where it is, and which point of the rope it is. */
export type CurvePoint = readonly [x: number, y: number, z: number, s: number];

export interface Curve {
  /** `polyline`, or `catmull-rom`: centripetal, passing through its points. */
  readonly type: string;
  readonly points: readonly CurvePoint[];
}

/** One configuration in space. */
export interface Frame {
  readonly id: string;
  /** Says that seen from +z this frame is exactly the diagram of the topology layer. */
  readonly realises?: 'topology';
  readonly curves: Readonly<Record<string, Curve>>;
}

export interface Topology {
  readonly closure?: string;
  readonly diagram: {
    readonly crossings: readonly Crossing[];
    readonly strands: Readonly<Record<string, readonly Visit[]>>;
  };
}

export interface KnotDocument {
  readonly format: string;
  readonly formatVersion: string;
  readonly id: string;
  readonly components: readonly DocumentComponent[];
  readonly parts?: readonly Part[];
  readonly topology?: Topology;
  readonly geometry?: {
    readonly frames: readonly Frame[];
    /** The frames the knot passes through as it is tightened, by id: from the one it is tied in to the tightest. */
    readonly tightening?: readonly string[];
  };
  readonly construction?: { readonly methods: readonly Method[] };
}

export interface DocumentIssue {
  readonly rule: Issue['rule'] | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'C1' | 'C2' | 'C3';
  /** A note records something a reader should know that breaks no rule. */
  readonly level: 'error' | 'note';
  readonly message: string;
  readonly component?: string;
  readonly crossing?: string;
  readonly part?: string;
  readonly frame?: string;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEFAULT_RADIUS = 0.5;

/** The diagram of the topology layer, with the components of the document. */
export function documentDiagram(document: KnotDocument): Diagram | null {
  if (!document.topology) return null;
  return {
    components: document.components.map(({ id, kind, closed, ends }) =>
      ends ? { id, kind, closed, ends } : { id, kind, closed },
    ),
    crossings: document.topology.diagram.crossings,
    strands: document.topology.diagram.strands,
  };
}

/**
 * Checks what can be checked without sampling curves: identifiers, references between the parts of the
 * document, the material coordinates of parts and control points, and the topology layer (rules T1 to T3).
 * A document with no errors can be given to the other functions of this module.
 */
export function checkDocument(document: KnotDocument): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const error = (message: string, where: Partial<DocumentIssue> = {}): void => {
    issues.push({ rule: 'shape', level: 'error', message, ...where });
  };

  if (document.format !== KNOT_FORMAT) error(`the format is "${document.format}", not "${KNOT_FORMAT}"`);
  const major = (version: string): string => version.split('.')[0] ?? '';
  if (major(document.formatVersion) !== major(KNOT_FORMAT_VERSION)) {
    error(`format version ${document.formatVersion} cannot be read: this is ${KNOT_FORMAT_VERSION}`);
  }
  if (!SLUG.test(document.id)) error(`"${document.id}" is not a lowercase identifier`);

  const components = new Map<string, DocumentComponent>();
  for (const component of document.components) {
    const where = { component: component.id };
    if (!SLUG.test(component.id)) error(`"${component.id}" is not a lowercase identifier`, where);
    if (components.has(component.id)) error(`component "${component.id}" is declared twice`, where);
    components.set(component.id, component);
    if (component.radius !== undefined && !(component.radius > 0)) error('the radius must be positive', where);
    if (component.length !== undefined && !(component.length > 0)) error('the length must be positive', where);
  }

  const parts = new Set<string>();
  for (const part of document.parts ?? []) {
    const where = { part: part.id, component: part.component };
    if (!SLUG.test(part.id)) error(`"${part.id}" is not a lowercase identifier`, where);
    if (parts.has(part.id)) error(`part "${part.id}" is declared twice`, where);
    parts.add(part.id);
    const component = components.get(part.component);
    if (!component) {
      error(`part "${part.id}" is on "${part.component}", which is not a component`, where);
      continue;
    }
    if (component.kind !== 'rope') error(`part "${part.id}" is on "${part.component}", which is not a rope`, where);
    if (component.length === undefined) {
      error(`part "${part.id}" needs the length of "${part.component}"`, where);
    } else if (!(part.from >= 0 && part.from < part.to && part.to <= component.length)) {
      error(`part "${part.id}" does not run forward within the rope: ${part.from} to ${part.to}`, where);
    }
    if (!(PART_TYPES as readonly string[]).includes(part.type)) {
      issues.push({
        rule: 'shape',
        level: 'note',
        message: `"${part.type}" is not a kind of part this version knows`,
        ...where,
      });
    }
  }

  const diagram = documentDiagram(document);
  if (diagram) {
    const structure = checkStructure(diagram);
    issues.push(...structure.map((issue) => ({ ...issue, level: 'error' as const })));
    if (structure.length === 0 && !isPlanar(diagram)) {
      issues.push({ rule: 'T3', level: 'error', message: 'the diagram cannot be drawn on a plane' });
    }
  }

  const frames = new Set<string>();
  for (const frame of document.geometry?.frames ?? []) {
    const inFrame = { frame: frame.id };
    if (!SLUG.test(frame.id)) error(`"${frame.id}" is not a lowercase identifier`, inFrame);
    if (frames.has(frame.id)) error(`frame "${frame.id}" is declared twice`, inFrame);
    frames.add(frame.id);
    if (frame.realises !== undefined && !document.topology) {
      error(`frame "${frame.id}" says it realises a topology the document does not have`, inFrame);
    }
    for (const component of document.components) {
      if (component.kind === 'rope' && !frame.curves[component.id]) {
        error(`frame "${frame.id}" has no curve for "${component.id}"`, { ...inFrame, component: component.id });
      }
    }
    for (const [id, curve] of Object.entries(frame.curves)) {
      const where = { ...inFrame, component: id };
      const stretched = (message: string): void => {
        issues.push({ rule: 'G1', level: 'error', message, ...where });
      };
      const component = components.get(id);
      if (!component) {
        error(`frame "${frame.id}" has a curve for "${id}", which is not a component`, where);
        continue;
      }
      if (curve.type !== 'polyline' && curve.type !== 'catmull-rom') {
        error(`curves of type "${curve.type}" cannot be read`, where);
      }
      if (curve.points.length < (component.closed ? 3 : 2)) {
        error(`the curve of "${id}" has too few points`, where);
        continue;
      }
      const coordinates = curve.points.map((point) => point[3]);
      if (coordinates.some((s, i) => i > 0 && !(s > (coordinates[i - 1] as number)))) {
        stretched(`along "${id}" the material coordinate does not increase`);
      }
      if (component.closed) {
        if (component.length === undefined) error(`the closed curve of "${id}" needs the length of the rope`, where);
        else if (!((coordinates.at(-1) as number) < component.length)) {
          stretched(`the curve of "${id}" is longer than the rope`);
        }
      } else if (component.length !== undefined) {
        if (coordinates[0] !== 0 || coordinates.at(-1) !== component.length) {
          stretched(`the curve of "${id}" does not run from one end of the rope to the other`);
        }
      }
    }
  }

  const tightening = document.geometry?.tightening;
  if (tightening) {
    if (tightening.length < 2) error('a tightening needs the frame the knot is tied in and its tightest frame');
    for (const id of tightening) {
      if (!frames.has(id)) error(`the tightening names frame "${id}", which the document does not have`, { frame: id });
    }
  }
  return issues;
}

/** A curve as the polyline every algorithm works on, with the material coordinate of each of its points. */
export interface SampledCurve {
  readonly points: readonly Point3[];
  readonly s: readonly number[];
}

/** Into how many pieces each span of a Catmull-Rom curve is cut. Part of the definition of the format. */
export const SPAN_PIECES = 12;

const distance = (a: Point3, b: Point3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** A point of the centripetal Catmull-Rom span from p1 to p2, by the Barry and Goldman construction. */
function spanPoint(p0: Point3, p1: Point3, p2: Point3, p3: Point3, fraction: number): Point3 {
  const t1 = Math.sqrt(distance(p0, p1)) || 1e-9;
  const t2 = t1 + (Math.sqrt(distance(p1, p2)) || 1e-9);
  const t3 = t2 + (Math.sqrt(distance(p2, p3)) || 1e-9);
  const t = t1 + fraction * (t2 - t1);
  const mix = (a: Point3, b: Point3, ta: number, tb: number): Point3 => {
    const w = (t - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
  };
  const a1 = mix(p0, p1, 0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  return mix(mix(a1, a2, 0, t2), mix(a2, a3, t1, t3), t1, t2);
}

function mirrored(end: Point3, next: Point3): Point3 {
  return [2 * end[0] - next[0], 2 * end[1] - next[1], 2 * end[2] - next[2]];
}

/**
 * The polyline of a curve. A `polyline` is its own points. Each span of a `catmull-rom` curve is cut into
 * SPAN_PIECES pieces of equal parameter; at an open end the missing neighbour is the mirror image of the
 * next point. Between two control points the material coordinate advances with the length of the polyline.
 * A closed curve needs the length of its rope, which is the coordinate at which it meets its start again.
 */
export function sampleCurve(curve: Curve, closed: boolean, length?: number): SampledCurve {
  const control = curve.points.map((point): Point3 => [point[0], point[1], point[2]]);
  const coordinate = curve.points.map((point) => point[3]);
  const n = control.length;
  if (curve.type !== 'catmull-rom' || n < 2) return { points: control, s: coordinate };

  const at = (i: number): Point3 => {
    if (closed) return control[((i % n) + n) % n] as Point3;
    if (i < 0) return mirrored(control[0] as Point3, control[1] as Point3);
    if (i >= n) return mirrored(control[n - 1] as Point3, control[n - 2] as Point3);
    return control[i] as Point3;
  };
  const points: Point3[] = [];
  const s: number[] = [];
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const pieces: Point3[] = [control[i] as Point3];
    for (let k = 1; k <= SPAN_PIECES; k++) {
      pieces.push(spanPoint(at(i - 1), at(i), at(i + 1), at(i + 2), k / SPAN_PIECES));
    }
    let total = 0;
    for (let k = 1; k <= SPAN_PIECES; k++) total += distance(pieces[k - 1] as Point3, pieces[k] as Point3);
    const from = coordinate[i] as number;
    const to = i + 1 < n ? (coordinate[i + 1] as number) : (length ?? from);
    let run = 0;
    for (let k = 0; k < SPAN_PIECES; k++) {
      points.push(pieces[k] as Point3);
      s.push(from + ((to - from) * run) / (total || 1));
      run += distance(pieces[k] as Point3, pieces[k + 1] as Point3);
    }
  }
  if (!closed) {
    points.push(control[n - 1] as Point3);
    s.push(coordinate[n - 1] as number);
  }
  return { points, s };
}

export interface FrameCurve extends Polyline {
  readonly s: readonly number[];
}

/** The curves of a frame as polylines, in the order of the document's components. */
export function framePolylines(document: KnotDocument, frame: Frame): FrameCurve[] {
  return document.components.flatMap((component) => {
    const curve = frame.curves[component.id];
    if (!curve) return [];
    const sampled = sampleCurve(curve, component.closed, component.length);
    return [{ id: component.id, kind: component.kind, closed: component.closed, points: sampled.points, s: sampled.s }];
  });
}

/**
 * Whether two diagrams are the same drawing with other names for their crossings: the same components,
 * each passing over and under in the same order, at crossings of the same signs. A closed component may
 * start anywhere along itself.
 */
export function identicalDiagrams(a: Diagram, b: Diagram): boolean {
  if (a.components.length !== b.components.length || a.crossings.length !== b.crossings.length) return false;
  for (const component of a.components) {
    const other = b.components.find((candidate) => candidate.id === component.id);
    if (!other || other.closed !== component.closed || other.kind !== component.kind) return false;
    if ((a.strands[component.id] ?? []).length !== (b.strands[component.id] ?? []).length) return false;
  }
  const signA = new Map(a.crossings.map((crossing) => [crossing.id, crossing.sign]));
  const signB = new Map(b.crossings.map((crossing) => [crossing.id, crossing.sign]));

  // try each way of starting the closed components of b; an open one can start in one place only
  const match = (index: number, names: ReadonlyMap<string, string>, used: ReadonlySet<string>): boolean => {
    const component = a.components[index];
    if (!component) return true;
    const strandA = a.strands[component.id] ?? [];
    const strandB = b.strands[component.id] ?? [];
    const starts = component.closed && strandB.length > 0 ? strandB.length : 1;
    for (let start = 0; start < starts; start++) {
      const nextNames = new Map(names);
      const nextUsed = new Set(used);
      const fits = strandA.every(([crossing, pass], k) => {
        const [otherCrossing, otherPass] = strandB[(k + start) % strandB.length] as Visit;
        if (pass !== otherPass || signA.get(crossing) !== signB.get(otherCrossing)) return false;
        const named = nextNames.get(crossing);
        if (named !== undefined) return named === otherCrossing;
        if (nextUsed.has(otherCrossing)) return false;
        nextNames.set(crossing, otherCrossing);
        nextUsed.add(otherCrossing);
        return true;
      });
      if (fits && match(index + 1, nextNames, nextUsed)) return true;
    }
    return false;
  };
  return match(0, new Map(), new Set());
}

export interface FrameTolerances {
  /** How far the length of a span may differ from its difference in material coordinate, as a fraction. */
  readonly stretch?: number;
  /** How far two ropes may sink into each other, and a bend be tighter than the rope, as a fraction. */
  readonly squeeze?: number;
}

/**
 * Checks a frame against the rules of the geometry layer: the rope is not stretched (G1), does not pass
 * through itself or another rope (G2), is not bent tighter than its own radius (G3), is the declared
 * diagram when seen from +z (G4), and is seen in general position (G5). Apply `checkDocument` first.
 */
export function checkFrame(document: KnotDocument, frame: Frame, tolerances: FrameTolerances = {}): DocumentIssue[] {
  const stretch = tolerances.stretch ?? 0.02;
  const squeeze = tolerances.squeeze ?? 0.05;
  const issues: DocumentIssue[] = [];
  const report = (rule: DocumentIssue['rule'], message: string, component?: string): void => {
    issues.push({ rule, level: 'error', message, frame: frame.id, ...(component ? { component } : {}) });
  };
  const radiusOf = (id: string): number =>
    document.components.find((component) => component.id === id)?.radius ?? DEFAULT_RADIUS;
  const lengthOf = (id: string): number | undefined =>
    document.components.find((component) => component.id === id)?.length;
  const curves = framePolylines(document, frame);

  for (const curve of curves) {
    const control = frame.curves[curve.id]?.points ?? [];
    const radius = radiusOf(curve.id);
    const count = curve.points.length;
    const segments = curve.closed ? count : count - 1;

    // G1, span by span: the samples of a span are those between two control points
    const perSpan = frame.curves[curve.id]?.type === 'catmull-rom' ? SPAN_PIECES : 1;
    for (let span = 0; span * perSpan < segments; span++) {
      let run = 0;
      for (let k = 0; k < perSpan; k++) {
        const i = span * perSpan + k;
        run += distance(curve.points[i] as Point3, curve.points[(i + 1) % count] as Point3);
      }
      const from = (control[span] as CurvePoint)[3];
      const to = control[span + 1]?.[3] ?? lengthOf(curve.id) ?? from;
      if (Math.abs(run - (to - from)) > stretch * Math.max(to - from, radius)) {
        report(
          'G1',
          `between ${from} and ${to} "${curve.id}" is ${run.toFixed(3)} long: the rope would stretch`,
          curve.id,
        );
      }
    }

    // G3: the circle through three neighbouring points is the bend of the rope there
    let tightest = Infinity;
    for (let i = curve.closed ? 0 : 1; i < (curve.closed ? count : count - 1); i++) {
      const p = curve.points[(i - 1 + count) % count] as Point3;
      const q = curve.points[i] as Point3;
      const w = curve.points[(i + 1) % count] as Point3;
      const [ab, bc, ca] = [distance(p, q), distance(q, w), distance(w, p)];
      const semi = (ab + bc + ca) / 2;
      const area = Math.sqrt(Math.max(semi * (semi - ab) * (semi - bc) * (semi - ca), 0));
      if (area > 1e-12) tightest = Math.min(tightest, (ab * bc * ca) / (4 * area));
    }
    if (tightest < radius * (1 - squeeze)) {
      report('G3', `"${curve.id}" bends to a radius of ${tightest.toFixed(3)}, tighter than its own radius`, curve.id);
    }
  }

  // G2: points that are not neighbours along a rope keep their distance
  for (let a = 0; a < curves.length; a++) {
    for (let b = a; b < curves.length; b++) {
      const first = curves[a] as FrameCurve;
      const second = curves[b] as FrameCurve;
      const reach = radiusOf(first.id) + radiusOf(second.id);
      const length = lengthOf(first.id) ?? Infinity;
      let closest = Infinity;
      for (let i = 0; i < first.points.length; i++) {
        for (let j = a === b ? i + 1 : 0; j < second.points.length; j++) {
          if (a === b) {
            const apart = Math.abs((first.s[i] as number) - (first.s[j] as number));
            const along = first.closed ? Math.min(apart, length - apart) : apart;
            if (along < Math.PI * reach) continue; // neighbours: closer than one tightest turn of the rope
          }
          closest = Math.min(closest, distance(first.points[i] as Point3, second.points[j] as Point3));
        }
      }
      if (closest < reach * (1 - squeeze)) {
        const who =
          a === b ? `"${first.id}" passes through itself` : `"${first.id}" and "${second.id}" pass through each other`;
        report('G2', `${who}: their centerlines come within ${closest.toFixed(3)}`, first.id);
      }
    }
  }

  const extraction = diagramFromGeometry(curves);
  for (const issue of extraction.issues) report('G5', issue.message);
  const declared = documentDiagram(document);
  if (frame.realises === 'topology' && declared && extraction.issues.length === 0) {
    if (!identicalDiagrams(declared, extraction.diagram)) {
      report('G4', `seen from +z, frame "${frame.id}" is not the diagram of the topology layer`);
    }
  }
  return issues;
}
