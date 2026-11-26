/**
 * Small pictures of ropes, for lists. They are drawn one after another by a viewport of their own that is
 * never seen, and kept while the page lives: a list of knots does not need a 3D view for each of them.
 */

import { chosenDetail } from './detail.ts';
import { RopeViewport, type Fit, type RopeSpec } from './RopeViewport.ts';

/** The size of a picture in CSS pixels, and the air it keeps round the rope. */
const [WIDTH, HEIGHT, MARGIN] = [480, 360, 30];
/** How long the viewport is kept, in milliseconds, in case another picture is asked for. */
const IDLE = 1500;
/** How long a picture waits for the images of its rope before it is taken without them. */
const PATIENCE = 6000;

const kept = new Map<string, Promise<string>>();

/**
 * Pictures are kept in the browser too, under the name of the build that drew them, so that a page of knots
 * seen before is shown at once. While developing nothing is kept: the name of the build does not change.
 */
const STORED = 'idk.picture ';
const BUILD = import.meta.env.PROD ? `${new URL(import.meta.url).pathname} ` : null;

function read(key: string): string | null {
  if (!BUILD) return null;
  try {
    return window.localStorage.getItem(STORED + BUILD + key);
  } catch {
    return null;
  }
}

function write(key: string, picture: string): void {
  if (!BUILD) return;
  try {
    window.localStorage.setItem(STORED + BUILD + key, picture);
  } catch {
    // the browser keeps no more: the picture is drawn again next time
  }
}

// what an earlier build kept is thrown away
if (BUILD) {
  try {
    for (const name of Object.keys(window.localStorage)) {
      if (name.startsWith(STORED) && !name.startsWith(STORED + BUILD)) window.localStorage.removeItem(name);
    }
  } catch {
    // it stays a little longer
  }
}
let last: Promise<unknown> = Promise.resolve();
let studio: { readonly host: HTMLElement; readonly view: RopeViewport } | null = null;
let closing: number | undefined;

/**
 * The picture of these ropes, as the address of an image with nothing behind the rope. `key` names what
 * is drawn: the same key gives the same picture, without drawing it again. Drawing holds the page for a
 * moment, so a picture that is not what the page is for can be made to `wait` some milliseconds first.
 */
export function pictureOf(key: string, ropes: readonly RopeSpec[], fit: Fit, wait = 0): Promise<string> {
  let picture = kept.get(key);
  const stored = picture ? null : read(key);
  if (stored) {
    picture = Promise.resolve(stored);
    kept.set(key, picture);
  }
  if (!picture) {
    picture = last
      .then(() => new Promise((resolve) => window.setTimeout(resolve, wait)))
      .then(() => draw(ropes, fit))
      .then((made) => {
        write(key, made);
        return made;
      });
    // a picture that could not be drawn is asked for again the next time, and does not stop the others
    last = picture.catch(() => void kept.delete(key));
    kept.set(key, picture);
  }
  return picture;
}

async function draw(ropes: readonly RopeSpec[], fit: Fit): Promise<string> {
  window.clearTimeout(closing);
  studio ??= open();
  const { view } = studio;
  try {
    view.fitTo({ ...fit, clear: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } });
    view.setRopes(ropes);
    await new Promise<void>((resolve) => {
      if (view.settled) return resolve();
      const late = window.setTimeout(resolve, PATIENCE);
      view.onDraw = () => {
        if (!view.settled) return;
        window.clearTimeout(late);
        resolve();
      };
    });
    return view.picture();
  } finally {
    view.onDraw = null;
    closing = window.setTimeout(close, IDLE);
  }
}

function open(): NonNullable<typeof studio> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${WIDTH}px;height:${HEIGHT}px;pointer-events:none`;
  document.body.append(host);
  try {
    return { host, view: new RopeViewport(host, chosenDetail()) };
  } catch (error) {
    host.remove();
    throw error;
  }
}

function close(): void {
  studio?.view.dispose();
  studio?.host.remove();
  studio = null;
}
