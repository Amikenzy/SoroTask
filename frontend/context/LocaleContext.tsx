/**
 * React Context for i18n
 * Manages locale state and provides translation utilities to components
 */

'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '../i18n/index';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getStoredLocalePreference,
  saveLocale,
  getTextDirection,
} from '../i18n/index';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isLoading: boolean;
}

export const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

interface LocaleProviderProps {
  children: React.ReactNode;
  defaultLocale?: Locale;
}

export function LocaleProvider({
  children,
  defaultLocale = DEFAULT_LOCALE,
}: LocaleProviderProps) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    setLocaleState(defaultLocale);
    document.documentElement.lang = defaultLocale;
    document.documentElement.dir = getTextDirection(defaultLocale);
  }, [defaultLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (SUPPORTED_LOCALES.includes(newLocale)) {
      setLocaleState(newLocale);
      saveLocale(newLocale);
      document.cookie = `sorotask_locale=${newLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.documentElement.lang = newLocale;
      document.documentElement.dir = getTextDirection(newLocale);
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const storedLocale = getStoredLocalePreference();
    if (storedLocale && storedLocale !== defaultLocale) setLocale(storedLocale);
  }, [defaultLocale, setLocale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, isLoading: false }}>
      {children}
    </LocaleContext.Provider>
  );
}
