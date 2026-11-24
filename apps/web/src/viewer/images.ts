/**
 * Which images each rope is drawn with: the computed surface of its material, and the colours that surface
 * is painted with for each loop. Pure: it runs in a worker, so that computing them does not hold the page.
 */

import type { LaidMaterial, RopeMaterial } from './materials.ts';
import { braidedSurface, laidSurface, type Rgb, type Surface } from './surface.ts';
import { LAID_ARC, strandPlace } from './tube.ts';

const TAU = 2 * Math.PI;
const STRANDS = 3;

export function rgbOf(colour: string): Rgb {
  const value = Number.parseInt(colour.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** The colour moved towards black (amount below 0) or towards white (above 0). */
export function toned(colour: Rgb, amount: number): Rgb {
  const target = amount < 0 ? 0 : 255;
  const mix = Math.abs(amount);
  return [0, 1, 2].map((c) => colour[c]! + (target - colour[c]!) * mix) as unknown as Rgb;
}

/**
 * How many times the yarns of a strand go round it in one repeat of the surface, so that on the outside of
 * the rope they run along it, as they do on laid rope: the yarns are twisted the opposite way to the strands.
 */
export function yarnTwist(material: LaidMaterial): number {
  const { offset, size } = strandPlace(STRANDS);
  const slope = (TAU * offset) / material.lay; // of a strand to the rope
  const alongStrand = material.repeat * Math.hypot(1, slope);
  return Math.max(1, Math.round((material.surface.yarns * alongStrand * slope) / (TAU * size)));
}

/** The computed surface of a material, or nothing for a smooth one. */
export function surfaceOf(material: RopeMaterial): Surface | null {
  if (material.construction === 'laid') {
    const across = LAID_ARC * strandPlace(STRANDS).size;
    return laidSurface(
      { ...material.surface, twist: yarnTwist(material), arc: LAID_ARC },
      [material.repeat, across],
      1024,
      512,
    );
  }
  if (material.construction === 'braided') return braidedSurface(material.surface, [material.repeat, TAU], 1024, 1024);
  return null;
}

/** The colours a surface is painted with, from the place its `tint` calls 0 to the place it calls 1. */
export function rampOf(material: RopeMaterial, colour: string): Rgb[] {
  const base = rgbOf(colour);
  if (material.construction === 'laid') {
    return [toned(base, -0.5 * material.contrast), base, toned(base, 0.45 * material.contrast)];
  }
  if (material.construction === 'braided') return [base, ...material.tracers.map(rgbOf)];
  return [base];
}
