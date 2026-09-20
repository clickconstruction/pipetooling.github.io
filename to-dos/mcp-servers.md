---
name: MCP servers — one address, a server for twins and a server for devs
group: ready
status: PRs 1–2 shipped 2026-09-20 (v2.3633 · v2.3634) — the address is live · left: key prefixes, dev-mcp, sign-in
summary: >
  The twins' MCP server moves behind one readable address (mcp.clicktooling.com/twin, a
  Cloudflare Worker in front of the twin-mcp function), and a second server, dev-mcp, gives a
  dev's agent fenced, audited reads of the app (and later the validated write entrypoints)
  instead of raw SQL or a signed-in browser. This file is the naming scheme's one home.
next: The owner trims the dev-mcp read-verb list; then PR 4 (PR 3, key prefixes, is an hour and can go any time).
size: L
blocker: A decision on the dev-mcp verb list before PR 4.
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
| 4 · dev-mcp, reads | The function, `dev_mcp_credentials` + `dev_mcp_calls` (migration; the three fence appliers), a dev-only key card, `/dev` on the Worker, the brief. Verbs below — reads only. | migration, function, settings card, docs |
| 5 · dev-mcp, health | `check_locks` (the monitoring schema the `/db-freeze` runbook reads), `check_migration_ledger`, `check_edge_boot`, `get_recent_errors`. | function |
| 6 · dev-mcp, writes | `plan_cost_batch` / `apply_cost_batch` / `revert_cost_batch` and `plan_hr_entry` / `apply_hr_entry` over the existing RPCs, as the existing roles; ZZ-fixture set-up and tear-down for live tests. Never DDL, deploys, sends or payments. | function |
| 7 · sign in instead of a key | MCP OAuth on the Worker: a person adds the address as a custom connector and signs in with their PipeTooling account; the Worker maps the person to a twin key or a dev key. Removes the Terminal command and Node from the Desktop path, works on web and mobile, and records WHO holds a seat (twin-mcp knows only the twin). | Worker, a small auth function |

Proposed read verbs for PR 4 (the owner trims this list before it is built): `find_job`,
`get_job` (what the Job window shows — stage, money, crew days), `get_job_cost_trace`,
`find_bid`, `get_bid`, `find_customer`, `get_customer` (the hub's LCV and feed), `find_person`,
`get_whos_where` (a day), `get_needs_you` (a role's queue), `get_release_note`,
`get_access` (what a role may open — from `layoutRouteAccess.ts`). Each answers from the same
kernel the screen uses, or it is not worth having over SQL.

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
- **PR 4**: a dev key reads `get_job` on a ZZ job and the row appears in `dev_mcp_calls`; a
  twin key at `/dev` and a dev key at `/twin` are both refused.
