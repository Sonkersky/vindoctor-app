import { getSupabaseClient } from './supabaseAdmin.js';

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
    engine_size: apiCar.engine_size || null,
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
