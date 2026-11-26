/**
 * Computes the images of wood away from the page, which would otherwise stand still for half a second the
 * first time a thing of wood is shown; and keeps them in the browser, as the images of rope are kept, so that
 * the next visit computes nothing.
 */
import { NO_STORE, openImageStore, type StoredImage } from './imageStore.ts';
import { endGrain, roundGrain, sideGrain, type WoodImages } from './wood.ts';

export interface WoodReply {
  /** The side of a board, the side of a round pole, and the end of either. */
  readonly side: WoodImages;
  readonly round: WoodImages;
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
    const names = ['wood side', 'wood round', 'wood end'] as const;
    const read = await Promise.all(
      names.map(async (name) => {
        const stored = await kept.read(name);
        return stored ? fromStored(stored) : null;
      }),
    );
    const [keptSide, keptRound, keptEnd] = read;
    const reply: WoodReply = {
      side: keptSide ?? sideGrain(),
      round: keptRound ?? roundGrain(),
      end: keptEnd ?? endGrain(),
    };
    if (!keptSide) kept.write('wood side', asStored(reply.side));
    if (!keptRound) kept.write('wood round', asStored(reply.round));
    if (!keptEnd) kept.write('wood end', asStored(reply.end));
    const buffers = [reply.side, reply.round, reply.end].flatMap((image) => [image.colour.buffer, image.detail.buffer]);
    postMessage(reply, { transfer: buffers });
  })().catch(reportError);
});
