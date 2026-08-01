import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
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
    document_detail: row.document_detail,
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
  'vin,title,year,make,model,series,vehicle_type,color,engine,engine_size,cylinders,fuel,drive,transmission,keys,base_site,location,state,odometer,odometer_index,odobrand,damage_pr,damage_sec,document,document_detail,seller,seller_type,status,purchase_price,sale_date,sale_status,sale_type,link_img_hd,link_img_small,iaai_360,copart_exterior_360,video';

// Jedyne dwie wartości, jakie faktycznie występują w danych (potwierdzone na
// żywych danych) — dokładne dopasowanie ("eq") zamiast "ilike" pozwala
// Postgresowi użyć zwykłego indeksu zamiast pełnego skanu tabeli za każdym
// razem. Przy tabeli rosnącej codziennie o kilkadziesiąt tysięcy wierszy to
// był realny powód spowolnień/błędów pod obciążeniem.
const SOLD_VALUE = 'Sold';

// site: '1' = Copart, '2' = IAAI (te same wartości co dotychczasowy <select id="filterAuction">)
function siteParamToBaseSite(site) {
  if (site === '1') return 'copart';
  if (site === '2') return 'iaai';
  return null;
}

// Wspólna logika filtrowania, używana zarówno do właściwego zapytania jak i
// do sprawdzenia "czy jest kolejna strona" — żeby nie utrzymywać dwóch kopii.
function applyFilters(query, filters) {
  const {
    site,
    make,
    model,
    damage,
    status,
    yearFrom,
    yearTo,
    mileageFrom,
    mileageTo,
    sellerCategory,
    engineSizeFrom,
    engineSizeTo,
    fuel,
    cylinders,
    vehicleType,
  } = filters;

  let q = query.eq('sale_status', SOLD_VALUE);

  const baseSite = siteParamToBaseSite(site);
  if (baseSite) q = q.eq('base_site', baseSite);
  if (make) q = q.eq('make', make);
  if (model) q = q.eq('model', model);
  if (damage) q = q.eq('damage_pr', damage);
  if (status) q = q.eq('status', status);
  if (yearFrom) q = q.gte('year', Number(yearFrom));
  if (yearTo) q = q.lte('year', Number(yearTo));
  if (mileageFrom) q = q.gte('odometer', Number(mileageFrom));
  if (mileageTo) q = q.lte('odometer', Number(mileageTo));
  if (sellerCategory === 'insurance') q = q.ilike('seller_type', 'insurance');
  if (sellerCategory === 'non-insurance') q = q.or('seller_type.is.null,seller_type.neq.insurance');
  if (engineSizeFrom) q = q.gte('engine_size', Number(engineSizeFrom));
  if (engineSizeTo) q = q.lte('engine_size', Number(engineSizeTo));
  if (fuel) q = q.eq('fuel', fuel);
  if (cylinders) q = q.eq('cylinders', cylinders);
  if (vehicleType) q = q.eq('vehicle_type', vehicleType);

  return q;
}

export async function listCars(filters = {}, page = 1) {
  const supabase = getSupabaseClient();

  let query = applyFilters(supabase.from('cars').select(CAR_COLUMNS), filters)
    .order('year', { ascending: false })
    .order('sale_date', { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await query.range(from, to);
  if (error) throw error;

  const cars = (data || []).map(rowToCar);

  // Sprawdzamy, czy istnieje choć jeden wynik na kolejnej stronie,
  // żeby poprawnie włączyć/wyłączyć przycisk "Next →" (jak w oryginale).
  let hasNextPage = false;
  if (cars.length === PAGE_SIZE) {
    const nextCheck = applyFilters(
      supabase.from('cars').select('vin', { head: true, count: 'exact' }),
      filters
    );
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
    .eq('sale_status', SOLD_VALUE)
    .eq('make', make)
    .eq('model', model)
    .neq('vin', excludeVin)
    .order('sale_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(rowToCar);
}

// Marki/modele do filtra bocznego — z widoku car_makes_models (patrz schema.sql).
// Ta lista jest identyczna dla każdego odwiedzającego i nie musi być
// idealnie aktualna co do sekundy, więc trzymamy ją w cache'u Next.js na
// 5 minut — bez tego każde wejście na stronę główną odpytywało bazę od nowa.
export const getMakesAndModels = unstable_cache(
  async function getMakesAndModels() {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from('car_makes_models').select('make,model').limit(5000);

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
  },
  ['makes-and-models'],
  { revalidate: 300 }
);

// Liczniki do stopki — prawdziwe (z naszej bazy), w przeciwieństwie do
// dawnego licznika opartego o apicar.store, który nie zwracał total.
// Cache'owane z tego samego powodu co getMakesAndModels() — to samo dla
// każdego, nie trzeba liczyć 3x COUNT(*) na każde wejście na stronę.
export const getLotCounts = unstable_cache(
  async function getLotCounts() {
    const supabase = getSupabaseClient();

    const [totalRes, copartRes, iaaiRes] = await Promise.all([
      supabase.from('cars').select('vin', { head: true, count: 'exact' }).eq('sale_status', SOLD_VALUE),
      supabase
        .from('cars')
        .select('vin', { head: true, count: 'exact' })
        .eq('sale_status', SOLD_VALUE)
        .eq('base_site', 'copart'),
      supabase
        .from('cars')
        .select('vin', { head: true, count: 'exact' })
        .eq('sale_status', SOLD_VALUE)
        .eq('base_site', 'iaai'),
    ]);

    return {
      total: totalRes.count || 0,
      copart: copartRes.count || 0,
      iaai: iaaiRes.count || 0,
    };
  },
  ['lot-counts'],
  { revalidate: 300 }
);

export { PAGE_SIZE };
