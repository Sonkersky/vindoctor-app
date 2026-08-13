-- VINDOCTOR — schemat bazy danych (Supabase / Postgres)
--
-- Jak to wkleić: Supabase → Twój projekt → SQL Editor → New query → wklej całość → Run.
-- Można uruchamiać wielokrotnie bezpiecznie (IF NOT EXISTS wszędzie).

create table if not exists cars (
  id                    bigint generated always as identity primary key,
  vin                   text not null unique,

  -- podstawowe dane pojazdu
  title                 text,
  year                  integer,
  make                  text,
  model                 text,
  series                text,
  vehicle_type          text,
  color                 text,
  engine                text,
  engine_size           numeric,        -- w litrach, np. 2.4
  cylinders             text,
  fuel                  text,
  drive                 text,
  transmission          text,
  keys                  text,

  -- aukcja / lokalizacja
  base_site             text,           -- 'copart' | 'iaai'
  location              text,
  state                 text,

  -- przebieg
  odometer              numeric,
  odometer_index        text,           -- jednostka, np. "mi"
  odobrand              text,           -- np. "ACTUAL"

  -- uszkodzenia / dokument / sprzedawca / status
  damage_pr             text,
  damage_sec            text,
  document              text,
  document_detail       text,   -- wersja szczegółowa z API (np. "Salvage (Texas)")
  seller                text,
  seller_type           text,
  status                text,

  -- sprzedaż
  purchase_price        numeric,
  sale_date             timestamptz,
  sale_status           text,
  sale_type             text,           -- 'auction' | 'buynow' | 'timed'

  -- media (tablice URL-i)
  link_img_hd           jsonb default '[]'::jsonb,
  link_img_small        jsonb default '[]'::jsonb,
  iaai_360              jsonb default '[]'::jsonb,
  copart_exterior_360   jsonb default '[]'::jsonb,
  video                 jsonb default '[]'::jsonb,

  -- bezpiecznik: pełna surowa odpowiedź API, na wypadek pól jeszcze niezmapowanych
  raw_json              jsonb,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_cars_make        on cars (make);
create index if not exists idx_cars_model       on cars (model);
create index if not exists idx_cars_year        on cars (year);
create index if not exists idx_cars_odometer    on cars (odometer);
create index if not exists idx_cars_damage_pr   on cars (damage_pr);
create index if not exists idx_cars_status      on cars (status);
create index if not exists idx_cars_base_site   on cars (base_site);
create index if not exists idx_cars_state       on cars (state);

-- Dopisany po znalezieniu prawdziwej przyczyny wolnych/błędnych odpowiedzi
-- pod obciążeniem: sale_status w ogóle nie miał indeksu, więc KAŻDE
-- zapytanie (strona główna, stopka, filtry) robiło pełny skan całej,
-- rosnącej codziennie tabeli. Kolumny w kolejności dopasowanej do
-- najczęstszego zapytania (WHERE sale_status = 'Sold' ORDER BY year, sale_date).
create index if not exists idx_cars_sale_status_year_sale_date
  on cars (sale_status, year desc, sale_date desc);
create index if not exists idx_cars_sale_date   on cars (sale_date desc);

-- Pod widok car_makes_models (DISTINCT make/model) — bez tego Postgres musi
-- skanować i sortować całą (rosnącą) tabelę za każdym razem, gdy cache
-- (5 min) wygaśnie, co przy 50k+ wierszy zaczęło przekraczać statement_timeout.
create index if not exists idx_cars_sale_status_vehicle_type_make_model
  on cars (sale_status, vehicle_type, make, model);

-- Historia sprzedaży danego VIN-u (tabela "Sales History" na stronie lotu)
create table if not exists sale_history (
  id             bigint generated always as identity primary key,
  car_vin        text not null references cars (vin) on delete cascade,
  sale_date      timestamptz,
  base_site      text,
  sale_status    text,
  purchase_price numeric,
  raw_json       jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_sale_history_car_vin on sale_history (car_vin);

-- Pilnuje updated_at przy każdym update (przydatne przy synchronizacji)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cars_updated_at on cars;
create trigger trg_cars_updated_at
  before update on cars
  for each row
  execute function set_updated_at();

-- Lista marka/model do filtra bocznego na stronie głównej.
-- Widok zamiast zapytania "SELECT DISTINCT" z aplikacji — działa poprawnie
-- niezależnie od tego, ile wierszy ma tabela "cars".
-- Uwaga: jeśli liczba unikalnych par marka/model kiedyś przekroczy 1000,
-- trzeba podnieść "db-max-rows" w Supabase → Project Settings → API.
create or replace view car_makes_models as
  select distinct make, model
  from cars
  where sale_status = 'Sold' and make is not null and vehicle_type = 'Automobile';

-- Prosta tabela klucz-wartość do zapamiętywania postępu codziennej synchronizacji
-- (np. data ostatnio zsynchronizowanego lotu), żeby /api/sync wiedział, od czego
-- zacząć następnym razem zamiast przeciągać całą historię za każdym razem.
create table if not exists sync_state (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- Dopisane po pierwszym wdrożeniu: kolumna sale_type (auction/buynow/timed)
-- pod plakietkę "Sold by BUY NOW". "if not exists" — bezpieczne do
-- wielokrotnego uruchomienia, także na bazie, która już ma tę kolumnę.
alter table cars add column if not exists sale_type text;

-- Dopisane przy okazji dodania suwaka pojemności silnika: engine_size był
-- tekstem, zamieniamy na liczbę (żeby dało się filtrować "od-do"). Wartości,
-- których nie da się bezpiecznie zamienić na liczbę, zostają jako NULL
-- zamiast wywalać cały ALTER. Zabezpieczone przed podwójnym uruchomieniem
-- (sprawdza aktualny typ kolumny, zanim cokolwiek zmieni).
do $$
begin
  if (select data_type from information_schema.columns where table_name = 'cars' and column_name = 'engine_size') = 'text' then
    alter table cars add column engine_size_num numeric;
    update cars set engine_size_num = engine_size::numeric
      where engine_size is not null and engine_size ~ '^[0-9]+(\.[0-9]+)?$';
    alter table cars drop column engine_size;
    alter table cars rename column engine_size_num to engine_size;
  end if;
end $$;

-- Dopisane po znalezieniu bardziej szczegółowego opisu dokumentu w API
-- (document_old, np. "Salvage (Texas)" zamiast uproszczonego "Salvage").
alter table cars add column if not exists document_detail text;

-- Licznik lotów w stopce. Zamiast trzech osobnych zapytań "select count"
-- liczonych przez nagłówek Content-Range (co na produkcji na Vercelu
-- potrafiło zwracać 0 — najwyraźniej coś w tamtejszym środowisku gubiło/źle
-- interpretowało te nagłówki), jedna funkcja zwracająca liczby wprost jako
-- JSON w treści odpowiedzi — odporne na ten problem.
create or replace function get_lot_counts()
returns json
language sql
stable
as $$
  select json_build_object(
    'total', count(*) filter (where sale_status = 'Sold'),
    'copart', count(*) filter (where sale_status = 'Sold' and base_site = 'copart'),
    'iaai', count(*) filter (where sale_status = 'Sold' and base_site = 'iaai')
  )
  from cars;
$$;

-- Sitemapa (app/sitemap.js) odpytuje "where sale_status = 'Sold' order by
-- vin" w kawałkach po 40k (offset+limit). Bez indeksu wspierającego akurat tę
-- kombinację Postgres musiał filtrować przez istniejący indeks, a POTEM
-- sortować ręcznie całe ~90k pasujących wierszy przy każdym zapytaniu — przy
-- większych przesunięciach (offset) to czasem przekraczało statement_timeout
-- (obserwowane jako przerywane 500 na /sitemap/[id].xml na produkcji).
create index if not exists idx_cars_sale_status_vin
  on cars (sale_status, vin);

-- ============================================================
-- RLS na starszych tabelach (cars/sale_history/sync_state)
-- ============================================================
-- Do tej pory nieobecne, bo do bazy sięgał wyłącznie nasz backend kluczem
-- service_role (który i tak omija RLS). Teraz, przy koncie użytkownika, w
-- kodzie przeglądarki pojawia się PUBLICZNY klucz "anon" — bez jawnych reguł
-- ktokolwiek, kto ten klucz zna (a jest jawny, bo trafia do przeglądarki),
-- mógłby przez REST API Supabase czytać/zapisywać te tabele bezpośrednio.
-- Same reguły RLS nie wystarczą — Postgres najpierw sprawdza zwykłe
-- uprawnienie GRANT, a dopiero potem RLS. Te tabele nigdy nie dostały
-- jawnego GRANT dla anon/authenticated (bo do teraz nikt poza service_role
-- ich nie potrzebował), więc bez tego "select using (true)" nic by nie dało —
-- i tak wracałby błąd "permission denied" zanim RLS w ogóle zadziała.
grant select on cars to anon, authenticated;
grant select on sale_history to anon, authenticated;

alter table cars enable row level security;
drop policy if exists "cars_public_read" on cars;
create policy "cars_public_read" on cars for select using (true);

alter table sale_history enable row level security;
drop policy if exists "sale_history_public_read" on sale_history;
create policy "sale_history_public_read" on sale_history for select using (true);

-- sync_state: wewnętrzny stan synchronizacji (kursor daty/strony) — nikt poza
-- backendem nie powinien mieć do tego dostępu. RLS włączone, celowo BEZ
-- żadnej polityki select/insert/update — to daje domyślną odmowę dla
-- anon/authenticated, backend (service_role) i tak omija RLS.
alter table sync_state enable row level security;

-- ============================================================
-- KONTA UŻYTKOWNIKÓW (logowanie/rejestracja, obserwowane, ustawienia)
-- ============================================================
-- Supabase Auth sam prowadzi tabelę auth.users (e-mail, hasło, sesje) —
-- nie tworzymy jej ręcznie. "profiles" to nasze dodatkowe dane per-user
-- (na razie: preferowana jednostka przebiegu), połączone 1:1 z auth.users.

create table if not exists profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  mileage_unit   text not null default 'mi' check (mileage_unit in ('mi', 'km')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Sam RLS nie wystarczy bez bazowego GRANT (patrz komentarz przy cars/
-- sale_history wyżej) — tu tylko dla "authenticated" (nie anon), bo profil
-- ma sens wyłącznie dla zalogowanych; insert robi za nas trigger niżej
-- (security definer), więc anon/authenticated nie muszą mieć insert.
grant select, update on profiles to authenticated;

alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Nowe konto = automatycznie nowy wiersz w profiles (żeby front-end nie
-- musiał się martwić "co jeśli profil jeszcze nie istnieje").
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Obserwowane loty ("serduszko" na kafelku).
create table if not exists favorites (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  car_vin    text not null references cars (vin) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, car_vin)
);

grant select, insert, delete on favorites to authenticated;

alter table favorites enable row level security;

drop policy if exists "favorites_select_own" on favorites;
create policy "favorites_select_own" on favorites
  for select using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on favorites;
create policy "favorites_insert_own" on favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on favorites;
create policy "favorites_delete_own" on favorites
  for delete using (auth.uid() = user_id);

create index if not exists idx_favorites_user_id on favorites (user_id);

-- Historia wyszukiwań (VIN-y i zastosowane filtry) — pokazywana w panelu
-- użytkownika, żeby mógł łatwo wrócić do wcześniejszego szukania.
create table if not exists search_history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  search_type text not null check (search_type in ('vin', 'filters')),
  query       text,              -- dla search_type='vin': sam numer VIN
  filters     jsonb,             -- dla search_type='filters': zastosowane filtry
  created_at  timestamptz not null default now()
);

grant select, insert, delete on search_history to authenticated;

alter table search_history enable row level security;

drop policy if exists "search_history_select_own" on search_history;
create policy "search_history_select_own" on search_history
  for select using (auth.uid() = user_id);

drop policy if exists "search_history_insert_own" on search_history;
create policy "search_history_insert_own" on search_history
  for insert with check (auth.uid() = user_id);

drop policy if exists "search_history_delete_own" on search_history;
create policy "search_history_delete_own" on search_history
  for delete using (auth.uid() = user_id);

create index if not exists idx_search_history_user_id_created_at
  on search_history (user_id, created_at desc);

-- Wyszukiwanie po numerze lotu (obok VIN-u) — apicar.store zwraca go jako
-- lot_id, dotąd zapisywany tylko wewnątrz raw_json. Dodajemy osobną kolumnę
-- + indeks, żeby wyszukiwanie było szybkie (nowe wiersze wypełnia lib/sync.js
-- na bieżąco). UWAGA: uzupełnienie lot_id dla JUŻ zapisanych wierszy celowo
-- NIE jest tu jednym dużym UPDATE-em — przy 140k+ wierszach taki UPDATE
-- (JSONB extraction + regex na każdym wierszu) przekracza upstream timeout
-- edytora SQL w Supabase. Zamiast tego: `npm run backfill:lot-id`
-- (scripts/backfill-lot-id.js) — robi to samo w małych, bezpiecznych paczkach.
alter table cars add column if not exists lot_id bigint;
create index if not exists idx_cars_lot_id on cars (lot_id);

-- ===== KALKULATOR KOSZTÓW SPROWADZENIA "POD DOM" =====
-- Dane wyciągnięte z arkusza Excel klienta (Kalkulator_Wojtek.xlsx) —
-- opłaty aukcyjne Copart/IAAI wg przedziału ceny licytacji, i stawki
-- transportu lądowego + frachtu morskiego per plac (yard). Import:
-- `npm run import:calculator-data` (scripts/import-calculator-data.js).

create table if not exists calc_auction_fees (
  id                bigint generated always as identity primary key,
  auction           text not null check (auction in ('copart', 'iaai')),
  min_price         numeric not null,
  max_price         numeric not null,
  buyer_fee         numeric,          -- null tylko dla najwyższego przedziału (patrz percentage_rate)
  bid_fee           numeric not null default 0,
  service_fee       numeric not null default 0,
  title_fee         numeric not null default 0,
  environmental_fee numeric not null default 0,
  release_fee       numeric not null default 0,
  total_fee         numeric,          -- suma opłat dla tego przedziału (null dla najwyższego przedziału)
  -- Najwyższy przedział (>=15000$ w oryginalnym arkuszu) liczy się inaczej:
  -- opłata = percentage_rate * kwota_licytacji + flat_addon (zamiast stałej
  -- kwoty z total_fee).
  percentage_rate   numeric,
  flat_addon        numeric
);

create index if not exists idx_calc_auction_fees_lookup
  on calc_auction_fees (auction, min_price, max_price);

create table if not exists calc_shipping_routes (
  id                          bigint generated always as identity primary key,
  auction                     text not null check (auction in ('copart', 'iaai')),
  yard_name                   text not null,    -- oryginalna nazwa placu, np. "ABILENE - Texas"
  yard_city_norm              text not null,    -- znormalizowane (UPPER, trim) miasto do dopasowania z cars.location
  port_state                  text,             -- stan portu eksportowego, do którego jedzie transport lądowy
  land_transport_cost         numeric not null default 0,
  land_transport_security_fee numeric not null default 0,
  freight_suv_1_3             numeric not null default 0,
  freight_car_1_4             numeric not null default 0,
  freight_car_1_2             numeric not null default 0,
  freight_moto                numeric not null default 0,
  freight_quad                numeric not null default 0,
  freight_security_fee        numeric not null default 0
);

create index if not exists idx_calc_shipping_routes_lookup
  on calc_shipping_routes (auction, yard_city_norm);

-- Publiczny odczyt — kalkulator liczy po stronie klienta (przeglądarki),
-- więc te dwie tabele muszą być czytelne dla anon, tak jak cars/sale_history.
grant select on calc_auction_fees to anon, authenticated;
grant select on calc_shipping_routes to anon, authenticated;

alter table calc_auction_fees enable row level security;
alter table calc_shipping_routes enable row level security;

drop policy if exists "calc_auction_fees_public_read" on calc_auction_fees;
create policy "calc_auction_fees_public_read" on calc_auction_fees
  for select using (true);

drop policy if exists "calc_shipping_routes_public_read" on calc_shipping_routes;
create policy "calc_shipping_routes_public_read" on calc_shipping_routes
  for select using (true);

-- Statystyki cenowe (najniższa/najwyższa/średnia) nad kafelkami po
-- przefiltrowaniu — liczone po CAŁYM przefiltrowanym zbiorze, nie tylko
-- widocznej stronie, więc musi to być agregat SQL (nie da się tego policzyć
-- po stronie klienta bez ściągania wszystkich pasujących wierszy).
--
-- WAŻNE — dlaczego dynamiczny SQL (EXECUTE), nie zwykłe
-- "(p_make is null or make = p_make)": ten drugi wzorzec wygenerował
-- 20-30-sekundowe zapytania i statement timeout (57014) na żywo — planner
-- Postgresa dla takiego warunku musi założyć, że KAŻDY wiersz może pasować
-- (bo parametr MÓGŁBY być null), więc odpada od indeksu
-- idx_cars_sale_status_vehicle_type_make_model i robi pełny skan 140k+
-- wierszy. Budując WHERE dynamicznie, do zapytania trafiają tylko warunki,
-- które faktycznie są aktywne — planner wtedy normalnie korzysta z indeksu.
create or replace function get_price_stats(
  p_site text default null,
  p_make text default null,
  p_model text default null,
  p_trim text default null,
  p_damage text default null,
  p_status text default null,
  p_year_from int default null,
  p_year_to int default null,
  p_mileage_from numeric default null,
  p_mileage_to numeric default null,
  p_seller_category text default null,
  p_engine_size_from numeric default null,
  p_engine_size_to numeric default null,
  p_fuel text default null,
  p_cylinders text default null,
  p_vehicle_type text default null
)
returns table(min_price numeric, max_price numeric, avg_price numeric, sample_count bigint)
language plpgsql
stable
as $$
declare
  where_clause text := 'sale_status = ''Sold'' and purchase_price is not null';
  base_site_value text;
begin
  if p_site is not null then
    base_site_value := case p_site when '1' then 'copart' when '2' then 'iaai' else null end;
    if base_site_value is not null then
      where_clause := where_clause || format(' and base_site = %L', base_site_value);
    end if;
  end if;
  if p_make is not null then
    where_clause := where_clause || format(' and make = %L', p_make);
  end if;
  if p_model is not null then
    where_clause := where_clause || format(' and model = %L', p_model);
  end if;
  if p_trim is not null then
    where_clause := where_clause || format(' and series = %L', p_trim);
  end if;
  if p_damage is not null then
    where_clause := where_clause || format(' and damage_pr = %L', p_damage);
  end if;
  if p_status is not null then
    where_clause := where_clause || format(' and status = %L', p_status);
  end if;
  if p_year_from is not null then
    where_clause := where_clause || format(' and year >= %L', p_year_from);
  end if;
  if p_year_to is not null then
    where_clause := where_clause || format(' and year <= %L', p_year_to);
  end if;
  if p_mileage_from is not null then
    where_clause := where_clause || format(' and odometer >= %L', p_mileage_from);
  end if;
  if p_mileage_to is not null then
    where_clause := where_clause || format(' and odometer <= %L', p_mileage_to);
  end if;
  if p_seller_category = 'insurance' then
    where_clause := where_clause || ' and seller_type ilike ''insurance''';
  elsif p_seller_category = 'non-insurance' then
    where_clause := where_clause || ' and (seller_type is null or seller_type <> ''insurance'')';
  end if;
  if p_engine_size_from is not null then
    where_clause := where_clause || format(' and engine_size >= %L', p_engine_size_from);
  end if;
  if p_engine_size_to is not null then
    where_clause := where_clause || format(' and engine_size <= %L', p_engine_size_to);
  end if;
  if p_fuel is not null then
    where_clause := where_clause || format(' and fuel = %L', p_fuel);
  end if;
  if p_cylinders is not null then
    where_clause := where_clause || format(' and cylinders = %L', p_cylinders);
  end if;
  if p_vehicle_type = 'all' then
    -- brak warunku — wszystkie typy pojazdów
  elsif p_vehicle_type is not null then
    where_clause := where_clause || format(' and vehicle_type = %L', p_vehicle_type);
  else
    where_clause := where_clause || ' and vehicle_type = ''Automobile''';
  end if;

  return query execute
    'select min(purchase_price), max(purchase_price), avg(purchase_price), count(*) from cars where ' || where_clause;
end;
$$;

grant execute on function get_price_stats to anon, authenticated;

-- ===== LEADY ("Buy This Car" — zgłoszenia zainteresowania autem) =====
-- Flaga admina MUSI powstać PRZED policy niżej, która się do niej odwołuje
-- (inaczej: "column is_admin does not exist" — dokładnie ten błąd, na który
-- trafiliśmy przy pierwszym uruchomieniu tego bloku).
alter table profiles add column if not exists is_admin boolean not null default false;

-- Zapisywane WYŁĄCZNIE przez server-side API route (app/api/leads/route.js)
-- kluczem service-role — stąd brak grant/RLS insert dla anon: formularz na
-- stronie nie pisze do tabeli bezpośrednio, tylko przez nasz endpoint (który
-- przy okazji wysyła mailowe powiadomienie), więc nie trzeba otwierać
-- zapisu wprost z przeglądarki.
create table if not exists leads (
  id         bigint generated always as identity primary key,
  car_vin    text not null references cars (vin) on delete cascade,
  name       text not null,
  phone      text not null,
  email      text,
  message    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_car_vin on leads (car_vin);
create index if not exists idx_leads_created_at on leads (created_at desc);

alter table leads enable row level security;

-- Tylko konta z profiles.is_admin = true mogą CZYTAĆ leady (panel
-- /admin/leads). Zapis idzie service-role kluczem z API route, więc nie
-- omija RLS przez przypadek — RLS i tak jest tu drugą warstwą zabezpieczeń.
drop policy if exists "leads_select_admin_only" on leads;
create policy "leads_select_admin_only" on leads
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

grant select on leads to authenticated;
