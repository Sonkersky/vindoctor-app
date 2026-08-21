export const SITE_URL = 'https://doctor.vin';

// Liczba kubełków sitemapy dla każdego źródła. Granice kubełków (jaki VIN
// zaczyna kubełek N) liczy funkcja SQL get_sitemap_boundaries (patrz
// supabase/schema.sql) przez NTILE — dzieli wiersze na CHUNKS możliwie
// równych grup WEDŁUG LICZBY WIERSZY, nie według zakresu wartości VIN-u.
//
// UWAGA — dlaczego nie offset/limit ani zakres prefiksu VIN-u:
//
// 1) offset/limit (poprzednie podejście) ma twardą wadę skali na dużych
//    tabelach: Postgres musi pominąć N wierszy zanim zwróci wynik, więc
//    koszt rośnie z głębokością. Zmierzone na żywo przy diagnozowaniu
//    "Google w ogóle nie indeksuje strony" (GSC → Mapy witryn pokazywał
//    "Nie udało się pobrać" dla KAŻDEGO pliku): offset~100 000 brał 8-30s,
//    a offset~600 000 kończył się błędem 500 po 30+ sekundach — nawet przy
//    zawężeniu SELECT do samego "vin".
//
// 2) Równy podział po ZAKRESIE WARTOŚCI prefiksu VIN-u (pierwsze 2-3
//    znaki) też się nie sprawdził — realny rozkład VIN-ów jest SILNIE
//    nierówny (np. sam prefiks "1G" to prawie 57 000 z ~700k wierszy
//    active_lots, czyli więcej niż limit protokołu sitemap 50k/plik), więc
//    "gorące" prefiksy i tak przepełniałyby pojedynczy kubełek.
//
// NTILE liczony raz (cache'owany ~24h, jak codzienna synchronizacja) nie
// ma żadnej z tych wad: to jeden sekwencyjny skan+sort po stronie
// Postgresa (bez OFFSET-a w ogóle), a wynikowe kubełki są z definicji
// równe co do liczby wierszy, niezależnie od tego, jak nierówno realne
// VIN-y rozkładają się leksykograficznie.
export const CARS_SITEMAP_CHUNKS = 50;
export const ACTIVE_LOTS_SITEMAP_CHUNKS = 150;

export const MAX_SITEMAP_CHUNKS = CARS_SITEMAP_CHUNKS + ACTIVE_LOTS_SITEMAP_CHUNKS;
