import { expect, it } from 'vitest';
import { ImageSource } from '../src/viewer/imageSource.ts';
import { isStoredImage, NO_STORE, type ImageStore, type StoredImage } from '../src/viewer/imageStore.ts';
import { ROPE_MATERIALS, ropeColour, type RopeMaterial } from '../src/viewer/materials.ts';
import { laidSurface, type Surface } from '../src/viewer/surface.ts';

/** A store in memory that copies what it is given, as the browser's does. */
function memory(): ImageStore & { readonly kept: Map<string, StoredImage> } {
  const kept = new Map<string, StoredImage>();
  return {
    kept,
    read: (key) => Promise.resolve(kept.get(key)),
    write: (key, image) => void kept.set(key, { ...image, planes: image.planes.map((plane) => plane.slice()) }),
  };
}

/** A small surface in place of the real one, and how many times it was computed. */
function small(): { compute: (material: RopeMaterial) => Surface | null; count: () => number } {
  let count = 0;
  return {
    count: () => count,
    compute: (material) => {
      if (material.construction !== 'laid') return null;
      count++;
      return laidSurface({ ...material.surface, twist: 1, arc: 4 }, [material.repeat, 2], 8, 4);
    },
  };
}

const jute = { material: 'jute', colour: ropeColour('jute', 0) } as const;

it('computes the images of a rope the first time, and sends its relief with them', async () => {
  const surface = small();
  const reply = await new ImageSource(NO_STORE, surface.compute).answer(jute);
  expect(reply).toMatchObject({ ...jute, width: 8, height: 4, kept: false });
  expect(reply?.pixels).toHaveLength(4 * 8 * 4);
  expect(reply?.normal).toHaveLength(4 * 8 * 4);
  expect(reply?.detail).toHaveLength(4 * 8 * 4);
  expect(surface.count()).toBe(1);
});

it('computes the surface of a rope once for all its colours, and sends the relief once', async () => {
  const surface = small();
  const source = new ImageSource(NO_STORE, surface.compute);
  await source.answer(jute);
  const second = await source.answer({ material: 'jute', colour: '#7a1f1f' });
  expect(second?.pixels).toHaveLength(4 * 8 * 4);
  expect(second?.normal).toBeUndefined();
  expect(surface.count()).toBe(1);
});

it('keeps what it computes, and on the next visit computes nothing', async () => {
  const store = memory();
  const first = await new ImageSource(store, small().compute).answer(jute);
  expect([...store.kept.keys()].sort()).toEqual([`colour jute ${jute.colour}`, 'relief jute']);

  const surface = small();
  const again = await new ImageSource(store, surface.compute).answer(jute);
  expect(surface.count()).toBe(0);
  expect(again).toEqual({ ...first, kept: true });
});

it('computes a colour that was not kept, though the relief was', async () => {
  const store = memory();
  await new ImageSource(store, small().compute).answer(jute);
  const surface = small();
  const reply = await new ImageSource(store, surface.compute).answer({ material: 'jute', colour: '#7a1f1f' });
  expect(reply?.kept).toBe(false);
  expect(reply?.normal).toHaveLength(4 * 8 * 4);
  expect(surface.count()).toBe(1);
});

it('has no images for a smooth rope', async () => {
  const smooth = Object.entries(ROPE_MATERIALS).find(([, material]) => material.construction === 'smooth');
  if (!smooth) throw new Error('there is a smooth rope');
  const reply = await new ImageSource(NO_STORE).answer({ material: smooth[0] as 'line', colour: '#ffffff' });
  expect(reply).toBeNull();
});

it('tells an image from anything else that a store may hand back', () => {
  const image = { width: 2, height: 1, planes: [new Uint8Array(8)] };
  expect(isStoredImage(image)).toBe(true);
  expect(isStoredImage({ ...image, planes: [new Uint8Array(7)] })).toBe(false);
  expect(isStoredImage({ ...image, planes: [] })).toBe(false);
  expect(isStoredImage({ width: 2, height: 1 })).toBe(false);
  expect(isStoredImage('jute')).toBe(false);
  expect(isStoredImage(null)).toBe(false);
});
