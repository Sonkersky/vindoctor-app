import { unstable_cache } from 'next/cache';
import { getSupabaseClient } from '@/lib/db';
import { SITE_URL, SITEMAP_CHUNK_SIZE, MAX_SITEMAP_CHUNKS, CARS_SITEMAP_CHUNKS } from '@/lib/seo';

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

// Zaobserwowane na produkcji: pierwsze zapytanie do tego zakresu po dłuższej
// przerwie bywa wolne (Postgres "rozgrzewa" cache) i czasem przekracza
// statement_timeout, kolejne są szybkie. Zamiast odpytywać bazę przy KAŻDYM
// wejściu Google (i ryzykować akurat to jedno wolne zapytanie), cache'ujemy
// wynik.
//
// revalidate ustawiony celowo DŁUGO (25h, z zapasem ponad dobowy cykl
// synchronizacji) — 1h okazało się za krótkie: cache wygasał w ciągu dnia
// i Google potrafił trafić na moment tuż po wygaśnięciu, czyli dokładnie w
// to samo zimne zapytanie, któremu cache miał zapobiegać. Świeżość danych
// (żeby NIE serwować tego samego przez 25h mimo nowych lotów) zapewnia
// zamiast tego revalidateTag('sitemap') wywoływane po każdej synchronizacji
// (patrz app/api/sync/route.js i app/api/sync-active/route.js) — to wymusza
// świeże zapytanie, niezależnie od tego, czy naturalny czas cache'a jeszcze
// nie minął.
//
// Kawałki 0..CARS_SITEMAP_CHUNKS-1 to "cars" (historyczne — Sold/Not
// sold/ON APPROVAL), reszta to "active_lots" (jeszcze niesprzedane) —
// wcześniej w sitemapie w ogóle nie było active_lots, więc setki tysięcy
// realnie działających stron (patrz fix getCarByVin() — kiedyś 404,
// teraz 200) nigdy nie trafiały do Google (zgłoszone: "nowe podstrony się
// nie indeksują").
export const getSitemapChunk = unstable_cache(
  async (chunkId) => {
    const supabase = getSupabaseClient();

    if (chunkId < CARS_SITEMAP_CHUNKS) {
      const from = chunkId * SITEMAP_CHUNK_SIZE;
      const to = from + SITEMAP_CHUNK_SIZE - 1;

      const { data, error } = await supabase
        .from('cars')
        .select('vin, updated_at')
        .in('sale_status', ['Sold', 'Not sold', 'ON APPROVAL'])
        .order('vin')
        .range(from, to);

      if (error) throw error;
      return (data || []).filter((row) => isValidVin(row.vin));
    }

    const activeChunkId = chunkId - CARS_SITEMAP_CHUNKS;
    const from = activeChunkId * SITEMAP_CHUNK_SIZE;
    const to = from + SITEMAP_CHUNK_SIZE - 1;

    const { data, error } = await supabase
      .from('active_lots')
      .select('vin, updated_at')
      .not('vin', 'is', null)
      .order('vin')
      .range(from, to);

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
