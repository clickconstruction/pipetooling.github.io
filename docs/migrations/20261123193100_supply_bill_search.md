# 20261123193100_supply_bill_search.sql (2026-11-23, v2.8406)

One function, `search_supply_bills`, and one column, `supply_papers.page_text`: a search across every supply house bill. Punch list #431, PR 5.

## Why

A bill can be found today one supply house at a time, by eye. The office asked to search invoices, and the lines of most bills are already rows (`supply_paper_lines`, punch list #298), so a search needs no new store: it needs one place that asks the bills and their lines together. The Job Summary's list (v2.8391, v2.8401) searches one job's bills in the browser. Across every bill the same question is asked of the database.

## What changes

- **`supply_papers.page_text text`**, nullable, with a comment. The words of the paper's own pages as its PDF holds them: the ship-to, who ordered, a note, whatever the lines and the row's facts do not keep. The bill sweep writes it from the PDF's text layer, for the pages of the file that are this paper. It is null until the sweep's next PR fills it, and stays null for a scan.
- **`public.search_supply_bills(p_words text[], p_year integer, p_month integer, p_day integer, p_limit integer)`**, a `STABLE` SQL function. No index changes.
- **Each word must be met**, by one of these:
  - the supply house's name, the invoice number, the PO, each without regard to case;
  - the invoice number with its spaces and marks dropped, so `bw7731` finds `BW 7731-02`;
  - the amount, typed plain, with a `$` or with commas, against the size of the bill, so a credit is found by its size;
  - the job the bill is on, by its name or either of its numbers;
  - the PO and the supplier's order number as the paper prints them (`supply_papers.po_text`, `order_number`);
  - a line's description, the house's code or the maker's number, the codes also with their marks dropped;
  - any other word of the paper's page (`page_text`).
- **`p_year`, `p_month` and `p_day`** narrow by the invoice date. Each may be null. With no words they are the whole search.
- **A `%` and a `_` in a word are themselves**, escaped before the `LIKE`, so `100%` is the text and never a wildcard.
- **What comes back**: the bill's id, number, date, amount, house, PO, whether it is paid, whether it has a PDF (a link on the row or a copy of ours), the jobs it is on with each one's percent, and `on_paper` with `on_paper_code`: the first line that met a word the bill's own facts did not, or, when no line did, about a hundred letters of the page around the word. Newest first, at most `p_limit` rows, held between 1 and 200.
- At most eight words are read.

## Who may call it

`SECURITY INVOKER`, on purpose. The function reads `supply_house_invoices`, `supply_houses`, `supply_papers`, `supply_paper_lines`, `supply_house_invoice_job_allocations` and `jobs_ledger` as the caller, so each table's own policy decides what comes back. The office (dev, leader, assistant, controller) finds bills. An estimator and a helper find none, since bills are not theirs to read. A job the caller cannot read is left out of a bill's `jobs`. `EXECUTE` is granted to `authenticated` and `service_role` and revoked from `anon` and `PUBLIC`.

## No index

About 550 bills and a few thousand lines are on file, and a page's words are a few thousand letters. The function reads them whole, a `LIKE` on each, in a few milliseconds. A trigram index would cost a write on every line the sweep saves and would save nothing at this size. If the lines pass a few hundred thousand, add a `pg_trgm` index on the lines' description then.

## The bed

`supabase/tests/supply_bill_search/20_scenario.sql`, run by `scripts/pgtest-supply-bill-search.sh` (`npm run test:pg:supply-bill-search`, in `scripts/sql-beds.txt`): the migration applied a second time, then 36 assertions on made-up bills. What each kind of word finds, the job, the paper's own PO and order number and a word of the page among them; every word met by one of them; a day, a month and a year; a `%` and a `_` never wild; the line a hit names, the words of the page it is shown when no line holds the word, and the hit that names neither; a PDF as a link or a copy; the jobs a bill is on; the limit; then a dev, a leader and the office finding bills, an estimator and a helper finding none, and a signed-out caller refused.

The same assertions ran locally before the push against a stub of the six tables with office-only policies, on Postgres 15, and passed. The full-schema bed needs Docker, which a session here cannot run, so CI's run of it is the first on the real schema.

## Who reads it

Nothing yet. The search box on Materials → Supply houses is the next PR of the train, and it ships after this migration is pushed, so the client never calls a function prod does not have.

## Order

Additive and idempotent: a nullable column added if it is missing, and `CREATE OR REPLACE` of a function nothing calls. Adding a nullable column with no default rewrites nothing; it takes the table's lock for a moment, and the `SET lock_timeout` keeps that from queueing the app. Push any time after the merge, then regenerate the types.
