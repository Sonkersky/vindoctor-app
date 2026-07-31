import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabaseAdmin';
import { fetchUpdatedHistoryLots } from '@/lib/apicar';
import { upsertCarFromUpdbd } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Jeden dzień to zwykle ~10-13 stron po 3000 rekordów. Vercel ma twardy limit
// czasu wykonania (maxDuration), więc ograniczamy liczbę stron na jedno
// uruchomienie i zapamiętujemy, gdzie skończyliśmy — kolejne uruchomienie
// (cron następnego dnia albo ręczne wywołanie w międzyczasie) kontynuuje od
// tego miejsca. Ryan potwierdził, że ten endpoint można odpytywać dowolnie
// często, więc bezpiecznie można to też triggerować ręcznie w ciągu dnia.
const MAX_PAGES_PER_RUN = 3;
const PAGE_SIZE = 3000;

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

  const supabase = getSupabaseClient();
  const state = await getState(supabase);
  const dateFrom = state.dateFrom || yesterdayStartUTC();
  const dateTo = new Date().toISOString();

  let page = state.page;
  let pagesDone = 0;
  let totalPages = null;
  let savedSold = 0;
  let savedNotSold = 0;
  const errors = [];

  try {
    while (pagesDone < MAX_PAGES_PER_RUN && (totalPages === null || page <= totalPages)) {
      const result = await fetchUpdatedHistoryLots({ dateFrom, dateTo, page, size: PAGE_SIZE });
      totalPages = result.pages ?? page;

      for (const record of result.data || []) {
        const li = record.lot_info || {};
        const saleStatus = (li.sale_status || record.sale_status || '').toLowerCase();
        try {
          const saved = await upsertCarFromUpdbd(record);
          if (saved) {
            if (saleStatus === 'sold') savedSold++;
            else savedNotSold++;
          }
        } catch (err) {
          errors.push({ vin: record.vin, message: err.message });
        }
      }

      page++;
      pagesDone++;
    }

    const finishedWholeRange = totalPages !== null && page > totalPages;

    if (finishedWholeRange) {
      // Cały zakres dat przetworzony — następne uruchomienie zaczyna nowy
      // zakres (od teraz), a nie od tego samego dnia od nowa.
      await setState(supabase, { dateFrom: dateTo, page: 1 });
    } else {
      // Zostały jeszcze strony — zapamiętujemy dokładnie gdzie skończyliśmy.
      await setState(supabase, { dateFrom, page });
    }

    return NextResponse.json({
      ok: true,
      dateFrom,
      dateTo,
      pagesDone,
      totalPages,
      finishedWholeRange,
      savedSold,
      savedNotSold,
      errors,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, dateFrom, page, error: err.message, errors }, { status: 500 });
  }
}
