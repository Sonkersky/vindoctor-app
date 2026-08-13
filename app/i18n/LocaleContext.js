'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getTranslator } from '@/lib/i18n/translations';

const LocaleContext = createContext(null);

const LOCALE_COOKIE = 'locale';
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function LocaleProvider({ initialLocale, children }) {
  const router = useRouter();

  const setLocale = useCallback(
    (next) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      router.refresh();
    },
    [router]
  );

  const value = useMemo(
    () => ({
      locale: initialLocale,
      setLocale,
      t: getTranslator(initialLocale),
    }),
    [initialLocale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
