// Jednorazowy import danych kalkulatora kosztów (opłaty aukcyjne + trasy
// transportu) wyciągniętych z Kalkulator_Wojtek.xlsx do Supabase.
// Uruchomienie: npm run import:calculator-data
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getSupabaseClient } from '../lib/supabaseAdmin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabase = getSupabaseClient();

const data = JSON.parse(readFileSync(join(__dirname, 'calculator_data.json'), 'utf-8'));

async function run() {
  console.log(`Clearing existing rows...`);
  // delete-all przez warunek zawsze prawdziwy — Supabase wymaga jawnego filtra
  await supabase.from('calc_auction_fees').delete().gt('id', 0);
  await supabase.from('calc_shipping_routes').delete().gt('id', 0);

  console.log(`Inserting ${data.auction_fees.length} auction fee brackets...`);
  const { error: feesError } = await supabase.from('calc_auction_fees').insert(data.auction_fees);
  if (feesError) throw feesError;

  console.log(`Inserting ${data.shipping_routes.length} shipping routes...`);
  const { error: routesError } = await supabase.from('calc_shipping_routes').insert(data.shipping_routes);
  if (routesError) throw routesError;

  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
