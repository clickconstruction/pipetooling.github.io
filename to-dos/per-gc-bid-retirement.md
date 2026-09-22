---
name: "Per-GC bids: retire submitted_to / itb_links"
group: waiting
status: low
summary: Retire `bids.submitted_to` / `itb_links` behind `bid_gcs`; the auto-derive question.
next: One mechanical PR after real per-GC usage.
size: M
blocker: Usage.
ver: v2.2416 base
opinion: later — a mechanical PR once real per-GC usage shows the two columns are dead.
mockup: not required — retires two columns — no screen changes
---

# Per-GC bids: the retirement pass and the auto-derive question

## Open questions (validated 2026-09-06, re-checked 2026-09-21 — nothing shipped since)

1. ~~Should a job linked via `bid_id` auto-derive the bid's `started_or_complete`?~~ Yes — shipped v2.3069 (trigger `jobs_ledger_bid_outcome_from_job` + a five-second toast from the Job form).
2. Retire `bids.submitted_to` / `bids.itb_links` now that `bid_gcs` (v2.2416) carries due / submitted-to / ITB per GC. Still live: 32 `submitted_to` and 18 `itb_links` references in `src/` outside tests and `database.ts` (2026-09-21; 39 + 24 on 2026-09-06, 16 + 24 the day before), no migration touches either column, and the bid-level Due / Submitted-to / ITB fields were kept as derived-sync fields rather than converted to own-GC editors.
3. Per-GC due-date editing guard — current stance: no.

## The plan

- Q2 is one mechanical PR: backfill own-GC rows, point every reader at `bid_gcs`, drop the columns in a follow-up migration after a quiet week.
- Q1 answered and shipped (v2.3069).
