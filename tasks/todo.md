# Task List: ID Install Base 2026

See `tasks/plan.md` for phase ordering/rationale and `SPEC.md` for the full spec. `/build`
picks the next unchecked task from here.

## Phase 1: Foundation

- [x] Task 1: Scaffold the Next.js app
  - Acceptance: `create-next-app` project with TS, App Router; MUI + Emotion installed with a base theme; Tailwind installed with `preflight` disabled; ESLint/Prettier configured; folder structure matches `SPEC.md`'s Project Structure (`src/app`, `src/components`, `src/lib`, `src/theme`, `tests/`)
  - Verify: `npm run dev` serves a blank page; `npm run lint` and `npm run build` pass
  - Dependencies: None
  - Files: `package.json`, `next.config.*`, `tailwind.config.*`, `tsconfig.json`, `.eslintrc*`
  - Size: M

- [x] Task 2: Prisma schema + Neon Postgres + first migration
  - Acceptance: `Customer` and `EquipmentRecord` models match `SPEC.md`'s Data Model exactly (required vs. optional per the Required Fields list); `DATABASE_URL` wired to a Neon instance via `.env` (gitignored); `npx prisma migrate dev` creates the initial migration cleanly
  - Verify: `npx prisma studio` shows both empty tables with correct columns/types
  - Dependencies: Task 1
  - Files: `prisma/schema.prisma`, `prisma/migrations/**`, `src/lib/prisma.ts`, `.env.example`
  - Size: S

- [x] Task 3: Excel column-mapping library
  - Acceptance: `src/lib/xlsx.ts` maps all 43 source columns ⇄ the two Prisma models in both directions; handles the sheet's grouped-header layout (rows 1–2) and blank/repeated customer cells across an equipment group
  - Verify: unit test round-trips real rows from the source `.xlsx` and asserts the mapped object matches expected values
  - Dependencies: Task 2
  - Files: `src/lib/xlsx.ts`, `tests/unit/xlsx.test.ts`
  - Size: M

- [x] Task 4: Seed script
  - Acceptance: `prisma/seed.ts` reads `"ID install base 2026 (higlighted ).xlsx"`, uses `lib/xlsx.ts`, upserts ~472 equipment records under their customers
  - Verify: `npx prisma db seed` completes with no errors; row counts match the source sheet's non-empty data rows
  - Dependencies: Task 3
  - Files: `prisma/seed.ts`
  - Size: S

- [x] Task 5: App shell
  - Acceptance: root layout wires MUI `ThemeProvider` + `CssBaseline` and Tailwind's global stylesheet together without visual conflicts; simple nav/header links between `/installs` and `/new`
  - Verify: manual check — both routes render with consistent theme, nav works
  - Dependencies: Task 1
  - Files: `src/app/layout.tsx`, `src/theme/theme.ts`, `src/app/globals.css`
  - Size: S

### Checkpoint: Foundation
- [x] `npm run build`, `npm run lint`, `npm run typecheck` all pass
- [x] Seed loads real data into Postgres successfully
- [x] Blank `/installs` and `/new` routes render with shared theme/nav
- [ ] Review with human before proceeding

## Phase 2: View, Edit, Delete (Install Base grid)

- [x] Task 6: Contract — `GET /api/equipment`
  - Acceptance: `/gen-contract` produces `contracts/equipment/list_equipment.yaml` covering pagination (`page`, `pageSize`), `search`, per-column filters, referencing the shared error envelope; confirmed by human
  - Verify: valid OpenAPI 3.1, reviewed and committed
  - Dependencies: Checkpoint (Foundation)
  - Files: `contracts/equipment/list_equipment.yaml`
  - Size: XS

- [x] Task 7: Implement list endpoint + read-only grid
  - Acceptance: `/gen-feature` implements `GET /api/equipment` per contract (server-side pagination/search/filter via Prisma); `/installs` renders it in an MUI X Data Grid with `paginationMode`/`filterMode` = `"server"`
  - Verify: `/installs` shows real seeded data; page/search/filter round-trips to the API; `npm test` passes new route handler tests
  - Dependencies: Task 6
  - Files: `src/app/api/equipment/route.ts`, `src/app/installs/page.tsx`, `src/components/installs/EquipmentGrid.tsx`
  - Size: M

- [x] Task 8: Contract — `PATCH /api/equipment/{id}`
  - Acceptance: `/gen-contract` produces `contracts/equipment/update_equipment.yaml` for partial updates, confirmed by human
  - Verify: valid OpenAPI 3.1, reviewed and committed
  - Dependencies: Task 7
  - Files: `contracts/equipment/update_equipment.yaml`
  - Size: XS

- [x] Task 9: Implement inline edit
  - Acceptance: `/gen-feature` implements the `PATCH` handler (zod-validated, required fields enforced) and wires the grid's `processRowUpdate`, with optimistic UI + rollback on error
  - Verify: editing a cell persists after reload; invalid edits (e.g. blanking a required field) show an inline error and don't save
  - Dependencies: Task 8
  - Files: `src/app/api/equipment/[id]/route.ts`, `src/components/installs/EquipmentGrid.tsx`
  - Size: M

- [x] Task 10: Contract — `DELETE /api/equipment/{id}`
  - Acceptance: `/gen-contract` produces `contracts/equipment/delete_equipment.yaml`, confirmed by human
  - Verify: valid OpenAPI 3.1, reviewed and committed
  - Dependencies: Task 9
  - Files: `contracts/equipment/delete_equipment.yaml`
  - Size: XS

- [x] Task 11: Implement delete with confirmation
  - Acceptance: `/gen-feature` implements the `DELETE` handler and adds a grid row action that opens an MUI confirm dialog before calling it
  - Verify: deleting a row removes it from grid + DB only after confirming; cancel leaves it untouched
  - Dependencies: Task 10
  - Files: `src/app/api/equipment/[id]/route.ts`, `src/components/installs/EquipmentGrid.tsx`
  - Size: S

### Checkpoint: View/Edit/Delete
- [x] Full CRUD-minus-create works end-to-end against real Postgres data on `/installs`
- [x] All new route handlers and grid interactions have passing tests
- [x] Review with human before proceeding

## Phase 3: New Entry form

- [x] Task 12: Contract — `GET/POST /api/customers`
  - Acceptance: `/gen-contract` produces `contracts/customers/search_customers.yaml` + `contracts/customers/create_customer.yaml`; also settles how `/new` links a new equipment record to a brand-new customer (separate call vs. nested create) — decide during contract review
  - Verify: valid OpenAPI 3.1, reviewed and committed
  - Dependencies: Checkpoint (View/Edit/Delete)
  - Files: `contracts/customers/search_customers.yaml`, `contracts/customers/create_customer.yaml`
  - Size: S

- [x] Task 13: Contract — `POST /api/equipment`
  - Acceptance: `/gen-contract` produces `contracts/equipment/create_equipment.yaml` covering all 15 required fields, confirmed by human
  - Verify: valid OpenAPI 3.1, reviewed and committed
  - Dependencies: Task 12
  - Files: `contracts/equipment/create_equipment.yaml`
  - Size: XS

- [x] Task 14: Implement customer + create-equipment backend
  - Acceptance: `/gen-feature` implements customer search/create handlers and the equipment-create handler per contracts, zod-validated against the required-fields list
  - Verify: route tests cover required-field rejection and successful creation (existing and new customer)
  - Dependencies: Task 13
  - Files: `src/app/api/customers/route.ts`, `src/app/api/equipment/route.ts`
  - Size: M

- [x] Task 15: Implement `/new` form page
  - Acceptance: `/gen-feature` (frontend) builds the form: MUI Autocomplete for existing customers backed by search, inline "create new customer" path, equipment fields with 15 required fields marked/validated client-side to match the server contract, submit posts to `/api/equipment`
  - Verify: submitting with a new customer + full required fields creates a record visible immediately on `/installs`; missing a required field is blocked with a clear error
  - Dependencies: Task 14
  - Files: `src/app/new/page.tsx`, `src/components/new/EquipmentForm.tsx`
  - Size: M

### Checkpoint: Create flow
- [ ] A brand-new install can be entered on `/new` and immediately appears on `/installs`
- [ ] Review with human before proceeding

## Phase 4: Excel Import/Export

- [x] Task 16: Contract — `GET /api/export`
  - Acceptance: `/gen-contract` produces `contracts/export/export_equipment.yaml` describing a file-download response reproducing the original column layout
  - Verify: valid OpenAPI 3.1, reviewed and committed
  - Dependencies: Checkpoint (Create flow)
  - Files: `contracts/export/export_equipment.yaml`
  - Size: XS

- [x] Task 17: Implement export + download button
  - Acceptance: `/gen-feature` implements the handler (reusing `lib/xlsx.ts`'s reverse mapping) and adds a download button on `/installs`
  - Verify: downloaded `.xlsx` opens cleanly and matches the original column structure with current DB data
  - Dependencies: Task 16
  - Files: `src/app/api/export/route.ts`, `src/app/installs/page.tsx`
  - Size: S

- [x] Task 18: Contract — `POST /api/import`
  - Acceptance: `/gen-contract` produces `contracts/import/import_equipment.yaml` for multipart `.xlsx` upload and bulk upsert
  - Verify: valid OpenAPI 3.1, reviewed and committed
  - Dependencies: Task 17
  - Files: `contracts/import/import_equipment.yaml`
  - Size: XS

- [x] Task 19: Implement import
  - Acceptance: `/gen-feature` implements the handler reusing `lib/xlsx.ts`; consider refactoring `prisma/seed.ts` (Task 4) to call this same code path to avoid drift
  - Verify: uploading the original source `.xlsx` to a freshly-migrated DB reproduces the seed result
  - Dependencies: Task 18
  - Files: `src/app/api/import/route.ts`
  - Size: M

### Checkpoint: Excel round-trip
- [ ] Export → import round-trip preserves data
- [ ] Review with human before proceeding

## Phase 5: Polish

- [x] Task 20: Mobile responsiveness pass
  - Acceptance: `/installs` and `/new` usable on a mobile viewport per `SPEC.md`'s success criteria (grid degrades gracefully; form fully usable one-handed)
  - Verify: manual check at common mobile breakpoints (375px, 414px widths)
  - Dependencies: Checkpoint (Excel round-trip)
  - Files: `src/components/installs/EquipmentGrid.tsx`, `src/components/new/EquipmentForm.tsx`, Tailwind classes throughout
  - Size: S

- [x] Task 21: Close test coverage gaps
  - Acceptance: every API route and `lib/xlsx.ts` has at least one test; component tests exist for grid filter/edit/delete and form validation/submit
  - Verify: `npm test` green; no route or non-trivial utility left untested
  - Dependencies: Task 20
  - Files: `tests/**`
  - Size: M

### Checkpoint: Ready to ship
- [ ] All `SPEC.md` Success Criteria checked off
- [ ] Full test suite, lint, typecheck, build all green
- [ ] Review with human before proceeding

## Phase 6: Home Redirect + Install Password Gate

- [x] Task 22: Contract — `POST /api/auth/installs-login`
  - Acceptance: `/gen-contract` produces `contracts/auth/installs_login.yaml` covering the request (single `password` field) and response (success sets a session cookie; failure returns the shared error envelope with no hint about the correct value); confirmed by human
  - Verify: valid OpenAPI 3.1, reviewed and committed
  - Dependencies: Checkpoint (Ready to ship)
  - Files: `contracts/auth/installs_login.yaml`
  - Size: XS

- [ ] Task 23: `AppConfig` schema + migration + placeholder-only seed
  - Acceptance: `AppConfig` model added to `prisma/schema.prisma` exactly matching `SPEC.md`'s Data Model (single row, `installsPassword String`); `npx prisma migrate dev` creates the migration cleanly; `prisma/seed.ts` creates the row only if missing, with an empty/placeholder value — the real password is never written into `seed.ts`, a migration, or `.env.example`
  - Verify: `npx prisma studio` shows the `AppConfig` table with exactly one row; diff of the commit contains no literal password string
  - Dependencies: Task 22
  - Files: `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`
  - Size: S

- [ ] Task 24: Implement login endpoint + session cookie helpers
  - Acceptance: `/gen-feature` implements `POST /api/auth/installs-login` per contract — compares the submitted password against `AppConfig.installsPassword`, and on match sets an httpOnly cookie holding an HMAC-signed token (new `AUTH_COOKIE_SECRET` env var, 30-day expiry, never the password itself); `src/lib/auth.ts` holds the sign/verify helpers, reused by middleware in Task 25
  - Verify: route tests cover correct password (cookie set), wrong password (rejected, no cookie, no password echoed back), and a missing/empty `AppConfig` row handled without crashing
  - Dependencies: Task 23
  - Files: `src/app/api/auth/installs-login/route.ts`, `src/lib/auth.ts`, `tests/unit/**`
  - Size: M

- [ ] Task 25: Middleware gate + password prompt UI on `/installs`
  - Acceptance: `src/middleware.ts` guards `/installs` by verifying the signed session cookie (signature/expiry check only, no DB call, so it runs on the Edge runtime) and shows the password prompt when it's missing/invalid/expired; `src/components/installs/PasswordGate.tsx` renders the prompt, posts to `/api/auth/installs-login`, and reveals the grid on success without a full page reload
  - Verify: manual check — visiting `/installs` with no cookie shows the prompt; wrong password shows an inline error and the grid stays hidden; correct password reveals the grid and survives a reload; `/new` and `GET /api/equipment` remain reachable directly with no cookie at all
  - Dependencies: Task 24
  - Files: `src/middleware.ts`, `src/components/installs/PasswordGate.tsx`, `src/app/installs/page.tsx`
  - Size: M

- [ ] Task 26: Remove home page scaffold, redirect `/` to `/new`
  - Acceptance: `src/app/page.tsx` no longer renders the create-next-app placeholder — it redirects (server-side) straight to `/new`
  - Verify: visiting `/` lands on `/new` with no intermediate placeholder flash
  - Dependencies: None
  - Files: `src/app/page.tsx`
  - Size: XS

### Checkpoint: Home redirect + Install gate
- [ ] `/` redirects to `/new`; no leftover scaffold content anywhere
- [ ] `/installs` is inaccessible without the correct password; correct password persists via a 30-day cookie; `/new` and `/api/**` remain reachable without it
- [ ] No password value appears anywhere in git history for this phase's commits
- [ ] Review with human before proceeding

## Phase 7: Deploy

- [ ] Task 27: Deploy to Vercel + Neon
  - Acceptance: Neon Postgres provisioned, Vercel project linked, `DATABASE_URL`, `AUTH_COOKIE_SECRET`, and other env vars set, production migration applied, `AppConfig.installsPassword` set by hand via `npx prisma studio` against the production DB, app deployed
  - Verify: live URL loads `/new` at `/`, `/installs` prompts for and enforces the password, and `/new` successfully creates a record
  - Dependencies: Checkpoint (Home redirect + Install gate)
  - Files: Vercel/Neon dashboard config, or a `vercel.json` if needed
  - Size: S
