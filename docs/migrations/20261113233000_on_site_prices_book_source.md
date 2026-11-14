# 20261113233000_on_site_prices_book_source.sql (2026-11-13, v2.7216)

A third source for a site's own price (punch list #342). The pricing window's **Just price** takes a parts-book part's price for a row without tying the row's name to the part. That answer is a row of `on_site_prices`, and it needs to say where its number came from.

## What it does

One change to `on_site_prices` ([`20261113160000`](./20261113160000_on_site_prices.md)): the check `on_site_prices_source_check` is dropped and added again as `source IN ('typed', 'bill', 'book')`. The column's comment says what each means.

A `book` row carries the part's name in `source_words` and the day the book last checked the price in `priced_on`, so the on-site price rule flags it past 90 days as it would the book's own price. No column, policy or grant changes: read, insert and delete stay with the roles that read the Materials desk with its money.

## Locks

Dropping and adding a check takes an exclusive lock on `on_site_prices` for as long as it reads the table's rows once. The table is days old and holds a site's answers, tens of rows at most. `SET lock_timeout = '3s'` makes a busy moment fail fast. Idempotent: the drop is `IF EXISTS`, so a second run leaves the same check.

## Release order

The client sends `book` only from the new press. Merge, then `supabase db push` right after. Until the push that press is refused by the old check and the window says the price was not saved; nothing else is affected.

## Verify

Read-only on prod after the push:

- `select pg_get_constraintdef(oid) from pg_constraint where conname = 'on_site_prices_source_check'` names all three sources.
