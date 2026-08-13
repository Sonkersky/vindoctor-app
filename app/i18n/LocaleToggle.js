'use client';

import { useLocale } from './LocaleContext';

export default function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="locale-toggle">
      <button
        type="button"
        className={locale === 'en' ? 'locale-btn locale-btn-active' : 'locale-btn'}
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
      >
        EN
      </button>
      <span className="locale-sep">/</span>
      <button
        type="button"
        className={locale === 'pl' ? 'locale-btn locale-btn-active' : 'locale-btn'}
        onClick={() => setLocale('pl')}
        aria-pressed={locale === 'pl'}
      >
        PL
      </button>
    </div>
  );
}
