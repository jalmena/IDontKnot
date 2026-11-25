/**
 * The computed images of rope (see surface.ts) as textures for the renderer. A worker hands them over a
 * moment after they are first asked for, and from then on they are kept while the page lives: every view
 * of rope shares them, so that a rope seen in one view is drawn at once in the next. The relief of a rope
 * is shared by all its colours; only the colour image is made again for each.
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
import type { ImagesReply, ImagesRequest } from './imageSource.ts';
import { ROPE_MATERIALS, ropeColour, type RopeMaterialId } from './materials.ts';

export interface RopeMaps {
  readonly map: DataTexture;
  readonly normalMap: DataTexture;
  /** Red: how open the surface is to light from all round. Green: how rough it is. */
  readonly detailMap: DataTexture;
}

const keyOf = (material: RopeMaterialId, colour: string): string => `${material} ${colour}`;

/** What the worker has handed over so far, for every view of rope on the page. */
class RopeImages {
  readonly colours = new Map<string, Pick<ImagesReply, 'width' | 'height' | 'pixels' | 'kept'>>();
  readonly relief = new Map<RopeMaterialId, Required<Pick<ImagesReply, 'width' | 'height' | 'normal' | 'detail'>>>();
  private readonly asked = new Set<string>();
  private readonly waiting = new Set<() => void>();
  private worker: Worker | null = null;

  /** Asks once for the images of one colour of a rope. Those waiting are told when they arrive. */
  ask(material: RopeMaterialId, colour: string): void {
    const key = keyOf(material, colour);
    if (this.asked.has(key)) return;
    this.asked.add(key);
    this.worker ??= this.start();
    this.worker.postMessage({ material, colour } satisfies ImagesRequest);
  }

  /** Calls `listener` each time images arrive, until the function this returns is called. */
  wait(listener: () => void): () => void {
    this.waiting.add(listener);
    return () => void this.waiting.delete(listener);
  }

  private start(): Worker {
    const worker = new Worker(new URL('./surface.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<ImagesReply>) => {
      const { material, colour, width, height, pixels, normal, detail, kept } = event.data;
      this.colours.set(keyOf(material, colour), { width, height, pixels, kept });
      if (normal && detail) this.relief.set(material, { width, height, normal, detail });
      for (const listener of [...this.waiting]) listener();
    });
    return worker;
  }
}

const images = new RopeImages();

/** The textures of one renderer, made from the images the page shares. */
export class RopeTextures {
  /** Where the images last made into textures came from: kept from an earlier visit, or computed in this one. */
  source: 'kept' | 'computed' | null = null;
  private readonly anisotropy: number;
  private readonly forget: () => void;
  private readonly relief = new Map<RopeMaterialId, { normal: DataTexture; detail: DataTexture }>();
  private readonly colours = new Map<string, DataTexture>();

  /** `onReady` is called each time images that were asked for have arrived. */
  constructor(anisotropy: number, onReady: () => void) {
    this.anisotropy = anisotropy;
    this.forget = images.wait(onReady);
  }

  /**
   * The textures for a loop of this rope. Nothing for a smooth rope; and nothing yet for one whose images
   * have not arrived: they are asked for, and `onReady` says when to ask again.
   */
  mapsFor(id: RopeMaterialId, index: number): RopeMaps | null {
    if (ROPE_MATERIALS[id].construction === 'smooth') return null;
    const colour = ropeColour(id, index);
    const key = keyOf(id, colour);
    const [painted, shaped] = [images.colours.get(key), images.relief.get(id)];
    if (!painted || !shaped) {
      images.ask(id, colour);
      return null;
    }
    const texture = (data: Uint8Array, coloured: boolean): DataTexture => {
      const made = new DataTexture(data, painted.width, painted.height, RGBAFormat, UnsignedByteType);
      made.wrapS = RepeatWrapping;
      // across a strand the image does not repeat: its edges are the two grooves
      made.wrapT = ROPE_MATERIALS[id].construction === 'laid' ? ClampToEdgeWrapping : RepeatWrapping;
      made.magFilter = LinearFilter;
      made.minFilter = LinearMipmapLinearFilter;
      made.generateMipmaps = true;
      made.anisotropy = this.anisotropy;
      if (coloured) made.colorSpace = SRGBColorSpace;
      made.needsUpdate = true;
      return made;
    };
    let relief = this.relief.get(id);
    if (!relief) {
      relief = { normal: texture(shaped.normal, false), detail: texture(shaped.detail, false) };
      this.relief.set(id, relief);
    }
    let map = this.colours.get(key);
    if (!map) {
      map = texture(painted.pixels, true);
      this.colours.set(key, map);
      this.source = painted.kept ? 'kept' : 'computed';
    }
    return { map, normalMap: relief.normal, detailMap: relief.detail };
  }

  /** Lets go of the textures of this renderer. The images stay with the page, for its other views. */
  dispose(): void {
    this.forget();
    for (const { normal, detail } of this.relief.values()) {
      normal.dispose();
      detail.dispose();
    }
    for (const map of this.colours.values()) map.dispose();
    this.relief.clear();
    this.colours.clear();
  }
}
