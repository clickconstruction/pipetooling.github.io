# Per-GC bids: the retirement pass and the auto-derive question

Status: revisit once per-GC editing has real usage · plan: [`docs/PER_GC_BID_PLAN.md`](../docs/PER_GC_BID_PLAN.md) → Open questions

## Open questions (validated 2026-09-06)

1. ~~Should a job linked via `bid_id` auto-derive the bid's `started_or_complete`?~~ Yes — shipped v2.3069 (trigger `jobs_ledger_bid_outcome_from_job` + a five-second toast from the Job form).
2. Retire `bids.submitted_to` / `bids.itb_links` now that `bid_gcs` (v2.2416) carries due / submitted-to / ITB per GC. Still live and growing: 39 `submitted_to` and 24 `itb_links` references in `src/` outside tests (2026-09-06; was 16 + 24 the day before), and the bid-level Due / Submitted-to / ITB fields were kept as derived-sync fields rather than converted to own-GC editors.
3. Per-GC due-date editing guard — current stance: no.

## The plan

- Q2 is one mechanical PR: backfill own-GC rows, point every reader at `bid_gcs`, drop the columns in a follow-up migration after a quiet week.
- Q1 answered and shipped (v2.3069).
