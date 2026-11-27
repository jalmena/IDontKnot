/**
 * The construction layer: a method of tying is checked step by step against the shape it is shown on
 * and against the operation each step names.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkMethod,
  cutCurve,
  framePolylines,
  ledBy,
  shownAt,
  type Frame,
  type KnotDocument,
  type Method,
  type Step,
} from '../src/index.ts';

const knot = JSON.parse(
  readFileSync(new URL('../../../content/knots/figure-eight/knot.json', import.meta.url), 'utf8'),
) as KnotDocument;
const method = knot.construction?.methods[0] as Method;
const length = knot.components[0]?.length as number;
const rules = (issues: readonly { rule: string; level: string }[]) =>
  issues.filter((issue) => issue.level === 'error').map((issue) => issue.rule);
/** The method with one of its steps changed. */
const withStep = (index: number, change: (step: Step) => Step): Method => ({
  ...method,
  steps: method.steps.map((step, i) => (i === index ? change(step) : step)),
});

describe('the way the figure-eight knot of the library is tied', () => {
  it('is valid: every step is what the shape shows, follows from the one before, and the last is the knot', () => {
    expect(checkMethod(knot, method)).toEqual([]);
  });

  it('leads the end over the standing part, then under it, then through the loop', () => {
    expect(method.steps.map((step) => [step.op, step.pass ?? step.passes])).toEqual([
      ['cross', 'over'],
      ['cross', 'under'],
      ['tuck', ['over', 'under']],
    ]);
    expect(method.steps.map((step) => step.result.crossings.length)).toEqual([1, 2, 4]);
    expect(method.steps.at(-1)?.to).toBe(length);
  });

  it('starts with rope laid and nothing crossed', () => {
    expect(shownAt(knot, method, method.start)?.crossings).toEqual([]);
  });
});

describe('cutting a rope at a material coordinate', () => {
  const curve = framePolylines(knot, knot.geometry?.frames[0] as Frame)[0]!;

  it('keeps the rope up to there, and ends exactly there', () => {
    const cut = cutCurve(curve, 20.5);
    expect(cut.s.at(-1)).toBe(20.5);
    expect(cut.points).toHaveLength(cut.s.length);
    expect(cut.points.slice(0, -1)).toEqual(curve.points.slice(0, cut.points.length - 1));
    const [before, after] = [curve.points[cut.points.length - 2]!, curve.points[cut.points.length - 1]!];
    const end = cut.points.at(-1)!;
    // the new end lies between the two points of the rope it was cut between
    for (const axis of [0, 1, 2] as const) {
      expect(end[axis]).toBeGreaterThanOrEqual(Math.min(before[axis], after[axis]) - 1e-9);
      expect(end[axis]).toBeLessThanOrEqual(Math.max(before[axis], after[axis]) + 1e-9);
    }
  });

  it('leaves the rope whole when cut at its end or beyond', () => {
    expect(cutCurve(curve, length)).toBe(curve);
    expect(cutCurve(curve, length + 10)).toBe(curve);
  });

  it('gains crossings only as the end passes strands', () => {
    const counts = [5, 15, 25, 33, 35, 45, 56, length].map((to) => shownAt(knot, method, to)?.crossings.length);
    expect(counts).toEqual([0, 0, 0, 0, 1, 2, 3, 4]);
  });
});

describe('checking a method', () => {
  it('C1: refuses a step whose result is not what the shape shows there', () => {
    // the first step said to stop before the end has reached the standing part
    expect(
      rules(
        checkMethod(
          knot,
          withStep(0, (step) => ({ ...step, to: 30 })),
        ),
      ),
    ).toContain('C1');
    // or with a result that has a crossing too many
    const tooMany = withStep(0, (step) => ({ ...step, result: method.steps[1]!.result }));
    expect(rules(checkMethod(knot, tooMany))).toContain('C1');
  });

  it('C2: refuses a step that says over where the end passes under, and the other way round', () => {
    expect(
      rules(
        checkMethod(
          knot,
          withStep(0, (step) => ({ ...step, pass: 'under' })),
        ),
      ),
    ).toEqual(['C2']);
    expect(
      rules(
        checkMethod(
          knot,
          withStep(1, (step) => ({ ...step, pass: 'over' })),
        ),
      ),
    ).toEqual(['C2']);
    const swapped = withStep(2, (step) => ({ ...step, passes: ['under', 'over'] }));
    expect(rules(checkMethod(knot, swapped))).toEqual(['C2']);
  });

  it('C2: refuses a step that passes more strands than its operation says', () => {
    const asOne = withStep(2, (step) => ({ ...step, op: 'cross', pass: 'under' }));
    expect(rules(checkMethod(knot, asOne))).toEqual(['C2']);
    const unsaid = withStep(0, (step) => ({
      id: step.id,
      op: step.op,
      actor: step.actor,
      to: step.to,
      result: step.result,
    }));
    expect(rules(checkMethod(knot, unsaid))).toEqual(['C2']);
  });

  it('C2: notes an operation it cannot check, without refusing it', () => {
    const issues = checkMethod(
      knot,
      withStep(1, (step) => ({ ...step, op: 'arrange' })),
    );
    expect(rules(issues)).toEqual([]);
    expect(issues.map((issue) => [issue.rule, issue.level])).toEqual([['C2', 'note']]);
  });

  it('C3: refuses a method that stops before the knot is finished', () => {
    const unfinished: Method = { ...method, steps: method.steps.slice(0, 2) };
    expect(new Set(rules(checkMethod(knot, unfinished)))).toEqual(new Set(['C3']));
  });

  it('refuses steps that go backwards, a frame it does not have, and an end it cannot lead', () => {
    expect(
      rules(
        checkMethod(
          knot,
          withStep(1, (step) => ({ ...step, to: 20 })),
        ),
      ),
    ).toEqual(['shape']);
    expect(rules(checkMethod(knot, { ...method, frame: 'loose' }))).toEqual(['shape']);
    const fromStart: Method = {
      ...method,
      steps: method.steps.map((step) => ({ ...step, actor: ['rope', 'start'] as const })),
    };
    expect(rules(checkMethod(knot, fromStart))).toEqual(['shape']);
    expect(rules(checkMethod(knot, { ...method, steps: [] }))).toEqual(['shape']);
  });
});

describe('a method led by the bight: the single column tie of the library', () => {
  const tie = JSON.parse(
    readFileSync(new URL('../../../content/knots/single-column-tie/knot.json', import.meta.url), 'utf8'),
  ) as KnotDocument;
  const withBight = tie.construction?.methods[0] as Method;
  const half = (tie.components[0]?.length as number) / 2;

  it('is led by the bight, and its steps take the bight as far as the middle of the rope', () => {
    expect(ledBy(withBight)).toBe('bight');
    expect(withBight.steps.every((step) => step.actor[1] === 'bight')).toBe(true);
    // to the thousandth it is written to
    expect(Math.abs((withBight.steps.at(-1)?.to as number) - half)).toBeLessThanOrEqual(5e-4 + 1e-9);
    expect(rules(checkMethod(tie, withBight))).toEqual([]);
  });

  it('lays the rope from both its ends at once: more is laid, and more crossed, the further the bight has come', () => {
    const crossings = [withBight.start, ...withBight.steps.map((step) => step.to)].map(
      (to) => shownAt(tie, withBight, to)?.crossings.length ?? -1,
    );
    expect(crossings.every((count, i) => i === 0 || count > (crossings[i - 1] as number))).toBe(true);
    // and with the bight at the middle, the whole rope is laid: the knot as the document has it
    const whole = shownAt(tie, withBight, half);
    expect(whole?.crossings.length).toBe(tie.topology?.diagram.crossings.length);
  });
});
