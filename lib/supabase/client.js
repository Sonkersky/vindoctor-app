'use client';

import { createBrowserClient } from '@supabase/ssr';

// Klucz "anon" — bezpieczny w przeglądarce, chroniony regułami RLS w bazie.
// Osobny od lib/supabaseAdmin.js (klucz service_role, tylko po stronie serwera).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
