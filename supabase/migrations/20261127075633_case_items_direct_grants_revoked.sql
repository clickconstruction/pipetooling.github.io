SET lock_timeout = '3s';

-- HR files (punch list #315, the audit of 2026-11-20): a signed-in user who is not a dev could learn that a person's
-- case holds Item N.
--
-- person_case_items (20261113080000) granted INSERT and UPDATE to every signed-in user and left the refusal to its row
-- policies, which pass a dev alone. But a BEFORE INSERT trigger runs before the row policy is asked, and the table's
-- guard (person_case_items_guard, a definer's function) looks the number up first: a number that stands is refused
-- with "item N already stands on this file", and a number that does not stand goes on to the policy, which refuses
-- with its own words. Two refusals for one question, so an insert that names a person and a number, sent by anyone
-- signed in, answered whether that item exists. The insert itself never landed, and nothing else was told: not the
-- item's words, not who has it, not its state.
--
-- The answer of 2026-11-25, asked which of the audit's two fixes to take (the card's audit section): "Fix all of
-- them; the leak closed by revoking the direct grants."
--
-- So INSERT and UPDATE on the table are taken from the signed-in role. With no privilege the database refuses the
-- statement before any trigger runs, in the same words whatever number it names. Nothing the app does is lost:
--
--   * The tab, the dev seat (plan_case and apply_case) and every other writer go through dev_case_write, the one door
--     the table was made with. It is a definer's function owned by the table's owner, checks for a dev itself, and
--     does not need the caller to hold a privilege on the table.
--   * No screen, no edge function and no other database function writes the table directly (read in src,
--     supabase/functions and every function body on 2026-11-27: the guard, the counter and the door alone name it).
--   * hr_agent and cost_agent never held a privilege on it, and hr_agent_write does not name it.
--   * SELECT stays, with its dev-only policy: a dev's screen and the seat read the table as the dev, and anyone else
--     reads no row and counts none.
--
-- The two policies for INSERT and UPDATE stay. With the privilege gone nothing reaches them; they are kept so that a
-- grant given back by mistake still passes a dev alone.
--
-- person_case_log keeps its INSERT. It has no guard that answers before its policy, so a refused insert there tells
-- nothing. Its door is the same dev_case_write.
--
-- The correction links (person_file_amendments, 20261112050000) have a guard of the same kind, and this file closes
-- that too.
--
-- That table's migration granted SELECT, INSERT and UPDATE to the signed-in role and never took away what a new table
-- in this schema is given by default, so anon and the signed-in role each held every privilege on it. Its guard
-- (person_file_amendments_guard, a definer's function) answers before the row policy too: "is not on any file" for an
-- id that is on none, "both ends of a link belong to the one person's file" for one on another file, "that link
-- already stands" for a standing link, and the policy's words for the rest. So an insert that named two ids learned
-- where each stood, and with anon's privileges it could be sent with no sign-in at all. Nothing landed, and the ids
-- are random ones a caller would have to hold already, which makes it a smaller leak than "Item 7".
--
-- The answer of 2026-11-27, asked whether the links go through the door or the guard asks first: "A, the door". So
-- the tab stopped writing this table in v2.8730: a link added and a link taken off go through dev_hr_entry_write,
-- the dev-gated definer's function the dev seat already writes through, which hands them to hr_agent_write. With that
-- client live, the signed-in role needs SELECT and nothing else, as on the case items.
--
-- Taken away here (read in src, supabase/functions and every function body on 2026-11-27):
--
--   * Everything of anon. No screen reads or writes this table signed out, and no policy on it names anon.
--   * INSERT and UPDATE of the signed-in role. Since v2.8730 no screen uses them; hr_agent_write is the one function
--     that writes the table, as its owner, and both doors reach it.
--   * DELETE, TRUNCATE, REFERENCES and TRIGGER of the signed-in role. No DELETE policy exists, a link is withdrawn
--     and never deleted, and TRUNCATE passes no row policy at all.
--
-- PUSH ONLY ONCE v2.8730's client is the one being served. A tab still open on an older client writes the table
-- itself, and after this file its link would be refused ("permission denied") until the tab reloads. The entry it
-- wrote first would stand, unlinked, and the tab says so.
--
-- hr_agent keeps its SELECT and INSERT: it is the HR agent's own key, and it reads every link but one that touches a
-- counsel-only record. The three policies for the signed-in role stay, so a grant given back by mistake still passes
-- a dev alone.
--
-- What the push leaves on prod: fewer privileges on two tables for two roles, and the two tables' comments. No table,
-- column, row, policy, trigger or function is made, changed or dropped. A REVOKE rewrites the table's privilege list
-- in the catalog and holds no lock a reader or writer of the table waits on. Safe to run twice.

REVOKE INSERT, UPDATE ON public.person_case_items FROM authenticated;

-- anon held nothing (20261113080000 revoked all). Said again, so the end state does not lean on that file.
REVOKE ALL ON public.person_case_items FROM anon;

COMMENT ON TABLE public.person_case_items IS
  'HR files (punch list #315): an open item of a person''s case, numbered by the database a person so no two sessions take one number: what, who has it, open · done · dropped, why it closed. Never deleted. Dev-only. Written through dev_case_write alone: since 20261127075633 the signed-in role holds SELECT and nothing else, so a statement sent straight at the table is refused before its guard can answer whether a number stands.';

-- The correction links: everything of anon, and everything of the signed-in role but the read.
REVOKE ALL ON public.person_file_amendments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.person_file_amendments FROM authenticated;

COMMENT ON TABLE public.person_file_amendments IS
  'HR files (punch list #315): one row says a thing on a person''s file (from: an HR entry or a piece of evidence) corrects or completes an older one (to). The record itself stays append-only and untouched; a wrong link is withdrawn with a reason, never deleted. Dev-only. Written through dev_hr_entry_write and the HR agent''s hr_agent_write alone: since 20261127075633 the signed-in role holds SELECT and nothing else and anon nothing, so a statement sent straight at the table is refused before its guard can answer where an id stands.';
