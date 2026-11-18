# 20261116221500_property_lien_public_answer.sql (2026-11-16, v2.7436)

Is this public property? The answer gets a home on the property record, and one function makes the press that takes a public property's jobs off the lien path. Taunya's ask of 2026-11-16, on job 883 sitting in Ready to file: *"this job is a government job and we can't lien a government job, how should we amend the flow to handle this going forward?"* This is the database half. No screen reads it yet.

## The columns, on `customer_addresses`

| Column | Type | What it holds |
|---|---|---|
| `lien_public_answer` | `text`, NULL or `'public'` or `'private'` (`customer_addresses_lien_public_answer_check`) | NULL: nobody answered, and the desk keeps its guess from the owner's names. `'public'`: a person said so, and every job at the address is off the lien path. `'private'`: a person said it is private, and the name guess is overruled. |
| `lien_public_answered_at` | `timestamptz` | When the question was last answered, or the answer last taken back. |
| `lien_public_answered_by` | `uuid` → `users(id)`, `ON DELETE SET NULL` | Who did that. |
| `lien_public_reason` | `text` | Why, in the person's words. |

**The answer is derived, never copied.** A job is off the lien path because its property says `'public'`. No flag is written on a job, so a job added at the address later is off the path too, and one change of the answer brings them all back.

## The function

`set_property_lien_public_answer(p_address_id uuid, p_answer text, p_reason text DEFAULT NULL, p_jobs jsonb DEFAULT '[]', p_payment_bond text DEFAULT NULL) RETURNS jsonb`

- **Who.** The lien office: `dev`, `master_technician`, `assistant`, `controller` (`isLienOffice`). Anyone else gets `{ "error": "Not authorized to answer the public property question" }`.
- **`p_answer`**: `'public'`, `'private'`, or `'unanswered'`, which takes an answer back. A reason is required to answer `'public'` and to take a `'public'` answer back, in either direction.
- **Every answer** writes the four columns and `updated_at` on the property.
- **`'public'` also works the ticked jobs**, `p_jobs` as `[{ "job_id": uuid, "note": text }]`, in the same transaction:
  - writes `jobs_ledger.lien_payment_bond` when `p_payment_bond` is `'yes'`, `'no'` or `'unknown'` and differs from the job's own;
  - puts the job on the attorney's list by calling `set_job_collections_flag(job, true, note)`. The note is the job's own (the reason plus what already went out on it), else the reason. A job already on the list is left as it is, with its own note.
- **It acts on what is ready and names what it held.** One job's refusal does not stop the others. A job not at this property, a job nobody knows, and whatever the Collections flag itself refuses (a job must be billed) come back as that job's `held` words.
- **Returns** `{ ok, answer, jobs: [{ job_id, bond_set, on_attorney_list, already_on_list, held }] }`, or `{ error }` with nothing written.
- **Taking the answer back writes no job.** Jobs stay on the attorney's list and keep their bond answer.
- Nothing is filed, voided or deleted. The desk items stay as they are.

`SECURITY DEFINER`, owned by `postgres`, `search_path = public, pg_temp`. `EXECUTE` is revoked from `PUBLIC` and `anon` and granted to `authenticated`. Training mode is refused by the statement triggers on `customer_addresses` and `jobs_ledger`, which fire inside a definer function.

## Safety

No table is made, so no fence calls. Additive and idempotent: `ADD COLUMN IF NOT EXISTS`, the check added only when it is missing, `CREATE OR REPLACE`. Starts with `SET lock_timeout = '3s'`. Adding the columns takes a brief lock on `customer_addresses` and, for the reference, on `users`.

## The bed

`property-lien-public-answer` (`scripts/pgtest-property-lien-public-answer.sh`, `supabase/tests/property_lien_public_answer/`): stand-in tables, the real `set_job_collections_flag` lifted out of `20261007170000_job_uncollectible.sql`, the migration twice, and a scenario for who may answer, each refusal, each answer's writes, each job's line, the second press and taking the answer back.

## Apply order

Nothing reads the columns or calls the function until the client PRs that follow, so the push can come any time after this merges and before those. Pushed on 2026-11-16 at about 10:35 UTC with `scripts/db-push.sh`, from a checkout equal to `origin/main` (d5149d503), where it was the only pending migration. Read back: the ledger holds 1328 versions with this one newest, the four columns read NULL on real addresses, and the function is `SECURITY DEFINER` under `postgres` with `EXECUTE` for `authenticated` and none for `anon`.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
