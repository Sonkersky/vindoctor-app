import 'server-only';

// Cienka warstwa nad lib/supabaseAdmin.js — dokłada 'server-only' jako
// dodatkowe zabezpieczenie przed importem w komponencie klienckim Next.js.
// Samodzielne skrypty (scripts/backfill.js) importują lib/supabaseAdmin.js
// bezpośrednio, bo poza Next.js/React Server 'server-only' rzuca błędem.
export { getSupabaseClient } from './supabaseAdmin.js';
