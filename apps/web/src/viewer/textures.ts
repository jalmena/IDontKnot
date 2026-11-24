/**
 * The computed images of rope (see surface.ts) as textures for the renderer. They are computed in a
 * worker and arrive a moment after they are first asked for. The relief of a rope is shared by all its
 * colours; only the colour image is made again for each.
 */

import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { ROPE_MATERIALS, ropeColour, type RopeMaterialId } from './materials.ts';
import type { ImagesReply, ImagesRequest } from './surface.worker.ts';

export interface RopeMaps {
  readonly map: DataTexture;
  readonly normalMap: DataTexture;
  /** Red: how open the surface is to light from all round. Green: how rough it is. */
  readonly detailMap: DataTexture;
}

export class RopeTextures {
  private readonly anisotropy: number;
  private readonly onReady: () => void;
  private readonly worker: Worker;
  private readonly relief = new Map<RopeMaterialId, { normal: DataTexture; detail: DataTexture }>();
  private readonly colours = new Map<string, DataTexture>();
  private readonly asked = new Set<string>();

  /** `onReady` is called each time images that were asked for have arrived. */
  constructor(anisotropy: number, onReady: () => void) {
    this.anisotropy = anisotropy;
    this.onReady = onReady;
    this.worker = new Worker(new URL('./surface.worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', this.receive);
  }

  /**
   * The textures for a loop of this rope. Nothing for a smooth rope; and nothing yet for one whose images
   * are still being computed: they are asked for, and `onReady` says when to ask again.
   */
  mapsFor(id: RopeMaterialId, index: number): RopeMaps | null {
    if (ROPE_MATERIALS[id].construction === 'smooth') return null;
    const colour = ropeColour(id, index);
    const key = `${id} ${colour}`;
    const [map, relief] = [this.colours.get(key), this.relief.get(id)];
    if (map && relief) return { map, normalMap: relief.normal, detailMap: relief.detail };
    if (!this.asked.has(key)) {
      this.asked.add(key);
      this.worker.postMessage({ material: id, colour } satisfies ImagesRequest);
    }
    return null;
  }

  dispose(): void {
    this.worker.removeEventListener('message', this.receive);
    this.worker.terminate();
    for (const { normal, detail } of this.relief.values()) {
      normal.dispose();
      detail.dispose();
    }
    for (const map of this.colours.values()) map.dispose();
    this.relief.clear();
    this.colours.clear();
  }

  private readonly receive = (event: MessageEvent<ImagesReply>): void => {
    const { material, colour, width, height, pixels, normal, detail } = event.data;
    const texture = (data: Uint8Array, coloured: boolean): DataTexture => {
      const made = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
      made.wrapS = RepeatWrapping;
      // across a strand the image does not repeat: its edges are the two grooves
      made.wrapT = ROPE_MATERIALS[material].construction === 'laid' ? ClampToEdgeWrapping : RepeatWrapping;
      made.magFilter = LinearFilter;
      made.minFilter = LinearMipmapLinearFilter;
      made.generateMipmaps = true;
      made.anisotropy = this.anisotropy;
      if (coloured) made.colorSpace = SRGBColorSpace;
      made.needsUpdate = true;
      return made;
    };
    if (normal && detail) this.relief.set(material, { normal: texture(normal, false), detail: texture(detail, false) });
    this.colours.set(`${material} ${colour}`, texture(pixels, true));
    this.onReady();
  };
}
