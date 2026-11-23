# 20261123020000_sub_company_ground.sql (2026-11-22, v2.8313)

Where an outside signer lives, step 5, the ground (punch list #403, `to-dos/outside-signer-record/README.md`). A sub's business becomes a company record with its workers under it. No screen and no client change ride with it.

## The calls it builds

The owner settled both on 2026-11-19.

- **Call 3.** Every sub's business is a company record of its own, with its workers under it. He answered "Its own company record".
- **Call 7.** That record is the trade company the app already keeps (`gc_companies`). He answered "Yes, one record".

## What it makes

- **`person_trade_companies`**, a new table. One row for a roster person who works for a trade company: `person_id` (the key, so a person has one company at most), `company_id`, `title` (what they are there, "Owner", or null), `linked_by` and `linked_at`. A company holds any number of people. Both links cascade, so a person or a company that is deleted takes its rows along.
- **One policy, `person_trade_companies_office`**: `is_office_staff()` for every command. That is a dev, a leader, an assistant and the controller. The migration ends with the four fence calls, so a training account, a digital twin and an archived account write nothing, and an archived account reads nothing.
- **`person_trade_company_set(p_person_id, p_company_id, p_title)`**. Links a person to a company the app has, moves them, or takes them off when the company is null. An invoker.
- **`person_trade_company_enter(p_person_id, p_company, p_title)`**. One press for a company the app may not have. It finds the company by its name, whatever the case and the spaces, or makes it through `gc_add_company` as a company we know, then links the person. It returns the company's id. An invoker.
- **`gc_company_paper`**, restated from [`20261010009000_gc_papers`](./20261010009000_gc_papers.md) with one line changed. Its first check asked for a dev. It asks for `is_office_staff()` now. The words of the refusal are *Only the office sends a company its papers.*
- **`person_signs_for(p_person_id)`**, a definer the triggers read. It answers the name of the company a person works for. Nobody signed in may call it.
- **Three triggers that keep `signing_for`** (the column is v2.7977's): `signing_for_company_on_write` on `person_contract_documents`, `person_trade_company_papers_on_write` on the new table, and `gc_company_renamed_papers_on_write` on `gc_companies`.

## Rules it settles

- **The link is a table of its own, not a column on `people`.** The roster's read policies are wide: a superintendent, a banking reader and a teammate it is shared with all read rows of it. A new column would have shown each of them something new. A table with one policy shows nobody anything they did not read before.
- **A sub cannot link themselves.** The roster's own update policy would have let a row's owner write a column on it. The table's one policy does not.
- **When a person's paper says who they sign for.** When the paper is made, and again each time it is sent. A paper that is not sent yet follows the link, and the company's name when the company is renamed. A paper that is out keeps what it said when it went, until it is sent again. A signed paper never changes.
- **What is left alone.** A party's paper, a trade company's own paper and a partner's. A paper entered already signed. A send that names the business itself.
- **Why triggers and not the send function.** A person's copy of a job's paper is made unsent and can be signed from a prompt or from the sub's own page with no send between. Only the database sees every one of those writes.
- **A second press makes no second company.** `person_trade_company_enter` looks for the name first, so a press repeated after a failure links to the company the first press made.
- **Nobody reads more.** No read policy on an older table changes. An estimator reads a trade company's own paper, as since v2.7977, and no person's paper, whether or not it names a company.

## Who can do what they could not before

- A leader, an assistant and the controller can make a trade company's copy of a Contract Book entry (`gc_company_paper`). Only a dev could.
- The same four roles can say which company a roster person works for. Nobody could.
- Nobody else gains anything. An estimator still reads and writes `gc_companies` as since door 2, and is refused both doors and `gc_company_paper`.

## The bed

`supabase/tests/sub_company_ground/20_scenario.sql` (`npm run test:pg:sub-company-ground`, in `scripts/sql-beds.txt`). It runs the doors, the papers and the reads as each role through row security. It proves who links and who is refused, who reads the link, every case of `signing_for` above, who makes a company's paper, the one-press door, and that each role reads the papers it read before. The bed `gc_papers` changes one line: the words an estimator is refused with.

## After the merge

`supabase db push`, then a types PR (`npm run gen-types:linked`). No client calls any of it yet, so nothing waits on the push.

## Applied

On the prod ledger, read on 2026-11-23 with the dev seat's `check_migration_ledger` during a docs catch-up. The push's own time and checks were not recorded here. No types PR has followed yet: `src/types/database.ts` does not hold `person_trade_companies` or the functions this file adds.
