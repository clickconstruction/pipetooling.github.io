# 20261012130000_portal_customer_page.sql (2026-10-12, v2.5263)

Messages, cut 8 (the portals; `to-dos/gc-mode/messages/BUILD_PLAN.md` on branch `spike/gc-mode`): what the customer's page needs from the database before its screens. It waits on nothing from cut 1. The portal's write that lands a customer's note in the thread waits on cut 1's `messages` table and is not here.

## What it does

1. **A view per paper.** `public_page_views` gains `paper_kind` (contract, change_order or pay_app) and `paper_id` (the paper's own id, no FK, as `entity_id`). They are written under a surface of their own, `portal_paper`, with `entity_id` the customer.
   - **Why a surface, not new columns on `portal` rows**: every reader of the table counts `surface = 'portal'` rows as page loads. Those are the globe's "Opened N times" in `customer-portal`, the usage readout's `usage_customer_views` and `journey_health_counts`. A paper row under `portal` would inflate all three. A surface of its own leaves them true without touching them.
   - **Why not a `customer_paper_views` table**: the trail's grain, one row per open with who opened it (`viewer`), is the grain a paper open needs. A second table would repeat its columns and its rule for who counts.
   - `public_page_views_surface_check` gains `portal_paper`. `public_page_views_paper_check` holds a paper row to a known kind, a paper id and a customer, and keeps the paper columns empty on every other row. Both go on `NOT VALID` and are then validated under the lighter lock, so the portals keep writing.
   - `customer_portal_views(customer_ids uuid[])` reads it back for the office team (`gc_office_team()`): per customer, one row for the page (`paper_kind` NULL) and one per paper, with the first and last outside open and the count. Staff looks and previews never count. It is `SECURITY DEFINER`; anyone else gets no rows, and `anon` cannot call it. The trail's `(surface, entity_id, occurred_at)` index serves it, so no index is added.
2. **`customer_page_words`**, a new table: every sentence of ours on the customer's page in English and Spanish (Settings → Customer page).
   - `key` (pageWords.ts's key; a paper's words are `paper.<id>.<field>`), `en` and `es` (1 to 400 characters), `edited_by` and `edited_at`.
   - **Seeded** from `src/lib/portal/pageWords.ts`: 144 sentences, written into the migration by `scripts/customer-page-words-sql.ts`. The seed is an upsert that follows the code only where `edited_at IS NULL`, so an office edit is never overwritten. `customerPageWords.test.ts` fails when the newest migration's block and the code differ. A later word change ships with a new migration holding a fresh block.
   - **An edit** (trigger `customer_page_words_edit`): a signed-in edit keeps the sentence's `{blanks}` in both languages (`customer_page_word_blanks`) and is stamped with who and when. A seed from a migration (no signed-in user) passes untouched and unstamped.
   - **One policy, the office team's** (`customer_page_words_team`). `anon` holds nothing. `authenticated` holds `SELECT`, plus `UPDATE` on `en` and `es` only. No client adds or removes a sentence.
3. **Three switches per job** on `gc_projects`, each `NOT NULL DEFAULT false`: `portal_photos_on`, `portal_forecast_on` and `portal_spanish_on`. Spanish stays off until a native speaker reads the portal's Spanish, as `PORTAL_SPANISH_ON` holds the trade portal's. They are written under `gc_projects`' existing team policy. Adding a column with a constant default rewrites nothing.
4. **The three house calls** (`apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()`, `apply_digital_twin_write_blocks()`) cover the new table.

Nothing reads or writes any of it until the customer page's screens. Then `customer-portal` writes `portal_paper` rows when a customer opens a paper and reads the words and the switches.

## Checked before the push

**The SQL bed** (`npm run test:pg:portal-customer-page`, the new `portal-customer-page` bed, run by the SQL beds workflow on the PR, since no session on the office Mac reaches Docker): every migration on Supabase Postgres 17, this migration once more (changing nothing), then the scenario. Partway through, the scenario runs the migration again at its `-- @reseed` line.

- Nobody signed out reads the words or calls the read-back.
- The 144 sentences are seeded. A sample reads in both languages, and nobody has edited one yet.
- An assistant edits a sentence and is stamped with who and when. A reword around a blank passes.
- These are refused: dropping a blank in either language, adding one, an empty sentence, setting the stamp, changing a key, a new sentence, a removed sentence.
- A superintendent and a subcontractor read none and edit nothing. Training mode reads and is refused (*Read-only (training) mode*). A digital twin's edit changes nothing.
- The re-seed puts an unedited sentence back to the code's words and leaves the two office edits, stamping nothing.
- Paper views:
  - Two page loads, change order 2 opened twice, the contract once, a staff look at the contract and another customer's pay application.
  - The assistant reads back the page, the change order and the contract, with first, last and count.
  - A dev reads both customers. A superintendent reads nothing.
  - The usage readout still counts the two page loads only.
  - A paper row with no paper, a page row naming a paper, an unknown kind, a paper row with no customer and an unknown surface are each refused.
- A job starts with all three switches off. The assistant turns photos on, and a superintendent turns nothing on.
- The policies, the two triggers and the grants are exactly as listed above.

## Verify after the push

```sql
-- 1. The words: seeded, and nobody's edit yet.
SELECT count(*), count(*) FILTER (WHERE edited_at IS NOT NULL) FROM public.customer_page_words;
-- expect: 144, 0
SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename = 'customer_page_words' ORDER BY 1;
-- expect: customer_page_words_team (PERMISSIVE, ALL), the three digital_twin_write_fence_* and three read_only_users_cannot_* (RESTRICTIVE)
SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
WHERE table_name = 'customer_page_words' AND grantee = 'authenticated' AND privilege_type = 'UPDATE';
-- expect: en,es

-- 2. The paper columns and checks; no existing row names a paper.
SELECT conname FROM pg_constraint WHERE conrelid = 'public.public_page_views'::regclass AND conname LIKE 'public_page_views_%_check' ORDER BY 1;
-- expect: public_page_views_paper_check, public_page_views_surface_check, public_page_views_via_check, public_page_views_viewer_check
SELECT count(*) FROM public.public_page_views WHERE surface = 'portal_paper' OR paper_kind IS NOT NULL;
-- expect: 0

-- 3. The switches, all off.
SELECT count(*) FILTER (WHERE portal_photos_on OR portal_forecast_on OR portal_spanish_on) FROM public.gc_projects;
-- expect: 0

-- 4. A sample assistant reads one customer back (rolled back).
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM public.users WHERE role = 'assistant' AND NOT read_only LIMIT 1), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT * FROM public.customer_portal_views(ARRAY[(SELECT customer_id FROM public.projects WHERE customer_id IS NOT NULL LIMIT 1)]);
ROLLBACK;
-- expect: at most one row, the page (paper_kind NULL), with no error
```

## Rollback

```sql
ALTER TABLE public.gc_projects DROP COLUMN IF EXISTS portal_photos_on, DROP COLUMN IF EXISTS portal_forecast_on, DROP COLUMN IF EXISTS portal_spanish_on;
DROP TABLE IF EXISTS public.customer_page_words;
DROP FUNCTION IF EXISTS public.customer_page_words_edit();
DROP FUNCTION IF EXISTS public.customer_page_word_blanks(text);
DROP FUNCTION IF EXISTS public.customer_portal_views(uuid[]);
ALTER TABLE public.public_page_views DROP CONSTRAINT IF EXISTS public_page_views_paper_check;
ALTER TABLE public.public_page_views DROP COLUMN IF EXISTS paper_kind, DROP COLUMN IF EXISTS paper_id;
ALTER TABLE public.public_page_views DROP CONSTRAINT IF EXISTS public_page_views_surface_check;
ALTER TABLE public.public_page_views ADD CONSTRAINT public_page_views_surface_check
  CHECK (surface IN ('portal', 'estimate_terms', 'contract_accept', 'hazmat_notice', 'sub_portal', 'legal_portal', 'gc_trade_portal'));
```

Nothing reads or writes any of it before the customer page's screens. Roll those back first if they have merged.

## Status

Written 2026-10-12 as a draft PR. Not pushed: `supabase db push` waits for the lead's go, after the file is on `main`.
