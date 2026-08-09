# Implementation Plan: ID Install Base 2026

## Overview

Build a Next.js + MUI + Tailwind + Prisma/Postgres app replacing the "ID install base 2026"
Excel tracker, per `SPEC.md`. Two pages (`/installs` grid, `/new` form), contract-first API
development (`/gen-contract` → `/gen-feature`), server-side pagination, no auth. See `SPEC.md`
for the full data model, required fields, and success criteria — this document sequences the
work; `tasks/todo.md` holds the actionable per-task checklist.

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

## Task List

### Phase 1: Foundation
- [x] Task 1: Scaffold the Next.js app
- [x] Task 2: Prisma schema + Neon Postgres + first migration
- [x] Task 3: Excel column-mapping library
- [x] Task 4: Seed script
- [ ] Task 2: Prisma schema + Neon Postgres + first migration
- [ ] Task 3: Excel column-mapping library
- [ ] Task 4: Seed script
- [ ] Task 5: App shell

### Checkpoint: Foundation
- [ ] `npm run build`, `npm run lint`, `npm run typecheck` all pass
- [ ] Seed loads real data into Postgres successfully
- [ ] Blank `/installs` and `/new` routes render with shared theme/nav
- [ ] Review with human before proceeding

### Phase 2: View, Edit, Delete (Install Base grid)
- [ ] Task 6: Contract — `GET /api/equipment`
- [ ] Task 7: Implement list endpoint + read-only grid
- [ ] Task 8: Contract — `PATCH /api/equipment/{id}`
- [ ] Task 9: Implement inline edit
- [ ] Task 10: Contract — `DELETE /api/equipment/{id}`
- [ ] Task 11: Implement delete with confirmation

### Checkpoint: View/Edit/Delete
- [ ] Full CRUD-minus-create works end-to-end against real Postgres data on `/installs`
- [ ] All new route handlers and grid interactions have passing tests
- [ ] Review with human before proceeding

### Phase 3: New Entry form
- [ ] Task 12: Contract — `GET/POST /api/customers`
- [ ] Task 13: Contract — `POST /api/equipment`
- [ ] Task 14: Implement customer + create-equipment backend
- [ ] Task 15: Implement `/new` form page

### Checkpoint: Create flow
- [ ] A brand-new install can be entered on `/new` and immediately appears on `/installs`
- [ ] Review with human before proceeding

### Phase 4: Excel Import/Export
- [ ] Task 16: Contract — `GET /api/export`
- [ ] Task 17: Implement export + download button
- [ ] Task 18: Contract — `POST /api/import`
- [ ] Task 19: Implement import

### Checkpoint: Excel round-trip
- [ ] Export → import round-trip preserves data
- [ ] Review with human before proceeding

### Phase 5: Polish
- [ ] Task 20: Mobile responsiveness pass
- [ ] Task 21: Close test coverage gaps

### Checkpoint: Ready to ship
- [ ] All `SPEC.md` Success Criteria checked off
- [ ] Full test suite, lint, typecheck, build all green
- [ ] Review with human before proceeding

### Phase 6: Deploy
- [ ] Task 22: Deploy to Vercel + Neon

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Excel column-mapping (Task 3) undercounts edge cases (merged cells, repeated customer blocks) | High — bad seed data | Test round-trip against real rows early (Task 3), before seed (Task 4) |
| MUI Data Grid Community server-side mode has rough edges with 43 columns | Medium | Confirmed Community-only in `SPEC.md`; revisit Pro only if it blocks Task 7 |
| Tailwind `preflight` disabling doesn't fully prevent MUI/Tailwind class conflicts | Low | Caught early in Task 1/5 before feature work builds on top |
| Contract review steps add friction/slow the loop | Low (intentional) | This is the point — prevents FE/BE mismatch; contracts are small (XS/S) and fast to review |

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
5. Hit the deployed Vercel URL and repeat the manual walk against production data
