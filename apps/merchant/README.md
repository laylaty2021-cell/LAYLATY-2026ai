# Laylaty Merchant Dashboard

Next.js (App Router, TypeScript, Tailwind) merchant onboarding dashboard for
the Laylaty platform. Consumes `apps/api`'s REST contract directly — see
`../../docs/api/openapi.yaml`.

## What's implemented

- Auth: register → OTP verify → login, tokens kept in `localStorage`
  (`src/context/auth-context.tsx`, `src/lib/token-storage.ts`), with a
  refresh-on-401 interceptor in `src/lib/api-client.ts` matching
  `apps/customer`'s Dio interceptor pattern.
- Dashboard (`src/app/dashboard`): fetches `GET /organizations` and
  `GET /merchant/stores`; shows an empty-state "create your organization"
  form when the merchant has none, then a "create your store" form once an
  organization exists, then lists the merchant's organizations and stores.
- Store detail (`src/app/dashboard/stores/[storeId]`): fetches
  `GET /merchant/stores/:storeId/products` and `.../services`, lists them,
  and has forms to add a product (`POST .../products`) or service
  (`POST .../services`).

This app is deliberately a fully client-rendered SPA — every page is
`"use client"`, auth lives in `localStorage`, no server components or
server actions touch the API. See
`node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md`
for why this is a supported first-class pattern in this Next.js version.

## Not yet implemented

Packages, bookings, and order management screens — see
`../../docs/backlog/sprint-backlog.md` for what's next.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Requires `apps/api` running locally (see `../api/README.md`) at the URL in
`NEXT_PUBLIC_API_BASE_URL`.

## Verifying

```bash
npm run lint
npm run build
```
