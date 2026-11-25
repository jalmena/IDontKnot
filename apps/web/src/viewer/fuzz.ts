/**
 * The loose fibres that stand out from a rope of natural fibre: short curved hairs, each a few straight
 * pieces. They are what breaks the clean outline of the rope.
 *
 * This module is pure: it produces arrays, and knows nothing about the renderer.
 */

import type { Point3 } from '@idontknot/core';
import { curveLength, rotationMinimisingFrames } from './tube.ts';

export interface FuzzOptions {
  /** Loose fibres for each rope radius of length. */
  readonly density: number;
  /** How far the longest of them reach, in rope radii. Most are much shorter. */
  readonly reach: number;
  /** 0: they curl back on themselves. 1: they stand straight. */
  readonly stiffness: number;
  readonly seed?: number;
}

export interface FuzzData {
  /** Two ends for each straight piece of fibre, three values each. */
  readonly positions: Float32Array;
  /** One value per end: 1 where the fibre leaves the rope, 0 at its tip. */
  readonly strengths: Float32Array;
  /** Three values per end: the way the rope's surface faces where the fibre leaves it. */
  readonly facings: Float32Array;
  /** One value per end: how far along the rope the fibre is, from 0 at its start to 1 at its end. */
  readonly alongs: Float32Array;
}

/** Straight pieces in each fibre. */
export const FUZZ_PIECES = 4;

/** The same sequence every time, so that the drawing does not change from one visit to the next. */
function sequence(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

export function buildFuzz(points: readonly Point3[], closed: boolean, radius: number, options: FuzzOptions): FuzzData {
  const n = points.length;
  const frames = rotationMinimisingFrames(points, closed);
  const count = Math.round((options.density * curveLength(points, closed)) / radius);
  const random = sequence(options.seed ?? 19);
  const loose = 1 - options.stiffness;

  const positions = new Float32Array(count * FUZZ_PIECES * 6);
  const strengths = new Float32Array(count * FUZZ_PIECES * 2);
  const facings = new Float32Array(count * FUZZ_PIECES * 6);
  const alongs = new Float32Array(count * FUZZ_PIECES * 2);
  // in order along the rope, so that the fibres of the first part of it are the first so many
  const places = Array.from({ length: count }, () => random()).sort((a, b) => a - b);
  for (let fibre = 0; fibre < count; fibre++) {
    const i = Math.min(Math.floor(places[fibre]! * n), n - 1);
    const [tangent, normal, binormal] = [frames.tangents[i]!, frames.normals[i]!, frames.binormals[i]!];
    const angle = random() * 2 * Math.PI;
    const [ca, sa] = [Math.cos(angle), Math.sin(angle)];
    const outward = [0, 1, 2].map((axis) => ca * normal[axis]! + sa * binormal[axis]!);
    const round = [0, 1, 2].map((axis) => -sa * normal[axis]! + ca * binormal[axis]!);

    // it leaves the rope from just under the surface, mostly along it, and lifts away
    const start = radius * (0.82 + 0.18 * random());
    const lengthwise = (random() < 0.5 ? -1 : 1) * (0.5 + random());
    const [sideways, lift] = [(random() - 0.5) * 1.3, 0.12 + (0.25 + 0.75 * options.stiffness) * random()];
    let heading = [0, 1, 2].map(
      (axis) => lengthwise * tangent[axis]! + sideways * round[axis]! + lift * outward[axis]!,
    );
    const next = closed ? points[(i + 1) % n]! : points[Math.min(i + 1, n - 1)]!;
    const between = random();
    let here = [0, 1, 2].map(
      (axis) => points[i]![axis]! + between * (next[axis]! - points[i]![axis]!) + start * outward[axis]!,
    );
    const piece = (radius * options.reach * (0.1 + 0.9 * Math.pow(random(), 2.6))) / FUZZ_PIECES;

    for (let k = 0; k < FUZZ_PIECES; k++) {
      const size = Math.hypot(heading[0]!, heading[1]!, heading[2]!) || 1;
      const tip = here.map((x, axis) => x + (piece * heading[axis]!) / size);
      const at = (fibre * FUZZ_PIECES + k) * 2;
      positions.set(here, at * 3);
      positions.set(tip, at * 3 + 3);
      strengths[at] = 1 - k / FUZZ_PIECES;
      strengths[at + 1] = 1 - (k + 1) / FUZZ_PIECES;
      facings.set(outward, at * 3);
      facings.set(outward, at * 3 + 3);
      alongs[at] = alongs[at + 1] = (i + between) / n;
      here = tip;
      // a loose fibre bends as it goes, and tends back towards the rope
      heading = heading.map((x, axis) => x / size + loose * (1.1 * (random() - 0.5) - 0.22 * outward[axis]!));
    }
  }
  return { positions, strengths, facings, alongs };
}
