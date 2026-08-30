# Laylaty Customer App

Flutter customer app. See [`docs/mobile/flutter-architecture.md`](../../docs/mobile/flutter-architecture.md)
for the architecture this implements (feature-based, Riverpod, one shared
Dio client) and [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml) for
the contract every `data/` class here talks to.

## What's implemented vs. scaffolded

`features/auth` and `features/events` are real, working code wired to
`apps/api`:

- **auth**: register → OTP verify → login → JWT stored in
  `flutter_secure_storage` → auto-refresh on a 401 (see
  `core/network/api_client.dart`) → logout.
- **events**: list events, create an event, and the **Event Dashboard** —
  the screen the whole app is organized around (blueprint §7/§21/§48):
  days remaining, budget spent vs. planned, tasks, booking/order counts,
  and the rule-based recommendation hint from `EventsService.getDashboard`.

Every other `features/*` directory (`stores`, `catalog`, `bookings`,
`cart`, `orders`, `notifications`, `profile`) is scaffolded per the
architecture doc but not yet implemented — see the `NOTE.md` in each for
which sprint covers it. `AppRouter` only defines top-level routes for
auth + the events home; everything else is a plain `Navigator.push` from
`EventsListScreen`.

## Running locally

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3000/v1
```

Point `API_BASE_URL` at whatever is running `apps/api` (default assumes
`npm run start:dev` on localhost — see `apps/api/README.md`).

## Tests

```bash
flutter analyze
flutter test
```

`test/widget_test.dart` stubs the `flutter_secure_storage` platform
channel (no real device/emulator in a widget test) and asserts an
unauthenticated launch lands on the login screen — this is the same
redirect logic in `core/router/app_router.dart` that also drives the
authenticated path to the events home.

Verified locally: `flutter analyze` (0 errors/warnings), `flutter test`
(passes), and `flutter build web --release` (compiles and tree-shakes
successfully) — see the PR this shipped in for the exact commands run.
