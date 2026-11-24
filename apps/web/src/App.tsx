import { useTranslation } from 'react-i18next';
import { Mark } from './brand/Mark.tsx';
import { LANGUAGES } from './i18n.ts';
import { byLabel } from './lab/format.ts';
import { KnotPage } from './knot/KnotPage.tsx';
import { KNOTS } from './knot/library.ts';
import { TorusLab } from './lab/TorusLab.tsx';
import { Link, usePath } from './route.tsx';

/** The knot the library opens on, while it has no index of its own. */
const FIRST_KNOT = 'figure-eight';
const LAB = '/lab';

export function App() {
  const { t, i18n } = useTranslation();
  const path = usePath();
  const inLibrary = path === '/' || path.startsWith('/knots/');
  const inLab = path === LAB;
  const knot = inLibrary
    ? KNOTS[path === '/' ? FIRST_KNOT : path.slice('/knots/'.length).replace(/\/$/, '')]
    : undefined;
  return (
    <div className="app">
      <header className="app__header">
        <a className="brand" href="/" aria-label="IDontKnot">
          <Mark size={44} />
          <img className="brand__name" src="/wordmark.svg" alt="" />
        </a>
        <p className="app__tagline">{t('app.tagline')}</p>
        <nav className="app__nav" aria-label={t('nav.label')}>
          <Link to="/" current={inLibrary}>
            {t('nav.explore')}
          </Link>
          <Link to={LAB} current={inLab}>
            {t('nav.experiment')}
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
        {knot ? (
          <KnotPage knot={knot} />
        ) : inLab ? (
          <TorusLab />
        ) : (
          <section className="missing">
            <h1>{inLibrary ? t('knot.missing') : t('nav.missing')}</h1>
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
