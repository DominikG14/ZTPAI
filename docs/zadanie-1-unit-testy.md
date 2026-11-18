# Zadanie 1 — Unit testy logiki biznesowej

Sprawozdanie z realizacji testów jednostkowych dla serwisu rezerwacji (`ReservationsService`).

## 1. Konfiguracja i uruchamianie

- Zainstalowano i skonfigurowano framework **Jest** (`jest.config.js`).
- Dodano skrypt npm do `package.json`:
  ```bash
  npm run test:unit
  ```
- Testy działają w pełnej izolacji od bazy danych PostgreSQL (nie wymagają połączenia sieciowego ani uruchomionej bazy).

## 2. Architektura i wstrzykiwanie zależności

Serwis `createReservationsService` przyjmuje jako zależności:
1. `reservationRepository` — repozytorium in-memory (`createReservationsRepositoryMemory`). Każdy test tworzy własną instancję repozytorium w sekcji `beforeEach`, co gwarantuje pełną izolację stanu i niezależność kolejności wykonywania testów.
2. `now` — funkcję dostarczającą aktualny czas w postaci wstrzykiwanej (np. `() => currentTime`), co pozwala na precyzyjną kontrolę upływu czasu bez manipulowania zegarem systemowym.

Asercje w testach weryfikują wyłącznie właściwość `code` błędu (np. `ROOM_ALREADY_BOOKED`, `CAPACITY_EXCEEDED`, `VALIDATION_ERROR`, `RESERVATION_ALREADY_STARTED`, `FORBIDDEN`), a nie treść pola `message`.

## 3. Zestawienie zaimplementowanych przypadków testowych

Zaimplementowano łącznie **19 testów jednostkowych** (wymagane minimum: 12) pogrupowanych według reguł biznesowych:

### Reguła 1: Nakładanie się rezerwacji (Overlapping)
- **Nakładanie częściowe (przed)**: próba rezerwacji rozpoczynającej się przed istniejącą i kończącej w jej trakcie (`09:30–10:30` vs `10:00–12:00`) zostaje odrzucona kodem `ROOM_ALREADY_BOOKED`.
- **Nakładanie częściowe (po)**: próba rezerwacji rozpoczynającej się w trakcie istniejącej i kończącej po niej (`11:30–12:30` vs `10:00–12:00`) zostaje odrzucona kodem `ROOM_ALREADY_BOOKED`.
- **Zawieranie (wewnątrz)**: rezerwacja mieszcząca się całkowicie wewnątrz istniejącej (`10:30–11:30` vs `10:00–12:00`) zostaje odrzucona kodem `ROOM_ALREADY_BOOKED`.
- **Zawieranie (obejmujące)**: rezerwacja obejmująca całą istniejącą (`09:30–12:30` vs `10:00–12:00`) zostaje odrzucona kodem `ROOM_ALREADY_BOOKED`.
- **Przedziały stykające się (po)**: rezerwacja zaczynająca się dokładnie w momencie zakończenia istniejącej (`12:00–13:00` vs `10:00–12:00`) jest **dozwolona** (sukces, status `CONFIRMED`).
- **Przedziały stykające się (przed)**: rezerwacja kończąca się dokładnie w momencie rozpoczęcia istniejącej (`09:00–10:00` vs `10:00–12:00`) jest **dozwolona** (sukces, status `CONFIRMED`).
- **Inna sala**: rezerwacja w tym samym przedziale czasowym (`10:00–12:00`), lecz dla innej sali (`roomId: 2`) jest **dozwolona** (sukces).

### Reguła 2: Anulowane rezerwacje
- Rezerwacja o statusie `CANCELLED` nie blokuje przedziału — nowa rezerwacja na tę samą salę i ten sam czas zostaje pomyślnie utworzona (`CONFIRMED`).

### Reguła 3: Pojemność sali (Capacity)
- `participants == capacity` (np. 30 na 30 miejsc) — **dozwolone** (sukces).
- `participants == capacity + 1` (np. 31 na 30 miejsc) — zostaje odrzucone kodem `CAPACITY_EXCEEDED`.

### Reguła 4: Czas trwania (Duration) — parametryzowane za pomocą `test.each`
Wykorzystano konstrukcję `test.each`:
- Dokładnie 15 min (`10:00–10:15`) — **dozwolone** (sukces).
- Dokładnie 8 h (`10:00–18:00`) — **dozwolone** (sukces).
- 14 min (`10:00–10:14`) — odrzucone kodem `VALIDATION_ERROR`.
- 8 h 1 min (`10:00–18:01`) — odrzucone kodem `VALIDATION_ERROR`.

### Reguła 5: Anulowanie rezerwacji (Cancellation)
- **Rozpoczęta rezerwacja**: próba anulowania rezerwacji, gdy wstrzyknięty czas `now` przekroczył `startTime` rezerwacji, zostaje odrzucona kodem `RESERVATION_ALREADY_STARTED`.
- **Podwójne anulowanie (idempotentność)**: ponowne anulowanie rezerwacji w statusie `CANCELLED` kończy się sukcesem, a znacznik czasu `cancelledAt` pozostaje niezmieniony (zachowuje pierwotną wartość).

### Reguła 6: Własność rezerwacji (Ownership)
- **Obcy USER**: próba anulowania rezerwacji przez zwykłego użytkownika (`role: 'USER'`) niebędącego właścicielem zostaje odrzucona kodem `FORBIDDEN`.
- **ADMIN**: użytkownik z rolą `ADMIN` może anulować dowolną rezerwację (nawet nienależącą do niego).
- **Właściciel (USER)**: użytkownik będący autorem rezerwacji może ją bez przeszkód anulować.

---

## 4. Kontrola jakości testów (Mutation Testing / Testy mutacyjne)

Zgodnie z wymaganiem, sprawdzono czułość zestawu testów na błędy w regule nakładania się poprzez celowe wprowadzenie mutacji w repozytorium in-memory:
zamieniono operatory ścisłej nierówności `<` i `>` na słabe nierówności `<=` i `>=`:

```javascript
// Kod poprawny:
new Date(startTime) < new Date(item.endTime) && new Date(endTime) > new Date(item.startTime)

// Celowo wprowadzony błąd mutacyjny:
new Date(startTime) <= new Date(item.endTime) && new Date(endTime) >= new Date(item.startTime)
```

### Wynik wykonania testów z celowym błędem:

Zestaw testów natychmiast wykrył błąd brzegowy — testy przedziałów stykających się zgłosiły błąd:

```
FAIL tests/unit/reservations.service.test.js
  ReservationsService - Unit Tests
    Reguła: Nakładanie się rezerwacji (Overlapping)
      √ nakładanie częściowe (rozpoczęcie przed istniejącą, zakończenie w trakcie) zostaje odrzucone (143 ms)
      √ nakładanie częściowe (rozpoczęcie w trakcie istniejącej, zakończenie po niej) zostaje odrzucone (1 ms)
      √ zawieranie (nowa rezerwacja w całości wewnątrz istniejącej) zostaje odrzucone (1 ms)
      √ zawieranie (nowa rezerwacja całkowicie obejmuje istniejącą) zostaje odrzucone (1 ms)
      × przedziały stykające się zaraz po istniejącej rezerwacji są dozwolone (1 ms)
      × przedziały stykające się zaraz przed istniejącą rezerwacją są dozwolone
      √ inna sala w tym samym przedziale czasowym jest dozwolona (1 ms)
...
  ● ReservationsService - Unit Tests › Reguła: Nakładanie się rezerwacji (Overlapping) › przedziały stykające się zaraz po istniejącej rezerwacji są dozwolone
    ConflictError: Room is already reserved for this time ('ROOM_ALREADY_BOOKED')

  ● ReservationsService - Unit Tests › Reguła: Nakładanie się rezerwacji (Overlapping) › przedziały stykające się zaraz przed istniejącą rezerwacją są dozwolone
    ConflictError: Room is already reserved for this time ('ROOM_ALREADY_BOOKED')

Test Suites: 1 failed, 1 total
Tests:       2 failed, 17 passed, 19 total
```

Oba testy przypadków brzegowych (przedziały stykające się od dołu i od góry) poprawnie zidentyfikowały regresję, dowodząc wysokiej jakości i kompletności zestawu testów. Po przeprowadzeniu kontroli przywrócono poprawny kod z operatorami `<` i `>`.

---

## 5. Raport końcowy z uruchomienia `npm run test:unit`

```text
> zpap@1.0.0 test:unit
> jest

PASS tests/unit/reservations.service.test.js
  ReservationsService - Unit Tests
    Reguła: Nakładanie się rezerwacji (Overlapping)
      √ nakładanie częściowe (rozpoczęcie przed istniejącą, zakończenie w trakcie) zostaje odrzucone (147 ms)
      √ nakładanie częściowe (rozpoczęcie w trakcie istniejącej, zakończenie po niej) zostaje odrzucone (1 ms)
      √ zawieranie (nowa rezerwacja w całości wewnątrz istniejącej) zostaje odrzucone (1 ms)
      √ zawieranie (nowa rezerwacja całkowicie obejmuje istniejącą) zostaje odrzucone (1 ms)
      √ przedziały stykające się zaraz po istniejącej rezerwacji są dozwolone (1 ms)
      √ przedziały stykające się zaraz przed istniejącą rezerwacją są dozwolone (1 ms)
      √ inna sala w tym samym przedziale czasowym jest dozwolona (1 ms)
    Reguła: Anulowane rezerwacje
      √ rezerwacja CANCELLED nie blokuje przedziału czasowego (1 ms)
    Reguła: Pojemność sali (Capacity)
      √ participants == capacity jest dozwolone
      √ participants == capacity + 1 zostaje odrzucone z kodem CAPACITY_EXCEEDED
    Reguła: Czas trwania (Duration)
      √ dozwolony czas trwania: dokładnie 15 min (1 ms)
      √ dozwolony czas trwania: dokładnie 8 h (2 ms)
      √ niedozwolony czas trwania: 14 min (za krótko) zostaje odrzucony z kodem VALIDATION_ERROR
      √ niedozwolony czas trwania: 8 h 1 min (za długo) zostaje odrzucony z kodem VALIDATION_ERROR
    Reguła: Anulowanie rezerwacji (Cancellation)
      √ rozpoczęta rezerwacja nie może zostać odwołana (RESERVATION_ALREADY_STARTED) (1 ms)
      √ podwójne anulowanie jest idempotentne i zachowuje pierwotny cancelledAt bez zmian (1 ms)
    Reguła: Ownership
      √ obcy USER zostaje odrzucony z kodem FORBIDDEN
      √ ADMIN może anulować rezerwację innego użytkownika
      √ właściciel (USER) może anulować własną rezerwację (1 ms)

Test Suites: 1 passed, 1 total
Tests:       19 passed, 19 total
Snapshots:   0 total
Time:        0.759 s
Ran all test suites.
```
