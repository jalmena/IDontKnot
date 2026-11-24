/**
 * Knot documents: the checks of the document itself and of its geometry, and the first document of the
 * library, a figure-eight knot, which must keep every rule and agree with the reference diagram.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkDocument,
  checkFrame,
  checkMethod,
  closeOpenComponents,
  documentDiagram,
  framePolylines,
  identicalDiagrams,
  jonesPolynomial,
  mirror,
  ropeEndsShareOneFace,
  sampleCurve,
  SPAN_PIECES,
  type Curve,
  type CurvePoint,
  type Diagram,
  type Frame,
  type KnotDocument,
} from '../src/index.ts';

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const knot = read('../../../content/knots/figure-eight/knot.json') as KnotDocument;
const fixtures = (
  read('../../../fixtures/topology/reference-diagrams.json') as {
    diagrams: (Diagram & { id: string; expected: { closure?: { jones: Record<string, number> } } })[];
  }
).diagrams;
const reference = (id: string) => fixtures.find((fixture) => fixture.id === id) as (typeof fixtures)[number];

const dressed = knot.geometry?.frames[0] as Frame;
const rope = dressed.curves['rope'] as Curve;
const rules = (issues: readonly { rule: string; level: string }[]) =>
  issues.filter((issue) => issue.level === 'error').map((issue) => issue.rule);
/** The figure-eight knot with the control points of its rope changed. */
const reshaped = (change: (point: CurvePoint) => CurvePoint): { document: KnotDocument; frame: Frame } => {
  const frame: Frame = { ...dressed, curves: { rope: { ...rope, points: rope.points.map(change) } } };
  return { document: { ...knot, geometry: { frames: [frame] } }, frame };
};

describe('the figure-eight knot of the library', () => {
  const diagram = documentDiagram(knot) as Diagram;

  it('is a valid document', () => {
    expect(checkDocument(knot)).toEqual([]);
  });

  it('keeps every rule of geometry: not stretched, not passing through itself, not bent too tightly', () => {
    expect(checkFrame(knot, dressed)).toEqual([]);
  });

  it('is the reference diagram of the figure-eight knot in an open rope, with other names for its crossings', () => {
    expect(identicalDiagrams(diagram, reference('figure-eight-stopper'))).toBe(true);
    expect(identicalDiagrams(diagram, reference('overhand-knot'))).toBe(false);
  });

  it('has both ends outside the knot, and closes to the figure-eight knot', () => {
    expect(ropeEndsShareOneFace(diagram)).toBe(true);
    expect(jonesPolynomial(closeOpenComponents(diagram))).toEqual(
      reference('figure-eight-stopper').expected.closure?.jones,
    );
  });

  it('names its standing part, its two loops and its tail, in that order along the rope, without overlap', () => {
    const parts = knot.parts ?? [];
    expect(parts.map((part) => part.type)).toEqual(['standing-part', 'loop', 'loop', 'tail']);
    parts.forEach((part, i) => {
      if (i > 0) expect(part.from).toBeGreaterThan((parts[i - 1] as (typeof parts)[number]).to);
    });
    expect(parts[0]?.from).toBe(0);
    expect(parts.at(-1)?.to).toBe(knot.components[0]?.length);
  });

  it('is its own mirror image turned upside down, as the figure-eight knot is', () => {
    // every control point of the rope has its opposite through the centre
    rope.points.forEach(([x, y, z], i) => {
      const [ox, oy, oz] = rope.points[rope.points.length - 1 - i] as CurvePoint;
      expect([x + ox, y + oy, z + oz]).toEqual([0, 0, 0]);
    });
  });
});

describe('every knot of the library', () => {
  const library = new URL('../../../content/knots/', import.meta.url);
  const folders = readdirSync(library, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  it.each(folders.map((folder) => folder.name))(
    '%s is a valid document, named after its folder, with valid frames and methods',
    (name) => {
      const document = read(`../../../content/knots/${name}/knot.json`) as KnotDocument;
      expect(document.id).toBe(name);
      expect(checkDocument(document)).toEqual([]);
      for (const frame of document.geometry?.frames ?? []) expect(checkFrame(document, frame)).toEqual([]);
      for (const method of document.construction?.methods ?? []) expect(checkMethod(document, method)).toEqual([]);
    },
  );
});

describe('checking a document', () => {
  const withParts = (parts: KnotDocument['parts']): KnotDocument => ({ ...knot, parts });

  it('refuses another format, and a version it cannot read', () => {
    expect(rules(checkDocument({ ...knot, format: 'something-else' }))).toEqual(['shape']);
    expect(rules(checkDocument({ ...knot, formatVersion: '1.0.0' }))).toEqual(['shape']);
    expect(rules(checkDocument({ ...knot, formatVersion: '0.9.3' }))).toEqual([]);
  });

  it('refuses identifiers that are not lowercase slugs, and ones used twice', () => {
    expect(rules(checkDocument({ ...knot, id: 'Figure Eight' }))).toEqual(['shape']);
    const twice = checkDocument({ ...knot, components: [...knot.components, ...knot.components] });
    expect(twice.some((issue) => issue.message.includes('declared twice'))).toBe(true);
  });

  it('refuses a part that is not on a rope of the document, or runs off it, or backwards', () => {
    const part = { id: 'p', component: 'rope', from: 1, to: 2, type: 'bight' };
    expect(rules(checkDocument(withParts([part])))).toEqual([]);
    expect(rules(checkDocument(withParts([{ ...part, component: 'pole' }])))).toEqual(['shape']);
    expect(rules(checkDocument(withParts([{ ...part, to: 1000 }])))).toEqual(['shape']);
    expect(rules(checkDocument(withParts([{ ...part, from: 3 }])))).toEqual(['shape']);
    expect(rules(checkDocument(withParts([part, part])))).toEqual(['shape']);
  });

  it('keeps a kind of part it does not know, and notes it', () => {
    const issues = checkDocument(withParts([{ id: 'p', component: 'rope', from: 1, to: 2, type: 'frapping-turn' }]));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('note');
  });

  it('checks the topology layer: a diagram that cannot be drawn on a plane is refused', () => {
    const virtual: KnotDocument = {
      ...knot,
      geometry: { frames: [] },
      topology: {
        diagram: {
          crossings: [
            { id: 'c1', sign: 1 },
            { id: 'c2', sign: 1 },
          ],
          strands: {
            rope: [
              ['c1', 'o'],
              ['c2', 'o'],
              ['c1', 'u'],
              ['c2', 'u'],
            ],
          },
        },
      },
    };
    expect(rules(checkDocument(virtual))).toEqual(['T3']);
  });

  it('refuses a frame without a curve for a rope, or with a curve for nothing', () => {
    const empty: Frame = { id: 'empty', curves: {} };
    expect(rules(checkDocument({ ...knot, geometry: { frames: [empty] } }))).toEqual(['shape']);
    const extra: Frame = { ...dressed, curves: { ...dressed.curves, ghost: rope } };
    expect(rules(checkDocument({ ...knot, geometry: { frames: [extra] } }))).toEqual(['shape']);
  });

  it('refuses a frame that claims to realise a topology the document does not have', () => {
    const bare: KnotDocument = {
      format: knot.format,
      formatVersion: knot.formatVersion,
      id: knot.id,
      components: knot.components,
      geometry: { frames: [dressed] },
    };
    expect(rules(checkDocument(bare))).toEqual(['shape']);
  });

  it('refuses material coordinates that go backwards, or do not cover the rope (rule G1)', () => {
    const backwards = reshaped(([x, y, z, s]) => [x, y, z, -s]);
    expect(rules(checkDocument(backwards.document))).toContain('G1');
    const short = reshaped(([x, y, z, s]) => [x, y, z, s / 2]);
    expect(rules(checkDocument(short.document))).toEqual(['G1']);
  });
});

describe('sampling a curve', () => {
  const line: Curve = {
    type: 'catmull-rom',
    points: [
      [0, 0, 0, 0],
      [3, 0, 0, 3],
      [4, 0, 0, 4],
      [9, 0, 0, 9],
    ],
  };

  it('leaves a polyline as it is', () => {
    const sampled = sampleCurve({ ...line, type: 'polyline' }, false);
    expect(sampled.points).toEqual(line.points.map(([x, y, z]) => [x, y, z]));
    expect(sampled.s).toEqual([0, 3, 4, 9]);
  });

  it('passes through every control point, at its material coordinate', () => {
    const sampled = sampleCurve(rope, false);
    expect(sampled.points).toHaveLength((rope.points.length - 1) * SPAN_PIECES + 1);
    rope.points.forEach(([x, y, z, s], i) => {
      expect(sampled.points[i * SPAN_PIECES]).toEqual([x, y, z]);
      expect(sampled.s[i * SPAN_PIECES]).toBeCloseTo(s, 9);
    });
  });

  it('advances the material coordinate with the length of the curve', () => {
    const sampled = sampleCurve(line, false);
    sampled.points.forEach((point, i) => {
      expect(point[1]).toBeCloseTo(0, 12);
      expect(point[0]).toBeCloseTo(sampled.s[i] as number, 9); // on a straight line, s is the distance along it
      if (i > 0) expect(sampled.s[i]).toBeGreaterThan(sampled.s[i - 1] as number);
    });
  });

  it('closes a closed curve: its last span returns to the first point, at the length of the rope', () => {
    const square: Curve = {
      type: 'catmull-rom',
      points: [
        [1, 1, 0, 0],
        [-1, 1, 0, 2],
        [-1, -1, 0, 4],
        [1, -1, 0, 6],
      ],
    };
    const sampled = sampleCurve(square, true, 8);
    expect(sampled.points).toHaveLength(4 * SPAN_PIECES);
    expect(sampled.s.at(-1)).toBeGreaterThan(6);
    expect(sampled.s.at(-1)).toBeLessThan(8);
    // the four spans are the same curve turned a quarter each time
    const [x, y] = sampled.points[5] as [number, number, number];
    const [u, v] = sampled.points[SPAN_PIECES + 5] as [number, number, number];
    expect([u, v]).toEqual([expect.closeTo(-y, 9), expect.closeTo(x, 9)]);
  });

  it('gives the curves of a frame in the order of the components, with their coordinates', () => {
    const curves = framePolylines(knot, dressed);
    expect(curves.map((curve) => [curve.id, curve.closed, curve.kind])).toEqual([['rope', false, 'rope']]);
    expect(curves[0]?.s).toHaveLength(curves[0]?.points.length as number);
  });
});

describe('the rules of geometry', () => {
  it('G1: reports a rope that would have to stretch', () => {
    const { document, frame } = reshaped(([x, y, z, s]) => [x * 1.2, y * 1.2, z, s]);
    expect(new Set(rules(checkFrame(document, frame)))).toEqual(new Set(['G1']));
  });

  it('G2: reports a rope that passes through itself', () => {
    const { document, frame } = reshaped(([x, y, z, s]) => [x, y, z * 0.4, s]);
    expect(rules(checkFrame(document, frame, { stretch: 0.1 }))).toEqual(['G2']);
  });

  it('G3: reports a bend tighter than the rope is thick', () => {
    const hairpin: KnotDocument = {
      ...knot,
      parts: [],
      topology: { diagram: { crossings: [], strands: { rope: [] } } },
      components: [{ id: 'rope', kind: 'rope', closed: false, radius: 0.5, length: 8.2 }],
      geometry: {
        frames: [
          {
            id: 'bent',
            curves: {
              rope: {
                type: 'polyline',
                points: [
                  [0, 0, 0, 0],
                  [4, 0, 0, 4],
                  [4.1, 0.1, 0, 4.141],
                  [4, 0.2, 0, 4.283],
                  [0, 3, 0, 8.2],
                ],
              },
            },
          },
        ],
      },
    };
    expect(rules(checkDocument(hairpin))).toEqual([]);
    expect(rules(checkFrame(hairpin, hairpin.geometry?.frames[0] as Frame, { stretch: 0.2 }))).toContain('G3');
  });

  it('G4: reports a frame that is not the diagram it claims to be', () => {
    const { document, frame } = reshaped(([x, y, z, s]) => [x, y, -z, s]); // every over becomes an under
    expect(rules(checkFrame(document, frame))).toEqual(['G4']);
    const unclaimed: Frame = { id: frame.id, curves: frame.curves };
    expect(rules(checkFrame(document, unclaimed))).toEqual([]);
  });

  it('G5: reports a view in which over and under cannot be told apart', () => {
    const { document, frame } = reshaped((point) => [point[0], point[1], 0, point[3]]);
    expect(rules(checkFrame(document, frame, { stretch: 0.1 }))).toContain('G5');
  });
});

describe('diagrams that are the same drawing', () => {
  const trefoil = reference('trefoil-right');
  const renamed = (diagram: Diagram, name: (id: string) => string): Diagram => ({
    components: diagram.components,
    crossings: diagram.crossings.map(({ id, sign }) => ({ id: name(id), sign })),
    strands: Object.fromEntries(
      Object.entries(diagram.strands).map(([id, visits]) => [id, visits.map(([c, pass]) => [name(c), pass] as const)]),
    ),
  });
  const turned = (diagram: Diagram, by: number): Diagram => ({
    ...diagram,
    strands: Object.fromEntries(
      Object.entries(diagram.strands).map(([id, visits]) => [id, [...visits.slice(by), ...visits.slice(0, by)]]),
    ),
  });

  it('are the same whatever their crossings are called', () => {
    expect(
      identicalDiagrams(
        trefoil,
        renamed(trefoil, (id) => `x-${id}`),
      ),
    ).toBe(true);
  });

  it('are the same wherever a closed rope is taken to start, but not an open one', () => {
    expect(identicalDiagrams(trefoil, turned(trefoil, 1))).toBe(true);
    expect(identicalDiagrams(trefoil, turned(trefoil, 4))).toBe(true);
    const open = reference('figure-eight-stopper');
    expect(identicalDiagrams(open, turned(open, 2))).toBe(false);
  });

  it('are not the same as their mirror image, nor as another knot', () => {
    expect(identicalDiagrams(trefoil, mirror(trefoil))).toBe(false);
    expect(identicalDiagrams(trefoil, reference('trefoil-left'))).toBe(false);
    expect(identicalDiagrams(trefoil, reference('figure-eight'))).toBe(false);
  });
});
