/**
 * Computes the images of wood away from the page, which would otherwise stand still for half a second the
 * first time a thing of wood is shown; and keeps them in the browser, as the images of rope are kept, so that
 * the next visit computes nothing.
 */
import { NO_STORE, openImageStore, type StoredImage } from './imageStore.ts';
import { endGrain, sideGrain, type WoodImages } from './wood.ts';

export interface WoodReply {
  readonly side: WoodImages;
  readonly end: WoodImages;
}

// the address of this file names the build that computes the wood: see surface.worker.ts
const store = import.meta.env.PROD ? openImageStore(self.location.pathname) : Promise.resolve(NO_STORE);

const asStored = ({ width, height, colour, detail }: WoodImages): StoredImage => ({
  width,
  height,
  planes: [colour, detail],
});
const fromStored = ({ width, height, planes }: StoredImage): WoodImages | null => {
  const [colour, detail] = planes;
  return colour && detail ? { width, height, colour, detail } : null;
};

addEventListener('message', () => {
  void (async () => {
    const kept = await store;
    const [side, end] = await Promise.all([kept.read('wood side'), kept.read('wood end')]);
    const [keptSide, keptEnd] = [side ? fromStored(side) : null, end ? fromStored(end) : null];
    const reply: WoodReply =
      keptSide && keptEnd ? { side: keptSide, end: keptEnd } : { side: sideGrain(), end: endGrain() };
    if (!(keptSide && keptEnd)) {
      kept.write('wood side', asStored(reply.side));
      kept.write('wood end', asStored(reply.end));
    }
    const buffers = [reply.side, reply.end].flatMap((image) => [image.colour.buffer, image.detail.buffer]);
    postMessage(reply, { transfer: buffers });
  })().catch(reportError);
});
