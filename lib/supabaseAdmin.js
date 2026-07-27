import { createClient } from '@supabase/supabase-js';

// Bez 'server-only' — ten plik jest importowany zarówno przez kod Next.js
// (przez lib/db.js, który dokłada 'server-only' jako dodatkowe zabezpieczenie),
// jak i przez samodzielne skrypty Node (scripts/backfill.js), którym
// 'server-only' przeszkadzałoby (rzuca błąd poza kontekstem Next.js/React Server).
// SUPABASE_SERVICE_ROLE_KEY nigdy nie trafia do przeglądarki — ten klucz jest
// używany tylko tutaj, po stronie serwera/skryptu.

let cachedClient = null;

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Brak SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY w zmiennych środowiskowych.'
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
