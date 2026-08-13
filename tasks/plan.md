# Implementation Plan: ID Install Base 2026

## Overview

Build a Next.js + MUI + Tailwind + Prisma/Postgres app replacing the "ID install base 2026"
Excel tracker, per `SPEC.md`. Two pages (`/installs` grid, `/new` form), contract-first API
development (`/gen-contract` → `/gen-feature`), server-side pagination. `/installs` sits behind
a single shared-password gate (`/new` and the API stay open); `/` redirects to `/new`. See
`SPEC.md` for the full data model, required fields, and success criteria — this document
sequences the work; `tasks/todo.md` holds the actionable per-task checklist.

## Architecture Decisions

- **Foundation before features**: scaffolding, Prisma schema, the Excel column-mapping
  library, and the seed script all come first — every feature depends on them, so building
  them out of order would mean redoing work.
- **Vertical slicing after foundation**: view → edit → delete → create → export/import →
  polish → deploy, in that order, prioritizing the highest-value/highest-risk paths early
  (a working read-only grid against real seeded data is the fastest walking skeleton).
- **Contract gate per endpoint**: every task that adds or changes an API endpoint is split
  into a `/gen-contract` task (human-reviewed stop) followed by a `/gen-feature`
  implementation task, per `SPEC.md`'s Contract-First Workflow boundary.
- **`lib/xlsx.ts` is shared** by the seed script, `/api/export`, and `/api/import` — one
  column-mapping implementation, not three, to avoid drift between them (Task 19 revisits
  whether the seed script should call the import path directly).
- **Password gate lands after Polish, before Deploy**: it's a late addition to the spec, and
  gating `/installs` only matters once there's something worth gating in front of real users —
  no reason to block earlier feature work on it. It must land before Task 27 (Deploy) so the
  gate is live from the first production deploy, not bolted on after.
- **The real password never enters git**: schema/migration work (Task 23) only ever writes
  placeholder/empty seed data; the actual value is set by hand via `npx prisma studio` after
  deploy-time migration, per `SPEC.md`'s Authentication section.

## Task List

### Phase 1: Foundation
- [x] Task 1: Scaffold the Next.js app
- [x] Task 2: Prisma schema + Neon Postgres + first migration
- [x] Task 3: Excel column-mapping library
- [x] Task 4: Seed script
- [x] Task 5: App shell

### Checkpoint: Foundation
- [x] `npm run build`, `npm run lint`, `npm run typecheck` all pass
- [x] Seed loads real data into Postgres successfully
- [x] Blank `/installs` and `/new` routes render with shared theme/nav
- [ ] Review with human before proceeding

### Phase 2: View, Edit, Delete (Install Base grid)
- [x] Task 6: Contract — `GET /api/equipment`
- [x] Task 7: Implement list endpoint + read-only grid
- [x] Task 8: Contract — `PATCH /api/equipment/{id}`
- [x] Task 9: Implement inline edit
- [x] Task 10: Contract — `DELETE /api/equipment/{id}`
- [x] Task 11: Implement delete with confirmation

### Checkpoint: View/Edit/Delete
- [x] Full CRUD-minus-create works end-to-end against real Postgres data on `/installs`
- [x] All new route handlers and grid interactions have passing tests
- [x] Review with human before proceeding

### Phase 3: New Entry form
- [x] Task 12: Contract — `GET/POST /api/customers`
- [x] Task 13: Contract — `POST /api/equipment`
- [x] Task 14: Implement customer + create-equipment backend
- [x] Task 15: Implement `/new` form page

### Checkpoint: Create flow
- [ ] A brand-new install can be entered on `/new` and immediately appears on `/installs`
- [ ] Review with human before proceeding

### Phase 4: Excel Import/Export
- [x] Task 16: Contract — `GET /api/export`
- [x] Task 17: Implement export + download button
- [x] Task 18: Contract — `POST /api/import`
- [x] Task 19: Implement import

### Checkpoint: Excel round-trip
- [ ] Export → import round-trip preserves data
- [ ] Review with human before proceeding

### Phase 5: Polish
- [x] Task 20: Mobile responsiveness pass
- [x] Task 21: Close test coverage gaps

### Checkpoint: Ready to ship
- [ ] All `SPEC.md` Success Criteria checked off
- [ ] Full test suite, lint, typecheck, build all green
- [ ] Review with human before proceeding

### Phase 6: Home Redirect + Install Password Gate
- [x] Task 22: Contract — `POST /api/auth/installs-login`
- [ ] Task 23: `AppConfig` schema + migration + placeholder-only seed
- [ ] Task 24: Implement login endpoint + session cookie helpers
- [ ] Task 25: Middleware gate + password prompt UI on `/installs`
- [ ] Task 26: Remove home page scaffold, redirect `/` to `/new`

### Checkpoint: Home redirect + Install gate
- [ ] `/` redirects to `/new`; no leftover scaffold content
- [ ] `/installs` is inaccessible without the correct password; correct password persists via
      cookie for 30 days; `/new` and `/api/**` remain reachable without it
- [ ] No password value appears anywhere in git history for this phase's commits
- [ ] Review with human before proceeding

### Phase 7: Deploy
- [ ] Task 27: Deploy to Vercel + Neon

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Excel column-mapping (Task 3) undercounts edge cases (merged cells, repeated customer blocks) | High — bad seed data | Test round-trip against real rows early (Task 3), before seed (Task 4) |
| MUI Data Grid Community server-side mode has rough edges with 43 columns | Medium | Confirmed Community-only in `SPEC.md`; revisit Pro only if it blocks Task 7 |
| Tailwind `preflight` disabling doesn't fully prevent MUI/Tailwind class conflicts | Low | Caught early in Task 1/5 before feature work builds on top |
| Contract review steps add friction/slow the loop | Low (intentional) | This is the point — prevents FE/BE mismatch; contracts are small (XS/S) and fast to review |
| Real password accidentally committed (seed script, `.env.example`, a stray console.log) | High — public repo | Task 23 seeds only a placeholder value; Boundaries in `SPEC.md` explicitly forbid committing the real value anywhere; set/changed only via `npx prisma studio` |
| Middleware checks the cookie signature but a bug lets stale/expired tokens through | Medium | Task 25's verify step explicitly checks expiry behavior, not just "cookie present" |

## Open Questions

- Task 12 leaves open whether creating a new customer during `/new` submission is one API
  call (nested create) or two (`POST /api/customers` then `POST /api/equipment`) — resolved
  during that contract's review, not before.

## End-to-End Verification

1. `npm run build && npm run lint && npm run typecheck && npm test` all pass
2. `npx prisma migrate deploy` + `npx prisma db seed` against a fresh DB succeeds
3. Manually walk both pages: filter/edit/delete on `/installs`, create via `/new`, export then
   re-import the `.xlsx`
4. Load `/installs` and `/new` at a mobile viewport width and confirm usability
5. Set `AppConfig.installsPassword` via `npx prisma studio`; confirm `/installs` blocks until
   the correct password is entered, `/new` and `/api/equipment` stay reachable without it, and
   `/` redirects straight to `/new`
6. `git log -p -- prisma/ .env.example` (or equivalent) confirms the real password never
   appears in any committed diff
7. Hit the deployed Vercel URL and repeat the manual walk against production data
