# Takeoffs refresh — build plan (Old / New 1 / New 2)

---
file: docs/TAKEOFFS_REFRESH_PLAN.md
type: Plan
purpose: Build plan for the Bids → Takeoffs refresh: keep today's tab as "Old", ship the owner-picked mockups B ("One fixture at a time") as "New 1" and C ("Cost rail") as "New 2" behind per-device pills, on one shared substrate (coverage, a book that learns, fixture history, the RFQ door), then retire Old the way Counts / Pricing / Cover Letter did in v2.2707.
audience: Developers, AI Agents
last_updated: 2026-09-04
key_sections:
  - name: "Status"
  - name: "Why (ground truth, 2026-09-04)"
  - name: "What we're building"
  - name: "Design decisions (defaults — veto here)"
  - name: "The shared substrate"
  - name: "The PR train"
  - name: "Guardrails"
  - name: "Live-test gate"
  - name: "Retirement criteria"
---

## Status

**PRs 1–7 built (2026-09-04)** — the parallel run is live; PR 8 (a week of real use, coverage re-measured) and PR 9 (retire Old) remain. Owner picked **B → New 1** and **C → New 2** from the "Takeoffs Refresh" canvas; Old is today's tab, untouched and still the default.

| # | PR | Version | Landed as |
|---|---|---|---|
| 1 | Pills + Old | v2.2768 | #2504 |
| 2 | Substrate A — kernels | v2.2769 | #2505 |
| 3 | Substrate B — hooks (T8/T9) | v2.2770 | #2507 |
| 4 | Fixture-history RPC (migration `20260904202321`, pushed) | v2.2774 | #2510 |
| 5 | Fill from book under Combined | v2.2776 | #2513 |
| 6 | New 1 — one fixture at a time | v2.2778 | #2517 |
| 7 | New 2 — cost rail | v2.2781 | #2520 |
| — | Hardening: shared model toggle, row jumps into New 1 / New 2, smokes, retirement readiness | v2.2784 | this PR |

Versions are claimed per PR with `npm run claim` at build time — never pre-assigned here.

## Why (ground truth, 2026-09-04)

Numbers read from prod through the app's own session, bids created since 2026-06-01 (113 bids):

| Fact | Value |
|---|---|
| Combined vs By Stage | 112 vs 1 (the twin test bid B403) |
| Bids with counts but no takeoff at all | 57 |
| Fixture rows with any line, on bids that have a takeoff | 48% (1,126 of 2,368) |
| Bids fully costed | 1 of 41 |
| Count rows matching the human takeoff book (3 entries, 13 names) | 92 of 4,733 |
| Purchase orders created from a takeoff | 0 |
| Rough lines · bundle lines · $0 lines · manual overrides | 1,418 · 250 · 18 · 22 |

Two structural facts drive the design:

1. **`Apply Matching Fixture Assemblies` is inert under Combined.** `applyTakeoffBookTemplates` refuses with "Switch to Exact takeoffs to apply fixture assemblies" — so the tab's headline automation does nothing for 112 of 113 bids, and the book has never had a reason to grow past 3 entries.
2. **The same 15 row names recur 30–50× each** ("wco", "fco", "ft of 3/4in water", "2in 90 waste", "lav-1"…). The work is repetitive and nothing remembers it. A book that learns from finished fixtures and matches on the normalized name would auto-cover most of a new bid within a few bids of use.

Related incident (v2.2755/v2.2756): the tab's parts catalog was silently capped at 1,000 rows; every catalog read now pages, and the row-cap tripwire is live. Every new read in this plan pages from day one (`fetchAllRows` / `fetchAllRowsChunkedIn`).

## What we're building

Three views on the selected-bid card, picked by **Old / New 1 / New 2** pills beside the bid name (per-device `localStorage` key `bids_takeoff_view_v1`, values `'old' | 'new1' | 'new2'`, default **Old** until retirement — the v2.1906/v2.1909 playbook).

- **Old** — today's `BidsTakeoffTab` body, byte-for-byte: Combined sheet, By Stage table, book selector, Apply Matching, Print, materials summary + PO review. Untouched except for the pill row.
- **New 1 — "One fixture at a time"** (mockup B): a guided pass. Left rail lists the bid's fixtures with done / to-do / $0 dots and per-fixture totals; the right card shows the focused fixture — **what this fixture usually gets** (the book entry + the last three bids that had it, each with "Use these lines"), the lines on this bid (search-first editor), a **Remember for the book** checkbox, and **Done → next uncosted** (Enter). `Sheet view` button hops to New 2 without losing the fixture.
- **New 2 — "Cost rail"** (mockup C): today's table kept familiar (Add part line / Add assembly stay), with the book suggestion inline on each empty row and a sticky right rail: **What Pricing sees** (materials total, costed N of M with the "No Takeoffs cost" warning, per-fixture unit costs), **Needs a price** (the $0 lines → Request quotes), **Copy fixtures from a previous bid** (fills uncosted fixtures only), and **Book · learned on this bid**.

Both new views share one coverage strip (Costed N of M · Materials · $0 lines), one **Fill from book · N matches** primary action, and the same price-source tags on every line (lowest house · bid override · bundle · no catalog price).

## Design decisions (defaults — veto here)

1. **Combined only in New 1 / New 2.** By Stage stays reachable in Old (151 legacy bids, 1 since June). The new views render a one-line notice on an `exact` bid ("This bid uses By Stage — open it in Old") rather than porting the mappings engine. Retirement of By Stage is a separate owner call after Old retires.
2. **The book keeps its schema.** Entries stay fixture name + aliases; items stay `(template_id, stage)`. Under Combined a matched entry applies as **expand-to-parts** through the existing `applyRoughAddAssemblyTemplate` path (`expandTemplate` → lowest-price lines with `source_template_id`), never as a bundle line — per-part pricing stays visible and the bundle-price flow (`Save as Assembly` → "Use for takeoff") is unchanged. **No migration for the book.**
3. **"Remember for the book" = Save as Assembly + a book entry.** Finishing a fixture with the box ticked (a) creates or updates an assembly named after the normalized fixture key (e.g. `wc · book`) holding the fixture's part lines at their quantities via the existing `Save as Assembly` bridge, and (b) upserts a book entry for that key on the bid's selected book version (alias-appends when the entry exists). Materials → Assembly Book shows what the book learned; nothing new to administer. Bundle lines remember as the bundle's own template.
4. **Matching is on the normalized fixture key.** New kernel `takeoffFixtureKey.ts`: trim → lowercase → strip a trailing plan tag (`-12`, ` 2`, `_3a`) → collapse whitespace; `ft of …` rows keep their prefix (the labor/price books key on it — see `import-a-takeoff-from-counttooling`). Book matching, fixture history, and copy-from-bid all use this one key. Exact-name matches win over stripped matches; a manual pick always wins over a suggestion.
5. **Fixture history is one RPC, not a client scan.** `takeoff_fixture_history(p_service_type_id uuid, p_keys text[], p_exclude_bid_id uuid, p_bids_per_key int)` — `SECURITY INVOKER`, `STABLE`, `LANGUAGE sql`, deterministic ORDER BY (bid sent date desc, then bid id): for each key, the last N bids whose Combined lines exist on a count row with that key, returning `(key, bid_id, bid_number, project_name, sent_on, outcome, line_count, per_unit_cost, lines jsonb)`. RLS on `bids` / `bids_takeoff_rough_part_lines` runs as the caller. One migration; `SET lock_timeout = '3s'`; documented in `docs/migrations/`.
6. **Copy from a previous bid is a client write**, not an RPC: the history RPC already returns the lines; the client inserts them through `persistTakeoffRoughPartLine` (part ids are global; prices re-resolve to today's lowest catalog price with `source_material_part_price_id`, the source bid's manual overrides are NOT copied — a note says so).
7. **Request quotes reuses the RFQ system as is.** The $0-line door opens `RfqComposeModal` for the bid with the affected part ids preselected in `scope`; picked prices already land on bid costs (RFQ Round 2 rung G, v2.2655). No new RFQ surface.
8. **Keyboard flow lives in New 1 only.** Enter after a pick = Done → next uncosted; ↑/↓ move the focused fixture; Esc closes the search. New 2 stays mouse-first (its promise is "least retraining").
9. **Coverage counts a fixture as costed when it has ≥1 line**, even a $0 one; $0 lines are their own tile and dot color (red) so an incomplete fixture is visible without changing the definition Pricing already uses (`pricingFixtureMaterialsFromTakeoff`).
10. **Every view keeps the engine as the single source of truth.** No new persistence path: New 1 / New 2 call the same `updateTakeoffRoughPartLine` / `persistTakeoffRoughPartLine` / `removeTakeoffRoughPartLine` / `applyRoughAddAssemblyTemplate` handlers (moved into a hook — see substrate). The `queueMicrotask` persistence pairs move together, per the architecture map's preserve-quirks list.

## The shared substrate

Built first, because both new views and the eventual retirement stand on it. Pure kernels in `src/lib/bids/`, each with colocated vitest tests; the tab's handlers move into one hook.

| Piece | Where | What |
|---|---|---|
| Fixture key | `lib/bids/takeoffFixtureKey.ts` | `fixtureKey(name)` + `stripPlanTag`; the one normalizer for book / history / copy. Tests on the 15 most common prod names ("wco", "fco", "ft of 3/4in water", "lav-1", "2in 90 waste", "WC-12"). |
| Coverage | `lib/bids/takeoffCoverage.ts` | `summarizeTakeoffCoverage(countRows, lines)` → fixtures, costed, uncosted ids, materials total (count × qty × price, per-ft rows by feet), $0-line ids, bundle count, override count, per-fixture unit cost. Same math as `sumRoughLinesPreTaxWithCount` (reuse it), so the strip equals what the Labor tab and Pricing already show. |
| Book matcher | `lib/bids/takeoffBookMatch.ts` | `matchBookEntries(countRows, entries, items)` → per count row: `{ entryId, templateIds, exact: boolean } \| null`. Replaces the inline loop in `applyTakeoffBookTemplates` (the architecture map's Stage-A item `computeTakeoffBookMappingsToAdd`). |
| Book learn | `lib/bids/takeoffBookLearn.ts` | `planRememberForBook(fixture, lines, existingEntries)` → the assembly name, the item drafts, and whether to create an entry or append an alias. Pure; the writes stay in the hook. |
| History shaping | `lib/bids/takeoffFixtureHistory.ts` | Groups the RPC rows per key, picks "Same as B383" chips (most recent, then won-over-lost), and builds the copy-from-bid preview (which uncosted fixtures a source bid can fill, how many lines). |
| Persistence hook | `hooks/useTakeoffRoughLines.ts` | Extracted **as is** from the tab (the T9 seam the map already names): `addTakeoffRoughPartLine`, `updateTakeoffRoughPartLine`, `persistTakeoffRoughPartLine`, `removeTakeoffRoughPartLine`, `setRoughPartLinePartAndCatalogPrice`, `resetRoughLineToCatalogPrice`, `applyRoughAddAssemblyTemplate`, `insertRoughBundleLine`, the reorder handler, plus the v2.2755 missing-part fallback effect. Old keeps calling it through the tab; New 1 / New 2 call it directly. Behavior-equivalent move — the render smoke must pass unchanged. |
| Catalog seam | `hooks/useTakeoffPartsCatalog.ts` | The T8 seam: `takeoffAddTemplateParts` + its loads (already on `loadPartsCatalog`), `supplyHouses` / `partTypes`, `takeoffTemplatePreviewCache`. |
| Fixture history RPC | migration + `lib/bids/takeoffFixtureHistoryRpc.ts` | Decision 5. Client wrapper pages nothing (the RPC is bounded by `p_bids_per_key`); guard the input with 150-key chunks. |

Presentational pieces shared by both views: `TakeoffCoverageStrip` (tiles in the Workbench `stat` idiom), `TakeoffPriceSourceTag`, `TakeoffBookSuggestion` (the inline "Book: … Apply" band), `TakeoffViewPills`.

## The PR train

One change per PR, cut from fresh `main`, auto-merge, docs + release note + help guide in the same PR. Each build PR ends with the live-test gate below on a worktree dev server as Robert (dev) **and** via `login-as-user` as an estimator.

| # | PR | Scope | Migration | Gate |
|---|---|---|---|---|
| 0 | **Pills + Old** | `TakeoffViewPills`, `bids_takeoff_view_v1`, the three-way render switch with New 1 / New 2 as "coming soon" placeholders that say which mockup they are. Old unchanged. | — | Old renders identically on BP396 / BP398 / an `exact` bid; pill persists per device; render smoke unchanged. |
| 1 | **Substrate A — kernels** | `takeoffFixtureKey`, `takeoffCoverage`, `takeoffBookMatch` (+ `applyTakeoffBookTemplates` calls the kernel; behavior identical in Old), `takeoffBookLearn`. Tests only surface. | — | `npm test`; Old's Apply Matching still refuses under Combined (unchanged until PR 4). |
| 2 | **Substrate B — hooks** | `useTakeoffRoughLines` + `useTakeoffPartsCatalog` extracted from the tab; the tab shrinks by ~600 lines; nothing visible changes. | — | Render smoke + a manual pass over every Combined action on BP396 (add line, pick part, qty pad, reorder, delete, bundle, Save as Assembly, catalog prices, reset). |
| 3 | **Fixture history RPC** | Migration `takeoff_fixture_history` + `docs/migrations/` fragment + client wrapper + `takeoffFixtureHistory.ts` shaping kernel. Deployed client-first (nothing calls it until PR 5), then `supabase db push`, then `gen-types:linked`. | **yes** | RPC returns BP383's sink lines for key `s` as Robert and as an estimator; returns nothing for a bid the caller can't see. |
| 4 | **Fill from book under Combined** | The matcher drives a **Fill from book · N matches** action available in all three views (Old's button stops refusing Combined — it becomes this). Applies each match by expand-to-parts; skips fixtures that already have lines; toast lists what it filled. | — | Seed the Default book with 5 entries on the live twin bid B403's service type; Fill covers the matching rows on a fresh copy of BP396; no duplicate lines on a second click. |
| 5 | **New 1 — One fixture at a time** | Rail + focused card + history cards + Remember for the book + Done → next + Sheet view hop. Help guide `cost-a-takeoff-one-fixture-at-a-time.md`. | — | Cost BP396 end to end in New 1 by keyboard; ticking Remember creates `wc · book` in Materials → Assembly Book and a Default-book entry; the next bid's `WC-3` row gets the suggestion. |
| 6 | **New 2 — Cost rail** | Table + inline suggestions + the rail (What Pricing sees / Needs a price → `RfqComposeModal` / Copy fixtures from a previous bid / Book learned). Help guide `see-what-pricing-sees-on-takeoffs.md` (or fold into the New 1 guide — owner call). | — | Rail total equals the Workbench "our cost"; Request quotes opens the RFQ with the $0 part preselected; Copy from B383 fills only uncosted fixtures and re-prices to today's lowest. |
| 7 | **Parallel run + polish** | Owner and Wendi run New 1 / New 2 on real bids for a week; fixes land as small PRs. `docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md` and `docs/BIDS_SYSTEM.md` updated to the three-view shape. | — | Coverage on new bids measured again (the "Why" table re-run). |
| 8 | **Retire Old** | Owner call, v2.2707 shape: pills go, `bids_takeoff_view_v1` abandoned in place, Old body deleted, New 1 default with New 2 as a toggle (or the reverse — owner picks from usage). By Stage's fate decided separately. | — | `tsc -b` clean; render smokes rewritten; `docs/BIDS_SYSTEM.md` "sole view since". |

PR 0–2 can ship the same day; PR 3 needs its `db push` window; PR 4 unblocks value in Old immediately (the inert button starts working); PR 5 and 6 are independent of each other once 1–4 are in.

## Guardrails

- **Preserve-quirks list** in `docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md` is binding for PR 2: the `queueMicrotask` persistence pairs move together; the rough table wrapper keeps NO `overflow: hidden` (v2.1059 picker clipping); `takeoffRemoveConfirm` stays tab-level; the PartFormModal-routed part-id bridges stay parent-owned.
- **Row cap**: every new read pages (`fetchAllRows` / `fetchAllRowsChunkedIn`); the RPC is bounded by its `p_bids_per_key`; watch the console for `[row-cap]` on every live test.
- **Versions**: the active bid version scopes every read and write (`bid_version_id`; NULL = unsplit). History and copy-from-bid read the *source* bid's active version only.
- **Book writes are additive**: Remember never edits an existing assembly's items silently — an existing `wc · book` assembly gets a versioned sibling (`wc · book 2`) and the entry's items append; the owner prunes in Materials.
- **Roles**: dev, master_technician, assistant, estimator write; primary / superintendent read the Takeoffs tab today — New 1 / New 2 render their editors disabled for read-only roles (`users.read_only` and the read-only bid roles), same as the Audits tab (v2.2520).
- **Theme tokens only** (`node scripts/theme-tokenize.mjs --check src`); the mockups' hexes map to `--surface`, `--bg-subtle`, `--border`, `--text-muted`, `--text-blue-700`, `--bg-blue-tint`, `--text-amber-700`, `--bg-amber-tint`, `--text-red-700`, `--bg-red-tint`, `--text-green-700`, `--bg-green-tint`.
- **Search standardization** (memory: search header row) does not apply — the part search is a picker, not a job/bid search.
- **No `any`**; `withSupabaseRetry` on every read; help guides ship with PR 5 and 6; release-note fragment per PR.

## Live-test gate

Every build PR, before merge, on a worktree dev server:

1. `npm run typecheck && npm run lint && npm test && node scripts/theme-tokenize.mjs --check src`.
2. As Robert on BP396 (unsplit, Combined) and BP398 (own pricing copies): the PR's scenario from the train table.
3. As an estimator via `login-as-user` (Wendi's role): the same scenario; confirm RLS lets the write through and the history RPC returns only bids she can see.
4. Console clean: no `[row-cap]`, no unhandled rejection, no 4xx from a new read.
5. Pricing cross-check: Workbench "our cost" for the bid equals the coverage strip's materials total.

## Retirement readiness (what is already shared, what still dies with Old)

Audited 2026-09-04 after PR 7 (hardening PR v2.2784). **Shared by every view today** — safe to keep when Old goes: the header (title, pills, Print, ×), the **materials-model toggle** (moved out of the Old branch in the hardening PR — it is the only door that flips a bid between By Stage and Combined), `renderRoughLinesTable` (the whole Combined line editor: drag context, header, rows, add-line footer), every tab-level modal (remove-confirm, qty numpad, Part form, part prices, bundle breakdown, the assembly-authoring cluster, the rough Add-assembly modal, the RFQ compose), the takeoff-book admin section, the materials summary + PO review, `useTakeoffRoughLines`, `useTakeoffPartsCatalog`, `useTakeoffFixtureHistory`, and every kernel. **Still Old-only** — dies with Old: the By Stage editor (mappings table, template picker portal, assembly parts preview modal, `createPOFromTakeoff` / Add to selected PO — 0 uses since June, 151 legacy `exact` bids), Old's own book selector + Apply/Fill row (New 2 has its own selector; New 1 uses the bid's saved book), and Old's "Add fixtures in the Counts tab first" empty state.

Parity checklist (Old feature → where it lives after retirement):

| Old feature | New 1 | New 2 |
|---|---|---|
| Add part line / pick / price / qty numpad / reorder / delete | same editor (`renderRoughLinesTable`) | same |
| Add assembly → expand / bundle, Save as Assembly, bundle breakdown | same modals | same |
| Catalog prices / reset to catalog / bid override tags | same rows | same |
| Takeoff book selector | bid's saved book (name shown; change it in New 2 or the admin section) | selector |
| Apply Matching / Fill from book | Fill from book + per-fixture Apply | Fill from book + inline Apply |
| Print takeoff breakdown | shared header | shared header |
| Materials summary + PO review | shared section | shared section |
| By Stage editor | notice → Old | notice → Old |
| Cross-tab row jump (Pricing → Takeoffs) | focuses the fixture (hardening PR) | drops the filter (hardening PR) |

Render smokes pin New 1, New 2, and the By Stage notice (hardening PR), so deleting the Old branch cannot silently take a new view down.

**Retirement PR recipe** (the v2.2707 shape): pills → a two-way `Sheet | One at a time` toggle, default the owner picks from the week's use; delete the Old branch JSX, the By Stage editor, `createPOFromTakeoff`, the template picker portal and preview modal (or keep By Stage read-only if the owner wants the 151 legacy bids viewable); abandon `bids_takeoff_view_v1` in place; rewrite the Old-only smoke assertions; `docs/BIDS_SYSTEM.md` "sole views since"; retitle the help guides that say "Old"; architecture map: the Exact dossier becomes history.

## Retirement criteria

Old retires (PR 8) when, over one week of real use: every bid costed that week was costed in New 1 or New 2; no "go back to Old to do X" report is open; fixture coverage on new bids is measurably above the 48% baseline; and the owner says so. Until then the default stays Old.

## Out of scope (say no unless re-asked)

By Stage retirement or port; a server-side part search (`ilike`) — revisit if the catalog passes ~5k parts; a near-duplicate guard on Add Part (worth its own small PR, not part of this train); purchase-order generation from Combined takeoffs (0 uses since June).
