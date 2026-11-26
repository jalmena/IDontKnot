import {
  checkDocument,
  checkFrame,
  checkMethod,
  closeOpenComponents,
  cutCurve,
  diagramFromGeometry,
  framePolylines,
  jonesPolynomial,
  ropeEndsShareOneFace,
  strandOf,
  writhe,
  type Frame,
  type Point3,
} from '@idontknot/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Diagram2D } from '../diagram/Diagram2D.tsx';
import { Tabs, tabPanel } from '../Tabs.tsx';
import { ropeColour } from '../viewer/materials.ts';
import { useRope } from '../viewer/RopeChoice.tsx';
import { RopeSelect } from '../viewer/RopeSelect.tsx';
import { RopeView, VIEW_MARGINS } from '../viewer/RopeView.tsx';
import { LIGHT_FROM_ABOVE, LIGHT_FROM_THE_SIDE, type Stretch } from '../viewer/RopeViewport.ts';
import { useDiscipline } from '../DisciplineChoice.tsx';
import type { SceneObject } from '../viewer/things.ts';
import { KnotFacts } from './KnotFacts.tsx';
import { KnotUse } from './KnotUse.tsx';
import { plateFor, postFor } from './objects.ts';
import { inLanguage, type LibraryKnot } from './library.ts';
import { fed } from './feeding.ts';
import { boundsOf, partShape, pointAt } from './parts.ts';
import { timelineOf, type Timeline } from './playback.ts';
import { fitOf, ropesOf, shownFrame, withThings } from './shape.ts';
import { eased, shapeAt, tighteningOf, windowAt } from './tightening.ts';
import { Tying } from './Tying.tsx';
import { usePlayback } from './usePlayback.ts';
import { useTightness } from './useTightness.ts';

interface Props {
  readonly knot: LibraryKnot;
}

type Tab = 'knot' | 'use' | 'maths';

/** The room a name takes above the rope it names, in CSS pixels. */
const NAME_HEIGHT = 44;
const DIAGRAM_LINE = 0.36;
const DIAGRAM_TEXT = 0.62;
/** How far above its part a name is written on the diagram, and the room that takes at the top. */
const NAME_RISE = 1.2;
const NAME_ROOM = 1.4;
/** A knot that the library does not say how to tie. */
const NO_METHOD: Timeline = { start: 0, stops: [] };
const NOTHING: readonly never[] = [];
const NO_THINGS: readonly SceneObject[] = [];

/**
 * One knot of the library: in space and as a diagram, part by part, tied step by step, and as the core
 * reads it. The knot is shown tied, with its parts named, until it is played: then the rope is laid as far
 * as its end has come, and the end is what is named.
 */
export function KnotPage({ knot }: Props) {
  const { t, i18n } = useTranslation();
  const { document, entry } = knot;
  const language = i18n.resolvedLanguage ?? 'en';
  const title = inLanguage(entry.names, language);
  const [material, setMaterial] = useRope();
  const [tab, setTab] = useState<Tab>('knot');
  const [pinned, setPinned] = useState<string | null>(null);
  const [pointed, setPointed] = useState<string | null>(null);
  const shown = pointed ?? pinned;
  const { tight, amount, tighten, loosen, slacken } = useTightness();
  const [discipline] = useDiscipline();
  // whether the knot is shown tied to what it is tied to in the discipline
  const [placed, setPlaced] = useState(false);
  // another knot has other parts, and is as it was tied: none of them is chosen yet
  const [opened, setOpened] = useState(knot);
  if (opened !== knot) {
    setOpened(knot);
    setPinned(null);
    setPointed(null);
    setPlaced(false);
    slacken();
  }

  const frame = shownFrame(document) as Frame;
  const curves = useMemo(() => framePolylines(document, frame), [document, frame]);
  const method = document.construction?.methods[0];
  const timeline = useMemo(() => (method ? timelineOf(method) : NO_METHOD), [method]);
  const { state, setState, speed, setSpeed } = usePlayback(timeline);
  const led = method?.steps[0]?.actor[0];
  const rope = curves.findIndex((curve) => curve.id === led);
  const length = document.components.find((component) => component.id === led)?.length ?? 1;
  const tied = !method || rope < 0 || state.position >= length - 1e-9;

  // a knot that is being tightened, or is tight, is drawn in the shape it has come to; one that is being
  // tied, with its rope fed along the way of the knot from its standing part as its end is led
  const tightening = useMemo(() => tighteningOf(document), [document]);
  const pulled = tightening !== null && amount > 0;
  const ropes = useMemo(() => {
    if (tightening && amount > 0) {
      const points = shapeAt(tightening, eased(amount));
      return ropesOf(
        document,
        curves.map((curve) => (curve.id === tightening.rope ? { ...curve, points } : curve)),
        material,
      );
    }
    if (tied) return ropesOf(document, curves, material);
    return ropesOf(
      document,
      curves.map((curve, index) => (index === rope ? fed(curve, state.position, length) : curve)),
      material,
    );
  }, [document, curves, material, tightening, amount, tied, rope, state.position, length]);
  // what the knot is tied to, in the discipline, where the rope is as it is now: while the knot is being
  // tied, where it will be when it is
  const thing = (discipline ? entry.uses?.[discipline] : undefined)?.object;
  const objects = useMemo<readonly SceneObject[]>(() => {
    const [curve] = curves;
    const [component] = document.components;
    if (!placed || !curve || !component?.length || (thing !== 'plate' && thing !== 'post')) return NO_THINGS;
    const radius = component.radius ?? 0.5;
    let shape = { points: curve.points, s: curve.s, radius };
    if (tightening && amount > 0) {
      const points = shapeAt(tightening, eased(amount));
      shape = { points, s: points.map((_, k) => (k * (component.length as number)) / (points.length - 1)), radius };
    }
    if (thing === 'plate') return [plateFor(shape)];
    const eye = document.parts?.find((part) => part.type === 'eye');
    return eye ? [postFor(shape, [eye.from, eye.to])] : NO_THINGS;
  }, [placed, thing, curves, document, tightening, amount]);
  // the rope keeps the margins of the view, and leaves room above it for the names of its parts; as the
  // knot is tightened its ends run out of the view, which closes in on the knot
  const fit = useMemo(() => {
    const clear = { ...VIEW_MARGINS, top: VIEW_MARGINS.top + NAME_HEIGHT };
    return tightening && amount > 0
      ? withThings({ ...windowAt(tightening, eased(amount)), clear }, objects)
      : fitOf(curves, clear, objects);
  }, [curves, tightening, amount, objects]);
  // and the light goes up over it, so that strands that lie together are told apart
  const light = useMemo<Point3>(() => {
    const t = eased(amount);
    return [0, 1, 2].map((c) => LIGHT_FROM_THE_SIDE[c]! + (LIGHT_FROM_ABOVE[c]! - LIGHT_FROM_THE_SIDE[c]!) * t) as [
      number,
      number,
      number,
    ];
  }, [amount]);

  const parts = useMemo(
    () =>
      (document.parts ?? []).flatMap((part) => {
        const of = curves.findIndex((curve) => curve.id === part.component);
        const whole = document.components.find((component) => component.id === part.component)?.length;
        return of < 0 || !whole ? [] : [{ rope: of, ...partShape(part, curves[of]!, whole) }];
      }),
    [curves, document],
  );
  const facts = useMemo(() => {
    const { diagram, visits } = diagramFromGeometry(curves);
    const passes = diagram.components.flatMap((component) => strandOf(diagram, component.id).map(([, pass]) => pass));
    return {
      diagram,
      visits,
      alternating: passes.every((pass, i) => i === 0 || pass !== passes[i - 1]),
      writhe: writhe(diagram),
      endsOutside: ropeEndsShareOneFace(diagram),
      // what knot it is with its ends joined, for a document that takes its ends as held outside the knot
      closure: document.topology?.closure === 'exterior' ? jonesPolynomial(closeOpenComponents(diagram)) : null,
    };
  }, [curves, document]);
  // the shape is the diagram it claims and keeps the rules of geometry; the steps follow from one another
  const shaped = useMemo(
    () => checkDocument(document).every((issue) => issue.level !== 'error') && checkFrame(document, frame).length === 0,
    [document, frame],
  );
  const told = useMemo(
    () => !method || checkMethod(document, method).every((issue) => issue.level !== 'error'),
    [document, method],
  );

  // a part is a stretch of the rope as it lies when the knot is tied; while the rope is still being fed in,
  // the rope that lies there is further along it by what has not come in yet
  const emphasis = useMemo<Stretch[]>(() => {
    const behind = tied ? 0 : 1 - state.position / length;
    return parts
      .filter((part) => part.id === shown && (part.rope !== rope || part.from + behind < 1))
      .map(({ rope: of, from, to }) =>
        of === rope ? { rope: of, from: from + behind, to: Math.min(to + behind, 1) } : { rope: of, from, to },
      );
  }, [parts, shown, tied, rope, state.position, length]);
  const marked = useMemo(() => parts.filter((part) => part.id === shown).map((part) => part.points), [parts, shown]);
  const partNames = useMemo(
    () =>
      parts.map((part) => ({
        id: part.id,
        text: inLanguage(entry.parts[part.id], language) || part.id,
        at: part.anchor,
        marked: part.id === shown,
      })),
    [parts, shown, entry, language],
  );
  // while the knot is tied step by step, what is named is the end that is led
  const end = useMemo(
    () => [
      { id: 'end', text: t('knot.tying.end'), at: pointAt(curves[Math.max(rope, 0)]!, state.position), marked: true },
    ],
    [curves, rope, state.position, t],
  );
  // while the knot is tied, a part of the rope is named once the rope has been laid as far as its end
  const laidParts = useMemo(
    () =>
      new Set(
        parts
          .filter((part) => tied || part.rope !== rope || part.to * length <= state.position + 1e-6)
          .map((part) => part.id),
      ),
    [parts, tied, rope, length, state.position],
  );
  const laidNames = useMemo(
    () => [...partNames.filter((name) => laidParts.has(name.id)), ...end],
    [partNames, laidParts, end],
  );
  // on the diagram a name sits above its part; the name of an end of the rope is written outward from
  // where that end leaves the knot, so that it does not run over the knot, and the drawing makes room for it
  const drawing = useMemo(() => {
    const [minX, minY, maxX, maxY] = boundsOf(curves, 1.6);
    let room = 0;
    const placed = partNames.map(({ at, ...rest }, i) => {
      const { inner, outer } = parts[i]!;
      if (!inner || !outer || inner[0] === outer[0]) return { ...rest, at: [at[0], at[1] + NAME_RISE] as const };
      const leftward = outer[0] < inner[0];
      const width = rest.text.length * DIAGRAM_TEXT * 0.56 + 0.5;
      room = Math.max(room, leftward ? minX - (inner[0] - width) : inner[0] + width - maxX);
      return {
        ...rest,
        at: [inner[0], inner[1] + NAME_RISE] as const,
        anchor: leftward ? ('end' as const) : ('start' as const),
      };
    });
    // the same room on both sides, so that the knot stays in the middle as it is in the 3D view
    return { bounds: [minX - room, minY, maxX + room, maxY + NAME_ROOM] as const, names: placed };
  }, [curves, partNames, parts]);
  // the diagram of the rope as far as it is laid: the crossings made so far
  const laid = useMemo(() => {
    if (tied) return { curves, visits: facts.visits, crossings: facts.diagram.crossings.length };
    const cut = curves.map((curve, index) => (index === rope ? cutCurve(curve, state.position) : curve));
    const { diagram, visits } = diagramFromGeometry(cut);
    return { curves: cut, visits, crossings: diagram.crossings.length };
  }, [tied, curves, facts, rope, state.position]);

  return (
    <section className="lab" aria-labelledby="knot-title">
      <div className="lab__stage">
        <RopeView
          ropes={ropes}
          label={t(tied ? 'knot.view' : 'knot.tying.view', { name: title })}
          title={<h1 id="knot-title">{title}</h1>}
          corner={<RopeSelect value={material} onChange={setMaterial} />}
          fit={fit}
          subject={document}
          objects={objects}
          light={light}
          emphasis={pulled ? NOTHING : emphasis}
          names={pulled ? NOTHING : tied ? partNames : laidNames}
          diagram={
            <Diagram2D
              curves={laid.curves}
              visits={laid.visits}
              colours={curves.map((_, index) => ropeColour(material, index))}
              label={t('lab.diagram.label', { count: laid.crossings })}
              bounds={drawing.bounds}
              line={DIAGRAM_LINE}
              text={DIAGRAM_TEXT}
              marked={tied ? marked : NOTHING}
              names={drawing.names.filter((name) => laidParts.has(name.id))}
            />
          }
        />
      </div>

      <div
        className="lab__facts panel"
        data-testid="panel"
        data-checked={shaped && told ? 'ok' : 'failed'}
        data-tightened={Math.round(amount * 100) / 100}
      >
        <Tabs
          name="knot"
          label={t('knot.tabs.label')}
          tabs={[
            { id: 'knot', label: t('knot.tabs.knot') },
            { id: 'use', label: t('knot.tabs.use') },
            { id: 'maths', label: t('knot.tabs.maths') },
          ]}
          selected={tab}
          onSelect={setTab}
        />
        {tab === 'knot' ? (
          <div className="panel__live" {...tabPanel('knot', 'knot')}>
            <h2 id="knot-parts">{t('knot.parts.title')}</h2>
            <ul className="parts" aria-labelledby="knot-parts" data-testid="parts">
              {partNames.map((part) => (
                <li key={part.id}>
                  <button
                    type="button"
                    aria-pressed={pinned === part.id}
                    onClick={() => {
                      slacken();
                      setPinned(pinned === part.id ? null : part.id);
                    }}
                    onPointerEnter={() => setPointed(part.id)}
                    onPointerLeave={() => setPointed(null)}
                    onFocus={() => setPointed(part.id)}
                    onBlur={() => setPointed(null)}
                  >
                    {part.text}
                  </button>
                </li>
              ))}
            </ul>
            {method && (
              <Tying
                method={method}
                texts={entry.methods?.[method.id]}
                timeline={timeline}
                length={length}
                state={state}
                setState={setState}
                speed={speed}
                setSpeed={setSpeed}
                {...(tightening ? { tightening: { tight, tighten, loosen, slacken } } : {})}
              />
            )}
          </div>
        ) : tab === 'use' ? (
          <div className="panel__live" {...tabPanel('knot', 'use')}>
            <KnotUse entry={entry} discipline={discipline} shown={placed} onShow={setPlaced} />
          </div>
        ) : (
          <div className="panel__live" {...tabPanel('knot', 'maths')}>
            <KnotFacts facts={facts} material={material} />
          </div>
        )}
        {!(shaped && told) && (
          <p className="verdict" role="alert" data-testid="verdict">
            {t(shaped ? 'knot.tying.unsound' : 'knot.facts.unsound')}
          </p>
        )}
      </div>
    </section>
  );
}
