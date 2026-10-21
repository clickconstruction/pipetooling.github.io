---
name: "Bids: taking the GC off hands the bid to the alternate"
number: 136
group: close
status: BUILT 2026-10-20 — the owner took the five defaults the same day; migration 20261020100000 + client in one PR (v2.5682); left: the live walk (renumbered from 133, which PR #5912 took while this folder sat uncommitted)
summary: >
  A bid is one project offered to several GCs, but when the lead GC drops out there is no way
  to take them off: the ★ card only has "change ▸", which opens a search over every customer
  in the system even though the GC who should step up is already on the bid, one card down.
  Worse, the swap is silent bookkeeping damage — the bid's own packet, due dates, rooms and
  sent history are keyed "NULL = the bid's GC", so they re-badge onto whoever is picked next,
  and an alternate picked as the new primary keeps its old card ("same letter as itself").
  This to-do gives the ★ card an ×: one confirmed press takes the GC off, the alternate
  becomes the bid's GC, and every letter, note and date stays with the GC it really belongs
  to, re-keyed atomically by one RPC.
next: A live walk on a ZZ bid (the recipe under How to verify), then delete the folder.
size: S
blocker: The live walk.
opinion: build — the ask is one button, and the button forces the attribution fix this surface has quietly needed since v2.2383
mockup: to-dos/auto-promote-alternate-gc/mockup.html
ver: v2.2383 · v2.2416 · v2.3130 base · v2.5682
---

# Taking the GC off hands the bid to the alternate (#136)

## The ask, in Wendi's words

2026-10-20: "When taking the primary GC off of a project in bids (click tooling), I would like
it to auto select the alternate GC as the primary."

## Three lenses

**Wendi's seat.** BP-series bid, two GCs on it. The lead GC stops returning calls, or loses the
project to the other builder. Wendi opens Edit Bid to make it right. The ★ Bid's GC card has no
× — only **change ▸**, which opens a search over *every customer in the system*. She retypes the
name of a GC who is already on the bid one card down (and can land on a duplicate customer
record). After the pick, the promoted GC's old card is still there, now reading "same letter as"
itself, and the departing GC is gone without a trace. Her sentence — *auto select the alternate* —
is "the app already knows who else is on this bid; one press."

**The job behind the ask.** The bid is the owner's thesis in code: *one project, estimated once,
offered to N GCs*. The ★ is just who runs the bid — the letter's name, the board's name,
Followup's name. When the lead drops, the real-world event is "Caldwell is out; Rio Grande leads
now." The record has to say that — and keep Caldwell's history as Caldwell's. Today it does the
opposite: `bid_versions`, `bid_gcs` (due / submitted-to / ITB), `bid_proposal_rooms` all key the
bid's own GC as `customer_id NULL`, so the moment `bids.customer_id` changes, the old GC's
packet, dues, rooms — and on an unsplit bid the "Sent Jun 17 at $110,746.77" line — re-badge onto
the new GC. The letter we sent Caldwell reads as sent to Rio Grande.

**The whole office.** The Bid Board's per-GC rows, Followup's "Sent to — by GC", Waiting to hear,
the Call queue, the Lost lens, pricing-margin history and the robots' backtests all read these
same tables. A swap that re-keys correctly keeps every one of them truthful with zero changes to
any reader — the derived-roll-up recipe the per-GC phases already proved. A swap that doesn't is
quiet data damage that surfaces months later as "why does this say we sent them a letter?"

## What exists today

- `GcCard` (v2.2383): one card shape, role chips ★ / same letter / own packet; × on same-letter
  cards only; **change ▸** / keep current on the ★ card. Edit Bid autosaves (v2.3130), so card
  actions are already immediate.
- `bid_gc_recipients` (same-letter GCs), `bid_versions.customer_id` (own-packet GCs),
  `bid_gcs` (v2.2416, per-GC due / submitted-to / ITB), `bid_proposal_rooms`,
  `bids_submission_entries.gc_customer_id` (NULL = whole-bid note).
- No cleanup anywhere: picking an existing alternate via change ▸ leaves its recipient row
  (duplicate card), and nothing re-keys the NULL-keyed state.

## The proposal

**Two doors, one swap.**

1. **× on the ★ card** — shown only when at least one other GC is on the bid. Press → one
   confirm: *"Take Caldwell Builders off this bid? Rio Grande Commercial becomes the bid's GC.
   Letters, notes and dates each stay with the GC they belong to."* Primary button does both;
   **Keep as an alternate instead** is the quieter second button; Cancel changes nothing.
   With two or more alternates the same confirm asks who steps up (radio list, recommended
   pick preselected). With no alternate there is no × — a bid keeps a GC.
2. **make bid's GC ▸ on each alternate card** — the same swap approached from the other side
   ("Rio Grande leads now"); the old lead demotes to an alternate card rather than leaving.

**The swap is one RPC** — `promote_bid_gc(p_bid_id, p_new_gc_id, p_old_gc_stays)`, SECURITY
INVOKER so RLS and role checks apply, called by both doors (client-side multi-table re-keys are
the known quirk-20 anti-pattern):

- Re-key the bid's NULL-keyed rows to the departing GC's id: `bid_versions`, `bid_gcs`,
  `bid_proposal_rooms`. (Order matters for the partial unique indexes: vacate NULL first.)
- Re-key the stepping-up GC's explicit rows to NULL — the primary's state is NULL-keyed
  everywhere, and every "own GC" default keeps working untouched.
- `bid_gc_recipients`: delete the stepping-up GC's row (kills the duplicate-card bug); when the
  old GC stays and has no packet, insert its row (`source: 'manual'`).
- When the old GC comes off entirely: delete its (just re-keyed) `bid_gcs` row, so a due date
  for a GC no longer on the bid stops steering the bid's derived due (`recompute_bid_due`).
- `bids`: `customer_id = new`, `gc_builder_id = NULL` (legacy builder label clears).
- Write one method-less whole-bid note: *"Caldwell Builders came off the bid — Rio Grande
  Commercial is the bid's GC now."* Method-less, so last-contact does not move (the Phase-1
  rule), but the bid's story explains why the sent line predates the GC.

**change ▸ reroutes through the same RPC** (decision 4): same look — pick a customer, old GC
off — but the bookkeeping stops re-badging. The dropdown gains an **On this bid** group at the
top: the bid's other GCs, one press, no retyping.

## Decisions for the owner (defaults recommended — the owner took all five, 2026-10-20)

1. **After × — off the bid, or demoted?** Default: off entirely (Wendi's words), with *Keep as
   an alternate instead* one click away in the same confirm. A GC with its own packet can't
   vanish — its versions hold sends and prices — so its card stays as own-packet; the confirm
   says so instead of pretending.
2. **Two or more alternates: ask or auto-pick?** Default: ask in the confirm — radio list,
   preselecting the own-packet GC with the latest send, else the first added. Silent auto-pick
   saves one tap and will be wrong half the time.
3. **Whole-bid notes.** `gc_customer_id NULL` means "about the whole bid", not "about the GC",
   so notes do NOT re-key. Default: leave them whole-bid.
4. **Does change ▸ reroute through the RPC?** Default: yes. The visible behavior is identical;
   what changes is that the departing GC's letters and dates stop re-badging onto the new one.
   Veto makes the fix promote-only and leaves change ▸ silently lossy.
5. **Does the "make bid's GC" door on alternate cards ship too?** Default: yes — same RPC, one
   small button, and it is the natural door when the thought is "they lead now" rather than
   "take them off".

## What this touches

- One migration: the RPC (`SET lock_timeout = '3s';` first line; no new table, so no fence
  calls; CREATE OR REPLACE from the newest definition). Deploy order: migration first (a new
  RPC is invisible to old clients), client after.
- `BidFormModal` / `BidGcRecipientsRow`: × on the ★ card, the promote action, the confirm, the
  **On this bid** group in the change ▸ dropdown. Role gate: the section's existing `canEdit`
  (dev, master tech, assistant-like, estimator).
- Pure kernel `promoteBidGcPlan` (which rows re-key, who is recommended to step up, what the
  confirm sentence says) with unit tests; the RPC mirrors it. A render smoke on the confirm.
- Help guide `bid-one-project-to-multiple-gcs` §"Every GC is a card" learns the × and the
  promote (plain-words rules). Release note + fragment; `docs/migrations/` page for the RPC.

## How to verify

Live walk on a ZZ bid (the live-test recipe): seed a bid with a ★ GC + one same-letter + one
own-packet GC, per-GC dues and a send; × the ★; check the new ★ card, the old GC's card (or
absence), the due strip, the Send to strip's packet names, the notes ledger line, and the Bid
Board / Followup rows; then the two-alternate radio and the keep-as-alternate path.

## Not in scope

- Per-GC sent history on unsplit bids (a bid-level sent date has no per-GC home; the audit note
  tells the story). Retiring `bids.submitted_to` / `itb_links` stays #7.
