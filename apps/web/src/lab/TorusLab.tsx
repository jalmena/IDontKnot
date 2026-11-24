import {
  closedBraid,
  diagramFromGeometry,
  embed,
  jonesPolynomial,
  strandOf,
  torusBraidWord,
  torusLink,
  writhe,
} from '@idontknot/core';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Diagram2D } from '../diagram/Diagram2D.tsx';
import { RopeSelect } from '../viewer/RopeSelect.tsx';
import { RopeView } from '../viewer/RopeView.tsx';
import { ropeColour, type RopeMaterialId } from '../viewer/materials.ts';
import type { RopeSpec } from '../viewer/RopeViewport.ts';
import { polynomialText } from './format.ts';
import { Polynomial } from './Polynomial.tsx';

/** The state sum doubles with every crossing; this keeps the page instant. */
const MAX_CROSSINGS = 14;

/** Names of torus knots in the standard tables. Identifiers, so they are not translated. */
const TABLE_NAMES: Readonly<Record<string, string>> = {
  '2,3': '3_1',
  '3,2': '3_1',
  '2,5': '5_1',
  '5,2': '5_1',
  '2,7': '7_1',
  '2,9': '9_1',
  '3,4': '8_19',
  '4,3': '8_19',
  '3,5': '10_124',
  '5,3': '10_124',
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function TorusLab() {
  const { t } = useTranslation();
  const [p, setP] = useState(2);
  const [q, setQ] = useState(3);
  const [material, setMaterial] = useState<RopeMaterialId>('jute');
  const pId = useId();
  const qId = useId();

  const loops = gcd(p, q);
  const crossingCount = (p - 1) * q;
  const tooLarge = crossingCount > MAX_CROSSINGS;

  const curves = useMemo(() => torusLink(p, q), [p, q]);
  const ropes = useMemo<RopeSpec[]>(
    () =>
      curves.map((curve, index) => ({
        points: curve.points,
        closed: true,
        radius: p >= 4 ? 0.13 : 0.17,
        material,
        index,
      })),
    [curves, p, material],
  );
  const facts = useMemo(() => {
    if (tooLarge) return null;
    const { diagram, visits } = diagramFromGeometry(curves);
    const word = torusBraidWord(p, q);
    return {
      diagram,
      visits,
      word,
      planar: embed(diagram).genus === 0,
      writhe: writhe(diagram),
      fromGeometry: jonesPolynomial(diagram),
      fromBraid: jonesPolynomial(closedBraid(word, p)),
    };
  }, [curves, tooLarge, p, q]);

  const agree = facts !== null && polynomialText(facts.fromGeometry) === polynomialText(facts.fromBraid);
  const tableName = loops === 1 ? TABLE_NAMES[`${p},${q}`] : undefined;

  return (
    <section className="lab" aria-labelledby="lab-title">
      <div className="lab__intro">
        <h1 id="lab-title">{t('lab.title')}</h1>
        <p>{t('lab.intro')}</p>
      </div>

      <div className="lab__stage">
        <RopeView ropes={ropes} label={t('lab.view.label', { p, q, count: loops })} />
        <form className="lab__controls" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor={pId}>{t('lab.p')}</label>
          <input
            id={pId}
            type="range"
            min={2}
            max={5}
            step={1}
            value={p}
            onChange={(event) => setP(Number(event.target.value))}
          />
          <output htmlFor={pId} data-testid="p-value">
            {p}
          </output>
          <label htmlFor={qId}>{t('lab.q')}</label>
          <input
            id={qId}
            type="range"
            min={2}
            max={9}
            step={1}
            value={q}
            onChange={(event) => setQ(Number(event.target.value))}
          />
          <output htmlFor={qId} data-testid="q-value">
            {q}
          </output>
          <RopeSelect value={material} onChange={setMaterial} className="lab__rope" />
        </form>
      </div>

      <div className="lab__facts panel" aria-live="polite">
        <h2>{t('lab.facts.title')}</h2>
        {loops > 1 && (
          <p className="lab__message" data-testid="link-note">
            {t('lab.link', { count: loops })}
          </p>
        )}
        {tooLarge && <p className="lab__message">{t('lab.tooLarge', { count: crossingCount, max: MAX_CROSSINGS })}</p>}
        {facts && (
          <figure className="lab__diagram">
            <Diagram2D
              curves={curves}
              visits={facts.visits}
              colours={curves.map((_, index) => ropeColour(material, index))}
              label={t('lab.diagram.label', { count: facts.diagram.crossings.length })}
            />
            <figcaption>{t('lab.diagram.caption')}</figcaption>
          </figure>
        )}
        {facts && (
          <dl>
            {tableName && (
              <>
                <dt>{t('lab.facts.tableName')}</dt>
                <dd className="code">{tableName}</dd>
              </>
            )}
            <dt>{t('lab.facts.loops')}</dt>
            <dd data-testid="loops">{loops}</dd>
            <dt>{t('lab.facts.crossings')}</dt>
            <dd data-testid="crossings">{facts.diagram.crossings.length}</dd>
            <dt>{t('lab.facts.writhe')}</dt>
            <dd>{facts.writhe > 0 ? `+${facts.writhe}` : facts.writhe}</dd>
            <dt>{t('lab.facts.planar')}</dt>
            <dd>{facts.planar ? t('lab.facts.yes') : t('lab.facts.no')}</dd>
            <dt>{t('lab.facts.braid')}</dt>
            <dd className="code">{facts.word.join(' ')}</dd>
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
            <dt>{t('lab.facts.jonesGeometry')}</dt>
            <dd>
              <Polynomial value={facts.fromGeometry} testId="jones-geometry" />
            </dd>
            <dt>{t('lab.facts.jonesBraid')}</dt>
            <dd>
              <Polynomial value={facts.fromBraid} testId="jones-braid" />
            </dd>
          </dl>
        )}
        {facts && (
          <p className={agree ? 'verdict verdict--ok' : 'verdict verdict--bad'} data-testid="verdict">
            {agree ? t('lab.facts.agree') : t('lab.facts.disagree')}
          </p>
        )}
      </div>
    </section>
  );
}
