# Zadanie 5 — demonstracja i naprawa double booking

Końcowa wersja zawiera transakcję z blokadą sali i constraint PostgreSQL.

## Przed naprawą

Uruchomiono `node scripts/double-booking.js` na wersji check-then-act. Sztuczne opóźnienie nie było potrzebne: wyścig wystąpił od razu.

- 10 równoległych żądań `POST /api/reservations` otrzymało `201`.
- Dla sali `1` i przedziału `2026-11-01T07:23:33.066Z`–`2026-11-01T08:23:33.066Z` zapytanie po zakończeniu zwróciło `10` rezerwacji `CONFIRMED`.

```sql
select count(*) as "count"
from "reservations"
where "room_id" = $1
  and "status" = $2
  and "start_time" < $3
  and "end_time" > $4;
```

Bindy: `[1, "CONFIRMED", "2026-11-01T08:23:33.066Z", "2026-11-01T07:23:33.066Z"]`.

Rekordy utworzone w demonstracji przed naprawą usunięto przed migracją constraintu.

## Po naprawie

Po dodaniu transakcji z blokadą wiersza sali i constraintu PostgreSQL ten sam skrypt otrzymał `1 × 201` oraz `9 × 409`. Zapytanie kontrolne zwróciło `1` rezerwację `CONFIRMED`.

Ponowne sprawdzenie końcowej wersji: dla sali `1`, przedziału `2034-09-24T09:00:35.402Z`–`2034-09-24T10:00:35.402Z`, żądania 1–10 zwróciły `201, 409, 409, 409, 409, 409, 409, 409, 409, 409`; zapytanie kontrolne zwróciło `1`.

Constraint `reservations_no_confirmed_overlap` używa `btree_gist` i zakresu `tstzrange(start_time, end_time, '[)')`; statusy inne niż `CONFIRMED` są wyłączone predykatem. Naruszenie SQLSTATE `23P01` jest mapowane na `409 ROOM_ALREADY_BOOKED`.

Sprawdzenia dodatkowych warunków:

- odwołanie rezerwacji: `200`; utworzenie nowej w tym samym przedziale: `201`;
- bezpośredni INSERT nakładający się na aktywną rezerwację został odrzucony kodem `23P01`;
- dwa rezerwacje `10:00–12:00` i `12:00–13:00` wstawiono razem w bazie — obie przeszły constraint.

Po sprawdzeniach usunięto wyłącznie rekordy demonstracyjne.

## Z wyłączonym sprawdzeniem kolizji w aplikacji

Tryb demonstracyjny pomija zapytanie `findConflicts` w serwisie, ale pozostawia blokadę wiersza sali oraz constraint PostgreSQL. Dzięki temu można pokazać, że sama baza nadal odrzuca kolizje. Flaga działa wyłącznie poza `NODE_ENV=production`.

W pierwszym oknie PowerShell uruchom serwer:

```powershell
$env:DEMO_SKIP_APP_CONFLICT_CHECK = '1'
npm start
```

W drugim oknie, z katalogu projektu, uruchom:

```powershell
node scripts/double-booking.js
```

Przykładowy wynik z uruchomienia:

```text
Request 1: 409
Request 2: 201 (reservation 70)
Request 3: 409
Request 4: 409
Request 5: 409
Request 6: 409
Request 7: 409
Request 8: 409
Request 9: 409
Request 10: 409
CONFIRMED overlapping reservations: 1
```

Kolejność odpowiedzi może się różnić. Istotny wynik to jeden `201`, dziewięć `409` i dokładnie jedna pasująca rezerwacja. Po demonstracji zatrzymaj serwer (`Ctrl+C`); zmienna ustawiona w tym oknie przestanie wtedy obowiązywać.

> Powyższy wynik wariantu z pominięciem sprawdzenia aplikacyjnego został zarejestrowany podczas demonstracji. Przełącznik demonstracyjny usunięto przy przywróceniu standardowego sprawdzania kolizji; aktualnie endpoint wykonuje sprawdzenie w serwisie, a blokada i constraint PostgreSQL pozostają dodatkowymi zabezpieczeniami.
