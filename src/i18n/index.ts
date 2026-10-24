import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zu from './zu.json';
import xh from './xh.json';
import nso from './nso.json';
import af from './af.json';
import uiEn from './ui.en.json';

export const LOCALES = [
  { code: 'en', bcp47: 'en-ZA', name: en.language, beta: false },
  { code: 'zu', bcp47: 'zu-ZA', name: zu.language, beta: true },
  { code: 'xh', bcp47: 'xh-ZA', name: xh.language, beta: true },
  { code: 'nso', bcp47: 'nso-ZA', name: nso.language, beta: true },
  { code: 'af', bcp47: 'af-ZA', name: af.language, beta: true },
] as const;
export type LocaleCode = (typeof LOCALES)[number]['code'];

const STORAGE_KEY = 'zaka.locale';

export function savedLocale(): LocaleCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LOCALES.some((l) => l.code === v) ? (v as LocaleCode) : null;
  } catch {
    return null;
  }
}

export function setLocale(code: LocaleCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode: keep in memory only */
  }
  void i18n.changeLanguage(code);
  document.documentElement.lang = bcp47(code);
}

export function bcp47(code: string = i18n.language): string {
  return LOCALES.find((l) => l.code === code)?.bcp47 ?? 'en-ZA';
}

export function isBeta(code: string = i18n.language): boolean {
  return LOCALES.find((l) => l.code === code)?.beta ?? false;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en, ui: uiEn },
    zu: { translation: zu },
    xh: { translation: xh },
    nso: { translation: nso },
    af: { translation: af },
  },
  lng: savedLocale() ?? 'en',
  fallbackLng: 'en',
  ns: ['translation', 'ui'],
  defaultNS: 'translation',
  interpolation: { prefix: '{', suffix: '}', escapeValue: false }, // React escapes output
  returnNull: false,
});
document.documentElement.lang = bcp47(i18n.language);

export default i18n;
