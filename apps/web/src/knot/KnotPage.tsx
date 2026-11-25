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
} from '@idontknot/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Diagram2D } from '../diagram/Diagram2D.tsx';
import { Tabs, tabPanel } from '../Tabs.tsx';
import { ropeColour } from '../viewer/materials.ts';
import { useRope } from '../viewer/RopeChoice.tsx';
import { RopeSelect } from '../viewer/RopeSelect.tsx';
import { RopeView, VIEW_MARGINS } from '../viewer/RopeView.tsx';
import type { Stretch } from '../viewer/RopeViewport.ts';
import { KnotFacts } from './KnotFacts.tsx';
import { inLanguage, type LibraryKnot } from './library.ts';
import { boundsOf, partShape, pointAt } from './parts.ts';
import { timelineOf, type Timeline } from './playback.ts';
import { fitOf, ropesOf, shownFrame } from './shape.ts';
import { Tying } from './Tying.tsx';
import { usePlayback } from './usePlayback.ts';

interface Props {
  readonly knot: LibraryKnot;
}

type Tab = 'knot' | 'maths';

/** The room a name takes above the rope it names, in CSS pixels. */
const NAME_HEIGHT = 44;
const DIAGRAM_LINE = 0.36;
const DIAGRAM_TEXT = 0.62;
/** How far above its part a name is written on the diagram, and the room that takes at the top. */
const NAME_RISE = 1.2;
const NAME_ROOM = 1.4;
/** A knot that the library does not say how to tie. */
const NO_METHOD: Timeline = { start: 0, stops: [] };
const WHOLE: readonly number[] = [];
const NOTHING: readonly never[] = [];

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
  // another knot has other parts: none of them is chosen yet
  const [opened, setOpened] = useState(knot);
  if (opened !== knot) {
    setOpened(knot);
    setPinned(null);
    setPointed(null);
  }

  const frame = shownFrame(document) as Frame;
  const curves = useMemo(() => framePolylines(document, frame), [document, frame]);
  const ropes = useMemo(() => ropesOf(document, curves, material), [document, curves, material]);
  // the rope keeps the margins of the view, and leaves room above it for the names of its parts
  const fit = useMemo(() => fitOf(curves, { ...VIEW_MARGINS, top: VIEW_MARGINS.top + NAME_HEIGHT }), [curves]);

  const method = document.construction?.methods[0];
  const timeline = useMemo(() => (method ? timelineOf(method) : NO_METHOD), [method]);
  const { state, setState, speed, setSpeed } = usePlayback(timeline);
  const led = method?.steps[0]?.actor[0];
  const rope = curves.findIndex((curve) => curve.id === led);
  const length = document.components.find((component) => component.id === led)?.length ?? 1;
  const tied = !method || rope < 0 || state.position >= length - 1e-9;

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
      closure: jonesPolynomial(closeOpenComponents(diagram)),
    };
  }, [curves]);
  // the shape is the diagram it claims and keeps the rules of geometry; the steps follow from one another
  const shaped = useMemo(
    () => checkDocument(document).every((issue) => issue.level !== 'error') && checkFrame(document, frame).length === 0,
    [document, frame],
  );
  const told = useMemo(
    () => !method || checkMethod(document, method).every((issue) => issue.level !== 'error'),
    [document, method],
  );

  const emphasis = useMemo<Stretch[]>(
    () => parts.filter((part) => part.id === shown).map(({ rope: of, from, to }) => ({ rope: of, from, to })),
    [parts, shown],
  );
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
  const reach = useMemo(
    () => (tied ? WHOLE : curves.map((_, index) => (index === rope ? state.position / length : 1))),
    [tied, curves, rope, state.position, length],
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
          emphasis={emphasis}
          reach={reach}
          names={tied ? partNames : end}
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
              names={tied ? drawing.names : NOTHING}
            />
          }
        />
      </div>

      <div className="lab__facts panel" data-testid="panel" data-checked={shaped && told ? 'ok' : 'failed'}>
        <Tabs
          name="knot"
          label={t('knot.tabs.label')}
          tabs={[
            { id: 'knot', label: t('knot.tabs.knot') },
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
                    onClick={() => setPinned(pinned === part.id ? null : part.id)}
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
              />
            )}
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
