/**
 * The construction layer of a knot document: how the knot is tied. A method is a list of steps. Each
 * names an operation and gives the diagram that results, and a validator confirms that the result
 * follows from the state before it by that operation. See docs/spec/knot-document-model.md, section 6,
 * and decision record 0005.
 *
 * Implemented: methods shown on one frame of the document, in which the end of a rope is led along the
 * finished shape, or its bight, the middle of the rope doubled, leading both halves together; with the
 * operations `cross` and `tuck`. Not yet: the other operations, methods led with the start of a rope, and
 * frames of their own for steps.
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
  /**
   * What does it: a rope of the document, and its `end`; or its `bight`, the middle of the rope doubled,
   * which leads the two halves of the rope side by side, the rope laid from both its ends towards its
   * middle.
   */
  readonly actor: readonly [component: string, end: string];
  /**
   * For `cross`: whether the end passes over or under the strand it crosses. Led by the bight, each half
   * passes so.
   */
  readonly pass?: 'over' | 'under';
  /** For `tuck`: the same, for each strand of the opening in turn. */
  readonly passes?: readonly ('over' | 'under')[];
  /**
   * How far along its rope the end has come when the step is done: a material coordinate. Led by the
   * bight, how far from each end of the rope: the rope is laid that far from both.
   */
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

/** A curve from a material coordinate on: what is left of the rope beyond a cut there. */
export function curveFrom(curve: FrameCurve, from: number): FrameCurve {
  const last = curve.points.length - 1;
  if (curve.closed || from <= (curve.s[0] as number)) return curve;
  let i = last;
  while (i > 0 && (curve.s[i - 1] as number) >= from) i--;
  const points = curve.points.slice(i);
  const s = curve.s.slice(i);
  const [before, at] = [curve.s[i - 1] as number, curve.s[i] as number];
  if (i > 0 && from < at && at > before) {
    const t = (from - before) / (at - before);
    const [a, b] = [curve.points[i - 1] as Point3, curve.points[i] as Point3];
    points.unshift([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    s.unshift(from);
  }
  return { ...curve, points, s };
}

/** What leads a method: the `end` of its rope, or its `bight`. */
export function ledBy(method: Method): 'end' | 'bight' {
  return method.steps[0]?.actor[1] === 'bight' ? 'bight' : 'end';
}

/**
 * The diagram a method shows when its rope has been led as far as a material coordinate, and how many visits
 * of the rope are on its first stretch: the frame, with the rope cut there; or, led by the bight, with the
 * rope laid that far from each end, the visits of the stretch from its start before those of the stretch to
 * its end.
 */
function laidAt(document: KnotDocument, method: Method, to: number): { diagram: Diagram; first: number } | null {
  const frame = document.geometry?.frames.find((candidate) => candidate.id === method.frame);
  const rope = method.steps[0]?.actor[0];
  if (!frame || rope === undefined) return null;
  const curves = framePolylines(document, frame);
  const whole = curves.find((curve) => curve.id === rope);
  if (!whole) return null;
  const others = curves.filter((curve) => curve.id !== rope);
  if (ledBy(method) === 'end') {
    const { diagram, issues } = diagramFromGeometry([cutCurve(whole, to), ...others]);
    return issues.length > 0 ? null : { diagram, first: strandOf(diagram, rope).length };
  }
  const length = whole.s[whole.s.length - 1] as number;
  const other = `${rope}\u0000`;
  const { diagram, issues } = diagramFromGeometry([
    cutCurve(whole, to),
    { ...curveFrom(whole, length - to), id: other },
    ...others,
  ]);
  if (issues.length > 0) return null;
  const [start, end] = [strandOf(diagram, rope), strandOf(diagram, other)];
  return {
    diagram: {
      components: diagram.components.filter((component) => component.id !== other),
      crossings: diagram.crossings,
      strands: {
        ...Object.fromEntries(Object.entries(diagram.strands).filter(([id]) => id !== other)),
        [rope]: [...start, ...end],
      },
    },
    first: start.length,
  };
}

/**
 * The diagram a method shows when its rope has been led as far as a material coordinate: its frame, with
 * that rope cut there, or laid that far from each end when the bight leads. Nothing, if the method names a
 * frame or a rope the document does not have.
 */
export function shownAt(document: KnotDocument, method: Method, to: number): Diagram | null {
  return laidAt(document, method, to)?.diagram ?? null;
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
  } else if (end !== 'end' && end !== 'bight') {
    report(
      'shape',
      `method "${method.id}" is led with the ${end} of "${ropeId}": only the end or the bight can be led yet`,
    );
  }
  if (issues.length > 0 || !rope) return issues;
  // led by the bight, the rope is laid from both ends until they meet in its middle
  const bight = end === 'bight';
  const whole = bight ? (rope.length as number) / 2 : (rope.length as number);

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

    const laid = laidAt(document, method, step.to);
    const shown = laid?.diagram;
    if (!shown || !identicalDiagrams(result, shown)) {
      report('C1', `the result of step "${step.id}" is not what frame "${method.frame}" shows at ${step.to}`);
    }

    const passes = step.op === 'cross' ? (step.pass ? [step.pass] : []) : (step.passes ?? []);
    if (step.op !== 'cross' && step.op !== 'tuck') {
      report('C2', `step "${step.id}": the operation "${step.op}" is not checked in this version`, 'note');
    } else if (passes.length === 0) {
      report('C2', `step "${step.id}" does not say whether the end passes over or under`);
    } else if (before && laid) {
      // the end has passed these strands last, and nothing else has changed; led by the bight, each half
      // has passed them, the half from the start of the rope last along it and the half from its end first
      const strand = strandOf(result, ropeId);
      const k = passes.length;
      const halves = bight
        ? [strand.slice(Math.max(laid.first - k, 0), laid.first), strand.slice(laid.first, laid.first + k).reverse()]
        : [strand.slice(-k)];
      const made = new Set(halves.flat().map(([crossing]) => crossing));
      const asSaid =
        halves.every(
          (led) => led.length === k && led.every(([, pass], i) => pass === (passes[i] === 'over' ? 'o' : 'u')),
        ) && made.size === k * halves.length;
      if (!asSaid || !identicalDiagrams(withoutCrossings(result, made), before)) {
        const said = passes.join(', then ');
        const who = bight ? 'the bight' : 'the end';
        report('C2', `step "${step.id}" is not ${who} passing ${said} from the state before it`);
      }
    }
    before = result;
  }

  const finished = documentDiagram(document);
  const last = method.steps.at(-1) as Step;
  if (Math.abs(last.to - whole) > 1e-9) report('C3', `method "${method.id}" ends before the rope does`);
  if (finished && before && !identicalDiagrams(before, finished)) {
    report('C3', `method "${method.id}" does not end in the diagram of the topology layer`);
  }
  return issues;
}
