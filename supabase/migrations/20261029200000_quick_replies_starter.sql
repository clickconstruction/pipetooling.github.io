SET lock_timeout = '3s';

-- Quick replies by keyboard, PR 4: the starter set (punch list #126; docs/migrations/20261029200000_quick_replies_starter.md).
--
-- The office sends the same few messages to customers every day, and the app shipped with two customer lines, On my
-- way and I'm here (20261016020000_on_my_way.sql). These are the eleven the owner approved on 2026-10-29, each a team
-- line for customers with its one-word shortcut for the reply box's / list (v2.5637, v2.5638), as the app's own
-- (added_by null), the Spanish left empty. Eight sit on no step, so no automatic send changes. Three are a step's own
-- message, which the job's strip leads with under For this stage, Tell the customer reads on a move and the morning
-- run reads for its reminder (stepLine in src/lib/quickReplies/kernel.ts): /found on What we found, /estimate on
-- Approved (the reminder a day after the estimate) and /remind on Paid (the reminder on the pay-by day).
--
-- quick_replies_seed_starter() adds them once, as quick_replies_seed() added the prototype's (20261012190000). A line
-- is left out when the office has it already: its words on any line, live or removed, or ever added (so a line the
-- team removed or reworded stays as they left it); its shortcut on a live team line; or, for the three on a step, a
-- live team line for customers on that step, which keeps the step. So a second push changes nothing. Each line added
-- gets its added version and its shortcut version, by nobody. Returns how many it added. The database's own: EXECUTE
-- revoked from anon and authenticated; the migration runs it once. No table is created, so the three fence appliers
-- are not re-run.

CREATE OR REPLACE FUNCTION public.quick_replies_seed_starter()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r record;
  v_id uuid;
  v_added integer := 0;
BEGIN
  FOR r IN
    SELECT s.n, s.shortcut, s.words, s.step_key
    FROM (VALUES
      (1, 'gotit', '{first}, this is {me} with Click Plumbing. We got your message and will call you back today.', NULL),
      (2, 'access', '{first}, is there a gate code, a pet or anything we should know before we come to {address}?', NULL),
      (3, 'photo', '{first}, could you text us a photo of {thing}? It helps us bring the right parts.', NULL),
      (4, 'late', '{first}, we are running behind. The new window is {window}. Sorry for the wait.', NULL),
      (5, 'back', '{first}, we will be back {back day} at {back time} to finish {job}.', NULL),
      (6, 'bill', '{first}, here is your bill for {job}. You can pay it here: {bill}', NULL),
      (7, 'thanks', 'Thank you, {first}. We will get {job} on the schedule and text you the day.', NULL),
      (8, 'paid', 'Thank you, {first}. We got your payment for {job}.', NULL),
      (9, 'found', '{first}, {tech} found {found}. We will send you a price shortly.', 'found'),
      (10, 'estimate', '{first}, did you get a chance to look at the estimate for {job}? You can open it here: {link}', 'approved'),
      (11, 'remind', '{first}, a reminder that {amount} for {job} is still open. You can pay it here: {bill}', 'paid')
    ) AS s(n, shortcut, words, step_key)
    ORDER BY s.n
  LOOP
    -- The office has the words already: on a line live or removed, or on one it has reworded since.
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.quick_replies q WHERE lower(btrim(q.text)) = lower(r.words))
      OR EXISTS (SELECT 1 FROM public.quick_reply_versions v WHERE v.kind = 'added' AND lower(btrim(v.to_text)) = lower(r.words));
    -- The office gave the word to a live team line of its own.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.quick_replies q WHERE q.scope = 'team' AND q.removed_at IS NULL AND q.shortcut = r.shortcut);
    -- The step has the office's own team line for customers, which keeps it.
    CONTINUE WHEN r.step_key IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.quick_replies q
      WHERE q.scope = 'team' AND q.for_kind = 'customer' AND q.removed_at IS NULL AND q.step_key = r.step_key);
    INSERT INTO public.quick_replies (text, for_kind, step_key, scope, shortcut)
    VALUES (r.words, 'customer', r.step_key, 'team', r.shortcut)
    RETURNING id INTO v_id;
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, to_text, to_for_kind, to_step_key)
    VALUES (v_id, 'added', r.words, 'customer', r.step_key);
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, from_text, to_text)
    VALUES (v_id, 'shortcut', NULL, r.shortcut);
    v_added := v_added + 1;
  END LOOP;
  RETURN v_added;
END;
$$;

COMMENT ON FUNCTION public.quick_replies_seed_starter() IS
  'Quick replies by keyboard (punch list #126, PR 4): adds the eleven starter lines the owner approved on 2026-10-29, each a team line for customers with its shortcut, as the app''s own, once. A line is left out when its words are on any line, live or removed, or were ever added; when a live team line holds its shortcut; or, for the three on a step, when a live team line for customers is on that step. Returns how many it added. The database''s own: the migration ran it once.';

REVOKE ALL ON FUNCTION public.quick_replies_seed_starter() FROM PUBLIC, anon, authenticated;

-- ---------- The starter lines, once ----------

SELECT public.quick_replies_seed_starter();
