/** A knot of the library as the views need it: which of its shapes is shown, as ropes, and what the camera takes in. */

import type { Frame, FrameCurve, KnotDocument } from '@idontknot/core';
import type { RopeMaterialId } from '../viewer/materials.ts';
import type { Fit, RopeSpec } from '../viewer/RopeViewport.ts';
import { PLATE_HALF, PLATE_THICKNESS, POST_RADIUS, type SceneObject } from '../viewer/things.ts';
import { boundsOf } from './parts.ts';

/** The shape a knot is shown in: the one its method of tying is told on, or else its first. */
export function shownFrame(document: KnotDocument): Frame | undefined {
  const frames = document.geometry?.frames ?? [];
  const told = document.construction?.methods[0]?.frame;
  return frames.find((frame) => frame.id === told) ?? frames[0];
}

/** The sampled curves of a shape as ropes of one material, each loop with its own colour of it. */
export function ropesOf(document: KnotDocument, curves: readonly FrameCurve[], material: RopeMaterialId): RopeSpec[] {
  // what the rope is tied round is not rope: it is drawn as the thing it is
  return curves
    .filter((curve) => curve.kind !== 'rigid')
    .map((curve, index) => ({
      points: curve.points,
      closed: curve.closed,
      radius: document.components.find((component) => component.id === curve.id)?.radius ?? 0.5,
      material,
      index,
    }));
}

/**
 * What the ropes of a document are tied round, as it stands in a frame: each straight rigid component as a
 * post along its axis, measured in diameters of the rope.
 */
export function thingsOf(document: KnotDocument, curves: readonly FrameCurve[]): SceneObject[] {
  const rope = document.components.find((component) => component.kind === 'rope');
  const scale = 2 * (rope?.radius ?? 0.5);
  return curves.flatMap((curve): SceneObject[] => {
    const [from, to] = [curve.points[0], curve.points.at(-1)];
    if (curve.kind !== 'rigid' || !from || !to) return [];
    const axis = [to[0] - from[0], to[1] - from[1], to[2] - from[2]] as const;
    const long = Math.hypot(...axis);
    if (!(long > 0)) return [];
    return [
      {
        kind: 'post',
        at: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
        axis: [axis[0] / long, axis[1] / long, axis[2] / long],
        scale,
        length: long / scale,
      },
    ];
  });
}

/** The box the camera takes in: the curves with the thickness of a rope round them, seen from the front. */
export function fitOf(curves: readonly FrameCurve[], clear?: Fit['clear'], things: readonly SceneObject[] = []): Fit {
  // a thing the rope is tied round is framed as a thing, by `things`, not by the length of its axis
  const [minX, minY, maxX, maxY] = boundsOf(
    curves.filter((curve) => curve.kind !== 'rigid'),
    0.5,
  );
  return withThings(
    {
      centre: [(minX + maxX) / 2, (minY + maxY) / 2, 0],
      width: maxX - minX,
      height: maxY - minY,
      ...(clear ? { clear } : {}),
    },
    things,
  );
}

/**
 * A box widened to stand in the middle of a thing a knot is tied round: a hitch whose ends both leave it on
 * one side is seen with its post in the middle, as it is tied, not at the edge.
 */
export function centredOn(fit: Fit, thing: SceneObject | undefined): Fit {
  if (!thing) return fit;
  const [x, half] = [thing.at[0], fit.width / 2];
  const reach = Math.max(Math.abs(fit.centre[0] - half - x), Math.abs(fit.centre[0] + half - x));
  return { ...fit, centre: [x, fit.centre[1], fit.centre[2]], width: 2 * reach };
}

/** A box grown to take in the things the rope is tied to, as they are seen from the front. */
export function withThings(fit: Fit, things: readonly SceneObject[]): Fit {
  if (things.length === 0) return fit;
  let [minX, minY] = [fit.centre[0] - fit.width / 2, fit.centre[1] - fit.height / 2];
  let [maxX, maxY] = [fit.centre[0] + fit.width / 2, fit.centre[1] + fit.height / 2];
  for (const thing of things) {
    // a plate is seen edge on or nearly: its half side across the rope, its thickness along it; and the
    // edge of it that stands towards the eye is seen a little further out, by perspective
    const [ax, ay] = [Math.abs(thing.axis[0]), Math.abs(thing.axis[1])];
    const near = 0.5 * PLATE_HALF;
    const half =
      thing.kind === 'plate'
        ? [PLATE_HALF * ay + (PLATE_THICKNESS / 2) * ax + near, PLATE_HALF * ax + (PLATE_THICKNESS / 2) * ay + near]
        : // a post stands on past the top and the bottom of the view: only its width is framed
          [POST_RADIUS + 0.3, 0];
    minX = Math.min(minX, thing.at[0] - (half[0] as number) * thing.scale);
    maxX = Math.max(maxX, thing.at[0] + (half[0] as number) * thing.scale);
    minY = Math.min(minY, thing.at[1] - (half[1] as number) * thing.scale);
    maxY = Math.max(maxY, thing.at[1] + (half[1] as number) * thing.scale);
  }
  return { ...fit, centre: [(minX + maxX) / 2, (minY + maxY) / 2, 0], width: maxX - minX, height: maxY - minY };
}
