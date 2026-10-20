# 20261014040000_quick_replies_phone_tech.sql (2026-10-13, v2.5445)

Messages, residential R5: the tech reads the phone's lines (Customer communication helper 6, directed by the lead session). Job Mode's **Message the customer** lists the quick replies the office marked for the phone (`src/lib/quickReplies/phone.ts` → `phoneLines`). But `quick_replies_team` opens the table to `gc_office_team()` alone, so a tech's sheet would read nothing. This opens those lines, and only those, to the techs. Nothing reads them until the Job Mode screen ships behind its switch.

It stands on two migrations not yet on `main` when written: `20261013190000_messages_tech_door.sql` (#5590, `messages_tech_team()`) and `20261013210000_quick_replies_phone_es.sql` (#5588, `phone_order`). Push it after both.

## What it does

1. **`quick_replies_phone_tech`**, a SELECT policy on `quick_replies` for `messages_tech_team()`: primary and helpers, the field roles that message a customer from Job Mode. It reads the lines `phoneLines` keeps:
   - the team's (`scope = 'team'`), so a line kept for one person never reaches every tech's phone;
   - for customers (`for_kind = 'customer'`), never a trade partner's, an architect's or anyone's;
   - on the phone (`phone_order` set);
   - not removed.
2. The row comes with its words, its Spanish, its button name, its place and its step. The versions and the uses keep their own office-only policies.
3. Writes are unchanged. The table grants SELECT alone, and the four quick reply functions stay the office's.

No table, so no fences. A second run drops the policy and makes it again the same.

## Checked before the push

The SQL bed `quick-replies-phone-tech` (`npm run test:pg:quick-replies-phone-tech`) runs every migration on Supabase Postgres 17, then this one a second time, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow once the PR is ready. The scenario also passed on PGlite over the real `20261012190000_quick_replies.sql` and `20261013210000_quick_replies_phone_es.sql` with stubs beneath them. Two breaks on purpose each failed it: no scope check (the primary's own line showed) and no removed check (the removed line showed).

- Luis, a primary, reads the two team customer lines on the phone, in place order, with the words, the Spanish, the button name and the step. He reads no version and no line kept for one person. He writes and adds no line by hand.
- Nico, a helper, and a tech in training mode read the same two.
- A subcontractor reads none, and anon is refused.
- The office still reads every team line, on the phone or not, removed or not, and the version.
- A line taken off the phone and a removed line leave the tech's phone.

## Verify after the push

```sql
-- 1. The policy is there, for the signed in.
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'quick_replies' AND policyname = 'quick_replies_phone_tech';
-- expect: one row, SELECT, {authenticated}

-- 2. What a tech would read today: the team's customer lines on the phone.
SELECT count(*) FROM public.quick_replies WHERE scope = 'team' AND for_kind = 'customer' AND phone_order IS NOT NULL AND removed_at IS NULL;
-- expect: the count the office set on the Phone tab, 0 until it sets one
```

## Rollback

```sql
DROP POLICY IF EXISTS quick_replies_phone_tech ON public.quick_replies;
```

## Status

Written 2026-10-13 with the migration. Not pushed.
