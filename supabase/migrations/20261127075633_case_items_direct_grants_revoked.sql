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
-- Taunya's answer of 2026-11-25, asked which of the audit's two fixes to take: "Fix all of them; the leak closed by
-- revoking the direct grants."
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
-- What the push leaves on prod: two privileges fewer on one table for one role, and the table's comment. No table,
-- column, row, policy, trigger or function is made, changed or dropped. A REVOKE rewrites the table's privilege list
-- in the catalog and holds no lock a reader or writer of the table waits on. Safe to run twice.

REVOKE INSERT, UPDATE ON public.person_case_items FROM authenticated;

-- anon held nothing (20261113080000 revoked all). Said again, so the end state does not lean on that file.
REVOKE ALL ON public.person_case_items FROM anon;

COMMENT ON TABLE public.person_case_items IS
  'HR files (punch list #315): an open item of a person''s case, numbered by the database a person so no two sessions take one number: what, who has it, open · done · dropped, why it closed. Never deleted. Dev-only. Written through dev_case_write alone: since 20261127075633 the signed-in role holds SELECT and nothing else, so a statement sent straight at the table is refused before its guard can answer whether a number stands.';
