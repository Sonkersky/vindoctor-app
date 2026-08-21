import { unstable_cache } from 'next/cache';
import { getSupabaseClient } from '@/lib/db';
import { SITE_URL, MAX_SITEMAP_CHUNKS, CARS_SITEMAP_CHUNKS, ACTIVE_LOTS_SITEMAP_CHUNKS } from '@/lib/seo';

// Bez tego Next próbuje wygenerować (i odpytać bazę) każdy kawałek sitemapy
// przy KAŻDYM `next build`/deployu — dla dziesiątek tysięcy wierszy to
// realnie potrafi przekroczyć statement_timeout na Supabase. Renderowanie
// na żądanie (gdy Google faktycznie poprosi o dany plik) jest i szybsze przy
// wdrożeniu, i tak trzeba by co jakiś czas odświeżać dane mimo wszystko.
export const dynamic = 'force-dynamic';

export async function generateSitemaps() {
  return Array.from({ length: MAX_SITEMAP_CHUNKS }, (_, id) => ({ id }));
}

// Kilka wierszy w bazie ma śmieciowy VIN z API (np. "0" albo same zera) —
// prawdziwy VIN (norma ISO 3779, auta od 1981) ma zawsze 17 znaków.
// Filtrujemy je tutaj, żeby nie zaśmiecać sitemapy bezużytecznymi adresami.
function isValidVin(vin) {
  return Boolean(vin) && vin.length === 17;
}

// Granice kubełków (jaki VIN zaczyna kubełek N) liczy get_sitemap_boundaries
// w Postgresie przez NTILE — patrz długi komentarz w lib/seo.js po co (offset
// i zakres prefiksu VIN-u zawiodły przy tej skali). To osobny, DŁUGO
// cache'owany (24h — ten sam rytm co codzienna synchronizacja) request, bo
// samo policzenie granic to jeden skan+sort całej tabeli — tanie raz na
// dobę, kosztowne przy każdym request Googlebota.
const getSitemapBoundaries = unstable_cache(
  async (sourceTable, chunkCount) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_sitemap_boundaries', {
      p_table: sourceTable,
      p_chunks: chunkCount,
    });
    if (error) throw error;
    // RPC zwraca [{chunk_index, start_vin}, ...] posortowane po chunk_index —
    // zamieniamy na zwykłą tablicę startVin[i], łatwiejszą do indeksowania.
    const boundaries = new Array(chunkCount).fill(null);
    for (const row of data || []) {
      boundaries[row.chunk_index] = row.start_vin;
    }
    return boundaries;
  },
  ['sitemap-boundaries'],
  { revalidate: 90000, tags: ['sitemap'] }
);

// Kawałki 0..CARS_SITEMAP_CHUNKS-1 to "cars" (historyczne — Sold/Not
// sold/ON APPROVAL), reszta to "active_lots" (jeszcze niesprzedane) —
// wcześniej w sitemapie w ogóle nie było active_lots, więc setki tysięcy
// realnie działających stron (patrz fix getCarByVin() — kiedyś 404,
// teraz 200) nigdy nie trafiały do Google (zgłoszone: "nowe podstrony się
// nie indeksują").
//
// revalidate na getSitemapChunk samym ustawiony celowo DŁUGO (25h, z zapasem
// ponad dobowy cykl synchronizacji) — 1h okazało się za krótkie: cache
// wygasał w ciągu dnia i Google potrafił trafić na moment tuż po wygaśnięciu,
// czyli dokładnie w to samo zimne zapytanie, któremu cache miał zapobiegać.
// Świeżość danych zapewnia zamiast tego revalidateTag('sitemap') wywoływane
// po każdej synchronizacji (patrz app/api/sync/route.js i
// app/api/sync-active/route.js).
export const getSitemapChunk = unstable_cache(
  async (chunkId) => {
    const supabase = getSupabaseClient();

    if (chunkId < CARS_SITEMAP_CHUNKS) {
      const boundaries = await getSitemapBoundaries('cars', CARS_SITEMAP_CHUNKS);
      const start = boundaries[chunkId];
      const end = boundaries[chunkId + 1] || null;
      if (!start) return [];

      let query = supabase
        .from('cars')
        .select('vin, updated_at')
        .in('sale_status', ['Sold', 'Not sold', 'ON APPROVAL'])
        .gte('vin', start)
        .order('vin')
        .limit(45000);
      if (end) query = query.lt('vin', end);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((row) => isValidVin(row.vin));
    }

    const activeChunkIndex = chunkId - CARS_SITEMAP_CHUNKS;
    const boundaries = await getSitemapBoundaries('active_lots', ACTIVE_LOTS_SITEMAP_CHUNKS);
    const start = boundaries[activeChunkIndex];
    const end = boundaries[activeChunkIndex + 1] || null;
    if (!start) return [];

    let query = supabase
      .from('active_lots')
      .select('vin, updated_at')
      .not('vin', 'is', null)
      .gte('vin', start)
      .order('vin')
      .limit(45000);
    if (end) query = query.lt('vin', end);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).filter((row) => isValidVin(row.vin));
  },
  ['sitemap-chunk'],
  { revalidate: 90000, tags: ['sitemap'] }
);

// UWAGA: od Next.js 16 `id` przychodzi jako Promise<string>, nie liczba —
// trzeba go odpakować (await) i skonwertować, inaczej matematyka paginacji
// się psuje.
export default async function sitemap({ id }) {
  const chunkId = Number(await id);
  const rows = await getSitemapChunk(chunkId);

  return rows.map((row) => ({
    url: `${SITE_URL}/lot/${encodeURIComponent(row.vin)}`,
    lastModified: row.updated_at || undefined,
    changeFrequency: 'monthly',
  }));
}
