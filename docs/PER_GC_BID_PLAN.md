# Per-GC bids: phased code plan

---
file: docs/PER_GC_BID_PLAN.md
type: Engineering / Migration plan
purpose: Staged plan to finish making the GC relationship the unit of truth on multi-GC bids — contacts ledger foundation, per-GC Won/Lost in Edit Bid, the bid→job winning-GC flow, and a bid_gcs state table for due/submitted-to/ITB. Written 2026-08-27 from a full code audit; decisions + mockups in the "Edit Bid, Per GC" artifact canvas.
audience: Developers, AI Agents
last_updated: 2026-08-27
sections:
  - The thesis
  - Owner decisions (locked)
  - The recipe every phase reuses
  - Phase 1 — Contacts foundation
  - Phase 2 — Per-GC Won/Lost in Edit Bid
  - Phase 3 — Bid→Job winning-GC flow
  - Phase 4 — bid_gcs state table (due / submitted-to / ITB)
  - Cross-cutting rules & risks
  - Open questions
  - Status log
---

## The thesis

A bid has become **one project, estimated once, offered to N GCs**. Each GC relationship already
carries its own counts/takeoff/prices (versions), letter, send records (v2.2407), notes
(`gc_customer_id` on the entries ledger, v2.2217), and — in data — outcome
(`bid_versions.outcome` + `rollUpOutcome`). What remains are bid-level fields that are really
relationship facts: **Win/Loss, Last Contact, Due Date, Submitted-to, ITB links** — plus a job
import that hard-codes the wrong GC. Don't build new systems: finish the joints, using the
derived-roll-up recipe v2.2407 proved.

## Owner decisions (locked, 2026-08-27)

- **Contacts**: `bids_submission_entries` is the one communications store. Every contact is an
  entry; nothing writes `bids.last_contact` directly. **Only entries with a `contact_method`
  count as contacts** — method-less notes are notes and do NOT move last-contact or silence the
  quiet-bid nag. Entries with `gc_customer_id` NULL count as the bid's OWN GC.
- **Build order**: Phase 1 (contacts) → Phase 2 (per-GC Won/Lost) → Phase 3 (bid→job) →
  Phase 4 (`bid_gcs`). Each phase ships alone.
- Bid-level roll-up rules: sent = FIRST send (shipped v2.2407) · last_contact = LATEST method
  entry · outcome = `rollUpOutcome` (any won → won; all sent lost → lost) · due = EARLIEST due
  among UNSENT packets (Phase 4).

## The recipe every phase reuses (v2.2407 precedent)

1. Truth lives per GC (ledger rows or packet/`bid_gcs` state).
2. The bid-level column becomes **derived**: client writes the same derived value on every
   mutation (pre-push window behaves identically), a DB trigger makes it unconditional.
3. Existing readers (board, lenses, pickers, Followup) keep reading the bid-level column —
   zero changes to them per phase.
4. Backfills converge existing data; hand-set values on rows with no per-GC data are never
   touched (the trigger only fires on per-GC activity).
5. Every migration: `SET lock_timeout = '3s';` first line; new tables end with BOTH
   `SELECT public.apply_read_only_write_blocks();` and `SELECT public.apply_read_only_stmt_blocks();`.

## Phase 1 — Contacts foundation

Today `bids.last_contact` has 7 writers: six surfaces insert a `bids_submission_entries` row
then hand-bump the column (GC notes popover, `UnifiedBidCustomerNotes`, Waiting-to-hear,
Call queue, Call-session modal, Builder review); Edit Bid's datetime field writes the column
with **no entry** — contact state with no history.

**1a — migration `sync_last_contact_from_entries`** (function + row trigger on
`bids_submission_entries`, INVOKER rights like `sync_bid_date_sent_from_sends`):

```
bids.last_contact = max(occurred_at) over the bid's entries WHERE contact_method IS NOT NULL
```

NULL when none. Backfill the same rule. **Announce the behavior change in the release note**:
bids whose last_contact was bumped by method-less notes will move backward and may reappear in
Waiting-to-hear — that is the point, not a bug.

**1b — Edit Bid**: replace the raw "Last Contact" field with a read-only derived display +
**Log contact…** (method required — reuse `ContactMethodQuickPicks` — occurred_at defaults now
and is backdatable, note optional, GC picker on multi-GC bids defaulting to own GC). Writes an
entry; never the column. Applies to version-less bids too — contact is not version-dependent.
Parent-sync note: like `onGcRollupDateChanged` in v2.2407, sync the form state so Save doesn't
clobber the derived value (Bids.tsx owns `lastContact` state today).

**1c — writers stop bumping / start attributing**:
- Make the six hand-bumps *method-conditional* in the same PR (harmless duplicate of the
  trigger's value during the deploy window); remove them entirely in a follow-up cleanup PR
  after the push.
- Call queue / Call-session modal / Waiting-to-hear chase log / Builder review pass the
  `gc_customer_id` they are contacting (they already know it; today they write NULL).

**1d — per-GC display**: `BidGcSentPanel` cards gain a "last contact" line = latest method
entry for that GC (NULL-GC entries count toward the own GC). Kernel:
`lastContactByGc(entries)` in a new `src/lib/bids/bidContacts.ts` (+ tests: method filter,
NULL→own-GC, per-GC grouping, empty).

**1e — Waiting-to-hear**: staleness reads per-GC latest method entry (it already loads the
entries and knows recipients); the "log a chase" write is already an entry — it just gains
`gc_customer_id` (1c) and a method.

PR shape: one PR (migration + client), push migration right after merge; then the cleanup PR.
Docs: migration fragment, release note (behavior change up front), recent-features fragment,
help-guide touch (`follow-up-with-builders`).

## Phase 2 — Per-GC Won/Lost in Edit Bid

No schema. The board's GC pills already write per-packet outcomes via `setGcPacketOutcome`
(bid_versions.outcome + loss_category + roll-up); Edit Bid's Win/Loss segment hand-writes
`bids.outcome` past them.

- `BidGcSentPanel` cards gain **Won** / **Lost…** (loss-category chips + note — same
  `BidLossCategoryChips` flow the board pill popover uses) / back-to-waiting.
- On bids WITH versions the bid-level Win/Loss segment becomes a **read-only derived display**
  (`rollUpOutcome`), with "set per GC below ↓". Version-less bids keep today's segment.
- The bid-level Started/Complete option stays hand-set for now (see Open questions).
- Guard: Bids.tsx save must not write `bids.outcome` from stale segment state on version bids
  (same clobber pattern as 1b/v2.2407 — sync or exclude).

## Phase 3 — Bid→Job winning-GC flow

Today `JobFormModal` "Import from bid" sets job GC = `bids.customer_id` (v2.1182) — wrong
customer whenever a non-primary packet won. `jobs_ledger` already has `bid_id` +
`gc_customer_id`.

- Import reads the bid's packets (reuse `groupVersionsByGc` inputs): if exactly one packet is
  `won`, import from it — job `gc_customer_id`/customer = its GC, revenue seed = its ★ /
  letter total (packet `sentValue`, fallback ★ scenario revenue), plans/link context unchanged.
- **No winner yet** → one dialog: "Which GC gave you this job?" — packets listed sent-first
  with ★ values; choosing writes that packet's outcome `won` (same `setGcPacketOutcome` path,
  roll-up included) and imports from it. One answer, two records, never diverging.
- **Losing packets**: offered (never automatic) one-click "Close N other packets — GC lost the
  project" using the existing `gc_lost` loss category.
- `bids.agreed_value` seeds from the won packet's ★ when empty; always editable.
- Multiple packets already `won` (rare/legacy): dialog asks which one the JOB is for; writes
  nothing to outcomes.
- Kernel: `resolveWinningPacket(packets)` + import-payload builder (+ tests). Version-less
  bids keep today's exact flow.

## Phase 4 — bid_gcs state table (due / submitted-to / ITB)

Contact, sent, and outcome all derive — but due date, submitted-to, and ITB links are
**state**, and a GC with three versions has ONE due date. They need a home.

**4a — migration `bid_gcs`**: `id uuid pk, bid_id fk cascade, customer_id uuid NULL fk`
(NULL = the bid's own GC), `due_date date NULL, due_time time NULL,
submitted_to_name/phone/email text NULL, itb_links jsonb NOT NULL default '[]'`,
timestamps/created_by. Uniqueness: `UNIQUE (bid_id, COALESCE(customer_id, '00000000-…'))`
via expression index. RLS mirrors `bid_version_sends` (`can_access_bid_for_pricing`).
New table → BOTH read-only blocks. Rows are **created lazily** on first per-GC edit;
recipients (shared-letter GCs) get rows too when edited.

**4b — derived bid due**: one function `recompute_bid_due(bid_id)` sets
`bids.bid_due_date = min(due among packets with no send)`, falling back to min(all per-GC
dues), untouched when no `bid_gcs` rows carry dues (hand-set dates keep working). Called from
triggers on BOTH `bid_gcs` and `bid_version_sends` (a send changes which dues are "open").
Board urgency + due chips + lenses keep reading `bids.bid_due_date` unchanged.

**4c — Edit Bid**: GC cards gain Due (date+time), Submitted-to (name/phone/email), ITB links
(list editor, `PasteButton` like today's). On version bids the bid-level Due/Submitted-to/ITB
fields become own-GC editors (writing the own-GC `bid_gcs` row) with the derived roll-up shown;
`bids.submitted_to` and `bids.itb_links` stay as legacy fallback reads until a later backfill
retires them (no destructive migration in this phase).

**4d — readers**: Followup/Waiting-to-hear may later chase per-GC due; not required for this
phase (roll-up keeps them correct).

## Cross-cutting rules & risks

- **Deploy order every phase**: client merges first, `supabase db push` immediately after
  (client writes the derived value itself in the window — the v2.2407 pattern).
- Regenerate types per migration (`npm run gen-types:linked`) — watch the worktree truncation
  gotcha (see memory); hand-add if regen pulls unrelated drift.
- `pg_safeupdate` trap: any bare UPDATE/DELETE in RPC bodies needs a WHERE (v2.1173).
- Never rebuild live function bodies from the baseline — start from the newest migration
  defining them.
- The board loads packets once per bid (`useBidGcPackets` / `gcPacketsByBid`) — Phases 2–4 add
  zero queries to the board; Edit Bid panels load per-open (fine).
- Parallel-session hygiene: claim `v2.NNN` + migrations via `npm run claim` at PR time; expect
  version-number races (this week produced several).
- Each phase: release note + recent-features fragment + migration fragment (when any) + help
  guide touch + `BIDS_SYSTEM.md` section update; this plan's Status log updated per shipped PR.

## Open questions

1. Should a job linked via `bid_id` auto-derive the bid's `started_or_complete`? (Deferred —
   decide during Phase 3.)
2. Retiring `bids.submitted_to` / `bids.itb_links` after Phase 4 settles (backfill own-GC rows
   then drop?) — revisit once per-GC editing has real usage.
3. Does per-GC due-date editing need any attestation-style guard? (Current stance: no — due
   dates aren't integrity-sensitive the way sent dates are.)

## Status log

- 2026-08-27 — Plan written (after v2.2407 per-GC sent + v2.2411 board badge shipped; owner
  locked the contacts decisions). Nothing below Phase 0 built yet.
