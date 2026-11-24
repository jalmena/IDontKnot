/**
 * The surface of a rope as images, computed rather than photographed: for each point how high it stands,
 * how light it is, which of the rope's colours it has, how much of the sky it sees and how rough it is.
 *
 * Laid rope gets the face of one strand: yarns twisted the opposite way to the strands, each made of
 * fibres. Braided rope gets its sheath: carriers going both ways round it, passing over and under each
 * other. Every image repeats exactly along the rope, and the braided one round it too.
 *
 * This module is pure: it produces arrays, and knows nothing about the renderer.
 */

const TAU = 2 * Math.PI;

/** A shade of this value leaves the colour as it is; higher values are highlights. */
export const SHADE_UNIT = 200;

export interface Surface {
  /** Texels along the rope. */
  readonly width: number;
  /** Texels across the strand, or round the rope. */
  readonly height: number;
  /** One value per texel: how light the surface is there, with SHADE_UNIT for "as the colour is". */
  readonly shade: Uint8Array;
  /** One value per texel: where along the rope's colours it is, from the first (0) to the last (255). */
  readonly tint: Uint8Array;
  /** Four values per texel: the direction the surface faces, as a tangent-space normal. */
  readonly normal: Uint8Array;
  /** Four values per texel: the first is how open it is to light from all round, the second how rough. */
  readonly detail: Uint8Array;
}

interface Texel {
  height: number;
  shade: number;
  tint: number;
  open: number;
  rough: number;
}

const frac = (x: number): number => x - Math.floor(x);
const mod = (i: number, n: number): number => ((i % n) + n) % n;
const clamp = (x: number, low = 0, high = 1): number => Math.min(Math.max(x, low), high);
const byte = (x: number): number => Math.round(clamp(x, 0, 255));
const smooth = (from: number, to: number, x: number): number => {
  const t = clamp((x - from) / (to - from));
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The value at a corner of the grid that the noise is smoothed from. */
function corner(cx: number, cy: number, seed: number, px: number, py: number, shift: number): number {
  const turn = Math.floor(cy / py);
  const lx = cx - turn * shift;
  return hash(px > 0 ? mod(lx, px) : lx, cy - turn * py, seed);
}

/**
 * Smooth noise between 0 and 1 that repeats: every `py` in y, and every `px` in x when `px` is not 0.
 * With `shift`, going once round in y also moves it `shift` along x, as a thread does on a screw.
 */
function noise(x: number, y: number, seed: number, px: number, py: number, shift: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = corner(ix, iy, seed, px, py, shift);
  const b = corner(ix + 1, iy, seed, px, py, shift);
  const c = corner(ix, iy + 1, seed, px, py, shift);
  const d = corner(ix + 1, iy + 1, seed, px, py, shift);
  const low = a + (b - a) * sx;
  const high = c + (d - c) * sx;
  return low + (high - low) * sy;
}

/** Fills the images from a function of the place across (0 to 1) and along (0 to 1) the surface. */
function render(
  width: number,
  height: number,
  /** How much rope the image covers, along and across, in rope radii: it sets how steep the relief is. */
  extent: readonly [number, number],
  wrapsAcross: boolean,
  sample: (across: number, along: number, out: Texel) => void,
): Surface {
  const count = width * height;
  const heights = new Float32Array(count);
  const shade = new Uint8Array(count);
  const tint = new Uint8Array(count);
  const normal = new Uint8Array(count * 4);
  const detail = new Uint8Array(count * 4);
  const out: Texel = { height: 0, shade: 1, tint: 0, open: 1, rough: 1 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      sample((y + 0.5) / height, (x + 0.5) / width, out);
      const k = y * width + x;
      heights[k] = out.height;
      shade[k] = byte(out.shade * SHADE_UNIT);
      tint[k] = byte(out.tint * 255);
      detail[4 * k] = byte(out.open * 255);
      detail[4 * k + 1] = byte(out.rough * 255);
      detail[4 * k + 3] = 255;
    }
  }
  const [stepAlong, stepAcross] = [extent[0] / width, extent[1] / height];
  for (let y = 0; y < height; y++) {
    const above = wrapsAcross ? mod(y - 1, height) : Math.max(y - 1, 0);
    const below = wrapsAcross ? mod(y + 1, height) : Math.min(y + 1, height - 1);
    const rows = wrapsAcross ? 2 : below - above;
    for (let x = 0; x < width; x++) {
      const dx = (heights[y * width + ((x + 1) % width)]! - heights[y * width + mod(x - 1, width)]!) / (2 * stepAlong);
      const dy = (heights[below * width + x]! - heights[above * width + x]!) / (rows * stepAcross);
      const length = Math.hypot(dx, dy, 1);
      const k = 4 * (y * width + x);
      normal[k] = byte((-dx / length) * 127.5 + 127.5);
      normal[k + 1] = byte((-dy / length) * 127.5 + 127.5);
      normal[k + 2] = byte((1 / length) * 127.5 + 127.5);
      normal[k + 3] = 255;
    }
  }
  return { width, height, shade, tint, normal, detail };
}

export interface LaidSurface {
  /** Yarns round one strand. */
  readonly yarns: number;
  /** Fibres across one yarn. */
  readonly fibres: number;
  /** Whole turns the yarns make round the strand in one repeat of the image. */
  readonly twist: number;
  /** How many times along one repeat a fibre changes: low for long smooth filaments, high for short rough fibre. */
  readonly staple: number;
  /** How much of the way round the strand the image covers, in radians, centred on its outer side. */
  readonly arc: number;
  /** How deep the grooves between yarns are, and how far single fibres stand out, in rope radii. */
  readonly yarnRelief: number;
  readonly fibreRelief: number;
  /** 0 to 1: how dark the grooves between yarns are. */
  readonly depth: number;
  /** 0 to 1: how much yarns and fibres wander. */
  readonly unevenness: number;
  /** 0 to 1: how much fibres differ in lightness and colour. */
  readonly variety: number;
  readonly roughness: number;
}

/**
 * The face of one strand of laid rope. Across the image is round the strand, with its outer side in the
 * middle and the grooves where it meets its neighbours at the edges, which are darker.
 */
export function laidSurface(look: LaidSurface, extent: readonly [number, number], width = 1024, height = 512): Surface {
  const { yarns, fibres, twist, staple, depth, unevenness, variety } = look;
  // most fibres follow their yarn; on a rough rope some have worked loose and lie at an angle to the rest
  const layers = [
    { turns: twist, density: fibres, weight: 1 },
    { turns: twist - 2, density: Math.max(fibres - 2, 2), weight: 0.55 * unevenness },
    { turns: twist + 3, density: Math.max(fibres - 3, 2), weight: 0.45 * unevenness },
  ].filter((layer) => layer.weight > 0);
  return render(width, height, extent, false, (across, along, out) => {
    const angle = (across - 0.5) * look.arc;
    const round = (yarns * angle) / TAU;
    // yarns wander from side to side
    const straight = round + twist * along;
    const a = straight + unevenness * 0.5 * (noise(straight, along * 5, 11, 0, 5, twist) - 0.5);
    const yarn = Math.pow(Math.sin(Math.PI * frac(a)), 0.5);

    let tone = 0;
    let standing = 0;
    for (let k = 0; k < layers.length; k++) {
      const { turns, density, weight } = layers[k]!;
      const shift = turns * density;
      const lane = (k === 0 ? a : round + turns * along) * density;
      const place = lane + 1.1 * unevenness * (noise(lane, along * 7, 30 + k, 0, 7, shift) - 0.5);
      const light = noise(place, along * staple, 40 + k, 0, staple, shift); // a fibre keeps its lightness along its length
      const ridge = 1 - Math.abs(2 * frac(place) - 1);
      tone += weight * (light - 0.5 + 0.35 * (ridge - 0.5));
      standing += weight * Math.pow(ridge, 0.6) * (0.4 + 0.6 * light);
    }
    const grain = a * fibres;
    const speck = noise(grain * 2, along * 48, 23, 0, 48, twist * fibres * 2);
    const colour = noise(grain, along * 2, 25, 0, 2, twist * fibres);
    const lump = noise(a * 2, along * 9, 26, 0, 9, twist * 2);
    const mottle = noise(a * 3, along * 17, 27, 0, 17, twist * 3);
    const open = 1 - smooth(0.7, 1.7, Math.abs(angle)); // the strand turns into the groove beside it

    out.height =
      look.yarnRelief * (yarn + 0.6 * unevenness * (lump - 0.5)) + look.fibreRelief * (0.3 + 0.7 * yarn) * standing;
    out.shade =
      (1 - depth + depth * Math.pow(yarn, 0.85)) *
      (0.22 + 0.78 * open) *
      (1 + variety * (tone + 0.4 * (speck - 0.5) + 0.35 * (mottle - 0.5)));
    out.tint = 0.5 + variety * (1.2 * (colour - 0.5) + 0.25 * (lump - 0.5));
    out.open = (0.25 + 0.75 * open) * (1 - 0.85 * depth * (1 - yarn));
    out.rough = look.roughness + 0.14 * (speck - 0.5);
  });
}

export interface BraidedSurface {
  /** Carriers going each way round the rope: an even number. */
  readonly carriers: number;
  /** How many carriers going the other way one of them crosses in a repeat of the image. */
  readonly crossings: number;
  /** How many it passes over before going under: 1 for a plain braid, 2 for a twill. */
  readonly over: 1 | 2;
  /** Yarns side by side in a carrier, and fibres across each of those. */
  readonly ends: number;
  readonly fibres: number;
  /** How far a carrier stands above where it dives under the next, and how far single fibres stand out. */
  readonly relief: number;
  readonly fibreRelief: number;
  /** 0 to 1: how dark it is where a carrier dives under the next, and between carriers. */
  readonly depth: number;
  /** How much of its place a carrier fills, up to 1: less leaves a gap beside it. */
  readonly cover: number;
  /** How many times the fibres of a yarn go round it along one crossing: 0 for straight filaments. */
  readonly ply: number;
  readonly variety: number;
  readonly roughness: number;
  /**
   * Which colour each carrier has, going one way and the other, from 0 (the first colour) to 1 (the last).
   * The patterns repeat round the rope; their lengths must divide both `carriers` and `crossings`.
   */
  readonly warp: readonly number[];
  readonly weft: readonly number[];
}

function commonDivisor(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : commonDivisor(b, a % b);
}

/** The sheath of a braided rope. Across the image is once round the rope. */
export function braidedSurface(
  look: BraidedSurface,
  extent: readonly [number, number],
  width = 1024,
  height = 1024,
): Surface {
  const { carriers, crossings, over, ends, fibres, depth, cover, ply, variety } = look;
  const period = commonDivisor(carriers, crossings);
  const cycle = 2 * over;
  return render(width, height, extent, true, (around, along, out) => {
    const a = carriers * around + crossings * along;
    const b = carriers * around - crossings * along;
    const i = Math.floor(a);
    const j = Math.floor(b);
    const fa = a - i;
    const fb = b - j;
    const step = mod(i + j, cycle);
    const top = step < over; // here the carrier going one way is on top; elsewhere the one going the other way
    const id = mod(top ? i : j, period);
    const pattern = top ? look.warp : look.weft;
    const w = ((top ? fa : fb) - 0.5) / cover; // across the carrier, from -0.5 to 0.5
    const t = (top ? step + fb : step - over + fa) / over; // along the part of it that shows
    out.tint = pattern[id % pattern.length] ?? 0;
    if (Math.abs(w) > 0.5) {
      // the gap between two carriers, where the ones underneath show
      out.height = 0;
      out.shade = 1 - 1.2 * depth;
      out.open = 1 - 1.3 * depth;
      out.rough = 1;
      return;
    }
    const crown = Math.pow(Math.sin(Math.PI * t), 0.55);
    const arch = Math.sqrt(1 - 4 * w * w);
    const end = Math.pow(Math.sin(Math.PI * frac((w + 0.5) * ends)), 0.5);
    const lane = (id + w + 0.5) * ends * fibres;
    const run = (top ? b : a) * 4;
    const seed = top ? 31 : 37;
    const streak = noise(lane, run, seed, period * ends * fibres, period * 4, 0);
    const speck = noise(lane * 2, run * 6, seed + 1, period * ends * fibres * 2, period * 24, 0);
    const ridge = 1 - Math.abs(2 * frac(lane + (ply * run) / 4) - 1);
    const own = hash(id, top ? 1 : 2, 41); // carriers are not all quite the same

    out.height = look.relief * crown * arch * (0.6 + 0.4 * end) + look.fibreRelief * crown * Math.pow(ridge, 0.6);
    out.shade =
      (1 - depth + depth * crown) *
      (1 - 0.65 * depth + 0.65 * depth * end) *
      (0.75 + 0.25 * arch) *
      (1 + variety * (0.8 * (streak - 0.5) + 0.35 * (ridge - 0.5) + 0.3 * (speck - 0.5) + 0.25 * (own - 0.5)));
    out.open = 1 - 1.25 * depth * (1 - crown * arch * (0.7 + 0.3 * end));
    out.rough = look.roughness + 0.12 * (speck - 0.5) - 0.08 * (ridge - 0.5);
  });
}

export type Rgb = readonly [number, number, number];

/** The colour of each texel, four values each: its place along `ramp`, made lighter or darker by its shade. */
export function colourOf(surface: Surface, ramp: readonly Rgb[]): Uint8Array {
  const count = surface.width * surface.height;
  const pixels = new Uint8Array(count * 4);
  const last = ramp.length - 1;
  for (let k = 0; k < count; k++) {
    const place = (surface.tint[k]! / 255) * last;
    const from = Math.min(Math.floor(place), Math.max(last - 1, 0));
    const [low, high] = [ramp[from]!, ramp[Math.min(from + 1, last)]!];
    const mix = place - from;
    const light = surface.shade[k]! / SHADE_UNIT;
    for (let c = 0; c < 3; c++) pixels[4 * k + c] = byte((low[c]! + (high[c]! - low[c]!) * mix) * light);
    pixels[4 * k + 3] = 255;
  }
  return pixels;
}
