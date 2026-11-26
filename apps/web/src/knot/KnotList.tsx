import { framePolylines } from '@idontknot/core';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { byLabel } from '../lab/format.ts';
import { Link } from '../route.tsx';
import type { RopeMaterialId } from '../viewer/materials.ts';
import { pictureOf } from '../viewer/pictures.ts';
import { useRope } from '../viewer/RopeChoice.tsx';
import { CATEGORY_IDS, type DisciplineId } from '../disciplines.ts';
import { inLanguage, KNOTS, type LibraryKnot } from './library.ts';
import { centredOn, fitOf, ropesOf, shownFrame, thingsOf } from './shape.ts';

interface Props {
  /** The knot that is open, if one is: the list is then a single row under it. */
  readonly open: string | null;
  /** The discipline whose knots are listed. Without one, all the knots of the library. */
  readonly discipline: DisciplineId | null;
}

/** How long the pictures of the row wait, in milliseconds, for the view of the knot that is open to be drawn first. */
const AFTER_THE_VIEW = 700;

const rank = (category: string | undefined): number => {
  const at = (CATEGORY_IDS as readonly string[]).indexOf(category ?? '');
  return at < 0 ? CATEGORY_IDS.length : at;
};

/** The knots a discipline uses, in the order of their categories and then of their names in a language. */
export function knotsOf(discipline: DisciplineId | null, language: string) {
  const knots = Object.entries(KNOTS)
    .filter(([, knot]) => discipline === null || knot.entry.uses?.[discipline] !== undefined)
    .map(([id, knot]) => ({ id, knot, label: inLanguage(knot.entry.names, language) }));
  return byLabel(knots, language).sort((a, b) => rank(a.knot.entry.category) - rank(b.knot.entry.category));
}

/**
 * The knots of a discipline, each with its picture: a page of them, under the heading of each category, or
 * a row under the knot that is open.
 */
export function KnotList({ open, discipline }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const [material] = useRope();
  const knots = useMemo(() => knotsOf(discipline, language), [discipline, language]);
  const card = ({ id, knot, label }: (typeof knots)[number]) => (
    <li key={id}>
      <Link to={`/knots/${id}`} className="card" current={id === open}>
        <KnotPicture id={id} knot={knot} material={material} wait={open === null ? 0 : AFTER_THE_VIEW} />
        <span className="card__name">{label}</span>
      </Link>
    </li>
  );
  if (open !== null) {
    // a discipline with no knots has no row
    if (knots.length === 0) return null;
    return (
      <nav className="shelf shelf--rail" aria-label={t('library.all')}>
        <ul className="cards">{knots.map(card)}</ul>
      </nav>
    );
  }
  const groups = CATEGORY_IDS.map((category) => ({
    category,
    knots: knots.filter((knot) => knot.knot.entry.category === category),
  })).filter((group) => group.knots.length > 0);
  return (
    <nav className="shelf" aria-label={t('library.all')}>
      {knots.length === 0 && <p className="shelf__empty">{t('library.empty')}</p>}
      {groups.map(({ category, knots: these }) => (
        <section key={category} className="shelf__group" aria-labelledby={`category-${category}`}>
          <h2 id={`category-${category}`}>{t(`categories.many.${category}`)}</h2>
          <ul className="cards">{these.map(card)}</ul>
        </section>
      ))}
    </nav>
  );
}

/** The picture of a knot in a rope. Until it is drawn, and if it cannot be, its place is empty. */
export function KnotPictureOf(props: { id: string; knot: LibraryKnot; material: RopeMaterialId; wait: number }) {
  return <KnotPicture {...props} />;
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
    // a knot tied round a thing is pictured without it, framed as it is on its page: round the thing's place
    const fit = centredOn(fitOf(curves), thingsOf(knot.document, curves)[0]);
    pictureOf(`${id} ${material}`, ropesOf(knot.document, curves, material), fit, wait).then(
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
