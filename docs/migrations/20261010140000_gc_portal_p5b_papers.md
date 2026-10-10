# 20261010140000_gc_portal_p5b_papers.sql (2026-10-10, v2.5191)

GC mode, the real build, the trade partner portal's P5b-m (`to-dos/gc-mode/PORTAL_REAL_BUILD.md` → *The PRs, in order*, item 10; plan `to-dos/gc-mode/mockups/portal-p5b.md`, on branch `spike/gc-mode`). A trade partner company's own papers from its portal: its insurance certificate, its vetting form, and its master agreement and W-9 opened to sign. This migration is the three verbs and the files ledger widened for a certificate. Nothing calls them yet: P5b-1's kinds `vetting_form` and `paper_link`, and P5b-2's `file` for a certificate and `coi`, do, through `submit-gc-trade-portal`.

## What it does

1. **`gc_trade_files` takes a certificate**, which is the company's and on no job:
   - `gc_trade_files_purpose_known` gains `coi` (dropped and added again, `NOT VALID` then validated);
   - `project_id` drops its `NOT NULL`, and a new CHECK `gc_trade_files_job_or_company` holds a project on every file but a certificate, and none on a certificate (`NOT VALID` then validated).
2. **`gc_trade_coi(company, expires_on, file_url)`** files the company's insurance certificate: a `person_contract_documents` row of the company's (`person_name` `gc-company:<id>`, no person), `document_name` *COI (from their portal)*, `doc_type` `coi`, `status` `signed`, `signed_at` the upload day, `expires_at` the policy's day and `url` the link. The link must be one of the company's own `coi` uploads not yet filed, and it is tied to the paper (`gc_trade_file_tie`). `gc_company_paper_kept` keeps the company's insurance promise in the same transaction. It refuses, in order: a link that is not https (`badRequest`, from `gc_trade_file_link`), no company (`notFound`), no day (`coiDayNeeded`), a day not after today (`coiPast`), a day more than three years out (`coiTooFar`), and a link that is not its own unfiled upload (`certNeeded`).
3. **`gc_trade_vetting_form(company, license, insurance, years, references, past_jobs)`** writes the company's row of `gc_company_vetting_forms` with `sent_on` today, a second send replacing the first. It refuses no company (`notFound`), a company whose `vetting_status` is not `new` (`vetDecided`: a known company's is null, a decided one's approved or declined), a blank line or years missing or below zero (`formIncomplete`), and a line over 2,000 characters or years over 200 (`tooLong`). The office's decision (`gc_vet_company`) is untouched.
4. **`gc_trade_paper_open(company, paper, token_hash, expires_at)`** opens the company's master agreement (`msa`) or W-9 (`w9`) to sign on `/contract/accept`. It takes the newest of the company's papers of that kind still to sign: a master agreement the office sent, or a W-9 sent or not. With no W-9 it copies the Contract Book's W-9 for subs (the first `sub` entry whose form's `doc_type` is `w9`, as the office's `loadCompanyPaperEntries` finds it) with `gc_company_paper`'s insert, the form trigger stamping its `doc_type`. It sets the paper `sent`, keeps an earlier `sent_at`, and stores the hash and expiry of the token `submit-gc-trade-portal` minted; the raw token never reaches the database, and the newest link wins, as the sub portal's `sign_link` does. It refuses a paper that is not `msa` or `w9`, a hash that is not 64 hex characters or an expiry gone by (`badRequest`), no company (`notFound`), a paper signed already (`alreadySigned`), a master agreement the office has not sent (`msaNotSent`), and a Book with no W-9 for subs (`noW9Form`). Two presses at once are one at a time (the company's row is locked), so they never copy two W-9s.
5. The three are SECURITY INVOKER and granted to `service_role` alone: revoked from `PUBLIC`, `anon` and `authenticated`. No table is created, so no block calls.

The eight new keys wait in `gcTradeSubmit.test.ts`'s `WAITING` as `'P5b'`, until P5b-1 gives each its status and words.

## Checked before the push

**The SQL bed** (`npm run test:pg:gc-portal-p5b`, the `SQL beds` workflow's `gc-portal-p5b` bed, one line in `scripts/sql-beds.txt`): the whole schema on Supabase Postgres 17, this migration a second time, then `supabase/tests/gc_portal_p5b/20_scenario.sql`, all in one transaction that rolls back. It passed locally on Docker on 2026-10-10, and six mutants were each caught (an upload already filed accepted, an unsent master agreement opened, a known company's form taken, the staff W-9 copied, the client granted, a certificate running out today filed). It checks:
- the three verbs' grants (the service role's alone);
- the ledger: a certificate with no project kept, one on a job refused, a quote's file on no job refused, an unknown purpose refused, both CHECKs validated;
- `gc_trade_coi`'s refusals in order, each with its key and words and no paper written; the certificate filed as a signed `coi` paper of the company's with its day and link, the upload tied to it and no other, the insurance promise kept and the W-9's left open; the same upload twice refused;
- `gc_trade_vetting_form`'s refusals (a known company, a declined one, a blank line, no years, years below zero, a long line, years over 200) with no form written; the form kept trimmed with today's day, a second send replacing it, the company's status untouched;
- `gc_trade_paper_open`'s refusals; the sent master agreement opened with the new token and the office's day kept; an unsent one refused; a W-9 copied from the Subs packet's W-9 (never the staff one that comes first), stamped `w9` by the form trigger, with no person; a second press opening the same W-9 with the newest token; the W-9 signed keeping its promise and opening no more; a Book with no W-9 for subs refused with nothing copied.

`gc-portal-p5a` (the ledger's own bed) and `gc-papers` (the keep trigger and `gc_record_company_coi`) pass with it.

## Verify after the push

Through the management API, each step read only or in `BEGIN … ROLLBACK`:

```sql
-- 1. The ledger's two CHECKs, validated, and project_id nullable.
SELECT conname, convalidated, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.gc_trade_files'::regclass AND conname IN ('gc_trade_files_purpose_known', 'gc_trade_files_job_or_company');
-- Expected: both validated; purpose IN (… 'waiver', 'coi'); (purpose = 'coi') = (project_id IS NULL).
SELECT is_nullable FROM information_schema.columns WHERE table_name = 'gc_trade_files' AND column_name = 'project_id';
-- Expected: YES.

-- 2. The three verbs are the service role's alone.
SELECT f, has_function_privilege('anon', f, 'EXECUTE') AS anon, has_function_privilege('authenticated', f, 'EXECUTE') AS client,
  has_function_privilege('service_role', f, 'EXECUTE') AS service
FROM unnest(ARRAY['public.gc_trade_coi(uuid, date, text)', 'public.gc_trade_vetting_form(uuid, text, text, integer, text, text)',
  'public.gc_trade_paper_open(uuid, text, text, timestamptz)']) f;
-- Expected: anon false, client false, service true on each.

-- 3. Rolled back: the service role opens the test company's W-9, copied from the Book's W-9 for subs.
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.gc_trade_paper_open('ff11d0fb-269e-44de-b92a-e7256c180f67', 'w9', repeat('ab', 32), now() + interval '14 days');
-- Its own statement: a statement cannot see the row its own call wrote.
SELECT d.document_name, d.doc_type, d.status, d.person_id IS NULL AS no_person
FROM public.person_contract_documents d
WHERE d.company_id = 'ff11d0fb-269e-44de-b92a-e7256c180f67' AND d.doc_type = 'w9' AND d.public_token_hash = repeat('ab', 32);
-- Expected: the Book's W-9, w9, sent, true (or alreadySigned if the test company has signed one).
ROLLBACK;
```

No types change is needed for the verbs' callers until P5b-1; the lead's regen picks up the three functions.

## Rollback

Not expected. To undo: drop the three functions, drop `gc_trade_files_job_or_company`, set `project_id` back to `NOT NULL` (after deleting any `coi` row), and put `gc_trade_files_purpose_known` back to its four purposes (`20261010100000`). A certificate filed through `gc_trade_coi` is an ordinary company paper and stays.

## Status

Prepared 2026-10-10 by gc 6 for the Portal lane (gc 3) on `mockups/portal-p5b.md`. The lead pushes it after the merge.
