import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabaseAdmin';
import { fetchHistoryCarsPage, fetchCarByVinFromApi } from '@/lib/apicar';
import { upsertCar } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Ile nowych/zaktualizowanych VIN-ów najwyżej ogarniamy w jednym uruchomieniu
// crona — zabezpieczenie przed przypadkowym spaleniem limitu 100k zapytań/mc.
const MAX_CARS_PER_RUN = 300;
const LISTING_PAGE_SIZE = 25; // apicar.store: "size must not be greater than 25"

async function getLastSyncDate(supabase) {
  const { data } = await supabase.from('sync_state').select('value').eq('key', 'last_sale_date').maybeSingle();
  return data?.value || null;
}

async function setLastSyncDate(supabase, isoDate) {
  await supabase.from('sync_state').upsert({ key: 'last_sale_date', value: isoDate, updated_at: new Date().toISOString() });
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
  const lastSyncDate = await getLastSyncDate(supabase);

  let page = 1;
  let processed = 0;
  let maxSaleDateSeen = lastSyncDate;
  const errors = [];

  try {
    while (processed < MAX_CARS_PER_RUN) {
      const listing = await fetchHistoryCarsPage({
        page,
        size: LISTING_PAGE_SIZE,
        auctionDateFrom: lastSyncDate || undefined,
      });

      if (listing.length === 0) break;

      for (const listedCar of listing) {
        if (processed >= MAX_CARS_PER_RUN) break;
        try {
          const full = (await fetchCarByVinFromApi(listedCar.vin)) || listedCar;
          await upsertCar(full);
          processed++;
          if (full.sale_date && (!maxSaleDateSeen || full.sale_date > maxSaleDateSeen)) {
            maxSaleDateSeen = full.sale_date;
          }
        } catch (err) {
          errors.push({ vin: listedCar.vin, message: err.message });
        }
      }

      if (listing.length < LISTING_PAGE_SIZE) break;
      page++;
    }

    if (maxSaleDateSeen && maxSaleDateSeen !== lastSyncDate) {
      await setLastSyncDate(supabase, maxSaleDateSeen);
    }

    return NextResponse.json({ ok: true, processed, lastSyncDate: maxSaleDateSeen, errors });
  } catch (err) {
    return NextResponse.json({ ok: false, processed, error: err.message, errors }, { status: 500 });
  }
}
