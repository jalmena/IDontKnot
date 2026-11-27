/**
 * Tightening: the shapes a rope passes through as its knot is drawn tight, and the frames of the library
 * that hold them. The figure-eight knot is tightened once here, and everything is asked of that one run.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkDocument,
  checkFrame,
  framePolylines,
  holesSeen,
  TIGHT_FRAME,
  tighten,
  tighteningFrames,
  type Frame,
  type KnotDocument,
  type Point3,
} from '../src/index.ts';

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const knot = read('../../../content/knots/figure-eight/knot.json') as KnotDocument;
const frames = knot.geometry?.frames ?? [];
const dressed = frames.find((frame) => frame.id === knot.geometry?.tightening?.[0]) as Frame;
const [curve] = framePolylines(knot, dressed);
if (!curve) throw new Error('the figure-eight knot has a rope');
const { radius = 0.5, length = 0 } = knot.components[0] ?? {};

const between = (a: Point3, b: Point3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const tightening = tighten(curve.points, curve.s, radius);
const made = tighteningFrames(knot, dressed);

describe('tightening a rope', () => {
  it('keeps the shapes on the way, and the tightest last: as many as asked, and more where the rope goes round itself', () => {
    expect(tightening.shapes.length).toBeGreaterThanOrEqual(12);
    expect(tightening.shapes.length).toBeLessThanOrEqual(24);
    expect(tighten(curve.points, curve.s, radius, { keep: 2 }).shapes.length).toBeGreaterThanOrEqual(3);
  }, 30_000);

  it('does not stretch the rope: its particles stay at their distances along it', () => {
    for (const shape of tightening.shapes) {
      expect(shape).toHaveLength(Math.round(length / tightening.spacing) + 1);
      for (let i = 1; i < shape.length; i++) {
        expect(between(shape[i - 1] as Point3, shape[i] as Point3)).toBeCloseTo(tightening.spacing, 2);
      }
    }
  });

  it('gives the rope of the knot to its two ends, a little more with each shape', () => {
    const span = (shape: readonly Point3[]): number => between(shape[0] as Point3, shape.at(-1) as Point3);
    const spans = [between(curve.points[0] as Point3, curve.points.at(-1) as Point3), ...tightening.shapes.map(span)];
    // closing the last holes of the knot takes back a little, less than a diameter
    for (let k = 1; k < spans.length; k++) expect(spans[k]).toBeGreaterThan((spans[k - 1] as number) - 2 * radius);
    expect(spans.at(-1)).toBeGreaterThan(Math.max(...spans) - 2 * radius);
    expect(spans[3]).toBeGreaterThan((spans[0] as number) + 10 * radius);
    // tied loosely, the ends are twenty diameters apart; tight, the knot keeps less than a third of the rope
    expect(spans.at(-1)).toBeGreaterThan((2 / 3) * length);
  });

  it('presses the rope a tenth thinner where it bears on itself, and no more, in any shape', () => {
    const neighbours = Math.round((Math.PI * 2 * radius) / tightening.spacing);
    for (const shape of tightening.shapes) {
      let nearest = Infinity;
      for (let i = 0; i < shape.length; i++) {
        for (let j = i + neighbours; j < shape.length; j++) {
          nearest = Math.min(nearest, between(shape[i] as Point3, shape[j] as Point3));
        }
      }
      expect(nearest).toBeGreaterThan(0.89 * 2 * radius);
    }
    // the tightest shape does press it: a rope that kept all its thickness would leave the knot looser
    const tightest = tightening.shapes.at(-1) as readonly Point3[];
    let nearest = Infinity;
    for (let i = 0; i < tightest.length; i++) {
      for (let j = i + neighbours; j < tightest.length; j++) {
        nearest = Math.min(nearest, between(tightest[i] as Point3, tightest[j] as Point3));
      }
    }
    expect(nearest).toBeLessThan(0.95 * 2 * radius);
  });

  it('is looser when the rope is to keep all its thickness', () => {
    const span = (shape: readonly Point3[] | undefined): number =>
      shape ? between(shape[0] as Point3, shape.at(-1) as Point3) : 0;
    const hard = tighten(curve.points, curve.s, radius, { nearest: 0.985, sharpest: 0.53, keep: 0 });
    expect(span(hard.shapes.at(-1))).toBeLessThan(span(tightening.shapes.at(-1)));
    // it tries to close the holes such a rope leaves, and gives up
  }, 30_000);
});

describe('the frames of a tightening', () => {
  it('are frames that keep every rule, and the tightest is still the knot', () => {
    expect(made.map((frame) => frame.id)).toEqual([
      ...made.slice(0, -1).map((_, k) => `tightening-${k + 1}`),
      TIGHT_FRAME,
    ]);
    const document = { ...knot, geometry: { frames: [dressed, ...made] } };
    for (const frame of made) expect(checkFrame(document, frame)).toEqual([]);
    // each says that it presses the rope a tenth thinner; without saying so, the tightest would not pass
    for (const frame of made) expect(frame.pressed).toBe(0.1);
    const unsaid: Frame = { ...(made.at(-1) as Frame), pressed: 0 };
    expect(checkFrame(document, unsaid).map((issue) => issue.rule)).toContain('G2');
    // seen from the front, the tight knot is the same diagram as the knot it was tied as
    expect(made.at(-1)?.realises).toBe('topology');
    expect(made.slice(0, -1).every((frame) => frame.realises === undefined)).toBe(true);
  });

  it('are the ones the library holds: its file is what the tool writes', () => {
    expect(knot.geometry?.tightening).toEqual([dressed.id, ...made.map((frame) => frame.id)]);
    for (const frame of made) {
      const held = frames.find((candidate) => candidate.id === frame.id);
      expect(held?.realises).toBe(frame.realises);
      const [mine, theirs] = [frame.curves['rope']?.points ?? [], held?.curves['rope']?.points ?? []];
      expect(theirs).toHaveLength(mine.length);
      mine.forEach((point, i) => {
        for (let c = 0; c < 4; c++) expect(theirs[i]?.[c]).toBeCloseTo(point[c] as number, 2);
      });
    }
  });

  it('are not made for a document that is not one open rope', () => {
    const [rope] = knot.components;
    if (!rope) throw new Error('the figure-eight knot has a rope');
    expect(tighteningFrames({ ...knot, components: [{ ...rope, closed: true }] }, dressed)).toEqual([]);
    expect(tighteningFrames({ ...knot, components: [rope, { ...rope, id: 'other' }] }, dressed)).toEqual([]);
  });

  it('must be frames of the document, and at least the first and the last', () => {
    const rules = (document: KnotDocument) => checkDocument(document).map((issue) => issue.rule);
    expect(rules(knot)).toEqual([]);
    expect(rules({ ...knot, geometry: { frames, tightening: [dressed.id, 'missing'] } })).toEqual(['shape']);
    expect(rules({ ...knot, geometry: { frames, tightening: [dressed.id] } })).toEqual(['shape']);
    // a rope cannot be pressed to half its thickness, or to more than it has
    const pressed = (amount: number): KnotDocument => ({
      ...knot,
      geometry: { frames: frames.map((frame) => (frame.id === dressed.id ? { ...frame, pressed: amount } : frame)) },
    });
    expect(rules(pressed(0.2))).toEqual([]);
    expect(rules(pressed(0.5))).toEqual(['shape']);
    expect(rules(pressed(-0.1))).toEqual(['shape']);
  });
});

describe('tightening round a thing', () => {
  // the clove hitch is tied round a post, which is a component of its document
  const hitch = read('../../../content/knots/clove-hitch/knot.json') as KnotDocument;
  const [first] = hitch.geometry?.frames ?? [];
  if (!first) throw new Error('the clove hitch has a frame');
  const hitchFrames = tighteningFrames(hitch, first);
  const post = hitch.components.find((component) => component.kind === 'rigid');

  it('is made for one rope and the things it is tied round', () => {
    expect(post?.id).toBe('post');
    expect(hitchFrames.length).toBeGreaterThan(1);
  });

  it('leaves the thing where it is, in every frame', () => {
    for (const frame of hitchFrames) expect(frame.curves['post']).toEqual(first.curves['post']);
  });

  it('keeps the rope out of the thing, and every rule of a frame', () => {
    const document = { ...hitch, geometry: { frames: [first, ...hitchFrames] } };
    for (const frame of hitchFrames) {
      expect(checkFrame(document, frame), frame.id).toEqual([]);
      const [rope] = framePolylines(document, frame);
      // the post stands along y through the origin: the rope keeps to its own radius and the post's
      for (const [x, , z] of rope?.points ?? [])
        expect(Math.hypot(x, z)).toBeGreaterThan(0.9 * (0.5 + (post?.radius ?? 0)));
    }
  });

  it('draws the rope tight by its ends', () => {
    const ends = (frame: Frame): number => {
      const [rope] = framePolylines({ ...hitch, geometry: { frames: [frame] } }, frame);
      return between(rope?.points[0] as Point3, rope?.points.at(-1) as Point3);
    };
    expect(ends(hitchFrames.at(-1) as Frame)).toBeGreaterThan(ends(first) + 0.5);
  });

  it('does not say the tightest realises the topology when, seen from the front, it does not', () => {
    const tightest = hitchFrames.at(-1) as Frame;
    const document = { ...hitch, geometry: { frames: [first, ...hitchFrames] } };
    if (tightest.realises) expect(checkFrame(document, tightest)).toEqual([]);
    else expect(checkFrame(document, { ...tightest, realises: 'topology' }).map((issue) => issue.rule)).toContain('G4');
  });
});

describe('tightening a knot tied in a bight', () => {
  // the figure-eight loop is the figure-eight knot tied in a doubled rope: drawn tight, it must stay dressed
  const loop = read('../../../content/knots/figure-eight-loop/knot.json') as KnotDocument;
  const tight = loop.geometry?.frames.find((frame) => frame.id === TIGHT_FRAME) as Frame;
  const [rope] = framePolylines(loop, tight);
  const eye = loop.parts?.find((part) => part.type === 'eye');
  if (!rope || !eye) throw new Error('the figure-eight loop has a rope and an eye');
  const indices = rope.points.map((_, i) => i);
  const first = indices.filter((i) => (rope.s[i] as number) < eye.from - 0.5);
  const second = indices.filter((i) => (rope.s[i] as number) > eye.to + 0.5);

  it('keeps its two strands together all the way, and in its bends the outer one behind the inner: dressed', () => {
    // each point of the first strand, and its fellow on the second, followed back from the end of the rope
    let fellow = second.at(-1) as number;
    let [bends, tucked] = [0, 0];
    for (const i of first) {
      let [best, at] = [Infinity, fellow];
      for (
        let j = Math.max(fellow - 40, second[0] as number);
        j <= Math.min(fellow + 40, second.at(-1) as number);
        j++
      ) {
        const apart = between(rope.points[i] as Point3, rope.points[j] as Point3);
        if (apart < best) [best, at] = [apart, j];
      }
      fellow = at;
      expect(best).toBeLessThan(1.3);
      // where the first strand bends round a circle of six diameters or less, measured over three either side,
      // which of the two is on the outside
      const [a, b] = [rope.points[i] as Point3, rope.points[at] as Point3];
      const along = (s: number): Point3 | undefined => rope.points[rope.s.findIndex((each) => each >= s)];
      const [before, after] = [along((rope.s[i] as number) - 3), along((rope.s[i] as number) + 3)];
      if ((rope.s[i] as number) < 3 || !before || !after) continue;
      const bend = [before[0] + after[0] - 2 * a[0], before[1] + after[1] - 2 * a[1]] as const;
      if (Math.hypot(bend[0], bend[1]) < 9 / 6) continue;
      bends++;
      const inside = (b[0] - a[0]) * bend[0] + (b[1] - a[1]) * bend[1] > 0;
      const [outer, inner] = inside ? [a, b] : [b, a];
      if (outer[2] < inner[2] - 0.05) tucked++;
    }
    expect(bends).toBeGreaterThan(100);
    expect(tucked / bends).toBeGreaterThan(0.95);
  });
});

describe('the holes a rope leaves seen from the front', () => {
  // a circle of rope, from above, as so many points along it
  const ring = (centre: number, r: number, from = 0, to = 2 * Math.PI): { points: Point3[]; s: number[] } => {
    const points: Point3[] = [];
    const s: number[] = [];
    for (let k = 0; k <= 400; k++) {
      const a = from + ((to - from) * k) / 400;
      points.push([centre + r * Math.cos(a), r * Math.sin(a), 0]);
      s.push(r * (a - from));
    }
    return { points, s };
  };

  it('finds the hole in a ring of rope, as wide as the ring is inside', () => {
    const { points, s } = ring(0, 3);
    const { area, holes } = holesSeen(points, s, 0.5);
    expect(holes).toHaveLength(1);
    // seen when a circle a twentieth of a diameter across fits in it: its edge is drawn in by half that
    expect(area).toBeCloseTo(Math.PI * (3 - 0.5 - 0.025) ** 2, 0);
    expect(holes[0]?.x).toBeCloseTo(0, 1);
    expect(holes[0]?.y).toBeCloseTo(0, 1);
  });

  it('finds none in a ring that is not closed, nor in one whose closing is left out, as an eye', () => {
    const open = ring(0, 3, 0.3, 2 * Math.PI - 0.3);
    expect(holesSeen(open.points, open.s, 0.5).area).toBe(0);
    const { points, s } = ring(0, 3);
    expect(holesSeen(points, s, 0.5, { leaveOut: [3, 6] }).area).toBe(0);
  });

  it('counts a thing it is tied round as solid', () => {
    const { points, s } = ring(0, 1.6);
    expect(holesSeen(points, s, 0.5).area).toBeGreaterThan(0);
    // a post across the ring, seen from the front, fills all of it that a circle could be seen through
    const across = { from: [-3, 0, 0] as Point3, to: [3, 0, 0] as Point3, radius: 1.05 };
    expect(holesSeen(points, s, 0.5, { around: [across] }).area).toBe(0);
  });

  it('does not see a hole narrower than a twentieth of a diameter: the line between two ropes that touch', () => {
    // rings whose hole is a little narrower, and a little wider, than that
    const narrow = ring(0, 0.5 + 0.02);
    expect(holesSeen(narrow.points, narrow.s, 0.5).area).toBe(0);
    const wide = ring(0, 0.5 + 0.06);
    expect(holesSeen(wide.points, wide.s, 0.5).area).toBeGreaterThan(0);
  });
});

describe('a knot of one rope drawn tight', () => {
  const single = [
    'overhand',
    'double-overhand',
    'figure-eight',
    'figure-eight-loop',
    'bowline',
    'clove-hitch',
    'larks-head',
  ];
  it.each(single)('%s leaves no hole seen from the front', (id) => {
    const document = read(`../../../content/knots/${id}/knot.json`) as KnotDocument;
    const tight = document.geometry?.frames.find((frame) => frame.id === TIGHT_FRAME) as Frame;
    const curves = framePolylines(document, tight);
    const rope = document.components.find((component) => component.kind === 'rope');
    const line = curves.find((each) => each.id === rope?.id);
    if (!rope || !line) throw new Error(`${id} has a rope`);
    const eye = document.parts?.find((part) => part.type === 'eye');
    const around = document.components
      .filter((component) => component.kind === 'rigid')
      .map((component) => {
        const axis = curves.find((each) => each.id === component.id);
        return { from: axis?.points[0] as Point3, to: axis?.points.at(-1) as Point3, radius: component.radius ?? 0.5 };
      });
    const { area } = holesSeen(line.points, line.s, rope.radius ?? 0.5, {
      ...(eye ? { leaveOut: [eye.from, eye.to] as const } : {}),
      around,
    });
    // a speck or two at most, where three strands meet
    expect(area).toBeLessThan(0.05);
  });
});

describe('a knot drawn tight by its standing part alone', () => {
  it('lengthens both its ends: the end of the timber hitch is not drawn into its twists', () => {
    const hitch = read('../../../content/knots/timber-hitch/knot.json') as KnotDocument;
    const frames = hitch.geometry?.frames ?? [];
    const tied = frames.find((frame) => frame.id === hitch.geometry?.tightening?.[0]) as Frame;
    const tight = frames.find((frame) => frame.id === TIGHT_FRAME) as Frame;
    // how far each end of the rope is from the axis of the post
    const ends = (frame: Frame): [number, number] => {
      const curves = framePolylines(hitch, frame);
      const rope = curves.find((curve) => curve.id === 'rope');
      const post = curves.find((curve) => curve.id === 'post');
      if (!rope || !post) throw new Error('the timber hitch has its rope and its post');
      const [from, to] = [post.points[0] as Point3, post.points.at(-1) as Point3];
      const axis = [to[0] - from[0], to[1] - from[1], to[2] - from[2]] as const;
      const away = (point: Point3): number => {
        const v = [point[0] - from[0], point[1] - from[1], point[2] - from[2]] as const;
        const t = (v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2]) / (axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
        return Math.hypot(v[0] - t * axis[0], v[1] - t * axis[1], v[2] - t * axis[2]);
      };
      return [away(rope.points[0] as Point3), away(rope.points.at(-1) as Point3)];
    };
    const [[start, end], [startTight, endTight]] = [ends(tied), ends(tight)];
    expect(startTight).toBeGreaterThan(start + 1);
    expect(endTight).toBeGreaterThan(end + 1);
  });
});
