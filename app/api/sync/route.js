import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabaseAdmin';
import { fetchUpdatedHistoryLots } from '@/lib/apicar';
import { upsertCarsFromUpdbdBatch } from '@/lib/sync';
import { getSitemapChunk } from '@/app/sitemap';
import { MAX_SITEMAP_CHUNKS } from '@/lib/seo';

export const dynamic = 'force-dynamic';
// 300s wymaga planu Vercel Pro. Na planie Hobby Vercel i tak wymusi swój
// niższy limit — dzięki zapisowi grupowemu (patrz lib/sync.js) i budżetowi
// czasowemu poniżej to i tak zwykle wystarcza na cały dzień w jednym
// uruchomieniu; jeśli nie, stan (patrz getState/setState) pozwala bezpiecznie
// dokończyć przy następnym wywołaniu (crona albo ręcznym).
export const maxDuration = 300;

const PAGE_SIZE = 3000;
// Margines bezpieczeństwa — przerywamy pętlę, zanim Vercel sam ubije funkcję,
// żeby zdążyć zapisać stan i zwrócić odpowiedź zamiast urwać się w środku.
const TIME_BUDGET_MS = (maxDuration - 20) * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Przejściowe awarie (chwilowy 5xx z Supabase/Cloudflare, statement timeout
// przy chwilowym obciążeniu bazy) nie powinny trwale gubić danych ze strony —
// próbujemy ponownie zamiast od razu poddawać się i jechać dalej.
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

async function getState(supabase) {
  const { data } = await supabase.from('sync_state').select('key,value').in('key', ['updbd_date_from', 'updbd_page']);
  const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  return {
    dateFrom: map.updbd_date_from || null,
    page: map.updbd_page ? Number(map.updbd_page) : 1,
  };
}

async function setState(supabase, { dateFrom, page }) {
  const now = new Date().toISOString();
  await supabase
    .from('sync_state')
    .upsert([
      { key: 'updbd_date_from', value: dateFrom, updated_at: now },
      { key: 'updbd_page', value: String(page), updated_at: now },
    ]);
}

// Odpala wszystkie kawałki sitemapy równolegle, z twardym limitem czasu, żeby
// pod żadnym pozorem nie zjeść budżetu czasowego głównej synchronizacji.
// Pojedyncza porażka (albo timeout) nie jest błędem — to tylko rozgrzewka,
// bez niej Google i tak dostanie świeże dane, tylko wolniej za pierwszym razem.
async function warmSitemapCache() {
  const WARM_TIMEOUT_MS = 8000;
  const attempts = Array.from({ length: MAX_SITEMAP_CHUNKS }, (_, id) =>
    Promise.race([
      getSitemapChunk(id).then(() => true),
      sleep(WARM_TIMEOUT_MS).then(() => false),
    ]).catch(() => false)
  );
  const results = await Promise.all(attempts);
  return { warmed: results.filter(Boolean).length, total: MAX_SITEMAP_CHUNKS };
}

function yesterdayStartUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET(request) {
  // Akceptujemy albo nasz własny nagłówek (ręczne wywołanie/test), albo
  // "Authorization: Bearer <CRON_SECRET>", którego Vercel Cron używa
  // automatycznie, gdy zmienna środowiskowa CRON_SECRET jest ustawiona.
  const customSecret = request.headers.get('x-sync-secret');
  const authHeader = request.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const expected = process.env.SYNC_SECRET || process.env.CRON_SECRET;
  const provided = customSecret || bearerSecret;

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = getSupabaseClient();
  const state = await getState(supabase);
  const dateFrom = state.dateFrom || yesterdayStartUTC();

  // apicar.store: "date range cannot exceed 24 hours" — więc okno to zawsze
  // dateFrom + maksymalnie 23h55min (margines bezpieczeństwa), albo "teraz",
  // jeśli to bliżej. Jeśli zalegamy z importem więcej niż jeden dzień,
  // kolejne uruchomienia (cron/ręczne) posuwają się o kolejne takie okno,
  // aż dogonią bieżący czas.
  const MAX_WINDOW_MS = (23 * 60 + 55) * 60 * 1000;
  const now = Date.now();
  const dateFromMs = new Date(dateFrom).getTime();
  const dateTo = new Date(Math.min(dateFromMs + MAX_WINDOW_MS, now)).toISOString();

  let page = state.page;
  let pagesDone = 0;
  let totalPages = null;
  let savedSold = 0;
  let savedNotSold = 0;
  let stoppedEarly = false;
  const errors = [];

  try {
    while (
      (totalPages === null || page <= totalPages) &&
      Date.now() - startedAt < TIME_BUDGET_MS
    ) {
      let result;
      try {
        result = await withRetry(() => fetchUpdatedHistoryLots({ dateFrom, dateTo, page, size: PAGE_SIZE }));
      } catch (err) {
        // Nie udało się nawet po ponowieniu — przerywamy TUTAJ (nie
        // przesuwamy kursora strony), żeby następne uruchomienie spróbowało
        // dokładnie tej samej strony zamiast bezpowrotnie ją pominąć.
        errors.push({ page, stage: 'fetch', message: err.message });
        stoppedEarly = true;
        break;
      }

      totalPages = result.pages ?? page;

      try {
        const batchResult = await withRetry(() => upsertCarsFromUpdbdBatch(result.data || []));
        savedSold += batchResult.savedSold;
        savedNotSold += batchResult.savedNotSold;
      } catch (err) {
        errors.push({ page, stage: 'save', message: err.message });
        stoppedEarly = true;
        break;
      }

      page++;
      pagesDone++;
    }

    const finishedWholeRange = !stoppedEarly && totalPages !== null && page > totalPages;

    if (finishedWholeRange) {
      // Cały zakres dat przetworzony — następne uruchomienie zaczyna nowy
      // zakres (od teraz), a nie od tego samego dnia od nowa.
      await setState(supabase, { dateFrom: dateTo, page: 1 });
    } else {
      // Zabrakło czasu albo trafiła się awaria — zapamiętujemy dokładnie
      // gdzie skończyliśmy, następne uruchomienie (cron albo ręczne)
      // kontynuuje od tej samej strony, nic nie gubiąc.
      await setState(supabase, { dateFrom, page });
    }

    // Best-effort "rozgrzanie" cache'u sitemapy zaraz po synchronizacji, żeby
    // Google nigdy nie trafiał na zimne zapytanie do bazy przy własnym
    // odwiedzeniu — patrz getSitemapChunk (app/sitemap.js), cache na godzinę.
    // Celowo NIE wpływa na wynik/status tej odpowiedzi — to tylko optymalizacja,
    // nie krytyczna część synchronizacji.
    const sitemapWarmed = await warmSitemapCache().catch(() => null);

    return NextResponse.json({
      sitemapWarmed,
      ok: !stoppedEarly,
      dateFrom,
      dateTo,
      pagesDone,
      totalPages,
      finishedWholeRange,
      savedSold,
      savedNotSold,
      errors,
      tookMs: Date.now() - startedAt,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, dateFrom, page, error: err.message, errors }, { status: 500 });
  }
}
