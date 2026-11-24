/**
 * Properties that theorems guarantee for every input, checked on generated braids,
 * and the cases the validity rules must reject.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkStructure,
  closedBraid,
  embed,
  isPlanar,
  jonesPolynomial,
  mirror,
  reverseExponents,
  torusBraidWord,
  type Diagram,
} from '../src/index.ts';

const trefoil = closedBraid([1, 1, 1], 2);

/** A braid on 2 to 4 strands with up to 7 crossings. */
const braid = fc.integer({ min: 2, max: 4 }).chain((strands) =>
  fc.record({
    strands: fc.constant(strands),
    word: fc.array(
      fc.tuple(fc.integer({ min: 1, max: strands - 1 }), fc.boolean()).map(([g, positive]) => (positive ? g : -g)),
      { maxLength: 7 },
    ),
  }),
);

describe('known values', () => {
  it('gives the right-handed trefoil t + t^3 - t^4', () => {
    expect(jonesPolynomial(trefoil)).toEqual({ '1': 1, '3': 1, '4': -1 });
  });

  it('gives the unknot 1, with or without crossings', () => {
    expect(jonesPolynomial(closedBraid([], 1))).toEqual({ '0': 1 });
    expect(jonesPolynomial(closedBraid([1], 2))).toEqual({ '0': 1 });
    expect(jonesPolynomial(closedBraid([-1], 2))).toEqual({ '0': 1 });
  });

  it('gives two unlinked circles -t^(-1/2) - t^(1/2)', () => {
    expect(jonesPolynomial(closedBraid([], 2))).toEqual({ '-1/2': -1, '1/2': -1 });
  });

  it('builds torus braid words', () => {
    expect(torusBraidWord(2, 3)).toEqual([1, 1, 1]);
    expect(torusBraidWord(3, 2)).toEqual([1, 2, 1, 2]);
  });
});

describe('validity rules', () => {
  const withSigns = (signs: (1 | -1)[]): Diagram => ({
    ...trefoil,
    crossings: trefoil.crossings.map((crossing, index) => ({ id: crossing.id, sign: signs[index] as 1 | -1 })),
  });

  it('accepts the trefoil code with all signs equal and with no other signs (rule T3)', () => {
    const planar = [1, -1].flatMap((a) => [1, -1].flatMap((b) => [1, -1].map((c) => [a, b, c] as (1 | -1)[])));
    expect(planar.filter((signs) => isPlanar(withSigns(signs)))).toEqual([
      [1, 1, 1],
      [-1, -1, -1],
    ]);
    expect(embed(withSigns([1, 1, -1])).genus).toBe(1);
  });

  it('reports a crossing that is not visited once over and once under (rule T1)', () => {
    const bothOver: Diagram = { ...trefoil, strands: { k0: trefoil.strands['k0']!.map(([c]) => [c, 'o'] as const) } };
    expect(checkStructure(bothOver).map((issue) => issue.rule)).toEqual(['T1', 'T1', 'T1']);
    const once: Diagram = { ...trefoil, strands: { k0: trefoil.strands['k0']!.slice(1) } };
    expect(checkStructure(once).some((issue) => issue.rule === 'T1' && issue.crossing === 'c1')).toBe(true);
  });

  it('reports an invalid sign (rule T2) and references to things that do not exist', () => {
    const badSign = {
      ...trefoil,
      crossings: [{ id: 'c1', sign: 0 }, ...trefoil.crossings.slice(1)],
    } as unknown as Diagram;
    expect(checkStructure(badSign).some((issue) => issue.rule === 'T2')).toBe(true);
    const stray: Diagram = { ...trefoil, strands: { ...trefoil.strands, ghost: [['c9', 'o']] } };
    expect(checkStructure(stray).filter((issue) => issue.rule === 'shape')).toHaveLength(2);
  });
});

describe('for every closed braid', () => {
  it('the diagram is valid and can be drawn on a sphere', () => {
    fc.assert(
      fc.property(braid, ({ word, strands }) => {
        const diagram = closedBraid(word, strands);
        expect(checkStructure(diagram)).toEqual([]);
        expect(embed(diagram).genus).toBe(0);
      }),
    );
  });

  it('the mirror image has the polynomial with every exponent negated', () => {
    fc.assert(
      fc.property(braid, ({ word, strands }) => {
        const diagram = closedBraid(word, strands);
        expect(jonesPolynomial(mirror(diagram))).toEqual(reverseExponents(jonesPolynomial(diagram)));
      }),
    );
  });

  it('conjugating the braid does not change the polynomial (first Markov move)', () => {
    fc.assert(
      fc.property(braid, fc.nat(), ({ word, strands }, shift) => {
        const k = word.length === 0 ? 0 : shift % word.length;
        const rotated = [...word.slice(k), ...word.slice(0, k)];
        expect(jonesPolynomial(closedBraid(rotated, strands))).toEqual(jonesPolynomial(closedBraid(word, strands)));
      }),
    );
  });

  it('adding a strand with one crossing does not change the polynomial (second Markov move)', () => {
    fc.assert(
      fc.property(braid, fc.boolean(), ({ word, strands }, positive) => {
        const stabilised = closedBraid([...word, positive ? strands : -strands], strands + 1);
        expect(jonesPolynomial(stabilised)).toEqual(jonesPolynomial(closedBraid(word, strands)));
      }),
    );
  });

  it('inserting a crossing and its inverse does not change the polynomial (Reidemeister II)', () => {
    fc.assert(
      fc.property(braid, fc.nat(), fc.nat(), ({ word, strands }, at, pick) => {
        const position = at % (word.length + 1);
        const generator = (pick % (strands - 1)) + 1;
        const longer = [...word.slice(0, position), generator, -generator, ...word.slice(position)];
        expect(jonesPolynomial(closedBraid(longer, strands))).toEqual(jonesPolynomial(closedBraid(word, strands)));
      }),
    );
  });
});
