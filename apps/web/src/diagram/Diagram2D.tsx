import type { PlacedVisit, Point3, Polyline } from '@idontknot/core';
import { useMemo } from 'react';
import { crossingLabels, diagramStrokes } from './strokes.ts';

/** A name written on the drawing, at a point of the plane. */
export interface DiagramName {
  readonly id: string;
  readonly text: string;
  readonly at: readonly [x: number, y: number];
  readonly marked: boolean;
  /** Which part of the writing is at `at`: its middle unless said otherwise. */
  readonly anchor?: 'start' | 'middle' | 'end';
}

interface Props {
  readonly curves: readonly Polyline[];
  readonly visits: Readonly<Record<string, readonly PlacedVisit[]>>;
  /** The colour of each curve, in the order of `curves`. */
  readonly colours: readonly string[];
  /** What the picture shows, for people who cannot see it. */
  readonly label: string;
  /** The part of the plane to show. Without it, a square that suits the torus knots of the laboratory. */
  readonly bounds?: readonly [minX: number, minY: number, maxX: number, maxY: number];
  /** The width of the lines, and the size of the writing, in the units of the drawing. */
  readonly line?: number;
  readonly text?: number;
  /** Stretches of rope to bring out, as their centerlines. */
  readonly marked?: readonly (readonly Point3[])[];
  readonly names?: readonly DiagramName[];
}

const LINE = 0.13;
const TEXT = 0.34;
const HALF = 3.3;
const path = (points: readonly (readonly number[])[]): string =>
  points.map((point) => `${(point[0] as number).toFixed(3)},${(point[1] as number).toFixed(3)}`).join(' ');

/** The knot diagram: every rope as a line, broken where it passes under, with its crossings numbered. */
export function Diagram2D({ curves, visits, colours, label, bounds, line = LINE, text = TEXT, marked, names }: Props) {
  const strokes = useMemo(() => diagramStrokes(curves, visits, line * 1.9), [curves, visits, line]);
  const [minX, minY, maxX, maxY] = bounds ?? [-HALF, -HALF, HALF, HALF];
  const labels = useMemo(
    () => crossingLabels(curves, visits, [(minX + maxX) / 2, (minY + maxY) / 2]),
    [curves, visits, minX, minY, maxX, maxY],
  );
  const colourOf = new Map(curves.map((curve, index) => [curve.id, colours[index % colours.length] ?? '#fff']));

  return (
    <svg
      className="diagram"
      viewBox={`${minX} ${-maxY} ${maxX - minX} ${maxY - minY}`}
      role="img"
      aria-label={label}
      data-testid="diagram"
    >
      {/* the geometry has y upward; a drawing has y downward */}
      <g transform="scale(1 -1)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {marked?.map((points, index) => (
          <polyline key={index} className="diagram__marked" strokeWidth={line * 3.4} points={path(points)} />
        ))}
        {strokes.map((stroke, index) => (
          <polyline
            key={index}
            stroke={colourOf.get(stroke.component)}
            strokeWidth={line}
            points={path(stroke.points)}
          />
        ))}
      </g>
      {labels.map((crossing) => (
        <text
          key={crossing.id}
          className="diagram__label"
          x={crossing.at[0] + (line + 0.62 * text) * crossing.clear[0]}
          y={-(crossing.at[1] + (line + 0.62 * text) * crossing.clear[1])}
          fontSize={text}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {crossing.id.slice(1)}
        </text>
      ))}
      {names?.map((name) => (
        <text
          key={name.id}
          className={name.marked ? 'diagram__name diagram__name--marked' : 'diagram__name'}
          x={name.at[0]}
          y={-name.at[1]}
          fontSize={text}
          textAnchor={name.anchor ?? 'middle'}
        >
          {name.text}
        </text>
      ))}
    </svg>
  );
}
