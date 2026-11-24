import type { PlacedVisit, Polyline } from '@idontknot/core';
import { useMemo } from 'react';
import { crossingLabels, diagramStrokes } from './strokes.ts';

interface Props {
  readonly curves: readonly Polyline[];
  readonly visits: Readonly<Record<string, readonly PlacedVisit[]>>;
  /** The colour of each curve, in the order of `curves`. */
  readonly colours: readonly string[];
  /** What the picture shows, for people who cannot see it. */
  readonly label: string;
}

const LINE = 0.13;
const HALF = 3.3;

/** The knot diagram: every rope as a line, broken where it passes under, with its crossings numbered. */
export function Diagram2D({ curves, visits, colours, label }: Props) {
  const strokes = useMemo(() => diagramStrokes(curves, visits, LINE * 1.9), [curves, visits]);
  const labels = useMemo(() => crossingLabels(curves, visits), [curves, visits]);
  const colourOf = new Map(curves.map((curve, index) => [curve.id, colours[index % colours.length] ?? '#fff']));

  return (
    <svg
      className="diagram"
      viewBox={`${-HALF} ${-HALF} ${2 * HALF} ${2 * HALF}`}
      role="img"
      aria-label={label}
      data-testid="diagram"
    >
      {/* the geometry has y upward; a drawing has y downward */}
      <g transform="scale(1 -1)" fill="none" strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round">
        {strokes.map((stroke, index) => (
          <polyline
            key={index}
            stroke={colourOf.get(stroke.component)}
            points={stroke.points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ')}
          />
        ))}
      </g>
      {labels.map((crossing) => {
        // push the number away from the centre, clear of the lines
        const reach = Math.hypot(crossing.at[0], crossing.at[1]) || 1;
        const x = crossing.at[0] + (0.34 * crossing.at[0]) / reach;
        const y = -(crossing.at[1] + (0.34 * crossing.at[1]) / reach);
        return (
          <text key={crossing.id} className="diagram__label" x={x} y={y} textAnchor="middle" dominantBaseline="central">
            {crossing.id.slice(1)}
          </text>
        );
      })}
    </svg>
  );
}
