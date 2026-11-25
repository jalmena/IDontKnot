/**
 * Laying out a knot from its drawing. Every knot of the library is made again from its drawing here, and
 * must come out as the file the library holds: the files are what the tools write.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layOut, strandOf, tighteningFrames, documentDiagram, type KnotDocument, type Layout } from '../src/index.ts';

const library = new URL('../../../content/knots/', import.meta.url);
const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, library), 'utf8'));
const drawn = readdirSync(library, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/layout.json`, library)))
  .map((entry) => entry.name);

describe('the knots of the library', () => {
  it('all have a drawing', () => {
    const folders = readdirSync(library, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(drawn).toEqual(folders.map((folder) => folder.name));
  });

  it.each(drawn)(
    '%s is the document its drawing makes, and tightens as its file says',
    (id) => {
      const held = read(`${id}/knot.json`) as KnotDocument;
      const made = layOut(read(`${id}/layout.json`) as Layout);
      expect(made.id).toBe(id);
      expect(made.components).toEqual(held.components);
      expect(made.parts).toEqual(held.parts);
      expect(made.topology).toEqual(held.topology);
      expect(made.construction).toEqual(held.construction);
      expect(made.geometry?.frames[0]).toEqual(held.geometry?.frames[0]);

      const [first] = made.geometry?.frames ?? [];
      if (!first) throw new Error('a drawing makes a frame');
      const tightening = tighteningFrames(made, first);
      expect(held.geometry?.tightening).toEqual([first.id, ...tightening.map((frame) => frame.id)]);
      for (const frame of tightening) {
        const other = held.geometry?.frames.find((candidate) => candidate.id === frame.id);
        expect(other?.realises).toBe(frame.realises);
        const [mine, theirs] = [frame.curves['rope']?.points ?? [], other?.curves['rope']?.points ?? []];
        expect(theirs).toHaveLength(mine.length);
        mine.forEach((point, i) => {
          for (let c = 0; c < 4; c++) expect(theirs[i]?.[c]).toBeCloseTo(point[c] as number, 2);
        });
      }
    },
    30_000,
  );
});

describe('laying out a drawing', () => {
  // a loop: the rope goes round and passes over itself once
  const loop: Layout = {
    id: 'loop',
    rope: {},
    path: [
      [-6, 0],
      [0, 0, 'under'],
      [4, 1],
      [4, 5],
      [0, 6],
      [-1, 3],
      [0, 0, 'over'],
      [1, -4],
    ],
    parts: [{ id: 'eye', type: 'loop', from: { visit: 1, by: 1 }, to: { visit: 2, by: -1 } }],
  };

  it('reads the diagram from the shape, and places the parts by the crossings the rope meets', () => {
    const document = layOut(loop);
    const diagram = documentDiagram(document);
    if (!diagram) throw new Error('a drawing has a diagram');
    expect(strandOf(diagram, 'rope').map(([, pass]) => pass)).toEqual(['u', 'o']);
    const [rope] = document.components;
    const [eye] = document.parts ?? [];
    expect(rope).toMatchObject({ kind: 'rope', closed: false, radius: 0.5 });
    // the eye is the rope between its two passes of the crossing, less a diameter at each side
    expect(eye?.from).toBeGreaterThan(6);
    expect(eye?.to).toBeLessThan((rope?.length ?? 0) - 4);
    expect((eye?.to ?? 0) - (eye?.from ?? 0)).toBeGreaterThan(8);
    // the rope passes half its height above and below the plane at the crossing
    const heights = document.geometry?.frames[0]?.curves['rope']?.points.map((point) => point[2]);
    expect(heights).toEqual([0, -0.65, 0, 0, 0, 0, 0.65, 0]);
  });

  it('refuses a place at a crossing the rope does not meet', () => {
    const lost: Layout = { ...loop, parts: [{ id: 'eye', type: 'loop', from: 'start', to: { visit: 3 } }] };
    expect(() => layOut(lost)).toThrow(/no crossing 3/);
  });

  it('writes the steps of a method with the diagram each of them leaves', () => {
    const tied = layOut({
      ...loop,
      method: { id: 'with-the-end', start: 8, steps: [{ id: 'cross', op: 'cross', pass: 'over', to: 'end' }] },
    });
    const [method] = tied.construction?.methods ?? [];
    expect(method).toMatchObject({ frame: 'dressed', start: 8 });
    expect(method?.steps[0]).toMatchObject({ id: 'cross', actor: ['rope', 'end'], pass: 'over' });
    expect(method?.steps[0]?.result.crossings).toHaveLength(1);
  });
});
