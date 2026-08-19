import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { fetchActiveLotsUpdatePage, fetchDeletedLots } from '@/lib/apicar';
import { upsertActiveLotsBatch, deleteActiveLotsByLotIds } from '@/lib/syncActive';

export const dynamic = 'force-dynamic';
// Patrz komentarz w app/api/sync/route.js — 300s wymaga Vercel Pro, na Hobby
// Vercel i tak wymusi swój niższy limit. Wołane co 30-60 min przez zewnętrzny,
// darmowy harmonogram (np. cron-job.org) — Vercel Cron na planie Hobby nie
// pozwala na częstotliwość częstszą niż raz dziennie, więc ten route NIE jest
// wpisany do vercel.json "crons".
export const maxDuration = 300;
const TIME_BUDGET_MS = (maxDuration - 20) * 1000;

const UPDATE_PAGE_SIZE = 1000; // apicar.store: max size dla /cars/db/update

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { retries = 2, delayMs = 2000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(delayMs);
    }
  }
  throw lastErr;
}

export async function GET(request) {
  const customSecret = request.headers.get('x-sync-secret');
  const authHeader = request.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const expected = process.env.SYNC_SECRET || process.env.CRON_SECRET;
  const provided = customSecret || bearerSecret;

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  let updatedSaved = 0;
  let updatedPagesDone = 0;
  let updatedTotalPages = null;
  let deletedCount = 0;
  let stoppedEarly = false;
  const errors = [];

  // 1) /cars/db/update — nowe/zaktualizowane aktywne loty. Stanowe po stronie
  // apicar.store (brak parametru daty tutaj) — drenujemy wszystkie strony,
  // jakie zdążymy w budżecie czasowym; upsert po lot_id jest bezpieczny do
  // wielokrotnego wywołania, więc ewentualne nakładanie się kolejnych
  // uruchomień z tym samym lotem nic nie psuje.
  let page = 1;
  try {
    while (
      (updatedTotalPages === null || page <= updatedTotalPages) &&
      Date.now() - startedAt < TIME_BUDGET_MS
    ) {
      let result;
      try {
        result = await withRetry(() => fetchActiveLotsUpdatePage({ page, size: UPDATE_PAGE_SIZE }));
      } catch (err) {
        errors.push({ stage: 'update-fetch', page, message: err.message });
        stoppedEarly = true;
        break;
      }

      updatedTotalPages = result.pages;
      if (result.data.length === 0) break;

      try {
        const { saved } = await withRetry(() => upsertActiveLotsBatch(result.data));
        updatedSaved += saved;
      } catch (err) {
        errors.push({ stage: 'update-save', page, message: err.message });
        stoppedEarly = true;
        break;
      }

      updatedPagesDone++;
      page++;
    }
  } catch (err) {
    errors.push({ stage: 'update', message: err.message });
    stoppedEarly = true;
  }

  // 2) /cars/deleted — zwraca ZAWSZE całą bieżącą kolejkę na raz (patrz
  // lib/apicar.js) — sprzedane/zdjęte loty, usuwamy je z active_lots.
  try {
    const deletedLots = await withRetry(() => fetchDeletedLots());
    const lotIds = deletedLots.map((d) => d.lot_id).filter(Boolean);
    const { deleted } = await withRetry(() => deleteActiveLotsByLotIds(lotIds));
    deletedCount = deleted;
  } catch (err) {
    errors.push({ stage: 'deleted', message: err.message });
    stoppedEarly = true;
  }

  // Nie "warmujemy" tu z góry wszystkich kawałków sitemapy (jak robi to
  // codzienny /api/sync dla danych historycznych) — przy cadence co
  // 30-60 min to byłoby zbędne obciążenie bazy 24x/dobę. Samo oznaczenie
  // jako nieaktualne wystarczy: następne wejście Google na dany kawałek i
  // tak odpyta bazę na nowo (patrz revalidate w app/sitemap.js).
  revalidateTag('sitemap', { expire: 0 });

  return NextResponse.json({
    ok: errors.length === 0,
    updatedSaved,
    updatedPagesDone,
    updatedTotalPages,
    deletedCount,
    stoppedEarly,
    errors,
    tookMs: Date.now() - startedAt,
  });
}
