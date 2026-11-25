/**
 * Answers a request for the images of a rope: with what was kept on an earlier visit, or else by computing
 * them, and then keeping them. It knows nothing of the browser but the store it is given.
 */

import { rampOf, surfaceOf } from './images.ts';
import type { ImageStore } from './imageStore.ts';
import { ROPE_MATERIALS, type RopeMaterial, type RopeMaterialId } from './materials.ts';
import { colourOf, type Surface } from './surface.ts';

export interface ImagesRequest {
  readonly material: RopeMaterialId;
  readonly colour: string;
}

export interface ImagesReply extends ImagesRequest {
  readonly width: number;
  readonly height: number;
  /** The surface in this colour, four values per texel. */
  readonly pixels: Uint8Array;
  /** The relief of the material, sent the first time it is asked for: see `Surface`. */
  readonly normal?: Uint8Array;
  readonly detail?: Uint8Array;
  /** Whether the images had been kept, and so were not computed. */
  readonly kept: boolean;
}

export class ImageSource {
  private readonly store: ImageStore;
  private readonly compute: (material: RopeMaterial) => Surface | null;
  private readonly surfaces = new Map<RopeMaterialId, Surface>();
  private readonly sent = new Set<RopeMaterialId>();

  constructor(store: ImageStore, compute: (material: RopeMaterial) => Surface | null = surfaceOf) {
    this.store = store;
    this.compute = compute;
  }

  /** The images of one colour of a rope, or nothing for a rope that has no surface to compute. */
  async answer({ material, colour }: ImagesRequest): Promise<ImagesReply | null> {
    const look = ROPE_MATERIALS[material];
    const first = !this.sent.has(material);
    const [colourKey, reliefKey] = [`colour ${material} ${colour}`, `relief ${material}`];

    const [painted, relief] = await Promise.all([
      this.store.read(colourKey),
      first ? this.store.read(reliefKey) : undefined,
    ]);
    const [pixels, normal, detail] = [painted?.planes[0], relief?.planes[0], relief?.planes[1]];
    if (painted && pixels && !first) return { material, colour, ...sizeOf(painted), pixels, kept: true };
    if (painted && pixels && relief && normal && detail && relief.width === painted.width) {
      this.sent.add(material);
      return { material, colour, ...sizeOf(painted), pixels, normal, detail, kept: true };
    }

    const surface = this.surfaces.get(material) ?? this.compute(look);
    if (!surface) return null;
    this.surfaces.set(material, surface);
    const size = sizeOf(surface);
    const computed = colourOf(surface, rampOf(look, colour));
    this.store.write(colourKey, { ...size, planes: [computed] });
    if (!first) return { material, colour, ...size, pixels: computed, kept: false };
    this.store.write(reliefKey, { ...size, planes: [surface.normal, surface.detail] });
    this.sent.add(material);
    return { material, colour, ...size, pixels: computed, normal: surface.normal, detail: surface.detail, kept: false };
  }
}

const sizeOf = ({ width, height }: { width: number; height: number }) => ({ width, height });
