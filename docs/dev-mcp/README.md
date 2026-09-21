# dev-mcp — the MCP server a dev's agent reads PipeTooling through

---
file: docs/dev-mcp/README.md
type: Integration guide
purpose: What dev-mcp is, how a dev connects an agent to it, what the door allows and refuses, and how to extend it. The plan and the naming scheme live in to-dos/mcp-servers.md; the function reference is EDGE_FUNCTIONS.md → dev-mcp.
audience: Developers, AI agents
last_updated: 2026-09-20
sections:
  - The idea
  - Connect
  - The verbs
  - What the door refuses
  - The call log
  - Extending it
  - What is left
---

## The idea

`https://mcp.clicktooling.com/dev` reads the app **as the dev whose key it is**. The function resolves the key to a person, mints that person's own session, and calls the app's own API with it — **GET only**. PostgREST runs GET in a read-only transaction, so the database refuses a write whatever an RPC is named; RLS and every `auth.uid()` role check apply exactly as on the screen. The service role is used for three things: resolving the key, minting the session, writing the call log.

It replaces two habits: read-only REST probes through a signed-in browser pane, and raw SQL through the Supabase MCP.

## Connect

Settings → Your account → **Dev MCP keys** → *Issue a key* (deep link `/settings#settings-dev-mcp-keys`) (one per machine; shown once; `ptd_…`). Put `export PT_DEV_MCP_TOKEN='ptd_…'` in your shell profile; `.mcp.json` already registers the `dev-mcp` connector with that variable. MCP servers connect at session start — a session launched without the variable cannot repair the connector mid-flight. First call: `whoami`.

## The verbs

| Verb | What it does |
|---|---|
| `whoami` | Who the key reads as, and the door's limits. |
| `find_rpc(text)` · `find_table(text)` · `get_table(table)` | The generated catalog (`dev-mcp/catalog.ts`, from `src/types/database.ts`): names, arguments, columns. Never guess a name. |
| `call_read(rpc, args?, limit?)` | Any RPC, as you, over GET. |
| `read_rows(table, select?, filters?, order?, limit?)` | Any table or view, RLS-bound; default 50 rows, at most 200. |
| `find_job(text)` · `find_bid(text)` · `find_customer(text)` · `find_person(text)` | "J1032" / "b482" / a name → ids, with the label the app shows. Jobs and bids use the app's own search RPCs; people are listed as the rosters list them (active, human, not a sample). |
| `get_job(job)` | The Job window: header, **money**, invoices, payments, account strip, stages, hours, recent activity. |
| `get_customer(customer)` | The Customer hub: profile, **money**, contacts, addresses, jobs, bids, estimates. |
| `get_bid(bid)` | A bid's stored facts: the row, count rows, assignments, versions, sends, the submission ledger, the strip. |
| `check_sampler(hours?)` · `check_connections` · `check_locks` · `check_migration_ledger(n?)` | **Is the database healthy?** Each opens with a one-line `reading`, then the rows: sampler gaps over 90 s and the slowest sample (the freeze windows and the early warning of [`DB_FREEZE_RUNBOOK.md`](../DB_FREEZE_RUNBOOK.md) Step 2 — they survive a restart), the newest connection sample against `max_connections`, who waits on a lock **right now** and who blocks them, and the newest ledger rows to hold against `git ls-tree origin/main supabase/migrations/`. Dev-gated definer RPCs (`dev_health_*`, `dev_migration_ledger_tail`) over the same GET door — no service role; they read, they never terminate a backend. |
| `check_edge_boot(after?)` | OPTIONS-probes the edge functions (a generated list, in name order) and names any answering `503 BOOT_ERROR` — deployed but unable to start, which `check:edge-drift` cannot see. **50 per call**: the platform allows a function about 60 calls a minute to other functions, so the reply carries `next_after` — call again with `after`, about a minute later, until it is `null` (three calls today). A probe the rate limit refused is listed as `rate_limited`; it says nothing about that function. |
| `view_as(role \| user, verb, args?)` | Any verb above as a role's **sample account** or a named person — what *they* see. A dev is never a target (Imitate's rule); both identities are logged (`dev_mcp_calls.as_user_id`). |

**Where the money comes from.** A composite runs the screen's own reads and hands the rows to the screen's own kernels in `_shared/` — `get_job`: `jobMaterialsCostLines` (the four parts buckets) + `jobSubLaborInputs` + `buildJobProfitSummary` (profit) and `profileJobRowMoney` (billed / open); `get_customer`: `customerMoneyStats`, `customerDaysToPay`, `customerEstimateOutcomes`. So a number here is the number on the screen, and a change to the screen's math changes this too. Where that is not possible the reply **says so instead of computing a second opinion**: a bid's priced total lives in the `useBidPricingEngine` hook, so `get_bid.totals` is a sentence, not a figure. A part that cannot be read is reported in place (`{ "error": … }`) and takes only itself down — a failed cost source costs you `money`, not the job.

`job`, `customer` and `bid` take an id, or text that matches exactly one; several matches come back as a short list of ids to choose from.

## What the door refuses

- **Writes** — by the database (`25006`, read-only transaction), not by a list in the function.
- **Names not in the catalog**, and five credential tables that are never read — directly or through an embed (`DENIED_TABLES` in `_shared/devMcpDoor.ts`).
- **Secrets** — any key named `token`, `secret`, `password`, `api_key`, `hash` (whole or as a `_suffix`) is redacted from every reply at any depth, and cannot be filtered on. An agent's transcript is not a place for a portal token.
- **Known limit** — redaction is by key name. A value that *contains* a secret under another name (a portal URL with its token in the path) comes back as the app shows it to you; you are reading as yourself.
- **Oversized asks** — a request over 6,000 characters as a URL; a reply over 80,000 characters is cut, and says so.

## The call log

`dev_mcp_calls`: one row per call — who, verb, the RPC or table named, args, outcome, rows, milliseconds. Devs read it. It is also the evidence for which composites are worth building next: a question asked the long way, often, earns a verb.

## Extending it

Kernel first: what a verb may name and how it becomes a GET is pure code in `supabase/functions/_shared/devMcpDoor.ts`; the named verbs are `_shared/devMcpComposites.ts`, written against an injected `Reader` (tests in `src/lib/devMcp/` — their fake reader enforces the generated catalog and the door's rules, so a composite that names a column the table does not have fails in CI, not live). A new composite earns its place from the call log, and its numbers come from a kernel the screen already uses — lift that kernel into `_shared/` first (a move, its own PR). After `npm run gen-types:linked`, run `node scripts/build-dev-mcp-catalog.mjs` (CI fails on a stale catalog) and redeploy `dev-mcp`. The JSON-RPC shell is `_shared/mcpJsonRpc.ts`; the public route is one line in `scripts/cloudflare/mcp-router.worker.js`.

## What is left

[`to-dos/mcp-servers.md`](../../to-dos/mcp-servers.md) is the handoff — what is built and live, and a build brief per remaining PR (writes over the existing dev-gated RPCs · sign-in instead of a key), each with its own verify recipe, plus the gotchas that cost a day the first time. The board shows the same file at `/punch-list`.
