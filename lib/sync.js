import { getSupabaseClient } from './supabaseAdmin.js';

// engine_size bywa liczbą, tekstem liczbowym albo czymś nieparsowalnym
// (np. "2.4L") — kolumna w bazie jest numeric, więc zawsze parsujemy albo
// zwracamy null zamiast wysyłać śmieciowy string do Postgresa.
function parseEngineSize(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

// Zamienia obiekt zwrócony przez apicar.store na wiersz tabeli "cars".
// Nazwy pól po lewej odpowiadają kolumnom z supabase/schema.sql; po prawej —
// polom, jakich apicar.store używał w dotychczasowym kodzie front-endu.
export function mapApiCarToRow(apiCar) {
  return {
    vin: apiCar.vin,
    title: apiCar.title || null,
    year: apiCar.year ?? null,
    make: apiCar.make || null,
    model: apiCar.model || null,
    series: apiCar.series || null,
    vehicle_type: apiCar.vehicle_type || null,
    color: apiCar.color || null,
    engine: apiCar.engine || null,
    engine_size: parseEngineSize(apiCar.engine_size),
    cylinders: apiCar.cylinders || null,
    fuel: apiCar.fuel || null,
    drive: apiCar.drive || null,
    transmission: apiCar.transmission || null,
    keys: apiCar.keys || null,
    base_site: apiCar.base_site || null,
    location: apiCar.location || null,
    state: apiCar.state || null,
    odometer: apiCar.odometer ?? null,
    odometer_index: apiCar.odometer_index || null,
    odobrand: apiCar.odobrand || null,
    damage_pr: apiCar.damage_pr || null,
    damage_sec: apiCar.damage_sec || apiCar.secondary_damage || null,
    document: apiCar.document || null,
    seller: apiCar.seller || null,
    seller_type: apiCar.seller_type || null,
    status: apiCar.status || null,
    purchase_price: apiCar.purchase_price ?? apiCar.cost_priced ?? null,
    sale_date: apiCar.sale_date || null,
    sale_status: apiCar.sale_status || null,
    sale_type: apiCar.sale_type || null,
    link_img_hd: apiCar.link_img_hd || [],
    link_img_small: apiCar.link_img_small || [],
    iaai_360: apiCar.iaai_360 ? (Array.isArray(apiCar.iaai_360) ? apiCar.iaai_360 : [apiCar.iaai_360]) : [],
    copart_exterior_360: apiCar.copart_exterior_360
      ? Array.isArray(apiCar.copart_exterior_360)
        ? apiCar.copart_exterior_360
        : [apiCar.copart_exterior_360]
      : [],
    video: apiCar.video ? (Array.isArray(apiCar.video) ? apiCar.video : [apiCar.video]) : [],
    raw_json: apiCar,
  };
}

// Kategorie z apicar.store, które nie są samochodami (sprzęt przemysłowy itp.)
// — pomijamy je przy synchronizacji, żeby nie zaśmiecały strony.
const EXCLUDED_VEHICLE_TYPES = ['Industrial Equipment'];

// Zapisuje jeden samochód (+ jego historię sprzedaży) do Supabase.
// Bezpieczne do wielokrotnego wywołania — nadpisuje wiersz po VIN-ie.
// Zwraca false (i nic nie zapisuje), jeśli lot jest wykluczonej kategorii.
export async function upsertCar(apiCar) {
  if (EXCLUDED_VEHICLE_TYPES.includes(apiCar.vehicle_type)) {
    return false;
  }

  const supabase = getSupabaseClient();
  const row = mapApiCarToRow(apiCar);

  const { error: carError } = await supabase.from('cars').upsert(row, { onConflict: 'vin' });
  if (carError) throw carError;

  const history = Array.isArray(apiCar.sale_history) ? apiCar.sale_history : [];

  const { error: deleteError } = await supabase.from('sale_history').delete().eq('car_vin', apiCar.vin);
  if (deleteError) throw deleteError;

  if (history.length > 0) {
    const historyRows = history.map((entry) => ({
      car_vin: apiCar.vin,
      sale_date: entry.sale_date || null,
      base_site: entry.base_site || null,
      sale_status: entry.sale_status || null,
      purchase_price: entry.purchase_price ?? null,
      raw_json: entry,
    }));

    const { error: insertError } = await supabase.from('sale_history').insert(historyRows);
    if (insertError) throw insertError;
  }
}

function normalizeToArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// Zamienia rekord z /history-cars/updbd (nowy, płatny endpoint) na wiersz
// tabeli "cars". Ten endpoint zwraca dane spłaszczone w dwóch miejscach —
// trochę pól na najwyższym poziomie rekordu, reszta (bogatsza) w lot_info —
// więc czytamy z obu, priorytetem dla lot_info tam, gdzie się pokrywają.
export function mapUpdbdRecordToRow(record) {
  const li = record.lot_info || {};
  return {
    vin: record.vin || li.vin,
    title: li.title || null,
    year: li.year ?? record.year ?? null,
    make: li.make || record.make || null,
    model: li.model || record.model || null,
    series: li.series || record.series || null,
    vehicle_type: li.vehicle_type || record.vehicle_type || null,
    color: li.color || null,
    engine: li.engine || null,
    engine_size: parseEngineSize(li.engine_size),
    cylinders: li.cylinders ?? null,
    fuel: li.fuel || null,
    drive: li.drive || null,
    transmission: li.transmission || null,
    keys: li.keys || null,
    base_site: li.base_site || record.base_site || null,
    location: li.location || null,
    state: li.state || null,
    odometer: li.odometer ?? null,
    odometer_index: li.odometer_index || null,
    odobrand: li.odobrand || null,
    damage_pr: li.damage_pr || null,
    damage_sec: li.damage_sec || null,
    document: li.document || null,
    seller: li.seller || null,
    seller_type: li.seller_type || null,
    status: li.status || null,
    purchase_price: li.purchase_price ?? record.purchase_price ?? null,
    sale_date: li.sale_date || record.sale_date || null,
    sale_status: li.sale_status || record.sale_status || null,
    sale_type: record.sale_type || null,
    link_img_hd: li.link_img_hd || [],
    link_img_small: li.link_img_small || [],
    iaai_360: normalizeToArray(li.iaai_360),
    copart_exterior_360: normalizeToArray(li.copart_exterior_360),
    video: normalizeToArray(li.video),
    raw_json: record,
  };
}

// Jak upsertCar(), ale dla rekordów z /history-cars/updbd — jedno zapytanie
// do apicar.store daje już komplet danych (bez potrzeby drugiego zapytania
// po VIN), razem z historią sprzedaży w lot_info.sale_history.
export async function upsertCarFromUpdbd(record) {
  const li = record.lot_info || {};

  if (EXCLUDED_VEHICLE_TYPES.includes(li.vehicle_type || record.vehicle_type)) {
    return false;
  }

  const supabase = getSupabaseClient();
  const row = mapUpdbdRecordToRow(record);
  if (!row.vin) return false;

  const { error: carError } = await supabase.from('cars').upsert(row, { onConflict: 'vin' });
  if (carError) throw carError;

  const history = Array.isArray(li.sale_history) ? li.sale_history : [];

  const { error: deleteError } = await supabase.from('sale_history').delete().eq('car_vin', row.vin);
  if (deleteError) throw deleteError;

  if (history.length > 0) {
    const historyRows = history.map((entry) => ({
      car_vin: row.vin,
      sale_date: entry.sale_date || null,
      base_site: entry.base_site || null,
      sale_status: entry.sale_status || null,
      purchase_price: entry.purchase_price ?? null,
      raw_json: entry,
    }));

    const { error: insertError } = await supabase.from('sale_history').insert(historyRows);
    if (insertError) throw insertError;
  }

  return true;
}

// Ile wierszy na jeden zapis grupowy. 3000 naraz przekracza limit czasu
// zapytania w Postgresie (statement timeout) — mniejsze porcje są bezpieczne
// i wciąż dużo szybsze niż zapis pojedynczy po jednym aucie.
const BATCH_CHUNK_SIZE = 250;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

// Zbiorcza wersja upsertCarFromUpdbd() — zamiast jednego zapisu do bazy na
// jedno auto (wolne przy tysiącach rekordów), robi zapis w porcjach po
// BATCH_CHUNK_SIZE. To jest to, co pozwala /api/sync ogarnąć cały dzień
// (~13 stron) w limicie czasu jednego uruchomienia na Vercelu.
// Zwraca { saved, savedSold, savedNotSold }.
export async function upsertCarsFromUpdbdBatch(records) {
  const supabase = getSupabaseClient();

  // Ten sam VIN potrafi wystąpić kilka razy na jednej stronie wyników (kilka
  // aktualizacji tego samego auta w danym oknie czasowym) — Postgres nie
  // pozwala zaktualizować tego samego wiersza dwa razy w jednym zapytaniu
  // ON CONFLICT, więc zostawiamy tylko ostatnie wystąpienie danego VIN-u.
  const byVin = new Map();
  const historyByVin = new Map();

  for (const record of records) {
    const li = record.lot_info || {};
    if (EXCLUDED_VEHICLE_TYPES.includes(li.vehicle_type || record.vehicle_type)) continue;

    const row = mapUpdbdRecordToRow(record);
    if (!row.vin) continue;

    byVin.set(row.vin, row);

    const history = Array.isArray(li.sale_history) ? li.sale_history : [];
    if (history.length > 0) historyByVin.set(row.vin, history);
  }

  const rows = [...byVin.values()];
  if (rows.length === 0) return { saved: 0, savedSold: 0, savedNotSold: 0 };

  for (const rowsChunk of chunk(rows, BATCH_CHUNK_SIZE)) {
    const { error: carError } = await supabase.from('cars').upsert(rowsChunk, { onConflict: 'vin' });
    if (carError) throw carError;
  }

  if (historyByVin.size > 0) {
    const vins = [...historyByVin.keys()];

    for (const vinsChunk of chunk(vins, BATCH_CHUNK_SIZE)) {
      const { error: deleteError } = await supabase.from('sale_history').delete().in('car_vin', vinsChunk);
      if (deleteError) throw deleteError;

      const historyRows = vinsChunk.flatMap((vin) =>
        historyByVin.get(vin).map((entry) => ({
          car_vin: vin,
          sale_date: entry.sale_date || null,
          base_site: entry.base_site || null,
          sale_status: entry.sale_status || null,
          purchase_price: entry.purchase_price ?? null,
          raw_json: entry,
        }))
      );

      const { error: insertError } = await supabase.from('sale_history').insert(historyRows);
      if (insertError) throw insertError;
    }
  }

  const savedSold = rows.filter((r) => (r.sale_status || '').toLowerCase() === 'sold').length;

  return { saved: rows.length, savedSold, savedNotSold: rows.length - savedSold };
}
