import { useTranslation } from 'react-i18next';
import { Mark } from './brand/Mark.tsx';
import { Disciplines } from './Disciplines.tsx';
import { DISCIPLINE_IDS, isDiscipline } from './disciplines.ts';
import { useDiscipline } from './DisciplineChoice.tsx';
import { LANGUAGES } from './i18n.ts';
import { byLabel } from './lab/format.ts';
import { KnotList } from './knot/KnotList.tsx';
import { KnotPage } from './knot/KnotPage.tsx';
import { KNOTS } from './knot/library.ts';
import { TorusLab } from './lab/TorusLab.tsx';
import { Link, usePath } from './route.tsx';

const LAB = '/lab';
const KNOT = '/knots/';
const DISCIPLINES = '/disciplines';

/**
 * The application: the knots of a discipline, which it opens on once a discipline is chosen, and the
 * laboratory. Until one is chosen it opens on the disciplines; afterwards the discipline can be changed at
 * the top right of every page. A knot that is chosen opens above the list, which stays under it as a row.
 */
export function App() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const path = usePath();
  const [discipline, choose] = useDiscipline();
  const atHome = path === '/';
  const inLab = path === LAB;
  const id = path.startsWith(KNOT) ? path.slice(KNOT.length).replace(/\/$/, '') : null;
  const knot = id === null ? undefined : KNOTS[id];
  const choosing = path === DISCIPLINES || (atHome && discipline === null);
  return (
    <div className="app">
      <header className="app__header">
        {/* the name of the application leads back to the choice of discipline */}
        <Link to={DISCIPLINES} className="brand" label="IDontKnot">
          <Mark size={44} />
          <img className="brand__name" src="/wordmark.svg" alt="" />
        </Link>
        <p className="app__tagline">{t('app.tagline')}</p>
        <nav className="app__nav" aria-label={t('nav.label')}>
          <Link to="/" current={(atHome && !choosing) || id !== null}>
            {t('nav.knots')}
          </Link>
          <Link to={LAB} current={inLab}>
            {t('nav.lab')}
          </Link>
        </nav>
        <label className="language">
          <span className="language__label">{t('language.label')}</span>
          <select value={language} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
            {byLabel(
              LANGUAGES.map((each) => ({ code: each.code, label: each.name })),
              language,
            ).map((each) => (
              <option key={each.code} value={each.code} lang={each.code}>
                {each.label}
              </option>
            ))}
          </select>
        </label>
        {discipline !== null && (
          <label className="language language--last">
            <span className="language__label">{t('discipline.label')}</span>
            <select
              data-testid="discipline"
              value={discipline}
              onChange={(event) => {
                if (isDiscipline(event.target.value)) choose(event.target.value);
              }}
            >
              {byLabel(
                DISCIPLINE_IDS.map((each) => ({ id: each, label: t(`disciplines.short.${each}`) })),
                language,
              ).map((each) => (
                <option key={each.id} value={each.id}>
                  {each.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <main className="app__main">
        {choosing ? (
          <Disciplines />
        ) : atHome || knot ? (
          <>
            {knot ? (
              <KnotPage knot={knot} />
            ) : (
              <h1 className="shelf__title">{t(`disciplines.names.${discipline ?? 'decorative'}`)}</h1>
            )}
            <KnotList open={knot && id !== null ? id : null} discipline={discipline} />
          </>
        ) : inLab ? (
          <TorusLab />
        ) : (
          <section className="missing">
            <h1>{id !== null ? t('knot.missing') : t('nav.missing')}</h1>
            <p>
              <Link to="/">{t('nav.home')}</Link>
            </p>
          </section>
        )}
      </main>
      <footer className="app__footer">{t('footer.status')}</footer>
    </div>
  );
}
