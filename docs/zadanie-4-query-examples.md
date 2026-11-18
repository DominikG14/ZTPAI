# Zadanie 4 - kombinacje parametrow i wygenerowany SQL

Dla kazdego przypadku sa dwa zapytania: COUNT do meta.total oraz pobranie strony z JOIN-ami. SQL i bindy zebrano z eventu query Knex podczas wykonania repozytorium.

## 01 - strona domyslna

Zadanie: GET /api/reservations?page=1&limit=5&sort=startTime

Parametry: {"page":1,"limit":5,"sort":"startTime"}

### Licznik total

```sql
select count(distinct "res"."id") as "total" from "reservations" as "res" inner join "rooms" as "room" on "room"."id" = "res"."room_id"
```

Bindy: []

### Dane strony

```sql
select "res"."id", "res"."room_id", "res"."reserved_by", "res"."participants", "res"."start_time", "res"."end_time", "res"."status", "res"."cancelled_at", "res"."created_at", "room"."id" as "joined_room_id", "room"."name" as "joined_room_name", "room"."capacity" as "joined_room_capacity", "room"."building_id" as "joined_room_building_id", "building"."id" as "joined_building_id", "building"."name" as "joined_building_name" from "reservations" as "res" inner join "rooms" as "room" on "room"."id" = "res"."room_id" inner join "buildings" as "building" on "building"."id" = "room"."building_id" order by "res"."start_time" asc, "res"."id" asc limit $1
```

Bindy: [5]

## 02 - sala i status

Zadanie: GET /api/reservations?roomId=1&status=CONFIRMED&page=2&limit=10&sort=-createdAt

Parametry: {"roomId":1,"status":"CONFIRMED","page":2,"limit":10,"sort":"-createdAt"}

### Licznik total

```sql
select count(distinct "res"."id") as "total" from "reservations" as "res" inner join "rooms" as "room" on "room"."id" = "res"."room_id" where "res"."room_id" = $1 and "res"."status" = $2
```

Bindy: [1,"CONFIRMED"]

### Dane strony

```sql
select "res"."id", "res"."room_id", "res"."reserved_by", "res"."participants", "res"."start_time", "res"."end_time", "res"."status", "res"."cancelled_at", "res"."created_at", "room"."id" as "joined_room_id", "room"."name" as "joined_room_name", "room"."capacity" as "joined_room_capacity", "room"."building_id" as "joined_room_building_id", "building"."id" as "joined_building_id", "building"."name" as "joined_building_name" from "reservations" as "res" inner join "rooms" as "room" on "room"."id" = "res"."room_id" inner join "buildings" as "building" on "building"."id" = "room"."building_id" where "res"."room_id" = $1 and "res"."status" = $2 order by "res"."created_at" desc, "res"."id" asc limit $3 offset $4
```

Bindy: [1,"CONFIRMED",10,10]

## 03 - budynek i zakres czasu

Zadanie: GET /api/reservations?buildingId=2&from=2026-10-01T00%3A00%3A00.000Z&to=2026-12-01T00%3A00%3A00.000Z&page=1&limit=5&sort=participants

Parametry: {"buildingId":2,"from":"2026-10-01T00:00:00.000Z","to":"2026-12-01T00:00:00.000Z","page":1,"limit":5,"sort":"participants"}

### Licznik total

```sql
select count(distinct "res"."id") as "total" from "reservations" as "res" inner join "rooms" as "room" on "room"."id" = "res"."room_id" where "room"."building_id" = $1 and "res"."end_time" > $2 and "res"."start_time" < $3
```

Bindy: [2,"2026-10-01T00:00:00.000Z","2026-12-01T00:00:00.000Z"]

### Dane strony

```sql
select "res"."id", "res"."room_id", "res"."reserved_by", "res"."participants", "res"."start_time", "res"."end_time", "res"."status", "res"."cancelled_at", "res"."created_at", "room"."id" as "joined_room_id", "room"."name" as "joined_room_name", "room"."capacity" as "joined_room_capacity", "room"."building_id" as "joined_room_building_id", "building"."id" as "joined_building_id", "building"."name" as "joined_building_name" from "reservations" as "res" inner join "rooms" as "room" on "room"."id" = "res"."room_id" inner join "buildings" as "building" on "building"."id" = "room"."building_id" where "room"."building_id" = $1 and "res"."end_time" > $2 and "res"."start_time" < $3 order by "res"."participants" asc, "res"."id" asc limit $4
```

Bindy: [2,"2026-10-01T00:00:00.000Z","2026-12-01T00:00:00.000Z",5]

## 04 - sala, status i inne sortowanie

Zadanie: GET /api/reservations?roomId=3&status=CANCELLED&page=1&limit=20&sort=-participants

Parametry: {"roomId":3,"status":"CANCELLED","page":1,"limit":20,"sort":"-participants"}

### Licznik total

```sql
select count(distinct "res"."id") as "total" from "reservations" as "res" inner join "rooms" as "room" on "room"."id" = "res"."room_id" where "res"."room_id" = $1 and "res"."status" = $2
```

Bindy: [3,"CANCELLED"]

### Dane strony

```sql
select "res"."id", "res"."room_id", "res"."reserved_by", "res"."participants", "res"."start_time", "res"."end_time", "res"."status", "res"."cancelled_at", "res"."created_at", "room"."id" as "joined_room_id", "room"."name" as "joined_room_name", "room"."capacity" as "joined_room_capacity", "room"."building_id" as "joined_room_building_id", "building"."id" as "joined_building_id", "building"."name" as "joined_building_name" from "reservations" as "res" inner join "rooms" as "room" on "room"."id" = "res"."room_id" inner join "buildings" as "building" on "building"."id" = "room"."building_id" where "res"."room_id" = $1 and "res"."status" = $2 order by "res"."participants" desc, "res"."id" asc limit $3
```

Bindy: [3,"CANCELLED",20]
