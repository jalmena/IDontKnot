import { useTranslation } from 'react-i18next';
import { Mark } from './brand/Mark.tsx';
import { LANGUAGES } from './i18n.ts';
import { byLabel } from './lab/format.ts';
import { TorusLab } from './lab/TorusLab.tsx';

export function App() {
  const { t, i18n } = useTranslation();
  return (
    <div className="app">
      <header className="app__header">
        <a className="brand" href="/" aria-label="IDontKnot">
          <Mark size={44} />
          <img className="brand__name" src="/wordmark.svg" alt="" />
        </a>
        <p className="app__tagline">{t('app.tagline')}</p>
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
        <TorusLab />
      </main>
      <footer className="app__footer">{t('footer.status')}</footer>
    </div>
  );
}
