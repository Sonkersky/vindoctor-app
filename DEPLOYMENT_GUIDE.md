# VINDOCTOR — instrukcja wdrożenia krok po kroku

Ta instrukcja zakłada, że nie masz jeszcze żadnego z potrzebnych kont i nigdy wcześniej tego nie robiłeś. Zajmie to około 30–45 minut. Rób to w kolejności, nie pomijaj kroków.

Będziemy potrzebować trzech darmowych kont: **GitHub**, **Supabase**, **Vercel**.

---

## Krok 1 — Konto GitHub (miejsce przechowywania kodu)

1. Wejdź na **github.com** i kliknij **Sign up**.
2. Podaj e-mail, hasło, nazwę użytkownika — potwierdź e-mail, gdy przyjdzie link.
3. Nie musisz nic więcej robić w GitHub ręcznie — kod repozytorium przygotuję i wypchnę razem z Tobą w kolejnej sesji (poproszę Cię tylko o utworzenie pustego repozytorium: przycisk **New repository** na stronie głównej GitHub, nazwa np. `vindoctor-app`, zostaw wszystkie opcje domyślne, kliknij **Create repository**).

---

## Krok 2 — Baza danych w Supabase

1. Wejdź na **supabase.com** → **Start your project** → zaloguj się przez GitHub (to ten sam login co w Kroku 1, wygodniejsze).
2. Kliknij **New project**.
   - **Name**: `vindoctor` (dowolna nazwa, tylko dla Ciebie).
   - **Database Password**: kliknij "Generate a password" i **zapisz je gdzieś bezpiecznie** (np. w menedżerze haseł) — będzie potrzebne rzadko, ale dobrze je mieć.
   - **Region**: wybierz najbliższy geograficznie (np. Frankfurt dla Europy).
   - Kliknij **Create new project** i poczekaj 1–2 minuty, aż się utworzy.
3. Po lewej stronie znajdź **SQL Editor** → **New query**.
4. Otwórz u siebie plik `supabase/schema.sql` z tego projektu, zaznacz całość, skopiuj, wklej do okna w Supabase, kliknij **Run** (albo Ctrl/Cmd+Enter). Powinieneś zobaczyć "Success. No rows returned".
5. Teraz skopiuj dwa klucze, które będą potrzebne w Kroku 4:
   - Po lewej: **Project Settings** (ikona koła zębatego) → **Data API** → skopiuj **Project URL** (to jest `SUPABASE_URL`).
   - Tamże → **API Keys** → skopiuj klucz **service_role** (uwaga: **nie** `anon` — to musi być `service_role`, to jest `SUPABASE_SERVICE_ROLE_KEY`). Ten klucz jest tajny — nie wysyłaj go nigdzie poza to wdrożenie.

---

## Krok 3 — Klucz do apicar.store

Masz go już — to ten sam klucz, który dotąd był wpisany na sztywno w `index.html`/`lot.html` (`APICAR_API_KEY`). Będzie potrzebny w Kroku 4 i 5.

---

## Krok 4 — Wdrożenie na Vercel

1. Wejdź na **vercel.com** → **Sign Up** → zaloguj się przez GitHub.
2. Na pulpicie kliknij **Add New...** → **Project**.
3. Wybierz z listy repozytorium `vindoctor-app` (to, które utworzyłeś w Kroku 1 i do którego wypchniemy kod) → **Import**.
4. Zanim klikniesz "Deploy", rozwiń sekcję **Environment Variables** i dodaj po kolei (Name / Value):
   - `SUPABASE_URL` → wklej Project URL z Kroku 2
   - `SUPABASE_SERVICE_ROLE_KEY` → wklej klucz service_role z Kroku 2
   - `APICAR_API_KEY` → klucz z Kroku 3
   - `SYNC_SECRET` → wymyśl dowolny długi losowy ciąg znaków (np. 30 losowych liter/cyfr)
   - `CRON_SECRET` → wklej **dokładnie tę samą wartość** co `SYNC_SECRET`
5. Kliknij **Deploy**. Po 1–2 minutach dostaniesz adres typu `vindoctor-app-xxxx.vercel.app` — to już jest Twoja działająca strona (na razie z pustą bazą, więc lista lotów będzie pusta — to normalne, dane wgramy w Kroku 5).

---

## Krok 5 — Pierwsze zasilenie bazy danymi (próbka)

To trzeba zrobić z Twojego komputera (ja to poprowadzę na żywo w sesji, ale zapisuję tu dla Ciebie na przyszłość):

1. W pliku `.env.local` (kopia `.env.example`) wpisujemy te same 5 wartości co w Kroku 4.
2. Uruchamiamy w terminalu: `npm run backfill` — to pobiera bezpieczną próbkę (do 200 aut) z apicar.store i zapisuje je do Twojej bazy Supabase.
3. Po zakończeniu odświeżamy stronę na Vercel (`vindoctor-app-xxxx.vercel.app`) — powinny pojawić się prawdziwe loty.

Od tego momentu strona codziennie o 6:00 rano (czasu UTC) sama dociąga nowo sprzedane loty — nie musisz nic klikać (to robi Vercel Cron zdefiniowany w `vercel.json`).

---

## Krok 6 — Mail do Ryana + docelowy pełny backfill

Wyślij mu treść z pliku `RYAN_EMAIL_DRAFT.md`. Gdy odpowie:
- jeśli potwierdzi wygodny bulk-eksport — dostosujemy `scripts/backfill.js`, żeby z niego skorzystać (szybciej i taniej niż obecna metoda "strona po stronie");
- jeśli nie — po prostu uruchamiamy `npm run backfill -- --limit=...` z większą liczbą, rozłożone na kilka dni/tygodni, żeby nie przekroczyć 100 000 zapytań/mc (każde auto to ~2 zapytania, więc przy 100 000 limicie realistycznie możemy bezpiecznie ładować do ok. 40–45 tys. aut miesięcznie, zostawiając zapas na bieżący ruch synchronizacji).

---

## Krok 7 (później, opcjonalnie) — własna domena

Obecnie strona działa tylko pod `*.github.io` — nie masz jeszcze kupionej domeny. Gdy zdecydujesz się na własną (np. `vindoctor.com`), w Vercel: **Project → Settings → Domains → Add**, i podążysz za instrukcją (dodanie 1-2 rekordów DNS u rejestratora domeny). Zrobimy to razem, gdy nadejdzie ten moment — nie jest to pilne.
