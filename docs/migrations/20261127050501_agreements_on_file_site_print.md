# 20261127050501_agreements_on_file_site_print.sql (2026-11-27, v2.8686)

Documents → Agreements reads whether a paper prints its site's address (punch list #439, piece 3: `to-dos/site-nda-for-vendors/README.md`). Since v2.8676 the office can tick **Print the site's address on the paper**, and no list said which papers that are out do.

## What it makes

`CREATE OR REPLACE VIEW public.agreements_on_file`, restated from its newest definition (`20261126110711_agreements_on_file_site.sql`), with one column added at the end of each of its five arms and nothing else changed:

| Column | Type | A person's or a party's paper | Every other line |
|---|---|---|---|
| `site_prints_address` | `boolean` | `person_contract_documents.site_prints_address`: false unless the box was ticked | null |

The other lines are a contract, a work order, our contract with an owner and a statement of work. None of them names a site.

## What it leaves as it was

- **Every column before it**, in the same order, so every reader of today reads what it read.
- **Who reads a line.** The view stays `security_invoker = true`, so each table's own policy decides, and the grant to `authenticated` is restated as it was.
- **No table, policy, function, trigger or row** is made or changed. No table is made, so no fence is called.
- **`dev_query_plan`** reads the view with a `SELECT *` inside an `EXPLAIN`, worked out when it runs. It gains the one column and nothing else.

## A view never loses a column

After this file an older definition of the view cannot replace it: Postgres refuses a replace that drops a column. Nobody runs an older migration on prod. Three SQL beds do, to prove a second run changes nothing. `agreements-on-file` and `paper-party` already dropped the view first, and each now applies this file last. `paper-site` applied `*_agreements_on_file_site.sql` over itself. It now drops the view first too, with a plain `DROP VIEW` that fails aloud if anything depends on it, and applies both of the view's files in order.

## Locks

One `CREATE OR REPLACE VIEW`, which takes a short lock on the view alone. `SET lock_timeout = '3s'` opens the file, so a push that cannot take the lock fails fast.

## Order

Either. The list's own PR asks the view for the column and, from a view that does not have it yet, reads the lines without it and draws no words about a print. It follows the push of `20261126070436_paper_names_a_site.sql`, which made the column it reads.

## After the push

The types PR (`npm run gen-types:linked`: the view's row gains one field, and the dev seat's catalog with it), then a `dev-mcp` deploy for the catalog, asked for by name.

## Its bed

`supabase/tests/paper_site/20_scenario.sql` (`npm run test:pg:paper-site`), which drops the view and applies this file a second time after `*_agreements_on_file_site.sql`. Its cases for this file: the view's last four columns are the four of a site, in order and of their types; no paper prints its address until the box is ticked; a paper whose box was ticked says so on its line and no other paper does; a line that is no paper of `person_contract_documents` answers null. The `agreements-on-file` and `paper-party` beds run their own scenarios over the wider view.

**Applied** to prod by 2026-11-27: the dev seat's `check_migration_ledger` read 1,514 versions applied against 1,514 files on `origin/main`, this version among them (read in the docs pass after #9995); types regenerated in #10022.
