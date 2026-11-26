/**
 * The things a rope can be shown tied to: a plate with a hole, and a post. Their sizes are in rope
 * diameters, so that they suit any rope.
 */
import {
  CylinderGeometry,
  DataTexture,
  ExtrudeGeometry,
  LinearMipmapLinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  Path,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  Shape,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { WoodImages } from './wood.ts';
import type { WoodReply } from './wood.worker.ts';
import type { Point3 } from '@idontknot/core';

export type ThingKind = 'plate' | 'post';

export interface SceneObject {
  readonly kind: ThingKind;
  /** Where its middle is. */
  readonly at: Point3;
  /** The way it faces: across a plate, along a post. */
  readonly axis: Point3;
  /** The diameter of the rope it is made for: its sizes are in those. */
  readonly scale: number;
  /** How long a post is, in rope diameters. */
  readonly length?: number;
}

/** The half side and the thickness of a plate, the radius of its hole, and the radius and height of a post. */
export const PLATE_HALF = 2.6;
export const PLATE_THICKNESS = 0.7;
export const PLATE_HOLE = 0.62;
export const POST_RADIUS = 1.05;
export const POST_HEIGHT = 5;

function geometryOf(thing: SceneObject): BufferGeometry {
  const k = thing.scale;
  if (thing.kind === 'post') {
    return new CylinderGeometry(POST_RADIUS * k, POST_RADIUS * k, (thing.length ?? POST_HEIGHT) * k, 48);
  }
  const side = PLATE_HALF * k;
  const shape = new Shape();
  shape.moveTo(-side, -side);
  shape.lineTo(side, -side);
  shape.lineTo(side, side);
  shape.lineTo(-side, side);
  shape.lineTo(-side, -side);
  const hole = new Path();
  hole.absarc(0, 0, PLATE_HOLE * k, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const bevel = 0.08 * k;
  const geometry = new ExtrudeGeometry(shape, {
    depth: PLATE_THICKNESS * k - 2 * bevel,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 48,
  });
  geometry.translate(0, 0, -(PLATE_THICKNESS * k) / 2 + bevel);
  return geometry;
}

/** The textures of a piece of wood: its colour, its relief and how rough it is. */
interface WoodMaps {
  readonly map: DataTexture;
  readonly bumpMap: DataTexture;
  readonly roughnessMap: DataTexture;
}

/** The wood of every thing, computed once in a worker: the side of a board or a post, and the end of a post. */
let wood: { side: WoodMaps; end: WoodMaps } | null = null;
let asked: Promise<void> | null = null;

function mapsOf(images: WoodImages): WoodMaps {
  const texture = (data: Uint8Array, coloured: boolean): DataTexture => {
    const made = new DataTexture(data, images.width, images.height, RGBAFormat);
    made.wrapS = made.wrapT = RepeatWrapping;
    made.minFilter = LinearMipmapLinearFilter;
    made.generateMipmaps = true;
    made.anisotropy = 8;
    if (coloured) made.colorSpace = SRGBColorSpace;
    made.needsUpdate = true;
    return made;
  };
  return {
    map: texture(images.colour, true),
    // one picture serves both: the relief is read from its red, the roughness from its green
    bumpMap: texture(images.detail, false),
    roughnessMap: texture(images.detail, false),
  };
}

/** Whether the wood has been computed. Until it has, things are drawn in a plain colour of wood. */
export function woodIsReady(): boolean {
  return wood !== null;
}

/** Asks for the wood to be computed, once; the promise is kept when it has been. */
export function askForWood(): Promise<void> {
  asked ??= new Promise<void>((resolve) => {
    const worker = new Worker(new URL('./wood.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<WoodReply>) => {
      wood = { side: mapsOf(event.data.side), end: mapsOf(event.data.end) };
      worker.terminate();
      resolve();
    });
    worker.postMessage(null);
  });
  return asked;
}

/** A material of wood with these maps, turned and repeated as given: oiled, a little shiny, a little rough. */
function woodWith(maps: WoodMaps | undefined, place: (texture: DataTexture) => void): MeshPhysicalMaterial {
  if (!maps) return new MeshPhysicalMaterial({ color: 0x8a5a34, roughness: 0.75 });
  const [map, bumpMap, roughnessMap] = [maps.map.clone(), maps.bumpMap.clone(), maps.roughnessMap.clone()];
  for (const texture of [map, bumpMap, roughnessMap]) {
    place(texture);
    texture.needsUpdate = true;
  }
  return new MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 1.2,
    roughnessMap,
    roughness: 1,
    clearcoat: 0.18,
    clearcoatRoughness: 0.55,
    sheen: 0.12,
    sheenRoughness: 0.7,
  });
}

/**
 * The wood of a thing, face by face. A plate is a board: the grain runs across its faces and along its edges.
 * A post is a round of timber: the grain runs along its side, and its ends show the rings round its heart.
 */
function woodFor(thing: SceneObject): MeshPhysicalMaterial[] {
  const k = thing.scale;
  if (thing.kind === 'plate') {
    // an extruded shape takes its texture coordinates from its own size, from -side to side
    const side = 2 * PLATE_HALF * k;
    const across = (texture: DataTexture): void => {
      texture.repeat.set(1 / side, 1 / side);
      texture.offset.set(0.5, 0.5);
    };
    return [woodWith(wood?.side, across), woodWith(wood?.side, across)];
  }
  // round the post the image goes once, and the grain runs along it: the image is turned a quarter
  const along = (texture: DataTexture): void => {
    texture.rotation = Math.PI / 2;
    texture.center.set(0.5, 0.5);
    texture.repeat.set((thing.length ?? POST_HEIGHT) / (2 * Math.PI * POST_RADIUS), 1);
  };
  return [woodWith(wood?.side, along), woodWith(wood?.end, () => undefined), woodWith(wood?.end, () => undefined)];
}

/** The mesh of a thing, in wood, placed and turned as it says. */
export function meshOf(thing: SceneObject): Mesh {
  const mesh = new Mesh(geometryOf(thing), woodFor(thing));
  // a plate is drawn facing +z, a post standing along +y
  const drawn = thing.kind === 'post' ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(drawn, new Vector3(...thing.axis).normalize()));
  mesh.position.set(...thing.at);
  return mesh;
}
