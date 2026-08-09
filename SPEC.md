# Spec: ID Install Base 2026

## Objective

An internal web app that replaces the "ID install base 2026" Excel tracker — a list of
~470 refrigeration/compressor equipment installations across customer sites (region,
territory, PSA contract status, equipment specs, service history).

Two pages:

1. **Install Base (`/installs`)** — the "glorified Excel sheet." A searchable, filterable,
   editable data grid over every customer + equipment record, replacing manual spreadsheet
   editing with a proper UI (sorting, filtering, inline edit, export).
2. **New Entry (`/new`)** — a guided input form for adding a new equipment/install record
   (new or existing customer) without touching the grid directly. Submissions write straight
   to the same database and appear in the grid immediately.

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
  address           String
  region            String
  territory         String?
  mainContact       String
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

  equipTag              String
  model                 String
  compressorType        String
  serialNumber          String
  brand                 String              // "Brand (Manufacture)"
  motorMakeModel        String
  motorSerial           String
  motorKw               Float
  yearInstalled         Int?
  yearCommissioned      Int?
  runningHours          Float?
  lastServiceDate       DateTime?
  comments              String?
  areaClassification    String?
  equipmentSalesPerson  String?

  controllerType        String
  oilType                String
  oilCharge              String?
  refType                String
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
```

## Required Fields

The source sheet marks required columns with a yellow header fill. These map to required
inputs on the `/new` form (server-validated with `zod`) and `NOT NULL` columns in the schema.
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
    installs/
      page.tsx              → Install Base grid page
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
  components/
    installs/EquipmentGrid.tsx
    new/EquipmentForm.tsx
  lib/
    prisma.ts                → Prisma client singleton
    xlsx.ts                   → shared import/export column mapping
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
  equipment records without an explicit confirm step in the UI

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

## Decisions Log

- `/new` submissions go live immediately — no review/approval step.
- The original sheet's red/orange "flagged" rows are **not** rebuilt as a status field for v1.
- MUI X Data Grid **Community** (not Pro) — no column grouping/pinning for now.
- Backend list endpoints are server-side paginated (see API Design Notes) to keep the grid
  fast as the dataset grows.
- Tailwind CSS added alongside MUI for responsive/mobile-friendly layout.

No open questions remain — spec is ready to move to the Plan phase.
