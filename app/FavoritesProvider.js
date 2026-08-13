'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FavoritesContext } from './FavoritesContext';

// Jedno źródło prawdy dla stanu zalogowania i zbioru ulubionych VIN-ów,
// współdzielone przez AuthWidget i każdy FavoriteButton na kafelku — bez
// tego każdy kafelek robiłby własne zapytanie do auth/favorites.
export default function FavoritesProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [favorites, setFavorites] = useState(new Set());
  const [mileageUnit, setMileageUnit] = useState('mi');
  const [isAdmin, setIsAdmin] = useState(false);

  const loadFavorites = useCallback(async (supabase) => {
    const { data } = await supabase.from('favorites').select('car_vin');
    setFavorites(new Set((data || []).map((row) => row.car_vin)));
  }, []);

  const loadProfile = useCallback(async (supabase) => {
    const { data } = await supabase.from('profiles').select('mileage_unit, is_admin').single();
    setMileageUnit(data?.mileage_unit === 'km' ? 'km' : 'mi');
    setIsAdmin(Boolean(data?.is_admin));
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      const currentUser = data.user || null;
      setUser(currentUser);
      setLoadingUser(false);
      if (currentUser) {
        loadFavorites(supabase);
        loadProfile(supabase);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);
      setLoadingUser(false);
      if (nextUser) {
        loadFavorites(supabase);
        loadProfile(supabase);
      } else {
        setFavorites(new Set());
        setMileageUnit('mi');
        setIsAdmin(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [loadFavorites, loadProfile]);

  async function updateMileageUnit(unit) {
    if (!user) return;
    const next = unit === 'km' ? 'km' : 'mi';
    const previous = mileageUnit;

    // Optymistyczna aktualizacja — patrz analogiczny komentarz w toggleFavorite.
    setMileageUnit(next);

    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ mileage_unit: next }).eq('id', user.id);

    if (error) setMileageUnit(previous);
  }

  async function toggleFavorite(vin) {
    if (!user) {
      // Zamiast prop-drillingu przez server component (page.js) aż do
      // AuthWidget, wysyłamy zdarzenie DOM, na które AuthWidget nasłuchuje —
      // otwiera modal logowania.
      window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { tab: 'login' } }));
      return;
    }

    const supabase = createClient();
    const isFav = favorites.has(vin);

    // Optymistyczna aktualizacja — serduszko reaguje natychmiast; w razie
    // błędu (rzadkie: sieć/RLS) cofamy zmianę poniżej.
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(vin);
      else next.add(vin);
      return next;
    });

    const { error } = isFav
      ? await supabase.from('favorites').delete().eq('car_vin', vin)
      : await supabase.from('favorites').insert({ car_vin: vin, user_id: user.id });

    if (error) {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(vin);
        else next.delete(vin);
        return next;
      });
    }
  }

  return (
    <FavoritesContext.Provider
      value={{ user, loadingUser, favorites, toggleFavorite, mileageUnit, updateMileageUnit, isAdmin }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}
