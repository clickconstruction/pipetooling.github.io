SET lock_timeout = '3s';

-- v2.8298 (punch list #350, PR 7's leftover): a work statement is confirmed once per copy.
--
-- A sub can confirm a work statement from their page (v2.8273, behind SUB_PAPER_CONFIRM_LIVE, which is off). The
-- sub-portal function reads the answers, sees no confirm of this copy, and writes one. Two presses at one moment
-- both read before either writes, so both write, and the copy holds two confirms with two times. A payment's
-- *received* has been held to one row by the table since 20261117150000. A confirm was held by the function alone.
--
-- Each revision of a paper is its own row in sub_papers, so the copy a sub confirmed is its paper_id. One unique
-- index on it, for the confirmed rows that name a paper, holds one confirm per copy. A later revision is another
-- paper_id and takes its own confirm. The function reads the second press's 23505 as already confirmed.
--
-- The table holds no confirmed row (read on prod 2026-11-22, and the switch has never been on), so nothing is in the
-- index's way. Additive, and idempotent: safe to apply twice. No table is created, so no fence is called.

CREATE UNIQUE INDEX IF NOT EXISTS sub_paper_acks_confirmed_paper_key
  ON public.sub_paper_acks (paper_id) WHERE kind = 'confirmed' AND paper_id IS NOT NULL;

COMMENT ON INDEX public.sub_paper_acks_confirmed_paper_key IS
  'Punch list #350: a work statement is confirmed once per copy. Each revision is its own sub_papers row, so one confirmed row per paper_id is one confirm per revision.';
