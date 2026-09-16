# 20260916230000_ar_deposit_close_out.sql (2026-09-16, v2.3529)

Money with no bill, PR 2 — the reason-coded close-out for a deposit that is not a customer's payment (bank interest, a vendor refund, an owner deposit). Modelled line for line on the AR *returned* flag.

| Object | What |
|---|---|
| `mercury_transaction_ar_closed` (new table) | One row per closed-out deposit: `reason` (`bank_interest` · `vendor_refund` · `owner_deposit` · `other`, CHECK), `note` (required by the RPC for `other`), `closed_at`, `closed_by`. FK to `mercury_transactions` ON DELETE CASCADE. RLS: the four `*_ar_roles` policies copy `mercury_transaction_ar_returned`'s from `20260911183606` — `is_office_staff()` OR `primary`. |
| `set_mercury_transaction_ar_closed(p_mercury_transaction_id, p_reason, p_note default null)` → jsonb | The one write. `p_reason` NULL **reopens** (deletes the row), mirroring `set_mercury_transaction_ar_returned(false)`. Business rules answer `{ok:false, error}` rather than raising: an unlisted reason; `other` with no note; a deposit marked returned; a deposit with any `jobs_ledger_payments` carrying its id (that money is a customer's — the leftover is the tip strip's job, v2.3496). Locks the `mercury_transactions` row. Gate: `is_office_staff()` OR `primary`. Grants: `authenticated`, `service_role`; revoked from `anon`. |
| `list_mercury_transactions_for_bank_payments` / `count_mercury_transactions_for_bank_payments` | `CREATE OR REPLACE` with the baseline bodies plus one clause after the returned-flag clause: a closed-out deposit is excluded unless `includeHiddenArDeposits` (To match · All). Same signature, so grants and the v2.2954 revokes survive. The count feeds the Dashboard's *Match deposits* card and banner through `useArBankUnallocatedCount`, so a close-out drops those by one too. |

Ends with `apply_read_only_write_blocks()` + `apply_read_only_stmt_blocks()` (new table).

Apply order: client first is fine — before the push the strip's confirm answers *This is not live in the database yet* (`isMissingRpcError`), and the sidecar read is quiet on a missing table. Push after merge with `bash scripts/db-push.sh`, then regenerate types (`src/types/database.ts` carries a hand-added shape for the table and the RPC until then). No edge function redeploy.
