// Import "wczorajszych" sprzedanych lotów przez płatny endpoint
// /history-cars/updbd (plan $300/mc u Ryana) — jedno zapytanie zwraca od
// razu pełne dane auta, więc to dużo tańsze w kredytach niż stary sposób.
//
// Użycie:
//   npm run import-daily                    -> wczorajszy dzień (UTC)
//   npm run import-daily -- --date=2026-07-30 -> konkretny dzień (UTC)

import { fetchUpdatedHistoryLots } from '../lib/apicar.js';
import { upsertCarFromUpdbd } from '../lib/sync.js';

const PAGE_SIZE = 3000; // maksimum narzucone przez apicar.store

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--date=')) args.date = arg.split('=')[1];
  }
  return args;
}

function yesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function main() {
  const { date } = parseArgs();
  const targetDate = date || yesterdayUTC();
  const dateFrom = `${targetDate}T00:00:00.000Z`;
  const dateTo = `${targetDate}T23:59:59.999Z`;

  console.log(`Import dnia ${targetDate} (UTC) z /history-cars/updbd...\n`);

  let page = 1;
  let totalPages = null;
  let savedSold = 0;
  let savedNotSold = 0;
  let requestsUsed = 0;

  while (totalPages === null || page <= totalPages) {
    const result = await fetchUpdatedHistoryLots({ dateFrom, dateTo, page, size: PAGE_SIZE });
    requestsUsed++;
    totalPages = result.pages ?? 1;

    const records = result.data || [];
    console.log(`Strona ${page}/${totalPages} — ${records.length} rekordów (zapytania zużyte: ${requestsUsed})`);

    for (const record of records) {
      const li = record.lot_info || {};
      const saleStatus = (li.sale_status || record.sale_status || '').toLowerCase();

      try {
        const saved = await upsertCarFromUpdbd(record);
        if (saved) {
          if (saleStatus === 'sold') savedSold++;
          else savedNotSold++;
        }
      } catch (err) {
        console.error(`Błąd przy VIN ${record.vin}:`, err.message);
      }
    }

    page++;
  }

  console.log(`\nGotowe. Zapisano ${savedSold} sprzedanych lotów i ${savedNotSold} niesprzedanych (z realną ofertą).`);
  console.log(`Zużyto ${requestsUsed} zapytań (kredytów) do apicar.store.`);
}

main().catch((err) => {
  console.error('\nImport przerwany błędem:', err);
  process.exit(1);
});
