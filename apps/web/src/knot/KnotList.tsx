import { framePolylines } from '@idontknot/core';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { byLabel } from '../lab/format.ts';
import { Link } from '../route.tsx';
import type { RopeMaterialId } from '../viewer/materials.ts';
import { pictureOf } from '../viewer/pictures.ts';
import { useRope } from '../viewer/RopeChoice.tsx';
import { inLanguage, KNOTS, type LibraryKnot } from './library.ts';
import { fitOf, ropesOf, shownFrame } from './shape.ts';

interface Props {
  /** The knot that is open, if one is: the list is then a single row under it. */
  readonly open: string | null;
}

/** How long the pictures of the row wait, in milliseconds, for the view of the knot that is open to be drawn first. */
const AFTER_THE_VIEW = 700;

/**
 * The knots of the library, each with its picture, in alphabetical order of their names: a page of them,
 * or a row under the knot that is open.
 */
export function KnotList({ open }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const [material] = useRope();
  const knots = useMemo(
    () =>
      byLabel(
        Object.entries(KNOTS).map(([id, knot]) => ({ id, knot, label: inLanguage(knot.entry.names, language) })),
        language,
      ),
    [language],
  );
  return (
    <nav className={open === null ? 'shelf' : 'shelf shelf--rail'} aria-label={t('library.all')}>
      <ul className="cards">
        {knots.map(({ id, knot, label }) => (
          <li key={id}>
            <Link to={`/knots/${id}`} className="card" current={id === open}>
              <KnotPicture id={id} knot={knot} material={material} wait={open === null ? 0 : AFTER_THE_VIEW} />
              <span className="card__name">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The picture of a knot in the rope that is chosen. Until it is drawn, and if it cannot be, its place is empty. */
function KnotPicture({
  id,
  knot,
  material,
  wait,
}: {
  id: string;
  knot: LibraryKnot;
  material: RopeMaterialId;
  wait: number;
}) {
  const [picture, setPicture] = useState<string | null>(null);
  useEffect(() => {
    const frame = shownFrame(knot.document);
    if (!frame) return;
    let wanted = true;
    const curves = framePolylines(knot.document, frame);
    pictureOf(`${id} ${material}`, ropesOf(knot.document, curves, material), fitOf(curves), wait).then(
      (made) => {
        if (wanted) setPicture(made);
      },
      () => undefined,
    );
    return () => {
      wanted = false;
    };
    // how long it waits is as it was when the picture was first asked for: it is not asked for again
  }, [id, knot, material]);
  return <span className="card__picture">{picture !== null && <img src={picture} alt="" />}</span>;
}
