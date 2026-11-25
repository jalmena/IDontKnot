/**
 * Tightening: the shapes a rope passes through as its knot is drawn tight, and the frames of the library
 * that hold them. The figure-eight knot is tightened once here, and everything is asked of that one run.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkDocument,
  checkFrame,
  framePolylines,
  TIGHT_FRAME,
  tighten,
  tighteningFrames,
  type Frame,
  type KnotDocument,
  type Point3,
} from '../src/index.ts';

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const knot = read('../../../content/knots/figure-eight/knot.json') as KnotDocument;
const frames = knot.geometry?.frames ?? [];
const dressed = frames.find((frame) => frame.id === knot.geometry?.tightening?.[0]) as Frame;
const [curve] = framePolylines(knot, dressed);
if (!curve) throw new Error('the figure-eight knot has a rope');
const { radius = 0.5, length = 0 } = knot.components[0] ?? {};

const between = (a: Point3, b: Point3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const tightening = tighten(curve.points, curve.s, radius);
const made = tighteningFrames(knot, dressed);

describe('tightening a rope', () => {
  it('keeps the shapes on the way, and the tightest last', () => {
    expect(tightening.shapes).toHaveLength(7);
    expect(tighten(curve.points, curve.s, radius, { keep: 2 }).shapes).toHaveLength(3);
  });

  it('does not stretch the rope: its particles stay at their distances along it', () => {
    for (const shape of tightening.shapes) {
      expect(shape).toHaveLength(Math.round(length / tightening.spacing) + 1);
      for (let i = 1; i < shape.length; i++) {
        expect(between(shape[i - 1] as Point3, shape[i] as Point3)).toBeCloseTo(tightening.spacing, 2);
      }
    }
  });

  it('gives the rope of the knot to its two ends, a little more with each shape', () => {
    const span = (shape: readonly Point3[]): number => between(shape[0] as Point3, shape.at(-1) as Point3);
    const spans = [between(curve.points[0] as Point3, curve.points.at(-1) as Point3), ...tightening.shapes.map(span)];
    for (let k = 1; k < spans.length; k++) expect(spans[k]).toBeGreaterThan(spans[k - 1] as number);
    // tied loosely, the ends are twenty diameters apart; tight, the knot keeps less than a third of the rope
    expect(spans.at(-1)).toBeGreaterThan((2 / 3) * length);
  });

  it('leaves no two strands nearer than they can be, in any shape', () => {
    const neighbours = Math.round((Math.PI * 2 * radius) / tightening.spacing);
    for (const shape of tightening.shapes) {
      let nearest = Infinity;
      for (let i = 0; i < shape.length; i++) {
        for (let j = i + neighbours; j < shape.length; j++) {
          nearest = Math.min(nearest, between(shape[i] as Point3, shape[j] as Point3));
        }
      }
      expect(nearest).toBeGreaterThan(0.98 * 2 * radius);
    }
  });
});

describe('the frames of a tightening', () => {
  it('are frames that keep every rule, and the tightest is still the knot', () => {
    expect(made.map((frame) => frame.id)).toEqual([
      'tightening-1',
      'tightening-2',
      'tightening-3',
      'tightening-4',
      'tightening-5',
      'tightening-6',
      TIGHT_FRAME,
    ]);
    const document = { ...knot, geometry: { frames: [dressed, ...made] } };
    for (const frame of made) expect(checkFrame(document, frame)).toEqual([]);
    // seen from the front, the tight knot is the same diagram as the knot it was tied as
    expect(made.at(-1)?.realises).toBe('topology');
    expect(made.slice(0, -1).every((frame) => frame.realises === undefined)).toBe(true);
  });

  it('are the ones the library holds: its file is what the tool writes', () => {
    expect(knot.geometry?.tightening).toEqual([dressed.id, ...made.map((frame) => frame.id)]);
    for (const frame of made) {
      const held = frames.find((candidate) => candidate.id === frame.id);
      expect(held?.realises).toBe(frame.realises);
      const [mine, theirs] = [frame.curves['rope']?.points ?? [], held?.curves['rope']?.points ?? []];
      expect(theirs).toHaveLength(mine.length);
      mine.forEach((point, i) => {
        for (let c = 0; c < 4; c++) expect(theirs[i]?.[c]).toBeCloseTo(point[c] as number, 2);
      });
    }
  });

  it('are not made for a document that is not one open rope', () => {
    const [rope] = knot.components;
    if (!rope) throw new Error('the figure-eight knot has a rope');
    expect(tighteningFrames({ ...knot, components: [{ ...rope, closed: true }] }, dressed)).toEqual([]);
    expect(tighteningFrames({ ...knot, components: [rope, { ...rope, id: 'other' }] }, dressed)).toEqual([]);
  });

  it('must be frames of the document, and at least the first and the last', () => {
    const rules = (document: KnotDocument) => checkDocument(document).map((issue) => issue.rule);
    expect(rules(knot)).toEqual([]);
    expect(rules({ ...knot, geometry: { frames, tightening: [dressed.id, 'missing'] } })).toEqual(['shape']);
    expect(rules({ ...knot, geometry: { frames, tightening: [dressed.id] } })).toEqual(['shape']);
  });
});
