# Laylaty Customer App — Flutter Architecture

Companion to the customer-facing half of [`../api/openapi.yaml`](../api/openapi.yaml)
(auth, events, catalog, bookings, cart, orders, notifications, reviews).
The merchant and admin panels are Next.js web apps, out of scope here (see
blueprint §22).

**Implementation status:** this document describes the target structure.
[`../../apps/customer`](../../apps/customer) implements `auth`, `events`,
`stores`, and `catalog` for real against the structure below (verified with
`flutter analyze` and `flutter test`); every other feature listed here is
scaffolded as an empty directory with a `NOTE.md` pointing back to this doc
and its sprint.

## Project structure (Feature-Based Architecture, blueprint §22)

```text
lib/
├── main.dart
├── core/
│   ├── network/          # Dio client, interceptors (auth header, refresh-on-401)
│   ├── router/            # go_router route table
│   ├── theme/
│   ├── config/            # env (dev/staging/prod base URLs)
│   └── errors/            # Failure types, API error mapping
├── shared/
│   ├── widgets/            # buttons, cards, empty states, shared across features
│   └── models/             # cross-feature DTOs (Money, PaginatedResponse<T>)
└── features/
    ├── auth/
    │   ├── data/            # AuthRepository impl, AuthApi (matches /auth/*)
    │   ├── domain/          # AuthRepository interface, entities
    │   └── presentation/    # screens, Riverpod providers/notifiers
    ├── events/              # matches /events/* — the Event Dashboard (blueprint §21)
    ├── stores/              # public store browsing — /stores/*, /catalog/search
    ├── catalog/             # product/service/package detail screens
    ├── bookings/            # availability calendar, hold creation — /bookings/*
    ├── cart/                # /cart/*, /cart/checkout
    ├── orders/              # /orders/*, order tracking
    ├── notifications/       # /notifications/*
    └── profile/             # /users/me, addresses
```

Each feature follows the same three-layer split as `auth/`:

- **`data/`** — talks to the API (one `*Api` class per feature, thin wrapper
  around the shared Dio client) and implements the feature's repository
  interface. This is the only layer that knows about HTTP/JSON.
- **`domain/`** — repository interfaces and plain Dart entities. No Flutter
  imports here — this layer is what unit tests target.
- **`presentation/`** — screens/widgets plus state (Riverpod
  `Notifier`/`AsyncNotifier` per screen or flow). Reads only from the
  `domain` layer, never from `data` directly.

## State management

**Riverpod**, chosen once and used everywhere — the blueprint's §22
explicitly warns against mixing state management approaches. Server data
(events, catalog, orders, notifications) is modeled as `AsyncNotifier` /
`FutureProvider` so loading/error/data states are handled uniformly; local
UI-only state (form fields, selected date in the booking calendar) uses
plain `StateProvider`/`Notifier`.

## Networking conventions

- One `Dio` instance (`core/network/api_client.dart`) shared by every
  feature's `*Api` class, base URL from `core/config` per environment.
- An auth interceptor attaches the access token; on a `401` it calls
  `/v1/auth/refresh` once and retries the original request — mirroring the
  refresh-rotation behavior in `apps/api/src/modules/auth/auth.service.ts`.
- Every API response maps 1:1 onto a `docs/api/openapi.yaml` schema — a
  feature's `data/` model classes are generated or hand-written directly
  from those schemas, not invented ad hoc, so the mobile and backend teams
  never drift on a field name.

## Booking screen — a concurrency note that matters for UX

`POST /bookings` can return `409` when another customer's hold won the race
for the same slot (see `docs/database/erd.md` §4, the `EXCLUDE USING gist`
constraint). The booking feature's presentation layer must treat `409` as
an expected, user-facing outcome ("This slot was just taken — pick another
time") and re-fetch availability — not as a generic error toast.

## Event Dashboard — the differentiator screen

`features/events` renders the aggregated `GET /events/{eventId}` response
(`EventDashboard` schema: days remaining, tasks, budget, bookings, orders,
recommended services) as the app's home screen once a customer has an
active event — this is the screen that embodies blueprint §7/§48's central
claim that the event, not any single store, is what the app is organized
around.
