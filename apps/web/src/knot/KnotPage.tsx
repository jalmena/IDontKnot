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

const DIAGRAM_LINE = 0.42;
const DIAGRAM_TEXT = 0.5;
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
  const bounds = useMemo(() => boundsOf(curves, 1.6), [curves]);
  const fit = useMemo<Fit>(
    () => ({
      centre: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 0],
      width: bounds[2] - bounds[0],
      height: bounds[3] - bounds[1],
    }),
    [bounds],
  );
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
  const length = document.components.find((component) => component.kind === 'rope')?.length;

  return (
    <section className="knot" aria-labelledby="knot-title">
      <div className="knot__head">
        <h1 id="knot-title">{title}</h1>
        <form className="knot__rope" onSubmit={(event) => event.preventDefault()}>
          <RopeSelect value={material} onChange={setMaterial} />
        </form>
      </div>

      <RopeView
        ropes={ropes}
        label={t('knot.view', { name: title })}
        fit={fit}
        emphasis={emphasis}
        names={names}
        wide
      />

      <figure className="knot__diagram">
        <Diagram2D
          curves={curves}
          visits={facts.visits}
          colours={curves.map((_, index) => ropeColour(material, index))}
          label={t('lab.diagram.label', { count: facts.diagram.crossings.length })}
          bounds={[bounds[0], bounds[1], bounds[2], bounds[3] + NAME_ROOM]}
          line={DIAGRAM_LINE}
          text={DIAGRAM_TEXT}
          marked={marked}
          names={names.map(({ at, ...rest }) => ({ ...rest, at: [at[0], at[1] + NAME_RISE] as const }))}
        />
        <figcaption>{t('lab.diagram.caption')}</figcaption>
      </figure>

      <div className="knot__parts">
        <h2 id="knot-parts">{t('knot.parts.title')}</h2>
        <ul aria-labelledby="knot-parts" data-testid="parts">
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
        <p className="knot__hint">{t('knot.parts.hint')}</p>
      </div>

      <div className="knot__facts panel" aria-live="polite">
        <h2>{t('lab.facts.title')}</h2>
        <dl>
          <dt>{t('lab.facts.crossings')}</dt>
          <dd data-testid="crossings">{facts.diagram.crossings.length}</dd>
          <dt>{t('knot.facts.alternating')}</dt>
          <dd>{facts.alternating ? t('lab.facts.yes') : t('lab.facts.no')}</dd>
          <dt>{t('lab.facts.writhe')}</dt>
          <dd>{facts.writhe > 0 ? `+${facts.writhe}` : facts.writhe}</dd>
          <dt>{t('knot.facts.endsOutside')}</dt>
          <dd>{facts.endsOutside ? t('lab.facts.yes') : t('lab.facts.no')}</dd>
          {length !== undefined && (
            <>
              <dt>{t('knot.facts.length')}</dt>
              <dd>{t('knot.facts.diameters', { count: Math.round(length) })}</dd>
            </>
          )}
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
          <dt>{t('knot.facts.closure')}</dt>
          <dd>
            <Polynomial value={facts.closure} testId="jones-closure" />
          </dd>
        </dl>
        <p className={facts.sound ? 'verdict verdict--ok' : 'verdict verdict--bad'} data-testid="verdict">
          {facts.sound ? t('knot.facts.sound') : t('knot.facts.unsound')}
        </p>
      </div>
    </section>
  );
}
