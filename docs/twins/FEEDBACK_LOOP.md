---
file: docs/twins/FEEDBACK_LOOP.md
last_updated: 2026-09-05
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
- **Sealed shadows** are held by the tab only when `bids.twin_source_bid_id` is
  set (`open_shadow` stamps it since v2.2543). The two shadows opened before
  that deploy on 2026-08-31 lacked the pairing, and b418 (Take 5 Brownsville —
  live, unsent) was audited in the open on 2026-09-04: the auditor saw the
  robot's rows before her own number existed. The six unstamped robot bids
  (b418, b419, b411–b414) were paired by hand the same day (v2.2795 fragment);
  read b418's eventual scorecard as **auditor-exposed**. On a shadow, confirm
  the pairing via `get_work_state` before you heartbeat `done`.
- **Receipts** render indented under each note: 🤖 → "Learned: …" with the
  digest-outcome label. When every note has one, the audit is `digested` and the card
  moves to collapsed history.

## What the twin does at pipeline end (per bid)

0. **Pre-flight — never open an audit the tab cannot price.** The Audits tab
   computes "draft $" from the bid's PipeTooling count rows × their book
   assignments (`computeAuditDraftTotal`); a bid whose counts live only in
   CountTooling and the lock note reads **draft $0 · −100% vs ours**. On
   2026-09-04 seven audits sat in the queue that way (b422, b424–b429 — the
   BT-16..19 slate, whose estimates were written into the lock notes and never
   pasted) and drew the note "we will not do this for free wtf". Before the
   audit exists: (a) STG-5 is done — counts pasted into the Counts tab and every
   row book-assigned, so the tab's total equals your lock; (b) `self_assessment`
   is written (none of the first 22 audits carried one); (c) every question is
   anchored and in plain trade words (PLACEMENT.md → "Ask like a junior
   estimator"). `ct_finish_takeoff` opens the audit row at STG-3 for you, so run
   STG-5 in the same session, before you heartbeat `done`.
   **STG-5 is one call now (v2.2862)**: `paste_counts(bid, rows, expected_total)`
   writes the rows and their 🤖 Robot Default assignments together and REFUSES
   when the priced rows don't equal `expected_total` — always pass your lock
   total so the invariant is checked by the server, not by you. And the gate is
   structural in the other direction too: `score_backtest` refuses to unseal a
   bid with zero count rows, so a $0 audit can no longer reach the queue.
1. Mint a CT view link for its project: CT RPC
   `create_view_link(p_project_id, p_name, p_expires_at: null)` with the twin's CT JWT.
2. Insert the `bid_audits` row (`status='pending'`, `ct_project_id`, `ct_view_url`) and
   PATCH `bids.count_tooling_plans_link` with the same URL.
3. Seed its open RFIs as `bid_audit_notes` rows (`kind='question'`, best-fit section).
   **Anchor every question you can (v2.2535)**: set `sheet_ref` to the plan sheet where
   you saw it (e.g. `'P2.1'`) and `context` to one sentence of what you saw and what
   rides on the answer (e.g. `'4 wet tables with rough-ins drawn but absent from the
   fixture schedule — ~$18k of connects hangs on this'`). The Audits card renders both
   under the question; an unanchored question makes the auditor hunt through the whole
   set. Both columns are nullable — omit them only when there is genuinely no sheet.

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
- **reference_quality** (v2.2545) → the disagreement is the REFERENCE's fault: the
  historical record is incomplete or untrustworthy (sparse rows, round hand-entered
  value, weak-loss category, never-updated outcome). Digest as reference_quality and
  file a repair task on the human bid (a bid note naming the suspect field) instead of
  falsely teaching doctrine — the robots fix the history they practice on. A human
  approves the actual record change.

**Verdict tags (v2.2553 — the cockpit pre-triages for you).** The audit card's diff
rows post one-tap verdict notes whose bodies start with a machine tag; honor them as
the auditor's explicit routing before your own judgment:

- `[verdict:teach]` → the robot is wrong: digest as **doctrine** or **books**.
- `[verdict:record]` → OUR record is wrong: digest as **reference_quality** + repair task.
- `[verdict:ok]` → scope difference / judgment call: digest as **bid_only** (usually no change).

Also write your own confession at STG-3: pass `self_assessment` to `ct_finish_takeoff`
(2-3 sentences on where THIS draft is least sure — modeled-not-traced footage, guessed
sub scopes, unread sheets). It renders atop the audit card so the auditor checks your
suspicions first.

A standing rule stated once ("we always carry $20k travel past 200 miles") outranks a
per-bid answer: promote it to doctrine or books immediately. Then post the receipt —
`kind='receipt'`, `parent_id` = the note, body "Learned: <what changed> → <where>" —
set `digested_at` + `digest_outcome` on the note, and when all notes carry receipts,
set the audit `status='digested'`. The next backtest measures whether the error class
recurred; recurrence means the digest failed, not the auditor.

## Reference grading (v2.2545 — the sparse-era accommodation)

The pre-2026-03 book was recorded while the company was still learning what to
track (survey 2026-08-31: 132 Tier-A bids of 344, 127 of them recent; 98 have no
plans link at all). Grade every backtest reference instead of trusting or
discarding it:

- **A** plans+value+counts+pricing → full scorecard · **B** plans+value → dollar
  scorecard only · **C** plans+counts → quantity scorecard only · **D** plans
  only → census reps, no scorecard · **X** no plans → repair or exclude, with the
  reason recorded.
- `open_backtest` returns the blind-safe `reference_grade` (field PRESENCE only).
  Kernel of record: `src/lib/bids/referenceGrade.ts`.
- **At unseal (STG-6) call `score_backtest`** (v2.2800) — it computes the quality
  flags below server-side, writes the `twin_run_scores` row and stamps the
  scorecard; the flags, for reading the result: `roundValue` (value % $100 == 0 — hand-entered, BT-11),
  `weakLoss` (loss_category no_bid / project_died — the number never competed,
  BT-9/10), `lossUncategorized`, `stale` (>6 months). **Gate A/B denominators
  take only grade A/B references with every flag clear.** Tier C/D runs still
  teach doctrine; they never move gates.
- Mismatch vs a sparse/flagged reference → digest bucket `reference_quality`
  (above), not doctrine.

## Current state (2026-09-04)

- **Wendi's first full audit pass landed 2026-09-04 (17:51–18:57)**: seven audits
  finished (b405, b418, b407, b408, b406, b409, b411) — 16 answers, 6 row notes, 4
  one-tap `[verdict:teach]` rows — plus one note on b425. Every note is undigested;
  the doctrine she taught is banked in PLACEMENT.md (site/civil never ours,
  scheduled = counted, ambiguous device → in scope, sawcut excluded, two packages →
  ask, travel/rentals are human lines, interceptor prices, med gas self-performed,
  every 1/2" home run measured, 10 ft per POC, under-a-loss is light, plain-word
  questions). **Digested the same evening** (run `digest:2026-09-04`, credential
  bc18d402): 24 receipts posted as the twin, every note stamped (19 doctrine,
  3 books, 2 bid_only), all seven audits `digested`; 🤖 Robot Default
  `Oil Interceptor` $6,270 → $1,500 and `Sand-Oil Interceptor` $9,500 → $4,500.
- Still pending: 15 audits, seven of them the $0 BT-16..19 cards (STG-5 owed), the
  sealed b419/b420 shadows, and the b422 wage-tier question.
- Two axes are BLOCKED pending audit answers: institutional (district wage-tier
  multiplier, on the b422 audit) and proto/auto-service (untraced-footage / site-scope
  question).
