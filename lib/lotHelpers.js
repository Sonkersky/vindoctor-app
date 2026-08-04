const DESTRUCTIVE_DOC_STATUSES = [
  'non-registable',
  'non registable',
  'certificate of destruction',
  'scrap',
  'parts only',
];

export function isDestructiveDocument(document_) {
  const value = (document_ || '').toString().toLowerCase();
  return DESTRUCTIVE_DOC_STATUSES.some((status) => value.includes(status));
}

// Czasem apicar.store zwraca w polu "seller" nazwę pliku obrazka zamiast
// nazwy firmy (np. "ENTERPRISE-LOGO.jpeg" — błąd po ich stronie, widziany
// na setkach lotów). Traktujemy to tak, jakby nazwy w ogóle nie było.
function looksLikeFilename(value) {
  return /\.(jpe?g|png|gif|svg|bmp|webp)$/i.test(value);
}

// Sprzedawca — logika binarna Insurance / Non-insurance (dealer traktowany
// jak Non-insurance, tak jak na referencyjnej stronie klienta):
// - jest nazwa (np. "GEICO")           -> pokaż nazwę, kolor wg typu
// - brak nazwy, ale seller_type=insurance -> "Insurance Company" (zielony)
// - brak nazwy i reszta przypadków (dealer/nieznany) -> "Non-insurance"
//   (pomarańczowy) + podpowiedź o ostrożności, bo nie wiemy nic konkretnego
export function sellerDisplay(sellerName, sellerType) {
  const rawName = (sellerName || '').toString().trim();
  const name = looksLikeFilename(rawName) ? '' : rawName;
  const isInsurance = (sellerType || '').toString().trim().toLowerCase() === 'insurance';

  if (name && name.toUpperCase() !== 'N/A') {
    return { text: name, className: isInsurance ? 'seller-insurance' : 'seller-non-insurance', showTooltip: false };
  }
  if (isInsurance) {
    return { text: 'Insurance Company', className: 'seller-insurance', showTooltip: false };
  }
  return { text: 'Non-insurance', className: 'seller-non-insurance', showTooltip: true };
}

export function saleStatusPill(rawStatus) {
  const status = (rawStatus || '').toString().trim();
  if (!status) return { text: 'N/A', className: 'sale-status-pill' };

  const s = status.toLowerCase();
  if (s.includes('not sold')) return { text: status, className: 'sale-status-pill status-not-sold' };
  if (s.includes('approval')) return { text: status, className: 'sale-status-pill status-approval' };
  if (s.includes('sold')) return { text: status, className: 'sale-status-pill status-sold' };
  return { text: status, className: 'sale-status-pill' };
}

// Dodatkowe dane z API — pokazywane TYLKO jeśli faktycznie przyszły z bazy.
export function extraInfoFields(car) {
  return [
    { label: 'Document Detail', value: car.document_detail },
    { label: 'Series / Trim', value: car.series },
    { label: 'Vehicle Type', value: car.vehicle_type },
    { label: 'Color', value: car.color },
    { label: 'Engine', value: car.engine },
    { label: 'Engine Size', value: car.engine_size },
    { label: 'Cylinders', value: car.cylinders },
    { label: 'Fuel Type', value: car.fuel },
    { label: 'Drive Type', value: car.drive },
    { label: 'Keys', value: car.keys },
    { label: 'Secondary Damage', value: car.damage_sec },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
}
