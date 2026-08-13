// Jednorazowy backfill kolumny cars.lot_id z już zapisanego raw_json.
// Uruchamiane lokalnie (npm run backfill:lot-id) zamiast jako pojedyncze
// zapytanie UPDATE w Supabase SQL Editor — przy 140k+ wierszach jeden wielki
// UPDATE (JSONB extraction + regex na każdym wierszu) przekraczał upstream
// timeout edytora SQL. Tutaj robimy to w małych, bezpiecznych paczkach przez
// zwykłe zapytania REST (supabase-js), z klucza service-role.
import { getSupabaseClient } from '../lib/supabaseAdmin.js';

const supabase = getSupabaseClient();
const PAGE_SIZE = 100;
// Przerwa między paczkami — projekt stoi na najmniejszym (Micro) compute
// Supabase; bez tej przerwy backfill sam potrafił wysycić CPU/RAM do 90%+ i
// ubić całą stronę produkcyjną (patrz sesja z 2026-08-12). Wolniej, ale nie
// kładzie bazy.
const DELAY_BETWEEN_BATCHES_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// service_role ma też ustawiony statement_timeout (patrz supabase/schema.sql
// / wcześniejsza naprawa sitemapy) — chwilowy 57014 (statement timeout) na
// pojedynczej paczce nie powinien ubić całego backfillu, tylko tę jedną
// paczkę spróbować ponownie (mniejszym nakładem, bo dane po drodze się nie
// psują — upsert jest idempotentny). Mniej agresywne niż poprzednio (2
// próby, dłuższy odstęp) — celowo, żeby NIE dobijać już obciążonej bazy
// serią szybkich ponowień.
async function withRetry(fn, { retries = 2, delayMs = 5000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.error(`  retrying after error (attempt ${attempt + 1}/${retries + 1}):`, err.message || err);
      if (attempt < retries) await sleep(delayMs);
    }
  }
  throw lastErr;
}

async function run() {
  let from = 0;
  let totalScanned = 0;
  let totalUpdated = 0;

  for (;;) {
    const rows = await withRetry(async () => {
      // Tylko potrzebny fragment JSON-a (nie cały raw_json, który dla części
      // aut ma dziesiątki URL-i zdjęć w środku) — dużo lżejsze zapytanie i
      // dużo mniejszy transfer, ważne przy tak małym compute.
      const { data, error } = await supabase
        .from('cars')
        .select('id, vin, raw_lot_id:raw_json->>lot_id')
        .is('lot_id', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return data;
    });

    if (!rows || rows.length === 0) break;

    totalScanned += rows.length;

    const updates = rows
      .map((row) => {
        const rawLotId = row.raw_lot_id;
        const lotId = Number.parseInt(rawLotId, 10);
        if (!Number.isFinite(lotId) || String(rawLotId) !== String(lotId)) return null;
        return { vin: row.vin, lot_id: lotId };
      })
      .filter(Boolean);

    if (updates.length > 0) {
      await withRetry(async () => {
        const { error: upsertError } = await supabase.from('cars').upsert(updates, { onConflict: 'vin' });
        if (upsertError) throw upsertError;
      });
      totalUpdated += updates.length;
    }

    console.log(`Scanned ${totalScanned}, updated ${totalUpdated}...`);

    await sleep(DELAY_BETWEEN_BATCHES_MS);

    // WAŻNE: nie przesuwamy `from` — filtrujemy `lot_id is null`, więc każda
    // zaktualizowana paczka "znika" z kolejnego zapytania automatycznie.
    // Jeśli w tej paczce nie było ŻADNEGO poprawnego lot_id (same śmieciowe/
    // brakujące wartości), musimy jednak przesunąć się dalej, inaczej pętla
    // zapętli się w nieskończoność na tych samych wierszach.
    if (updates.length === 0) {
      from += PAGE_SIZE;
    }
  }

  console.log(`Done. Scanned ${totalScanned} rows without lot_id, updated ${totalUpdated}.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
