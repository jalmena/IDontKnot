/** A knot of the library as the views need it: which of its shapes is shown, as ropes, and what the camera takes in. */

import type { Frame, FrameCurve, KnotDocument } from '@idontknot/core';
import type { RopeMaterialId } from '../viewer/materials.ts';
import type { Fit, RopeSpec } from '../viewer/RopeViewport.ts';
import { boundsOf } from './parts.ts';

/** The shape a knot is shown in: the one its method of tying is told on, or else its first. */
export function shownFrame(document: KnotDocument): Frame | undefined {
  const frames = document.geometry?.frames ?? [];
  const told = document.construction?.methods[0]?.frame;
  return frames.find((frame) => frame.id === told) ?? frames[0];
}

/** The sampled curves of a shape as ropes of one material, each loop with its own colour of it. */
export function ropesOf(document: KnotDocument, curves: readonly FrameCurve[], material: RopeMaterialId): RopeSpec[] {
  return curves.map((curve, index) => ({
    points: curve.points,
    closed: curve.closed,
    radius: document.components.find((component) => component.id === curve.id)?.radius ?? 0.5,
    material,
    index,
  }));
}

/** The box the camera takes in: the curves with the thickness of a rope round them, seen from the front. */
export function fitOf(curves: readonly FrameCurve[], clear?: Fit['clear']): Fit {
  const [minX, minY, maxX, maxY] = boundsOf(curves, 0.5);
  const box = { centre: [(minX + maxX) / 2, (minY + maxY) / 2, 0], width: maxX - minX, height: maxY - minY } as const;
  return clear ? { ...box, clear } : box;
}
