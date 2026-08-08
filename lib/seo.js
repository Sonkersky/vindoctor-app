export const SITE_URL = 'https://doctor.vin';

// Limit protokołu sitemap to 50 000 adresów/plik — 40 000 to margines
// bezpieczeństwa. Dzielone między app/sitemap.js i app/robots.js, więc
// obie strony (generowanie plików i lista w robots.txt) zawsze się zgadzają.
export const SITEMAP_CHUNK_SIZE = 40000;

// Celowo NIE liczymy dokładnej liczby lotów, żeby ustalić ile kawałków
// sitemapy wygenerować — get_lot_counts() przy ~90k+ wierszach zaczął się
// od czasu do czasu wykładać na statement_timeout (do zbadania osobno).
// Zamiast tego dajemy z góry zapas kawałków; pusty kawałek (offset poza
// realnymi danymi) jest dla Google całkowicie nieszkodliwy. Przy 40k/kawałek
// to 240k adresów zapasu — podnieś, gdy baza się do tego zbliży.
export const MAX_SITEMAP_CHUNKS = 6;
