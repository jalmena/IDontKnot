/**
 * The images of wood, computed as a log would be cut: the growth rings are the distance from the pith of a
 * tree, bent and drawn out as the tree grew, and a board or a post shows them as the saw found them. The
 * side of a board shows them as long arches along the grain; the side of a round pole, turned from the log,
 * as long fine streaks where the rings come to its surface; the end of a post shows them as rings round its
 * heart, with rays across them and the cracks that wood opens as it dries. Pure: it gives arrays, and
 * knows nothing about the renderer.
 */

/** The same noise every time, from a seed: values between 0 and 1, smooth between whole coordinates. */
function noise(seed: number): (x: number, y: number) => number {
  const hash = (x: number, y: number): number => {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    const [tx, ty] = [smooth(x - x0), smooth(y - y0)];
    const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * tx;
    const bottom = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}

/** Noise that repeats every `px` along x and every `py` along y, so that a picture of it tiles without a seam. */
function tiling(seed: number, px: number, py: number): (x: number, y: number) => number {
  const hash = (x: number, y: number): number => {
    const [wx, wy] = [((x % px) + px) % px, ((y % py) + py) % py];
    let h = (wx * 374761393 + wy * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    const [tx, ty] = [smooth(x - x0), smooth(y - y0)];
    const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * tx;
    const bottom = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}

/** Noise in several octaves, each half the size and half the strength of the last: between 0 and 1. */
function fractal(seed: number, octaves: number): (x: number, y: number) => number {
  const layers = Array.from({ length: octaves }, (_, k) => noise(seed + k * 101));
  return (x, y) => {
    let [sum, weight, total] = [0, 1, 0];
    layers.forEach((layer, k) => {
      sum += layer(x * 2 ** k, y * 2 ** k) * weight;
      total += weight;
      weight /= 2;
    });
    return sum / total;
  };
}

export interface WoodImages {
  readonly width: number;
  readonly height: number;
  /** The colour, four values per texel. */
  readonly colour: Uint8Array;
  /**
   * Red: how far the surface stands up, the open grain and the cracks low. Green: how rough it is, the pores
   * and the cracks rougher than the smooth latewood. One picture for both, as the renderer reads the relief
   * from the red and the roughness from the green: half as much to compute, keep and send.
   */
  readonly detail: Uint8Array;
}

/** Earlywood, latewood and the darker wood near the heart, as red, green and blue: a warm, oiled oak. */
const EARLY = [176, 128, 80] as const;
const LATE = [112, 72, 40] as const;
const HEART = [88, 56, 32] as const;

const clamp = (value: number): number => Math.min(Math.max(value, 0), 1);

/**
 * The colour of wood at a place: `ring` is how far through its growth ring the place is, from 0 where the
 * ring began to 1 where the next begins; `tone` is a slow change of colour across the piece.
 */
function tint(ring: number, tone: number, fibre: number, pore: number): { rgb: number[]; late: number } {
  // earlywood is light and grows darker towards the latewood, which ends sharply where the next ring begins:
  // sharply, but over a few texels, or the edge would show as stairs close up
  const late = ring < 0.82 ? Math.pow(ring / 0.82, 2.6) : clamp((1 - ring) / 0.18) ** 0.7;
  const rgb = [0, 1, 2].map((c) => {
    const base = EARLY[c]! + (LATE[c]! - EARLY[c]!) * late;
    const toned = base + (HEART[c]! - base) * tone * 0.5;
    return toned * (1 + fibre * 0.08) * (1 - pore * 0.35);
  });
  return { rgb, late };
}

function images(
  width: number,
  height: number,
  at: (x: number, y: number) => { ring: number; tone: number; fibre: number; pore: number; crack: number; ray: number },
): WoodImages {
  const colour = new Uint8Array(width * height * 4);
  const detail = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { ring, tone, fibre, pore, crack, ray } = at(x / width, y / height);
      const { rgb, late } = tint(ring, tone, fibre, Math.max(pore, crack));
      const k = 4 * (y * width + x);
      for (let c = 0; c < 3; c++)
        colour[k + c] = Math.round(clamp((rgb[c]! * (1 + ray * 0.12) * (1 - crack * 0.55)) / 255) * 255);
      colour[k + 3] = 255;
      const up = clamp(0.62 + 0.18 * late + 0.12 * fibre - 0.45 * pore - 0.7 * crack);
      detail[k] = Math.round(255 * up);
      detail[k + 2] = 0;
      detail[k + 3] = 255;
      const r = clamp(0.62 - 0.18 * late + 0.25 * pore + 0.3 * crack);
      detail[k + 1] = Math.round(255 * r);
    }
  }
  return { width, height, colour, detail };
}

/**
 * The side of a board sawn through a log: the grain runs along the first axis of the image, and repeats
 * along it. The rings are cut at a slant, and show as long arches, the cathedrals of flat-sawn wood.
 */
export function sideGrain(width = 1024, height = 512, seed = 7): WoodImages {
  const [bend, slow, streak, pores, wave] = [
    fractal(seed, 4),
    fractal(seed + 1, 3),
    noise(seed + 2),
    noise(seed + 3),
    fractal(seed + 4, 2),
  ];
  const rings = 14;
  return images(width, height, (u, v) => {
    // across the board, the distance from the pith of a log whose heart lies below the board; along it, the
    // rings wander, so that the arches open and close; the pattern repeats along u, so it is taken round
    const across = (v - 0.5) * 2.2;
    const wander = 0.55 * Math.sin(2 * Math.PI * u) + 0.35 * Math.sin(4 * Math.PI * u + 1.3);
    const depth = 1.15 + 0.35 * wander + 0.25 * (bend(Math.cos(2 * Math.PI * u) * 1.5 + 3, v * 2) - 0.5);
    const radius = Math.sqrt(across * across + depth * depth);
    const ring = (radius * rings + 0.6 * (wave(u * 6, v * 3) - 0.5)) % 1;
    // fibres and pores run along the grain: long in u, fine in v
    const fibre = streak(u * 24, v * 160) - 0.5;
    const pore = clamp((pores(u * 220, v * 140) - 0.7) / 0.1) * (ring > 0.15 && ring < 0.6 ? 1 : 0.3);
    return { ring, tone: slow(u * 2, v * 1.5), fibre, pore, crack: 0, ray: 0 };
  });
}

/**
 * The end of a post: rings round its heart, rays out from it, and a few cracks where it dried. The heart is
 * near the middle of the image.
 */
export function endGrain(size = 512, seed = 11): WoodImages {
  const [bend, slow, streak, rays, cracks] = [
    fractal(seed, 4),
    fractal(seed + 1, 3),
    noise(seed + 2),
    noise(seed + 3),
    noise(seed + 4),
  ];
  const rings = 11;
  return images(size, size, (u, v) => {
    const [x, y] = [u - 0.52, v - 0.47];
    const radius = Math.hypot(x, y) * 2;
    const angle = Math.atan2(y, x);
    const ring = ((radius + 0.06 * (bend(u * 4, v * 4) - 0.5)) * rings) % 1;
    const around = (angle / (2 * Math.PI) + 1) % 1;
    const ray = clamp((rays(around * 260, radius * 6) - 0.82) / 0.08) * 0.6;
    // a few deep checks run out from the heart, widest at the edge
    const check = cracks(around * 9, 0.5);
    const crack = radius > 0.18 && radius < 1 ? clamp((check - 0.86) / 0.03) * clamp(radius * 1.4) : 0;
    const fibre = streak(radius * 60, around * 40) - 0.5;
    return {
      ring,
      tone: 0.35 + 0.65 * clamp(1 - radius) * slow(u * 3, v * 3),
      fibre: fibre * 0.6,
      pore: 0,
      crack,
      ray,
    };
  });
}

/**
 * The side of a round pole, as a dowel is turned from a log: the grain runs along the first axis of the
 * image, the second goes once round the pole, and the picture tiles both ways. The rings, nearly parallel to
 * the surface, come to it as long fine streaks that drift slowly across; the fibres and the pores are drawn
 * out along the grain; here and there a small knot turns the streaks round it.
 */
export function roundGrain(width = 1024, height = 512, seed = 19): WoodImages {
  // periods: the image is so many lattice cells along and round, so that it tiles
  const [along, round] = [6, 24];
  const [drift, slow, streak, pores, fine, hair] = [
    tiling(seed, along, round / 4),
    tiling(seed + 1, 2, 3),
    tiling(seed + 2, along * 4, round * 12),
    tiling(seed + 3, along * 10, round * 24),
    tiling(seed + 4, along * 2, round * 6),
    tiling(seed + 5, along * 3, round * 40),
  ];
  // a few pin knots, each a place round which the streaks bend
  const knots = [
    [0.18, 0.31, 0.022],
    [0.63, 0.74, 0.016],
    [0.86, 0.12, 0.012],
  ] as const;
  const stripes = 9;
  return images(width, height, (u, v) => {
    // the streaks wander slowly round the pole as the rings meet its surface at a changing slant
    let across =
      v * stripes + 0.9 * (drift(u * along, v * (round / 4)) - 0.5) + 0.25 * (fine(u * along * 2, v * round * 6) - 0.5);
    let knotted = 0;
    for (const [ku, kv, size] of knots) {
      // round the knot, the streaks open and close about it; at its heart, a small dark eye of rings
      const du = (((u - ku + 1.5) % 1) - 0.5) / (size * 2.4);
      const dv = (((v - kv + 1.5) % 1) - 0.5) / size;
      const d = Math.hypot(du, dv);
      across += (0.9 * Math.sign(dv) * Math.exp(-d * d * 0.35)) / (1 + d * 0.2);
      knotted = Math.max(knotted, clamp(1.4 - d));
    }
    const ring = (((across % 1) + 1) % 1) * (1 - knotted) + knotted * ((Math.hypot(u, v) * 400) % 1);
    // fibres in two sizes, both long along the grain; pores as short dashes along it, in the earlywood
    const fibre =
      0.6 * (streak(u * along * 4, v * round * 12) - 0.5) + 0.4 * (hair(u * along * 3, v * round * 40) - 0.5);
    const pore = clamp((pores(u * along * 10, v * round * 24) - 0.78) / 0.1) * (ring > 0.1 && ring < 0.5 ? 0.8 : 0.15);
    const tone = 0.25 + 0.5 * slow(u * 2, v * 3) + 0.5 * knotted;
    return { ring, tone: clamp(tone), fibre: fibre * 0.8, pore, crack: 0, ray: 0 };
  });
}
