import { getSupabaseClient } from './supabaseAdmin.js';

// Kategorie z apicar.store, które nie są samochodami — tak samo jak w lib/sync.js.
const EXCLUDED_VEHICLE_TYPES = ['Industrial Equipment'];

function parseEngineSize(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeToArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// Zamienia rekord z /cars/db/all lub /cars/db/update na wiersz tabeli
// "active_lots" (patrz supabase/schema.sql). Rekord jest płaski (bez
// zagnieżdżonego lot_info, w przeciwieństwie do /history-cars/updbd).
export function mapApiActiveLotToRow(apiLot) {
  return {
    lot_id: apiLot.lot_id ?? null,
    site: apiLot.site ?? null,
    base_site: apiLot.base_site || null,
    vin: apiLot.vin || null,

    title: apiLot.title || null,
    year: apiLot.year ?? null,
    make: apiLot.make || null,
    model: apiLot.model || null,
    series: apiLot.series || null,
    vehicle_type: apiLot.vehicle_type || null,
    color: apiLot.color || null,
    engine: apiLot.engine || null,
    engine_size: parseEngineSize(apiLot.engine_size),
    cylinders: apiLot.cylinders || null,
    fuel: apiLot.fuel || null,
    drive: apiLot.drive || null,
    transmission: apiLot.transmission || null,
    keys: apiLot.keys || null,

    location: apiLot.location || null,
    state: apiLot.state || null,

    odometer: apiLot.odometer ?? null,
    odometer_index: apiLot.odometer_index || null,
    odobrand: apiLot.odobrand || null,

    damage_pr: apiLot.damage_pr || null,
    damage_sec: apiLot.damage_sec || null,
    document: apiLot.document || null,
    document_detail: apiLot.document_old || null,
    seller: apiLot.seller || null,
    seller_type: apiLot.seller_type || null,
    status: apiLot.status || null,

    current_bid: apiLot.current_bid ?? null,
    cost_priced: apiLot.cost_priced ?? null,
    price_new: apiLot.price_new ?? null,
    price_future: apiLot.price_future ?? null,
    auction_date: apiLot.auction_date || null,
    presale_status: apiLot.presale_status || null,
    is_buynow: apiLot.is_buynow ?? null,

    link_img_hd: apiLot.link_img_hd || [],
    link_img_small: apiLot.link_img_small || [],
    iaai_360: normalizeToArray(apiLot.iaai_360),
    copart_exterior_360: normalizeToArray(apiLot.copart_exterior_360),
    video: normalizeToArray(apiLot.video),

    raw_json: apiLot,
    updated_at: new Date().toISOString(),
  };
}

const BATCH_CHUNK_SIZE = 250;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

// Zbiorczy upsert aktywnych lotów po lot_id. Ten sam lot_id potrafi wystąpić
// kilka razy na jednej stronie (kilka aktualizacji w danym oknie) — zostawiamy
// tylko ostatnie wystąpienie, tak jak upsertCarsFromUpdbdBatch w lib/sync.js.
export async function upsertActiveLotsBatch(records) {
  const supabase = getSupabaseClient();

  const byLotId = new Map();
  for (const record of records) {
    if (EXCLUDED_VEHICLE_TYPES.includes(record.vehicle_type)) continue;
    const row = mapApiActiveLotToRow(record);
    if (!row.lot_id) continue;
    byLotId.set(row.lot_id, row);
  }

  const rows = [...byLotId.values()];
  if (rows.length === 0) return { saved: 0 };

  for (const rowsChunk of chunk(rows, BATCH_CHUNK_SIZE)) {
    const { error } = await supabase.from('active_lots').upsert(rowsChunk, { onConflict: 'lot_id' });
    if (error) throw error;
  }

  return { saved: rows.length };
}

// Usuwa loty, które apicar.store zgłosił jako sprzedane/zdjęte z aukcji
// (/cars/deleted) — patrz komentarz w supabase/schema.sql: odpowiadająca
// historyczna wersja (jeśli lot się sprzedał) dociera do "cars" niezależnie,
// przez codzienny sync (app/api/sync/route.js).
export async function deleteActiveLotsByLotIds(lotIds) {
  const supabase = getSupabaseClient();
  const ids = [...new Set(lotIds.filter((id) => id !== null && id !== undefined))];
  if (ids.length === 0) return { deleted: 0 };

  for (const idsChunk of chunk(ids, BATCH_CHUNK_SIZE)) {
    const { error } = await supabase.from('active_lots').delete().in('lot_id', idsChunk);
    if (error) throw error;
  }

  return { deleted: ids.length };
}
