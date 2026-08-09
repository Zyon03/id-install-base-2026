---
description: Spawn whichever of backend/frontend apply, in parallel, to
  implement a committed contract. Requires the contract file path as
  argument.
---

Implement the feature defined by the contract at: $ARGUMENTS

## Step 1: Precondition check (do not skip)

1. Verify the contract file exists at the given path
2. Verify it is a valid OpenAPI 3.1 YAML file (has `openapi: 3.1.0`)
3. If either check fails — STOP and report. Do not proceed without a
   committed contract.

There is no urgency exception. If the contract does not exist, run
`/gen-contract` first.

## Step 2: Decide which subagents apply

This project is a single Next.js app (App Router) — "backend" means the
Route Handler(s) under `src/app/api/**` plus any Prisma schema/migration
work, and "frontend" means the page/components under `src/app/**` and
`src/components/**` that consume the contract. They're still worth
implementing as separate parallel passes even though they share a repo,
because the whole point of the contract is to let each side be built
against the agreed shape instead of against each other's in-progress code.

Read the contract and the feature description to determine what actually
needs to change. Not every run needs both:

- **backend** — only if the contract describes a new or changed endpoint
  that no existing Route Handler implements yet. Check `src/app/api/**` for
  a handler matching the contract's path — if it already matches, skip
  backend entirely. A UI-only change against an already-implemented,
  unchanged endpoint needs no backend work.
- **frontend** — only if the feature is user-facing (i.e. touches
  `/installs` or `/new`)

Most features here need both, since almost everything flows through the
grid or the form. If it's genuinely unclear which subagent(s) apply, ask
the user rather than guessing.

## Step 3: Spawn in parallel

Spawn the applicable subagents IN PARALLEL by calling the Agent tool
multiple times in a single message:

All applicable agent calls must be sent in a single message so they run in
parallel. Sequential Agent calls = sequential execution. That defeats the
purpose.

## Step 4: After all spawned subagents return

- Report which files each subagent changed
- Report any contract ambiguities any subagent flagged
- If more than one subagent flagged the same ambiguity, the contract needs
  tightening — do not silently resolve in code
- Do NOT commit — leave that to the user after review
- Remind user to run `git diff` before committing to verify scope

## What this command does NOT do

- Write the contract (use `/gen-contract` for that)
- Make API design decisions
- Spawn subagents sequentially
- Proceed without a committed contract
