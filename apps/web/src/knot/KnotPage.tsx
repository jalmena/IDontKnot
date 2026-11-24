import {
  checkDocument,
  checkFrame,
  closeOpenComponents,
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
import { Polynomial } from '../lab/Polynomial.tsx';
import { ropeColour, type RopeMaterialId } from '../viewer/materials.ts';
import { RopeSelect } from '../viewer/RopeSelect.tsx';
import { RopeView } from '../viewer/RopeView.tsx';
import type { Fit, RopeSpec, Stretch } from '../viewer/RopeViewport.ts';
import { inLanguage, type LibraryKnot } from './library.ts';
import { boundsOf, partShape } from './parts.ts';

interface Props {
  readonly knot: LibraryKnot;
}

const DIAGRAM_LINE = 0.36;
const DIAGRAM_TEXT = 0.62;
/** How far above its part a name is written on the diagram, and the room that takes at the top. */
const NAME_RISE = 1.2;
const NAME_ROOM = 1.4;

/** One knot of the library, inspected: in space, as a diagram, part by part, and as the core reads it. */
export function KnotPage({ knot }: Props) {
  const { t, i18n } = useTranslation();
  const { document, entry } = knot;
  const language = i18n.resolvedLanguage ?? 'en';
  const title = inLanguage(entry.names, language);
  const [material, setMaterial] = useState<RopeMaterialId>('jute');
  const [pinned, setPinned] = useState<string | null>(null);
  const [pointed, setPointed] = useState<string | null>(null);
  const shown = pointed ?? pinned;

  const frame = document.geometry?.frames[0] as Frame;
  const curves = useMemo(() => framePolylines(document, frame), [document, frame]);
  const ropes = useMemo<RopeSpec[]>(
    () =>
      curves.map((curve, index) => ({
        points: curve.points,
        closed: curve.closed,
        radius: document.components.find((component) => component.id === curve.id)?.radius ?? 0.5,
        material,
        index,
      })),
    [curves, document, material],
  );
  const parts = useMemo(
    () =>
      (document.parts ?? []).flatMap((part) => {
        const rope = curves.findIndex((curve) => curve.id === part.component);
        const length = document.components.find((component) => component.id === part.component)?.length;
        return rope < 0 || !length ? [] : [{ rope, ...partShape(part, curves[rope]!, length) }];
      }),
    [curves, document],
  );
  // the rope fills the view from side to side, with a little air
  const fit = useMemo<Fit>(() => {
    const [minX, minY, maxX, maxY] = boundsOf(curves, 0.8);
    return { centre: [(minX + maxX) / 2, (minY + maxY) / 2, 0], width: maxX - minX, height: maxY - minY };
  }, [curves]);
  const facts = useMemo(() => {
    const { diagram, visits } = diagramFromGeometry(curves);
    const passes = diagram.components.flatMap((component) => strandOf(diagram, component.id).map(([, pass]) => pass));
    return {
      diagram,
      visits,
      sound:
        checkDocument(document).every((issue) => issue.level !== 'error') && checkFrame(document, frame).length === 0,
      alternating: passes.every((pass, i) => i === 0 || pass !== passes[i - 1]),
      writhe: writhe(diagram),
      endsOutside: ropeEndsShareOneFace(diagram),
      closure: jonesPolynomial(closeOpenComponents(diagram)),
    };
  }, [curves, document, frame]);

  const emphasis = useMemo<Stretch[]>(
    () => parts.filter((part) => part.id === shown).map(({ rope, from, to }) => ({ rope, from, to })),
    [parts, shown],
  );
  const marked = useMemo(() => parts.filter((part) => part.id === shown).map((part) => part.points), [parts, shown]);
  const names = useMemo(
    () =>
      parts.map((part) => ({
        id: part.id,
        text: inLanguage(entry.parts[part.id], language) || part.id,
        at: part.anchor,
        marked: part.id === shown,
      })),
    [parts, shown, entry, language],
  );
  // on the diagram a name sits above its part; the name of an end of the rope is written outward from
  // where that end leaves the knot, so that it does not run over the knot, and the drawing makes room for it
  const drawing = useMemo(() => {
    const [minX, minY, maxX, maxY] = boundsOf(curves, 1.6);
    let room = 0;
    const placed = names.map(({ at, ...rest }, i) => {
      const { inner, outer } = parts[i]!;
      if (!inner || !outer || inner[0] === outer[0]) return { ...rest, at: [at[0], at[1] + NAME_RISE] as const };
      const leftward = outer[0] < inner[0];
      const reach = rest.text.length * DIAGRAM_TEXT * 0.56 + 0.5;
      room = Math.max(room, leftward ? minX - (inner[0] - reach) : inner[0] + reach - maxX);
      return {
        ...rest,
        at: [inner[0], inner[1] + NAME_RISE] as const,
        anchor: leftward ? ('end' as const) : ('start' as const),
      };
    });
    // the same room on both sides, so that the knot stays in the middle as it is in the 3D view
    return { bounds: [minX - room, minY, maxX + room, maxY + NAME_ROOM] as const, names: placed };
  }, [curves, names, parts]);

  return (
    <section className="lab" aria-labelledby="knot-title">
      <div className="lab__stage">
        <RopeView
          ropes={ropes}
          label={t('knot.view', { name: title })}
          title={<h1 id="knot-title">{title}</h1>}
          fit={fit}
          emphasis={emphasis}
          names={names}
          diagram={
            <Diagram2D
              curves={curves}
              visits={facts.visits}
              colours={curves.map((_, index) => ropeColour(material, index))}
              label={t('lab.diagram.label', { count: facts.diagram.crossings.length })}
              bounds={drawing.bounds}
              line={DIAGRAM_LINE}
              text={DIAGRAM_TEXT}
              marked={marked}
              names={drawing.names}
            />
          }
        />
      </div>

      <div className="lab__facts panel" aria-live="polite">
        <form className="controls" onSubmit={(event) => event.preventDefault()}>
          <RopeSelect value={material} onChange={setMaterial} />
        </form>

        <h2 id="knot-parts">{t('knot.parts.title')}</h2>
        <ul className="parts" aria-labelledby="knot-parts" data-testid="parts">
          {names.map((part) => (
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

        <h2>{t('lab.facts.title')}</h2>
        <dl className="facts" data-testid="facts" data-checked={facts.sound ? 'ok' : 'failed'}>
          <div>
            <dt>{t('lab.facts.crossings')}</dt>
            <dd data-testid="crossings">{facts.diagram.crossings.length}</dd>
          </div>
          <div>
            <dt>{t('lab.facts.writhe')}</dt>
            <dd>{facts.writhe > 0 ? `+${facts.writhe}` : facts.writhe}</dd>
          </div>
          <div>
            <dt>{t('knot.facts.alternating')}</dt>
            <dd>{facts.alternating ? t('lab.facts.yes') : t('lab.facts.no')}</dd>
          </div>
          <div>
            <dt>{t('knot.facts.endsOutside')}</dt>
            <dd>{facts.endsOutside ? t('lab.facts.yes') : t('lab.facts.no')}</dd>
          </div>
          <div className="facts__wide">
            <dt>
              {t('lab.facts.code')}
              <small>{t('lab.facts.codeHelp')}</small>
            </dt>
            <dd className="code">
              {facts.diagram.components.map((component, index) => (
                <span key={component.id} className="code__line">
                  <span className="swatch" style={{ background: ropeColour(material, index) }} aria-hidden="true" />
                  {strandOf(facts.diagram, component.id)
                    .map(([crossing, pass]) => `${crossing.slice(1)}${pass}`)
                    .join(' ')}
                </span>
              ))}
            </dd>
          </div>
          <div className="facts__wide">
            <dt>{t('knot.facts.closure')}</dt>
            <dd>
              <Polynomial value={facts.closure} testId="jones-closure" />
            </dd>
          </div>
        </dl>
        {!facts.sound && (
          <p className="verdict" role="alert" data-testid="verdict">
            {t('knot.facts.unsound')}
          </p>
        )}
      </div>
    </section>
  );
}
