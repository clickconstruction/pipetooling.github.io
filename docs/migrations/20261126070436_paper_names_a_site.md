# 20261126070436_paper_names_a_site.sql (2026-11-26, v2.8642)

A paper's row can name a site (punch list #439, piece 3, the ground: `to-dos/site-nda-for-vendors/README.md`). Nothing on a screen reads or writes it yet: the client PRs of piece 3 are built on this once it is pushed.

## What it makes

Every statement is safe to run twice. No table, so it ends with no fence call. No policy, grant, function, trigger or row is made or changed.

Four columns on `person_contract_documents`, all empty on every row there is:

| Column | Type | What it holds |
|---|---|---|
| `site_development_id` | `uuid`, `REFERENCES developments(id) ON DELETE SET NULL` | The site when it is a development, which carries all its jobs. |
| `site_address_key` | `text` | The site when it is an address: the cleaned key (`normalizeAddressKey`), the form `address_place_answers` keeps, so the same place is one site. |
| `site_address` | `text` | The address as written when the paper was sent, for the row's label and for the print. |
| `site_prints_address` | `boolean NOT NULL DEFAULT false` | True when the signer reads the address before signing. The box starts unticked. |

Three checks hold the shape:

| Check | The rule |
|---|---|
| `person_contract_documents_site_one_kind` | A row names at most one of the two: a development or an address key. |
| `person_contract_documents_site_key_words` | A key is never blank and is at most 300 characters, as `address_place_answers` holds its keys. |
| `person_contract_documents_site_address_words` | The address as written sits only beside a key, is never blank and is at most 500 characters. The print is true only on a row that keeps an address as written. |

Two partial indexes, since every list of a site's papers reads by site: `idx_person_contract_documents_site_development` and `idx_person_contract_documents_site_address_key`, each over the rows where its column is set.

## What it leaves as it was

- **Who writes a site.** The table's policies answer by role and name no column. Whoever may write a paper may write its site, and nobody else.
- **The signer.** `get-contract-for-signer`, `accept-contract` and the signed copy read the row by a list of columns they name. Nothing of a site reaches a signer until one of them is changed to say so. The PR that prints an address owes that function's change and its deploy.
- **Documents → Agreements.** `agreements_on_file` names its own columns, so it answers as before. A site filter there needs the view to answer the site, which is a migration of its own: `20261126110711_agreements_on_file_site.sql`.
- **The triggers of the table.** None watches these columns.
- **A new version of a paper.** `create_pending_contract_versions_after_book_save` copies a paper by a list of columns it names, so the copy it makes names no site. The client PR that sends a site's paper says what a new version does.
- **One signature per site.** No unique rule: a paper can be taken back and sent again, so the send asks.

## Locks

Four `ALTER TABLE … ADD COLUMN`, each a change of the catalog alone. The key to `developments` takes a short lock on that table too. The three checks are added `NOT VALID` and validated after, so the one read of the table lets writes through. Two small index builds on a table of papers. `SET lock_timeout = '3s'` opens the file, so a push that cannot take a lock fails fast and is tried again in a quieter moment.

## Order

Either. The client calls and reads nothing new until piece 3's client PRs, which are built after the push.

## After the push

The types PR (`npm run gen-types:linked`, both generated type files and the dev seat's catalog), and then a `dev-mcp` deploy for the catalog, asked for by name.

## Its bed

`supabase/tests/paper_site/20_scenario.sql` (`npm run test:pg:paper-site`), which applies this file a second time. Its cases: a paper made with no site names none; a paper names a development; a paper names an address by its key, keeps the address as written and the print; never both; a blank key and a key of 301 characters are refused; an address with no key, a blank one, one of 501 characters and a print with no address are refused; the dev writes a site through the table's policies and a subcontractor reaches no row; a development deleted leaves its paper naming no site; the indexes are partial and the checks validated; `agreements_on_file` answers the site as its last three columns, since `20261126110711_agreements_on_file_site.sql`.
