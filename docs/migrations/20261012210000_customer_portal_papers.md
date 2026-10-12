# 20261012210000_customer_portal_papers.sql (2026-10-12, v2.5290)

Messages, cut 8 (the portals): the papers each customer was sent, for the office's read-back. That is the thread header's portal pill, Follow up's portal rows, the step card's So far and By company's Portal column. It reads `public_page_views`' `paper_kind` and `paper_id`, so it goes after `20261012130000_portal_customer_page.sql`.

## What it does

**`customer_portal_papers(customer_ids uuid[])`**, `SECURITY DEFINER`, for the office team (`gc_office_team()`). For the customers named, it returns each paper sent as its non-money half:
- our contract's newest send on each job, answered once signed on their page or marked signed at the office (`gc_projects.owner_contract_signed_on`);
- each change order that went (never a draft), answered once signed or declined;
- each pay application that went (paid, never answered here).

Its columns are `customer_id`, `project_id`, `job`, `paper_kind`, `paper_id`, `number`, `description`, `sent_on`, `answered` and `first_opened_at`. The last is the customer's first outside open of that paper on their page; a staff look never counts. There is never a cost, price, worth, total, amount, due, retainage, file or token. Anyone off the office team gets no rows, and `anon` cannot call it.

**Why a definer read.** Assistants drive Messages, and the three tables read only for the money team (`gc_owner_contract_sends` from award's door). Under their own policies, the read-back would show an assistant no paper. This was the lead's call (a), reported to the owner as taken.
- A change order's number, words and status already read for the office through `gc_change_orders_office`.
- A pay application's number and day without a dollar follow the rule cut 9 set for the superintendent.
- It is the `gc_company_paper_states` pattern: the states only.

The client reads it beside `customer_portal_views` (the page's own opens) through `loadCustomerPortalReadBack` (`src/lib/portal/customerPortalViewsIo.ts`). `customerPaperViews` puts them together.

## Checked before the push

**The SQL bed** (`npm run test:pg:customer-portal-papers`, the new `customer-portal-papers` bed, run by the SQL beds workflow on the PR): every migration on Supabase Postgres 17, this one once more (changing nothing), then the scenario.

- Nobody signed out calls it.
- **An assistant reads back:**
  - our contract's newest send (signed);
  - the two change orders that went, with the waiting one's first outside open (a later open does not move it), and never the draft;
  - both pay applications, with the first one's open;
  - each with the papers' own ids.
- A staff look at the contract does not count.
- Another customer's contract waits until the office marks it signed, then reads answered. Two customers read in one batch.
- A superintendent reads no papers.
- The output columns are exactly the ten above, and none names money, a file or a token.

## Verify after the push

```sql
-- 1. The columns, and the grants.
SELECT string_agg(p.parameter_name, ',' ORDER BY p.ordinal_position)
FROM information_schema.parameters p JOIN information_schema.routines r ON r.specific_name = p.specific_name
WHERE r.routine_name = 'customer_portal_papers' AND p.parameter_mode = 'OUT';
-- expect: customer_id,project_id,job,paper_kind,paper_id,number,description,sent_on,answered,first_opened_at
SELECT has_function_privilege('anon', 'public.customer_portal_papers(uuid[])', 'EXECUTE');
-- expect: false

-- 2. A sample assistant reads one customer's papers (rolled back).
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM public.users WHERE role = 'assistant' AND NOT read_only LIMIT 1), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT paper_kind, number, sent_on, answered FROM public.customer_portal_papers(ARRAY[(SELECT customer_id FROM public.projects p JOIN public.gc_projects g ON g.project_id = p.id WHERE p.customer_id IS NOT NULL LIMIT 1)]);
ROLLBACK;
-- expect: that customer's papers, with no error
```

## Rollback

```sql
DROP FUNCTION IF EXISTS public.customer_portal_papers(uuid[]);
```

Nothing calls it before the read-back's screens. Roll those back first if they have merged.

## Status

Written 2026-10-12. Not pushed: `supabase db push` follows the lead's go, after the file is on `main` and after 20261012130000.
