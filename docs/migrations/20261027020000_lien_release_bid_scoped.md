# 20261027020000_lien_release_bid_scoped

Bids → Lien Release records its waivers, and the leader signs one there with his code (v2.5958, the
waiver signing train's PR C).

- **`job_lien_releases.bid_id`** (uuid, FK `bids(id)` on delete cascade, partial index) and
  **`job_id` nullable**, with `job_lien_releases_job_or_bid_check CHECK (num_nonnulls(job_id, bid_id) = 1)`:
  a waiver lives on a job or on a bid, exactly one. Every existing row has a job, so the CHECK holds.
  Adding the FK takes a brief SHARE ROW EXCLUSIVE lock on `bids`; with `lock_timeout = '3s'` a busy
  moment fails the push fast; retry.
- **Estimator policies** (permissive, `TO authenticated`): `job_lien_releases_select_bid_estimator`,
  `_insert_bid_estimator` (`created_by = auth.uid()`, `job_id IS NULL`) and `_update_bid_estimator`, each
  on `bid_id IS NOT NULL AND is_estimator()` and a bid the caller can see under its own policies. The
  office's three policies are untouched and already cover every row. The table's restrictive read-only
  and twin fences (twins: `false`) still apply.
- **`job_lien_releases_estimator_guard`** (BEFORE INSERT OR UPDATE, SECURITY DEFINER): for an estimator
  caller only, an insert must be `issued` with no signature columns, and an update may not touch the
  status, the signature columns, the paper (form, amount, dates, fields), `bid_id` or `created_by`,
  unless `lien.release_code_signing` names the row (set by `sign_lien_release_with_code` around its stamp,
  then cleared). Sent stamps, voids and the stored PDF path stay his to write.
- **`job_lien_releases_to_activity()`** restated from 20260902001517: returns at once for a waiver with no
  job, and labels `conditional_final` as *Conditional · final* (it fell to the ELSE as *Unconditional ·
  final*).
- **`sign_lien_release_with_code`** restated from 20261026193000: an estimator who is not a twin may call
  it on a bid's waiver (a job's is refused with the office's words); a caller with no users row is
  refused; the signer gate, states and stamp are as before.
- **`lien_sign_code_status`** restated from 20261023150000: an estimator may ask about a master's or a
  dev's code; a caller with no users row asks about no one's but his own.

The `lien-release-sign` SQL bed's `30_bid_scoped.sql` plays all of it through RLS.

Verify after the push:

1. `select count(*) from information_schema.columns where table_name = 'job_lien_releases' and column_name = 'bid_id';` → 1.
2. `select pg_get_constraintdef(oid) from pg_constraint where conname = 'job_lien_releases_job_or_bid_check';` → `num_nonnulls(job_id, bid_id) = 1`.
3. `select tgname from pg_trigger where tgname = 'job_lien_releases_estimator_guard_iu';` → 1 row.
4. `npm run check:migration-drift` is clean.

Rollback (no bid rows yet): drop the trigger and its function, the three estimator policies and the
CHECK, `ALTER COLUMN job_id SET NOT NULL`, drop `bid_id`, and restate the three functions from their
earlier migrations.
