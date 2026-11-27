---
name: "Trade partners: the table lets the office delete a company that the Remove press refuses"
number: 449
group: ready
status: found 2026-11-27 while reading finding 318 for card #443 · read in the migrations only, prod not read · nothing built · the person asked for this card the same day
summary: >
  Remove from the bench refuses a company with history, and it is the only press that takes a
  company off Trade partners. But the table under it still carries the policy it was made with:
  every verb for the office team, DELETE among them. A delete sent straight at the table would
  pass that policy, skip the press's rule and take the company's asks, call log and promises
  with it by cascade. No screen sends one. The mend is one small migration that leaves the
  office SELECT, INSERT and UPDATE and takes DELETE away, so the function is the only way out.
next: Build the one migration and its bed case, in a PR that stays unarmed until its push is asked by name. Read prod's policy and privilege list first, since this card was written from the migrations alone.
size: S
blocker: None to build. The push is a write on prod and takes its own yes.
opinion: build — the rule the owner gave on 2026-11-08 is held by a function today and by nothing under it, and the fix removes a privilege no screen uses
mockup: not required — no screen changes; a privilege and a policy on one table
---

## The ask

Finding 318 of the walks (2026-11-27) saw three ZZ Test companies on Trade partners. The read for it asked whether anything takes a company with history off the bench. Nothing does, and that is a row for card #443. The read also saw this, beside the question: the table's own policy would let a delete through.

Put to the person the same day as *Whether the open delete policy on `gc_companies` gets a card of its own. My pick is yes, as a small card for the database lane.* The answer, as relayed: *yes to all pics*. So this is the card, not the fix.

## What was read, in the migrations

Read at `origin/main` on 2026-11-27. **Prod was not read.** A later hand change on prod would not show here, so the first step of the build is to read the live policy and privileges.

- **The policy.** `20261009040000_gc_door_2_board_team.sql`, lines 44 to 54, drops `gc_companies_dev` and makes `gc_companies_team`: `FOR ALL TO authenticated`, `USING` and `WITH CHECK` both `gc_office_team()`. The same loop does it for nine more Board tables. No later migration names `gc_companies_team` again.
- **The privileges.** `20261008020000_gc_company_record.sql`, line 656, revokes everything on the Board's tables from `anon`. Line 662 revokes UPDATE, DELETE and TRUNCATE from the signed-in role on three of them: the call log, the quotes and a promise's earlier days. `gc_companies` is not one of the three, so the signed-in role keeps DELETE on it.
- **The rule the press holds.** `gc_remove_bench_company`, newest in `20261124153500_gc_bench_hold_says_we_emailed.sql`. It refuses a company with a work order, an ask, a logged contact, a promise, a paper, a file, an email we sent, a Messages thread, a vetting form, an opened portal or a record on a job. Only then does it delete the row. Its first version's header (`20261109004500`) says in words that the office already has FOR ALL on the table, so a plain delete would go through and cascade.
- **What a plain delete would take, and what would stop it.** The foreign keys onto `gc_companies(id)` are of two kinds.
  - **CASCADE, eleven tables, so the rows go with the company:** the people on it, its vetting form, its asks (and their quotes with them), its call log, its promises, its portal links, the emails sent to it, its bid-tab views, its paper sends, its document builder sends and its roster links.
  - **RESTRICT, fifteen tables, so the delete is refused:** a work order and a report on its line, a back charge, a change request, an RFI, a portal file, a company paper, a Messages contact, a plan question, a plan set sent, and five kinds of schedule record.
  - Two more set the company's id to null: a prospect it came from and an ask taken back.
  - So a company whose history is asks, calls, promises and emails alone would go, with that history. A company with a work order or a paper would be refused by the key.
  - Read by a search of every migration for a key onto `gc_companies(id)`. A key changed later by name would not show in that search.
- **Who sends one today.** Nobody. The client calls the function and never deletes (`src/lib/gc/gcIo.ts`, `removeGcBenchCompany`). The only `DELETE FROM public.gc_companies` in the repo is inside the function. No edge function writes the table. The dev seat names it only in its read catalog.
- **Who could.** Anyone `gc_office_team()` passes, with a request written by hand. Training accounts, digital twins and archived callers are held by their own fences.

## The decision

Not made. The person asked for the card. The build waits on a word, and its push on its own yes.

## The smallest mend

One migration, no client change, no deploy.

1. `REVOKE DELETE, TRUNCATE ON public.gc_companies FROM authenticated;`. With no privilege the statement is refused before any policy or key is asked.
2. Replace `gc_companies_team` with three policies for the office team: SELECT, INSERT and UPDATE. Then a privilege given back by mistake still meets no DELETE policy.
3. Leave `gc_remove_bench_company` as it is. It is a definer's function owned by the table's owner, so it deletes without the caller's privilege and past the caller's policies. Check the owner on prod before the push: the function and the table must have one owner, and the table must not force row security on its owner.
4. Leave the other nine Board tables to a second look. The same FOR ALL policy sits on each, and three already lost their DELETE privilege. Whether `gc_company_people`, `gc_company_vetting_forms`, `gc_invites`, `gc_trade_promises`, `gc_bid_tabs` and `gc_bid_tab_views` need a direct delete is a read of the client for each, and belongs in the same PR only if every answer is no.

## Where it plugs in

- New: `supabase/migrations/<stamp>_gc_companies_no_direct_delete.sql` and its page under `docs/migrations/`.
- Amended: `docs/ACCESS_CONTROL.md`, the line that says what the office holds on the Board's tables.
- The bed `gc-take-ask-back` already plays `gc_remove_bench_company` for a company that stays and one that goes. `gc-papers`, `gc-back-charges` and `messages-spine` each try a raw delete of a company and expect the key's refusal (`23503`). After the mend those three cases meet the privilege first (`42501`), so each bed changes with the migration.

## How to verify

In a bed, on the whole schema, in one transaction that rolls back, with made-up companies:

- As an office teammate, a raw `DELETE FROM public.gc_companies` is refused with `42501 permission denied for table gc_companies`, for a company with no history, one with an ask alone and one with a work order. The words are the same for all three.
- The same teammate still reads the bench, adds a company and changes its address.
- `gc_remove_bench_company` still takes off a company with no history and still refuses one with an ask, in its own words.
- The mutant: with the old policy and privilege put back inside the transaction, the raw delete of the company with an ask alone goes through and its ask is gone. That is the gap.

After a push, read only: the table's privilege list and its policies, and a read of Trade partners through the dev seat that still answers.

## Not this card

- Taking a company with history off the bench. Nothing does, by the owner's rule of 2026-11-08. That is a row on card #443's list.
- The three ZZ Test companies on prod. Card #443 holds them.
