import { useTranslation } from 'react-i18next';
import { Mark } from './brand/Mark.tsx';
import { LANGUAGES } from './i18n.ts';
import { byLabel } from './lab/format.ts';
import { KnotList } from './knot/KnotList.tsx';
import { KnotPage } from './knot/KnotPage.tsx';
import { KNOTS } from './knot/library.ts';
import { TorusLab } from './lab/TorusLab.tsx';
import { Link, usePath } from './route.tsx';

const LAB = '/lab';
const KNOT = '/knots/';

/**
 * The application: the library of knots, which it opens on, and the laboratory. The library is its list of
 * knots; a knot that is chosen opens above the list, which stays under it as a row.
 */
export function App() {
  const { t, i18n } = useTranslation();
  const path = usePath();
  const atHome = path === '/';
  const inLab = path === LAB;
  const id = path.startsWith(KNOT) ? path.slice(KNOT.length).replace(/\/$/, '') : null;
  const knot = id === null ? undefined : KNOTS[id];
  return (
    <div className="app">
      <header className="app__header">
        <a className="brand" href="/" aria-label="IDontKnot">
          <Mark size={44} />
          <img className="brand__name" src="/wordmark.svg" alt="" />
        </a>
        <p className="app__tagline">{t('app.tagline')}</p>
        <nav className="app__nav" aria-label={t('nav.label')}>
          <Link to="/" current={atHome || id !== null}>
            {t('nav.knots')}
          </Link>
          <Link to={LAB} current={inLab}>
            {t('nav.lab')}
          </Link>
        </nav>
        <label className="language">
          <span className="language__label">{t('language.label')}</span>
          <select
            value={i18n.resolvedLanguage ?? 'en'}
            onChange={(event) => void i18n.changeLanguage(event.target.value)}
          >
            {byLabel(
              LANGUAGES.map((language) => ({ code: language.code, label: language.name })),
              i18n.resolvedLanguage ?? 'en',
            ).map((language) => (
              <option key={language.code} value={language.code} lang={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main className="app__main">
        {atHome || knot ? (
          <>
            {knot ? <KnotPage knot={knot} /> : <h1 className="shelf__title">{t('library.title')}</h1>}
            <KnotList open={knot && id !== null ? id : null} />
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
