/**
 * The construction layer of a knot document: how the knot is tied. A method is a list of steps. Each
 * names an operation and gives the diagram that results, and a validator confirms that the result
 * follows from the state before it by that operation. See docs/spec/knot-document-model.md, section 6,
 * and decision record 0005.
 *
 * Implemented: methods shown on one frame of the document, in which the end of a rope is led along the
 * finished shape, with the operations `cross` and `tuck`. Not yet: the other operations, methods led
 * with the start of a rope, and frames of their own for steps.
 */

import { checkStructure, strandOf, type Crossing, type Diagram, type Visit } from './diagram.ts';
import {
  documentDiagram,
  framePolylines,
  identicalDiagrams,
  type DocumentIssue,
  type FrameCurve,
  type KnotDocument,
} from './document.ts';
import { isPlanar } from './embedding.ts';
import { diagramFromGeometry, type Point3 } from './geometry.ts';

export interface StepResult {
  readonly crossings: readonly Crossing[];
  readonly strands: Readonly<Record<string, readonly Visit[]>>;
}

export interface Step {
  readonly id: string;
  /** The operation. The vocabulary is in the specification; it is open. */
  readonly op: string;
  /** Which end does it: a rope of the document, and its `start` or its `end`. */
  readonly actor: readonly [component: string, end: string];
  /** For `cross`: whether the end passes over or under the strand it crosses. */
  readonly pass?: 'over' | 'under';
  /** For `tuck`: the same, for each strand of the opening in turn. */
  readonly passes?: readonly ('over' | 'under')[];
  /** How far along its rope the end has come when the step is done: a material coordinate. */
  readonly to: number;
  readonly result: StepResult;
}

export interface Method {
  readonly id: string;
  /** The frame of the document the method is shown on: the end is led along that shape. */
  readonly frame: string;
  /** How much of the rope is laid before the first step: a material coordinate. */
  readonly start: number;
  readonly steps: readonly Step[];
}

/** A curve as far as a material coordinate: what is left when the rope is cut there. */
export function cutCurve(curve: FrameCurve, to: number): FrameCurve {
  const last = curve.points.length - 1;
  if (curve.closed || to >= (curve.s[last] as number)) return curve;
  let i = 0;
  while (i < last && (curve.s[i + 1] as number) <= to) i++;
  const points = curve.points.slice(0, i + 1);
  const s = curve.s.slice(0, i + 1);
  const [from, next] = [curve.s[i] as number, curve.s[i + 1] as number];
  if (to > from && next > from) {
    const t = (to - from) / (next - from);
    const [a, b] = [curve.points[i] as Point3, curve.points[i + 1] as Point3];
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    s.push(to);
  }
  return { ...curve, points, s };
}

/**
 * The diagram a method shows when its rope has been led as far as a material coordinate: its frame, with
 * that rope cut there. Nothing, if the method names a frame or a rope the document does not have.
 */
export function shownAt(document: KnotDocument, method: Method, to: number): Diagram | null {
  const frame = document.geometry?.frames.find((candidate) => candidate.id === method.frame);
  const rope = method.steps[0]?.actor[0];
  if (!frame || rope === undefined) return null;
  const curves = framePolylines(document, frame).map((curve) => (curve.id === rope ? cutCurve(curve, to) : curve));
  const { diagram, issues } = diagramFromGeometry(curves);
  return issues.length > 0 ? null : diagram;
}

/** The diagram with some of its crossings taken away, and the visits to them. */
function withoutCrossings(diagram: Diagram, gone: ReadonlySet<string>): Diagram {
  return {
    components: diagram.components,
    crossings: diagram.crossings.filter((crossing) => !gone.has(crossing.id)),
    strands: Object.fromEntries(
      diagram.components.map((component) => [
        component.id,
        strandOf(diagram, component.id).filter(([crossing]) => !gone.has(crossing)),
      ]),
    ),
  };
}

/**
 * Checks a method of tying against the document.
 *
 * - C1: each step's result is what the method's frame shows when the end has come as far as the step says.
 * - C2: each step's result follows from the state before it by the operation the step names. For `cross`,
 *   the end has passed one more strand, over or under as said; for `tuck`, one strand for each pass given.
 *   An operation this version cannot check is noted, not refused.
 * - C3: the method ends with the whole rope laid, in the diagram of the topology layer.
 *
 * Apply `checkDocument` first.
 */
export function checkMethod(document: KnotDocument, method: Method): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const report = (rule: DocumentIssue['rule'], message: string, level: DocumentIssue['level'] = 'error'): void => {
    issues.push({ rule, level, message });
  };
  const frame = document.geometry?.frames.find((candidate) => candidate.id === method.frame);
  if (!frame) {
    report('shape', `method "${method.id}" is shown on frame "${method.frame}", which the document does not have`);
    return issues;
  }
  const [ropeId, end] = method.steps[0]?.actor ?? ['', ''];
  const rope = document.components.find((component) => component.id === ropeId);
  if (method.steps.length === 0) report('shape', `method "${method.id}" has no steps`);
  else if (!rope || rope.kind !== 'rope' || rope.closed || rope.length === undefined) {
    report('shape', `method "${method.id}" is led with "${ropeId}", which is not an open rope of known length`);
  } else if (end !== 'end') {
    report('shape', `method "${method.id}" is led with the ${end} of "${ropeId}": only the end can be led yet`);
  }
  if (issues.length > 0 || !rope) return issues;

  const ids = new Set<string>();
  let reached = method.start;
  if (!(method.start > 0)) report('shape', `method "${method.id}" must start with some rope laid`);
  for (const step of method.steps) {
    if (ids.has(step.id)) report('shape', `step "${step.id}" is declared twice`);
    ids.add(step.id);
    if (step.actor[0] !== ropeId || step.actor[1] !== end) {
      report('shape', `step "${step.id}" is done with another end than the rest of the method`);
    }
    if (!(step.to > reached)) report('shape', `step "${step.id}" does not lead the end any further`);
    reached = step.to;
  }
  if (issues.length > 0) return issues;

  const diagramOf = (result: StepResult): Diagram => ({
    components: document.components.map(({ id, kind, closed }) => ({ id, kind, closed })),
    crossings: result.crossings,
    strands: result.strands,
  });
  let before = shownAt(document, method, method.start);
  if (!before) report('C1', `the start of method "${method.id}" cannot be read from frame "${method.frame}"`);

  for (const step of method.steps) {
    const result = diagramOf(step.result);
    const structure = checkStructure(result);
    issues.push(...structure.map((issue) => ({ ...issue, level: 'error' as const })));
    if (structure.length > 0) return issues;
    if (!isPlanar(result)) report('T3', `the result of step "${step.id}" cannot be drawn on a plane`);

    const shown = shownAt(document, method, step.to);
    if (!shown || !identicalDiagrams(result, shown)) {
      report('C1', `the result of step "${step.id}" is not what frame "${method.frame}" shows at ${step.to}`);
    }

    const passes = step.op === 'cross' ? (step.pass ? [step.pass] : []) : (step.passes ?? []);
    if (step.op !== 'cross' && step.op !== 'tuck') {
      report('C2', `step "${step.id}": the operation "${step.op}" is not checked in this version`, 'note');
    } else if (passes.length === 0) {
      report('C2', `step "${step.id}" does not say whether the end passes over or under`);
    } else if (before) {
      // the end has passed these strands last, and nothing else has changed
      const led = strandOf(result, ropeId).slice(-passes.length);
      const made = new Set(led.map(([crossing]) => crossing));
      const asSaid =
        led.length === passes.length &&
        made.size === passes.length &&
        led.every(([, pass], i) => pass === (passes[i] === 'over' ? 'o' : 'u'));
      if (!asSaid || !identicalDiagrams(withoutCrossings(result, made), before)) {
        const said = passes.join(', then ');
        report('C2', `step "${step.id}" is not the end passing ${said} from the state before it`);
      }
    }
    before = result;
  }

  const finished = documentDiagram(document);
  const last = method.steps.at(-1) as Step;
  if (last.to !== rope.length) report('C3', `method "${method.id}" ends before the rope does`);
  if (finished && before && !identicalDiagrams(before, finished)) {
    report('C3', `method "${method.id}" does not end in the diagram of the topology layer`);
  }
  return issues;
}
