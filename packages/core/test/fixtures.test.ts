/**
 * The core must reproduce every expected value of the reference diagrams. Those values were produced
 * offline and cross-checked against independent software (see tools/oracle).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkStructure,
  closeOpenComponents,
  embed,
  joinComponents,
  jonesPolynomial,
  ropeEndsShareOneFace,
  strandOf,
  withoutComponents,
  writhe,
  type Diagram,
} from '../src/index.ts';

interface Expected {
  readonly crossingCount: number;
  readonly writhe: number;
  readonly componentCount: number;
  readonly jones?: Record<string, number>;
  readonly connected?: boolean;
  readonly endsShareOneFace?: boolean;
  readonly closure?: {
    readonly jones: Record<string, number>;
    readonly crossingCount: number;
    readonly writhe: number;
  };
  readonly ropeAloneClosureJones?: Record<string, number>;
  readonly ropeObjectCrossingSignSum?: Record<string, number>;
}

interface Fixture extends Diagram {
  readonly id: string;
  readonly class: string;
  readonly expected: Expected;
}

const file = new URL('../../../fixtures/topology/reference-diagrams.json', import.meta.url);
const fixtures = (JSON.parse(readFileSync(file, 'utf8')) as { diagrams: Fixture[] }).diagrams;

/** The closed diagram each open fixture's "closure" values refer to. */
function closureOf(fixture: Fixture): Diagram {
  return fixture.class === 'bend'
    ? joinComponents(fixture, [{ component: 'a' }, { component: 'b', reversed: true }])
    : closeOpenComponents(fixture);
}

it('finds all the reference diagrams', () => {
  expect(fixtures).toHaveLength(21);
});

describe.each(fixtures.map((fixture) => [fixture.id, fixture] as const))('%s', (_id, fixture) => {
  const closed = fixture.components.every((component) => component.closed);

  it('is structurally valid', () => {
    expect(checkStructure(fixture)).toEqual([]);
  });

  it('can be drawn on a sphere', () => {
    expect(embed(fixture).genus).toBe(0);
  });

  it('has the expected size and writhe', () => {
    expect(fixture.crossings).toHaveLength(fixture.expected.crossingCount);
    expect(fixture.components).toHaveLength(fixture.expected.componentCount);
    expect(writhe(fixture)).toBe(fixture.expected.writhe);
  });

  it.runIf(closed)('has the expected Jones polynomial', () => {
    expect(jonesPolynomial(fixture)).toEqual(fixture.expected.jones);
  });

  it.runIf(!closed)('has its rope ends in one face, or not, as expected', () => {
    expect(ropeEndsShareOneFace(fixture)).toBe(fixture.expected.endsShareOneFace);
    if (fixture.expected.connected !== undefined) expect(embed(fixture).pieces === 1).toBe(fixture.expected.connected);
  });

  it.runIf(fixture.expected.closure !== undefined)('closes to a diagram with the expected Jones polynomial', () => {
    const closure = closureOf(fixture);
    expect(checkStructure(closure)).toEqual([]);
    expect(embed(closure).genus).toBe(0);
    expect(closure.crossings).toHaveLength(fixture.expected.closure?.crossingCount as number);
    expect(writhe(closure)).toBe(fixture.expected.closure?.writhe);
    expect(jonesPolynomial(closure)).toEqual(fixture.expected.closure?.jones);
  });

  it.runIf(fixture.expected.ropeAloneClosureJones !== undefined)('is no knot once its object is removed', () => {
    const ropeAlone = closeOpenComponents(withoutComponents(fixture, ['pole']));
    expect(jonesPolynomial(ropeAlone)).toEqual(fixture.expected.ropeAloneClosureJones);

    const onPole = new Set(strandOf(fixture, 'pole').map(([crossing]) => crossing));
    const signSum = fixture.crossings.filter((c) => onPole.has(c.id)).reduce((sum, c) => sum + c.sign, 0);
    expect(signSum).toBe(fixture.expected.ropeObjectCrossingSignSum?.['rope|pole']);
  });
});

it('gives the reef knot and the thief knot the same diagram', () => {
  const reef = fixtures.find((fixture) => fixture.id === 'reef-knot') as Fixture;
  const thief = fixtures.find((fixture) => fixture.id === 'thief-knot') as Fixture;
  expect(thief.crossings).toEqual(reef.crossings);
  expect(thief.strands).toEqual(reef.strands);
  expect(thief.components).not.toEqual(reef.components); // only the roles of the ends differ
});

it('cannot tell the cinquefoil from 10_132 by the Jones polynomial', () => {
  const cinquefoil = fixtures.find((fixture) => fixture.id === 'cinquefoil') as Fixture;
  const other = fixtures.find((fixture) => fixture.id === 'knot-10-132') as Fixture;
  const mirrored = Object.fromEntries(
    Object.entries(jonesPolynomial(other)).map(([exponent, coefficient]) => [String(-Number(exponent)), coefficient]),
  );
  expect(mirrored).toEqual(jonesPolynomial(cinquefoil));
});
