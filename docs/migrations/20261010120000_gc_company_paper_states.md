# 20261010120000_gc_company_paper_states.sql (2026-10-10, v2.5179)

GC mode, the Board's papers read for the office, carved out of Building's door D1 (call 6) at the lead's word, so the
Board's loader can switch before the door (`to-dos/gc-mode/mockups/building-door.md`, on branch `spike/gc-mode`).

## What it does

1. **`gc_company_paper_states(p_company_ids uuid[] DEFAULT NULL)`**, a new function, `STABLE SECURITY DEFINER`,
   `SET search_path = public`. It returns a trade partner company's papers as `companyPapers` reads them
   (`CompanyPaperRow`):
   - only a company's own rows of `person_contract_documents` (`company_id IS NOT NULL`), never a person's;
   - only the three kinds the board reads: `agreement`, `w9` and `coi`;
   - only eight columns: `id`, `company_id`, `doc_type`, `status`, `sent_at`, `signed_at`, `expires_at`, `created_at`.
     Never `form_hints` (a W-9's last four of its tax number), the answers' PDF path or the signer's IP and agent;
   - all companies' rows, or those of `p_company_ids` when it is given;
   - for the office team (`gc_office_team()`: dev, the leaders, the assistants, the controller and estimators); an
     empty set, not an error, for anyone else.
2. `EXECUTE` is revoked from `PUBLIC` and `anon`, and granted to `authenticated` and `service_role`.

No table is created or changed, so no restrictive block is added. The table's own policies are unchanged: a person's
paper and every other column stay the pay roles' (a dev, a leader, an assistant, and the controller through
`has_payroll_access()`).

**Why a function, not a row policy.** `person_contract_documents`' `SELECT` policy reads for the pay roles only, so an
estimator's board read every company's master agreement, W-9 and certificate as missing and held its bars as not
ready. A `FOR SELECT` policy for the office would give it every column of a company's row, the W-9's
`form_hints` and the signer's details among them (the Board's call, gc 2). `created_at` rides beside the Board's seven
columns because `companyPapers` orders by it and falls back to it for a master agreement's signed day.

**Building's door D1** widens the gate to `gc_on_any_schedule_team()` or the office with one `CREATE OR REPLACE`, once
the schedule's PR 10 brings that function.

## Checked before the push

**The SQL bed** (`npm run test:pg:gc-papers`, the `gc-papers` bed): every migration on Supabase Postgres 17, then the
papers' scenario, whose new section 7 checks:

- the function's result is exactly the eight columns, and it is a stable definer with its `search_path` pinned;
- a dev, the controller and an estimator each read the same rows, every company paper of the three kinds (the
  estimator reads none of the table itself);
- no person's paper and no other kind ever comes back, while the fixture holds both;
- one company's papers when asked for one;
- a subcontractor gets an empty set;
- `anon` holds no `EXECUTE`, and `authenticated` does.

## Verify after the push

```sql
-- 1. The function, its settings and its grants.
SELECT prosecdef, provolatile, proconfig, pg_get_function_result(oid)
FROM pg_proc WHERE oid = 'public.gc_company_paper_states(uuid[])'::regprocedure;
-- expect: true, s, {search_path=public}, TABLE(id uuid, company_id uuid, doc_type text, status text,
--         sent_at timestamp with time zone, signed_at date, expires_at date, created_at timestamp with time zone)
SELECT has_function_privilege('anon', 'public.gc_company_paper_states(uuid[])', 'EXECUTE') AS anon,
       has_function_privilege('authenticated', 'public.gc_company_paper_states(uuid[])', 'EXECUTE') AS authed;
-- expect: false, true

-- 2. A sample controller reads the company papers a dev reads (rolled back).
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM public.users WHERE role = 'controller' LIMIT 1), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.gc_company_paper_states();
ROLLBACK;
-- expect: the same count as
SELECT count(*) FROM public.person_contract_documents WHERE company_id IS NOT NULL AND doc_type IN ('agreement', 'w9', 'coi');

-- 3. A sample subcontractor reads none (rolled back).
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM public.users WHERE role = 'subcontractor' LIMIT 1), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.gc_company_paper_states();
ROLLBACK;
-- expect: 0
```

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_company_paper_states(uuid[]);
```

Nothing reads it until the Board's loader switches; roll the loader back first if it has.

## Status

Written 2026-10-10 with the migration. Not pushed.
