SET lock_timeout = '3s';

-- Digital twins Phase T1 (docs/DIGITAL_TWINS_PLAN.md): twin accounts are first-class users
-- flagged at the account level. Every created_by/audit row a twin writes is attributable by
-- this one predicate; human-metric surfaces exclude twins with AND NOT is_digital_twin
-- (added per surface as twins actually touch them — precedent: hide_dev_tally_transactions).
-- The client shows a persistent 🤖 banner for flagged sessions and Active Accounts chips
-- flagged rows. Twin accounts start users.read_only = true (training mode) per the safety
-- ladder; flipping that is a deliberate per-twin owner action.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_digital_twin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_digital_twin IS
  'Digital twin account (agent-operated, not a person). Flag lives on the account: attribution rides created_by; the app chrome shows a twin banner; metric surfaces may exclude via AND NOT is_digital_twin. See docs/DIGITAL_TWINS_PLAN.md.';
