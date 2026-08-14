// Jednorazowe (lub powtarzalne — patrz "cotygodniowa pełna weryfikacja" w
// instrukcji Ryana) ładowanie CAŁEJ bazy aktywnych (jeszcze niesprzedanych)
// lotów z apicar.store (/cars/db/all) do tabeli active_lots w Supabase.
// Bezpieczne do przerwania (Ctrl+C) i wznowienia — postęp zapisywany do
// scripts/.backfill-active-progress.json.
//
// Użycie:
//   npm run backfill:active                  -> kontynuuj (albo zacznij) pełne ładowanie
//   npm run backfill:active -- --reset       -> zacznij od strony 1 od nowa
//
// Po tym jednorazowym ładowaniu bieżącą aktualność utrzymuje już
// app/api/sync-active/route.js (endpointy /cars/db/update i /cars/deleted),
// wołane co 30-60 min przez zewnętrzny harmonogram (patrz DEPLOYMENT_GUIDE.md).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchActiveLotsAllPage } from '../lib/apicar.js';
import { upsertActiveLotsBatch } from '../lib/syncActive.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = join(__dirname, '.backfill-active-progress.json');
const PAGE_SIZE = 5000; // apicar.store: max size dla /cars/db/all

function parseArgs() {
  const args = { reset: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--reset') args.reset = true;
  }
  return args;
}

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { nextPage: 1, totalSaved: 0 };
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { nextPage: 1, totalSaved: 0 };
  }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function main() {
  const { reset } = parseArgs();
  let progress = reset ? { nextPage: 1, totalSaved: 0 } : loadProgress();

  console.log(`Start: strona ${progress.nextPage}, dotychczas zapisano ${progress.totalSaved} lotów.\n`);

  let page = progress.nextPage;
  let totalPages = null;

  while (totalPages === null || page <= totalPages) {
    const result = await fetchActiveLotsAllPage({ page, size: PAGE_SIZE });
    totalPages = result.pages;

    if (result.data.length === 0) {
      console.log('\nApicar.store nie zwraca już więcej wyników — pełne ładowanie kompletne.');
      break;
    }

    const { saved } = await upsertActiveLotsBatch(result.data);
    progress.totalSaved += saved;
    progress.nextPage = page + 1;
    saveProgress(progress);

    process.stdout.write(
      `\r[strona ${page}/${totalPages}] zapisano ${saved} lotów (łącznie: ${progress.totalSaved})        `
    );

    page++;
  }

  console.log(`\n\nGotowe. Łącznie zapisano/zaktualizowano ${progress.totalSaved} aktywnych lotów.`);
  if (totalPages !== null && page > totalPages) {
    console.log('Pełne ładowanie zakończone — od teraz aktualność utrzymuje /api/sync-active.');
  } else {
    console.log('Przerwano przed końcem — uruchom ponownie (npm run backfill:active), żeby kontynuować.');
  }
}

main().catch((err) => {
  console.error('\nBackfill przerwany błędem:', err);
  process.exit(1);
});
