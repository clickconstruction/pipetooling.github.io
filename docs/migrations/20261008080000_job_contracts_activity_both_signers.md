# 20261008080000_job_contracts_activity_both_signers.sql (2026-10-08, v2.4870)

Punch list #64 ([`to-dos/contract-second-signer-names.md`](../../to-dos/contract-second-signer-names.md)), the first item *Left after this row*. A job's activity line for a signed agreement names both signers. The trigger function `job_contracts_to_activity()` came from `20260903141146_job_contracts.sql`. It wrote *Contract signed by <first printed name>* on an agreement two people signed online.

- **`job_contracts_to_activity()`**, `CREATE OR REPLACE`. It is the same function, with one new variable. `v_signers` joins the filled frames' printed names with *and*, the way `signerNamesLine` does in `supabase/functions/_shared/jobContractSigners.ts`:
  - the first frame's `signer_printed_name`, when it is not blank;
  - the second frame's `co_signer_printed_name`, when the row names a second signer (`co_signer_name`) and `co_signed_at` is set.
- The online line reads *Contract signed by Sam Owner and Alex Owner — …*. With no printed name it still reads *the customer*. A paper record's line still names nobody: *Signed contract on file (paper) — …*.
- The trigger itself (`job_contracts_to_activity_iud`) is not touched.

No table changes and no backfill. Rows already logged keep their words. On 2026-10-07 no agreement on prod had two frames signed online (J1053, the only one, was folded into the sink by the ZZ sweep), so no line needs rewriting.

Apply order: any. `CREATE OR REPLACE FUNCTION` takes no lock on `job_contracts`. The client does not read these words, so deploy order does not matter.

## Checked before the push

- **The prod function matched the repo.** A read-only `pg_get_functiondef` on prod matched the body in `20260903141146_job_contracts.sql`, whitespace aside. The migration changes only the signed line.
- **Inserted rows.** On prod, inside `BEGIN … ROLLBACK`, the migration applied. Six inserted rows on the ZZ sink (J1064) wrote these lines:
  - two frames signed: *Contract signed by Sam Owner and Alex Owner*. The second printed name had spaces around it, and they were trimmed.
  - one frame: *Sam Owner*
  - a second signer named but not signed: *Sam Owner*
  - only the second frame filled: *Alex Owner*
  - nobody: *the customer*
  - paper: *Signed contract on file (paper)*
- **The update path.** In a second rolled-back transaction, a `sent` row with the first frame signed was completed by an `UPDATE`, the way `sign-job-contract` writes the second frame. It wrote *Contract signed by Sam Owner and Alex Owner — ZZ dry run update*.

## Checks after the push

1. `select pg_get_functiondef('public.job_contracts_to_activity()'::regprocedure)` contains `v_signers`.
2. The two dry runs above, run again inside `BEGIN … ROLLBACK`, give the same lines without the `\i` of the migration.
