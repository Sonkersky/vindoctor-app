// Jednorazowe (lub powtarzalne) ładowanie historycznych danych z apicar.store
// do własnej bazy Supabase. Bezpieczne do przerwania (Ctrl+C) i wznowienia —
// postęp zapisywany jest do scripts/.backfill-progress.json.
//
// Użycie:
//   npm run backfill                    -> domyślnie max 200 nowych aut (bezpieczna próbka)
//   npm run backfill -- --limit=1000    -> pobierz do 1000 aut
//   npm run backfill -- --reset         -> zacznij od nowa (ignoruje zapisany postęp)
//
// WAŻNE: apicar.store ma limit 100 000 zapytań/mc dla danych historycznych.
// Ten skrypt robi ~2 zapytania na auto (lista + szczegóły), więc np. limit=1000
// to ~2000 zapytań. Nie uruchamiaj z bardzo dużym --limit bez policzenia,
// ile to zużyje z miesięcznego budżetu.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchHistoryCarsPage, fetchCarByVinFromApi } from '../lib/apicar.js';
import { upsertCar } from '../lib/sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = join(__dirname, '.backfill-progress.json');
const LISTING_PAGE_SIZE = 25; // apicar.store: "size must not be greater than 25"

function parseArgs() {
  const args = { limit: 200, reset: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--reset') args.reset = true;
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.split('=')[1]) || 200;
  }
  return args;
}

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { nextPage: 1, totalProcessed: 0 };
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { nextPage: 1, totalProcessed: 0 };
  }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function main() {
  const { limit, reset } = parseArgs();
  let progress = reset ? { nextPage: 1, totalProcessed: 0 } : loadProgress();

  console.log(`Start: strona ${progress.nextPage}, dotychczas przetworzono ${progress.totalProcessed} aut.`);
  console.log(`Cel tego uruchomienia: do ${limit} nowych aut.\n`);

  let processedThisRun = 0;
  let page = progress.nextPage;

  while (processedThisRun < limit) {
    const listing = await fetchHistoryCarsPage({ page, size: LISTING_PAGE_SIZE });

    if (listing.length === 0) {
      console.log('\nApicar.store nie zwraca już więcej wyników — backfill kompletny.');
      break;
    }

    for (const listedCar of listing) {
      if (processedThisRun >= limit) break;
      try {
        const full = (await fetchCarByVinFromApi(listedCar.vin)) || listedCar;
        await upsertCar(full);
        processedThisRun++;
        progress.totalProcessed++;
        process.stdout.write(
          `\r[${processedThisRun}/${limit}] zapisano VIN ${full.vin} (strona ${page})        `
        );
      } catch (err) {
        console.error(`\nBłąd przy VIN ${listedCar.vin}:`, err.message);
      }
    }

    page++;
    progress.nextPage = page;
    saveProgress(progress);

    if (listing.length < LISTING_PAGE_SIZE) {
      console.log('\nTo była ostatnia strona wyników z apicar.store — backfill kompletny.');
      break;
    }
  }

  console.log(`\n\nGotowe. W tym uruchomieniu zapisano ${processedThisRun} aut. Łącznie od początku: ${progress.totalProcessed}.`);
  if (processedThisRun >= limit) {
    console.log('Osiągnięto limit tego uruchomienia — uruchom ponownie (npm run backfill), żeby kontynuować od kolejnej strony.');
  }
}

main().catch((err) => {
  console.error('\nBackfill przerwany błędem:', err);
  process.exit(1);
});
