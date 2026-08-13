'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useFavorites } from './FavoritesContext';
import { useLocale } from './i18n/LocaleContext';

// VIN wg normy ISO 3779: 17 znaków, bez liter I/O/Q (mylą się z 1/0).
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;
// Numer lotu z apicar.store (Copart/IAAI) to zawsze same cyfry.
const LOT_NUMBER_PATTERN = /^\d+$/;

function logSearch(user, vin) {
  if (!user) return;
  const supabase = createClient();
  supabase.from('search_history').insert({ user_id: user.id, search_type: 'vin', query: vin }).then(() => {});
}

export default function VinSearchForm() {
  const router = useRouter();
  const { user } = useFavorites();
  const { t } = useLocale();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const query = value.trim();
    if (!query) return;
    setError('');

    if (VIN_PATTERN.test(query)) {
      logSearch(user, query);
      router.push(`/lot/${encodeURIComponent(query)}`);
      return;
    }

    if (LOT_NUMBER_PATTERN.test(query)) {
      // Numer lotu nie jest (jeszcze) częścią URL-a — najpierw trzeba go
      // rozwiązać na VIN (klucz, na którym stoi cała reszta strony/SEO),
      // dopiero potem nawigować na tę samą kanoniczną stronę /lot/[vin].
      setBusy(true);
      const supabase = createClient();
      const { data, error: lookupError } = await supabase
        .from('cars')
        .select('vin')
        .eq('lot_id', query)
        .maybeSingle();
      setBusy(false);

      if (lookupError || !data) {
        setError(t('searchErrorLotNotFound'));
        return;
      }

      logSearch(user, data.vin);
      router.push(`/lot/${encodeURIComponent(data.vin)}`);
      return;
    }

    setError(t('searchErrorInvalid'));
  }

  return (
    <div className="top-search-wrap">
      <form className="top-search-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="top-search-input"
          placeholder={t('searchPlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('searching') : t('search')}
        </button>
      </form>

      {error && <div className="top-search-error">{error}</div>}
    </div>
  );
}
