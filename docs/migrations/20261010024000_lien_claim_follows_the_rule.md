# 20261010024000_lien_claim_follows_the_rule.sql (2026-10-09, v2.5093)

`lien_billed_open()` follows the one payment rule, the owner's call of 2026-10-09: a payment put on a job with no bill picked is applied oldest bill first, everywhere. `CREATE OR REPLACE` with the same signature, so the three desk readers that call it (`list_lien_notice_months`, `list_lien_affidavit_windows`, `list_lien_retainage_windows`) read the new claim as they are. No table changes; the existing grant is restated.

- **Before** (v2.4969, `20261009150000_lien_claim_is_billed.sql`): each billed bill net of the payments tied to it, so money with no bill picked lowered no claim, while the board, GC Review, the statement and the Dashboard applied it (v2.5006, v2.5010, v2.5017).
- **Now**, `attributeJobPayments` word for word:
  - Linked money is its bill's, in full.
  - The job's unlinked money (each payment above zero) pays the part of the job on no sent bill first: its revenue less every sent bill, billed or paid, and none when revenue is NULL.
  - What is left walks the sent bills oldest first, by `sequence_order`, then `billed_at`, then `id`.
  - The claim sums what the billed ones still need. Paid bills owe nothing and the shell arm is unchanged.
- **Job 273** (prod, 2026-10-09): $56,365, bills of $13,420, $665 and $3,500, and $39,680 paid with no bill picked. It claimed $17,585. Now $38,780 pays the work on no bill and $900 the oldest bill, so the claim is $16,685.
- **Bed:** `scripts/pgtest-lien-claim.sh` (`npm run test:pg:lien-claim`, the SQL beds workflow). It runs the two tables as the baseline types them, then the migration twice, then 16 cases with the client's `lienBilledOpen` numbers. Run on PGlite before the PR; the v2.4969 function fails it on job 273.

**Apply:** `supabase db push` after merge. **Verify:** `SELECT public.lien_billed_open(id, status, revenue, payments_made) FROM public.jobs_ledger WHERE hcp_number = '273'` reads 16685, and the desk's notice rows for 273 carry it as `open_balance`.
