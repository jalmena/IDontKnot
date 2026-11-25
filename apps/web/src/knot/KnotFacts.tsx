import { strandOf, type Diagram } from '@idontknot/core';
import { useTranslation } from 'react-i18next';
import { Polynomial } from '../lab/Polynomial.tsx';
import { ropeColour, type RopeMaterialId } from '../viewer/materials.ts';

export interface Facts {
  readonly diagram: Diagram;
  readonly alternating: boolean;
  readonly writhe: number;
  readonly endsOutside: boolean;
  /** The Jones polynomial of the knot with its ends joined, as the core returns it. */
  readonly closure: Readonly<Record<string, number>>;
}

interface Props {
  readonly facts: Facts;
  /** The rope the knot is drawn in: each loop is marked with its colour. */
  readonly material: RopeMaterialId;
}

/** What the core computes for a knot of the library, from its shape in space. */
export function KnotFacts({ facts, material }: Props) {
  const { t } = useTranslation();
  return (
    <dl className="facts" data-testid="facts">
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
  );
}
