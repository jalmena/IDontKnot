/**
 * Laying out a knot from its drawing. Every knot of the library is made again from its drawing here, and
 * must come out as the file the library holds: the files are what the tools write.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkDocument,
  documentDiagram,
  framePolylines,
  layOut,
  strandOf,
  tighteningFrames,
  type KnotDocument,
  type Point3,
  type Layout,
} from '../src/index.ts';

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
      const layout = read(`${id}/layout.json`) as Layout;
      const made = layOut(layout);
      expect(made.id).toBe(id);
      expect(made.components).toEqual(held.components);
      expect(made.parts).toEqual(held.parts);
      expect(made.topology).toEqual(held.topology);
      expect(made.construction).toEqual(held.construction);
      expect(made.geometry?.frames[0]).toEqual(held.geometry?.frames[0]);

      const [first] = made.geometry?.frames ?? [];
      if (!first) throw new Error('a drawing makes a frame');
      if (layout.tightening === false) {
        expect(held.geometry?.tightening).toBeUndefined();
        expect(held.geometry?.frames).toHaveLength(1);
        return;
      }
      const tightening = tighteningFrames(made, first, layout.tightening);
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
    // a knot tied in a bight is drawn tight as a flat pair, which takes long; a tie round a column, its ends
    // drawn a thousand times, the longest
    180_000,
  );
});

describe('the bowline of the library', () => {
  const bowline = read('bowline/knot.json') as KnotDocument;

  it('makes no claim about the knot its rope would be with its ends joined: its tail is inside its eye', () => {
    expect(bowline.topology?.closure).toBeUndefined();
    expect((read('figure-eight/knot.json') as KnotDocument).topology?.closure).toBe('exterior');
    // and a document that did claim it would be refused
    const claimed = { ...bowline, topology: { ...bowline.topology!, closure: 'exterior' } };
    expect(checkDocument(claimed).map((issue) => issue.rule)).toEqual(['T5']);
    expect(checkDocument(bowline)).toEqual([]);
  });

  it('keeps its eye open when it is tightened, and draws the knot round it tight', () => {
    const frames = bowline.geometry?.frames ?? [];
    const [dressed, tight] = [frames[0], frames.find((frame) => frame.id === 'tight')];
    const eye = bowline.parts?.find((part) => part.type === 'eye');
    if (!dressed || !tight || !eye) throw new Error('the bowline has its shapes and its eye');
    const across = (frame: typeof dressed): number => {
      const [curve] = framePolylines(bowline, frame);
      const inEye = (curve?.points ?? []).filter(
        (_, i) => (curve?.s[i] ?? 0) > eye.from && (curve?.s[i] ?? 0) < eye.to,
      );
      const ys = inEye.map((point) => point[1]);
      return Math.max(...ys) - Math.min(...ys);
    };
    // the eye is as wide tight as it was tied, near enough
    expect(across(tight) / across(dressed)).toBeGreaterThan(0.8);
    // while the knot itself gives rope: the two ends are further apart
    const span = (frame: typeof dressed): number => {
      const points = frame.curves['rope']?.points ?? [];
      return Math.abs((points.at(-1)?.[0] ?? 0) - (points[0]?.[0] ?? 0));
    };
    expect(span(tight)).toBeGreaterThan(span(dressed) + 5);
  });
});

describe('the single column tie of the library', () => {
  const tie = read('single-column-tie/knot.json') as KnotDocument;

  it('draws only its knot tight: its turns stay round the column, its standing part is drawn down, its bight up', () => {
    const frames = tie.geometry?.frames ?? [];
    const [tied, tight] = [frames[0], frames.find((frame) => frame.id === 'tight')];
    const turns = tie.parts?.find((part) => part.type === 'turn');
    if (!tied || !tight || !turns) throw new Error('the tie has its shapes and its turns');
    const [before, after] = [tied, tight].map((frame) => framePolylines(tie, frame).find((c) => c.id === 'rope'));
    if (!before || !after) throw new Error('the tie has its rope');
    // every point of the turns, short of where they begin and end, is where a point of the rope still is
    let moved = 0;
    before.points.forEach((point, i) => {
      if ((before.s[i] as number) < turns.from + 3 || (before.s[i] as number) > turns.to - 3) return;
      const nearest = Math.min(...after.points.map((other) => Math.hypot(...point.map((x, c) => x - other[c]!))));
      moved = Math.max(moved, nearest);
    });
    expect(moved).toBeLessThan(0.15);
    // the ends of the rope, its standing part, are drawn down, and its middle, the bight, up
    const at = (curve: typeof before, s: number): Point3 =>
      curve.points[curve.s.findIndex((each) => each >= s)] as Point3;
    const half = (before.s.at(-1) as number) / 2;
    expect(at(after, 0)[1]).toBeLessThan(at(before, 0)[1] - 3);
    expect((after.points.at(-1) as Point3)[1]).toBeLessThan((before.points.at(-1) as Point3)[1] - 3);
    expect(at(after, half)[1]).toBeGreaterThan(at(before, half)[1] + 3);
  });
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

describe('a drawing of a rope tied round a thing', () => {
  const layout: Layout = {
    id: 'round-a-post',
    rope: { radius: 0.5 },
    things: [{ id: 'post', from: [0, -3, 0], to: [0, 3, 0], radius: 1 }],
    path: [
      [-6, 0, 0],
      [-2, 0.2, 2],
      [0, 0.3, 2],
      [2, 0.4, 2],
      [6, 0.5, 0],
    ],
  };
  const document = layOut(layout);

  it('makes the thing a straight rigid component, with its radius and length', () => {
    expect(document.components[1]).toEqual({ id: 'post', kind: 'rigid', closed: false, radius: 1, length: 6 });
    const axis = document.geometry?.frames[0]?.curves['post'];
    expect(axis?.type).toBe('polyline');
    expect(axis?.points[0]).toEqual([0, -3, 0, 0]);
    expect(axis?.points.at(-1)).toEqual([0, 3, 0, 6]);
  });

  it('meets the thing where the rope passes over it, as a crossing of the diagram', () => {
    const strands = document.topology?.diagram.strands ?? {};
    expect(strands['rope']).toHaveLength(1);
    expect(strands['rope']?.[0]?.[1]).toBe('o');
    expect(strands['post']?.[0]?.[1]).toBe('u');
  });
});
