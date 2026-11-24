/**
 * How a rope looks on screen. These are drawing styles only: they say nothing about how a real rope behaves,
 * how strong it is, or what it is suitable for.
 */

import type { FuzzOptions } from './fuzz.ts';
import type { BraidedSurface, LaidSurface } from './surface.ts';

export type RopeMaterialId = 'jute' | 'kernmantle' | 'polyester' | 'sisal' | 'cotton' | 'line';

interface Look {
  /** A colour for each loop of rope, so that the loops of a link can be told apart. */
  readonly colours: readonly string[];
  /** The loose fibres that stand out from the rope, if it has any. */
  readonly fuzz: FuzzOptions | null;
  /** 0 to 1: the soft light that fine fibres give the edges of a rope. */
  readonly sheen: number;
  /** How strongly the relief of the surface reads. */
  readonly relief: number;
  /** 0 to 1: how much the surface shines. Natural fibre hardly does. */
  readonly gloss: number;
  /** How light the rope is drawn: 1 leaves its colours as they are. */
  readonly brightness: number;
}

/** Three strands twisted together. */
export interface LaidMaterial extends Look {
  readonly construction: 'laid';
  /** The length of rope, in rope radii, over which a strand goes once round. */
  readonly lay: number;
  /** The length of rope, in rope radii, covered by one repeat of the surface. */
  readonly repeat: number;
  /** 0 to 1: how much darker and paler than the rope's colour single fibres are. */
  readonly contrast: number;
  readonly surface: Omit<LaidSurface, 'twist' | 'arc'>;
}

/** A round rope with a woven sheath. */
export interface BraidedMaterial extends Look {
  readonly construction: 'braided';
  readonly repeat: number;
  /** The colours of the carriers that are not the rope's own colour, in the order the surface names them. */
  readonly tracers: readonly string[];
  readonly surface: BraidedSurface;
}

/** A plain tube with no texture. */
export interface SmoothMaterial extends Look {
  readonly construction: 'smooth';
  readonly roughness: number;
}

export type RopeMaterial = LaidMaterial | BraidedMaterial | SmoothMaterial;

export const ROPE_MATERIALS: Readonly<Record<RopeMaterialId, RopeMaterial>> = {
  // treated jute: singed and oiled, so compact, golden brown, with a short fine fuzz
  jute: {
    construction: 'laid',
    colours: ['#a8835a', '#7d2b27', '#3b322c', '#3f5179', '#cdb48e'],
    fuzz: { density: 70, reach: 0.5, stiffness: 0.5 },
    sheen: 0.35,
    relief: 1,
    gloss: 0.15,
    brightness: 1,
    lay: 5,
    repeat: 4,
    contrast: 0.55,
    surface: {
      yarns: 6,
      fibres: 8,
      staple: 10,
      yarnRelief: 0.07,
      fibreRelief: 0.02,
      depth: 0.58,
      unevenness: 0.7,
      variety: 0.55,
      roughness: 0.92,
    },
  },
  sisal: {
    construction: 'laid',
    colours: ['#e3d9c0', '#b99c69', '#f1ebd8', '#8b7954', '#cdb98a'],
    fuzz: { density: 12, reach: 1.1, stiffness: 0.92 },
    sheen: 0.25,
    relief: 1,
    gloss: 0.3,
    brightness: 1,
    lay: 6.4,
    repeat: 4,
    contrast: 0.32,
    surface: {
      yarns: 5,
      fibres: 8,
      staple: 8,
      yarnRelief: 0.04,
      fibreRelief: 0.035,
      depth: 0.4,
      unevenness: 1,
      variety: 0.5,
      roughness: 0.85,
    },
  },
  polyester: {
    construction: 'laid',
    colours: ['#f4f4f0', '#2f5fa8', '#c8322f', '#26262b', '#e2b33c'],
    fuzz: null,
    sheen: 0.35,
    relief: 1,
    gloss: 1,
    brightness: 1,
    lay: 6.8,
    repeat: 4,
    contrast: 0.2,
    surface: {
      yarns: 16,
      fibres: 5,
      staple: 2,
      yarnRelief: 0.02,
      fibreRelief: 0.004,
      depth: 0.32,
      unevenness: 0.3,
      variety: 0.14,
      roughness: 0.45,
    },
  },
  kernmantle: {
    construction: 'braided',
    colours: ['#e8641e', '#2a7fb8', '#7cb342', '#8e44ad', '#f1c40f'],
    fuzz: null,
    sheen: 0.25,
    relief: 1,
    gloss: 0.8,
    brightness: 1,
    repeat: 5,
    tracers: ['#23232a', '#f3ecd9'],
    surface: {
      carriers: 20,
      crossings: 10,
      over: 2,
      ends: 3,
      fibres: 4,
      relief: 0.035,
      fibreRelief: 0.006,
      depth: 0.6,
      cover: 0.95,
      ply: 0,
      variety: 0.25,
      roughness: 0.58,
      warp: [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5],
      weft: [0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    },
  },
  cotton: {
    construction: 'braided',
    colours: ['#f2ede1', '#c9a867', '#9db8a0', '#c98b6b', '#9fb0c4'],
    fuzz: { density: 60, reach: 0.22, stiffness: 0.35 },
    sheen: 0.8,
    relief: 1,
    gloss: 0.1,
    brightness: 1,
    repeat: 3.75,
    tracers: [],
    surface: {
      carriers: 12,
      crossings: 6,
      over: 2,
      ends: 2,
      fibres: 5,
      relief: 0.07,
      fibreRelief: 0.02,
      depth: 0.38,
      cover: 1,
      ply: 3,
      variety: 0.3,
      roughness: 0.95,
      warp: [0],
      weft: [0],
    },
  },
  line: {
    construction: 'smooth',
    colours: ['#f3ead3', '#d9b56c', '#a9c9b4', '#dba183', '#b4c2da'],
    fuzz: null,
    sheen: 0,
    relief: 0,
    gloss: 1,
    brightness: 1,
    roughness: 0.38,
  },
};

export const ROPE_MATERIAL_IDS = Object.keys(ROPE_MATERIALS) as RopeMaterialId[];

/** The rope each discipline is drawn with, unless another is chosen. */
export const ROPE_OF_DISCIPLINE: Readonly<Record<string, RopeMaterialId>> = {
  shibari: 'jute',
  climbing: 'kernmantle',
  nautical: 'polyester',
  pioneering: 'sisal',
  decorative: 'cotton',
  theory: 'line',
};

/** The colour of the loop with this index, cycling when there are more loops than colours. */
export function ropeColour(material: RopeMaterialId, index: number): string {
  const { colours } = ROPE_MATERIALS[material];
  return colours[index % colours.length] as string;
}
