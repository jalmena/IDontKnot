// Writes the document of a knot of the library from its drawing, and how it is tightened.
//
//   node --conditions=source tools/knots/lay.mjs figure-eight && pnpm exec prettier --write content
//
// The drawing is content/knots/<id>/layout.json: the path of the rope in the plane, how it passes at each
// crossing, and its parts and the steps that tie it, placed by the crossings the rope meets. The document,
// knot.json, is made from it, and refused if it breaks a rule.
import { readFileSync, writeFileSync } from 'node:fs';
import { checkDocument, checkFrame, checkMethod, layOut, tighteningFrames } from '../../packages/core/src/index.ts';

const id = process.argv[2];
if (!id) throw new Error('usage: lay.mjs <the id of a knot under content/knots>');
const folder = new URL(`../../content/knots/${id}/`, import.meta.url);
const layout = JSON.parse(readFileSync(new URL('layout.json', folder), 'utf8'));

let document = layOut(layout);
const [frame] = document.geometry.frames;
// a knot drawn tight as it is tied, as a lashing is, is not drawn tight afterwards
const tightening = layout.tightening === false ? [] : tighteningFrames(document, frame, layout.tightening);
if (tightening.length > 0) {
  document = {
    ...document,
    geometry: { frames: [frame, ...tightening], tightening: [frame.id, ...tightening.map((made) => made.id)] },
  };
}
const issues = [
  ...checkDocument(document),
  ...document.geometry.frames.flatMap((each) => checkFrame(document, each)),
  ...(document.construction?.methods ?? []).flatMap((method) => checkMethod(document, method)),
].filter((issue) => issue.level === 'error');
const strand = document.topology.diagram.strands[document.components[0].id];
console.log(id, 'length', document.components[0].length, '| crossings', strand.map(([crossing, pass]) => crossing.slice(1) + pass).join(' '));
console.log('frames', document.geometry.frames.map((each) => each.id).join(' '));
if (issues.length > 0) {
  for (const issue of issues.slice(0, 12)) console.log(' ', issue.rule, issue.frame ?? '', issue.message);
  console.log(`${issues.length} rules broken: nothing is written`);
  process.exitCode = 1;
} else if (!process.argv.includes('--dry')) {
  writeFileSync(new URL('knot.json', folder), `${JSON.stringify(document, null, 2)}\n`);
  console.log('written');
}
