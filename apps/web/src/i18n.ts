import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { LANGUAGES } from './languages.ts';
import en from './locales/en.json';
import es from './locales/es.json';

export { LANGUAGES };

// English unless the person has chosen otherwise; the choice is remembered in the browser.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, es: { translation: es } },
    fallbackLng: 'en',
    supportedLngs: LANGUAGES.map((language) => language.code),
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage'], lookupLocalStorage: 'idk.language', caches: ['localStorage'] },
  });

const applyLanguage = (language: string) => {
  document.documentElement.lang = language;
};
i18n.on('languageChanged', applyLanguage);
applyLanguage(i18n.resolvedLanguage ?? 'en');

export default i18n;
