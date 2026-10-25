---
name: "Legal Timeline: the lien clock's deadlines on the line"
number: 170
group: gated
status: proposed 2026-10-24 · rank 5 of 10 from the review of the Burd matter (job 891) · not built
summary: >
  A matter's lien deadlines come from the lien clock, but the Timeline shows only what someone
  typed, so a planned notice and the deadline it serves can disagree. Draw the clock's deadlines
  on the Timeline as read-only items for every job in the account (each § 53.056 month, § 53.057,
  the affidavit, suit) with the legal day and a mail-by day. Let a planned step name the deadline
  it serves, with a warning when the step falls after it. The § 38.001 presentment day joins them
  once #168 records when a claim was sent.
next: The owner picks Do, Later or Drop. Then a mock-up of a deadline item and a step tied to it.
size: M (a fourth Timeline item kind fed from the clock, the tie, the warning)
blocker: The owner's pick.
opinion: build — on job 891 the typed steps, the Lien desk and one window gave three readings of the same deadlines
---

# Legal Timeline: the lien clock's deadlines on the line

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 5.

## What happened on job 891

The Timeline's lien steps on job 891 were typed by hand, each on the Friday before its deadline.
The lien clock shows the deadlines on the Monday after, because the statutory days fall on a
weekend. A third window showed the earlier residential dates because it read the property kind
wrong (being fixed separately). Nothing tied a planned step to the deadline it served, so only a
careful read showed they agreed.

## What exists today

- `computeJobLienClock` in `src/lib/jobs/lienDeadlines.ts`, and the per-job timelines in
  `src/lib/jobs/lienTimeline.ts` and `src/lib/legal/legalLienPaper.ts` (the Paper tab's *Where
  each job stands*).
- `buildLegalTimeline` in `src/lib/legal/legalTimeline.ts` knows three kinds of item: planned
  steps, entries, documents.
- Related: #42 (each paper's first day as well as its last) and #35 (*Record a notice that
  already went out*, v2.3770).

## The proposal

- A fourth kind, `deadline`, drawn read-only from the account's jobs: *§ 53.056 notice, August ·
  Nov 16 (mail by Fri Nov 13)*, the § 53.057 retainage notice, the § 53.052 affidavit, the
  § 53.158 suit. The mail-by day is the last business day on or before the statutory day before
  any weekend roll. An item reads done once the Lien desk records the paper, and *Record it…*
  opens #35's door.
- A planned step can name the deadline it serves (a picker in *Plan a step*). The two sit
  together, and a step dated after its deadline shows *after the deadline* in red.
- The § 38.001 presentment day (30 days after a claim is sent), once #168 knows the send day.

## Open decisions

- Whether the deadlines show on the firm's portal. They are the office's clock, but the firm may
  want them.
- Whether the mail-by day should be one business day early or exactly the statutory day before
  any roll.

## Where it plugs in

Existing: the clock, the per-job timelines, the Timeline kernel and panel, #35's door. New: the
deadline item kind, the tie in a planned step's `meta.deadline_key`, the warning.

## Plan

1. Deadline items on the Timeline, from the clock. M.
2. The tie and the warning. S.
3. Presentment, after #168. XS.

## How to verify

On a ZZ TEST GC job with August work, the Timeline shows the August notice with its legal and
mail-by days. A step tied to it a day late turns red. Recording the notice through #35's door
marks the deadline done.
