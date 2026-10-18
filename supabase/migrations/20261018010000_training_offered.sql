SET lock_timeout = '3s';

-- Training: an offered course (punch list #119, the Intro to plumbing course). A course today is either required of
-- a role or invisible to it. `offered` opens a course to every role: a person whose role is not in required_roles
-- sees it on the Dashboard's Training card under an Available line, with no colour and no clock, and may take it.
-- training_state_for() and training_standings() keep keying on required_roles, so an offered course gives no
-- colour, no People chip and no Settings count; the two write doors never checked the policy, so a pass from any
-- role was already accepted and recorded. State is read, never stored: if the course is later required of a role,
-- every pass those people took while it was offered counts from that day.

ALTER TABLE public.training_courses ADD COLUMN IF NOT EXISTS offered boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.training_courses.offered IS
  'Open to every role (v2.5610, punch list #119): a role not in required_roles may take the course, with no colour and no clock. Settings → Training: Open to everyone.';

-- The second course, switched off until a dev turns it on in Settings → Training: required of helpers, offered to
-- everyone else, and good for 120 months so a required helper takes it once (the owner's calls 1 and 6 as drawn).
INSERT INTO public.training_courses (slug, title, enabled, required_roles, good_for_months, offered)
VALUES ('intro-to-plumbing', 'Intro to plumbing', false, ARRAY['helpers'], 120, true)
ON CONFLICT (slug) DO NOTHING;
