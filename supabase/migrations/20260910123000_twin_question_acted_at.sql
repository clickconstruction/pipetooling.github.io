SET lock_timeout = '3s';

-- v2.3229 — the dispatcher acts on answered plans asks. When a person answers a
-- robot's plans ask "Attached — rerun", twin-mcp next_shadow hands the robot its
-- own unlocked shell back before any new claim, and stamps the ask acted_at so
-- it is handed back once. Other answers are stamped acted_at when first seen
-- (nothing to resume). Edge-only writes; additive and idempotent.

ALTER TABLE public.twin_questions ADD COLUMN IF NOT EXISTS acted_at timestamptz;

COMMENT ON COLUMN public.twin_questions.acted_at IS
  'v2.3229: when the dispatcher consumed this answered question (handed the shell back for a rerun, or decided nothing was to be done). NULL = not yet looked at.';
