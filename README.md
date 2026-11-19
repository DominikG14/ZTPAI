[![CI](https://github.com/DominikG14/ZTPAI/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DominikG14/ZTPAI/actions/workflows/ci.yml)

# Room Booking API

## PostgreSQL

Wymagany jest Docker Compose oraz Node.js. Skopiuj `.env.example` do `.env`, a następnie uruchom bazę i migracje:

```powershell
Copy-Item .env.example .env
docker compose up -d db
npm install
npm run db:migrate
npm run seed:run
npm start
```

PostgreSQL 16 jest dostępny na hoście pod portem `5433`. Baza przechowuje dane w wolumenie `postgres_data`. `npm run db:rollback` cofa ostatnią migrację. `npm run seed:run` powtarzalnie odtwarza przykładowy stan: 2 budynki, 5 sal i 5 rezerwacji (w tym odwołaną oraz już rozpoczętą), z identyfikatorami od 1. Seed czyści zawartość tych trzech tabel.

Domyślnie serwer korzysta z PostgreSQL. Repozytoria in-memory można wybrać przez ustawienie `REPOSITORY=memory` przed uruchomieniem serwera.

## Endpointy

- `GET /api/buildings` — lista budynków.
- `GET /api/buildings/:id` — budynek o podanym ID.
- `POST /api/buildings` — tworzy budynek; body: `{ "name": "Budynek A", "address": "ul. Warszawska 24, Kraków" }`.
- `GET /api/rooms` i `GET /api/rooms/:id` — lista sal lub sala.
- `GET /api/buildings/:id/rooms` — sale budynku; nieistniejący budynek zwraca `404`.
- `POST /api/rooms` — tworzy salę; body: `{ "buildingId": 1, "name": "101", "capacity": 20 }`.
- `GET /api/reservations` i `GET /api/reservations/:id` — lista rezerwacji lub rezerwacja.
- `POST /api/reservations` — tworzy rezerwację.
- `PATCH /api/reservations/:id/cancel` — odwołuje rezerwację.

Szczegóły sali i rezerwacji zawierają powiązany budynek. Lista budynków zawiera `roomsCount`, również dla budynków bez sal. Repozytoria Knex pobierają te relacje przez JOIN-y, aby liczba zapytań nie rosła z liczbą wyników. Zapytania można logować przez `DEBUG=knex:query`.

Lista rezerwacji przyjmuje opcjonalne `roomId`, `buildingId`, `status`, `from`, `to`, `page`, `limit` i `sort`. Zakres czasu filtruje rezerwacje nachodzące na przedział. `page` domyślnie wynosi 1, `limit` 20 (maksymalnie 100), a `sort` może przyjąć `startTime`, `-startTime`, `createdAt`, `-createdAt`, `participants` lub `-participants`. Odpowiedź ma postać `{ data, meta: { page, limit, total, totalPages } }`.

Przykładowe kombinacje parametrów i SQL wygenerowany przez Knex są w `docs/zadanie-4-query-examples.md`.

Wyścig równoległych rezerwacji można sprawdzić poleceniem `node scripts/double-booking.js` przy uruchomionym API. Skrypt wysyła 10 identycznych żądań, wypisuje ich statusy i wykonuje kontrolne zapytanie SQL. Po naprawie oczekiwany wynik to `1 × 201`, `9 × 409` i jedna rezerwacja `CONFIRMED`. Zapisane wyniki demonstracji są w `docs/zadanie-5-double-booking.md`.

Nieistniejący budynek przy tworzeniu sali zwraca `404`, a powtórzona nazwa sali w tym samym budynku `409`. Szczegóły błędów PostgreSQL nie są zwracane klientowi.

## Rejestracja

`POST /api/auth/register` przyjmuje `email` i `password`. Email jest przycinany i zamieniany na małe litery; hasło musi mieć co najmniej 10 znaków i jest zapisywane jako bcrypt z kosztem 10. Rola z żądania jest odrzucana, a nowe konto zawsze otrzymuje `USER`. Powtórzony email zwraca `409 EMAIL_TAKEN`.

Seed tworzy również konto administratora: domyślnie `admin@example.com` z hasłem `Admin12345!`. Dane można zmienić zmiennymi `SEED_ADMIN_EMAIL` i `SEED_ADMIN_PASSWORD` przed `npm run seed:run`. Seed odtwarza przykładowy stan i czyści dane tabel aplikacji, w tym `users`.

## Logowanie i JWT

- `POST /api/auth/login` przyjmuje `{ "email": "...", "password": "..." }` i zwraca `accessToken`, `tokenType: "Bearer"` oraz `expiresIn`.
- `GET /api/auth/me` wymaga nagłówka `Authorization: Bearer <accessToken>` i zwraca profil użytkownika bez hasha.

JWT jest podpisany HS256. Payload zawiera `sub` (ID jako tekst), `role`, `iat` i `exp`, bez emaila i innych danych osobowych. Czas ważności można ustawić przez `JWT_EXPIRES_IN` (domyślnie `15m`); sekret podpisujący należy ustawić w `JWT_SECRET`. Złe dane logowania zawsze zwracają `401 INVALID_CREDENTIALS` z tym samym komunikatem. Weryfikacja tokenu dopuszcza wyłącznie algorytm HS256.

## Middleware i rezerwacje użytkownika

## Zdarzenia i audit log

Po zatwierdzeniu transakcji rezerwacji API publikuje `reservation.created` lub `reservation.cancelled`. Błędy listenerów są logowane i nie zmieniają odpowiedzi API. Każdy event jest zapisywany w tabeli `audit_log` jako JSONB. Administrator może pobrać wpisy przez `GET /api/admin/audit-log?eventType=reservation.created&page=1&limit=20`; odpowiedź zawiera `data` i metadane paginacji.

Przy anulowaniu cudzej rezerwacji przez ADMIN-a serwer zapisuje w konsoli powiadomienie z adresem email właściciela.

Każdy endpoint API poza `POST /api/auth/register`, `POST /api/auth/login` i ścieżką `/api/docs` wymaga `Authorization: Bearer <accessToken>`. Brak lub niepoprawny token zwraca `401`; wygasły token zwraca `401 TOKEN_EXPIRED`.

`POST /api/reservations` przyjmuje `roomId`, `participants`, `startTime` i `endTime`. Nie przyjmuje `userId` ani `reservedBy` — właściciel jest ustawiany z uwierzytelnionego tokenu. Odpowiedź zawiera `user: { id, email }`. Seedowane konto użytkownika to `jan.kowalski@example.com` / `User12345!` (konto administratora pozostaje osobne).

Migracja `20261031030000_reservations_user_id` uzupełnia właściciela istniejących rezerwacji przed usunięciem `reserved_by`. Każda historyczna wartość jest mapowana do użytkownika; nazwy bez emaila dostają techniczny adres `legacy-…@legacy.invalid`, a ich konta otrzymują losowe hasła, których nie zapisuje się nigdzie.
