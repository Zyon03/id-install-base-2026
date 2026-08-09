---
description: Generate an OpenAPI 3.1 contract for a new or updated endpoint.
  Always run this before any code that touches an API boundary.
---

Generate an OpenAPI 3.1 YAML contract for the feature described below.

Feature: $ARGUMENTS

## Contract location

```
contracts/<module>/<endpoint>.yaml
```

Example: `contracts/orders/list_orders.yaml`

## Rules

- OpenAPI 3.1 (not 3.0)
- Reference the shared error envelope: `contracts/_shared/error.yaml`
- All fields must have explicit types — no implicit nulls
- Nullable fields must be marked `nullable: true` explicitly
- Integer fields must specify `format: int32` or `int64` to prevent
  float/int ambiguity at the DB scan layer
- List fields must note whether they can be null or only empty (`[]`)
- Use `snake_case` for all JSON field names
- Include all response codes that genuinely apply to the endpoint (typically
  200/201, 400, 404, 500 — this project has no auth, so skip 401/403 unless
  that changes)

## Response envelope — CRITICAL

Every Next.js Route Handler in this project returns `NextResponse.json(...)`
wrapped in exactly one outer `data` key on success. There is **no top-level
`message` field on success**. Every success response therefore has exactly
this shape — no more, no less:

```json
{
  "data": { ...payload fields... }
}
```

**Never write contracts where `data` contains another `data` key, and never
require a `message` field on a 2xx response:**

```yaml
# ❌ WRONG — double-wrapped, and message doesn't exist on success
example:
  data:
    data:
      customers: []
  message: "success"

# ✓ CORRECT — single wrap, semantic key, no message
example:
  data:
    customers: []
```

Rules for what goes inside `data`:
- **Single resource**: the resource fields directly — `{ "data": { "order_code": "...", ... } }`
- **List without pagination**: a named key holding the array — `{ "data": { "customers": [] } }`
- **List with pagination**: named key + pagination — `{ "data": { "orders": [], "pagination": {...} } }`
- The array key must be a semantic name (`customers`, `orders`, `items`) — **never** `"data"`

## What to include

- `info`: title, version, description of the endpoint's purpose
- `paths`: HTTP method, path, request body (query params for GET, JSON body
  for POST/PATCH), all response shapes. This project has no auth — omit
  auth requirements entirely rather than marking endpoints public
- `components/schemas`: all request and response models with field
  descriptions and examples
- Reference `$ref: 'contracts/_shared/error.yaml#/components/...'`
  for error responses

## After writing the contract

1. Print the full YAML for review
2. Stop. Do not implement. Do not spawn subagents.
3. Ask: "Review the contract above. Confirm to proceed?"

Do not write a single line of route handler or component code until the
user confirms. The contract gets committed before implementation starts.
