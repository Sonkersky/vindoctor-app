export function formatPrice(car) {
  const value = car.purchase_price ?? car.cost_priced ?? car.price_new;
  if (value === null || value === undefined) return 'N/A';
  return `$${Number(value).toLocaleString('en-US')} USD`;
}

export function formatOdometer(car) {
  if (car.odometer === null || car.odometer === undefined) return 'N/A';
  const unit = car.odometer_index || 'mi';
  return `${Number(car.odometer).toLocaleString('en-US')} ${unit}`;
}

export function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
