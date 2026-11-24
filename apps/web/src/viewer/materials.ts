/**
 * How a rope looks on screen. These are drawing styles only: they say nothing about how a real rope behaves,
 * how strong it is, or what it is suitable for.
 */

export type RopeMaterialId = 'jute' | 'kernmantle' | 'polyester' | 'sisal' | 'cotton' | 'line';

export interface RopeMaterial {
  /**
   * laid: three strands twisted together. braided: a round rope with a woven sheath.
   * smooth: a plain tube with no texture.
   */
  readonly construction: 'laid' | 'braided' | 'smooth';
  /** A colour for each loop of rope, so that the loops of a link can be told apart. */
  readonly colours: readonly string[];
  /** The colour of the yarns of a laid rope, or of the tracer threads of a braided one. */
  readonly detail: string;
  /** 0 to 1: how many loose fibres stand out from the surface. */
  readonly fuzz: number;
  /** Yarns across one strand of a laid rope, or threads round a braided one. */
  readonly yarns: number;
  /** Laid ropes only: the length of rope, in rope radii, over which a strand goes once round. */
  readonly lay: number;
  readonly roughness: number;
  /** How strongly the texture reads as relief. */
  readonly relief: number;
}

export const ROPE_MATERIALS: Readonly<Record<RopeMaterialId, RopeMaterial>> = {
  jute: {
    construction: 'laid',
    colours: ['#c8a165', '#8b5a3a', '#e4d1a2', '#5e4a39', '#a87f48'],
    detail: 'rgba(70, 44, 14, 0.2)',
    fuzz: 1,
    yarns: 5,
    lay: 11,
    roughness: 1,
    relief: 2.4,
  },
  sisal: {
    construction: 'laid',
    colours: ['#e8dcb8', '#b99c69', '#f3ecd4', '#8b7954', '#d3be8c'],
    detail: 'rgba(112, 92, 52, 0.38)',
    fuzz: 0.55,
    yarns: 9,
    lay: 7,
    roughness: 0.95,
    relief: 1.7,
  },
  polyester: {
    construction: 'laid',
    colours: ['#f5f5f1', '#2f5fa8', '#c8322f', '#26262b', '#e2b33c'],
    detail: 'rgba(60, 70, 92, 0.2)',
    fuzz: 0.04,
    yarns: 13,
    lay: 7,
    roughness: 0.5,
    relief: 0.8,
  },
  kernmantle: {
    construction: 'braided',
    colours: ['#e2552d', '#2a7fb8', '#7cb342', '#8e44ad', '#f1c40f'],
    detail: '#1d1d21',
    fuzz: 0,
    yarns: 16,
    lay: 0,
    roughness: 0.6,
    relief: 1.1,
  },
  cotton: {
    construction: 'braided',
    colours: ['#f2ede1', '#c9a867', '#9db8a0', '#c98b6b', '#9fb0c4'],
    detail: 'rgba(196, 186, 168, 1)',
    fuzz: 0.2,
    yarns: 12,
    lay: 0,
    roughness: 0.92,
    relief: 1.3,
  },
  line: {
    construction: 'smooth',
    colours: ['#f3ead3', '#d9b56c', '#a9c9b4', '#dba183', '#b4c2da'],
    detail: '',
    fuzz: 0,
    yarns: 0,
    lay: 0,
    roughness: 0.6,
    relief: 0,
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
