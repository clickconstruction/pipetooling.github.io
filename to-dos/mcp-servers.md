---
name: MCP servers — one address, a server for twins and a server for devs
group: ready
status: PRs 1, 2, 4a, 4b-1 shipped 2026-09-20 (v2.3633 · v2.3634 · v2.3638 · v2.3640) — the address is live and dev-mcp reads · left: 4b-2 composites, key prefixes, health, writes, sign-in
summary: >
  The twins' MCP server moves behind one readable address (mcp.clicktooling.com/twin, a
  Cloudflare Worker in front of the twin-mcp function), and a second server, dev-mcp, gives a
  dev's agent fenced, audited reads of the app (and later the validated write entrypoints)
  instead of raw SQL or a signed-in browser. This file is the naming scheme's one home.
next: PR 4b-2 — the four `find_*` resolvers, `get_job` / `get_customer` / `get_bid`, `view_as`. PR 3 (twin key prefixes) is an hour and can go any time.
size: L
blocker: None — the verb list was decided 2026-09-20.
opinion: build — PRs 1–2 are an afternoon and every later piece (OAuth, dev-mcp) hangs off the address.
mockup: not required — a Worker and a server; the one screen (issuing a dev key) copies the Digital twins key card
---

# MCP servers: one address, a server for twins and a server for devs

## The ask

The owner, 2026-09-20, after the twin-mcp docs catch-up: "Right now we have a twin MCP. Do we
have anything for the main app itself for a dev using an agent like yourself to better
manage?" — then "Could we instead use Cloudflare to give it a better URL?" — then "I think
we're going to have one for devs and one for twins. Should we come up with a naming schema",
and on the scheme: "`mcp.clicktooling.com/twin` and `mcp.clicktooling.com/dev` work.
CountTooling and TakeoffTooling may get managed by these mcp servers or may get their own."

What a dev's agent has today: Supabase's generic MCP (raw SQL; its DDL half is forbidden by
CLAUDE.md), `/dev-login` (a full dev session on prod data in a browser), the two
least-privilege DB roles in `AGENTS.md` (`hr_agent`, `cost_agent` — each its own psql
connection and contract), and the scripts. Nothing answers "what does the app say about
J1032" the way the app computes it, and nothing records what an agent read.

## The decision — the naming scheme

One audience word — `twin` or `dev` — travels through every layer, the way `twin-login` /
`dev-login` already pair.

| Layer | Twins | Devs |
|---|---|---|
| Public address | `https://mcp.clicktooling.com/twin` | `https://mcp.clicktooling.com/dev` |
| Edge function | `twin-mcp` (unchanged) | `dev-mcp` |
| Connector key (`.mcp.json`, Claude Desktop config) | `twin-mcp` (unchanged — it is in allow rules and the kickoffs) | `dev-mcp` |
| `serverInfo.name` | `pipetooling-twin-mcp` (unchanged) | `pipetooling-dev-mcp` |
| Auth header | `X-Twin-Token` or `Authorization: Bearer` | `X-Dev-Token` or `Authorization: Bearer` |
| Key shape | bare 64-hex today; new keys `ptt_<hex>` | `ptd_<hex>` |
| Tables | `twin_credentials`, `twin_runs` | `dev_mcp_credentials`, `dev_mcp_calls` |
| Env var | `TWIN_ESTIMATOR_1_TOKEN` | `PT_DEV_MCP_TOKEN` |
| Docs | `docs/twins/`, `EDGE_FUNCTIONS.md` → twin-mcp | `docs/dev-mcp/`, `EDGE_FUNCTIONS.md` → dev-mcp |

Rules that go with the table:

- **One host, a path per audience.** A nested host (`twin.mcp.…`) is outside Cloudflare's
  free certificate; one host is also one Worker, one DNS record, and one place for OAuth.
- **The path is the audience, never the seat.** Estimator or pricer is decided by the key
  (`users.twin_kind`); there is no `/pricer`.
- **CountTooling and TakeoffTooling stay open both ways.** While these servers manage them,
  the app is an argument or a verb prefix, as today (`mint_session app:`, `ct_finish_takeoff`,
  `tt_finish_costing`). If one gets its own server, its app slug goes in front of the
  audience on the same host — `mcp.clicktooling.com/count/twin`, `/takeoff/dev` — so the
  Worker's route map grows by a line and nobody learns a second host. The bare `/twin` and
  `/dev` stay PipeTooling's.
- **Key prefixes are for new keys only.** Lookup is by sha256, so existing bare keys keep
  working; the prefix lets a secret scanner, a person, and the Worker tell the two apart (a
  `ptd_` key presented at `/twin` is refused at the edge).
- **Verb grammar is shared, verb names are not.** Both servers use `get_` (read), `next_`
  (a dispatcher claim), `put_` (idempotent write), `finish_` (hand back). dev-mcp adds
  `find_` (search), `check_` (health) and a `plan_` / `apply_` pair for every write, so a dry
  run is always its own call. A dev session often has both servers loaded: dev-mcp names its
  verbs on the app's nouns (`get_job`, `find_customer`, `check_locks`) and never reuses a twin
  verb (`get_work_state`).

Rejected: Supabase's custom-domain add-on (paid, renames the whole project's API including
auth); a host per audience; renaming the `twin-mcp` connector key (breaks every allow rule
and the kickoff text for no gain).

## Where it plugs in

Exists:
- `supabase/functions/twin-mcp/` — stateless JSON-RPC over POST (no SSE, no session), so a
  Worker that forwards the request and returns the response is a complete proxy.
- `supabase/functions/twin-setup/index.ts` — reads a `TWIN_MCP_PUBLIC_URL` secret, but as a
  **base origin**: `connectorUrlFor` appends `/functions/v1/twin-mcp`. The new address must be
  taken verbatim.
- `src/lib/bids/desktopKickoff.ts` → `twinMcpConnectorUrl` builds the connector address from
  `VITE_SUPABASE_URL` for the Console's copy buttons and both setup commands.
- `.mcp.json`, `docs/twins/TWIN_HARNESS.md`, `docs/twins/kickoffs/*.md` (the
  `{{CONNECTOR_URL}}` placeholder — filled at copy time, nothing hard-coded).
- `scripts/cloudflare/` — the two live Workers' reference copies; the convention is a
  dashboard-edited Worker with a synced file here.
- `twin_credentials` / `twin_runs` and the Digital twins key card — the pattern dev keys copy.
- `AGENTS.md` → the two agent DB roles: `hr_agent_write(jsonb)`,
  `cost_batch_apply(jsonb, dry_run)` / `cost_batch_revert(uuid, text)`.

New: the `mcp-router` Worker; `dev-mcp` (function, two tables, a key card, a brief under
`docs/dev-mcp/`); later, OAuth on the Worker.

## The plan

| PR | What | Touches |
|---|---|---|
| 1 · the Worker — **shipped v2.3633** | `scripts/cloudflare/mcp-router.worker.js`: `/twin` → the twin-mcp function, POST only (GET 405, as today), `X-Twin-Token` / `Authorization` / `Content-Type` / `Mcp-Protocol-Version` passed through, unknown paths 404, no secrets at the edge. `twin-setup` takes a `TWIN_MCP_PUBLIC_URL` that carries a path verbatim (a bare origin keeps today's behaviour). `DOMAIN_CUTOVER.md` and `EDGE_FUNCTIONS.md` lines. | Worker file, twin-setup, docs |
| — deploy | **Done 2026-09-20**: `npx -y wrangler@3 deploy --config scripts/cloudflare/mcp-router.wrangler.toml` after the owner's one `wrangler login` — `custom_domain` created the DNS record and certificate, so nothing was pasted in the dashboard (wrangler 4 needs Node 22; this Mac has 20.0). | Cloudflare |
| 2 · the flip — **shipped v2.3634** | After `initialize` answers at the new address: `twinMcpConnectorUrl` returns it, `.mcp.json`, `TWIN_HARNESS.md`, the secret set and `twin-setup` redeployed. The Supabase address keeps working, so no installed Desktop config breaks. | client kernel + test, config, docs |
| 3 · new keys carry a prefix | `ptt_` on keys minted by the Digital twins card and `twin-setup`; the Worker refuses a `ptd_` key at `/twin`. | panel, twin-setup, Worker |
| 4a · the money kernels move — **shipped v2.3638** | `billTruth.ts`, `customerProfileStats.ts`, `customersListLcv.ts`, `jobProfitSummary.ts`, `subLaborCost.ts` (+ `peopleLaborJobItemLineCost`) move to `supabase/functions/_shared/`; `src/lib/…` re-exports them, tests stay where they are. No behaviour change — a mechanical sweep that merges alone. | kernels, re-exports |
| 4b · dev-mcp, reads — **4b-1 shipped v2.3640** (server, keys, log, generic door, catalog); 4b-2 = resolvers, composites, `view_as` | The function, `dev_mcp_credentials` + `dev_mcp_calls` (migration; the three fence appliers), a dev-only key card, `/dev` on the Worker, the brief, the RPC / table catalog generated from `database.ts`. The verbs in *The verb list* below. | migration, function, settings card, Worker, docs |
| 5 · dev-mcp, health | `check_locks` (the monitoring schema the `/db-freeze` runbook reads), `check_migration_ledger`, `check_edge_boot`, `get_recent_errors`. | function |
| 6 · dev-mcp, writes | `plan_cost_batch` / `apply_cost_batch` / `revert_cost_batch` and `plan_hr_entry` / `apply_hr_entry` over the existing RPCs, as the existing roles; ZZ-fixture set-up and tear-down for live tests. Never DDL, deploys, sends or payments. | function |
| 7 · sign in instead of a key | MCP OAuth on the Worker: a person adds the address as a custom connector and signs in with their PipeTooling account; the Worker maps the person to a twin key or a dev key. Removes the Terminal command and Node from the Desktop path, works on web and mobile, and records WHO holds a seat (twin-mcp knows only the twin). | Worker, a small auth function |

## The verb list (decided 2026-09-20)

The owner's three calls: **dev-mcp reads as the dev**, not as the service role; **the generic
door and the first composites ship together**; **the audience is a dev's agent in Claude Code**
(it has the repo — so no `get_access`, no `get_release_note`).

**Reads as the dev.** A key maps to a person (`dev_mcp_credentials.user_id`, role dev). The
function mints that person's session itself — `auth.admin.generateLink` then verify, as
`dev-login` and `ct_finish_takeoff` already do — caches the access token for its life, and
calls the app's own API with it: **GET only**, which PostgREST runs in a read-only transaction,
so the database refuses a write whatever the RPC is called. RLS and every `auth.uid()` role
check apply exactly as on the screen. The database has 513 RPCs the screens already use; the
door reaches them instead of re-writing them.

| Verb | PR | What it is |
|---|---|---|
| `call_read(rpc, args)` | 4b | Any RPC, as the dev, over GET. Logged. |
| `read_rows(table, select, filters, order?, limit?)` | 4b | Any table or view, RLS-bound, GET; limit capped at 200. |
| `find_rpc(text)` · `get_table(name)` | 4b | The catalog: RPC names + args, table columns — generated from `src/types/database.ts` at build time, so the agent does not guess names. |
| `find_job` · `find_bid` · `find_customer` · `find_person` | 4b | Resolvers from "J1032" / "b482" / a name to the uuid: `search_jobs_ledger`, `search_bids_for_clock` (+ `bids.bid_number`), `customers.name ilike`, `users` by the active-roster rules. The J / b label rules come from `ledgerDisplayPrefixes.ts`. |
| `get_job(job)` | 4b | The Job window: the `jobs_ledger` row, `list_job_account_strip`, `get_stages_enrichment`, `list_job_stage_progress`, `get_man_hours_by_job`, the thread (`jobs_ledger_thread_notes`, `list_reports_for_job_ledger`, `job_status_events`), and the money from `buildJobProfitSummary` + `billTruth`. |
| `get_customer(customer)` | 4b | The hub: profile, invoices and payments, the feed's sources, and LCV / open balance / pays-in-N-days from `customerProfileStats` + `billTruth`. |
| `get_bid(bid)` | 4b | Header (`get_bids_by_ids`), count rows with their assignments, versions and sends, the submission ledger, `list_bid_job_account_strip`. **Totals are rows-as-stored**: the priced total lives in the `useBidPricingEngine` hook, not a kernel — lifting it is its own PR if the log shows it is wanted. |
| `view_as(role \| person, verb, args)` | 4b | Any read above as a sample account (`users.is_sample`, v2.3606) or a named person — the session minted the same way. Answers "what does a helper see here" with no browser. Dev keys only; logged with both identities. |
| `get_job_cost_trace` · `get_needs_you` · `get_whos_where` | later | Composites over client logic not yet in a kernel. Built when `dev_mcp_calls` shows the question being asked the long way. |
| `check_locks` · `check_migration_ledger` · `check_edge_boot` · `get_recent_errors` | 5 | The one place the service role is used: each is a named, fixed query — never a generic door at that privilege. |
| `plan_*` / `apply_*` / `revert_*` | 6 | Over `cost_batch_apply` / `cost_batch_revert` / `hr_agent_write` only. |

**Where the numbers come from** (mapped 2026-09-20): job header, stage, strip, hours and
activity are RPCs or plain rows; **job money, customer LCV and open balance are client
kernels** — small and nearly pure (`billTruth.ts` already imports two `_shared` kernels), which
is why PR 4a is a move rather than a rewrite. A composite that cannot reach the screen's own
kernel says so in its reply (`money: "rows only — kernel not lifted"`) rather than computing a
second opinion.

Worth doing first, outside this train: decompose `twin-mcp/index.ts` (one 3,357-line file —
a 48-tool array and one switch) so the JSON-RPC shell, key resolution and the call ledger
are shared code dev-mcp imports rather than copies.

## How to verify

- **PR 1 / the owner's step**: `curl -s -X POST https://mcp.clicktooling.com/twin -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'`
  answers `serverInfo.name = pipetooling-twin-mcp`; a GET answers 405; `/nope` answers 404;
  a `tools/call` with no key answers the function's own auth failure (proof the header path
  is the function's, not the Worker's).
- **PR 2**: Console → Copy Desktop kickoff and both setup commands carry the new address; a
  fresh Claude Code session in the repo lists the twin-mcp tools; **Set up on this Mac** on a
  test label redeems and `get_pricing_guide` answers through the new address. Revoke the label.
- **PR 4a**: every moved kernel's tests pass untouched; `git diff --stat` shows moves and one-line re-exports.
- **PR 4b**: `get_job` on a ZZ job matches the Job window's profit card to the cent; `call_read` on an RPC that writes is refused by the database (read-only transaction), not by the function; `view_as` a sample helper cannot read a job the helper's screen hides; every call is a row in `dev_mcp_calls`; a twin key at `/dev` and a dev key at `/twin` are both refused.
