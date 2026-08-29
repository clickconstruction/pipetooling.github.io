# RFI loop: phased code plan

---
file: docs/RFI_LOOP_PLAN.md
type: Engineering / Migration plan
purpose: Staged plan to build the cross-app RFI loop — ambiguities flagged on the CountTooling canvas travel to the PipeTooling bid, get human-approved and sent through the bid's GC machinery, and their answers re-enter the pipeline — with every transition auditable on the bid. First tooling wave of the estimator-twin pipeline ("Estimator Twin Pipeline" artifact, 2026-08-28); designed to serve human estimators identically.
audience: Developers, AI Agents
last_updated: 2026-08-28
sections:
  - The thesis
  - Owner decisions (locked)
  - The loop's anatomy
  - Phase R1 — RFI spine in PipeTooling
  - Phase R2 — CT capture + the clipboard seam
  - Phase R3 — Internal lane (twin_questions) + graduation
  - Phase R4 — ct-bridge auto-pull
  - Phase R5 — Assumptions discipline at the letter
  - Phase R6 — Live test on LIVSTE + iterate
  - Cross-cutting rules & risks
  - Status log
---

## The thesis

An RFI is born **on the canvas** (a fixture on the plan missing from the P002 schedule, a riser
that disagrees, an unlabeled line — a location on a sheet) but is **sent through the bid** (GC
contacts, per-GC send attribution, email templates live in PipeTooling). Today the RFI tab is a
document *builder* — compose, copy, no memory. The loop needs a persisted queue on the bid so
that drafts accumulate from any source (human typing, CT canvas flags, twin substrate
reconciliation), a human approves sends, answers land, and the whole exchange reads back in
order from the bid's ledger. **RFIs are non-blocking**: counting continues, and every RFI still
open when the proposal goes out must surface as an explicit assumption or exclusion — never a
silent guess.

Two question lanes stay distinct: **external** (company ↔ GC — this plan) and **internal**
(twin ↔ owner — `twin_questions`, Phase R3). They meet only at a deliberate graduation step
("should I ask the GC?" → promote to RFI draft).

## Owner decisions (locked, 2026-08-28)

- **Audience**: send step picks GC(s) **per RFI**, defaulting to all currently-bidding GCs —
  rides the per-GC machinery (`docs/PER_GC_BID_PLAN.md`).
- **Gate**: **estimator and up** approve and send (RFIs are routine estimating
  correspondence, unlike proposals). **Twins draft only** — enforced structurally, not by
  convention (see R1).
- **Wave 1 = R1 + R2**, then test on LIVSTE before R3+.
- **Record ≠ transport**: the PT row is the system of record for what was asked / when / of
  whom; the message may travel by app email later, or by PlanHub Q&A / plain email manually
  forever. "Mark sent" with a channel is a first-class outcome, not a fallback.

## The loop's anatomy (the template all loops reuse)

trigger location → carrying record → human gate → re-entry point → audit stamps.
For RFIs: CT canvas / substrate → `bids_rfis` row on the bid → estimator approves & sends →
answer patches takeoff (CT) or scope (letter) → bid notes at create / send / answer.
The addenda loop and the review changes-requested loop instantiate the same schema later.

## Phase R1 — RFI spine in PipeTooling (one PR + one migration)

**Migration** (`supabase migration new bids_rfis`; `SET lock_timeout = '3s';` first line):

- `bids_rfis`: `id`, `bid_id` FK, `rfi_number` (per-bid sequence, assigned on create),
  `question text`, `sheet_ref text` (e.g. "P201 near 3/B"), `source text`
  (`manual` | `ct_note` | `substrate`), `status text`
  (`draft` → `approved` → `sent` → `answered` | `withdrawn`), `sent_at timestamptz`,
  `sent_via text` (`email` | `planhub` | `phone` | `other`), `sent_to jsonb`
  (array of `{gc_customer_id, name}` — per-RFI pick, default all bidding GCs),
  `answer text`, `answered_at`, `answer_ref text` (e.g. "Addendum 1"),
  `created_by`, `created_at`, `updated_at`.
- RLS for all 9 roles (mirror `bids_submission_entries` coverage); **end with BOTH read-only
  appliers AND `SELECT public.apply_digital_twin_write_blocks();`** (bid-family table).
- **Twin draft-only, structurally**: an additional RESTRICTIVE policy for twin users with
  `WITH CHECK (status = 'draft')` on INSERT/UPDATE — a twin can create and edit drafts on its
  assigned bids but can never set `approved`/`sent`/`answered`. Humans (estimator+) transition
  status; role check mirrors existing estimator-gated writes.

**Client** (`BidRfiTab.tsx` upgrade, keeping `src/lib/bidDocuments/rfi.ts` as the formatter):

- Per-bid queue: draft list with status chips, compose form now saves a row (today's
  copy-HTML/copy-text builders keep working, fed from the saved row).
- Transitions: Approve → GC picker (default all bidding GCs, from the bid's GC list) →
  "Mark sent" with channel picker; Answer box (+ optional `answer_ref`); Withdraw.
- **Kernel** `src/lib/bids/rfiFlow.ts` (+tests): allowed status transitions, per-bid numbering,
  `rfisToAuditNote(rfi, event)` note text, and `openRfisAtSend(rfis)` used later by R5.
- **Audit stamps**: create / send / answer each insert a method-less bid note (v2.2413 rule:
  notes never move the chase clock — the ledger becomes the loop's flight recorder for free).
- Docs ship with the PR: help guide (`src/content/help/`), release note + recent-features
  fragment, `docs/migrations/` fragment, ACCESS_CONTROL row, BIDS_SYSTEM section.

**Deploy**: client first, then `supabase db push` (no edge functions in R1).

## Phase R2 — CT capture + the clipboard seam (two small PRs)

**CT PR** (counttooling repo): the capture convention is the existing **note annotation with an
`RFI:` prefix** — zero new drawing tools, works for humans and for the twin's `takeoff.json`
alike. Build: a small `features/rfi-flags.js` that lists `RFI:`-prefixed notes across pages
(page name, note text) with one **Copy RFI flags** button producing tab-delimited
`Sheet ⇥ Question` lines (the `copy-tooling-feet` denomination discipline applies: page names
exactly as the pages list shows them). Playwright spec alongside.

**PT PR**: paste-import on the RFI tab — same seam the shop already trusts for counts
(`BidsCountsTab` precedent): paste → parsed rows become `bids_rfis` drafts with
`source: 'ct_note'` and `sheet_ref` from the page column. Import is append-only and
de-duplicates on exact question text.

Why clipboard first: it needs no bridge work, it is human-drivable end to end (Wendi can flag
while drawing and import at her desk), and it exercises the queue with real content before any
automation exists.

## Phase R3 — Internal lane + graduation (one PR + one migration + twin-mcp redeploy)

- Migration: `twin_questions` (`twin_user_id`, `bid_id` nullable, `mission text`,
  `question`, `status` `open`|`answered`|`promoted`, `answer`, `answered_by`, timestamps) +
  RLS + both read-only appliers + twin fence (twins insert/read **their own** rows only).
- twin-mcp tools `ask_question` / `get_answers` (briefs regenerated —
  `node scripts/build-twin-mcp-briefs.mjs` — and `twin-mcp` redeployed; warm-isolate gotcha:
  redeploy, don't just set secrets).
- Answer surface: a **Questions** block in the Digital twins panel (Settings → System) with an
  answer box, plus a **Promote to RFI** button when `bid_id` is set — creates a `bids_rfis`
  draft and marks the question `promoted`. This is the only door between the lanes.

## Phase R4 — ct-bridge auto-pull (later; replaces the clipboard for linked projects)

A bridge op on CT (pattern: `_shared/ctBridge.ts` consumers) that lists a project's
`RFI:`-prefixed notes; the PT RFI tab shows "Flags from CountTooling" for the bid's
`count_tooling_plans_link` project with one-click import (`source: 'ct_note'`, same dedupe).
Clipboard path stays for unlinked projects.

## Phase R5 — Assumptions discipline at the letter (small PR)

`openRfisAtSend` (R1 kernel) drives a Cover Letter tab warning chip when a letter is being
sent while RFIs sit unanswered, and a **suggested** (never auto-applied — the loss-reason
doctrine) assumption/exclusion line per open RFI ("assumes WC-2 per schedule; RFI-3 sent 9/2,
unanswered"). The scope sheet stays honest without blocking the send.

## Phase R6 — Live test on LIVSTE + iterate

Run the loop for real before building more: reconcile the LIVSTE substrate (P002 schedule vs
P201/P601), flag 2–3 genuine ambiguities as drafts on the LIVSTE bid, approve, mark sent
(PlanHub Q&A manually — record ≠ transport), record answers as they come, and read the bid's
note ledger back as the audit trail. Success = the ledger tells the whole story without this
plan doc in hand. Learnings feed R3–R5 ordering; a scored twin mission (M-RFI) comes after the
internal lane exists.

## Cross-cutting rules & risks

- **Fence verification per phase**: after each migration, spot-probe as the twin (dev-login
  `?as=twin:estimator:1`) — draft insert on an assigned bid succeeds; any insert on an
  unassigned bid and any status transition are refused loudly. The silent-UPDATE guard
  (v2.2454/2461/2466) already covers the failure shape client-side.
- **Per-bid numbering** must come from the DB (sequence per bid via trigger or
  `max(rfi_number)+1` inside the insert RPC) — client-side "max+1" races parallel sessions,
  same lesson as version claims.
- **No new communications store**: RFI *audit stamps* are bid notes, but RFI content lives in
  `bids_rfis` — do not fold RFIs into `bids_submission_entries` (entries are contacts/notes;
  an RFI is a document with a lifecycle).
- **Twins draft-only is structural** (RLS), not mission text — this is the pattern the
  no-send line should eventually follow.
- CT repo work follows CT conventions (vanilla JS feature file + Playwright spec + ARCHITECTURE
  row); CT migrations apply via Supabase MCP there (its `db push` refuses) — opposite of PT.

## Status log

- 2026-08-28 — Plan written; decisions locked (per-RFI GC pick / estimator+ gate / wave 1 =
  R1+R2). Nothing built yet.
- 2026-08-29 — **R1 SHIPPED** (v2.2480, migration `20260829023703` pushed): bids_rfis +
  BidRfiQueue on the RFI tab + rfiFlow kernel; twin draft-only landed as RESTRICTIVE
  per-command policies. **R2 SHIPPED both halves same day**: CT `features/rfi-flags.js`
  (Copy RFI Flags, counttooling main) + the PT paste-import (rode the R1 PR — same
  surface). **R6 first live walk on b403 (ZZ Twin LIVSTE)**: two real substrate-born
  RFIs drafted (gas-vs-COMcheck-all-electric; sprinkler trade boundary), RFI-1 walked
  draft→approved→sent (planhub channel, Knight default pick), all four ledger stamps
  landed method-less; twin probe: Approve refused LOUDLY ("Twins update drafts only on
  bids_rfis"), twin draft succeeded (RFI-3). Remaining: R3 (twin_questions), R4
  (ct-bridge auto-pull), R5 (letter assumptions chip).
