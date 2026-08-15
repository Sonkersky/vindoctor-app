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
// żywych danych) — dokładne dopasowanie ("eq"/"in") zamiast "ilike" pozwala
// Postgresowi użyć zwykłego indeksu zamiast pełnego skanu tabeli za każdym
// razem. Przy tabeli rosnącej codziennie o kilkadziesiąt tysięcy wierszy to
// był realny powód spowolnień/błędów pod obciążeniem.
const SOLD_VALUE = 'Sold';
const NOT_SOLD_VALUE = 'Not sold';
const APPROVAL_VALUE = 'ON APPROVAL';

// site: '1' = Copart, '2' = IAAI (te same wartości co dotychczasowy <select id="filterAuction">)
function siteParamToBaseSite(site) {
  if (site === '1') return 'copart';
  if (site === '2') return 'iaai';
  return null;
}

// Filtry wspólne dla "cars" (Archive) i "active_lots" (Actual) — te same
// nazwy kolumn występują w obu tabelach (patrz supabase/schema.sql).
function applyCommonFilters(query, filters) {
  const {
    site,
    make,
    model,
    trim,
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

  let q = query;

  const baseSite = siteParamToBaseSite(site);
  if (baseSite) q = q.eq('base_site', baseSite);
  if (make) q = q.eq('make', make);
  if (model) q = q.eq('model', model);
  if (trim) q = q.eq('series', trim);
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
  // Domyślnie (brak wybranego typu w filtrze) pokazujemy tylko samochody
  // osobowe — inaczej na stronie głównej wskakują przyczepki/motocykle/itp.
  // "all" to jawny wybór "Wszystkie typy" z filtra, który to wyłącza.
  if (vehicleType === 'all') {
    // brak filtra — pokaż wszystkie typy pojazdów
  } else if (vehicleType) {
    q = q.eq('vehicle_type', vehicleType);
  } else {
    q = q.eq('vehicle_type', 'Automobile');
  }

  return q;
}

// Wspólna logika filtrowania "cars" (Archive), używana zarówno do właściwego
// zapytania jak i do sprawdzenia "czy jest kolejna strona".
function applyFilters(query, filters) {
  // Pokazujemy też loty "Not sold" (aukcja się odbyła, ale nikt nie kupił) —
  // widoczne w Archive z czerwoną plakietką "Not sold" — i "ON APPROVAL"
  // (transakcja czeka na zatwierdzenie) z żółtą plakietką (patrz
  // tileStatusPillClass w app/CarTile.js, gałąź domyślna "status-other"),
  // zamiast być całkowicie ukryte.
  return applyCommonFilters(query.in('sale_status', [SOLD_VALUE, NOT_SOLD_VALUE, APPROVAL_VALUE]), filters);
}

// "active_lots" nie ma kolumny sale_status w ogóle — każdy wiersz w tej
// tabeli JEST z definicji jeszcze aktywny (patrz app/api/sync-active/route.js,
// który usuwa stąd loty w chwili sprzedaży). buyNowOnly — tylko dla tej
// tabeli (cars w ogóle nie ma is_buynow), stąd tu, a nie w applyCommonFilters.
function applyActiveFilters(query, filters) {
  let q = applyCommonFilters(query, filters);
  if (filters.buyNowOnly) q = q.eq('is_buynow', true);
  // Bezpiecznik: apicar.store czasem nie usuwa lotu z /cars/deleted od razu
  // po minięciu daty aukcji (znalezione na żywo: lot z auction_date sprzed
  // 3+ tygodni, wciąż obecny) — bez tego filtra taki wiersz zawsze wygrywał
  // sortowanie "najbliższa licytacja" i siedział na pierwszym miejscu w
  // nieskończoność, sprawiając wrażenie, że nic się nie zmienia. auction_date
  // bywa też null (jeszcze nie wyznaczona) — takie loty zostają widoczne.
  return q.or(`auction_date.is.null,auction_date.gte.${new Date().toISOString()}`);
}

// Jedno tanie zapytanie: "czy istnieje choć jeden wiersz na tej stronie"
// — zwykły select+range BEZ count:'exact'. UWAGA (znalezione po fakcie,
// przy 141k+675k wierszach): count:'exact' w PostgREST/Supabase liczy
// WSZYSTKIE pasujące wiersze w całej tabeli, niezależnie od range()/limit —
// range tylko ogranicza to, co wraca w treści odpowiedzi, nie to, co jest
// liczone. Zmierzone na żywo: to samo zapytanie z count:'exact' – 8.4s,
// bez – 0.47s. Tu potrzebujemy tylko "czy jest >=1 wiersz", więc zwykły
// select().range(offset,offset) i sprawdzenie długości wyniku wystarcza —
// bez żadnego liczenia całego (filtrowanego) zbioru.
async function pageHasResults(supabase, table, applyFn, filters, targetPage) {
  const offset = (targetPage - 1) * PAGE_SIZE;
  const check = applyFn(supabase.from(table).select('lot_id'), filters);
  const { data, error } = await check.range(offset, offset);
  if (error) throw error;
  return (data || []).length > 0;
}

// PaginationBar.js pokazuje okno maks. 10 numerków stron (currentPage-4 ..
// currentPage+5). Bez tej funkcji te numerki były zawsze wszystkie klikalne,
// nawet gdy realnie istniały np. tylko 3 strony wyników — prowadziło to do
// pustych stron. Znajdujemy górną granicę wyszukiwaniem binarnym (maks. ok.
// 4 dodatkowe zapytania, każde to pojedynczy indeksowany "czy wiersz
// istnieje" check — nie pełny COUNT całej tabeli, więc koszt nie rośnie
// wraz z wielkością bazy).
async function findLastPageInWindow(supabase, table, applyFn, filters, currentPage, hasNextPage) {
  const windowStart = Math.max(1, currentPage - 4);
  const windowEnd = windowStart + 9;

  // currentPage ma wyniki (właśnie je pobraliśmy); jeśli hasNextPage=true,
  // currentPage+1 też — zaczynamy poszukiwania od tego, co już wiadomo.
  let lo = hasNextPage ? currentPage + 1 : currentPage;
  if (lo >= windowEnd) return windowEnd;
  if (await pageHasResults(supabase, table, applyFn, filters, windowEnd)) return windowEnd;

  let hi = windowEnd;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (await pageHasResults(supabase, table, applyFn, filters, mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

export async function listCars(filters = {}, page = 1) {
  const supabase = getSupabaseClient();

  // sale_date pierwsze, nie year — inaczej auta z najwyższym rocznikiem (np.
  // 2027) zawsze wygrywały sortowanie, nawet gdy zostały sprzedane dawno
  // temu, przez co Archive stronę 1 zawsze zajmowały te same, coraz starsze
  // wpisy zamiast tego, co faktycznie właśnie doszło (zgłoszone: "nic
  // nowego"). year jako drugie kryterium tylko przy identycznej dacie.
  let query = applyFilters(supabase.from('cars').select(CAR_COLUMNS), filters)
    .order('sale_date', { ascending: false })
    .order('year', { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await query.range(from, to);
  if (error) throw error;

  const cars = (data || []).map(rowToCar);

  // Sprawdzamy, czy istnieje choć jeden wynik na kolejnej stronie,
  // żeby poprawnie włączyć/wyłączyć przycisk "Next →" (jak w oryginale).
  let hasNextPage = false;
  if (cars.length === PAGE_SIZE) {
    const nextCheck = applyFilters(supabase.from('cars').select('vin'), filters);
    const { data: nextData, error: nextError } = await nextCheck.range(to + 1, to + 1);
    if (nextError) throw nextError;
    hasNextPage = (nextData || []).length > 0;
  }

  const lastPageInWindow = await findLastPageInWindow(supabase, 'cars', applyFilters, filters, page, hasNextPage);

  return { cars, hasNextPage, lastPageInWindow };
}

// Zamienia wiersz "active_lots" na obiekt kompatybilny z CarTile — te same
// nazwy pól co rowToCar(), z dwoma świadomymi podmianami (bo aukcja jeszcze
// trwa, nie ma "finalnej" ceny/daty): purchase_price <- current_bid,
// sale_date <- auction_date. sale_status zostaje puste (patrz isActiveView
// w app/page.js, które i tak ukrywa plakietkę statusu dla tego widoku).
function activeRowToCar(row) {
  if (!row) return null;
  return {
    vin: row.vin,
    lot_id: row.lot_id,
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
    purchase_price: row.current_bid,
    sale_date: row.auction_date,
    sale_status: null,
    sale_type: row.is_buynow ? 'buynow' : null,
    link_img_hd: row.link_img_hd || [],
    link_img_small: row.link_img_small || [],
    iaai_360: row.iaai_360 || [],
    copart_exterior_360: row.copart_exterior_360 || [],
    video: row.video || [],
  };
}

const ACTIVE_LOT_COLUMNS =
  'lot_id,vin,title,year,make,model,series,vehicle_type,color,engine,engine_size,cylinders,fuel,drive,transmission,keys,base_site,location,state,odometer,odometer_index,odobrand,damage_pr,damage_sec,document,document_detail,seller,seller_type,status,current_bid,auction_date,is_buynow,link_img_hd,link_img_small,iaai_360,copart_exterior_360,video';

// Odpowiednik listCars() dla zakładki "Actual" — czyta z active_lots
// (zasilanej przez app/api/sync-active/route.js) zamiast z cars.
export async function listActiveLots(filters = {}, page = 1) {
  const supabase = getSupabaseClient();

  let query = applyActiveFilters(supabase.from('active_lots').select(ACTIVE_LOT_COLUMNS), filters)
    .order('auction_date', { ascending: true })
    .order('year', { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await query.range(from, to);
  if (error) throw error;

  const cars = (data || []).map(activeRowToCar);

  let hasNextPage = false;
  if (cars.length === PAGE_SIZE) {
    const nextCheck = applyActiveFilters(supabase.from('active_lots').select('lot_id'), filters);
    const { data: nextData, error: nextError } = await nextCheck.range(to + 1, to + 1);
    if (nextError) throw nextError;
    hasNextPage = (nextData || []).length > 0;
  }

  const lastPageInWindow = await findLastPageInWindow(
    supabase,
    'active_lots',
    applyActiveFilters,
    filters,
    page,
    hasNextPage
  );

  return { cars, hasNextPage, lastPageInWindow };
}

// Krótki, jednorazowy rządek kafelków-zajawek (sekcje "Buy Now Inventory" /
// "Motorcycles" na stronie głównej — patrz app/page.js) — bez paginacji, bez
// hasNextPage, bez findLastPageInWindow, bo tu w ogóle nie ma stron do
// przeglądania, tylko stała, mała liczba wierszy.
export async function getActiveLotsPreview(extraFilters = {}, limit = 4) {
  const supabase = getSupabaseClient();

  const { data, error } = await applyActiveFilters(supabase.from('active_lots').select(ACTIVE_LOT_COLUMNS), extraFilters)
    .order('auction_date', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(activeRowToCar);
}

// Liczniki do tych samych dwóch sekcji — patrz get_active_lot_counts()
// w supabase/schema.sql (uzasadnienie cache'owania jak przy getLotCounts).
export const getActiveLotCounts = unstable_cache(
  async function getActiveLotCounts() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_active_lot_counts');
    if (error) throw error;
    return { buyNow: data?.buyNow || 0, motorcycles: data?.motorcycles || 0 };
  },
  ['active-lot-counts'],
  { revalidate: 300 }
);

// cache() dedupes this call within a single request — generateMetadata()
// and the page component both call getCarByVin(vin) but hit the DB only once.
//
// Sprawdza OBIE tabele — wcześniej sprawdzało tylko "cars", więc strona lotu
// dla auta, które istnieje TYLKO w active_lots (98,6% próbki na żywo — auto
// nigdy wcześniej nie było w naszej bazie historycznej), zwracała 404. Gdy
// auto jest w obu (wróciło na aukcję po "Not sold"/"ON APPROVAL") — dane do
// wyświetlenia na górze strony biorą aktualny, aktywny lot (świeższe zdjęcia/
// cena/data aukcji), a poprzedni wynik z "cars" trafia jako pierwszy wpis do
// Sales History — apicar.store nie zawsze sam dokłada tam ten wpis (patrz
// puste sale_history przy realnym "wraca na aukcję po Not sold" — sprawdzone
// na żywo), więc dokładamy go ręcznie.
export const getCarByVin = cache(async function getCarByVin(vin) {
  const supabase = getSupabaseClient();

  const [
    { data: carRow, error: carError },
    { data: activeRow, error: activeError },
  ] = await Promise.all([
    supabase.from('cars').select(CAR_COLUMNS).eq('vin', vin).maybeSingle(),
    supabase.from('active_lots').select(ACTIVE_LOT_COLUMNS).eq('vin', vin).maybeSingle(),
  ]);

  if (carError) throw carError;
  if (activeError) throw activeError;
  if (!carRow && !activeRow) return null;

  const car = activeRow ? activeRowToCar(activeRow) : rowToCar(carRow);
  car.isActiveLot = Boolean(activeRow);

  if (carRow) {
    const { data: historyRows, error: historyError } = await supabase
      .from('sale_history')
      .select('sale_date,base_site,sale_status,purchase_price')
      .eq('car_vin', vin)
      .order('sale_date', { ascending: false });

    if (historyError) throw historyError;

    const previousResult = {
      sale_date: carRow.sale_date,
      base_site: carRow.base_site,
      sale_status: carRow.sale_status,
      purchase_price: carRow.purchase_price,
    };
    // Unikamy zduplikowanego wiersza, gdyby apicar.store JEDNAK już sam
    // dołożył ten sam wynik do sale_history (data + status + cena identyczne).
    const alreadyIncluded = (historyRows || []).some(
      (h) => h.sale_date === previousResult.sale_date && h.sale_status === previousResult.sale_status
    );

    car.sale_history = activeRow && !alreadyIncluded
      ? [previousResult, ...(historyRows || [])]
      : historyRows || [];
  } else {
    car.sale_history = [];
  }

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
// każdego, nie trzeba liczyć tego na każde wejście na stronę.
//
// Uwaga: celowo NIE liczymy tego przez select({head:true, count:'exact'})
// (liczba wtedy przychodzi w nagłówku Content-Range) — na Vercelu to
// zaobserwowane zwracało 0 (dwa razy, dla różnych zapytań), mimo że te same
// zapytania działały poprawnie lokalnie i bezpośrednio przez REST. Funkcja
// SQL zwracająca liczby wprost w treści odpowiedzi (JSON) omija ten problem.
export const getLotCounts = unstable_cache(
  async function getLotCounts() {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('get_lot_counts');
    if (error) throw error;

    return {
      total: data?.total || 0,
      copart: data?.copart || 0,
      iaai: data?.iaai || 0,
    };
  },
  ['lot-counts'],
  { revalidate: 300 }
);

// Statystyki cenowe (min/max/avg) dla CAŁEGO przefiltrowanego zbioru, nie
// tylko widocznej strony — patrz get_price_stats() w supabase/schema.sql.
// Celowo bez unstable_cache: wynik zależy od bieżących filtrów (za dużo
// możliwych kombinacji, żeby sensownie cache'ować pod kluczem).
export async function getPriceStats(filters = {}) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_price_stats', {
    p_site: filters.site || null,
    p_make: filters.make || null,
    p_model: filters.model || null,
    p_trim: filters.trim || null,
    p_damage: filters.damage || null,
    p_status: filters.status || null,
    p_year_from: filters.yearFrom ? Number(filters.yearFrom) : null,
    p_year_to: filters.yearTo ? Number(filters.yearTo) : null,
    p_mileage_from: filters.mileageFrom ? Number(filters.mileageFrom) : null,
    p_mileage_to: filters.mileageTo ? Number(filters.mileageTo) : null,
    p_seller_category: filters.sellerCategory || null,
    p_engine_size_from: filters.engineSizeFrom ? Number(filters.engineSizeFrom) : null,
    p_engine_size_to: filters.engineSizeTo ? Number(filters.engineSizeTo) : null,
    p_fuel: filters.fuel || null,
    p_cylinders: filters.cylinders || null,
    p_vehicle_type: filters.vehicleType || null,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;

  return {
    min: row?.min_price ?? null,
    max: row?.max_price ?? null,
    avg: row?.avg_price ?? null,
    count: row?.sample_count ?? 0,
  };
}

export { PAGE_SIZE };
