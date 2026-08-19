export const SITE_URL = 'https://doctor.vin';

// Limit protokołu sitemap to 50 000 adresów/plik — 40 000 to margines
// bezpieczeństwa. Dzielone między app/sitemap.js i app/robots.js, więc
// obie strony (generowanie plików i lista w robots.txt) zawsze się zgadzają.
export const SITEMAP_CHUNK_SIZE = 40000;

// Celowo NIE liczymy dokładnej liczby lotów, żeby ustalić ile kawałków
// sitemapy wygenerować — get_lot_counts() przy ~90k+ wierszach zaczął się
// od czasu do czasu wykładać na statement_timeout (do zbadania osobno).
// Zamiast tego dajemy z góry zapas kawałków; pusty kawałek (offset poza
// realnymi danymi) jest dla Google całkowicie nieszkodliwy.
//
// Dwie osobne pule zamiast jednego wspólnego zapytania UNION po "cars" i
// "active_lots" — prościej, szybciej (zwykłe range() na jednej tabeli, bez
// zgadywania czy Postgres poradzi sobie z sortowaniem po UNION ALL na
// wspólnie ~800k+ wierszach) i łatwo osobno zwiększać w miarę wzrostu.
//
// cars (Sold + Not sold + ON APPROVAL, obecnie ~141k) — 6 kawałków = 240k zapasu.
export const CARS_SITEMAP_CHUNKS = 6;
// active_lots (obecnie ~680k+, rośnie co godzinę) — 24 kawałki = 960k zapasu.
// PODNIEŚ, gdy baza się do tego zbliży (zgłoszone kiedyś: "nowe podstrony
// się nie indeksują" — active_lots w ogóle nie było w sitemapie, dopisane
// dopiero teraz).
export const ACTIVE_LOTS_SITEMAP_CHUNKS = 24;

export const MAX_SITEMAP_CHUNKS = CARS_SITEMAP_CHUNKS + ACTIVE_LOTS_SITEMAP_CHUNKS;
