/**
 * Hands the images of a rope to the page from away from it: computing them would otherwise hold the page
 * still for half a second the first time each rope is drawn. What it computes it keeps in the browser, so
 * that the next visit computes nothing: see imageSource.ts and imageStore.ts.
 */

import { ImageSource, type ImagesRequest } from './imageSource.ts';
import { NO_STORE, openImageStore } from './imageStore.ts';

// The address of this file changes whenever the code that computes the images does, because the build puts
// a hash of its contents in its name: that makes it the name of the build. While developing it does not
// change, and so nothing is kept.
const store = import.meta.env.PROD ? openImageStore(self.location.pathname) : Promise.resolve(NO_STORE);
const source = store.then((opened) => new ImageSource(opened));

// one request at a time: the colours of one rope share a surface, which is then computed once
let last: Promise<void> = Promise.resolve();

addEventListener('message', (event: MessageEvent<ImagesRequest>) => {
  last = last
    .then(async () => {
      const reply = await (await source).answer(event.data);
      if (!reply) return;
      // what was kept is handed over; a relief just computed is copied, for the surface here keeps it
      const relief = reply.kept && reply.normal && reply.detail ? [reply.normal.buffer, reply.detail.buffer] : [];
      postMessage(reply, { transfer: [reply.pixels.buffer, ...relief] });
    })
    .catch(reportError);
});
