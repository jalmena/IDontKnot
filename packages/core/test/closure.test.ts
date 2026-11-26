import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  closeOpenComponents,
  diagramFromGeometry,
  documentDiagram,
  framePolylines,
  jonesPolynomial,
  joinedAcross,
  type Frame,
  type KnotDocument,
} from '../src/index.ts';

const read = (id: string): KnotDocument =>
  JSON.parse(readFileSync(new URL(`../../../content/knots/${id}/knot.json`, import.meta.url), 'utf8')) as KnotDocument;
const ropeOf = (document: KnotDocument) => {
  const [rope] = framePolylines(document, document.geometry?.frames[0] as Frame);
  if (!rope) throw new Error('the document has a rope');
  return rope;
};
const jones = (document: KnotDocument, side: 'over' | 'under') => {
  const { diagram, issues } = diagramFromGeometry([joinedAcross(ropeOf(document), side)]);
  expect(issues).toEqual([]);
  return jonesPolynomial(diagram);
};

it('joins ends that lie outside the knot into the same knot over it, under it, or outside it', () => {
  for (const id of ['figure-eight', 'overhand']) {
    const document = read(id);
    const outside = jonesPolynomial(closeOpenComponents(documentDiagram(document)!));
    expect(jones(document, 'over')).toEqual(outside);
    expect(jones(document, 'under')).toEqual(outside);
  }
});

it('joins the ends of a bowline into two different knots, over it and under it', () => {
  const bowline = read('bowline');
  const [over, under] = [jones(bowline, 'over'), jones(bowline, 'under')];
  expect(over).not.toEqual(under);
  // over it, the Jones polynomial of the bowline's closure is the same read backwards: t and 1/t trade places
  for (const [exponent, coefficient] of Object.entries(over)) expect(over[String(-Number(exponent))]).toBe(coefficient);
  // both are knots: at t = 1 a knot's Jones polynomial is 1
  const at1 = (polynomial: Record<string, number>) => Object.values(polynomial).reduce((sum, value) => sum + value, 0);
  expect(at1(over)).toBe(1);
  expect(at1(under)).toBe(1);
});

it('keeps the rope as it was, and closes it', () => {
  const rope = ropeOf(read('bowline'));
  const joined = joinedAcross(rope, 'over');
  expect(joined.closed).toBe(true);
  expect(joined.points.slice(0, rope.points.length)).toEqual(rope.points);
  expect(joined.points.slice(rope.points.length).every((point) => point[2] > 10)).toBe(true);
  expect(
    joinedAcross(rope, 'under')
      .points.slice(rope.points.length)
      .every((point) => point[2] < -10),
  ).toBe(true);
});
