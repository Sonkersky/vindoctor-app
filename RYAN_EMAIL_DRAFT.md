# Gotowa treść maila do Ryana (admin apicar.store)

## 🚨 Pilne — sprawdź to najpierw

Podczas testów (27.07.2026) klucz API zaczął zwracać błąd:
`"You must have an active subscription or available credits." (403 Forbidden)`
po ok. 190 zapytaniach. To nie jest błąd w naszym kodzie — to stan konta na apicar.store (brak aktywnej subskrypcji/kredytów). Zanim zaczniesz właściwy backfill, zaloguj się na swoje konto apicar.store i sprawdź stan subskrypcji/kredytów, albo zapytaj o to Ryana wprost (dopisane jako pytanie 6 poniżej).

Skopiuj poniższy tekst (wersja PL do Twojej wiadomości, EN jeśli Ryan woli po angielsku) i wyślij na maila/kontakt, którego dotąd używałeś do rozmowy z nim.

---

## Wersja PL (dla Ciebie, na wypadek gdybyś chciał to najpierw zrozumieć)

Budujemy własną bazę danych zasilaną z Waszego API i chcemy dobrze zaplanować, jak ją wypełnić i utrzymywać. Mam kilka pytań o wspomniany wcześniej "database-building endpoint":

1. Czy to jest bulk-eksport (np. jeden plik/paczka ze wszystkimi historycznymi lotami), czy nadal działa przez paginację jak `/history-cars`?
2. Czy wspiera pobieranie tylko nowych/zmienionych rekordów od podanej daty (żeby nie ściągać całej historii codziennie od zera)?
3. Czy zdjęcia, widoki 360° (`iaai_360`, `copart_exterior_360`) i wideo silnika (`video`) wchodzą w ten eksport, czy to zawsze osobne, żywe linki do Waszego CDN?
4. Jeśli to żywe linki CDN — czy one kiedykolwiek wygasają/są usuwane, czy zostają aktywne bezterminowo? To dla nas ważne, bo strona ma pokazywać zdjęcia sprzedanych lotów sprzed lat.
5. Jak dokładnie ten endpoint liczy się do limitu zapytań — czy jedno wywołanie "bulk" to jedno zapytanie, niezależnie od liczby zwróconych rekordów?

---

## English version (do wysłania do Ryana)

Subject: A few follow-up questions on the database-building endpoint

Hi Ryan,

We're moving forward with building our own database from your API, refreshed periodically, as you suggested. Before we run the initial historical load, I'd like to confirm a few details about the "database-building endpoint" you mentioned:

1. Is it a bulk export (e.g. one large export/file with all historical sold lots), or does it still work through pagination like `/history-cars`?
2. Does it support fetching only new or changed records since a given date/timestamp, so we don't have to re-pull the full history on every sync?
3. Are photos, 360° views (`iaai_360`, `copart_exterior_360`), and engine videos (`video`) included in that export, or are those always separate, live links to your CDN?
4. If they're live CDN links — do they ever expire or get removed, or do they stay valid indefinitely? This matters for us since we display photos for lots sold years ago.
5. How does this endpoint count against the request limit — does one "bulk" call count as a single request regardless of how many records it returns?
6. We just started testing with our existing API key and got `"You must have an active subscription or available credits"` after roughly 190 requests today. Could you check the current subscription/credit status on our account? We want to make sure it's active before we run the real historical load.

Thanks again for your help getting this set up correctly from the start.

Best,
[Twoje imię]
