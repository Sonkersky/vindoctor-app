// Logika kalkulatora kosztów sprowadzenia "pod dom" — 1:1 odtworzenie
// formuł z arkusza klienta (Kalkulator_Wojtek.xlsx, zakładka "Summary").
// Stałe biznesowe poniżej pochodzą wprost z tego arkusza (komórki H13/H14/
// H21/M18/formuła VAT) — źródło: Kalkulator_Wojtek.xlsx, przekazany przez
// klienta 2026-08-12.

export const EXPORT_FEE_USD = 650; // opłata eksportowa, pomijana przy "stan zamknięty"
export const EV_HYBRID_SURCHARGE_USD = 600; // dopłata za elektryk/hybrydę
export const CUSTOMS_HANDLING_FEE_EUR = 700; // stała opłata za obsługę celną
export const VAT_RATE = 0.21;
export const DUTY_RATE_OPTIONS = [
  { value: 0.1, label: '10%' },
  { value: 0.06, label: '6%' },
];
export const POLAND_TRANSPORT_FLAT_PLN = 2800; // stały koszt transportu do Polski

export const VEHICLE_TYPE_OPTIONS = [
  { value: 'suv_1_3', label: 'SUV (1/3 container)', field: 'freight_suv_1_3' },
  { value: 'car_1_4', label: 'Car (1/4 container)', field: 'freight_car_1_4' },
  { value: 'car_1_2', label: 'Car (1/2 container)', field: 'freight_car_1_2' },
  { value: 'moto', label: 'Motorcycle', field: 'freight_moto' },
  { value: 'quad', label: 'Quad', field: 'freight_quad' },
];

export function normalizeCity(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim().toUpperCase();
}

// cars.location bywa w dwóch formatach zależnie od aukcji:
// Copart: "CA - Los Angeles" (stan - miasto)
// IAAI:   "South Bend (IN)" (miasto (stan))
// Zwraca samo miasto, znormalizowane pod dopasowanie do yard_city_norm.
export function guessYardCity(car) {
  const location = car.location || '';
  if (car.base_site === 'iaai') {
    return normalizeCity(location.replace(/\s*\([^)]*\)\s*$/, ''));
  }
  const parts = location.split(' - ');
  return normalizeCity(parts.length > 1 ? parts[1] : location);
}

export function findRoute(auction, cityNorm, routes) {
  if (!cityNorm) return null;
  return routes.find((r) => r.auction === auction && r.yard_city_norm === cityNorm) || null;
}

// Opłaty aukcyjne — dla kwot licytacji poniżej najwyższego przedziału to
// stała kwota (total_fee) przypisana do przedziału; powyżej — procent kwoty
// licytacji + stała dopłata (patrz percentage_rate/flat_addon w schemacie).
export function calcAuctionFee(auction, bidAmount, feeBrackets) {
  const rows = feeBrackets.filter((f) => f.auction === auction);
  if (rows.length === 0) return 0;

  const topBracket = rows.reduce((max, r) => (r.max_price > (max?.max_price ?? -Infinity) ? r : max), null);

  if (bidAmount >= topBracket.min_price) {
    return topBracket.percentage_rate * bidAmount + topBracket.flat_addon;
  }

  const bracket = rows.find((r) => bidAmount >= r.min_price && bidAmount < r.max_price);
  return bracket ? bracket.total_fee : 0;
}

export function freightForVehicleType(route, vehicleTypeValue) {
  const option = VEHICLE_TYPE_OPTIONS.find((v) => v.value === vehicleTypeValue);
  if (!route || !option) return 0;
  return route[option.field] || 0;
}

// Główna funkcja licząca — zwraca pełny rozkład kosztów (etap 1/2/3) plus
// sumę końcową w PLN. Wszystkie kwoty wejściowe poza customsValueEur i
// polandTransportPln są w USD (tak jak w oryginalnym arkuszu).
export function computeLandingCost({
  auction,
  bidAmount,
  route,
  vehicleType,
  isEvHybrid,
  isClosedTitle,
  dutyRate,
  customsValueEur,
  usdPlnRate,
  eurPlnRate,
  feeBrackets,
  polandTransportPln = POLAND_TRANSPORT_FLAT_PLN,
}) {
  const auctionFee = calcAuctionFee(auction, bidAmount, feeBrackets);
  const landTransport = route ? route.land_transport_cost + route.land_transport_security_fee : 0;
  const freight = route ? freightForVehicleType(route, vehicleType) + route.freight_security_fee : 0;
  const exportFee = isClosedTitle ? 0 : EXPORT_FEE_USD;
  const evSurcharge = isEvHybrid ? EV_HYBRID_SURCHARGE_USD : 0;

  const stage1TotalUsd = bidAmount + auctionFee + landTransport + freight + exportFee + evSurcharge;

  const duty = customsValueEur * dutyRate;
  const vat = (customsValueEur + duty) * VAT_RATE;
  const stage2TotalEur = duty + vat + CUSTOMS_HANDLING_FEE_EUR;

  const totalPln = stage1TotalUsd * usdPlnRate + stage2TotalEur * eurPlnRate + polandTransportPln;
  // Wewnętrzna kalkulacja (cło/VAT liczone od wartości w EUR) trzyma się
  // dokładnie logiki z arkusza, ale klient chce widzieć końcową kwotę "pod
  // dom" w USD — przeliczamy sumę PLN z powrotem przez bieżący kurs.
  const totalUsd = totalPln / usdPlnRate;

  return {
    auctionFee,
    landTransport,
    freight,
    exportFee,
    evSurcharge,
    stage1TotalUsd,
    duty,
    vat,
    customsHandlingFee: CUSTOMS_HANDLING_FEE_EUR,
    stage2TotalEur,
    polandTransportPln,
    totalPln,
    totalUsd,
  };
}

// Domyślna "wartość odprawy" (EUR) — brak jednoznacznej reguły w arkuszu
// (to osobno wpisywana wartość biznesowa, nie automatyczne wyliczenie), więc
// jako sensowny punkt startowy bierzemy sumę etapu 1 przeliczoną z USD na
// EUR przez kurs krzyżowy — użytkownik może to nadpisać ręcznie.
export function defaultCustomsValueEur(stage1TotalUsd, usdPlnRate, eurPlnRate) {
  if (!eurPlnRate) return 0;
  return Math.round((stage1TotalUsd * usdPlnRate) / eurPlnRate);
}
