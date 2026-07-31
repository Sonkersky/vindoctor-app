import 'server-only';
import { cache } from 'react';
import { getSupabaseClient } from './db';

const PAGE_SIZE = 12;

// Zamienia wiersz z bazy na obiekt "car" o dokładnie takich samych nazwach pól,
// jakie zwracało wcześniej apicar.store — dzięki temu logika renderowania
// (formatPrice, formatOdometer, itd.) może zostać przeniesiona 1:1.
function rowToCar(row) {
  if (!row) return null;
  return {
    vin: row.vin,
    title: row.title,
    year: row.year,
    make: row.make,
    model: row.model,
    series: row.series,
    vehicle_type: row.vehicle_type,
    color: row.color,
    engine: row.engine,
    engine_size: row.engine_size,
    cylinders: row.cylinders,
    fuel: row.fuel,
    drive: row.drive,
    transmission: row.transmission,
    keys: row.keys,
    base_site: row.base_site,
    location: row.location,
    state: row.state,
    odometer: row.odometer,
    odometer_index: row.odometer_index,
    odobrand: row.odobrand,
    damage_pr: row.damage_pr,
    damage_sec: row.damage_sec,
    document: row.document,
    seller: row.seller,
    seller_type: row.seller_type,
    status: row.status,
    purchase_price: row.purchase_price,
    sale_date: row.sale_date,
    sale_status: row.sale_status,
    sale_type: row.sale_type,
    link_img_hd: row.link_img_hd || [],
    link_img_small: row.link_img_small || [],
    iaai_360: row.iaai_360 || [],
    copart_exterior_360: row.copart_exterior_360 || [],
    video: row.video || [],
  };
}

const CAR_COLUMNS =
  'vin,title,year,make,model,series,vehicle_type,color,engine,engine_size,cylinders,fuel,drive,transmission,keys,base_site,location,state,odometer,odometer_index,odobrand,damage_pr,damage_sec,document,seller,seller_type,status,purchase_price,sale_date,sale_status,sale_type,link_img_hd,link_img_small,iaai_360,copart_exterior_360,video';

// site: '1' = Copart, '2' = IAAI (te same wartości co dotychczasowy <select id="filterAuction">)
function siteParamToBaseSite(site) {
  if (site === '1') return 'copart';
  if (site === '2') return 'iaai';
  return null;
}

export async function listCars(filters = {}, page = 1) {
  const supabase = getSupabaseClient();
  const {
    site,
    make,
    model,
    damage,
    status,
    state,
    yearFrom,
    yearTo,
    mileageFrom,
    mileageTo,
  } = filters;

  let query = supabase
    .from('cars')
    .select(CAR_COLUMNS)
    .ilike('sale_status', 'sold')
    .order('sale_date', { ascending: false });

  const baseSite = siteParamToBaseSite(site);
  if (baseSite) query = query.eq('base_site', baseSite);
  if (make) query = query.eq('make', make);
  if (model) query = query.eq('model', model);
  if (damage) query = query.eq('damage_pr', damage);
  if (status) query = query.eq('status', status);
  if (state) query = query.ilike('state', state);
  if (yearFrom) query = query.gte('year', Number(yearFrom));
  if (yearTo) query = query.lte('year', Number(yearTo));
  if (mileageFrom) query = query.gte('odometer', Number(mileageFrom));
  if (mileageTo) query = query.lte('odometer', Number(mileageTo));

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await query.range(from, to);
  if (error) throw error;

  const cars = (data || []).map(rowToCar);

  // Sprawdzamy, czy istnieje choć jeden wynik na kolejnej stronie,
  // żeby poprawnie włączyć/wyłączyć przycisk "Next →" (jak w oryginale).
  let hasNextPage = false;
  if (cars.length === PAGE_SIZE) {
    let nextCheck = supabase
      .from('cars')
      .select('vin', { head: true, count: 'exact' })
      .ilike('sale_status', 'sold');
    if (baseSite) nextCheck = nextCheck.eq('base_site', baseSite);
    if (make) nextCheck = nextCheck.eq('make', make);
    if (model) nextCheck = nextCheck.eq('model', model);
    if (damage) nextCheck = nextCheck.eq('damage_pr', damage);
    if (status) nextCheck = nextCheck.eq('status', status);
    if (state) nextCheck = nextCheck.ilike('state', state);
    if (yearFrom) nextCheck = nextCheck.gte('year', Number(yearFrom));
    if (yearTo) nextCheck = nextCheck.lte('year', Number(yearTo));
    if (mileageFrom) nextCheck = nextCheck.gte('odometer', Number(mileageFrom));
    if (mileageTo) nextCheck = nextCheck.lte('odometer', Number(mileageTo));
    const { count } = await nextCheck.range(to + 1, to + 1);
    hasNextPage = (count || 0) > 0;
  }

  return { cars, hasNextPage };
}

// cache() dedupes this call within a single request — generateMetadata()
// and the page component both call getCarByVin(vin) but hit the DB only once.
export const getCarByVin = cache(async function getCarByVin(vin) {
  const supabase = getSupabaseClient();

  const { data: carRow, error } = await supabase
    .from('cars')
    .select(CAR_COLUMNS)
    .eq('vin', vin)
    .maybeSingle();

  if (error) throw error;
  if (!carRow) return null;

  const car = rowToCar(carRow);

  const { data: historyRows, error: historyError } = await supabase
    .from('sale_history')
    .select('sale_date,base_site,sale_status,purchase_price')
    .eq('car_vin', vin)
    .order('sale_date', { ascending: false });

  if (historyError) throw historyError;
  car.sale_history = historyRows || [];

  return car;
});

export async function getSimilarLots(make, model, excludeVin, limit = 6) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('cars')
    .select(CAR_COLUMNS)
    .ilike('sale_status', 'sold')
    .eq('make', make)
    .eq('model', model)
    .neq('vin', excludeVin)
    .order('sale_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(rowToCar);
}

// Marki/modele do filtra bocznego — z widoku car_makes_models (patrz schema.sql).
export async function getMakesAndModels() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('car_makes_models')
    .select('make,model')
    .limit(5000);

  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    if (!row.make) continue;
    if (!map.has(row.make)) map.set(row.make, new Set());
    if (row.model) map.get(row.make).add(row.model);
  }

  return [...map.entries()]
    .map(([make, models]) => ({ make, models: [...models].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.make.localeCompare(b.make));
}

export { PAGE_SIZE };
