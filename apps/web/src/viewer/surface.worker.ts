/**
 * Computes the images of a rope away from the page, which would otherwise stand still for half a second
 * the first time each rope is drawn. It keeps each material's surface, and paints it again for each colour.
 */

import { rampOf, surfaceOf } from './images.ts';
import { ROPE_MATERIALS, type RopeMaterialId } from './materials.ts';
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
}

const surfaces = new Map<RopeMaterialId, Surface>();

addEventListener('message', (event: MessageEvent<ImagesRequest>) => {
  const { material, colour } = event.data;
  const look = ROPE_MATERIALS[material];
  let surface = surfaces.get(material);
  const first = !surface;
  surface ??= surfaceOf(look) ?? undefined;
  if (!surface) return;
  surfaces.set(material, surface);

  const pixels = colourOf(surface, rampOf(look, colour));
  const { width, height } = surface;
  const reply: ImagesReply = first
    ? { material, colour, width, height, pixels, normal: surface.normal, detail: surface.detail }
    : { material, colour, width, height, pixels };
  // the relief is copied, not handed over: the surface here keeps it
  postMessage(reply, { transfer: [pixels.buffer] });
});
