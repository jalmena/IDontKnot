// Computes how a knot of the library is tightened, and writes the frames it passes through into its file.
//
//   node --conditions=source tools/knots/tighten.mjs figure-eight && pnpm exec prettier --write content
//
// The frames are content: they are kept in the repository and checked like any other frame. Run this again
// after changing the shape a knot is tied in, or the way the core tightens.
import { readFileSync, writeFileSync } from 'node:fs';
import { checkFrame, TIGHT_FRAME, tighteningFrames } from '../../packages/core/src/index.ts';

const id = process.argv[2];
if (!id) throw new Error('usage: tighten.mjs <the id of a knot under content/knots>');
const file = new URL(`../../content/knots/${id}/knot.json`, import.meta.url);
const document = JSON.parse(readFileSync(file, 'utf8'));

// what an earlier run wrote is made again
const made = (frame) => frame.id === TIGHT_FRAME || frame.id.startsWith('tightening-');
const frames = document.geometry.frames.filter((frame) => !made(frame));
const start = frames.find((frame) => frame.id === document.construction?.methods[0]?.frame) ?? frames[0];
const tightening = tighteningFrames({ ...document, geometry: { frames } }, start);
if (tightening.length === 0) throw new Error(`"${id}" is not one open rope: it cannot be tightened yet`);

document.geometry = { frames: [...frames, ...tightening], tightening: [start.id, ...tightening.map((frame) => frame.id)] };
for (const frame of tightening) {
  const issues = checkFrame(document, frame);
  console.log(frame.id, `${frame.curves[document.components[0].id].points.length} points`, issues.length ? issues : 'keeps the rules');
  if (issues.length > 0) process.exitCode = 1;
}
if (!process.exitCode) writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
