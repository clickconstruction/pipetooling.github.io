SET lock_timeout = '3s';

-- Messages, residential R5 (v2.5445): the tech reads the phone's lines. Job Mode's Message the customer lists the
-- quick replies the office marked for the phone (src/lib/quickReplies/phone.ts → phoneLines), but quick_replies_team
-- opens the table to gc_office_team() alone, so a tech's sheet read nothing.
--
--   * quick_replies_phone_tech: a SELECT policy for messages_tech_team() (primary · helpers, 20261013190000) on the
--     lines phoneLines keeps: the team's (scope team), for customers (for_kind customer), on the phone (phone_order set,
--     20261013210000) and not removed. A line kept for one person, a line for a trade partner, an architect or anyone,
--     a line off the phone and a removed line stay the office's. Its words, its Spanish, its button name, its place and
--     its step come with the row; the versions and the uses stay the office's (quick_reply_versions_team,
--     quick_reply_uses keep their own policies).
--   * Writes are unchanged: the table takes none by hand (SELECT is the only grant), and add_quick_reply,
--     edit_quick_reply, remove_quick_reply and restore_quick_reply stay the office's.
--
-- No table, so no fences. Idempotent: a second run changes nothing.

DROP POLICY IF EXISTS quick_replies_phone_tech ON public.quick_replies;
CREATE POLICY quick_replies_phone_tech ON public.quick_replies FOR SELECT TO authenticated
  USING (
    (SELECT public.messages_tech_team())
    AND scope = 'team'
    AND for_kind = 'customer'
    AND phone_order IS NOT NULL
    AND removed_at IS NULL
  );

COMMENT ON POLICY quick_replies_phone_tech ON public.quick_replies IS
  'Messages, R5 (v2.5445): a tech (messages_tech_team: primary, helpers) reads the phone''s lines for Job Mode''s Message the customer: the team''s customer lines with a phone_order, not removed. Every other line, and every version, stays the office''s (quick_replies_team).';
