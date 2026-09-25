# Twin MCP Server Architecture Map

---
file: docs/TWIN_MCP_SERVER_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for decomposing supabase/functions/twin-mcp/index.ts (per PAGE_DECOMPOSITION_PLAYBOOK.md, adapted from tabs to verb families). It lists what each verb family of the digital-twin MCP server touches (tables, buckets, companion-app calls, fences, shared helpers, test coverage). The goal is to split the 2,260-line callTool switch into per-family handler modules behind one dispatch table, running on the shared _shared/mcpJsonRpc.ts shell.
covers:
  - supabase/functions/twin-mcp/index.ts
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## Overview

**Line numbers are exact as of `a05cef4c4` and go stale with every commit. Search for the symbol (the case label or helper name), not the number.** Before you trust a range, regenerate the facts with `npm run map -- supabase/functions/twin-mcp/index.ts`.

**What this surface is.** [`supabase/functions/twin-mcp/index.ts`](../supabase/functions/twin-mcp/index.ts) has **3,362 lines**. It is a Deno edge function, not React: the stateless JSON-RPC MCP server that lets any MCP-capable agent hold a digital-twin seat. It has 0 components, 0 hooks and 22 module functions. Churn is **42 commits in 90 days**; the last was `67e865b14` on 2026-09-20 (v2.3630). The purpose, endpoint, auth, secrets and every verb's contract are documented in [EDGE_FUNCTIONS.md → twin-mcp](./EDGE_FUNCTIONS.md#twin-mcp). This map links there and does not restate verb behavior.

**Who mounts it.** The fact sheet's "Imported by" is **0**, because this file is an entry point: `serve()` at 3336. It is reached at `POST /functions/v1/twin-mcp` behind the `mcp-router` Worker (`mcp.clicktooling.com/twin`), with `verify_jwt = false` in `supabase/config.toml`. The client only hands out the address (`src/lib/bids/desktopKickoff.ts`, `TwinSetupDialog`), and the harness scripts in `scripts/twin/` call it. It calls outward to `plan-fetch`, `drive-intake` and `twin-login` (with the caller's own token), to CountTooling and TakeoffTooling (`twin-login`, `manage-user`, `import-takeoff`, `import-manifest`), and to storage buckets `twin-plans-tmp` and `bid-submittals`.

**Contract (the "props").** Four JSON-RPC methods: `initialize`, `ping`, `tools/list` and `tools/call`. `handleRpc` (3302–3334) sends `tools/call` to `callTool(req, name, args)`, which returns `{ content, isError }`. `initialize` and `tools/list` are open. Every `tools/call` needs the per-twin token (`X-Twin-Token` or `Authorization: Bearer`). The `serverInfo` at 3311 is `pipetooling-twin-mcp` v`1.4.2`. The bundled docs come from [`briefs.ts`](../supabase/functions/twin-mcp/briefs.ts) (42 lines, 9 consts). **That file is GENERATED** by `node scripts/build-twin-mcp-briefs.mjs` from `docs/twins/*`. Never hand-edit it.

### Verb census (replaces the hook census)

The file has **48 tools**. The 48 entries in `TOOLS` (38–664) are exactly the 48 `case` labels in `callTool`; this was checked by diff for this map. No test enforces it.

| Family (region) | Verbs | Case lines | Writes | A pricer key may call |
|---|---|---|---|---|
| Session + bundled docs (3) | `get_brief`, `get_directory`, `get_harness_guide`, `get_ct_guide`, `get_tt_guide`, `get_placement_guide`, `get_mission`, `mint_session`, `submit_report` (9) | 136 | `twin_runs` | `get_directory`, `get_harness_guide`, `submit_report` |
| Work-state reads (4) | `get_assignments`, `get_plan_brief`, `get_work_state`, `get_robot_book` (4) | 234 | — | none |
| Fenced pipeline writes (5) | `heartbeat`, `file_plans`, `add_bid_note`, `paste_counts`, `extend_robot_book`, `put_substrate`, `seed_audit_questions` (7) | 301 | yes (money) | `heartbeat`, `add_bid_note` |
| Companion-app legs (6) | `ct_finish_takeoff`, `tt_finish_costing` (2) | 217 | yes + external | none |
| Backtests (7) | `open_backtest`, `next_backtest`, `score_backtest`, `get_reference_rows` (4) | 216 | yes | none |
| Shadows (8) | `get_shadow_queue`, `open_shadow`, `next_shadow`, `void_shadow`, `lock_shadow`, `score_shadows` (6) | 357 | yes | none |
| Question lanes (9) | `ask_question`, `get_answers` (2) | 123 | `twin_questions` | both |
| Plan pages (10) | `get_plan_pages`, `stage_plan_pdf` (2) | 133 | storage + ledger | `get_plan_pages` only, and only on the bid of a held `read_schedule` task |
| Pricer seat (11) | `get_pricing_guide`, `get_component_rules`, `get_component_corrections`, `next_price_matrix`, `get_quote_documents`, `put_quote`, `finish_price_matrix`, `extend_component_rules` (8) | 417 | yes (money) | all 8 (an estimator key is refused all 8) |
| Submittal robot (12) | `get_submittal_guide`, `next_submittal_task`, `put_submittal_result`, `finish_submittal_task` (4) | 107 | yes | all 4 |
| **Total** | **48** | **2,241** (+15 head, +4 default/close = 2,260) | | 20 of 48 |

Seat sets come from `_shared/twinSeatGate.ts`: `PRICER_VERBS` 8, `SHARED_VERBS` 7, `SUBMITTAL_VERBS` 4 and `PRICER_TASK_FENCED_VERBS` 1. **28 verbs are estimator-only**, and that includes `get_brief` and `mint_session`.

### Monster blocks

| Block | Lines | Size |
|---|---|---|
| `callTool` | 1041–3300 | **2,260** |
| `TOOLS` | 38–664 | **627** |
| `case 'get_plan_brief' / 'get_work_state'` | 1876–2056 | 181 |
| `case 'ct_finish_takeoff'` | 2491–2622 | 132 |
| `case 'score_backtest'` | 2257–2385 | 129 |
| `case 'next_shadow'` | 3066–3188 | 123 |
| `put_quote` / `get_plan_pages` / `paste_counts` | 1339–1449 / 2097–2207 / 2623–2733 | 111 each |
| `get_quote_documents` / `mint_session` | 1235–1338 / 1597–1699 | 104 / 103 |
| `openBacktestShell` | 952–1039 | 88 |

### Key structural differences from the page maps

1. **The units are verbs, not tabs.** A region is a verb family plus the module helpers only it uses. There is no render tree, no state and no effects.
2. **Nothing is shared across calls.** Every `tools/call` re-resolves the twin (`resolveTwin`, 694–717), and each case that touches the database builds its **own** service-role client. That is **37 `createClient` calls inside `callTool`**, plus 1 in `resolveTwin`.
3. **The service role means every fence is in code.** RLS never applies. Ownership, claims, seat and blindness are all `if` statements (see the Shared substrate and Hazards sections).
4. **CI does not see it.** `tsconfig.json` includes only `src`, and `npm run lint` is `eslint src`. Only the `_shared` kernels that `src/**` tests import get type-checked. A bad move fails at deploy or boot, not in CI.
5. **The shared shell already exists.** `_shared/mcpJsonRpc.ts` (90 lines, v2.3640) is the same wire code lifted out for `dev-mcp`, and its header says twin-mcp adopts it "when it is decomposed". dev-mcp (`supabase/functions/dev-mcp/index.ts` 553–589) shows the target shape: one admin client per call, identity resolved once, a `runVerb` dispatcher, and a per-call ledger (`dev_mcp_calls`). twin-mcp has no per-call ledger.

### How to maintain this doc

- When a family moves to `twin-mcp/verbs/*.ts`, flip its row and dossier and point at the new file. Then re-run `npm run map` and update `mapped_at`.
- Verb behavior changes go into EDGE_FUNCTIONS.md → twin-mcp. This map only records where the code lives and what it couples to.

---

## Master summary table

Regions are listed in dispatch-pipeline order, then by family. **Status:** `inline` means the logic is in this file; `partially extracted` means some pure pieces already live in `_shared`. Coupling lists module and `_shared` helpers, tables, and external calls.

| # | Region | Anchor (symbol + lines @ a05cef4c4) | ~Lines | Coupling | Risk | Status |
|---|---|---|---|---|---|---|
| 0 | Transport shell | `corsHeaders` 30–34, `PROTOCOL_VERSIONS` 36, `json`/`rpcResult`/`rpcError`/`textContent` 666–677, `handleRpc` 3302–3334, `serve` 3336–3362 | ~80 | `textContent` is called by every case | low | **inline duplicate** of extracted `_shared/mcpJsonRpc.ts` |
| 1 | Auth + seat gate | `sha256Hex` 679–682, `presentedToken` 684–690, `resolveTwin` 694–717, `callTool` head 1041–1054 | ~50 | `twin_credentials`, `users`; every case closes over `twin` | **high** (security) | partially extracted → `_shared/twinSeatGate.ts` (`seatGate`, `pricerVerbList`) |
| 2 | Tool schemas | `TOOLS` 38–664 | 627 | pure data; must match the 48 case labels and the seat-gate sets | low | inline |
| 3 | Session + bundled docs | doc cases 1056–1067, `get_mission` 1592–1596, `mint_session` 1597–1699, `submit_report` 2070–2085 | 136 | `briefs.ts`; `twin_runs`; PT/CT/TT `twin-login`; `_shared/ttBridge.ts` | med | partially extracted (generated `briefs.ts`, `ttBridge.ts`) |
| 4 | Work-state reads | `get_assignments` 1851–1875, `get_plan_brief`/`get_work_state` 1876–2056, `get_robot_book` 2734–2761 | 234 | 12 tables; CT `manage-user` (`twin_projects`, `twin_rfis`); TT bridge (`ttBridge`) | low–med | inline |
| 5 | Fenced pipeline writes | `heartbeat` 1823–1850, `file_plans` 2057–2069, `add_bid_note` 2386–2405, `paste_counts` 2623–2733, `extend_robot_book` 2762–2816, `put_substrate` 2817–2847, `seed_audit_questions` 2848–2890 | 301 | 15 tables; `drive-intake`; `pricerMayTouchBid` 776–780 | **high** (money, global book) | inline |
| 6 | Companion-app legs | `tt_finish_costing` 2406–2490 (TakeoffTooling STG-4), `ct_finish_takeoff` 2491–2622 (CountTooling STG-3) | 217 | CT `twin-login` / `import-takeoff` / `rest/v1/rpc/set_project_review_status` + `create_view_link`; TT `twin-login` / `import-manifest` / `callTtManageUser`; `bids`, `bid_audits`, `twin_runs`, ledger (TT only), `twin-plans-tmp` | med–high | partially extracted (`_shared/ttBridge.ts`) |
| 7 | Backtests | `openBacktestShell` 952–1039, `open_backtest` 2086–2096, `next_backtest` 2230–2256, `score_backtest` 2257–2385, `get_reference_rows` 2891–2939; shares `disciplineRefusal` 841–846 and `resolveTeacher` 875–880 | ~305 | 9 tables | **high** (blindness, gate math) | inline (the client kernel `src/lib/bids/referenceGrade.ts` is **mirrored, not imported**) |
| 8 | Shadows | `plumbingServiceTypeId` 834–840, `probePlansSweep` 853–869, `createShadowShell` 901–941, `get_shadow_queue` 2940–3031, `open_shadow` 3032–3065, `next_shadow` 3066–3188, `void_shadow` 3189–3211, `lock_shadow` 3212–3242, `score_shadows` 3243–3296 | ~430 | `bids`, `twin_shadow_runs`, `twin_questions`, `users`, `service_types`, ledger; `plan-fetch?probe=all` | **high** | inline |
| 9 | Question lanes | `ask_question` 1700–1764, `get_answers` 1765–1822 | 123 | `twin_questions`, `bids`, `twin_run_scores`, `twin_shadow_runs` | med | partially extracted (`_shared/twinQuestionAudience.ts` / `twinQuestionShape.ts` / `twinQuestionKind.ts`) |
| 10 | Plan pages | `get_plan_pages` 2097–2207, `stage_plan_pdf` 2208–2229; `heldSubmittalTasks` 782–785 | 133 | `plan-fetch`, `pdf-lib`, `twin-plans-tmp` | med | partially extracted (`twinMayReadPlans`) |
| 11 | Pricer seat | helpers 726–825 (`PRICER_COMPONENT_ROLES` … `resolvePricerHouse`); `get_component_rules` 1177–1190, `next_price_matrix` 1191–1234, `get_quote_documents` 1235–1338, `put_quote` 1339–1449, `finish_price_matrix` 1450–1534, `get_component_corrections` 1535–1561, `extend_component_rules` 1562–1591; `get_pricing_guide` 1068–1069 | ~517 | 10 tables; `plan-fetch`; `pdf-lib`; `checkEstimatorQuestionShape` | **high** (money) | inline |
| 12 | Submittal robot | `next_submittal_task` 1072–1121, `put_submittal_result`/`finish_submittal_task` 1122–1176; `get_submittal_guide` 1070–1071 | 107 | `bid_submittal_tasks`, `bid_specified_products`, `bid_submittal_items`, `bids`; `bid-submittals` bucket | low–med | partially extracted (`_shared/submittalRobot.ts`) |

---

## Shared substrate

The server has **no selection pointer and no cross-call state**. What the families share is a per-call context plus six idioms that were copied instead of extracted. That context is the seam: it becomes `TwinCallContext` built once in `callTool`, and every handler module takes `(ctx, args)`.

| Substrate | Where | Copies | Seam |
|---|---|---|---|
| The twin handle `{ twinUserId, email, credId, kind }` | `resolveTwin` 694–717 (closure over `twin` in every case) | 1 | `ctx.twin` |
| Service-role client | one `createClient` per case | **37** (+1 in `resolveTwin`) | `ctx.admin`, built once |
| Bid-ref resolver: a `uuidRe.test(ref) ? eq('id') : eq('bid_number', ref.replace(/^(bp\|b)/i, ''))` pattern | e.g. 962, 1887, 2111, 2216, 2275, 2395, 2415, 2505, 2653, 2743, 2776, 2830, 2866, 2899, 3040, 3200, 3221 | **19** (including 1712 and 1836) | `resolveBidRef(ctx, ref, cols)` |
| UUID regex | strict `/^[0-9a-f]{8}-…$/i` ×19; loose `/^[0-9a-f-]{36}$/i` at 1566, 1709, 1833 | 22 | one `isUuid` |
| Own/assigned fence: `bid.created_by !== twin && bid.estimator_id !== twin` | 1892, 2219, 2278, 2399, 2419, 2509, 2657, 2779, 2833, 2869, 2902, 3203 | **12** (11 distinct refusal texts: 2219 and 2278 share one) | pure `ownsBid(twinUserId, bid)` in `twinSeatGate.ts`, next to `twinMayReadPlans`, which already encodes the same rule |
| Ledger note: `bids_submission_entries.insert` | 936, 1030, 1216, 1328, 1444, 1460, 1525, 2197, 2318, 2373, 2402, 2473, 2723, 2810, 2842, 3117, 3209, 3237, 3269, 3270 | **20** | `ledgerNote(ctx, bidId, text)` (best-effort) |
| Swallowed writes `.then(() => {}, () => {})` | ledger notes, cleanup deletes, price memory | **32** | Keep them best-effort: this is deliberate |
| Token pass-through `presentedToken(req)` | 695, 854, 1240, 1615, 1655, 1693, 2063, 2117, 2431, 2524 | 10 | `ctx.token` |

**Cross-family helpers** travel with their heaviest user or go to a shared `verbs/_refs.ts`:

- `disciplineRefusal` and `plumbingServiceTypeId`: backtests and shadows.
- `resolveTeacher`: both scorers.
- `probePlansSweep`: `get_shadow_queue` and `next_shadow`.
- `heldSubmittalTasks`: called only by `get_plan_pages` (2115). It reads the submittal robot's `bid_submittal_tasks`, but the submittal cases do not call it.
- `sha256Hex`: auth, the CT/TT credential mirror, and the PDF `setKey`.
- `checkEstimatorQuestionShape`: `ask_question` and `finish_price_matrix` asks.
- The **PDF staging pipeline**: pricer and plan pages.
- The **companion mint**: `mint_session` and both legs.

---

## Per-region dossiers

Each dossier gives the anchor, the verbs, the data touched, the helpers used, what stays in the dispatcher, the tests and the approach. "Data" names tables as the source spells them. The fact sheet's list misses the dynamic names flagged below.

### 0. Transport shell — inline duplicate of `_shared/mcpJsonRpc.ts`

- **Anchor:** `corsHeaders` 30–34; `PROTOCOL_VERSIONS` 36; `json`/`rpcResult`/`rpcError`/`textContent` 666–677; `handleRpc` 3302–3334; `serve` 3336–3362 (batch arrays, notifications → 202, GET → 405).
- **Stays in the dispatcher:** the `serverInfo` name and version (3311) and the `instructions` string (3312–3313).
- **Tests:** none. `mcpJsonRpc.ts` is untested too. `mcpRouterWorker.test.ts` (3 tests) covers only the Worker in front.
- **Approach:** `serve(mcpHandler({ name: 'pipetooling-twin-mcp', version: '1.4.2', instructions, tools: TOOLS, authHeaders: ['x-twin-token'], callTool }))`, with `textContent` → `mcpText`. **First widen `McpToolResult.content`** to allow `resource` blocks, because `get_quote_documents` (1337) and `get_plan_pages` (2206) return `application/pdf` resources. The wire differences are listed under Hazards.

### 1. Auth + seat gate — partially extracted

- **Anchor:** `resolveTwin` 694–717 (sha256 against `twin_credentials.token_hash`, `revoked_at`; `users.is_digital_twin && role === 'estimator'`; `twin_kind === 'pricer'` → `kind`). It keeps a legacy fallback for when `users.twin_kind` is absent (708–712). The `callTool` head 1041–1054 runs `seatGate(twin.kind, name)` and returns two distinct refusal texts.
- **Extracted:** [`_shared/twinSeatGate.ts`](../supabase/functions/_shared/twinSeatGate.ts) (54 lines: `seatGate`, `pricerVerbList`, `twinMayReadPlans`, `holdsPlanReadingTask`).
- **Tests:** `src/lib/twins/twinSeatGate.test.ts` (7). `resolveTwin` is untested.
- **Approach:** move `resolveTwin` / `presentedToken` / `sha256Hex` into `twin-mcp/context.ts`. **Order is load-bearing:** auth → seat gate → dispatch. An unknown verb from a pricer key gets the "bid verb" refusal, not `Unknown tool`.

### 2. Tool schemas — inline

- **Anchor:** `TOOLS` 38–664, 48 entries. Schema order differs from switch order. Rows run from `mint_session` at 40 to `finish_submittal_task` at 660.
- **Coupling:** none at runtime. Its names must equal the case labels and include every name in the seat-gate sets.
- **Tests:** none.
- **Approach:** move it verbatim to `twin-mcp/tools.ts` with no Deno imports, so vitest can import it. Add `src/lib/twins/twinMcpTools.test.ts`: names are unique, the count is 48, and `PRICER_VERBS ∪ SHARED_VERBS ∪ SUBMITTAL_VERBS ∪ PRICER_TASK_FENCED_VERBS ⊆ names`. This is the cheapest guard in the file.

### 3. Session + bundled docs — partially extracted

- **Verbs:** the 6 two-line doc cases 1056–1067 return `BRIEF`, `DIRECTORY`, `HARNESS`, `CT_GUIDE`, `TT_GUIDE` and `PLACEMENT_GUIDE`. The next two (1068–1071, `PRICING_GUIDE` and `SUBMITTALS_GUIDE`) have the same shape but are counted with regions 11 and 12. `get_mission` (1592–1596) serves `MISSIONS` text only. `submit_report` (2070–2085) writes `twin_runs` with `mission = report:<label>`.
- **`mint_session` 1597–1699** has three branches:
  - `takeofftooling` (1600–1630): a 6/min limit against `twin_runs`, a `ttTwinEmail` mirror via `callTtManageUser` (best-effort), a per-twin token mint with a fleet-secret fallback on 401, and a `twin_runs` log.
  - `counttooling` (1631–1690): the same shape, plus an inline `CT_MANAGE_USER_*` fetch for `set_twin_credential`.
  - PipeTooling (1691–1698): a thin pass-through to `twin-login`, which owns the guards, the rate limit and the ledger.
- **Env:** `TT_TWIN_LOGIN_URL`, `TAKEOFFTOOLING_TWIN_LOGIN_SECRET`, `CT_TWIN_LOGIN_URL`, `COUNTTOOLING_TWIN_LOGIN_SECRET`, `CT_MANAGE_USER_URL`, `CT_MANAGE_USER_SECRET`, `APP_ORIGIN`.
- **Tests:** none. `briefs.ts` has no CI drift check, and the generator is not in `package.json`.
- **Risk:** med. It holds secrets, and the mint copy is duplicated in region 6.
- **Approach:** `verbs/docs.ts` (a table from verb to const) plus `verbs/session.ts`. Lift the per-twin-first, fleet-secret-on-401 mint into `mintCompanionSession({ app, email, token })`, shared with region 6.

### 4. Work-state reads — inline

- **`get_assignments` (1851–1875):** bids where `estimator_id` is the twin, limit 50. It returns link presence only.
- **`get_plan_brief` / `get_work_state` (1876–2056):** one fenced bid lookup (1883–1894), then the latest `bids_plan_substrates` row. `get_plan_brief` returns the rollup, or everything with `full: true`, then stops (1902–1917).
  - `get_work_state` adds `countFor` over **`bids_count_rows`, `bids_takeoff_template_mappings`, `bids_takeoff_rough_part_lines`, `cost_estimates` and `price_book_versions`**. They are passed as strings, so the fact sheet sees only `bids_count_rows` and `price_book_versions` (read elsewhere) and misses the other three.
  - It also adds open `twin_questions`, `bids_rfis`, the latest `twin_runs` heartbeat, the last 10 ledger entries, `tt_manifest` over `callTtManageUser`, and `ct_takeoff` over the CT `manage-user` verbs `twin_projects` and `twin_rfis` (projects stamped with the bid, or named like it, 2025–2029; failures degrade to an error note).
- **`get_robot_book` (2734–2761):** 🤖 Robot Default `price_book_versions` / `price_book_entries`, by the bid's service type or all robot books.
- **Tests:** none.
- **Risk:** low–med. These are reads only, but `get_work_state` returns its **own** bid's `bid_value` and `outcome` (1955–1956), which is safe only because the fence restricts it to own/assigned bids.
- **Approach:** `verbs/workState.ts`. Split `get_work_state` into `ptWorkState` + `ctTakeoff` + `ttManifest` helpers (each fail-soft) so the 181-line case becomes a composer.

### 5. Fenced pipeline writes — inline, MONEY-PATH

- **`heartbeat` (1823–1850):** writes `twin_runs` with stage and state. **Its bid ref is unfenced**: it stamps any bid id.
- **`file_plans` (2057–2069):** a pass-through to `drive-intake`, where the token re-authenticates.
- **`add_bid_note` (2386–2405):** the fence plus `pricerMayTouchBid`. One of the two verbs here a pricer may reach (the other is `heartbeat`), and the only one with a pricer-specific fence.
- **`put_substrate` (2817–2847):** 1 MB cap; `bids_plan_substrates`; the latest row wins.
- **`seed_audit_questions` (2848–2890):** at most 20 questions; opens a `bid_audits` row if one is missing; inserts `bid_audit_notes` with `kind='question'`.
- **`paste_counts` (2623–2733):**
  - **Parsing:** rows are validated at 2631–2648 (units `ea`/`ft`/`px`/`sqft`, at most 200).
  - **Book:** the global 🤖 Robot Default book for the bid's service type is resolved, and every `book_entry` must match a `fixture_types` name.
  - **Priced total:** `Σ count × (override ?? total_price)`, rounded to cents at 2677. It checks against `expected_total` with a tolerance of `max($1, 0.1%)` (2679).
  - **Replace:** deletes **`bid_pricing_assignments`, `bid_count_row_custom_prices`, `bid_count_row_custom_costs`, `bid_count_row_submission_hides`** (a loop over dynamic names), then `bids_count_rows`.
  - **Inserts:** rows, then assignments, then TT `unit_cost` → `bid_count_row_custom_costs.unit_materials_cents`. Labor hours are summed into the note only (2721).
- **`extend_robot_book` (2762–2816):** at most 20 entries. It writes the **global** Robot Default book (`price_book_entries`, with `total_price = rough_in_price = price`, top-out and trim set to 0) and **creates `fixture_types`**. A partial failure keeps the entries added so far. Its fence is the usual own/assigned check on the passed bid (2779), but the write lands on the global book for that bid's service type.
- **Tests:** none. **The `paste_counts` pricing and tolerance and the `extend_robot_book` entry shape are untested money math.**
- **Risk:** **high**. Writes are non-transactional and a replace destroys rows first.
- **Approach:** Stage A first: `_shared/pasteCounts.ts` (`parsePasteRows`, `pricePasteRows(parsed, entryByName)`, `withinLockTolerance`) with tests pinning today's rounding. Then `verbs/pipelineWrites.ts` with the same write order and the same checked-versus-swallowed errors.

### 6. Companion-app legs (CountTooling STG-3, TakeoffTooling STG-4) — partially extracted

- **`tt_finish_costing` (2406–2490):** fence → mint a TT session and walk the magic link (**2423–2447**) → `import-manifest` with `external_ref = b<bid>` → `set_twin_project_review` over `callTtManageUser` → `twin_runs` + ledger.
- **`ct_finish_takeoff` (2491–2622):** fence → mint a CT session and walk the magic link (**2514–2545**) → `import-takeoff` (the plan set rides via `plan-fetch?bid=`, or an `https` `pdf_url`; a staged `twin-plans-tmp` object is removed afterwards) → the CT `rest/v1/rpc/set_project_review_status` and `create_view_link` → `bids.count_tooling_link` + `bid_audits.self_assessment` (insert or refresh), only when a view link came back → `twin_runs`.
- **Extracted:** [`_shared/ttBridge.ts`](../supabase/functions/_shared/ttBridge.ts) (29 lines, untested). The CT counterpart [`_shared/ctBridge.ts`](../supabase/functions/_shared/ctBridge.ts) (`callCtManageUser`, whose header calls it "the ONE place PT speaks to CountTooling's manage-user") exists but is **not imported here**: twin-mcp makes 3 inline `X-Bridge-Secret` fetches instead (`mint_session` 1656–1665, `get_work_state` `ct_takeoff` 2008–2016 and 2038–2042).
- **Coupling:** four copies of the per-twin-first, fleet-secret-on-401 mint (`mint_session` TT and CT, plus the two finishers) and two copies of the `redirect: 'manual'` → `access_token=` walk.
- **Tests:** none.
- **Risk:** med–high. These calls hold cross-app secrets and a JWT, and they **mint without the 6/min limit** (see Hazards).
- **Approach:** first `_shared/companionMint.ts` (`mintCompanionSession`, `walkMagicLink`), then `verbs/companions.ts`.

### 7. Backtests — inline, gate math

- **`openBacktestShell` (952–1039):**
  - It refuses a `holdout` reference unless `gateRun` is set (969–971), and refuses a non-plumbing one through `disciplineRefusal`.
  - It computes the **presence-only grade** (975–989).
  - Rounds get `ZZ Twin <P> (backtest R<n>)`. The reuse check (997) and the race guard (1024–1028) are **scoped to this twin**.
- **`open_backtest` (2086–2096)** defaults to round 1.
- **`next_backtest` (2230–2256)** defaults to **round 2** and walks the caller's `candidates`.
- **`score_backtest` (2257–2385):**
  - Gates on a LOCK note (2281) and on count rows (2286–2289).
  - Amends by `run_label` (2294–2323), re-deriving the grade and flags inline (2310–2313).
  - The first score (2324–2384) computes the grade (2338), the flags (2340–2348), `gate_eligible`, `delta_pct` (2350) and the teacher, then writes `twin_run_scores` + ledger.
- **`get_reference_rows` (2891–2939):** the post-unseal read. The seal check is at 2908–2914. It returns reference rows with a `unit_price` of override, else the book `total_price`.
- **Mirrored kernel:** [`src/lib/bids/referenceGrade.ts`](../src/lib/bids/referenceGrade.ts) (`referenceGrade`, `referenceQualityFlags`, `STALE_DAYS = 183`) says "twin-mcp mirrors this". The edge has **3 inline grade copies** (984, 2310, 2338) and **2 flag copies** (2312 as a one-liner, 2340–2348).
- **Tests:** `referenceGrade.test.ts` (5) covers the **client** copy only. The edge copies, `delta_pct` and the verdict parse (2268–2272) are untested.
- **Risk:** **high**. This is blindness, since it unseals the reference value, and the Gate A/B denominators.
- **Approach:** move `referenceGrade.ts` into `_shared/referenceGrade.ts` and re-export it from `src/lib/bids/` (the `discountLine.ts` pattern). Add `_shared/twinScoring.ts` (`parseScopeVerdict`, `deltaPct`) with tests. Then `verbs/backtests.ts`, with `openBacktestShell` moving along with it.

### 8. Shadows — inline

- **`get_shadow_queue` (2940–3031):** `probePlansSweep`, then two queries: requested-first and a lookback window (default 14 days). Both require unsent, plumbing, `robot_opt_out = false`, not `ZZ %`, and plans that are present and readable (2985–2986). A windowless `coverage` block runs a third copy of the filter.
- **`open_shadow` (3032–3065):** refuses a sent or opted-out reference. **Its reuse check is by `reference_bid_id` only**, so it returns any twin's run.
- **`next_shadow` (3066–3188):**
  - First it resumes answered plans asks: `twin_questions` with `acted_at` null → `effectiveTwinQuestionKind`/`answerRequestsRerun` → hand back an `open` shell, consuming every ask it examines.
  - Then it runs the probe and two claim queries (requested, then a lookback, default 30 days).
  - It then calls `createShadowShell`, and the earliest-run-wins de-dupe deletes the loser's run and bid (3175–3176).
- **`void_shadow` (3189–3211):** own shells only; a scored run stays scored.
- **`lock_shadow` (3212–3242):** fence by `run.twin_user_id`; refused once the reference is sent (contaminated).
- **`score_shadows` (3243–3296):** **fleet-wide**. It scores every `locked` run whose reference is sent with a value, computes `delta` (3256), `resolveTeacher` and ledger lines on **both** the shell and the human reference bid (3269–3270). It also builds the per-axis scoreboard (3280–3294): `mean_abs_pct` over all scored runs, and `last5_in_8pct` and `gate_b_met` over calibration-standard teachers only.
- **Helpers:** `plumbingServiceTypeCache` 834 is a module-level cache per isolate; `createShadowShell` rolls back its bid if the run insert fails (933).
- **Tests:** none. The scoreboard gate math and the eligibility filter (5 query copies) are untested.
- **Risk:** **high**. Claim races, writes to human bids, and gate math.
- **Approach:** Stage A: `shadowScoreboard(rows, standardIds)` and `deltaPct` into `twinScoring.ts`. An IO helper `liveShadowCandidates(q, plumbingId)` replaces the 5 filter copies. Then `verbs/shadows.ts`, with `plumbingServiceTypeId` and `disciplineRefusal` in `verbs/_refs.ts` shared with backtests.

### 9. Question lanes — partially extracted

- **`ask_question` (1700–1764):** resolves the bid unfenced (1706–1714), slugs `topic`, classifies `audience` and `kind` (kernels), applies the estimator shape gate (`checkEstimatorQuestionShape`) or normalizes operator choices, then runs the **column-ladder insert** (1752–1755).
- **`get_answers` (1765–1822):** the last 50 questions of this twin, plus **blindness redaction** (1778–1820). Any question or answer that mentions `b<ref>` or a project name of 6 characters or more, belonging to a reference with an unsealed twin shell, comes back `{ redacted: true }`.
- **Also filed elsewhere:** `finish_price_matrix` asks (1500–1514), and the `next_shadow` resume consumes answers.
- **Extracted:** [`_shared/twinQuestionAudience.ts`](../supabase/functions/_shared/twinQuestionAudience.ts) (87), [`twinQuestionShape.ts`](../supabase/functions/_shared/twinQuestionShape.ts) (87), [`twinQuestionKind.ts`](../supabase/functions/_shared/twinQuestionKind.ts) (75).
- **Tests:** `src/lib/bids/twinQuestionAudience.test.ts` (8), `twinQuestionChoices.test.ts` (8, the shape gate), `twinQuestionKind.test.ts` (6). **Redaction is untested.**
- **Approach:** Stage A: `redactForBlindness(questions, refs)` into `_shared/twinBlindness.ts` with tests. Then `verbs/questions.ts`, with the ladder insert as one `insertTwinQuestion(ctx, row)` shared with `finish_price_matrix`.

### 10. Plan pages — partially extracted

- **`get_plan_pages` (2097–2207):** the fence is `twinMayReadPlans(twin, bid, heldSubmittalTasks(...))`. It fetches `plan-fetch?bid=` with the caller's token and merges up to 8 parts (60 MB cap). The page spec defaults to `1-6` (2160), at most 8 pages per call. Each page is split into a single-page PDF, upserted to `twin-plans-tmp/plan-pages/<bid>/<setKey>/pNNN.pdf`, and optionally embedded (at most 3 files, 3 MB).
- **`stage_plan_pdf` (2208–2229):** a signed upload URL into `twin-plans-tmp` (50 MB). Estimator-only.
- **Duplication:** the staging block 2121–2196 is a near copy of `get_quote_documents` 1260–1327. They differ only in the query, the default spec (`1-8` there), the path prefix and the `setKey` inputs.
- **Tests:** `twinMayReadPlans` (in `twinSeatGate.test.ts`). The page-spec parser is untested.
- **Approach:** Stage A: a pure `parsePageSpec(spec, pageCount, max)`. Then an IO helper `stagePdfPages({ fetchPart, pathPrefix, setKeySeed, pages, embed })` used by both, then `verbs/planPages.ts`.

### 11. Pricer seat — inline, MONEY-PATH

- **Module helpers (726–825):**
  - `PRICER_COMPONENT_ROLES` (15 roles) and `shapePricerRequest`, a pure row shaper.
  - `loadPricerRequest`: checks a uuid, requires `claimed_by` to be this twin and the status to be in the allow list, then loads the bid.
  - `pricerKey` / `pricerSlug` (pure). `pricerMayTouchBid` (called only by `add_bid_note`, region 5) and `heldSubmittalTasks` (called only by `get_plan_pages`, region 10) sit in this block but travel with their callers.
  - `resolvePricerHouse`: resolves a source index, uuid or name to `supply_houses`, and recurses on a name hit.
- **`next_price_matrix` (1191–1234):** returns the held request first; otherwise it claims the oldest of 10 `queued` requests with a **conditional update** (the same idiom as `next_submittal_task`).
- **`get_quote_documents` (1235–1338):** lists sources through `plan-fetch?request=&list=1`, or stages pages (the region-10 copy, default `1-8`).
- **`put_quote` (1339–1449):**
  - Normalizes and validates lines (1351–1383): each line must be in the request snapshot unless it is `loose`, with integer cents and at most one `option_chosen` per group.
  - On replace, it deletes lines then quotes. It inserts the quote, then the lines, rolling the quote back by hand if the lines fail.
  - **Price memory:** it upserts the **global** `supply_house_fixture_prices` (1433–1440, swallowed).
- **`finish_price_matrix` (1450–1534):** handles `blocked`, or clears the robot picks (1479–1480), re-picks per fixture and computes **`totalCents += Σ priced each × count`** (1496). It files asks through the shape gate and runs the kind ladder. It sets the status to `ready` and **clears `reviewed_at`**.
- **Rulebook:** `get_component_rules` and `get_component_corrections` only read; `extend_component_rules` (at most 20 rules, or digest-only) writes the **global** `fixture_component_rules` / `fixture_component_corrections`.
- **Tests:** none. **Line validation, price memory and the pick total are untested money math.**
- **Risk:** **high**. These write quotes, picks and ledger notes on a **human** bid (the request's bid), plus global price memory.
- **Approach:** Stage A: `_shared/pricerQuote.ts` (`shapePricerRequest`, `pricerKey`, `pricerSlug`, `normalizeQuoteLines`, `priceMemoryRows`, `pickCellTotalCents`) with tests. A shared `claimNextQueued(ctx, table, cols)` covers both queues. Then `verbs/pricer.ts`.

### 12. Submittal robot — partially extracted

- **`next_submittal_task` (1072–1121):** the held task comes first, otherwise a conditional-update claim over 10 queued tasks. It returns a 15-minute signed `bid-submittals` link for the file kinds, the bid's `bid_specified_products`, and the revision's `bid_submittal_items`.
- **`put_submittal_result` / `finish_submittal_task` (1122–1176):**
  - A `claimed_by` fence.
  - `read_schedule` deletes the bid's unconfirmed `source = 'robot'` `bid_specified_products` (any robot's, not only this twin's, 1151), inserts the tags not already on the bid, and never touches a confirmed or human tag.
  - `file_cut_sheets` and `read_redlines` write `bid_submittal_tasks.result` only.
  - Finishing requires a result unless `blocked`.
- **Extracted:** [`_shared/submittalRobot.ts`](../supabase/functions/_shared/submittalRobot.ts) (171 lines: parsers, summaries, `scheduleRowInserts`, `TASK_KIND_LABELS`).
- **Tests:** `src/lib/submittals/submittalRobot.test.ts` (5).
- **Approach:** the easiest family module: `verbs/submittals.ts` plus the shared `claimNextQueued`.

---

## Stage-A inventory

**Where kernels go.** Edge-only pure code goes in `supabase/functions/_shared/*.ts`, tested from `src/lib/twins/*.test.ts` (the pattern `twinSeatGate` and `submittalRobot` already follow). A kernel that has a client twin moves to `_shared` with a one-line `src/lib/**` re-export.

| Landed kernel | Used for | Tested |
|---|---|---|
| `_shared/twinSeatGate.ts` | seat verb sets, `seatGate`, `twinMayReadPlans` | yes (7) |
| `_shared/submittalRobot.ts` | submittal parse/summarize/insert rows | yes (5) |
| `_shared/twinQuestionAudience.ts` / `twinQuestionShape.ts` / `twinQuestionKind.ts` | question lanes, the shape gate, plans asks | yes (8 / 8 / 6) |
| `_shared/appTimeZone.ts` | `todayYmdInAppTz`, `ymdAddDays` (due dates, expiry, stale) | yes (`appTimeZoneSharedParity.test.ts`, 3: an `it.each` over 6 instants + 2) |
| `_shared/ttBridge.ts` | TT `manage-user` calls, `ttTwinEmail` | **no** |
| `_shared/ctBridge.ts` | `callCtManageUser`: **exists, not imported here** (3 inline CT bridge fetches: 1656–1665, 2008–2016, 2038–2042) | **no** |
| `_shared/mcpJsonRpc.ts` | shared wire shell (dev-mcp) — **not yet used here** | **no** |
| `twin-mcp/briefs.ts` | bundled docs (GENERATED) | n/a |

**Still inline (Stage-A candidates):**

| Logic | Where (symbol, lines) | Why it matters |
|---|---|---|
| Reference grade ×3, quality flags ×2 | `openBacktestShell` 975–989; `score_backtest` 2310–2313 (amend one-liner) and 2337–2349 | Gate A/B denominators; a hand-kept mirror of the tested `src/lib/bids/referenceGrade.ts` |
| `delta_pct` ×2, verdict parse, shadow scoreboard | `score_backtest` 2268–2272, 2350; `score_shadows` 3256–3262, 3280–3294 (`last5_in_8pct`, `gate_b_met`) | calibration gate math, untested |
| `paste_counts` rows → priced total → lock tolerance | 2631–2648, 2667–2681, 2721 | **money**: the priced total must equal the LOCK, rounded to cents, with a `max($1, 0.1%)` tolerance |
| Quote lines, price memory, pick total | `put_quote` 1351–1383, 1433–1439; `finish_price_matrix` 1478–1497 | **money**: cents, options, what the estimator's matrix totals |
| `shapePricerRequest`, `pricerKey`, `pricerSlug` | 743–755, 786–789 | already pure, just not exported or tested |
| Robot-book entry shape | `extend_robot_book` 2771–2773, 2802–2805 | **money**: the global book price split |
| Blindness redaction | `get_answers` 1778–1820 | a leak here un-blinds a run (R2-BT-20 is the reason it exists) |
| Page-spec parse ×2 | 1293–1302, 2160–2171 | same parser, different defaults |
| Own/assigned fence ×12 | see Shared substrate | security; `ownsBid` beside `twinMayReadPlans` |
| Shadow eligibility ×5 | `get_shadow_queue` 2956–2979 + coverage 3014–3015; `next_shadow` 3137–3144 | blindness (unsent), discipline (plumbing), opt-out |

---

## Test coverage

- **`index.ts` itself: none.** No Deno test exists, no `src/**` test imports it, and it is neither type-checked nor linted in CI.
- **Covered:** only the kernels it imports (tables above), plus `mcpRouterWorker.test.ts` (3, the Worker), `desktopKickoff.test.ts` (24, the connector URL) and `TwinSetupDialog.render.test.tsx` (2).
- **Money and gate risk flags, all untested:**
  - `paste_counts` pricing and tolerance
  - `put_quote` validation and price memory
  - the `finish_price_matrix` pick total
  - the `extend_robot_book` price split
  - the edge copies of reference grade and flags
  - `delta_pct`
  - the shadow scoreboard (`gate_b_met`)
  - `get_answers` redaction

---

## Recommended extraction order

This follows the playbook: Stage A before Stage B within each unit, lowest coupling first, money and confidence-run families last. Every step must be behavior-preserving: the same refusal texts, write order and swallowed-versus-checked errors. **Verify with `npm test`, then deploy (`supabase functions deploy twin-mcp`), then check boot (dev-mcp `check_edge_boot`) and that `tools/list` (open) still returns 48.** A keyed smoke test needs the owner's twin key (`to-dos/mcp-servers.md`).

| # | Unit | Size (approx.) | Risk | Why here |
|---|---|---|---|---|
| 1 | **`TOOLS` → `twin-mcp/tools.ts`** (pure) + `twinMcpTools.test.ts` (unique, 48, ⊇ seat-gate sets) | −627 | low | largest block, zero logic; the test guards every later step |
| 2 | **Adopt `_shared/mcpJsonRpc.ts`**: widen `McpToolResult` for resource blocks, then `serve(mcpHandler({…}))`, `textContent` → `mcpText` | −~80 | low | the shell's own header asks for it; dev-mcp proves it |
| 3 | **Stage A, pure kernels:** `ownsBid` (twinSeatGate), `_shared/referenceGrade.ts` (move + client re-export), `twinScoring.ts`, `pasteCounts.ts`, `pricerQuote.ts`, `parsePageSpec`, `redactForBlindness` — each with tests pinning today's rounding | −~250 inline / +~300 kernel+tests | med | pins every untested money and gate rule before anything moves |
| 4 | **Call context** `twin-mcp/context.ts`: `resolveTwin`, `TwinCallContext { req, twin, admin, token }`, `resolveBidRef`, `isUuid`, `ledgerNote`. One client per call. | −~200 (37 clients, 19 resolvers) | low–med | every family module needs it; the refusal text is a parameter |
| 5 | **Dispatch table + low-risk families:** `dispatch.ts` (auth → `seatGate` → `HANDLERS[name]`, keeping the `Unknown tool` default); `verbs/docs.ts`, `verbs/questions.ts`, `verbs/submittals.ts`, `verbs/workState.ts` + `claimNextQueued` | ~480 moved | low–med | kernels are already tested; reads, or writes to twin infra only |
| 6 | **Shared IO helpers + their families:** `stagePdfPages`, `mintCompanionSession`/`walkMagicLink`, and the 3 inline CT bridge fetches routed through the existing `_shared/ctBridge.ts` `callCtManageUser` → `verbs/planPages.ts`, `verbs/session.ts`, `verbs/companions.ts` | ~450 moved, −~250 duplication | med | kills 2 PDF copies, 4 mint copies and 3 bridge copies |
| 7 | **`verbs/pricer.ts`** (after step 3's `pricerQuote.ts`) | ~517 | **high** | money on human bids plus global price memory |
| 8 | **`verbs/pipelineWrites.ts`** (after `pasteCounts.ts`) | ~301 | **high** | destructive replace, global robot book |
| 9 | **`verbs/backtests.ts` + `verbs/shadows.ts` + `verbs/_refs.ts`** (discipline, plumbing cache, teacher, probe) | ~735 | **highest** | blindness, claim races, fleet-wide scorer: last |

**Stays in `index.ts` / `dispatch.ts` permanently:** the auth → seat-gate → dispatch order, the `Unknown tool` default, the `Tool error` catch (inside `mcpHandler`), `serverInfo` and `instructions`, and the `briefs.ts` import.

---

## Hazards

**Money paths (the map documents these; it does not fix them).**

1. `paste_counts`: the replace deletes across 5 tables before inserting, and nothing is transactional. If assignments fail after the rows insert, the audit card reads $0 until a rerun with `replace: true`.
2. `put_quote` / `finish_price_matrix`: they write `bid_quotes`, `bid_quote_lines` and picks on the **human** bid a pricer holds a request for. The `supply_house_fixture_prices` upsert is global and swallowed.
3. `extend_robot_book` / `extend_component_rules`: they write **global** rows (`price_book_entries`, `fixture_types`, `fixture_component_rules`) that every later robot bid reads.

**Fences and role gates.**

4. Everything runs as the service role (`verify_jwt = false`), so no RLS backstop exists. A handler module that skips the dispatcher's `seatGate` would open estimator verbs to pricer keys.
5. The fences are spread across 12 own/assigned copies, `twinMayReadPlans`, `pricerMayTouchBid`, the `loadPricerRequest` claim, the submittal `claimed_by` check and the shadow `run.twin_user_id` check. **Preserve each refusal text**: the agents' briefs quote them.
6. **Unfenced by design:** `heartbeat` and `ask_question` resolve any bid by number (info-only stamps). `score_shadows` is **fleet-wide**: any estimator key scores every twin's locked runs and writes ledger lines on human reference bids.

**Blindness (code read, not verified live).**

7. The `score_backtest` LOCK gate is `ilike('notes', '%LOCK%')` (2281). A note containing "blocked" or "unlock" satisfies it.
8. The `score_backtest` amend lookup is by `run_label` alone (2294; `twin_run_scores.run_label` is globally `UNIQUE`). A shell that reuses another run's label gets that run's row back, including `reference_value`, and can amend its verdict.

**Wire, deploy and generation.**

9. The function is not type-checked or linted by CI, so the first sign of a broken move is a boot failure. Deploy is manual and separate from the client.
10. Adopting `mcpJsonRpc` changes the wire slightly, and nothing in the repo depends on it:
    - `isError` is omitted when false;
    - a missing `id` becomes `null`;
    - the GET 405 body prefix becomes `pipetooling-twin-mcp:`;
    - the order of the CORS header list changes.
11. `briefs.ts` is GENERATED from `docs/twins/*`, including `APP_DIRECTORY.md`, which CLAUDE.md requires page PRs to update. It drifts silently until someone regenerates and redeploys it. There is no CI check.
12. **Column-ladder fallbacks for "edge deployed ahead of push":** `resolveTwin` 708–712, `ask_question` 1752–1755, `finish_price_matrix` 1509–1510, and the best-effort `acted_at` in `next_shadow`. Keep them in a move. Retiring them is a separate PR, after the migrations are confirmed on prod.
13. The module-level `plumbingServiceTypeCache` (834) must stay module-scoped in whichever file owns it.

**Realtime and deep links.** There are no subscriptions and no inbound URL deep links. The outbound `redirectTo` defaults (`APP_ORIGIN` + `/bids`, `counttooling.com`, `takeofftooling.com`) sit in `mint_session`, and the two finishers hard-code the CT and TT ones again (2528, 2435).

### Quirks (preserve in a move, don't fix)

1. The `initialize` instructions (3312–3313) tell every client to call `get_brief` first, then `get_directory`, and offer `mint_session`, but a pricer key is refused `get_brief` and `mint_session` (they are not in `SHARED_VERBS`). The pricer's entry point is `get_pricing_guide`.
2. `open_backtest` defaults to round 1 (2090); `next_backtest` defaults to round 2 (2237).
3. Backtest shell reuse and the race guard are per twin (`created_by`, 997 / 1024); `open_shadow` reuse is per reference, across all twins.
4. The mint rate limit (6 per minute) counts **every** `twin_runs` row this twin wrote in the last minute, including heartbeats, reports and finisher logs. Only the CT and TT `mint_session` branches check it (1610–1612, 1643–1649). The two finishers mint without it, and PipeTooling mints defer to `twin-login`.
5. The two scorers round `delta_pct` with different expressions (2350 vs 3256/3262). Both give one decimal.
6. The fact sheet's Data line misses 5 dynamic table names: 3 `countFor` tables in `get_work_state` (`bids_takeoff_template_mappings`, `bids_takeoff_rough_part_lines`, `cost_estimates`) and 2 in the `paste_counts` replace loop (`bid_count_row_custom_prices`, `bid_count_row_submission_hides`).
7. There are 32 deliberate swallowed writes. A refactor that "adds error handling" is a behavior change, not a decomposition.
