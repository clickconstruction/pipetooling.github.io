# 20261013180000_contacts_seven_kinds.sql (2026-10-12, v2.5410)

Messages, residential R0 · 2 of 3 (Customer communication helper 2, directed by the lead session "Docs review and customer handoff"). The database half of the owner's call of 2026-10-13: a contact is one of seven kinds. The kernels are v2.5390 (`contacts/kernel.ts`, `followUp/queue.ts`) and the loaders v2.5402 (`contacts/load.ts`). The plan is `to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` on spike/gc-mode. Push it after 20261013170000 (R4's residential flow, #5568) and before 20261013190000 (R5, #5590). No table is made, so no fence calls end it.

## What it does

1. **The kinds.** `contacts_kind_known` holds eight values: the seven kinds and the spine's `unknown`.
   - The seven are `customer`, `trade`, `arch`, `lead`, `supply_house`, `candidate` and `sub`.
   - `unknown` is a number nobody has named yet, as before.
2. **Four record columns** on `contacts`, beside the spine's five, each `ON DELETE RESTRICT` as the spine's are:
   - `prospect_id` is a lead on Prospects.
   - `supply_house_id` is a supply house's counter, or someone else named on its row. It is a company row like a customer's or a trade partner's. So its unique index is per house and name, and the counter has no name.
   - `supply_house_contact_id` is a rep, as the RFQ desk keeps them.
   - `team_prospect_id` is a candidate on the Team hiring board.
   - A sub is a `people` row whose kind is `sub`, through the spine's `person_id`.
3. **What a row may say.**
   - `contacts_one_record` counts all nine columns. An unknown number has no record, a lead has its Prospects row or none, and every other kind has exactly one.
   - The new `contacts_kind_record` pairs each new column with its kind. A Prospects row is a lead. A supply house or a rep is a supply house. A hiring board row is a candidate. A sub is someone on the roster.
4. **`name_contact`** (Who is this?) follows `nameContact` in the kernel:
   - It takes the four new tables and kinds.
   - With no record and the kind `lead`, a number becomes a lead with no record, under `p_name` or the name it had.
   - A lead is named again in two ways only. A lead with no record points at the row Add to Prospects wrote. A lead who books re-points to the customer they became, or folds into the customer's contact. Anything else is `namedAlready`.
   - A record of another kind is refused as `kindDoesNotFit`. Only a sub on the roster is a sub.
   - It is still `SECURITY INVOKER`, so the caller gains UPDATE on the four columns.
5. **Deletes keep the thread.** The spine's `contacts_keep_thread_on_delete` now also fires before a delete on `prospects`, `team_prospects`, `supply_houses` and `supply_house_contacts`, which their screens delete outright.
   - A lead stays a lead with no record, under the name Prospects gave them.
   - A candidate becomes a number nobody has named and keeps the name.
   - A supply house's counter and anyone named on it become numbers that keep the name.
   - A rep moves onto their house under their name. When the house is going too, since a rep goes with their house, the rep becomes a number that keeps the name.
6. **The seeds**, each run once here and again without adding anything. Both are the database's own; nobody signed in runs them.
   - `contacts_subs_from_roster()` keeps a roster person's contact a sub while the roster's kind is sub, and a trade partner once it is not. It gives every sub on the roster a contact with the roster's number and address.
   - `contacts_from_supply_houses()` gives each supply house's counter a contact with its number. An insurer, a rental yard and the like are left out. It gives each rep at a house a contact with the rep's address and number. The jobs side's shortlist, the rows with no house, is left out.
7. **Follow up.** `follow_up_count` leaves out supply houses and candidates, as `OFF_FOLLOW_UP` does in `queue.ts`. `contact_display_name` reads the new records.
   - `write_down` takes from every new kind the trade partner's promises: a quote, a start or papers. That is what `promiseChoices` in `messages/promises.ts` offers them, so the SQL never refuses what the screen shows (the lead's call). Whether a lead makes a customer's promises instead is a later change to both.
   - A line the caller cannot read, such as a candidate's for someone off the hiring board, is refused as *No day was heard on that line.*
8. **The candidate door** (helper 9's review, the lead's yes). The office team reads every contact under the spine's policy, but the hiring board is gated per person.
   - So `contacts`, `contact_channels` and `messages` each gain one restrictive read policy, `*_candidate_door`.
   - A candidate's contact, numbers and lines read only to a dev and to someone with `user_has_team_prospects_access()`.
   - Two helpers back the policies: `contacts_candidates_readable()` and `contacts_candidate_ids()`, both `SECURITY DEFINER`. The list of ids goes only to the office team.
   - An estimator off the board reads no candidate, and so names, ties and writes nothing of theirs.

## Checked before the push

The SQL bed `contacts-kinds` (`npm run test:pg:contacts-kinds`) runs every migration on Supabase Postgres 17. It runs this one a second time, which must change nothing, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow.

- The seeds give the roster's one sub, the house's counter and its two reps a contact, once each. The helper, the insurer, the archived rep and the shortlist row get none. Each contact carries the numbers and addresses its record holds.
- An unknown kind, a lead on a customer, two records, and each new record under another kind are refused by the checks. So are a second contact on a rep and on the counter.
- The assistant on the hiring board does several things in turn:
  - names Kevin a lead from his text, then points him at his Prospects row;
  - names the candidate and folds Ray's other phone into Ray;
  - gives Dina her own contact on the house, and folds the house's own name into the counter.
- Each refusal is asserted in words. A lead made a lead twice, moved to another row or named a supply house is refused. A record of another kind is refused, and so is a lead with no record but for the kind lead. A missing record id, nobody with that id and an unknown kind are refused too.
- The dev folds the sub's other number into the sub, and refuses a helper as a sub and a customer as a lead. When Kevin books, his lead becomes the customer with the thread whole. A second lead who books as the same customer folds into him. A lead named a trade partner is refused.
- Six people wait on us, and the badge counts two: the customer and the sub.
- The dev writes down the sub's start and the supply house's quote, and the house's payment is refused. The estimator off the board writes nothing down on the candidate's line.
- The estimator off the board reads no candidate, no candidate number and no candidate line, and ties none. The assistant on the board and the dev read them, and a superintendent reads nothing.
- The screens delete Lena's Prospects row, the candidate, a rep and the supply house, and every thread stays as section 5 says.
- The helper becomes a sub and the sub a helper. The seed changes both contacts' kind and gives the new sub the roster's number.

## Verify after the push

```sql
-- 1. The kinds and the columns.
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname IN ('contacts_kind_known', 'contacts_one_record', 'contacts_kind_record');
SELECT column_name FROM information_schema.columns
WHERE table_name = 'contacts' AND column_name IN ('prospect_id', 'supply_house_id', 'supply_house_contact_id', 'team_prospect_id');
-- 2. What the seeds made, by kind.
SELECT kind, count(*) FROM public.contacts GROUP BY kind ORDER BY kind;
-- 3. The triggers and the door.
SELECT tgrelid::regclass, tgname FROM pg_trigger WHERE tgname = 'contacts_keep_thread' ORDER BY 1;
SELECT tablename, policyname, permissive FROM pg_policies WHERE policyname LIKE '%candidate_door';
```

Then `npm run check:migration-drift`, and one types PR from a prod regen after the last R-cut migration lands (`gen:types`), so `contacts/load.ts` drops its optional columns.
