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
