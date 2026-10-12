# 20261012150000_contract_clauses.sql (2026-10-12, v2.5269)

Messages, cut 4c: contracts from clauses (`to-dos/gc-mode/messages/BUILD_PLAN.md` on branch `spike/gc-mode`; the kernels `src/lib/contracts/assemble.ts` and `approval.ts`, v2.5247). A contract paper in the Contract library becomes an ordered set of clauses. Each clause is for everyone or for the trades named on it, and has its own version. Anyone in the office changes a clause, and a controller or a dev approves the change (the owner, 2026-10-12). A signed copy keeps the words it was signed with. A draft for the lead's review: nothing calls it until the Settings screen and the sign paths of wave 2.

## What it does

1. **`gc_clause_approve_team()`**: dev and controller, named once. Its client copy is `GC_CLAUSE_APPROVE_TEAM` in `src/lib/gc/access.ts`, and `access.test.ts` fails when the two differ. Editing is `gc_office_team()`'s.
2. **`contract_template_documents`** gains `revision` (0 until a clause is published, then one up on every publish) and `published_at`. A publish also moves the row's `updated_at` through its existing trigger, so the Contract library's version date for a clause paper is the day of its newest publish. The library and the People tab's contracts read that date as the book's last edit when no date is set by hand. The library's history trigger does not fire, since it watches the body, the name, the date and the audience only.
3. **`contract_clauses`**, a new table:
   - `paper_id` (the library document, on delete cascade) and `sequence_order`, its place on the paper;
   - `text_en` (1 to 4,000 characters once trimmed) and `text_es` (empty until written; the Spanish page shows the English meanwhile);
   - `scope`, a `text[]`: `{all}`, or one to forty trade names, each said once, none blank or *all* (`contract_clause_scope_ok`);
   - `version` (from 1), `published_by`, `published_by_name`, `published_at`;
   - `retired_at`, `retired_by`, `retired_by_name`: a retired clause leaves the next paper and is never deleted.
4. **`contract_clause_proposals`**, a new table, every change to a clause:
   - `kind` (new, edit, retire), `clause_id` (none for a new clause until it is approved) and `base_v`, the clause's version it was made against;
   - the words and the scope it asks for (a retire keeps the clause's words as they stood), `by_user_id`, `by_name`, `why`;
   - `state` (proposed, approved, declined), `decided_by`, `decided_by_name`, `decided_at`, `decline_why` (required on a decline);
   - once approved, `result_v` (the version it made) and `paper_revision`.

   A dev's or a controller's own change is written already approved, so the approved rows are each clause's whole history.
5. **Who reads and who writes**: the office team reads both tables (`gc_office_team()`, one `SELECT` policy each). `authenticated` holds `SELECT` only and `anon` nothing. Nothing writes but the RPCs:
   - **`edit_clause(paper, kind, clause, text_en, text_es, scope, why)`**: signed in, in the office, not a twin, a known kind, a paper in the library, the clause on that paper and not retired, words and a scope, and a real change. Each refusal is in the kernel's words: *Only the office changes a clause.*, *Write the clause.*, *Pick who it applies to.*, *Nothing changed.*, *That clause is retired already.* A dev's or a controller's change publishes at once. Anyone else's waits as proposed.
   - **`approve_clause_proposal(proposal)`**: a controller or a dev only. Refused once decided, and refused once the clause has moved on or been retired since it was proposed (*That clause changed since Rosa proposed this. Decline it and ask Rosa to propose it again.*), so a newer publish is never overwritten.
   - **`decline_clause_proposal(proposal, why)`**: a controller or a dev, with a why (*Say why, for Rosa.*).
   - `contract_clause_apply`, which the two publish paths share, is granted to nobody. The paper's row is the lock, so two changes to one paper publish one after the other.
6. **`contract_paper_clauses(paper, trades, lang)`**, the paper as one company signs it (`assemblePaper`'s server copy). The live clauses for everyone come first, numbered from 1. Then the exhibit: each clause naming any of the company's trades, once, numbered on from the base, with the trades matched trimmed and case-blind on whole names. It is in the paper's language, with the English where the Spanish is empty. It returns `{paperId, revision, lang, clauses, exhibit, exhibitFor}`, each clause `{id, v, n, text}`. It is not granted to the API, because the sign paths run as the service role or inside their own functions.
7. **The signed copies**: `person_contract_documents`, `gc_owner_contract_sends` and `gc_sows` gain `paper_revision` and `clause_versions` (the assembly above, frozen). Once `clause_versions` is written, the `contract_signed_clauses_frozen` trigger refuses any change to it or to `paper_revision` (*A signed copy keeps the words it was signed with.*). The rest of the row still takes its updates. `gc_sows` is here beside the lead's two because a statement of work is signed on its own row and carries the trade's exhibit.
8. **The three house calls**, so training mode and a digital twin write nothing. Inside the definer functions the training-mode statement trigger still fires, and each function refuses a twin in words.

The approvers' push and email on a proposal, and the editor's text on a decision, are an edge function for later (`messages-notify`).

## Checked before the push

**The SQL bed** (`npm run test:pg:contract-clauses`, the new `contract-clauses` bed) runs every migration on Supabase Postgres 17, then the clauses' migration once more (changing nothing), then the scenario. Docker does not run on the office Mac, so it ran in the SQL beds workflow on #5439. It was green on its first run, 2026-10-12: all 59 assertions, every other bed still passing, and the second apply changing nothing.

- No sign-in reads or changes a clause. A superintendent reads none, changes none, approves none and cannot reach the assembly.
- Rosa proposes a change to clause 2 and it waits. Nobody writes the tables by hand. Rosa does not approve her own change, nor does a leader.
- Maria approves it: clause 2 is Rosa's words as version 2, the paper is revision 2, and the row is approved by Maria with what it made. A decided change is decided once.
- Rosa proposes a change to clause 3 and Robert publishes his own first. His change is its own approved row. Maria cannot approve Rosa's over it.
- A decline needs a why, and keeps it.
- An empty clause, a clause for nobody, the same words and trades, another paper and an unknown kind are each refused in words, and none writes a row.
- Training mode and a digital twin change nothing.
- The paper per trade:
  - Greg's Sitework is matched trimmed and case-blind.
  - Bill's Electrical, low voltage gets no Electrical clause until one names his trade.
  - Two trades get both exhibits in order.
  - A new clause goes after the last.
  - Spanish falls back to English clause by clause.
- Greg's signed copy keeps its words, its revision and each clause's version after the Sitework clause is retired. Nobody rewrites the copy, and the rest of the row still takes a note.
- The tables carry their read policies, the twin fence and the training-mode trigger, and the three signed copies carry their freeze.

## Verify after the push

```sql
-- 1. The tables, their policies and grants.
SELECT tablename, policyname, permissive, cmd FROM pg_policies WHERE tablename IN ('contract_clauses', 'contract_clause_proposals') ORDER BY 1, 2;
-- expect per table: *_office_reads (PERMISSIVE, SELECT), the three digital_twin_write_fence_* and three read_only_users_cannot_* (RESTRICTIVE)
SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_name IN ('contract_clauses', 'contract_clause_proposals') AND grantee IN ('anon', 'authenticated') ORDER BY 1, 2;
-- expect: authenticated SELECT on each, nothing for anon

-- 2. The RPCs' grants.
SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('edit_clause', 'approve_clause_proposal', 'decline_clause_proposal', 'contract_clause_apply', 'contract_paper_clauses', 'gc_clause_approve_team') ORDER BY 1;
-- expect: authenticated true for edit_clause, approve_clause_proposal, decline_clause_proposal, gc_clause_approve_team; false for the other two; anon false everywhere

-- 3. The new columns and the freeze.
SELECT table_name, column_name FROM information_schema.columns
WHERE column_name IN ('paper_revision', 'clause_versions', 'revision', 'published_at')
  AND table_name IN ('person_contract_documents', 'gc_owner_contract_sends', 'gc_sows', 'contract_template_documents') ORDER BY 1, 2;
SELECT tgrelid::regclass FROM pg_trigger WHERE tgname = 'contract_signed_clauses_frozen' ORDER BY 1;
-- expect: the three signed-copy tables

-- 4. Every library document reads revision 0 (rolled back, read only).
SELECT count(*) FILTER (WHERE revision <> 0) FROM public.contract_template_documents;
-- expect: 0
```

## Rollback

```sql
DROP TRIGGER IF EXISTS contract_signed_clauses_frozen ON public.person_contract_documents;
DROP TRIGGER IF EXISTS contract_signed_clauses_frozen ON public.gc_owner_contract_sends;
DROP TRIGGER IF EXISTS contract_signed_clauses_frozen ON public.gc_sows;
DROP FUNCTION IF EXISTS public.contract_signed_clauses_frozen();
DROP FUNCTION IF EXISTS public.edit_clause(uuid, text, uuid, text, text, text[], text);
DROP FUNCTION IF EXISTS public.approve_clause_proposal(uuid);
DROP FUNCTION IF EXISTS public.decline_clause_proposal(uuid, text);
DROP FUNCTION IF EXISTS public.contract_clause_apply(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.contract_paper_clauses(uuid, text[], text);
DROP TABLE IF EXISTS public.contract_clause_proposals;
DROP TABLE IF EXISTS public.contract_clauses;
DROP FUNCTION IF EXISTS public.contract_clause_scope_clean(text[]);
DROP FUNCTION IF EXISTS public.contract_clause_scope_ok(text[]);
DROP FUNCTION IF EXISTS public.contract_trade_key(text);
DROP FUNCTION IF EXISTS public.gc_clause_approve_team();
ALTER TABLE public.person_contract_documents DROP COLUMN IF EXISTS paper_revision, DROP COLUMN IF EXISTS clause_versions;
ALTER TABLE public.gc_owner_contract_sends DROP COLUMN IF EXISTS paper_revision, DROP COLUMN IF EXISTS clause_versions;
ALTER TABLE public.gc_sows DROP COLUMN IF EXISTS paper_revision, DROP COLUMN IF EXISTS clause_versions;
ALTER TABLE public.contract_template_documents DROP COLUMN IF EXISTS revision, DROP COLUMN IF EXISTS published_at;
```

Nothing reads or writes them until wave 2's Settings screen and sign paths. Roll those back first if they have merged.

## Status

Written 2026-10-12 with the migration, as a draft PR for the lead's review. Not pushed.
