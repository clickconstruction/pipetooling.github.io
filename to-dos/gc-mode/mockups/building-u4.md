---
name: "Building U4: submittals on real data"
rows: BUILDING_REAL_BUILD.md, The PRs in order, 4; decisions 2, 5, 6, 7, 9 and 10; Writing it (gc_add_submittal, gc_submittal_came_in, gc_send_submittal_to_architect, gc_answer_submittal, gc_trade_submittal_send); Docs each PR touches
branch: the plan on spike/building-u4-plan (from origin/spike/gc-mode at 7391482bc); U4a from origin/main once B6-a (20261009140000) is applied and its types are on main; U4b from origin/main after B6-a-ii, U3a-ii and U4a's types merge
status: plan 2026-10-08 by Helper 18 at the lead's ask. The read-back was approved the same day at all four picks. The SQL below passed its scenario on a local stand-in (50 assertions, PostgreSQL 15); the real bed runs on the PR. Nothing is cut or claimed.
---

# Building U4: submittals on real data

## What it is

The submittal register on real data: what each trade sends for the architect's approval before its work,
whose move it is, when it is needed, and each time it went around.

- **U4a, the presses** (one migration, no client code):
  - five functions and one helper on U1's three tables (`gc_submittals`, `gc_submittal_holds`,
    `gc_submittal_rounds`), with no table, column or policy changed;
  - its SQL bed scenario, `supabase/tests/gc_building/40_submittals.sql`, and its migration doc;
  - the types PR follows the lead's push.
- **U4b, the window and the email** (no migration):
  - **Submittals**, a window opened from a building job's card, ported from the prototype's
    `GcBuildingSubmittals.tsx`;
  - `gc-architect-email`, a new edge function, kind `submittal` (U5 adds `rfi`);
  - the guide *send a trade's submittal to the architect*, with `roles: dev` until Building's door.

## The four calls, as the lead picked them (2026-10-08)

1. **Two PRs**, U4a the SQL and U4b the window with the function.
2. **The window is ported**, as O3-ui ported the change orders. Every press in the prototype's tab
   dispatches its reducer, so it cannot move word for word.
3. **U4a waits for B6-a's push** and its types, and U4b for B6-a-ii, which fills `awardedInviteId` in the
   one project mapper. The trade's verb finds the company only through the award.
4. **The architect email rides in U4b**, as the plan has it.

## The functions

`SECURITY INVOKER`, every one, so RLS decides who may: dev only until Building's door. The trade's verb is
the service role's only, as the Portal's P2a verbs are.

| Function | The prototype's action | What it writes | What it refuses |
|---|---|---|---|
| `gc_submittal_move(id)` | `submittalState` | Nothing. Whose move it is, from the newest round: `trade`, `us`, `architect` or `approved` | |
| `gc_add_submittal(s jsonb)` | `addSubmittal` | The submittal, its number (`nextSubmittalNumber`) and the scope lines it holds; `asked_on` is `app_today()` | A training account, a digital twin, our own crew's trade, a trade not awarded, a blank title, a kind the register does not know, a hold on another trade's work |
| `gc_submittal_came_in(r jsonb)` | new (decision 6) | A round sent by `office`: the file's name, its Drive link and the trade's note. The last one the trade owed keeps its promise | A training account, a digital twin, any move but the trade's, a blank file name |
| `gc_send_submittal_to_architect(id, email)` | `sendSubmittalToArchitect` | The newest round's `to_architect_on`, and the email that took it there or none | A training account, a digital twin, any move but ours |
| `gc_answer_submittal(id, answer, note)` | `answerSubmittal` | The newest round's answer, its day and note. *Revise* makes it the trade's move again | A training account, a digital twin, an answer the register does not know, any move but the architect's, revise with no note |
| `gc_trade_submittal_send(company, id, file, link, note)` | `tradeSendSubmittal` | A round sent by `trade`. The last one the company owed keeps its promise | `notFound`, `notYours` (not the company awarded), `notYourMove`, `fileNeeded` |

**The promise** (decision 9). When a round comes in and no submittal on that trade is still the trade's
move, the awarded company's open promise to send them is kept: `gc_keep_promises(company, 'submittals',
job, trade, app_today())`. The office's *It came by email* keeps it too, since the trade kept its word
either way.

**The numbers.** One press at a time on a job takes a number (`pg_advisory_xact_lock` on the job, as the
quick-add presses lock). With a section, the count of that section's submittals plus one, two digits:
`03 21 00-02`. Without one, the register's whole count plus one, three digits: `003`. A number a removed
submittal left is skipped, so the table's unique key never refuses a press.

## What the window sends

- **Add a submittal**: `gc_add_submittal({ packageId, title, kind, specSection?, lineIds, leadDays, neededBy? })`.
  `lineIds` are the trade's scope line ids, which the schedule's bars carry too (its PR 5, call 6).
  `neededBy` is offered only when none of the work it holds is on the schedule.
- **It came by email**: `gc_submittal_came_in({ submittalId, file, driveUrl?, note? })`.
- **Send to {architect}**: `gc-architect-email` with `{ kind: 'submittal', submittal_id }`. After the
  email goes, the function calls `gc_send_submittal_to_architect(id, <its email_send_log id>)` under the
  caller's own JWT, so the rule of whose move it is lives in the SQL once.
- **We sent it another way**: `gc_send_submittal_to_architect(id)`.
- **The architect's answer**: `gc_answer_submittal(id, answer, note)`.
- **The trade, from its portal** (the Portal's P5): `submit-gc-trade-portal` kind `send_submittal` calls
  `gc_trade_submittal_send(company, id, file, link, note)` once it has turned the link into its company.

## The refusals, in plain words

Every sentence the SQL says to a person, through the repo's own `plainWordsFailures`
(`src/lib/plainWords.ts`). The check reads each `RAISE EXCEPTION` and each `DETAIL` out of the SQL below,
so it holds what is written: **27 sentences, 0 failing**.

| Press | Sentence |
|---|---|
| every office press | *Sign in first.* |
| add | *A training account cannot add a submittal.* · *A digital twin cannot add a submittal.* |
| add | *Which trade the submittal is for is missing.* · *No trade with that id.* |
| add | *Our own crew sends no submittals.* |
| add | *This trade is not awarded yet. Its submittals start once it is.* |
| add | *Say what the submittal covers.* · *Pick product data, shop drawings or samples.* |
| add | *A submittal holds only its own trade’s work.* |
| came in, send, answer | *A training account cannot record a submittal.* · *A digital twin cannot record a submittal.* |
| came in, send, answer | *Which submittal this is for is missing.* · *No submittal with that id.* |
| came in | *It came in already. Send it to the architect next.* · *It is with the architect. Record their answer next.* · *Name the file that came in.* |
| came in, send, answer | *It is approved already.* |
| send | *Nothing has come in from the trade to send.* · *It went to the architect already.* |
| answer | *Pick approved, approved as noted or revise.* · *Nothing is with the architect. It is the trade’s move.* · *It has not gone to the architect yet.* · *Say what to change before you send it back.* |
| the trade's verb, as DETAIL | *No submittal with that id.* (`notFound`) · *That submittal is on another company’s work.* (`notYours`) · *It came in already. It is with us or the architect now.* and *It is approved already.* (`notYourMove`) · *Name the file you are sending.* (`fileNeeded`) |

`notFound` and `notYours` are keys the portal already says. `notYourMove` and `fileNeeded` are new:
the Portal's P5 adds them to `TRADE_SQL_ERRORS` (`_shared/gcTradeSubmit.ts`, 409 and 400) and to the
page's words in both languages, with the kind.

## The SQL as it will be

`supabase/migrations/<stamp>_gc_submittal_writes.sql`. The stamp is numbered from `origin/main`'s newest
at the cut and claimed then, and `v2.NNNN` becomes the version claimed then: those two are the only
changes from this text.

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U4a (v2.NNNN): the submittal register on real data, its
-- presses. The office adds a submittal with its number and the work it holds, records a round that came
-- by email, marks it sent to the architect and records the architect's answer; the trade sends a round
-- from its portal. Each refuses in words what the prototype's reducer refuses (addSubmittal,
-- tradeSendSubmittal, sendSubmittalToArchitect, answerSubmittal). The office's presses are SECURITY
-- INVOKER, so RLS decides who may: dev only until Building's door. The trade's is the service role's
-- only. The portal's submit function calls it once it has turned a link into its company, and a refusal
-- raises a key the page says in the company's language, as the Portal's P2a verbs do. The last round a
-- trade owed keeps its promise to send them (gc_keep_promises, decision 9). Plan:
-- to-dos/gc-mode/mockups/building-u4.md on spike/gc-mode. Tables: 20261008030000_gc_building_records.
-- The award it reads: 20261009140000_gc_award_and_sow (B6-a).

-- Whose move a submittal is, from its newest round (the prototype's submittalState): the trade's while
-- nothing came in or the architect sent it back to revise, ours once it came in, the architect's while
-- it is with them, and approved once they approved it, as noted or not.
CREATE OR REPLACE FUNCTION public.gc_submittal_move(p_submittal_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN x.answer = 'revise' THEN 'trade'
      WHEN x.answer IS NOT NULL THEN 'approved'
      WHEN x.to_architect_on IS NOT NULL THEN 'architect'
      ELSE 'us'
    END
    FROM public.gc_submittal_rounds x
    WHERE x.submittal_id = p_submittal_id
    ORDER BY x.round DESC
    LIMIT 1
  ), 'trade')
$$;

-- Add a submittal to a trade's register (addSubmittal): its number from the spec section, the work it
-- holds until approved, and the days from approval to on site. Refuses a training account, a digital
-- twin, our own crew's trade, a trade not awarded, a blank title, a kind the register does not know and a
-- hold on another trade's work.
CREATE OR REPLACE FUNCTION public.gc_add_submittal(s jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pkg uuid;
  v_project uuid;
  v_ours boolean;
  v_awarded uuid;
  v_title text := btrim(coalesce(s->>'title', ''));
  v_kind text := btrim(coalesce(s->>'kind', ''));
  v_section text := nullif(btrim(coalesce(s->>'specSection', '')), '');
  v_holds uuid[];
  v_n integer;
  v_number text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot add a submittal.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot add a submittal.' USING ERRCODE = '42501';
  END IF;
  v_pkg := nullif(btrim(coalesce(s->>'packageId', '')), '')::uuid;
  IF v_pkg IS NULL THEN
    RAISE EXCEPTION 'Which trade the submittal is for is missing.' USING ERRCODE = 'P0001';
  END IF;
  SELECT k.project_id, k.ours, k.awarded_invite_id INTO v_project, v_ours, v_awarded
  FROM public.gc_trade_packages k WHERE k.id = v_pkg;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_ours THEN
    RAISE EXCEPTION 'Our own crew sends no submittals.' USING ERRCODE = 'P0001';
  END IF;
  IF v_awarded IS NULL THEN
    RAISE EXCEPTION 'This trade is not awarded yet. Its submittals start once it is.' USING ERRCODE = 'P0001';
  END IF;
  IF v_title = '' THEN
    RAISE EXCEPTION 'Say what the submittal covers.' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind NOT IN ('product data', 'shop drawings', 'samples') THEN
    RAISE EXCEPTION 'Pick product data, shop drawings or samples.' USING ERRCODE = 'P0001';
  END IF;

  -- The work it holds: this trade's scope lines, each once (decision 2).
  v_holds := ARRAY(
    SELECT DISTINCT btrim(h)::uuid
    FROM jsonb_array_elements_text(coalesce(s->'lineIds', '[]'::jsonb)) h
    WHERE btrim(h) <> ''
  );
  IF EXISTS (
    SELECT 1 FROM unnest(v_holds) h(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.gc_scope_items i WHERE i.id = h.id AND i.package_id = v_pkg)
  ) THEN
    RAISE EXCEPTION 'A submittal holds only its own trade’s work.' USING ERRCODE = 'P0001';
  END IF;

  -- Its number (nextSubmittalNumber): the spec section and a count, "26 24 16-02", or a plain count when
  -- it names no section. One press at a time on a job, so two at once never take the same number, and a
  -- number left by a removed submittal is skipped rather than taken twice.
  PERFORM pg_advisory_xact_lock(hashtextextended('gc_submittal_number:' || v_project::text, 0));
  IF v_section IS NULL THEN
    SELECT count(*) INTO v_n FROM public.gc_submittals WHERE project_id = v_project;
  ELSE
    SELECT count(*) INTO v_n FROM public.gc_submittals WHERE project_id = v_project AND spec_section = v_section;
  END IF;
  LOOP
    v_n := v_n + 1;
    v_number := CASE
      WHEN v_section IS NULL THEN lpad(v_n::text, greatest(3, length(v_n::text)), '0')
      ELSE v_section || '-' || lpad(v_n::text, greatest(2, length(v_n::text)), '0')
    END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.gc_submittals WHERE project_id = v_project AND number = v_number);
  END LOOP;

  INSERT INTO public.gc_submittals (project_id, package_id, number, title, kind, spec_section, lead_days, needed_by, asked_on)
  VALUES (
    v_project,
    v_pkg,
    v_number,
    v_title,
    v_kind,
    v_section,
    greatest(0, round(coalesce((s->>'leadDays')::numeric, 0)))::integer,
    nullif(btrim(coalesce(s->>'neededBy', '')), '')::date,
    public.app_today()
  )
  RETURNING id INTO v_id;
  INSERT INTO public.gc_submittal_holds (submittal_id, scope_item_id)
  SELECT v_id, h FROM unnest(v_holds) h;
  RETURN v_id;
END;
$$;

-- A round that came by email (decision 6): the office records the file by name with its Drive link and
-- the trade's note, while it is the trade's move. When it was the last one the trade owed, the trade's
-- promise to send them is kept.
CREATE OR REPLACE FUNCTION public.gc_submittal_came_in(r jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub uuid;
  v_project uuid;
  v_pkg uuid;
  v_file text := btrim(coalesce(r->>'file', ''));
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  v_sub := nullif(btrim(coalesce(r->>'submittalId', '')), '')::uuid;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Which submittal this is for is missing.' USING ERRCODE = 'P0001';
  END IF;
  -- Every round write takes the submittal first, so two presses at once never number the same round.
  SELECT s.project_id, s.package_id INTO v_project, v_pkg FROM public.gc_submittals s WHERE s.id = v_sub FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No submittal with that id.' USING ERRCODE = 'P0001';
  END IF;
  CASE public.gc_submittal_move(v_sub)
    WHEN 'us' THEN
      RAISE EXCEPTION 'It came in already. Send it to the architect next.' USING ERRCODE = 'P0001';
    WHEN 'architect' THEN
      RAISE EXCEPTION 'It is with the architect. Record their answer next.' USING ERRCODE = 'P0001';
    WHEN 'approved' THEN
      RAISE EXCEPTION 'It is approved already.' USING ERRCODE = 'P0001';
    ELSE
      NULL;
  END CASE;
  IF v_file = '' THEN
    RAISE EXCEPTION 'Name the file that came in.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gc_submittal_rounds (submittal_id, round, sent_on, sent_by, file_name, drive_url, note)
  VALUES (
    v_sub,
    (SELECT coalesce(max(x.round), 0) + 1 FROM public.gc_submittal_rounds x WHERE x.submittal_id = v_sub),
    public.app_today(),
    'office',
    v_file,
    nullif(btrim(coalesce(r->>'driveUrl', '')), ''),
    btrim(coalesce(r->>'note', ''))
  )
  RETURNING id INTO v_id;

  -- The last one the trade owed keeps its promise to send them (decision 9).
  IF NOT EXISTS (SELECT 1 FROM public.gc_submittals s WHERE s.package_id = v_pkg AND public.gc_submittal_move(s.id) = 'trade') THEN
    PERFORM public.gc_keep_promises(i.company_id, 'submittals', v_project, v_pkg, public.app_today())
    FROM public.gc_trade_packages k JOIN public.gc_invites i ON i.id = k.awarded_invite_id
    WHERE k.id = v_pkg;
  END IF;
  RETURN v_id;
END;
$$;

-- Sent to the architect (sendSubmittalToArchitect): the newest round's day it went, and the email that took
-- it there when gc-architect-email sent it. No email: we sent it another way. Only while it is ours.
CREATE OR REPLACE FUNCTION public.gc_send_submittal_to_architect(p_submittal_id uuid, p_email_send_log_id uuid DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.gc_submittals s WHERE s.id = p_submittal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No submittal with that id.' USING ERRCODE = 'P0001';
  END IF;
  CASE public.gc_submittal_move(p_submittal_id)
    WHEN 'trade' THEN
      RAISE EXCEPTION 'Nothing has come in from the trade to send.' USING ERRCODE = 'P0001';
    WHEN 'architect' THEN
      RAISE EXCEPTION 'It went to the architect already.' USING ERRCODE = 'P0001';
    WHEN 'approved' THEN
      RAISE EXCEPTION 'It is approved already.' USING ERRCODE = 'P0001';
    ELSE
      NULL;
  END CASE;

  UPDATE public.gc_submittal_rounds x
  SET to_architect_on = v_today, email_send_log_id = p_email_send_log_id
  WHERE x.submittal_id = p_submittal_id
    AND x.round = (SELECT max(y.round) FROM public.gc_submittal_rounds y WHERE y.submittal_id = p_submittal_id);
  RETURN v_today;
END;
$$;

-- The architect's answer on the newest round (answerSubmittal): approved, approved as noted, or revise with
-- what to change, which makes it the trade's move again. Only while it is with the architect.
CREATE OR REPLACE FUNCTION public.gc_answer_submittal(p_submittal_id uuid, p_answer text, p_note text DEFAULT '')
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
  v_answer text := btrim(coalesce(p_answer, ''));
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.gc_submittals s WHERE s.id = p_submittal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No submittal with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_answer NOT IN ('approved', 'approved as noted', 'revise') THEN
    RAISE EXCEPTION 'Pick approved, approved as noted or revise.' USING ERRCODE = 'P0001';
  END IF;
  CASE public.gc_submittal_move(p_submittal_id)
    WHEN 'trade' THEN
      RAISE EXCEPTION 'Nothing is with the architect. It is the trade’s move.' USING ERRCODE = 'P0001';
    WHEN 'us' THEN
      RAISE EXCEPTION 'It has not gone to the architect yet.' USING ERRCODE = 'P0001';
    WHEN 'approved' THEN
      RAISE EXCEPTION 'It is approved already.' USING ERRCODE = 'P0001';
    ELSE
      NULL;
  END CASE;
  IF v_answer = 'revise' AND v_note = '' THEN
    RAISE EXCEPTION 'Say what to change before you send it back.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gc_submittal_rounds x
  SET answered_on = v_today, answer = v_answer, answer_note = v_note
  WHERE x.submittal_id = p_submittal_id
    AND x.round = (SELECT max(y.round) FROM public.gc_submittal_rounds y WHERE y.submittal_id = p_submittal_id);
  RETURN v_today;
END;
$$;

-- A round from the trade's portal (tradeSendSubmittal), the first time or after a revise: the file by name,
-- its Drive link once the portal uploads it (P5), and a note. Only the company the trade is awarded to, and
-- only while it is the trade's move. The last one it owed keeps its promise to send them.
CREATE OR REPLACE FUNCTION public.gc_trade_submittal_send(p_company_id uuid, p_submittal_id uuid, p_file_name text, p_drive_url text DEFAULT NULL, p_note text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_pkg uuid;
  v_company uuid;
  v_file text := btrim(coalesce(p_file_name, ''));
  v_id uuid;
BEGIN
  SELECT s.project_id, s.package_id INTO v_project, v_pkg FROM public.gc_submittals s WHERE s.id = p_submittal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No submittal with that id.';
  END IF;
  SELECT i.company_id INTO v_company
  FROM public.gc_trade_packages k JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = v_pkg;
  IF v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That submittal is on another company’s work.';
  END IF;
  CASE public.gc_submittal_move(p_submittal_id)
    WHEN 'trade' THEN
      NULL;
    WHEN 'approved' THEN
      RAISE EXCEPTION 'notYourMove' USING ERRCODE = 'P0001', DETAIL = 'It is approved already.';
    ELSE
      RAISE EXCEPTION 'notYourMove' USING ERRCODE = 'P0001', DETAIL = 'It came in already. It is with us or the architect now.';
  END CASE;
  IF v_file = '' THEN
    RAISE EXCEPTION 'fileNeeded' USING ERRCODE = 'P0001', DETAIL = 'Name the file you are sending.';
  END IF;

  INSERT INTO public.gc_submittal_rounds (submittal_id, round, sent_on, sent_by, file_name, drive_url, note)
  VALUES (
    p_submittal_id,
    (SELECT coalesce(max(x.round), 0) + 1 FROM public.gc_submittal_rounds x WHERE x.submittal_id = p_submittal_id),
    public.app_today(),
    'trade',
    v_file,
    nullif(btrim(coalesce(p_drive_url, '')), ''),
    btrim(coalesce(p_note, ''))
  )
  RETURNING id INTO v_id;

  IF NOT EXISTS (SELECT 1 FROM public.gc_submittals s WHERE s.package_id = v_pkg AND public.gc_submittal_move(s.id) = 'trade') THEN
    PERFORM public.gc_keep_promises(p_company_id, 'submittals', v_project, v_pkg, public.app_today());
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_submittal_move(uuid) IS
  'GC mode (v2.NNNN): whose move a submittal is, from its newest round (submittalState): trade, us, architect or approved. A submittal with no round is the trade''s.';
COMMENT ON FUNCTION public.gc_add_submittal(jsonb) IS
  'GC mode (v2.NNNN): add a submittal to an awarded trade''s register (addSubmittal), numbered by its spec section (nextSubmittalNumber), with the scope lines it holds. Refuses a training account, a digital twin, our own crew''s trade, a trade not awarded, a blank title, an unknown kind and another trade''s line. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_submittal_came_in(jsonb) IS
  'GC mode (v2.NNNN): the office records a round that came by email, with the file''s name and Drive link, while it is the trade''s move; the last one owed keeps the trade''s promise. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_send_submittal_to_architect(uuid, uuid) IS
  'GC mode (v2.NNNN): the newest round went to the architect today, with the email that took it (gc-architect-email) or none when sent another way. Only while it is ours. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_answer_submittal(uuid, text, text) IS
  'GC mode (v2.NNNN): the architect''s answer on the newest round (answerSubmittal): approved, approved as noted, or revise with a note, which makes it the trade''s move again. Only while it is with the architect. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_trade_submittal_send(uuid, uuid, text, text, text) IS
  'GC mode (v2.NNNN): a round from the trade''s portal (tradeSendSubmittal) by the company the trade is awarded to, while it is the trade''s move: notFound, notYours, notYourMove, fileNeeded. The last one owed keeps its promise. Service role only.';

REVOKE ALL ON FUNCTION public.gc_submittal_move(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_submittal_move(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_submittal_move(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gc_add_submittal(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_add_submittal(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_add_submittal(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_submittal_came_in(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_submittal_came_in(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_submittal_came_in(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_send_submittal_to_architect(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_send_submittal_to_architect(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_send_submittal_to_architect(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_answer_submittal(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_answer_submittal(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_answer_submittal(uuid, text, text) TO authenticated;

-- Only the service role: the portal's submit function, after it has turned a link into its company.
REVOKE ALL ON FUNCTION public.gc_trade_submittal_send(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_submittal_send(uuid, uuid, text, text, text) TO service_role;
```

## The SQL tests

**The bed.** `scripts/pgtest-gc-building.sh` runs one scenario today, #5003's. Whichever of U3b and U4a
adds the second scenario makes it run every one (agreed with Helper 14): it re-applies each press in a
`PRESSES` list, then plays every file in `supabase/tests/gc_building/` in its own rolled-back
transaction, each ending `gc_building PASSED`. The scenarios are numbered 20 the daily log, 30 the punch
list, 40 submittals, 50 RFIs. As U4a will leave it, if U3b has not come first:

```bash
#!/usr/bin/env bash
# Runs supabase/tests/gc_building against a throwaway copy of the WHOLE schema (v2.4957, the Building
# lane's U3a-i; every Building press since).
#
#   npm run test:pg:gc-building
#
# The same bed as scripts/pgtest-gc-schedule.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). Building's presses (PRESSES below) are then
# applied a second time, which must change nothing. Each file in supabase/tests/gc_building plays one
# press's scenario through RLS as a dev, a trainee, a twin and a role outside Building's dev door, inside
# one transaction that rolls back. Each raises on its first failed assertion and ends with
# "gc_building PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; .github/workflows/sql-beds.yml
# runs it on a PR that touches Building's SQL. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55444}"
NAME="pgtest-gc-building"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# Building's presses, each applied a second time below. A new press adds its file here, its scenario
# under supabase/tests/gc_building and its pattern to sql-beds.yml's paths.
PRESSES=(
  supabase/migrations/*_gc_save_daily_log.sql
  supabase/migrations/*_gc_submittal_writes.sql
)

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
# The registry rate-limits a burst of pulls (every bed in sql-beds.yml pulls this image at once), so a
# refused pull waits and tries again before the bed gives up.
for i in 1 2 3 4 5; do docker pull -q "$IMAGE" >/dev/null 2>&1 && break; [ "$i" = 5 ] && { echo "could not pull $IMAGE"; exit 1; }; sleep $((i * 15)); done
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
[ -n "${PGTEST_KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
# A second run must change nothing: each press's functions are replaced as they were.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
for scenario in supabase/tests/gc_building/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "gc_building PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "gc-building bed ok"
```

**`.github/workflows/sql-beds.yml`**: one path beside the daily log's, `- 'supabase/migrations/*gc_submittal_writes*'`,
the header's list naming Building's presses, and the job's step renamed *Building's presses against every
migration*.

**The scenario**, `supabase/tests/gc_building/40_submittals.sql`:

```sql
-- The submittal register's presses (v2.NNNN, the Building lane's U4a): gc_add_submittal numbers a
-- submittal by its spec section and keeps the work it holds; gc_submittal_came_in, gc_send_submittal_to_architect
-- and gc_answer_submittal walk its rounds; gc_trade_submittal_send is the trade's round from its portal. Each
-- refuses in words what the prototype's reducer refuses, and the last round a trade owed keeps its promise.
-- A training account, a digital twin and a role outside Building's dev door are refused; the trade's verb is
-- the service role's only. Presses run through RLS, the fixture made as postgres; everything runs inside one
-- transaction that rolls back. Raises on the first failed assertion; ends with "gc_building PASSED". See
-- scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, and an estimator (no policy on
-- Building's tables while they are built).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@submittals.test'),
  ('00000000-0000-0000-0000-0000000007d2', 'trainee@submittals.test'),
  ('00000000-0000-0000-0000-0000000007d3', 'twin@submittals.test'),
  ('00000000-0000-0000-0000-0000000007d4', 'estimator@submittals.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@submittals.test', 'Submittals Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000007d2', 'trainee@submittals.test', 'Submittals Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000007d3', 'twin@submittals.test', 'Submittals Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000007d4', 'estimator@submittals.test', 'Submittals Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000007d2';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000007d3';

-- One GC job being built: Concrete awarded to Ridgeway Concrete, Steel still asked of Halverson Steel and
-- not awarded, and our own Plumbing. Concrete holds two scope lines, Steel one.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000007c1', 'Submittals Test Owner', '00000000-0000-0000-0000-0000000007d1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000007a1', 'Submittals test A', '00000000-0000-0000-0000-0000000007c1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES ('00000000-0000-0000-0000-0000000007a1', 'building', public.app_today() - 3);
INSERT INTO public.gc_companies (id, name) VALUES
  ('00000000-0000-0000-0000-0000000007e1', 'Ridgeway Concrete'),
  ('00000000-0000-0000-0000-0000000007e2', 'Halverson Steel');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007a1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007a1', 'Steel', 1, false),
  ('00000000-0000-0000-0000-0000000007b3', '00000000-0000-0000-0000-0000000007a1', 'Plumbing', 2, true);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000007f1', '00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007e1'),
  ('00000000-0000-0000-0000-0000000007f2', '00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007e2');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000007f1', awarded_on = public.app_today() - 10
WHERE id = '00000000-0000-0000-0000-0000000007b1';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-000000070001', '00000000-0000-0000-0000-0000000007b1', 'Footings', 0),
  ('00000000-0000-0000-0000-000000070002', '00000000-0000-0000-0000-0000000007b1', 'Slab', 1),
  ('00000000-0000-0000-0000-000000070003', '00000000-0000-0000-0000-0000000007b2', 'Frame', 0);
-- Ridgeway gave a day to send its submittals.
INSERT INTO public.gc_trade_promises (company_id, kind, project_id, package_id, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-0000000007e1', 'submittals', '00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-0000000007b1', 'the concrete submittals', public.app_today() + 7, 'office');
-- The email gc-architect-email logs for a send.
INSERT INTO public.email_send_log (id) VALUES ('00000000-0000-0000-0000-0000000007ee');

CREATE SCHEMA gbt;
CREATE FUNCTION gbt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gbt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A trade's refusal: its key, and the reason in plain words the key carries.
CREATE FUNCTION gbt.trade_refused(label text, stmt text, want_key text, want_detail text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF SQLERRM IS DISTINCT FROM want_key OR v_detail IS DISTINCT FROM want_detail THEN
      RAISE EXCEPTION '% was refused as % (%), not % (%)', label, SQLERRM, v_detail, want_key, want_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
END $$;
-- A submittal on job A by its number.
CREATE FUNCTION gbt.sub(p_number text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_submittals WHERE project_id = '00000000-0000-0000-0000-0000000007a1' AND number = p_number $$;
-- A submittal as the window sends it, for Concrete unless `extra` says otherwise.
CREATE FUNCTION gbt.add(title text, extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000007b1', 'title', title, 'kind', 'product data', 'lineIds', '[]'::jsonb, 'leadDays', 0) || extra $$;
-- What job A's register reads: each submittal's number, whose move, the work it holds and its rounds.
CREATE FUNCTION gbt.register() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(
    s.number || ' ' || public.gc_submittal_move(s.id)
      || ' holds ' || coalesce((SELECT string_agg(i.label, ',' ORDER BY i.position) FROM public.gc_submittal_holds h JOIN public.gc_scope_items i ON i.id = h.scope_item_id WHERE h.submittal_id = s.id), '-')
      || ' rounds ' || coalesce((SELECT string_agg(r.round || ':' || r.sent_by || ':' || r.file_name || CASE WHEN r.to_architect_on IS NOT NULL THEN ':sent' ELSE '' END || coalesce(':' || r.answer, ''), ',' ORDER BY r.round) FROM public.gc_submittal_rounds r WHERE r.submittal_id = s.id), '-'),
    E'\n' ORDER BY s.number)
  FROM public.gc_submittals s WHERE s.project_id = '00000000-0000-0000-0000-0000000007a1' $$;
-- Ridgeway's promise to send its submittals: open, or kept on a day counted from today.
CREATE FUNCTION gbt.promise() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce('kept ' || (kept_on - public.app_today()), 'open') FROM public.gc_trade_promises
  WHERE company_id = '00000000-0000-0000-0000-0000000007e1' AND kind = 'submittals' $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions themselves: invoker's rights; the office's presses for signed-in callers, the trade's for the
-- service role only.
SELECT gbt.same('every press runs with the caller''s rights',
  (SELECT string_agg(proname || ':' || prosecdef, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('gc_submittal_move', 'gc_add_submittal', 'gc_submittal_came_in', 'gc_send_submittal_to_architect', 'gc_answer_submittal', 'gc_trade_submittal_send')),
  'gc_add_submittal:false,gc_answer_submittal:false,gc_send_submittal_to_architect:false,gc_submittal_came_in:false,gc_submittal_move:false,gc_trade_submittal_send:false');
SELECT gbt.same('a signed-out caller runs none of them',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE'), ',') FROM unnest(ARRAY['public.gc_add_submittal(jsonb)', 'public.gc_submittal_came_in(jsonb)', 'public.gc_send_submittal_to_architect(uuid, uuid)', 'public.gc_answer_submittal(uuid, text, text)', 'public.gc_trade_submittal_send(uuid, uuid, text, text, text)']) f),
  'public.gc_add_submittal(jsonb):false,public.gc_submittal_came_in(jsonb):false,public.gc_send_submittal_to_architect(uuid, uuid):false,public.gc_answer_submittal(uuid, text, text):false,public.gc_trade_submittal_send(uuid, uuid, text, text, text):false');
SELECT gbt.same('a signed-in caller runs the office''s presses, not the trade''s',
  (SELECT string_agg(f || ':' || has_function_privilege('authenticated', f, 'EXECUTE'), ',') FROM unnest(ARRAY['public.gc_add_submittal(jsonb)', 'public.gc_submittal_came_in(jsonb)', 'public.gc_send_submittal_to_architect(uuid, uuid)', 'public.gc_answer_submittal(uuid, text, text)', 'public.gc_trade_submittal_send(uuid, uuid, text, text, text)']) f),
  'public.gc_add_submittal(jsonb):true,public.gc_submittal_came_in(jsonb):true,public.gc_send_submittal_to_architect(uuid, uuid):true,public.gc_answer_submittal(uuid, text, text):true,public.gc_trade_submittal_send(uuid, uuid, text, text, text):false');
SELECT gbt.same('the service role runs the trade''s', has_function_privilege('service_role', 'public.gc_trade_submittal_send(uuid, uuid, text, text, text)', 'EXECUTE')::text, 'true');

SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;

-- Three on Concrete: two numbered by their spec section, one plainly by the register's count.
SELECT public.gc_add_submittal(gbt.add('Rebar shop drawings', jsonb_build_object('kind', 'shop drawings', 'specSection', ' 03 21 00 ', 'leadDays', 10.4,
  'lineIds', jsonb_build_array('00000000-0000-0000-0000-000000070002', '00000000-0000-0000-0000-000000070001', '00000000-0000-0000-0000-000000070002'))));
SELECT public.gc_add_submittal(gbt.add('Rebar mill certificates', jsonb_build_object('specSection', '03 21 00')));
SELECT public.gc_add_submittal(gbt.add('Concrete mix design', jsonb_build_object('lineIds', jsonb_build_array('00000000-0000-0000-0000-000000070002'), 'leadDays', -4,
  'neededBy', to_char(public.app_today() + 20, 'YYYY-MM-DD'))));
SELECT gbt.same('the register numbers by section, then plainly, each the trade''s move', gbt.register(),
  E'003 trade holds Slab rounds -\n03 21 00-01 trade holds Footings,Slab rounds -\n03 21 00-02 trade holds - rounds -');
SELECT gbt.same('what a new submittal keeps', (SELECT string_agg(number || ' ' || kind || ' lead ' || lead_days || ' needed ' || coalesce((needed_by - public.app_today())::text, '-') || ' asked ' || (asked_on - public.app_today()) || ' by ' || (created_by = '00000000-0000-0000-0000-0000000007d1'), E'\n' ORDER BY number) FROM public.gc_submittals),
  E'003 product data lead 0 needed 20 asked 0 by true\n03 21 00-01 shop drawings lead 10 needed - asked 0 by true\n03 21 00-02 product data lead 0 needed - asked 0 by true');

-- The refusals of a new submittal, in words.
SELECT gbt.refused('our own crew''s trade', $s$SELECT public.gc_add_submittal(gbt.add('Water heaters', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000007b3')))$s$, 'Our own crew sends no submittals');
SELECT gbt.refused('a trade not awarded', $s$SELECT public.gc_add_submittal(gbt.add('Steel shop drawings', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000007b2')))$s$, 'This trade is not awarded yet');
SELECT gbt.refused('a blank title', $s$SELECT public.gc_add_submittal(gbt.add('   '))$s$, 'Say what the submittal covers');
SELECT gbt.refused('a kind the register does not know', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs', jsonb_build_object('kind', 'brochure')))$s$, 'Pick product data, shop drawings or samples');
SELECT gbt.refused('a hold on another trade''s work', $s$SELECT public.gc_add_submittal(gbt.add('Anchor bolts', jsonb_build_object('lineIds', jsonb_build_array('00000000-0000-0000-0000-000000070003'))))$s$, 'holds only its own trade');
SELECT gbt.refused('no trade named', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs', jsonb_build_object('packageId', '')))$s$, 'Which trade the submittal is for is missing');
SELECT gbt.refused('a trade that does not exist', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000007ff')))$s$, 'No trade with that id');

-- One submittal's rounds, as the office walks them: nothing to send or answer before it comes in.
SELECT gbt.refused('send before anything came in', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01'))$s$, 'Nothing has come in from the trade to send');
SELECT gbt.refused('an answer before anything came in', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'approved')$s$, 'Nothing is with the architect');
SELECT gbt.refused('a round with no file', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', ' '))$s$, 'Name the file that came in');
SELECT gbt.refused('no submittal named', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('file', 'rebar.pdf'))$s$, 'Which submittal this is for is missing');
SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', ' rebar-shop-r1.pdf ', 'driveUrl', 'https://drive.google.com/file/d/r1', 'note', 'Laps per S-201.'));
SELECT gbt.same('the round that came by email', (SELECT round || ' ' || sent_by || ' ' || file_name || ' ' || drive_url || ' ' || note || ' ' || (sent_on - public.app_today()) || ' ' || (recorded_by = '00000000-0000-0000-0000-0000000007d1') FROM public.gc_submittal_rounds WHERE submittal_id = gbt.sub('03 21 00-01')),
  '1 office rebar-shop-r1.pdf https://drive.google.com/file/d/r1 Laps per S-201. 0 true');
SELECT gbt.same('two still owed: the promise stays open', gbt.promise(), 'open');
SELECT gbt.refused('a second round while it is ours', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', 'rebar.pdf'))$s$, 'It came in already. Send it to the architect next');
SELECT gbt.refused('an answer before it went to the architect', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'approved')$s$, 'It has not gone to the architect yet');
SELECT gbt.same('sent another way, today', (public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01')) - public.app_today())::text, '0');
SELECT gbt.refused('sent twice', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01'))$s$, 'It went to the architect already');
SELECT gbt.refused('a round while it is with the architect', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', 'rebar.pdf'))$s$, 'It is with the architect. Record their answer next');
SELECT gbt.refused('an answer the register does not know', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'maybe')$s$, 'Pick approved, approved as noted or revise');
SELECT gbt.refused('revise with nothing to change', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'revise', '  ')$s$, 'Say what to change before you send it back');
SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'revise', ' Show the lap splices. ');
SELECT gbt.same('revise makes it the trade''s move again', public.gc_submittal_move(gbt.sub('03 21 00-01')), 'trade');
SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', 'rebar-shop-r2.pdf'));
SELECT public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01'), '00000000-0000-0000-0000-0000000007ee');
SELECT gbt.same('the email that took round 2 is kept on it', (SELECT string_agg(round || ':' || coalesce(email_send_log_id::text, '-') || ':' || answer_note, ',' ORDER BY round) FROM public.gc_submittal_rounds WHERE submittal_id = gbt.sub('03 21 00-01')),
  '1:-:Show the lap splices.,2:00000000-0000-0000-0000-0000000007ee:');
SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'approved as noted', 'Field verify the dowels.');
SELECT gbt.refused('a round once approved', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', 'rebar.pdf'))$s$, 'It is approved already');
SELECT gbt.refused('a send once approved', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01'))$s$, 'It is approved already');
SELECT gbt.refused('an answer once approved', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'revise', 'Again.')$s$, 'It is approved already');
SELECT gbt.refused('a submittal that does not exist', $s$SELECT public.gc_answer_submittal('00000000-0000-0000-0000-0000000007ff', 'approved')$s$, 'No submittal with that id');

-- The trade's round from its portal, as the service role, after the submit function turned the link into
-- its company. A refusal is a key and its reason.
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a submittal that does not exist', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007ff', 'certs.pdf')$s$, 'notFound', 'No submittal with that id.');
SELECT gbt.trade_refused('another company', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e2', gbt.sub('03 21 00-02'), 'certs.pdf')$s$, 'notYours', 'That submittal is on another company’s work.');
SELECT gbt.trade_refused('no file', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('03 21 00-02'), '  ')$s$, 'fileNeeded', 'Name the file you are sending.');
SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('03 21 00-02'), 'certs.pdf', 'https://drive.google.com/file/d/certs', 'Mill certs, heat 4471.');
SELECT gbt.trade_refused('a second round while it is ours', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('03 21 00-02'), 'certs.pdf')$s$, 'notYourMove', 'It came in already. It is with us or the architect now.');
SELECT gbt.trade_refused('a round once approved', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('03 21 00-01'), 'rebar.pdf')$s$, 'notYourMove', 'It is approved already.');
SELECT gbt.same('one still owed: the promise stays open', gbt.promise(), 'open');
SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('003'), 'mix.pdf');
SELECT gbt.same('the last one owed keeps the promise today', gbt.promise(), 'kept 0');
SELECT gbt.same('the register after the rounds', gbt.register(),
  E'003 us holds Slab rounds 1:trade:mix.pdf\n03 21 00-01 approved holds Footings,Slab rounds 1:office:rebar-shop-r1.pdf:sent:revise,2:office:rebar-shop-r2.pdf:sent:approved as noted\n03 21 00-02 us holds - rounds 1:trade:certs.pdf');

-- Who may not.
RESET ROLE;
SELECT gbt.as_user(NULL);
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a caller signed out', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs'))$s$, 'Sign in first');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d2');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account adds', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs'))$s$, 'A training account cannot add a submittal');
SELECT gbt.refused('a training account records', $s$SELECT public.gc_answer_submittal(gbt.sub('003'), 'approved')$s$, 'A training account cannot record a submittal');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d3');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin adds', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs'))$s$, 'A digital twin cannot add a submittal');
SELECT gbt.refused('a digital twin records', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('003'))$s$, 'A digital twin cannot record a submittal');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d4');
SET LOCAL ROLE authenticated;
-- An estimator reads the job but neither adds nor sees a submittal: Building's tables let only a dev in.
SELECT gbt.refused('an estimator adds, outside Building''s dev door', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs'))$s$, 'row-level security');
SELECT gbt.refused('an estimator records, outside the door', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('003'))$s$, 'No submittal with that id');
SELECT gbt.refused('a signed-in caller cannot be the trade', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('003'), 'mix.pdf')$s$, 'permission denied');
RESET ROLE;

-- A number a removed submittal left is skipped, never taken twice.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_add_submittal(gbt.add('Curing compound', jsonb_build_object('specSection', '03 39 00')));
SELECT public.gc_add_submittal(gbt.add('Sealer', jsonb_build_object('specSection', '03 39 00')));
RESET ROLE;
DELETE FROM public.gc_submittals WHERE id = gbt.sub('03 39 00-01');
SET LOCAL ROLE authenticated;
SELECT public.gc_add_submittal(gbt.add('Joint filler', jsonb_build_object('specSection', '03 39 00')));
RESET ROLE;
SELECT gbt.same('the section''s count skips the number still taken', (SELECT string_agg(number || ' ' || title, ',' ORDER BY number) FROM public.gc_submittals WHERE spec_section = '03 39 00'),
  '03 39 00-02 Sealer,03 39 00-03 Joint filler');
SELECT gbt.same('nobody but the dev and the trade wrote a round', gbt.register(),
  E'003 us holds Slab rounds 1:trade:mix.pdf\n03 21 00-01 approved holds Footings,Slab rounds 1:office:rebar-shop-r1.pdf:sent:revise,2:office:rebar-shop-r2.pdf:sent:approved as noted\n03 21 00-02 us holds - rounds 1:trade:certs.pdf\n03 39 00-02 trade holds - rounds -\n03 39 00-03 trade holds - rounds -');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
```

**Run here first.** No session on this Mac reaches Docker. So the scenario ran against PostgreSQL 15 on a
stand-in schema: U1's three tables and B6-a's award columns spliced in verbatim, and the rest minimal
(`auth.uid()`, `is_dev`, `is_read_only`, `is_digital_twin`, `app_today`, and `gc_keep_promises` as main has
it). The migration applied twice, and all 50 assertions passed. Two planted bugs each failed it: *revise*
left as our move, and our own crew let through. The real bed runs on the PR, against every migration.

## The migration doc as it will be

````markdown
# <stamp>_gc_submittal_writes.sql (2026-10-09, v2.NNNN)

GC mode, the real build, the Building lane's U4a: the submittal register's presses (`to-dos/gc-mode/mockups/building-u4.md` on branch `spike/gc-mode`). Six functions, no table. The tables are `20261008030000_gc_building_records`; the award they read is `20261009140000_gc_award_and_sow` (the Board's B6-a).

- **`gc_submittal_move(p_submittal_id uuid)`** returns whose move a submittal is, from its newest round, as the prototype's `submittalState` reads it: `trade`, `us`, `architect` or `approved`. A submittal with no round is the trade's. The five below read it.
- **`gc_add_submittal(s jsonb)`** returns the new submittal's id. It takes the prototype's `addSubmittal` shape: `packageId`, `title`, `kind`, `specSection`, `lineIds` (the trade's scope lines it holds), `leadDays` and `neededBy`. It numbers the submittal by its spec section, `03 21 00-02`, or plainly by the register's count, `003`, as `nextSubmittalNumber` does. One press at a time on a job takes a number, and a number a removed submittal left is skipped rather than taken twice.
- **`gc_submittal_came_in(r jsonb)`** returns the round's id: a round that came by email, `submittalId`, `file`, `driveUrl` and `note`, recorded by the office while it is the trade's move (decision 6).
- **`gc_send_submittal_to_architect(p_submittal_id uuid, p_email_send_log_id uuid DEFAULT NULL)`** returns the day: the newest round went to the architect today. `gc-architect-email` (U4b) passes the email it sent; no email means we sent it another way. Only while it is ours.
- **`gc_answer_submittal(p_submittal_id uuid, p_answer text, p_note text DEFAULT '')`** returns the day: approved, approved as noted, or revise with what to change, which makes it the trade's move again. Only while it is with the architect.
- **`gc_trade_submittal_send(p_company_id uuid, p_submittal_id uuid, p_file_name text, p_drive_url text DEFAULT NULL, p_note text DEFAULT '')`** returns the round's id: the trade's round from its portal, for the company the trade is awarded to, while it is the trade's move. It refuses with keys, as the Portal's P2a verbs do: `notFound`, `notYours`, `notYourMove` and `fileNeeded`, each with its reason as the DETAIL. The Portal's P5 adds the kind to `submit-gc-trade-portal` and the words for the two new keys.
- **They refuse**, in words: a training account and a digital twin; our own crew's trade; a trade not awarded; a blank title; a kind the register does not know; a hold on another trade's work; a round, a send or an answer out of turn; and revise with nothing to change.
- **The last submittal a trade owed keeps its promise to send them**: `gc_keep_promises(company, 'submittals', job, trade, today)`, whether the trade sent it or the office recorded it (decision 9).

`SECURITY INVOKER`, every one: the tables' dev policies decide who may. The office's presses and `gc_submittal_move` are revoked from `PUBLIC` and `anon` and granted to `authenticated`; `gc_submittal_move` and the trade's verb are granted to `service_role`, and the trade's verb to nobody else.

Apply order: after `20261009140000` (the award column `gc_trade_packages.awarded_invite_id`) and `20261008030000`. It is `CREATE OR REPLACE`, idempotent, and locks no table.

**Before the push**, the SQL bed (`scripts/pgtest-gc-building.sh`, `npm run test:pg:gc-building`; GitHub's runners run it from `.github/workflows/sql-beds.yml` on this PR, since no session here reaches Docker) applies every migration to the Supabase Postgres image, applies Building's presses a second time, and plays `supabase/tests/gc_building/40_submittals.sql` in one transaction that rolls back. It adds three submittals and walks one through a revise, as a dev, and sends two rounds as the trade's company through the service role. It refuses each case above in its words, keeps the trade's promise on the last round it owed, and skips a number a removed submittal left. A trainee and a twin are refused by name, an estimator by RLS, and a signed-in caller cannot run the trade's verb. It ends `gc_building PASSED`.

## Verify after the push

1. **The six functions are there, with invoker's rights, and only the right callers run them.**

   ```sql
   SELECT p.proname, p.prosecdef AS definer,
     has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can,
     has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can,
     has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('gc_submittal_move', 'gc_add_submittal', 'gc_submittal_came_in', 'gc_send_submittal_to_architect', 'gc_answer_submittal', 'gc_trade_submittal_send')
   ORDER BY p.proname;
   ```

   Expect six rows, every `definer` false and every `anon_can` false. `signed_in_can` is true on all but `gc_trade_submittal_send`. `service_can` is true on `gc_submittal_move` and `gc_trade_submittal_send`.

2. **Its refusals before any row, as a dev**, through the page's `supabase` client:
   - a trade id that matches nothing: *No trade with that id.*
   - Plumbing on "GC test project, delete me" (`ef8905d1-039a-4cbc-9d69-9468cfea50e0`, our own crew): *Our own crew sends no submittals.*
   - a trade on that job with no award: *This trade is not awarded yet. Its submittals start once it is.*

3. **One submittal on "GC test project, delete me"**, on the trade B6-a's verify awarded:
   - Add it with a spec section and one of the trade's scope lines. It reads back numbered `<section>-01`, holding that line, the trade's move.
   - Record a round that came by email, with a file name and a Drive link. It is ours now.
   - Mark it sent another way: `gc_send_submittal_to_architect(<id>)` with no email. The email itself is U4b's, on Grace's yes.
   - Record *revise* with a note. It is the trade's move again, and a second round can come in.
   - The rows stay with the test project's others for the owner's call 4, and their ids go to the lead's list.

4. **A training account's call is refused in words.** As the training-mode user (`20261008030000`'s step 3 shows how), `gc_add_submittal` gives *A training account cannot add a submittal.* (`42501`), before any row is written.

5. **The trade's verb is the service role's only.** As a dev, `gc_trade_submittal_send` gives *permission denied for function gc_trade_submittal_send*.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_trade_submittal_send(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.gc_answer_submittal(uuid, text, text);
DROP FUNCTION IF EXISTS public.gc_send_submittal_to_architect(uuid, uuid);
DROP FUNCTION IF EXISTS public.gc_submittal_came_in(jsonb);
DROP FUNCTION IF EXISTS public.gc_add_submittal(jsonb);
DROP FUNCTION IF EXISTS public.gc_submittal_move(uuid);
```

No screen calls them until U4b, so nothing else changes.

## Status

Written for the Building lane's U4a; not applied. The lead pushes it after the merge and records here what steps 1 to 5 said.
````

## U4b: the window, the mapper, the io and the email

**The window**, `src/components/gc/GcSubmittalsWindow.tsx`, ported from the prototype's
`GcBuildingSubmittalsTab`, `TradeSubmittals`, `SubmittalLine` and `AddSubmittal`:
- It opens from a **Submittals** button on a building job's card, at `?submittals=<projectId>`, as
  **Change orders** opens. Its gate is U3a-ii's `canUseGcBuilding(role) && p.stage === 'building'`
  (`access.ts`, `GC_BUILDING_TEAM = ['dev']`), so Building's door changes one line for both windows.
- The counts strip: waiting on trades, on us, with the architect, approved, and late.
- One card per awarded trade, in the prototype's words. A job with none reads *No trade is awarded yet.
  Submittals start once one is.*
- **Add a submittal**: what it covers, the kind, the spec section, the work it holds from
  `scheduleLinesOf(pkg)`, and the days from approval to on site. The section field suggests the trade's own
  scope lines' sections (`gc_scope_items.specs`).
- Each submittal's rounds, and one press by whose move it is:
  - the trade's: **It came by email**, with the file's name, its Drive link and a note. `gc-drive-access`
    `check` reads the link, and a link only some can open warns that the architect may not open it. The
    warning never stops the press, as with a plan set's link (decision 6);
  - ours: **Send to {architect}** (the email), or **We sent it another way**;
  - the architect's: **Approved**, **Approved as noted**, or **Revise and resubmit**, which needs what to
    change.
- Props in main's pattern: `writes={{ onAdd, onCameIn, onSendToArchitect, onMarkSent, onAnswer }}`, with
  `busy` and `problem`. The overlay is `GcChangeOrdersWindow`'s, copied, since main has no shared shell.
- Left on the spike: the trade's half (`GcBuildingSubmittalsForTrade`, the Portal's P5), the two promise
  lines (`GcBuildingPromise`, one Building-promises PR beside U3b after B6), and the architect's view
  (`GcArchitectSchedule`, G-95).

**The mapper**, `src/lib/gc/submittalRows.ts`: `withSubmittals(state, rows)` lays `project.submittals` over
`boardProjectFromView`'s project, each in its own `useMemo` on the page, as `withChangeOrders` is.

| Kernel field | From |
|---|---|
| `id`, `number`, `title`, `kind` | `gc_submittals` |
| `packageId` | `package_id` |
| `specSection`, `neededBy` | `spec_section`, `needed_by` (null becomes absent) |
| `leadDays`, `askedOn` | `lead_days`, `asked_on` |
| `lineIds` | `gc_submittal_holds.scope_item_id` (decision 2) |
| `rounds` | `gc_submittal_rounds` by `round`: `sentOn`, `file` ← `file_name`, `note`, `toArchitectOn`, `answeredOn`, `answer`, `answerNote` |

`types.ts` stays the prototype's, word for word. The columns the kernel has no field for (`drive_url`,
`sent_by`, `email_send_log_id`) ride beside it in a map by round id, which the window reads. The press
payloads are built there too, with their tests. It reads three fields it does not add: `project.architect`
(on main), `awardedInviteId` (B6-a-ii) and `project.schedule`. The window opens through 6a's
`loadSchedule(withSubmittals(board, rows), projectId)`, so *needed by* is the first start of the work it
holds, less the lead days. With nothing drawn, it is the office's own day.

**The io**, `src/lib/gc/submittalsIo.ts`: `loadGcSubmittals(projectIds)` reads the three tables in one
round, and one function per press. Helper 14's pair for the daily log is `dailyLogRows.ts` and
`dailyLogIo.ts`.

**`gc-architect-email`** (new; deployed by the lead):
- `POST { kind: 'submittal', submittal_id }`. U5 adds `rfi`.
- It reads the submittal under the caller's own JWT, so RLS decides who may send, dev today, and
  Building's door widens it without touching the function. A training account and a twin are refused.
- It sends to the architect's contact email from `COMPANY_EMAIL_FROM`, with the project manager, else the
  sender, as Reply-To, as `gc-plan-question-email` does. The email carries the number, the title and kind,
  the file's name and Drive link, the trade's note, and the day we need it back.
- The sent copy is filed (kind `gc_submittal`, source `gc_submittal_rounds`). Then it calls
  `gc_send_submittal_to_architect(id, <email_send_log id>)` as the caller. If that refuses, it answers
  *Sent, but not recorded*, as the question's function does.
- The four pieces CI checks: its row in `customerSurfaceRegistry.ts`, a journey step with a sample email
  (`customerSampleEmails.ts`), its answer in `personJourney.ts`, and its `verify_jwt = false` block in
  `config.toml`. Plus its section and contents line in `docs/EDGE_FUNCTIONS.md`.

**U4b's tests:**
- `submittalRows.test.ts`: Fair Oaks D's six from `schedule/testState.ts` through rows and back, round
  order, absent fields, and the payloads.
- `gcArchitectEmail.test.ts`: the subject, the body, the Reply-To.
- The registry tests the four pieces trip.
- `GcSubmittalsWindow.render.test.tsx`: the six in their states with one press each, revise held without
  a note, *It came by email* held without a file name, the warning on a link only some can open, and a
  job with no award.
- `GcProjects.render.test.tsx`: the button for a dev only.

## Drift from `BUILDING_REAL_BUILD.md`

- **The trade's verb is `SECURITY INVOKER`**, the service role's only, and refuses with keys. The Portal's
  P2a verbs settled that way after the plan's decision 5 said `SECURITY DEFINER`. Only the service role can
  call it, so its rights are the service role's either way.
- **A sixth function, `gc_submittal_move`**: the kernel's `submittalState` in SQL, so whose move a
  submittal is has one home that the five read.
- **A hold on another trade's work is refused**, as the plan's table says. The reducer drops it silently.
- **A number a removed submittal left is skipped.** The kernel's count would take it twice, and the
  table's unique key would refuse the press.
- **The office's *It came by email* keeps the trade's promise too**, since decision 9 names the last
  submittal the trade owed, whoever records it.
- **`gc-architect-email` records through the RPC** as the caller, not with the service role, so the rule
  of whose move it is is not written twice.
- **One pair of files per record**, not one `buildingIo.ts` (agreed with Helper 14, who rewords the plan's
  line in the lane's spike follow-up).

## The check (U4b, on "GC test project, delete me", as a dev)

1. Add a submittal holding one of an awarded trade's lines. B6-a's verify awards one.
2. Record a round that came by email, with a Drive link.
3. **Send to GC Test Architects**, whose email is bids@clickplumbing.com. This press goes only on Grace's
   own yes in Helper 18's chat.
4. Record *Revise and resubmit*, and see it the trade's move again.
5. The rows stay for the owner's call 4, and their ids go to the lead.

## When it is cut

- **U4a**: from `origin/main` after B6-a's `20261009140000` is applied and its types are on main.
  Building takes one migration a day, and the lead says which day: #5003's is today's.
- **U4b**: from `origin/main` after U4a's types PR, B6-a-ii (the mapper's `awardedInviteId`) and U3a-ii
  (the page's seam) merge.

## Docs each PR touches

- **U4a**: its release note and fragment, and `docs/migrations/<stamp>_gc_submittal_writes.md` (above).
- **U4b**:
  - its release note and fragment;
  - `docs/EDGE_FUNCTIONS.md`: `gc-architect-email`;
  - `docs/PROJECT_DOCUMENTATION.md` §20: the window, named;
  - `docs/GLOSSARY.md`: **submittal**, **submittal round**;
  - `docs/ACCESS_CONTROL.md`: Building's dev-gate sentence names the window;
  - the guide *send a trade's submittal to the architect* (`roles: dev` until Building's door, as O3-ui's
    v2.4926 did).
- No `docs/twins/APP_DIRECTORY.md` change: it is a window on `/gc`, not a page.

## Seams

- **Helper 14 (Building, U3)**, agreed 2026-10-08:
  - one pair of files per record;
  - the bed's loop goes in whichever of U3b and U4a lands first;
  - on `GcProjects.tsx`, Submittals' button, state block and mount each follow the Daily log's, and U4b
    is cut after U3a-ii merges;
  - Helper 14 edits §20's window count and `ACCESS_CONTROL.md`'s dev-gate sentence first, and U4b amends
    them after a rebase;
  - neither ports `GcBuildingPromise`.
- **The Portal (P5)**: the kind `send_submittal` in `submit-gc-trade-portal`, the two new keys and their
  words, the trade's half of the window, and the upload into the job folder's **Submittals** folder
  (`_shared/driveUpload.ts`).
- **The Board (B6-a-ii)**: the one mapper fills `awardedInviteId`. Until then every trade reads *not
  awarded*.

## Is this the best we can do?

1. **The architect answers from a link of their own**, instead of the office typing the answer from their
   email. *Not now:* there is no architect page yet. G-95 (`GcArchitectSchedule`) is its seed, and their
   own press would need a link key and a function like the trade's. Today they answer by email, and the
   office records it.
2. **The file attached, not linked.** *Not now:* decision 6 keeps a link and never a copy. The window
   warns when the link is closed to outsiders. If architects cannot open links, the function can attach
   the file from Drive.
3. **The register drafts itself from the spec book**, the plan's own way 3. *Later:* it needs each
   section's text, not only the table of contents. *Picked now, the small half:* the section field
   suggests the trade's scope lines' own sections, so a number reads the book's section without typing it.

## Status

Plan 2026-10-08 by Helper 18 at the lead's ask, from `origin/spike/gc-mode` at 7391482bc and
`origin/main` at 2b4abe963. The read-back was approved the same day at all four picks. The SQL passed its
scenario on a local stand-in. Nothing is cut or claimed: U4a is written on a local branch from main and
held until the lead says B6-a is applied and its types are on main.
