SET lock_timeout = '3s';

-- v2.2553 (audit cockpit v2): the robot's own confession of where it's least
-- sure — written by twin-mcp ct_finish_takeoff when it opens the audit row and
-- shown at the top of the audit card, so the auditor checks its suspicions
-- first instead of hunting for problems.
ALTER TABLE public.bid_audits ADD COLUMN IF NOT EXISTS self_assessment text;

COMMENT ON COLUMN public.bid_audits.self_assessment IS
  'Twin-authored: where the robot is least confident in this draft (shown atop the audit card).';
