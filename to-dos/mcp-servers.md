---
name: MCP servers — one address, a server for twins and a server for devs
number: 27
group: gated
status: PRs 1, 2, 3, 4a, 4b, 5, 6 shipped 2026-09-20 (v2.3633 · v2.3634 · v2.3638 · v2.3640 · v2.3643 · v2.3645 · v2.3646 · v2.3648 · v2.3649) — the address is live and dev-mcp reads, keyed path verified live · PRs 3 and 5 are deployed (2026-09-20: `twin-setup`, the Worker, the health migration, `dev-mcp` 0.3.0) · live-checked 2026-09-20 (a card-issued twin key starts `ptt_`; every `check_*` verb answered on prod with a dev key, which found and fixed `check_edge_boot`'s rate-limit bug, v2.3654) · picked **Do** on the board 2026-09-21, both owner calls taken (HR through a dry-run wrapper); the PR 7 spike is done and Path 0 confirmed, the dev half of it shipped v2.3686 · the twin card's *Add to Claude* steps shipped v2.3721 (2026-09-22; the same day's v2.3716 fixed a v2.3634 regression that had crashed Robots → Console) · PR 6 (the write verbs; one migration) shipped v2.3722, deployed and live-checked 2026-09-22 (ledger 643/643; the run found a double-apply hole, closed the same day in v2.3730 — one apply per plan; `dev-mcp` 0.4.1 live) · the owed kickoff sentence shipped v2.3803 (2026-09-24: both Desktop kickoffs open with the no-Terminal way and say the Terminal command is for accounts without *Request headers*; `twin-setup` redeployed — `npm run check:edge-drift` 2026-09-29 reads every function deployed and current) · nothing on the Worker, either server or the two key cards has changed since 2026-09-25 (re-checked 2026-09-29) · the twin-key checks ran 2026-11-08 (the owner issued and redeemed; an agent read only the key's prefix) · the bid train (the seat changes a bid and fills in its counts, takeoff, labor and prices) mapped 2026-11-11, six pairs in order, section below; its PR 1 (`plan_bid_update`) built v2.6945 · left: the bid train's pairs 2 to 5 on the owner's go, PR 7 only when sign-in is needed, composites the log asks for
summary: >
  The twins' MCP server moves behind one readable address (mcp.clicktooling.com/twin, a
  Cloudflare Worker in front of the twin-mcp function), and a second server, dev-mcp, gives a
  dev's agent fenced, audited reads of the app (and later the validated write entrypoints)
  instead of raw SQL or a signed-in browser. This file is the handoff: the naming scheme, what
  is built and live, and a build brief for each remaining PR.
next: Nothing is owed on the code. The twin-key checks ran 2026-11-08 with the owner's hands on the key (PR 3 below): `get_brief` answered on a `ptt_` key and `twin-setup` redeem minted one; the old-bare-key check was not run, since no pre-prefix key is in anyone's hands, and the Worker's passthrough of a bare key was read instead. The `twin-setup` redeploy after v2.3803 is done (`check:edge-drift` 2026-09-29: all 125 functions current), so a redeemed kickoff carries the no-Terminal way. PR 7 (sign in instead of a key) only when someone needs to know WHO holds a twin seat; it starts with the owner's `wrangler kv namespace create`. The composites (`get_job_cost_trace` · `get_needs_you` · `get_whos_where`) when `dev_mcp_calls` shows the question asked the long way. Note for the next session: `dev-mcp` answering *Unknown or revoked dev key* has twice (2026-09-21, 09-24) meant `PT_DEV_MCP_TOKEN` was not in the shell that launched Claude — check the variable before asking for a key.
size: L
blocker: None open on the built PRs. PR 7 — a KV namespace on the Cloudflare account (the owner's `wrangler kv namespace create`). The twin-key checks ran 2026-11-08; only the old-bare-key one is unrun, for want of an old key.
opinion: build — the hard part (the address, the server, the door, the keyed path verified live) is done; both calls are taken, and 7 is the one that changes who can use it.
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

## Where it plugs in (as built, 2026-09-20)

| Piece | Where | Note |
|---|---|---|
| The public address | `scripts/cloudflare/mcp-router.worker.js` + `mcp-router.wrangler.toml` | A secret-less pass-through: `/twin` → `twin-mcp`, `/dev` → `dev-mcp`, a request-header allowlist, unknown paths 404. **Deploys from the repo** (`npx -y wrangler@3 deploy --config …`) — unlike the two older Workers, which are dashboard-edited. |
| The twins' server | `supabase/functions/twin-mcp/index.ts` (one ~3,400-line file, 48 verbs, its own inline JSON-RPC shell) | Verb reference: `docs/EDGE_FUNCTIONS.md` → twin-mcp. `TWIN_MCP_PUBLIC_URL` (secret, on `twin-setup`) and the client constant of the same name in `src/lib/bids/desktopKickoff.ts` both hold the public address. |
| The devs' server | `supabase/functions/dev-mcp/index.ts` — `resolveDev` → `runVerb(identity, lazy session, verb, args)`; `view_as` wraps `runVerb` with another identity | Brief: `docs/dev-mcp/README.md`. Reads **as the dev**, GET-only. 71 verbs at 0.24.0 (forty-three plan → apply writes; the README's verb table lists them). |
| The shared JSON-RPC shell | `_shared/mcpJsonRpc.ts` | dev-mcp uses it; twin-mcp still carries its inline copy. |
| The door's rules (pure) | `_shared/devMcpDoor.ts` — catalog-checked names, `DENIED_TABLES` (also through embeds), secret-key redaction, query and reply caps | Tests `src/lib/devMcp/devMcpDoor.test.ts`. |
| The named verbs (pure, `Reader`-injected) | `_shared/devMcpComposites.ts` | Tests `src/lib/devMcp/devMcpComposites.test.ts` — the fake reader **enforces the generated catalog**, so a guessed column fails in CI, not live. |
| The catalog | `supabase/functions/dev-mcp/catalog.ts` — **generated** by `node scripts/build-dev-mcp-catalog.mjs` from `src/types/database.ts` | `devMcpCatalog.test.ts` fails CI when stale. After every `gen-types`: regenerate, then redeploy `dev-mcp`. |
| Keys and the log | `dev_mcp_credentials`, `dev_mcp_calls` (migration `20260920063130`); card `src/components/settings/DevMcpKeysCard.tsx` on Settings → Your account (`/settings#settings-dev-mcp-keys`) | A dev issues only their own keys (`ptd_…`, sha256 stored). |
| The screens' money kernels | `_shared/`: `billTruth`, `customerProfileStats`, `customersListLcv`, `jobProfitSummary`, `subLaborCost`, `peopleLaborJobItemLineCost`, `jobMaterialsCostLines`, `jobSubLaborInputs`, `cardChargeAllocationFilter`, `mercuryRawDebitCard` | Each old `src/lib/…` path is a three-line `export *` stub, so importers and tests did not move. |
| Client config | `.mcp.json` — `twin-mcp` (`${TWIN_ESTIMATOR_1_TOKEN}`) and `dev-mcp` (`${PT_DEV_MCP_TOKEN}`) | MCP servers connect at session start: the variable must be in the shell profile before Claude Code launches. |

## The plan

| PR | What | Touches |
|---|---|---|
| 1 · the Worker — **shipped v2.3633** | `scripts/cloudflare/mcp-router.worker.js`: `/twin` → the twin-mcp function, POST only (GET 405, as today), `X-Twin-Token` / `Authorization` / `Content-Type` / `Mcp-Protocol-Version` passed through, unknown paths 404, no secrets at the edge. `twin-setup` takes a `TWIN_MCP_PUBLIC_URL` that carries a path verbatim (a bare origin keeps today's behaviour). `DOMAIN_CUTOVER.md` and `EDGE_FUNCTIONS.md` lines. | Worker file, twin-setup, docs |
| — deploy | **Done 2026-09-20**: `npx -y wrangler@3 deploy --config scripts/cloudflare/mcp-router.wrangler.toml` after the owner's one `wrangler login` — `custom_domain` created the DNS record and certificate, so nothing was pasted in the dashboard (wrangler 4 needs Node 22; this Mac has 20.0). | Cloudflare |
| 2 · the flip — **shipped v2.3634**; **regression fixed v2.3716** | After `initialize` answers at the new address: `twinMcpConnectorUrl` returns it, `.mcp.json`, `TWIN_HARNESS.md`, the secret set and `twin-setup` redeployed. The Supabase address keeps working, so no installed Desktop config breaks. **What the flip missed** (found 2026-09-22 by a render test): both Desktop setup-command builders still refused any address but `…/functions/v1/twin-mcp`, so Robots → Console crashed on render and *Set up on this Mac* threw for two days — `isTwinMcpConnectorUrl` now accepts both shapes, and the test calls the builders with `TWIN_MCP_PUBLIC_URL` itself. | client kernel + test, config, docs |
| 3 · new keys carry a prefix — **shipped v2.3648** (deploys + live check owed) | `ptt_` on keys minted by the Digital twins card and `twin-setup`; the Worker refuses a `ptd_` key at `/twin` and a `ptt_` key at `/dev`. **Brief below.** | panel, twin-setup, Worker |
| 4a · the money kernels move — **shipped v2.3638** | `billTruth.ts`, `customerProfileStats.ts`, `customersListLcv.ts`, `jobProfitSummary.ts`, `subLaborCost.ts` (+ `peopleLaborJobItemLineCost`) move to `supabase/functions/_shared/`; `src/lib/…` re-exports them, tests stay where they are. No behaviour change — a mechanical sweep that merges alone. | kernels, re-exports |
| 4b · dev-mcp, reads — **4b-1 shipped v2.3640** (server, keys, log, generic door, catalog); **4b-2 shipped v2.3645 + v2.3646** (the parts-cost lift; resolvers, `get_job` / `get_customer` / `get_bid`, `view_as`) | The function, `dev_mcp_credentials` + `dev_mcp_calls` (migration; the three fence appliers), a dev-only key card, `/dev` on the Worker, the brief, the RPC / table catalog generated from `database.ts`. The verbs in *The verb list* below. | migration, function, settings card, Worker, docs |
| 5 · dev-mcp, health — **shipped v2.3649**, live-checked 2026-09-20 (+ v2.3654 the edge-boot batches) | `check_locks`, `check_sampler`, `check_connections`, `check_migration_ledger`, `check_edge_boot` — over new dev-gated definer RPCs, because `monitoring.*` is not reachable through the API; `get_recent_errors` dropped. **Brief below.** | migration, function, catalog script |
| 6 · dev-mcp, writes — **shipped v2.3722** + v2.3730, deployed and live-checked 2026-09-22 | `plan_cost_batch` / `apply_cost_batch` / `revert_cost_batch` over the existing dev-gated RPCs, as the dev; and — **decided 2026-09-21** — `plan_hr_entry` / `apply_hr_entry` over a new dev-gated dry-run wrapper. Never DDL, deploys, sends or payments. **Brief below.** | function, one migration (the HR wrapper) |
| 7 · sign in instead of a key (**spike done 2026-09-21 — Shape 1, the Worker as the OAuth server; brief and answer below; Path 0 may make it unnecessary for a while**) | MCP OAuth on the Worker: a person adds the address as a custom connector and signs in with their PipeTooling account; the Worker maps the person to a twin key or a dev key. Removes the Terminal command and Node from the Desktop path, works on web and mobile, and records WHO holds a seat (twin-mcp knows only the twin). | Worker, a small auth function |

## Picking this up

Everything in the plan table above marked **shipped** is live in prod and was verified there the day it shipped (PR 3's and PR 5's deploys landed 2026-09-20). What is left is the three owed twin-key checks and two PRs, each briefed below so it can be built cold (both cards' *Add to Claude* steps shipped: the dev card v2.3686, the twin card v2.3721). Read these first:

- `docs/dev-mcp/README.md` (what the dev server is and refuses) and `docs/EDGE_FUNCTIONS.md` → dev-mcp / twin-mcp / twin-setup / twin-login.
- `CLAUDE.md` — migrations only by `supabase db push` after merge; one PR → auto-merge; claim the version (`npm run claim`), never derive it; release note + fragment + the specialist docs ship with the PR.

**Things that cost time on 2026-09-20 — do not rediscover them:**

- **No `deno` on the owner's Mac.** To check an edge function before deploying: `npx esbuild supabase/functions/<fn>/index.ts --bundle --format=esm --platform=neutral '--external:https://*' --outfile=/tmp/x.js` (syntax + imports), and `tsc` with a three-line shim declaring `Deno` and the two `https://` modules (the only noise is the untyped `createClient` resolving to `never`). The real proof is the live recipe after deploy.
- **Wrangler 4 needs Node 22; the Mac has Node 20.0** — use `npx -y wrangler@3 …`. The owner's `wrangler login` persists on that machine.
- **A worktree is not linked to Supabase**: copy `supabase/.temp/project-ref` and `pooler-url` from the main checkout. An agent session may be refused `supabase db push` by its permission layer — hand the owner the command (one line), do not look for another route.
- **Deploy only from a tree that contains the merged commit** — `git fetch` first; `git diff --quiet origin/main -- supabase/functions/<fn> <its _shared imports>` before `supabase functions deploy`.
- **A PR in the merge queue rejects pushes to its branch** — a late commit goes in the next PR. `npm run claim` run twice claims two numbers — release the spare (`npm run claim -- --release v2.NNNN`).
- **Before `git mv` into `_shared/`, check the destination.** `_shared/ledgerDisplayPrefixes.ts` already exists as a *smaller mirror* of `src/lib/ledgerDisplayPrefixes.ts`; others may. Chain with `&&` so a failed move cannot be followed by an overwrite.
- **Probing the live server without showing the key**: `zsh -c 'source ~/.zshrc; curl -s -X POST https://mcp.clicktooling.com/dev -H "content-type: application/json" -H "X-Dev-Token: $PT_DEV_MCP_TOKEN" -d "…"'`. An agent must not issue a key or read one — the owner issues on the card.
- **Proving "the database refuses writes"** needs an RPC that writes *unconditionally*: `call_read { rpc: 'bump_user_app_activity', args: { p_seconds: 0 } }` → `cannot execute INSERT in a read-only transaction` (harmless if it ever succeeded — it is the app's own once-a-minute ping). RPCs that validate input or permissions first bail before their INSERT and prove nothing.
- **This worktree's `node_modules` was stale** (no `pdf-lib`, `qrcode.react`, `pdfjs-dist`) and has no `.env`: ~18 unrelated test *files* fail to load and `typecheck` shows ~44 unrelated errors. They fail identically on main there. Filter to your files; CI is the real run.
- **ZZ fixtures that exist in prod**: job **JP1032** "ZZ TEST GC Notice Job" (`0e4dcd2b-a524-4056-b93c-16713041a6e7`; revenue $1,200, a $1 payment, two $10 sub-labor sheets → `get_job` profit $1,180), its customer "ZZ TEST Owner On Notice" (`92adb464-3ce8-4e3d-b57e-0b98b9045229`), bid **b398** "ZZ Test". `view_as` reads as a role's sample account (`sample-<role>@samples.pipetooling.local`, `users.is_sample`); the **helpers** one exists and was used — a role with none answers with where to create it (Settings → People & teams → Active accounts).
- **Verified 2026-09-21 evening, with the owner's fresh dev key in `~/.zshrc` (the earlier "revoked" reading was wrong — the line had never been there; v2.3686's setup command fixes that for the next person)**: `whoami` answers Robert · dev; `check_edge_boot` in three batches a minute apart — 50, 50, 23 of 123, every function boots, nothing rate-limited (the v2.3654 fix holds live); a `ptt_`-shaped key at `/dev` and a `ptd_`-shaped key at `/twin` answer the Worker's own 401 sentence before any fetch; a bare made-up key at `/dev` passes the Worker and gets the function's *Auth failed: Unknown or revoked dev key* as a tool result. **Path 0 confirmed**: the owner's claude.ai account shows *Request headers* and a connector named `clicktooling_dev` at `/dev` connected with `authorization: Bearer ptd_…`.
- **Connector icon**: claude.ai shows every custom connector with its generic tile — it does not read `serverInfo.icons` (MCP 2025-11-25) nor fetch a favicon from the server origin (anthropics/claude-ai-mcp#152, open). Sending `icons` from both servers anyway is a two-line change in `_shared/mcpJsonRpc.ts` + twin-mcp's inline `initialize`, plus two redeploys; worth doing the day Claude honours it, not before.
- **Verified 2026-09-22**: `get_job` on JP1032 answers profit $1,180 — the Job window's figure.

### PR 3 — new twin keys carry a prefix (**shipped v2.3648** — deploys and the live check owed)

Built as briefed: `ptt_` + hex from `formatTwinMcpKey` (`_shared/mcpKeyPrefixes.ts`, the one home of both prefixes) in the Digital twins card's `issueToken` and `twin-setup`'s `redeem`; the Worker answers a `ptd_` key at `/twin` and a `ptt_` key at `/dev` with a 401 sentence before the fetch. The Worker deploys as one file, so it carries a copy of the rule — `src/lib/mcpRouterWorker.test.ts` runs the Worker against a stubbed upstream and pins its sentence to the kernel's; change both together.

- **Deployed 2026-09-20**: `twin-setup` and the Worker. Probed live with made-up keys: a `ptd_` key at `/twin` and a `ptt_` key at `/dev` answer the Worker's 401 sentence (header and bearer); a bare key and the audience's own prefix pass through to the function's `Auth failed:`; `initialize` still answers.
- **Verified 2026-09-20 (the card)**: a key issued on Settings → Digital twins started `ptt_` (revoked straight after). **Run 2026-11-08** with the owner at the keyboard and the agent reading only a key's first letters: `get_brief` answered on a `ptt_` key the owner issued from the card (label *test*); `twin-setup` redeem on a code the dialog minted (label *ptt check*, redeemed with curl so the setup command's Desktop restart never ran) answered a token starting `ptt_`; a made-up `ptd_` key at `/twin` and a made-up `ptt_` key at `/dev` each got the Worker's own 401 sentence, and a made-up bare key passed through the Worker to the function. Both keys were revoked after. **Not run**: an old bare key still answers — no pre-prefix key is in anyone's hands, and the Worker's passthrough is the half that could be read without one.

### PR 5 — health checks (**shipped v2.3649** — the push, the deploy and the live check owed)

Built as briefed, with two choices worth knowing. **The named verbs do not go through the catalog**: `HEALTH_RPCS` in `_shared/devMcpHealth.ts` fixes the four RPC names, so `check_*` answers the moment the migration is pushed and `dev-mcp` deployed; only `find_rpc` / `call_read` wait for the types + catalog PR. **`EDGE_FUNCTIONS` is generated into `catalog.ts`**, so a PR that adds, renames or removes an edge function re-runs `node scripts/build-dev-mcp-catalog.mjs` (the catalog test fails CI with that command otherwise). The RPCs were run before merge on a throwaway Postgres 15 with stub `monitoring` tables — see `docs/migrations/20260920232141_dev_health_rpcs.md`. `get_recent_errors` stays dropped (it would need a Management API token this server should not hold).

- **Deployed 2026-09-20**: the migration (ledger 624 / 624), `dev-mcp` 0.3.0 (`tools/list` carries the five verbs), the types + catalog PR; one more `dev-mcp` deploy follows that PR so `find_rpc` lists the four RPCs.
- **Verified live 2026-09-20** (a dev key the owner issued for the check and revoked after): `check_sampler` — 1,440 samples, no gaps over 90 s in 24 h, slowest 193 ms; `check_connections` — 27 of 160; `check_locks` — no waits, and **`client_backends: 16`**, so the definer does read other roles' backends in full; `check_migration_ledger` — 624 applied, newest `20260921010003`; `view_as { role: 'helpers', verb: 'check_locks' }` → `403 (42501): dev_health_locks: devs only`, refused by the database; `find_rpc` / `call_read` reach the new RPCs after the catalog redeploy; `get_job` on JP1032 → profit $1,180. **What the live run found**: `check_edge_boot` probed all 123 in one call and the platform refused the last 63 — *Rate limit exceeded for function*, about 60 function-to-function calls a minute — which the report mislabelled "no answer in time". Fixed in v2.3654: 50 per call with an `after` cursor, and a refused probe is `rate_limited`, never a dead function. **Owed**: one pass of the batched verb after the 0.3.1 deploy (three calls, a minute apart).

### PR 6 — writes through the existing entrypoints (M, **shipped v2.3722 + v2.3730** — deployed, live-checked)

Built as briefed, with one choice worth knowing. **The plan hash is not looked up in the log**: `apply_` re-runs the dry run and hashes it the same way as `plan_` did (`_shared/devMcpWrites.ts` — sha256 over the canonical payload plus what the plan committed to: for a cost batch the op count, the money by job and each op's seq, kind and **before** image; never the after images, which carry the dry run's own ids and timestamps). So the hash matches only when the agent applies the payload it planned against rows that still answer the same — no table, no clock, no ten-minute window, and a world that moved under the plan is caught, which a log lookup would not do. `revert_` needs a reason in words. The HR wrapper (`dev_hr_entry_write`, migration `20260922102017`) calls the **live** `hr_agent_write` unchanged and overwrites `author_label` with the dev's name. Tests: `src/lib/devMcp/devMcpWrites.test.ts` (the allowlist against both migrations, the shapes, the hash's stability and sensitivity, and that `restPost` is reached from the write branch alone). **Deployed 2026-09-22**: the migration (ledger 643 / 643), `dev-mcp` 0.4.0 (`tools/list` at the public address carries the five verbs; a made-up key gets *Unknown or revoked dev key*), the types + catalog PR (one more `dev-mcp` deploy follows it so `find_rpc` lists the wrapper). **Verified live 2026-09-22** (a temporary dev key the owner issued for it, revoked after): `whoami` names the five verbs; `plan_cost_batch` (one `thread_note` on JP1032) → `dry_run: true`, `op_count 1`, a hash; apply with a wrong hash and apply with a changed label → *Nothing written*; apply with the right hash → a `cost_batches` row whose `author_user_id` is the dev; `revert_cost_batch` with a reason → reverted (`reverted_at` set, no note left on the job); `view_as { role: 'helpers' }` on `plan_cost_batch` and `apply_hr_entry` → *view_as never writes*; `plan_hr_entry` on an unknown person → the wrapper's own *not found*; `apply_hr_entry` without a hash → refused; after the catalog PR, `find_rpc` lists `dev_hr_entry_write`. **What the live run found**: the same plan applied twice with the same hash landed twice — a thread note has no before-state, so the re-run hashes the same. Closed in v2.3730 (`dev-mcp` 0.4.1, deployed and re-checked the same day: the second apply answers *already applied as batch … at …*; revert, and the same plan applies again; one apply per plan, from the call log).

The brief as written before the build:

The door is GET-only by construction; writes are a **second, separate path**: `restPost(jwt, 'rpc/<name>', body)` that accepts **only names in a hard-coded allowlist** — never a generic POST, never a table write.

- **Cost batches — ready to build.** `cost_batch_apply(jsonb, boolean)` and `cost_batch_revert(uuid, text)` are `SECURITY DEFINER`, EXECUTE to `authenticated`, gated `is_dev()` inside (`docs/COST_BATCHES.md`, `ACCESS_CONTROL.md`), so the dev's own session may call them and the audit rows name the dev. Verbs: `plan_cost_batch(batch)` → apply with `dry_run = true`, returning the plan; `apply_cost_batch(batch, plan_hash)` → refuses unless `plan_hash` is the sha256 of a plan this key was shown in the last 10 minutes (keep the hash in `dev_mcp_calls.args` of the plan call and look it up — no new table); `revert_cost_batch(batch_id, reason)`. `view_as` must refuse every write verb. Log `status`, the batch id as `target`.
- **HR entries — decided 2026-09-21: (b), a dry-run wrapper.** `hr_agent_write(jsonb)` has EXECUTE **revoked from `authenticated`** and granted only to the `hr_agent` database role (migration `20260824141540`), and it has no dry-run. So PR 6 carries one migration: a `SECURITY DEFINER` wrapper gated `is_dev()` inside, with a `p_dry_run` argument that validates and returns what would be filed without writing, and then `plan_hr_entry` / `apply_hr_entry` like the cost pair — the same plan-hash rule, the same `view_as` refusal, the dev named in the audit row. The `hr_agent` psql contract in `docs/HR_FILES.md` stays as it is; the wrapper is a second door, not a replacement. (Rejected: (a) leaving HR off the server — the owner wants one door for an agent's writes.)
- **ZZ fixtures**: no set-up / tear-down RPC exists; fixtures have been made by hand in the app (list above). Building one is its own to-do — do not smuggle table writes into this server for it.
- Never: DDL, deploys, sends, payments, anything a customer or vendor sees.
- **Verify**: on the ZZ job — plan → the plan; apply with a wrong hash → refused; apply with the right hash → a `cost_batches` row whose actor is the dev; revert → reverted; the same verbs through `view_as` → refused; a training-mode (`read_only`) dev → refused by the database.

### PR 7 — sign in instead of a key (L, **starts with a one-day spike**)

**Why it matters most**: Claude Desktop's and claude.ai's *Add custom connector* take a URL and OAuth only — no headers. That is why Desktop needs the `mcp-remote` bridge, Node and a Terminal command today, and why nothing works on web or mobile. With OAuth, a person adds `https://mcp.clicktooling.com/twin` (or `/dev`), signs in with their PipeTooling account, and is done; the server finally knows **who** holds a twin seat (today a key identifies the twin, never the person).

What the MCP authorization spec (2025-06-18) asks of the resource: a `401` with `WWW-Authenticate` pointing at `/.well-known/oauth-protected-resource` (RFC 9728), an authorization server with metadata (RFC 8414), PKCE, and — for clients like Claude that self-register — dynamic client registration (RFC 7591).

- **The spike (2026-09-21) — read this before building.** Research only (Claude's connector docs, Supabase's OAuth 2.1 server docs and its open discussions, Cloudflare's `workers-oauth-provider` README, this repo's Worker and both functions); no prototype, because the one thing a prototype would add — the library's loopback handling — is a five-minute check at the top of the build. Three findings changed the picture:

  **Path 0 — no OAuth at all, maybe today.** Claude's custom-connector dialog has a **Request headers** option (beta, "available to a limited set of organizations"): whoever adds the connector enters a fixed header once — `authorization` is on the no-review list — and Claude sends it on every request from **claude.ai web, Desktop, mobile and Cowork**. Both servers already accept `Authorization: Bearer <key>` and the Worker already passes `authorization` through, so a person adds `https://mcp.clicktooling.com/twin` (or `/dev`), picks *No sign-in*, enters `Bearer ptt_…` under Request headers, and is done: no `mcp-remote`, no Node, no Terminal, and it works on a phone. What it does not do: say WHO holds the seat (the key still identifies the twin), and the header is per connector (on Team/Enterprise the org admin enters it; on Pro/Max the person does). **The owner's check**: open *Customize → Connectors → Add custom connector* and look for **Request headers**. It is there (confirmed 2026-09-21), and Path 0 shipped as two small PRs — the Dev MCP keys card v2.3686 and the Digital twins card v2.3721 gain *Add to Claude* (the address, the header name, the value to paste, the three clicks); the kickoff text (`docs/twins/kickoffs/desktop-operator.md`, regenerated into `twin-setup`) still owes the sentence that the Desktop command is only for machines without the beta, and goes with the next `twin-setup` redeploy — and PR 7 waits until someone actually needs sign-in.

  **The shape for PR 7: Shape 1, the Worker as the authorization server** (`@cloudflare/workers-oauth-provider`). Not Shape 2, for four reasons:
  1. *A Supabase-issued token is a session.* Supabase's OAuth 2.1 server (beta on every plan, no charge) issues the user's own JWT (`user_id`, `role`, `client_id` claims). A leaked connector token would be a full app session against PostgREST, not a token for one GET-only door. With Shape 1 a leaked token reaches the Worker only, and the Worker holds a `ptd_`/`ptt_` key it can revoke.
  2. *Twins are not people.* A twin seat is its own `users` row (`is_digital_twin`, `role = 'estimator'`, the `twin-login` guards). A person signing in with Supabase would hold a token for themselves, and the consent step would still have to mint a twin key for the seat they picked — which is exactly the mapping Shape 1 does for both audiences with one mechanism.
  3. *Claude's client identity.* Claude's recommended identity is CIMD (*Use Claude's published identity*); Supabase does not support CIMD (the discussion is unanswered), so Claude would fall back to DCR, which registers a new OAuth app in the dashboard on every fresh connection. Supabase also matches redirect URIs on the exact port, and Claude Code redirects to an ephemeral loopback port — Claude Code could not sign in through Shape 2 at all (keys would remain its only path). The Cloudflare library supports CIMD, DCR and S256 PKCE.
  4. *Nothing in the functions changes.* Shape 1 injects `Authorization: Bearer <key>` upstream from the grant's `props`; `twin-mcp` and `dev-mcp` never learn OAuth exists. Shape 2 rewrites both functions' auth.

  What Shape 1 costs: the Worker stops being secret-less (a KV namespace `OAUTH_KV` for grants and tokens, one Worker secret shared with a small edge function), and a consent page in the app. The build, three PRs:
  - **7a · the Worker** — `OAuthProvider` per resource (`/twin`, `/dev`, each with `resourceMetadata.resource` = its full address; two instances, or `OAuthAuthorizationServer` for both), protected-resource metadata at `/.well-known/oauth-protected-resource/twin` and `/dev`, the AS metadata advertising `code_challenge_methods_supported: ["S256"]`, `client_id_metadata_document_supported: true` and `none` in `token_endpoint_auth_methods_supported` (Claude picks CIMD only when both are present), DCR on as the fallback. **The bearer rule**: a bearer that starts `ptt_`/`ptd_` (or `X-Twin-Token`/`X-Dev-Token`) passes through exactly as today — keys keep working for Claude Code and scripts; any other bearer is an OAuth token the library validates, and the API handler sets `Authorization: Bearer <ctx.props.key>` upstream; no credential at all answers **401** with `WWW-Authenticate: Bearer resource_metadata="…"` (Claude does not honour the header on a 200 — today the functions answer a bad key as a tool result, which is why nothing triggers). `/authorize` parses the request (`parseAuthRequest`), stores it in KV under a nonce, and redirects to `https://clicktooling.com/connect-agent?req=<nonce>`. A `/authorize/complete` endpoint, callable only with the shared secret, takes `{nonce, userId, key, seat}` and returns `completeAuthorization`'s redirect URL. First hour of the build: confirm the library accepts Claude Code's `http://localhost/callback` and `http://127.0.0.1/callback` with the port ignored (Claude's CIMD declares them so); if it does not, the `/authorize` handler normalises the loopback port before `parseAuthRequest`. `wrangler kv namespace create` is the owner's step (an account change); the deploy stays `npx -y wrangler@3 deploy --config …`.
  - **7b · `mcp-connect` + `/connect-agent`** — an in-app page (signed in, or sign in first) that shows the client name and redirect host from the parked request, the seats this person may take (*dev — as me* when `role = dev`; the twins they may operate, under the same estimator-only mint gate as `twin-setup`), and Approve / Deny. Approve calls the `mcp-connect` function with the person's session and the seat; the function checks the seat, mints a `ptd_` row in `dev_mcp_credentials` (label *Claude connector · <client>*) or a `ptt_` row through `twin-setup`'s mint path, calls the Worker's `/authorize/complete` with the secret, and returns the redirect. The consent screen shows the redirect URI's host in plain words, with the extra warning the spec asks for when it is a loopback address.
  - **7c · revoke and docs** — the Settings cards list connector-minted keys with the client name; revoking the key revokes the seat (the Worker's grant dies at its next upstream call: a revoked key answers *Unknown or revoked* and the handler turns that into a 401 so Claude re-prompts). `revokeGrant` from the card is a later nicety. `EDGE_FUNCTIONS.md` (mcp-connect), `DOMAIN_CUTOVER.md`, the twins glossary, this file.
- Either way: keys keep working (Claude Code and scripts use them); the pricer-only rule for estimators (`twin-setup`'s mint gate) must hold in the consent step; revoking is per grant and visible on the same Settings cards.
- **Verify**: claude.ai → Add custom connector → the URL → sign in → `whoami` / `get_brief` answers with no key anywhere; Desktop the same with no Terminal; a revoked grant stops answering; an estimator is offered the pricer seat only; an `mcp-remote` + key config from before still works.

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
| `check_locks` · `check_sampler` · `check_connections` · `check_migration_ledger` · `check_edge_boot` | 5 — shipped | Dev-gated definer RPCs read through the same door as the dev — no service role after all (brief above). |
| `plan_*` / `apply_*` / `revert_*` | 6 — shipped | Over `cost_batch_apply` / `cost_batch_revert`; HR through `dev_hr_entry_write`, the dry-run wrapper (brief above). Apply re-runs the dry run and matches the plan's hash. |
| `plan_job` / `apply_job` | v2.6790 — shipped | A job as the New Job form makes it: one `jobs_ledger` row under RLS as the dev, the customer's email and phone filled in, the kind after; the dry run is the server's read of the customer, the service type and the owner rule (`_shared/devMcpJobs.ts`). PR 1 of punch list #293 (`to-dos/dev-seat-job-and-bill-verbs.md`): PR 2 updates a job and moves its status, PR 3 bills it and hands the customer the link. |
| `plan_job_update` / `apply_job_update` | v2.6793 — shipped | A job changed as Edit Job and the Pipeline change it: the form's columns as one PATCH under RLS, each shown before → after; the status through `update_job_status` one neighbour at a time. PR 2 of punch list #293. |
| `plan_bill` / `apply_bill` | v2.6794 — shipped | A bill as Bill Customer and the share row make and hand it over: the primary Ready to Bill row, `create-stripe-invoice` as the dev with an explicit mode, the pay code, the job to Billed, the Billed line through `quo-send` and the draft through `messages-email`, each step's outcome named; `action: send` for a bill that exists. PR 3 of punch list #293. |
| `plan_collections_flag` / `apply_collections_flag` · `plan_contract_ended` / `apply_contract_ended` | v2.6795 — shipped | A Billed job into Collections with a note or back, through the Job window's own `set_job_collections_flag`; the end of our contract on a job as the Lien contract row saves it (the day, how, the retainage held, the payment bond; or cleared). PR 4 of punch list #293, the owner's ask relayed 2026-11-09. |
| `plan_property_record` / `apply_property_record` | v2.6950 — shipped | A property record's lien facts as the Property record row saves them: the county, the legal description, the kind, the homestead answer, the owner of record and where the owner's mail goes, by a job or by the record, with every job that follows named in the plan. The first of the Lien desk's verbs (the owner's ask of 2026-11-11); the desk's items, filings and papers follow, a PR each. |
| `plan_job_payment` / `apply_job_payment` · `plan_job_combine` / `apply_job_combine` | v2.6940 — shipped | A payment on a job removed through the Job window's own remove RPC with the reason left on the job's activity, recorded as the payments table writes it, or tied to its bank row as Accounts Receivable links it; one job combined into another through Pipeline's own `migrate_job_ledger_costs_and_delete`, its plan listing what moves and every reason it would stop, its apply behind `confirm_no_undo: true`. The owner's ask of 2026-11-11. Still the screens' alone: moving a payment between jobs, a deposit applied from Accounts Receivable, a bill voided, a job separated. |
| `plan_bid` / `apply_bid` | v2.6183 — shipped | A new bid as the New Bid form makes it, through `dev_bid_write` (action `create`), numbered by the database. PR 1 of the owner's 2026-10-30 ask (a dev's agent sets a bid up for the robots); `plan_file_plans` / `apply_file_plans` (the plan set into Drive and onto the bid) and `mint_twin_setup_code` follow. |
| `plan_bid_update` / `apply_bid_update` | v2.6945 — shipped | A bid changed as Edit Bid and the Bid Board change it: the form's columns as one PATCH under RLS, each shown before → after, with the decided day (`outcome_at`), the sent date as Mark sent lands it and the outcome line the form leaves; a bid with versions keeps Sent and Won / Lost per GC. PR 1 of the bid train (the section below): counts, takeoff, labor and prices follow. |
| `plan_file_plans` / `apply_file_plans` | v2.6185 — shipped | The plan set into Drive (since v2.6241 the PipeTooling Jobs Shared Drive, Bid plans › <Division> › <project>) and onto the bid as the set the robot reads (`dev_bid_write`, action `file_plans`), from a one-shot upload URL the plan hands back; the apply checks size, sha256, PDF and 200 pages, probes at the end. Drive is the only place the plans stay. |
| `read_on_site` · `plan_container` / `apply_container` · `plan_delivery` / `apply_delivery` · `plan_movement` / `apply_movement` · `plan_count` / `apply_count` | v2.6367 — shipped | Materials on site (punch list #209): the job's boxes and lines through the screens' own kernel, and the four presses — a cage or box (add, move, retire an empty one, bring a retired one back), a delivery into Unsorted or a box, one press on a line, a count of a box — through `dev_on_site_write`, the one `SECURITY INVOKER` wrapper (the rows land under the dev's own RLS and fences), every row signed `<robot> · MCP as <dev>`. |
| `plan_materials_move` / `apply_materials_move` | v2.6808 — shipped | Everything one job holds on site moved to another job, for a count recorded under the wrong job, through `dev_on_site_move_job`: the whole-job combine's own on-site rule (`on_site_carry_job`), every cage and box keeping its id and printed code; the dry run does the move, counts both jobs and unwinds. Photo files already in Drive follow into the new job's photo folder (v2.6885, punch list #297; the sweep finishes what the ask leaves, v2.6915). |
| `mint_twin_setup_code` | v2.6187 — shipped | A ten-minute, single-use twin setup code through `twin-setup` as the dev; `scripts/twin/redeem_setup_code.py` redeems it into the Mac's key file. The key never comes back through the seat. |
| `get_person_file` | v2.6422 — shipped | A person's HR file whole, as People → HR draws it (`docs/HR_FILES.md`): the Timeline's lines in their lanes by month, the chips, the evidence records with their Drive state, the summary and narrative — the tab's own kernel (`_shared/personTimeline.ts`, lifted in v2.6418) over the tab's sources and keys, fail-soft per source; the owner's 2026-11-02 ask that a person's timeline and narrative be reachable from MCP. |
| `plan_person_evidence` / `apply_person_evidence` | v2.6426 — shipped | A piece of evidence on a person's HR file — the day it is about, a title, a memo and its files as `content_base64` — through `dev_person_evidence_write` (migration `20261103060000`): the files staged in `hr-files` as the dev under the panel's path rule, the rows as the dev, then `hr-evidence-drive` asked fail-soft, as the panel's Add evidence does. |
| `plan_person_report` / `apply_person_report` | v2.6430 — shipped | A waiting field report filed onto the person's HR file as the entry it becomes, or dismissed with a reason, through the HR queue's own `file_person_report` / `dismiss_person_report`; no wrapper — the dry run is the server's read of the report, hashed with the ask, so a report resolved since refuses the apply. The six reports waiting since August and October are the owner's call: nothing was filed or dismissed by the build. |
| `plan_clock_sessions` / `apply_clock_sessions` | v2.6437 — shipped | Clock sessions adjusted op by op — times, note, move, approve — through `dev_clock_session_write` (migration `20261103050000`); the typed-hours second look and the approval guard hold inside. |
| `check_license` · `plan_license` / `apply_license` | v2.6475 — shipped | A teammate's license checked against TDLR's open list and added or updated through `dev_person_license_write` (migration `20261103180000`), in the logbook's words; punch list #255. |
| `get_hours_statement` · `plan_hours_statement` / `apply_hours_statement` | v2.6414 — shipped | The signed hours statement read, made, sent and filed on a matter through `dev_hours_statement_write` (migration `20261103003000`); punch list #212. |

**Where the numbers come from** (mapped 2026-09-20): job header, stage, strip, hours and
activity are RPCs or plain rows; **job money, customer LCV and open balance are client
kernels** — small and nearly pure (`billTruth.ts` already imports two `_shared` kernels), which
is why PR 4a is a move rather than a rewrite. A composite that cannot reach the screen's own
kernel says so in its reply (`money: "rows only — kernel not lifted"`) rather than computing a
second opinion.

Worth doing first, outside this train: decompose `twin-mcp/index.ts` (one 3,362-line file, mapped in docs/TWIN_MCP_SERVER_ARCHITECTURE.md —
a 48-tool array and one switch) so the JSON-RPC shell, key resolution and the call ledger
are shared code dev-mcp imports rather than copies.

## The bid train: the seat changes a bid and fills in its working contents (mapped 2026-11-11)

The owner, 2026-11-11, preparing to enter bids for proposals that went out months ago: "I would
like to add verbs to not only do those things you mentioned it cannot do, but fill out all of the
line items for counts, takeoffs, labor, pricing." Today the seat makes a bid (`plan_bid`), reads
one (`get_bid`), files its plans, loads submittal rows and leaves a note. It cannot change a bid
after it is made, and it cannot write what the Counts, Takeoffs, Labor and Pricing tabs hold.

**The rule for every pair** is the job train's (#293): the screen's own door as the dev under RLS,
never a write the screen could not make; a plan in words with before and after and a hash over
the rows it touches; an apply that plans again and writes only on a match; never through
`view_as`; and the README says what the screen does that the verb does not.

### What the reading found (three things the brief had the other way)

1. **The priced total is a pure kernel already.** `useBidPricingEngine` loads rows and runs the
   labor sync; it computes no total. The total the Pricing tab shows is `computeBidPricingRows`
   (`src/lib/bidPricingRowCalculations.ts`) through `scenarioPricingRows`, and the cost beside it
   is `computeBidCostBreakdown` plus tax on materials. All of it is pure and none of it is on the
   edge yet. So the Pricing plan can state the screen's own number once those files join the
   kernel copy (`scripts/edge-kernels.mjs`, where `dev-mcp` is an importer already); `get_bid`
   can then restate it too.
2. **twin-mcp has no door to share, only rules.** Every twin write (`paste_counts`, `put_fixtures`,
   `put_quote`, `put_price_sheet`) is a table write as the service role, with its checks inline in
   `twin-mcp/index.ts`, fenced to the twin's own bids in code. The dev seat must write as the dev
   under RLS, so it cannot call those. What the two seats can share is the shaping of a row (a
   count row's parse, units and alternate tags), lifted into `_shared/` and imported by both, in
   the PR that first needs it. `ct_finish_takeoff` and `tt_finish_costing` write CountTooling and
   TakeoffTooling, not this bid's rows. No twin verb writes labor rows.
3. **The Labor tab is the one the brief calls Cost Estimate**, its rows are keyed by the fixture's
   NAME (`UNIQUE(cost_estimate_id, fixture)`), and no screen adds one by hand: the load sync mints
   them from the count rows (`planLaborSync`), and the database mints them when a bid is first
   marked sent (`bids_mint_labor_on_send` → `mint_labor_rows_from_book`). So counts come before
   labor, and a sent date set before the labor is entered fills the labor from the book.

### The map

| Screen | What it writes | What guards it | The kernels behind what it shows | twin-mcp there | The verb pair |
|---|---|---|---|---|---|
| **Edit Bid** (autosave, `useBidEditController` → `buildBidSavePayload`, pruned to the changed fields) | One PATCH on `bids`: name, address, the GC (`customer_id`, with `gc_builder_id` nulled), project, development, service type, estimator, account manager, due date and time, start date, drawing date, sent date, submitted to, the outcome with `loss_reason` / `loss_category` and the alternates taken, bid value, agreed value, profit, distance, the robot opt-out, notes, the links. Then a `bids_submission_entries` line when the outcome moved (*Win/Loss changed from X to Y. Changed by …*). No RPC. | `bids` UPDATE for dev, master, assistant, controller, estimator, primary; a primary only their own; the twin, training and archived fences. Triggers: `outcome_at` stamped (an explicit write wins, "a back-dated decision"), the board archive cleared, labor minted and shadows scored on a first sent date, `bid_changes` (History) for the tracked columns. A new sent date asks the person's three-line checklist first. | `buildBidSavePayload`, `pruneUnchangedBidUpdateFields`, `buildOutcomeChangeBidNoteBody`, `bidLossCategories` | Nothing: sending and outcomes are human acts (`twin_no_send_guard`) | **`plan_bid_update` / `apply_bid_update`** (PR 1) |
| **Bid Board presses** | The Lost strip's reason chips: `bids` `{ loss_reason, loss_category }`. A GC pill on a bid with versions: `setGcPacketOutcome` (`bid_versions` outcome, the sibling packets on a win, the bid's roll-up, a note with the GC). Link on a won row: `snapshot_job_budget_from_bid`. Value and sent date have no press of their own: the row opens Edit Bid. | As above; `bid_versions` by `can_access_bid_for_pricing` | `gcPacketOutcome.ts`, `wonCascade.ts`, `submissionSections.ts` | Nothing | PR 1 for a bid with no versions. Per-GC sends and outcomes are a later pair (below). |
| **Counts** (`BidsCountsTab`) | `bids_count_rows` insert, update and delete by id (`fixture`, `count`, `unit`, `page`, `group_tag`, `sequence_order`, the active `bid_version_id`); `update_bids_count_rows_order`; `bids.alternate_group_tags`; `bid_count_sources` on a CountTooling import. A deleted row takes its takeoff lines and prices with it (FK cascade). | Role list with dev; the version lock (a dev passes it); History by trigger, tagged by the `x-bid-action` header | `countSheet.ts` (`findDuplicateFixture`: one row per fixture and group in a version, the stable key), `countRowUnit.ts`, `parseCountsImportText.ts`, `countsImportReview.ts` | `paste_counts`: replace-all as the service role, with robot-book prices and a total check | **`plan_bid_counts` / `apply_bid_counts`** (PR 2; `plan_count` is Materials on site's) |
| **Takeoffs** (`BidsTakeoffTab`, `useTakeoffRoughLines`) | `bids_takeoff_rough_part_lines` by id, each on a count row (`part_id` or a bundle's `source_template_id`, `quantity`, `unit_price`, `sequence_order`, order increments); `bid_count_row_custom_costs` (one per count row: a quoted materials cost each); `bids.tax_rate_pct`, `sov_material_factor`, the takeoff book pick | Role list with dev and superintendent; custom costs dev, master, assistant, controller, estimator; the version lock | `combinedMaterials` (`bidMaterials.ts`), `takeoffOrderRounding.ts`, `bidTakeoffHelpers.ts` (on the edge already), `takeoffBookFill.ts` | `paste_counts` writes `bid_count_row_custom_costs` (source quoted); `tt_finish_costing` writes TakeoffTooling | **`plan_bid_takeoff` / `apply_bid_takeoff`** (PR 3) |
| **Labor** (the brief's Cost Estimate: `BidsLaborTab`, `BidsLaborNewView`) | `cost_estimates` (one a bid, minted `{ bid_id }` on first load; rate, driving, trips, estimator cost, travel); `cost_estimate_labor_rows` (hours per unit for rough in, top out, trim set; `count`, `is_fixed`, `kind`, `unit`, `source`) minted and renamed by the load sync; `cost_estimate_labor_rows_unmatched`; the five direct cost tables (equipment, permit, subcontractor, waste, other: `note`, `rough_in`, `top_out`, `trim_set`) | `can_access_bid_for_pricing` through the estimate; History by trigger | `planLaborSync`, `laborRowHours`, `computeBidCostBreakdown`, `bidCostCalc.ts`, `sumDirectCosts`, `effectiveLaborRate` | None | **`plan_bid_labor` / `apply_bid_labor`** (PR 4) |
| **Pricing** (`BidsPricingTab`) | Per count row and scenario (`price_book_version_id`): `bid_pricing_assignments` (the book entry, `unit_price_override`, `is_fixed_price`) or, with no entry, `bid_count_row_custom_prices`; a write on a shared book first clones it to the bid (`clone_price_book_version_to_bid`); `price_book_entries`; the starred scenario; `stamp_bid_priced_margin` (`bids.priced_*`, unsent bids only). The total is never stored: only `bid_value` at send. | `can_access_bid_for_pricing`; the version lock; the sent-bid lock is the client's alone | `computeBidPricingRows`, `scenarioPricingRows`, `resolvePricingWriteTarget`, `deriveActivePricingId`, `pricedMargin.ts` | `paste_counts` assigns against the robot book; `put_quote` and `put_price_sheet` are supply-house papers | **`plan_bid_pricing` / `apply_bid_pricing`** (PR 5) |
| **Cover Letter and the send** | Mark sent: `bids` `{ bid_date_sent, bid_value }` on a plain bid (no checklist stamps), or `bid_version_sends` per GC with the bid's date derived by trigger; the letter's boxes, the schedule of values and payment rows; the bid room link (`send-bid-room-link`) | `can_access_bid_for_pricing`; `twin_no_send_guard` | `coverLetterDocument.ts`, `coverLetterVersionBundle.ts`, `bidSentDate.ts` | Nothing | The sent date of a plain bid is PR 1's. Per-GC sends and the letter are after PR 5. |

### The order, one PR each

1. **`plan_bid_update` / `apply_bid_update`** (**built, v2.6945**, `_shared/devMcpBidUpdate.ts`) — Edit Bid's columns and the Board's reason chips on a
   bid with no versions: one PATCH under RLS, then the outcome line the form writes. The decided
   day is `outcome_at`, which the trigger takes from an explicit write. The sent date lands the way
   the Cover Letter's Mark sent writes it, with no checklist stamps: the three lines are a person's
   own word and the seat does not give it. On a bid with versions the plan refuses Won, Lost and
   the sent date and names the per-GC panel. The plan says what the database will do after: the
   decided day, the labor mint and the shadow score on a first sent date, the History lines, and
   that a win opens no job. No migration.
2. **`plan_bid_counts` / `apply_bid_counts`** — rows `{ fixture, count, unit?, page?, group?,
   alternate? }` added or changed by the tab's own key (fixture and group in the active version),
   `remove` by the same key with what the cascade takes named in the plan. Held with a reason and
   the rest goes on: a key given twice, a unit the tab does not have, a count that is not a
   number. Nothing ready is refused. Lift the row's shaping out of `paste_counts` into `_shared/`
   so both seats parse a count row one way; add `countSheet.ts` and `countRowUnit.ts` to the
   kernel copy. Send the tab's `x-bid-action` so History reads as it does from the screen. Not
   done: the CountTooling import and its sources, the drag order.
3. **`plan_bid_takeoff` / `apply_bid_takeoff`** — lines on a count row named by its key: a part
   (`material_parts`) with quantity and unit price, or the quoted materials cost each
   (`bid_count_row_custom_costs`, one a row). Add or change by part within the row; `replace` a
   row's lines whole. Copy `combinedMaterials` and the order rounding to the edge so the plan
   states the materials total the tab shows. Not done: assemblies expanded from the book, the
   takeoff book's own rows.
4. **`plan_bid_labor` / `apply_bid_labor`** — the estimate's rate and travel boxes; hours per unit by
   fixture name; the five direct cost tables' lines. A fixture with a count row and no labor row is
   minted as the sync mints it (`planLaborSync` on the edge copy), with the ask's hours in place
   of the book's; a fixture with no count row is held, since the sync would park it. The plan
   states hours and cost through `laborRowHours` and `computeBidCostBreakdown`. Not done: the
   labor book's own entries.
5. **`plan_bid_pricing` / `apply_bid_pricing`** — a price per count row through the tab's one write
   rule (`writeUnitPriceOverrideRow`: the assignment's override, else a new assignment on the
   matching book entry, else a custom price), on the bid's active scenario; a shared book is
   cloned to the bid first, as the tab does. Before it, as its own PR, the pricing kernels join
   the edge copy (a generated copy, no rewrite), so the plan states the total the screen would
   show and `get_bid.totals` becomes a figure. The margin stamp only where the screen would stamp.
6. **`plan_bid_submission` / `apply_bid_submission`** — the paper that was sent, filed on its bid. The owner,
   2026-11-11, on old proposal files to be copied into company Drive, a folder a bid: "connected to
   their bids where a user links the submissions" and "if we don't have dev verbs to support this,
   we should add those too". The need as the session working the real case met it:
   - **The links are PR 1's.** The Files window (`bidFilesIo.ts`) writes `bid_submission_link`,
     `drive_link` and `count_tooling_plans_link` as plain PATCHes on `bids`, and `plan_bid_update`
     takes all three and `plans_link`. A bid adopted into another still takes its link.
   - **The project folder** is made by the `bid-photos` function's `make` (the Files window's Make
     the project folder), which names it by the office's pattern, puts it in the company's shared
     Drive and writes `bids.drive_link` itself. The apply calls it as the dev when the bid has none.
   - **The filing** has no screen: a person pastes a link. The pair takes
     `{ bid, drive_file_id | file_name + size_bytes + sha256, replace? }`, reads the source on the
     server as `devMcpDriveDoc.ts` reads a Drive file (or from a one-shot upload, as
     `plan_file_plans` does), and copies it into a Submission folder inside the bid's project
     folder. One column holds one link and a bid can hold several papers, so the link is the file
     when there is one and the Submission folder when there are more. The plan commits to the
     file's name, size and sha256 and to the link before.
   - **A read first.** The seat cannot list a Drive folder or read a file's owner, sharing and
     modified time, so the real case was read through a browser. A `read_drive_folder` verb over
     the service account goes in the same PR.
   Until it is built: `plan_bid_update` sets the link to a file that is already where it belongs,
   `plan_mail_file` files a submission that came by mail
   (`to: { kind: 'job', bid_id, where: 'sent' }`), and what was said when it went out is a note on
   the bid (`plan_activity_note`). A contact with its method is the Log contact press and has no
   verb yet.
7. **After those**, when asked for: per-GC sends and outcomes on a bid with versions
   (`bid_version_sends`, `setGcPacketOutcome`'s writes), the letter's boxes and schedule of values.

For a proposal on paper the order of entry is the order of the PRs: the bid, its counts, takeoff,
labor and prices, then the value, the sent date and the outcome last, so the sent date's labor
mint finds the labor already there.

### Things to know before building 2 to 5

- A count row has no unique key in the database: the key is the tab's rule, checked in the kernel.
  Count rows and takeoff lines are per bid version (`bid_version_id` null on a bid never split);
  the estimate and its labor rows are per bid; prices are per scenario.
- The Labor tab's New view prices labor at the bid's rate, else the company crew rate
  (`effectiveLaborRate`); Pricing uses the estimate's `labor_rate` alone. A plan names which.
- The margin stamp's revenue ignores `is_fixed_price`; `computeBidPricingRows` does not. State the
  screen's total, not the stamp's.
- Every seat PR bumps `SERVER_VERSION` and the verb count, pinned across `src/lib/devMcp/*.test.ts`
  (`devMcpPlanSets.test.ts` also counts `restRows(`): take the next free version at the rebase.
- ZZ fixtures: b398 "ZZ Test" (already decided) reads well for a dry run; an apply wants a
  fresh bid made with `plan_bid` under a ZZ name, never a robot's ZZ Shadow or ZZ Twin bid.

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
