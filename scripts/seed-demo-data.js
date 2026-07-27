// Generuje ZMYŚLONE przykładowe loty (bez odpytywania apicar.store — zero
// zużytych kredytów), żeby dało się przetestować filtry, paginację itd.
// gdy nie chcemy/nie możemy akurat ciągnąć prawdziwych danych z API.
//
// Wszystkie wygenerowane VIN-y zaczynają się od "DEMO" — łatwo je rozpoznać
// i łatwo usunąć poleceniem --cleanup, żeby nie zostawić ich przypadkiem
// w bazie produkcyjnej.
//
// Użycie:
//   node --env-file=.env.local scripts/seed-demo-data.js               -> doda 60 zmyślonych lotów
//   node --env-file=.env.local scripts/seed-demo-data.js --count=20     -> doda 20
//   node --env-file=.env.local scripts/seed-demo-data.js --cleanup      -> usuwa wszystkie DEMO*

import { getSupabaseClient } from '../lib/supabaseAdmin.js';

const MAKES_MODELS = [
  ['Toyota', 'Camry'],
  ['Toyota', 'Corolla'],
  ['Ford', 'F-150'],
  ['Ford', 'Mustang'],
  ['Honda', 'Civic'],
  ['Honda', 'Accord'],
  ['Nissan', 'Altima'],
  ['Chevrolet', 'Silverado'],
  ['Chevrolet', 'Malibu'],
  ['BMW', '3 Series'],
  ['Jeep', 'Grand Cherokee'],
  ['Tesla', 'Model 3'],
];

const DAMAGE_OPTIONS = ['Front End', 'Rear End', 'Side', 'Hail', 'Water/Flood', 'Rollover', 'Normal Wear'];
const STATUS_OPTIONS = ['Run & Drive', 'Starts', 'Stationary'];
const STATES = ['FL', 'CA', 'TX', 'GA', 'NY', 'CO', 'IL', 'NV'];
const LOCATIONS = {
  FL: 'FL - Orlando', CA: 'CA - Fresno', TX: 'TX - Dallas', GA: 'GA - Atlanta',
  NY: 'NY - Albany', CO: 'CO - Denver', IL: 'IL - Chicago', NV: 'NV - Las Vegas',
};
const DOCUMENTS = ['Clean Title', 'Salvage Title', 'Certificate of Destruction', 'Rebuilt Title'];
const SELLERS = ['Insurance Corp', 'Dealer', 'N/A', 'Fleet Company'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function fakeVin(i) {
  return `DEMO${String(i).padStart(13, '0')}`;
}

function buildDemoCar(i) {
  const [make, model] = pick(MAKES_MODELS);
  const year = randInt(1995, 2026);
  const state = pick(STATES);
  const site = i % 2 === 0 ? 'copart' : 'iaai';
  const price = randInt(300, 25000);
  const odometer = randInt(0, 300000);
  const saleDaysAgo = randInt(0, 900);
  const saleDate = new Date(Date.now() - saleDaysAgo * 24 * 60 * 60 * 1000).toISOString();

  return {
    vin: fakeVin(i),
    title: `${year} ${make.toUpperCase()} ${model.toUpperCase()}`,
    year,
    make,
    model,
    base_site: site,
    location: LOCATIONS[state],
    state,
    odometer,
    odometer_index: 'mi',
    odobrand: 'ACTUAL',
    damage_pr: pick(DAMAGE_OPTIONS),
    document: pick(DOCUMENTS),
    seller: pick(SELLERS),
    seller_type: 'company',
    status: pick(STATUS_OPTIONS),
    purchase_price: price,
    sale_date: saleDate,
    sale_status: 'Sold',
    transmission: pick(['Automatic', 'Manual']),
    color: pick(['White', 'Black', 'Silver', 'Red', 'Blue']),
    engine: `${(randInt(15, 50) / 10).toFixed(1)}l`,
    fuel: 'Gasoline',
    drive: pick(['Front Wheel Drive', 'Rear Wheel Drive', 'All Wheel Drive']),
    keys: pick(['Yes', 'No']),
    link_img_hd: [`https://placehold.co/1000x700/1e293b/94a3b8?text=${encodeURIComponent(`${year} ${make} ${model}`)}`],
    link_img_small: [`https://placehold.co/600x400/1e293b/94a3b8?text=${encodeURIComponent(`${year} ${make} ${model}`)}`],
    iaai_360: [],
    copart_exterior_360: [],
    video: [],
    raw_json: { demo: true },
  };
}

async function seed(count) {
  const supabase = getSupabaseClient();
  const rows = Array.from({ length: count }, (_, i) => buildDemoCar(i + 1));

  const { error } = await supabase.from('cars').upsert(rows, { onConflict: 'vin' });
  if (error) throw error;

  console.log(`Dodano/zaktualizowano ${count} zmyślonych lotów (VIN zaczynające się od "DEMO").`);
}

async function cleanup() {
  const supabase = getSupabaseClient();
  const { error, count } = await supabase
    .from('cars')
    .delete({ count: 'exact' })
    .like('vin', 'DEMO%');
  if (error) throw error;
  console.log(`Usunięto ${count ?? '?'} zmyślonych lotów (DEMO%).`);
}

function parseArgs() {
  const args = { count: 60, cleanup: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--cleanup') args.cleanup = true;
    else if (arg.startsWith('--count=')) args.count = Number(arg.split('=')[1]) || 60;
  }
  return args;
}

const { count, cleanup: doCleanup } = parseArgs();

(doCleanup ? cleanup() : seed(count)).catch((err) => {
  console.error('Błąd:', err);
  process.exit(1);
});
