/**
 * Computes the images of wood away from the page, which would otherwise stand still for half a second the
 * first time a thing of wood is shown.
 */
import { endGrain, sideGrain, type WoodImages } from './wood.ts';

export interface WoodReply {
  readonly side: WoodImages;
  readonly end: WoodImages;
}

addEventListener('message', () => {
  const reply: WoodReply = { side: sideGrain(), end: endGrain() };
  const buffers = [reply.side, reply.end].flatMap((image) => [
    image.colour.buffer,
    image.relief.buffer,
    image.rough.buffer,
  ]);
  postMessage(reply, { transfer: buffers });
});
