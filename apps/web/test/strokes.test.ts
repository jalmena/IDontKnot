import { diagramFromGeometry, torusKnot, torusLink, type Polyline } from '@idontknot/core';
import { describe, expect, it } from 'vitest';
import { crossingLabels, diagramStrokes, type Point2 } from '../src/diagram/strokes.ts';

const lengthOf = (points: readonly Point2[]) =>
  points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - points[i]![0], point[1] - points[i]![1]), 0);

describe('the diagram of the trefoil', () => {
  const curve = torusKnot(2, 3);
  const { visits } = diagramFromGeometry([curve]);
  const gap = 0.25;
  const strokes = diagramStrokes([curve], visits, gap);

  it('is broken once for each place where the rope passes under', () => {
    expect(strokes).toHaveLength(3);
  });

  it('loses only the gaps', () => {
    const projected = [...curve.points, curve.points[0]!].map(([x, y]): Point2 => [x, y]);
    const drawn = strokes.reduce((sum, stroke) => sum + lengthOf(stroke.points), 0);
    expect(drawn).toBeCloseTo(lengthOf(projected) - 3 * 2 * gap, 1);
  });

  it('numbers every crossing where the rope passes over it', () => {
    const labels = crossingLabels([curve], visits);
    expect(labels.map((label) => label.id)).toEqual(['c1', 'c2', 'c3']);
    for (const label of labels) expect(Math.hypot(label.at[0], label.at[1])).toBeGreaterThan(0.5);
  });
});

it('draws each loop of a link, broken only where that loop passes under', () => {
  const curves = torusLink(2, 4);
  const { visits, diagram } = diagramFromGeometry(curves);
  const strokes = diagramStrokes(curves, visits, 0.2);
  expect(strokes).toHaveLength(diagram.crossings.length);
  expect(new Set(strokes.map((stroke) => stroke.component))).toEqual(new Set(['k0', 'k1']));
  expect(crossingLabels(curves, visits)).toHaveLength(4);
});

it('draws a rope that crosses nothing as one unbroken line', () => {
  const line: Polyline = {
    id: 'a',
    closed: false,
    points: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 1, 0],
    ],
  };
  const strokes = diagramStrokes([line], { a: [] }, 0.2);
  expect(strokes).toEqual([
    {
      component: 'a',
      points: [
        [0, 0],
        [1, 0],
        [2, 1],
      ],
    },
  ]);
});

it('keeps the ends of an open rope and breaks it where it passes under', () => {
  const over: Polyline = {
    id: 'a',
    closed: false,
    points: [
      [-1, 0, 1],
      [1, 0, 1],
    ],
  };
  const under: Polyline = {
    id: 'b',
    closed: false,
    points: [
      [0, -1, 0],
      [0, 1, 0],
    ],
  };
  const { visits } = diagramFromGeometry([over, under]);
  const strokes = diagramStrokes([over, under], visits, 0.2);
  expect(strokes.filter((stroke) => stroke.component === 'a')).toHaveLength(1);
  const broken = strokes.filter((stroke) => stroke.component === 'b');
  expect(broken).toHaveLength(2);
  expect(broken[0]?.points[0]).toEqual([0, -1]);
  expect(broken[1]?.points.at(-1)).toEqual([0, 1]);
});
