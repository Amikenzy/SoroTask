/**
 * i18n Core - Translation and localization system
 * Manages translation files and locale operations
 */

import en from './translations/en.json';
import es from './translations/es.json';
import fr from './translations/fr.json';
import zh from './translations/zh.json';
import de from './translations/de.json';
import ja from './translations/ja.json';
import ko from './translations/ko.json';
import pt from './translations/pt.json';
import ru from './translations/ru.json';
import ar from './translations/ar.json';
import hi from './translations/hi.json';
import tr from './translations/tr.json';

export const SUPPORTED_LOCALES = [
  'en', 'es', 'zh', 'ja', 'ko', 'de', 'fr', 'pt', 'ru', 'ar', 'hi', 'tr',
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const RTL_LOCALES: Locale[] = ['ar'];

// Translation catalog
export const translations: Record<Locale, typeof en> = {
  en,
  es,
  zh,
  ja,
  ko,
  de,
  fr,
  pt,
  ru,
  ar,
  hi,
  tr,
};

const localeMetadata: Record<Locale, { name: string; nativeName: string; flag: string }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  tr: { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
};

export function isLocale(value: string | undefined): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

export function getLocaleFromAcceptLanguage(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const preferences = acceptLanguage
    .split(',')
    .map((preference, index) => {
      const [tag, quality] = preference.trim().split(';q=');
      return {
        locale: tag.split('-')[0].toLowerCase(),
        quality: quality === undefined ? 1 : Number(quality),
        index,
      };
    })
    .filter(({ quality }) => Number.isFinite(quality) && quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  const preferredLocale = preferences.find(({ locale }) => isLocale(locale))?.locale;
  return isLocale(preferredLocale) ? preferredLocale : DEFAULT_LOCALE;
}

export function getTextDirection(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

/**
 * Get locale name in English
 */
export function getLocaleName(locale: Locale): string {
  return localeMetadata[locale].name;
}

/**
 * Get locale flag emoji
 */
export function getLocaleFlag(locale: Locale): string {
  return localeMetadata[locale].flag;
}

/**
 * Detect locale from browser/environment
 */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const browserLocale = navigator.language || navigator.languages?.[0] || DEFAULT_LOCALE;
  const baseLocale = browserLocale.split('-')[0].toLowerCase();

  // Map common locale codes to supported locales
  return isLocale(baseLocale) ? baseLocale : DEFAULT_LOCALE;
}

/**
 * Get locale from storage or default
 */
export function getStoredLocale(): Locale {
  return getStoredLocalePreference() ?? DEFAULT_LOCALE;
}

export function getStoredLocalePreference(): Locale | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const stored = localStorage.getItem('sorotask_locale');
    if (isLocale(stored ?? undefined)) {
      return stored;
    }
  } catch {
    // localStorage not available
  }

  return undefined;
}

/**
 * Save locale to storage
 */
export function saveLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('sorotask_locale', locale);
    } catch {
      // localStorage not available
    }
  }
}

/**
 * Get translation value from key path
 * Supports nested paths like "calendar.title" or "calendar.legend.today"
 */
export function getTranslation(
  locale: Locale,
  keyPath: string,
  variables?: Record<string, string | number>
): string {
  const catalog = translations[locale] || translations[DEFAULT_LOCALE];
  const keys = keyPath.split('.');

  let value: any = catalog;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      // Fallback to English if key not found and we are not already checking English
      if (locale !== DEFAULT_LOCALE) {
        value = getTranslation(DEFAULT_LOCALE, keyPath, variables);
      } else {
        value = undefined;
      }
      break;
    }
  }

  if (typeof value !== 'string') {
    return keyPath; // Return key if translation not found
  }

  // Replace variables in translation string
  if (variables) {
    let result = value;
    for (const [varName, varValue] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${varName}\\}`, 'g');
      result = result.replace(regex, String(varValue));
    }
    return result;
  }

  return value;
}

/**
 * Pluralize a word based on count
 * Used in translation strings like "{count} task{plural}"
 * Returns 's' for English, '' for singular of other languages
 */
export function pluralize(count: number, locale: Locale): string {
  if (count === 1) return '';

  // Most European languages add 's' for plural
  switch (locale) {
    case 'en':
      return 's';
    case 'es':
      return 's'; // Task -> Tasks = tarea -> tareas
    case 'fr':
      return 's'; // Task -> Tasks = tâche -> tâches
    case 'de':
      return 'n'; // Already handled in translation
    case 'zh':
      return ''; // Chinese doesn't use plurals
    default:
      return 's';
  }
}

/**
 * Get all available locales with metadata
 */
export function getAvailableLocales(): Array<{
  code: Locale;
  name: string;
  flag: string;
  nativeName: string;
}> {
  return SUPPORTED_LOCALES.map((code) => ({
    code,
    ...localeMetadata[code],
  }));
}
