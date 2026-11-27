# 20261126110711_agreements_on_file_site.sql (2026-11-26, v2.8659)

Documents → Agreements reads the site a paper names (punch list #439, piece 3: `to-dos/site-nda-for-vendors/README.md`). Since v2.8668 the tab's **Find by site…** asks the view by `site_address_key`, and a line says its paper's site from `site_address`.

## What it makes

`CREATE OR REPLACE VIEW public.agreements_on_file`, restated from its newest definition (`20261123190000_agreements_party_join_by_key.sql`), with three columns added at the end of each of its five arms and nothing else changed:

| Column | Type | A person's or a party's paper | Every other line |
|---|---|---|---|
| `site_development_id` | `uuid` | `person_contract_documents.site_development_id` | null |
| `site_address_key` | `text` | `person_contract_documents.site_address_key` | null |
| `site_address` | `text` | `person_contract_documents.site_address` | null |

The other lines are a contract, a work order, our contract with an owner and a statement of work. None of them names a site.

`site_prints_address` was not answered here. `20261127050501_agreements_on_file_site_print.sql` (v2.8686) adds it as the view's last column, once a paper could print its address.

## What it leaves as it was

- **Every column before the three**, in the same order, so every reader of today reads what it read.
- **Who reads a line.** The view stays `security_invoker = true`, so each table's own policy decides, and the grant to `authenticated` is restated as it was.
- **No table, policy, function, trigger or row** is made or changed. No table is made, so no fence is called.
- **`dev_query_plan`** reads the view with a `SELECT *` inside an `EXPLAIN`, worked out when it runs. It gains the three columns and nothing else.

## A view never loses a column

After this file an older definition of the view cannot replace it: Postgres refuses a replace that drops a column. Nobody runs an older migration on prod. Two SQL beds did, to prove a second run changes nothing: `agreements-on-file` and `paper-party` apply `*_paper_party.sql` and the files after it again. Each now drops the view first, with a plain `DROP VIEW` that fails aloud if anything depends on it, and applies this file last.

## Locks

One `CREATE OR REPLACE VIEW`, which takes a short lock on the view alone. `SET lock_timeout = '3s'` opens the file, so a push that cannot take the lock fails fast.

## Order

Either. The client reads the same columns from the old view and the new until the site filter's own PR, which is built after the push. It follows the push of `20261126070436_paper_names_a_site.sql`, which made the three columns it reads.

## After the push

The types PR (`npm run gen-types:linked`: the view's row gains three fields, and the dev seat's catalog with it), then a `dev-mcp` deploy for the catalog, asked for by name.

## Its bed

`supabase/tests/paper_site/20_scenario.sql` (`npm run test:pg:paper-site`), which applies this file a second time after `*_paper_names_a_site.sql`. Its cases for the view: the view's last three columns are the three of a site, in order and of their types; a sent agreement that names an address reads its key and its address as written on its line; one that names a development reads the development; one that names no site reads three nulls; a filter by a site's key finds its one line. The `agreements-on-file` and `paper-party` beds run their own scenarios over the wider view.

**Applied** to prod by 2026-11-26: the dev seat's `check_migration_ledger` read 1,504 versions applied against 1,504 files on `origin/main`, this version among them (read in the docs pass after #9830); types regenerated in #9987.
