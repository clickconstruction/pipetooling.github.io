---
file: docs/twins/FEEDBACK_LOOP.md
last_updated: 2026-08-30
purpose: The audit loop — how human estimator feedback on twin bids reaches the agent through the Audits tab, and what the agent must do with it. Read at the START of any twin/backtest session, alongside get_answers.
---

# The audit loop (v2 — owner decision 2026-08-30, supersedes the three-channel v1)

A twin drafts a bid and opens an audit; the human auditor reviews **in one place** —
the **Audits tab on the Bids page** — with new-tab quick links to both apps; the agent
digests every note into permanent improvements and posts a receipt under each one.
The letter itself and the GC relationship stay human — the twin's deliverable ends at
a clean draft.

## The surface (v2.2516–v2.2519)

The Audits tab renders whenever `bid_audits` rows exist; its label carries the pending
count. Each card:

- **Quick links** (both open in new tabs): the CountTooling takeoff via the stored
  `ct_view_url` (a `?t=` view link — no sign-in, read-only; the auditor references the
  twin's numbered pins in notes, e.g. "pin 3: by others"), and the PipeTooling bid via
  `/bids?tab=counts&bidId=…`.
- **The twin's questions** with inline answer boxes (`kind='answer'`, threaded by
  `parent_id`).
- **Sectioned note composers** — Counts / Footage / Pricing / Scope / General. Section
  choice is a convenience, never a requirement; General takes anything.
- **Finish audit** → the `audit-finish` edge function: PT status `done` + ledger stamp
  + the twin's CT project flipped to `reviewed` over the bridge
  (`manage-user set_twin_project_review`; fail-soft). Reopen reverses both.
- **Receipts** render indented under each note: 🤖 → "Learned: …" with the
  digest-outcome label. When every note has one, the audit is `digested` and the card
  moves to collapsed history.

## What the twin does at pipeline end (per bid)

1. Mint a CT view link for its project: CT RPC
   `create_view_link(p_project_id, p_name, p_expires_at: null)` with the twin's CT JWT.
2. Insert the `bid_audits` row (`status='pending'`, `ct_project_id`, `ct_view_url`) and
   PATCH `bids.count_tooling_plans_link` with the same URL.
3. Seed its open RFIs as `bid_audit_notes` rows (`kind='question'`, best-fit section).

Twin lanes are structural (RLS): a twin can open audits and later close them as
`digested`, but can never set `done` (verified live 2026-08-30: 42501 on attempt);
twin-authored notes are limited to `question` and `receipt`.

## The digest (every twin session, before new work)

Sweep for audits in `status='done'` and notes with `digested_at IS NULL`
(read door: REST on `bid_audits` / `bid_audit_notes`, or
`get_work_state → ct_takeoff.notes_ledger` for the plan-space pins). Triage each item
into exactly one bucket, recorded on the note as `digest_outcome`:

- **doctrine** → edit `docs/twins/PLACEMENT.md` (or the relevant guide) so the error
  class can't recur. Example: "read every sheet including PD-* demo plans."
- **books** → fix prices / hours / aliases in the 🤖 Robot Default books.
- **code** → kernel/assembler fix, shipped as a normal PR.
- **bid_only** → apply to that bid's rows; teaches nothing general.

A standing rule stated once ("we always carry $20k travel past 200 miles") outranks a
per-bid answer: promote it to doctrine or books immediately. Then post the receipt —
`kind='receipt'`, `parent_id` = the note, body "Learned: <what changed> → <where>" —
set `digested_at` + `digest_outcome` on the note, and when all notes carry receipts,
set the audit `status='digested'`. The next backtest measures whether the error class
recurred; recurrence means the digest failed, not the auditor.

## Current state

- BT-2 (b405, MPH Casa Linda) is the first card: audit `e7523514…` pending with 4
  seeded questions, CT project `6648c38a` in the ready lane with 7 pins (2 RFIs),
  view link stored on the bid and the audit.
