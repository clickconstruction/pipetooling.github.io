---
file: docs/twins/FEEDBACK_LOOP.md
last_updated: 2026-08-30
purpose: The Wendi audit loop — how human estimator feedback on twin bids reaches the agent, and what the agent must do with it. Read at the START of any twin/backtest session, alongside get_answers.
---

# The feedback loop (owner decision 2026-08-30)

A twin drafts a bid; Wendi audits it in the tools she already uses; the agent digests
her feedback into permanent improvements and stamps a receipt. Three channels, one
digest, one receipt rule. The letter itself and the GC relationship stay human —
the twin's deliverable ends at a clean draft.

## The three channels (all in tools she already knows)

1. **Plan-space (CountTooling review lane)** — spatial errors. She opens the twin's
   project, drops notes on the plan, answers the twin's numbered RFI pins in the
   notes drawer (answer implies resolved), and finishes with *Mark reviewed* or
   *Request changes* + a review note.
   *Agent read door:* `get_work_state → ct_takeoff.notes_ledger` (every note with
   kind / resolved / answer) + `ct_takeoff.projects[].review_status` / `review_note`.

2. **Row corrections ("Wendi audit" bid version in PipeTooling)** — count, footage,
   price, and scope errors. Every twin/backtest bid is split into two versions
   before handoff: **"Twin original"** (frozen — the twin NEVER edits it after
   handoff, and neither does she) and **"Wendi audit"** (selected — she edits rows
   in the familiar Counts editor: fix numbers, reprice, delete junk, add missing).
   *Agent read door:* diff the two versions' `bids_count_rows` (+ pricing
   assignments/custom prices) row by row. The diff IS the feedback — no prose
   needed from her. Setup recipe: RPC `split_bid_into_versions(p_bid_id,
   p_current_name:'Twin original', p_new_name:'Wendi audit', p_clone_pricing:true)`,
   then clone `bid_pricing_assignments` onto the new rows (the RPC clones price
   scenarios, not per-row assignments), then set `bids.selected_bid_version_id`
   to the audit version so she lands on it.

3. **The why (`AUDIT:` ledger notes)** — reasoning and standing rules ("we always
   carry $20k travel past 200 miles", "never bid med gas self-perform"). She types
   a note starting `AUDIT:` into the bid's submission ledger — the same box she
   already uses for send notes. SMS-to-owner is the fallback; the owner pastes it
   into a session verbatim.
   *Agent read door:* `bids_submission_entries` on twin bids, notes matching
   `^AUDIT:` (also visible in `get_work_state → audit_ledger_tail`).

## The digest (every twin session, before new work)

Sweep all three channels for anything new since the last digest stamp, then triage
each item into exactly one bucket:

- **Doctrine** → edit `docs/twins/PLACEMENT.md` (or the relevant guide) so the
  error class can't recur. Example: "read every sheet including PD-* demo plans."
- **Robot books** → fix prices / hours / aliases in the 🤖 Robot Default books.
  Example: reshape per-ft rates, loaded-fixture prices.
- **Code** → kernel/assembler fix (tile-seam dedup, developed-length model), shipped
  as a normal PR.
- **Bid-only** → an answer that changes this bid's rows but teaches nothing general.
  Apply it to the bid and move on.

A standing rule stated once in channel 3 outranks a per-bid answer: promote it to
doctrine or books immediately.

## The receipt rule (what makes it a loop)

For every item digested, stamp the bid's ledger:
`[audit-receipt] changed <X> because you said <Y> → <where it landed: doctrine §… /
book entry … / PR #… / this bid only>`.
She must be able to see that her feedback landed without asking. The next backtest
measures whether that error class recurred — recurrence means the digest failed,
not her.

## Current state

- BT-2 (b405, MPH Casa Linda) is the first bid staged for this loop: versions
  split, audit version priced + selected, CT project `6648c38a` in the ready lane
  with 7 notes (2 RFIs) awaiting her pass.
