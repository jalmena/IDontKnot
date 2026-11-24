/**
 * From geometry to topology: a curve in space must give a diagram whose invariants do not depend
 * on how the curve is turned before it is looked at.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkStructure,
  closedBraid,
  diagramFromGeometry,
  embed,
  jonesPolynomial,
  torusBraidWord,
  torusKnot,
  type Point3,
  type Polyline,
} from '../src/index.ts';

/** Turn about the z axis by `spin`, then tip about the x axis by `tilt`. */
function turned(curve: Polyline, spin: number, tilt: number): Polyline {
  const [cs, ss, ct, st] = [Math.cos(spin), Math.sin(spin), Math.cos(tilt), Math.sin(tilt)];
  const points = curve.points.map(([x, y, z]): Point3 => {
    const [x1, y1] = [x * cs - y * ss, x * ss + y * cs];
    return [x1, y1 * ct - z * st, y1 * st + z * ct];
  });
  return { ...curve, points };
}

describe.each([
  [2, 3],
  [2, 5],
  [3, 4],
  [2, 7],
  [3, 5],
])('the (%i, %i) torus knot', (p, q) => {
  const extraction = diagramFromGeometry([torusKnot(p, q)]);
  const fromBraid = jonesPolynomial(closedBraid(torusBraidWord(p, q), p));

  it('is seen in general position', () => {
    expect(extraction.issues).toEqual([]);
  });

  it('gives a valid diagram that can be drawn on a sphere', () => {
    expect(checkStructure(extraction.diagram)).toEqual([]);
    expect(embed(extraction.diagram).genus).toBe(0);
  });

  it('has (p - 1) q crossings, all positive', () => {
    expect(extraction.diagram.crossings).toHaveLength((p - 1) * q);
    expect(extraction.diagram.crossings.every((crossing) => crossing.sign === 1)).toBe(true);
  });

  it('has the Jones polynomial of the corresponding closed braid', () => {
    expect(jonesPolynomial(extraction.diagram)).toEqual(fromBraid);
  });
});

it('gives the same polynomial however the curve is turned', () => {
  const knot = torusKnot(2, 3);
  const expected = jonesPolynomial(closedBraid([1, 1, 1], 2));
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 6.28, noNaN: true }),
      fc.double({ min: -0.6, max: 0.6, noNaN: true }),
      (spin, tilt) => {
        const extraction = diagramFromGeometry([turned(knot, spin, tilt)]);
        fc.pre(extraction.issues.length === 0);
        expect(embed(extraction.diagram).genus).toBe(0);
        expect(jonesPolynomial(extraction.diagram)).toEqual(expected);
      },
    ),
    { numRuns: 60 },
  );
});

describe('two linked circles', () => {
  const n = 48;
  const flat: Point3[] = Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * (k + 0.21)) / n;
    return [Math.cos(a), Math.sin(a), 0];
  });
  const upright: Point3[] = Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * (k + 0.43)) / n;
    return [1 + Math.cos(a), 0.5 * Math.sin(a), Math.sin(a)];
  });
  const extraction = diagramFromGeometry([
    { id: 'a', closed: true, points: flat },
    { id: 'b', closed: true, points: upright },
  ]);

  it('cross twice with the same sign', () => {
    expect(extraction.issues).toEqual([]);
    expect(extraction.diagram.crossings).toHaveLength(2);
    expect(Math.abs(extraction.diagram.crossings.reduce((sum, c) => sum + c.sign, 0))).toBe(2);
  });

  it('form a Hopf link', () => {
    const hopf = [jonesPolynomial(closedBraid([1, 1], 2)), jonesPolynomial(closedBraid([-1, -1], 2))];
    expect(hopf).toContainEqual(jonesPolynomial(extraction.diagram));
  });
});

it('reports strands that touch where they cross', () => {
  const extraction = diagramFromGeometry([
    {
      id: 'a',
      closed: false,
      points: [
        [-1, 0, 0],
        [1, 0, 0],
      ],
    },
    {
      id: 'b',
      closed: false,
      points: [
        [0, -1, 0],
        [0, 1, 0],
      ],
    },
  ]);
  expect(extraction.issues.map((issue) => issue.kind)).toEqual(['touching']);
  expect(extraction.diagram.crossings).toHaveLength(0);
});

it('reads over and under from depth', () => {
  const { diagram } = diagramFromGeometry([
    {
      id: 'a',
      closed: false,
      points: [
        [-1, 0, 1],
        [1, 0, 1],
      ],
    },
    {
      id: 'b',
      closed: false,
      points: [
        [0, -1, 0],
        [0, 1, 0],
      ],
    },
  ]);
  expect(diagram.strands).toEqual({ a: [['c1', 'o']], b: [['c1', 'u']] });
  expect(diagram.crossings).toEqual([{ id: 'c1', sign: 1 }]); // a runs along +x over b running along +y
});
