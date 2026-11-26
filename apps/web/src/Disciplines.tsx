import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DISCIPLINE_IDS, ropeOf, type DisciplineId } from './disciplines.ts';
import { useDiscipline } from './DisciplineChoice.tsx';
import { KnotPictureOf } from './knot/KnotList.tsx';
import { KNOTS } from './knot/library.ts';
import { byLabel } from './lab/format.ts';
import { askAhead } from './viewer/textures.ts';

/** A knot to picture each discipline by, in its rope, while it has no knot of its own to show. */
const PICTURED: Readonly<Record<DisciplineId, string>> = {
  climbing: 'figure-eight',
  nautical: 'bowline',
  shibari: 'overhand',
  pioneering: 'bowline',
  decorative: 'figure-eight',
  theory: 'overhand',
};

/** The page the application opens on until a discipline is chosen: one card for each discipline. */
export function Disciplines() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const [, choose] = useDiscipline();
  // the rope of every discipline is pictured: their images are computed side by side, from the start
  useEffect(() => askAhead(DISCIPLINE_IDS.map(ropeOf)), []);
  const disciplines = useMemo(
    () =>
      byLabel(
        DISCIPLINE_IDS.map((id) => ({ id, label: t(`disciplines.names.${id}`) })),
        language,
      ),
    [t, language],
  );
  return (
    <section className="disciplines" aria-labelledby="disciplines-title">
      <h1 id="disciplines-title" className="shelf__title">
        {t('disciplines.title')}
      </h1>
      <p className="disciplines__lead">{t('disciplines.lead')}</p>
      <ul className="disciplines__cards">
        {disciplines.map(({ id, label }) => {
          // the first knot of the discipline, or else one to show its rope with
          const pictured =
            Object.keys(KNOTS).find((knot) => KNOTS[knot]?.entry.uses?.[id] !== undefined) ?? PICTURED[id];
          const knot = KNOTS[pictured];
          return (
            <li key={id}>
              <button type="button" className="discipline" onClick={() => choose(id)} data-discipline={id}>
                {knot && <KnotPictureOf id={pictured} knot={knot} material={ropeOf(id)} wait={0} />}
                <span className="discipline__name">{label}</span>
                <span className="discipline__about">{t(`disciplines.about.${id}`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
