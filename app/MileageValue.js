'use client';

import { useFavorites } from './FavoritesContext';

const KM_PER_MI = 1.60934;
const MI_PER_KM = 1 / KM_PER_MI;

// Odometr w bazie jest zapisany w JEDNOSTCE ŹRÓDŁOWEJ danego auta
// (car.odometer_index — prawie zawsze "mi", ale nie zawsze), a użytkownik
// może chcieć widzieć wszystko w "km". Przeliczamy więc per-auto względem
// jego własnej jednostki źródłowej, a nie jednym globalnym mnożnikiem.
export default function MileageValue({ odometer, unit, suffix = '', fallback = 'N/A' }) {
  const { mileageUnit } = useFavorites();

  if (odometer === null || odometer === undefined) return fallback;

  const storedUnit = (unit || 'mi').toLowerCase() === 'km' ? 'km' : 'mi';
  const displayUnit = mileageUnit === 'km' ? 'km' : 'mi';

  let value = Number(odometer);
  if (storedUnit !== displayUnit) {
    value = storedUnit === 'mi' ? value * KM_PER_MI : value * MI_PER_KM;
  }

  return `${Math.round(value).toLocaleString('en-US')} ${displayUnit}${suffix}`;
}
