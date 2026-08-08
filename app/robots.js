import { SITE_URL, MAX_SITEMAP_CHUNKS } from '@/lib/seo';

// Patrz komentarz w app/sitemap.js — renderujemy na żądanie, nie przy build.
export const dynamic = 'force-dynamic';

// generateSitemaps() w app/sitemap.js NIE tworzy automatycznie jednego
// zbiorczego /sitemap.xml — każdy kawałek żyje osobno pod /sitemap/[id].xml.
// Wypisujemy z góry ustaloną liczbę kawałków (patrz MAX_SITEMAP_CHUNKS) —
// puste kawałki są dla Google nieszkodliwe.
export default function robots() {
  const sitemaps = Array.from({ length: MAX_SITEMAP_CHUNKS }, (_, id) => `${SITE_URL}/sitemap/${id}.xml`);

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: sitemaps,
    host: SITE_URL,
  };
}
