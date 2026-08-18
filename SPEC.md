# Spec: ID Install Base 2026

## Objective

An internal web app that replaces the "ID install base 2026" Excel tracker — a list of
~470 refrigeration/compressor equipment installations across customer sites (region,
territory, PSA contract status, equipment specs, service history).

Two pages, plus a redirect at the root:

1. **Install Base (`/installs`)** — the "glorified Excel sheet." A searchable, filterable,
   editable data grid over every customer + equipment record, replacing manual spreadsheet
   editing with a proper UI (sorting, filtering, inline edit, export). Gated behind a single
   shared password — see Authentication below.
2. **New Entry (`/new`)** — a guided input form for adding a new equipment/install record
   (new or existing customer) without touching the grid directly. Submissions write straight
   to the same database and appear in the grid immediately.

`/` has no content of its own — the old create-next-app placeholder page is removed, and the
route just redirects straight to `/new` (the more common day-to-day entry point).

**User**: internal team only (sales, ops, service techs) — single trusted group, no public
access.

**Success looks like**: the team stops editing the `.xlsx` file by hand, uses the web app for
day-to-day lookups/edits, and can still export a clean `.xlsx` snapshot whenever one is needed
(e.g. to share externally).

## Tech Stack

- **Frontend**: Next.js (App Router, TypeScript) + MUI (Material UI, MUI X Data Grid
  Community) + Tailwind CSS for layout/utility/responsive styling. Tailwind's `preflight`
  is disabled so it doesn't fight MUI's own CSS baseline — Tailwind handles spacing/layout/
  breakpoints, MUI owns the component styling.
- **Backend**: Next.js Route Handlers (`app/api/**`) — no separate service
- **ORM / DB**: Prisma + PostgreSQL, hosted on **Neon** (serverless Postgres, first-class
  Vercel integration)
- **Excel I/O**: `exceljs` for generating/parsing `.xlsx` in API routes
- **Deployment**: Vercel (frontend + API routes), Neon (database)

## Data Model

Derived from the source sheet's column groups. Customer/contact fields repeat across every
equipment row for the same customer in the original sheet — normalized here into two tables.

Note: this project is on **Prisma 7**, which moved connection URLs out of `schema.prisma`
entirely — the datasource block just declares `provider = "postgresql"`. `DATABASE_URL` (Neon's
pooled endpoint) lives in `prisma.config.ts` for the CLI and in `src/lib/prisma.ts`, where the
runtime client is constructed with a `@prisma/adapter-pg` driver adapter (Prisma 7 requires an
explicit driver adapter — there's no more implicit engine-based connection).

```prisma
model Customer {
  id                String   @id @default(cuid())
  no                Int      @unique @default(autoincrement()) // auto-generated, not user-entered
  name              String
  bpNumber          String?
  uniqueIdentifier  String?
  address           String?  // required on /new form; nullable here — see Required Fields note
  region            String?
  territory         String?
  mainContact       String?
  contactNumber     String?
  email             String?
  location          String?
  fnbOrYps          String?                 // "F&B / YPS"
  psaStatus         String?                 // "With / Without PSA Contract"
  psaContract       String?
  psaEndDate        DateTime?
  salesRep          String?
  opsTeam           String?
  equipment         EquipmentRecord[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model EquipmentRecord {
  id                    String   @id @default(cuid())
  customerId            String
  customer              Customer @relation(fields: [customerId], references: [id])

  equipTag              String?  // required on /new form; nullable here — see Required Fields note
  model                 String?
  compressorType        String?
  serialNumber          String?
  brand                 String?              // "Brand (Manufacture)"
  motorMakeModel        String?
  motorSerial           String?
  motorKw               Float?
  yearInstalled         Int?
  yearCommissioned      Int?
  runningHours          Float?
  lastServiceDate       DateTime?
  comments              String?
  areaClassification    String?
  equipmentSalesPerson  String?

  controllerType        String?
  oilType                String?
  oilCharge              String?
  refType                String?
  refCharge              String?
  detailedComments       String?

  // 3rd Party Equipment
  thirdPartyCompressorModel String?
  thirdPartyRunHours        Float?
  thirdPartyPsaContract     String?
  condenserMakeModel        String?
  ammoniaPumpMakeModel      String?

  createdAt             DateTime @default(now())
  updatedAt              DateTime @updatedAt
}

model AppConfig {
  id                String @id @default(cuid())
  installsPassword  String // plaintext by design — see Authentication
}
```

`AppConfig` is unrelated to the Customer/Equipment domain — it exists purely to hold the
`/installs` gate password as a single editable row. See Authentication below.

## Required Fields

The source sheet marks required columns with a yellow header fill. These map to required
inputs on the `/new` form (client- and server-validated with `zod`) — **but are nullable at
the DB level**, not `NOT NULL`. The historical 422-row dataset is frequently missing them
(e.g. Motor KW is blank on 419/422 rows, Equip Tag on 417/422) — enforcing `NOT NULL` in the
schema would make seeding that data impossible. "Required" here means required for new entries
going forward, enforced at the API/form boundary, not a database constraint on legacy rows.
`No.` is excluded — it's system-generated (auto-increment), not user-entered.

- Customer
- Address
- Region
- Main contact 1
- Equip Tag
- Model
- Compressor Type
- Serial Number
- Brand (Manufacture)
- Motor Make/Model
- Motor Serial
- Motor KW
- Controller Type
- Oil Type
- Ref Type

Every other field is optional, matching the source sheet.

## Authentication

`/installs` is gated behind a single shared password. This is an internal tool for one trusted
team — not a multi-user auth system, no accounts, no roles.

- **Storage**: the `AppConfig` table (see Data Model) holds exactly one row with one field,
  `installsPassword`, stored in **plaintext**. Deliberate choice: the only person with DB access
  is the person running this app, and they want to change the password by editing that one field
  directly in Neon / Prisma Studio — no admin UI, no hashing, no redeploy.
- **Seeding the initial value**: the actual password is **never written to any committed file**
  — not `prisma/seed.ts`, not a migration, not `.env.example`. Migrations only carry schema DDL
  (`CREATE TABLE`), never row data, so that part is already safe by construction. The seed
  script creates the `AppConfig` row (if missing) with a placeholder/empty value at most; the
  real password is set by hand afterward via `npx prisma studio` — the same out-of-band
  mechanism used to change it later. This matters because **the GitHub repo is public**, and
  anything committed stays in git history even after a later change.
- **Flow**: visiting `/installs` without a valid session renders a password prompt in place of
  the grid. Submitting posts to `POST /api/auth/installs-login`, which compares the submitted
  value against `AppConfig.installsPassword`. On match it sets an httpOnly, signed session
  cookie; on mismatch the form shows an inline error and nothing is set.
- **Session**: the cookie holds an HMAC-signed token (signed with a new `AUTH_COOKIE_SECRET` env
  var — never the password itself, so the cookie can't be forged by guessing a value), 30-day
  expiry. `/installs/page.tsx` — an async Server Component — reads the cookie directly via
  `next/headers`'s `cookies()` and verifies its signature, rendering the password prompt in
  place of the grid when it's missing/invalid/expired. This check is signature-only and never
  touches the DB. (A separate `proxy.ts`/`middleware.ts` was considered and dropped — see
  Decisions Log; a single gated page doesn't need one.)
- **Scope**: `/new` and every `/api/**` route stay ungated — only the `/installs` page itself is
  behind the password. (Explicit choice — the API surface is not part of this gate.)
- **No lockout / rate-limiting** on repeated wrong guesses — acceptable for a low-stakes internal
  tool behind one shared password.

This still touches an API boundary (`POST /api/auth/installs-login`), so it follows the same
Contract-First Workflow as everything else — a contract before implementation, not skipped
because it's "just auth."

## API Design Notes

- `GET /api/equipment` is **paginated** server-side (`?page=`, `?pageSize=`, default 50/page)
  plus `?search=` and per-column filter params — the grid never fetches all ~470+ rows in one
  request. MUI X Data Grid runs in server-side pagination/filtering mode (`paginationMode`,
  `filterMode` set to `"server"`), not client-side.
- `GET /api/customers` used for the `/new` form's customer autocomplete — also paginated /
  search-limited (`?search=`) rather than returning the full customer list.

## Commands

```
Dev:          npm run dev
Build:        npm run build
Start:        npm run start
Lint:         npm run lint
Typecheck:    npm run typecheck        # tsc --noEmit
Test:         npm test                 # vitest run
Test (watch): npm run test:watch
DB migrate:   npx prisma migrate dev
DB studio:    npx prisma studio
DB seed:      npx prisma db seed       # loads the source .xlsx into Postgres
```

## Project Structure

```
src/
  app/
    page.tsx                  → redirects `/` → `/new`
    installs/
      page.tsx              → async Server Component; reads the session cookie and renders
                               either PasswordGate or the grid
    new/
      page.tsx              → New Entry form page
    api/
      equipment/
        route.ts             → GET (list/filter), POST (create)
        [id]/route.ts         → GET, PATCH, DELETE
      customers/
        route.ts              → GET (list, for form autocomplete), POST
      export/route.ts          → GET → streams .xlsx of current data
      import/route.ts          → POST → accepts .xlsx upload, bulk upserts
      auth/
        installs-login/route.ts → POST → checks password against AppConfig, sets session cookie
  components/
    installs/EquipmentGrid.tsx
    installs/PasswordGate.tsx   → password prompt shown when /installs is ungated
    new/EquipmentForm.tsx
  lib/
    prisma.ts                → Prisma client singleton
    xlsx.ts                   → shared import/export column mapping
    auth.ts                    → session cookie sign/verify helpers
  theme/
    theme.ts                  → MUI theme customization
prisma/
  schema.prisma
  migrations/
  seed.ts
tests/
  unit/                       → lib/, API route logic
  components/                  → grid + form behavior
contracts/
  _shared/error.yaml           → shared error envelope schema
  equipment/                    → OpenAPI contracts for /api/equipment endpoints
  customers/                    → OpenAPI contracts for /api/customers endpoints
  auth/                          → OpenAPI contract for /api/auth/installs-login
docs/
  SPEC.md                      → this file
```

## Contract-First Workflow

Every feature that touches an API boundary (new endpoint, or a changed request/response
shape on an existing one) starts with `/gen-contract`, not code:

1. `/gen-contract <feature description>` → writes an OpenAPI 3.1 YAML contract to
   `contracts/<module>/<endpoint>.yaml` and stops for review — no implementation yet.
2. Review and commit the contract.
3. `/gen-feature <contract path>` → spawns backend (Route Handler + Prisma) and/or frontend
   (page/component) work in parallel against the committed contract, so neither side is
   built against the other's in-progress assumptions.

This applies to `/api/equipment`, `/api/customers`, `/api/export`, and `/api/import` alike.
Skipping straight to implementation on an API-boundary change is not allowed under this
project's workflow.

## Code Style

TypeScript strict mode. Functional components, hooks, no class components. MUI `sx` prop or
theme-level overrides for styling — no separate CSS files unless a case genuinely needs them.

```tsx
// components/new/EquipmentForm.tsx
export function EquipmentForm({ onSubmit }: EquipmentFormProps) {
  const [values, setValues] = useState<EquipmentFormValues>(initialValues);

  const handleChange =
    (field: keyof EquipmentFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  return (
    <Stack spacing={2} component="form" onSubmit={handleSubmit(values, onSubmit)}>
      <TextField
        label="Customer"
        value={values.customerName}
        onChange={handleChange("customerName")}
        required
      />
      {/* ... */}
    </Stack>
  );
}
```

Conventions: PascalCase for components, camelCase for functions/variables, kebab-case for
non-component file names. API route handlers validate input with `zod` before touching Prisma.

## Testing Strategy

- **Framework**: Vitest + React Testing Library
- **Unit tests** (`tests/unit/`): xlsx import/export column mapping, API route handlers
  (validation, Prisma calls mocked or run against a test DB)
- **Component tests** (`tests/components/`): grid renders/filters/edits correctly, form
  validates required fields and submits expected payload
- **E2E** (optional, later): one Playwright smoke test covering "load grid → filter → edit a
  cell" and "fill form → submit → record appears in grid"
- No hard coverage % target given the small scope — every API route and every non-trivial
  utility (xlsx mapping especially) needs at least one test

## Boundaries

- **Always**: run `/gen-contract` before writing any code for a new or changed API endpoint,
  and get the contract confirmed before implementing (`/gen-feature`); run `npm run lint` and
  `npm run typecheck` before committing; validate all form input server-side (zod) even
  though there's no auth; use Prisma migrations for schema changes, never hand-edit the DB
- **Ask first**: adding dependencies outside the agreed stack; any schema change that could
  drop existing data; deploying to production Vercel; changing the Excel column
  mapping/export format
- **Never**: commit `.env` / database connection strings; commit the real customer `.xlsx`
  data file to the repo at all (**the GitHub repo is public** — the file is gitignored
  (`*.xlsx`) and must be placed locally, out-of-band, for seeding); delete customer or
  equipment records without an explicit confirm step in the UI; commit `AUTH_COOKIE_SECRET`;
  log or return `AppConfig.installsPassword` in any API response or error message; write the
  actual `installsPassword` value into `prisma/seed.ts`, a migration, `.env.example`, or any
  other committed file — set/change it only via `npx prisma studio` (out-of-band, not in git)

## Success Criteria

- [ ] `/installs` renders records in a MUI Data Grid with **server-side pagination**, search,
      and column filters (grid never loads the full dataset client-side), and supports inline
      cell editing that persists to Postgres
- [ ] `/new` lets a user pick an existing customer or create a new one, fill in equipment
      details (required fields enforced per the list above), submit, and see the record
      appear on `/installs` immediately — no review/approval step
- [ ] `GET /api/export` downloads a `.xlsx` reproducing the original column structure from
      current DB data
- [ ] `POST /api/import` can load the provided source `.xlsx` into a fresh database
      (used as the seed path)
- [ ] App deploys cleanly to Vercel with a Neon Postgres instance
- [ ] UI reads as a real product (MUI components, consistent spacing/typography), not a
      default HTML table
- [ ] Both pages are usable on a mobile viewport (Tailwind responsive breakpoints) — grid
      degrades gracefully (e.g. horizontal scroll / column priority) and the form is fully
      usable one-handed on a phone
- [ ] `/` redirects to `/new` — no leftover scaffold/placeholder content
- [ ] `/installs` shows a password prompt (not the grid) until the correct password is
      submitted; the password lives in `AppConfig.installsPassword` and can be changed by
      editing that field directly in the DB, with no code change or redeploy required

## Decisions Log

- `/new` submissions go live immediately — no review/approval step.
- The original sheet's red/orange "flagged" rows are **not** rebuilt as a status field for v1.
- MUI X Data Grid **Community** (not Pro). Correction from the original decision: column
  *grouping* (`columnGroupingModel`, grouped header rows) turned out to be a genuine
  Community-tier feature, not Pro-gated — used in `/installs` to reproduce the source sheet's
  5 section headers (Contact Information, Internal Information, Equipment, Detailed
  Information, 3rd Party Equipment). Column *pinning* is still Pro-only and remains out of
  scope.
- Backend list endpoints are server-side paginated (see API Design Notes) to keep the grid
  fast as the dataset grows.
- Tailwind CSS added alongside MUI for responsive/mobile-friendly layout.
- `/` no longer has its own content — the create-next-app scaffold page is removed and the
  route redirects to `/new` (chosen over `/installs` as the more common daily entry point).
- `/installs` gets a single shared-password gate. Password is stored in plaintext in a new
  one-row `AppConfig` table specifically so it can be changed by hand-editing the DB (Neon /
  Prisma Studio) with no code change or redeploy — deliberate simplicity over hashing, since
  the only person with DB access is the person operating this app.
- The gate covers `/installs` only — `/new` and all `/api/**` routes stay ungated. Session is a
  30-day HMAC-signed cookie (signed with a new `AUTH_COOKIE_SECRET` env var, not the password
  itself), verified without touching the DB. No lockout/rate-limiting on wrong guesses.
- Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts` (same capabilities, renamed file/
  export, and it now defaults to the **Node.js runtime** instead of Edge) — discovered while
  implementing Task 25. Ultimately neither is used: since `next/headers`'s `cookies()` can be
  read directly in a Server Component, and the gate covers exactly one page, doing the check in
  `/installs/page.tsx` itself is simpler than routing through a separate proxy file — one less
  file, no request-rewriting/header-threading to pass the auth result downstream, and the check
  is already DB-free either way. `proxy.ts` would only earn its keep if more pages needed the
  same gate.

No open questions remain — spec is ready to move to the Plan phase.
