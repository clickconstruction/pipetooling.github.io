SET lock_timeout = '3s';

-- HR files (punch list #315, the audit's leak, the correction links' half): INSERT and UPDATE on
-- person_file_amendments are taken from the signed-in role, the last of three steps.
--
-- The table's guard (person_file_amendments_guard, a definer's function, 20261112050000) answers before the row
-- policy: "is not on any file" for an id that is on none, "both ends of a link belong to the one person's file" for
-- one on another file, "that link already stands" for a standing link, and the policy's words for the rest. So an
-- insert that named two ids, sent by anyone signed in, learned where each stood. Nothing landed, and the ids are
-- random ones a caller would have to hold already.
--
--   1. 20261127075633 (v2.8727) took everything of anon off the table, and the signed-in role's DELETE, TRUNCATE,
--      REFERENCES and TRIGGER. It left INSERT and UPDATE, because the People → HR tab added a link and took one off
--      by writing the table as the signed-in dev.
--   2. v2.8730, the client alone, moved those two writes behind dev_hr_entry_write: the dev-gated definer's function
--      the dev seat already writes through, which hands a link and a withdrawal to hr_agent_write. The pick, asked
--      whether the links go through the door or the guard asks who is calling first: "A, the door".
--   3. This file. With no screen writing the table, the signed-in role needs SELECT and nothing else, as on the case
--      items. With no privilege the database refuses the statement before any trigger runs, in the same words whatever
--      it names.
--
-- PUSH ONLY ONCE v2.8730's client is the one being served. A tab still open on an older client writes the table
-- itself, and after this file its link would be refused ("permission denied") until the tab reloads. The entry it
-- wrote first would stand, unlinked, and the tab says so. The HR tab is a dev's alone.
--
-- Nothing the app does is lost (read in src, supabase/functions and every function body on 2026-11-27):
--
--   * hr_agent_write is the one function that inserts into or updates the table. It is a definer's function owned by
--     the table's owner, so it needs no privilege of its caller. Both doors reach it: dev_hr_entry_write for a
--     signed-in dev, and the HR agent's own key.
--   * No screen, no edge function and no other database function writes the table. The edge functions read it.
--   * hr_agent keeps its SELECT and INSERT: it is the HR agent's own key, and it reads every link but one that
--     touches a counsel-only record.
--   * SELECT stays for the signed-in role, with its dev-only policy and the seat's counsel-only fence.
--
-- The three policies for the signed-in role stay. With the privilege gone nothing reaches the INSERT and UPDATE ones;
-- they are kept so that a grant given back by mistake still passes a dev alone.
--
-- What the push leaves on prod: two privileges fewer on one table for one role, and the table's comment. No table,
-- column, row, policy, trigger or function is made, changed or dropped. A REVOKE rewrites the table's privilege list
-- in the catalog and holds no lock a reader or writer of the table waits on. Safe to run twice.

REVOKE INSERT, UPDATE ON public.person_file_amendments FROM authenticated;

COMMENT ON TABLE public.person_file_amendments IS
  'HR files (punch list #315): one row says a thing on a person''s file (from: an HR entry or a piece of evidence) corrects or completes an older one (to). The record itself stays append-only and untouched; a wrong link is withdrawn with a reason, never deleted. Dev-only. Written through dev_hr_entry_write and the HR agent''s hr_agent_write alone: since 20261127163949 the signed-in role holds SELECT and nothing else, and since 20261127075633 anon nothing, so a statement sent straight at the table is refused before its guard can answer where an id stands.';
