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

// Zielony gdy pole ma realną wartość, pomarańczowy gdy to Dealer albo brak danych (N/A).
export function isSellerFlagged(sellerName, sellerType) {
  const name = (sellerName || '').toString().trim();
  const combined = `${name} ${sellerType || ''}`.toLowerCase();
  return !name || name.toUpperCase() === 'N/A' || combined.includes('dealer');
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
