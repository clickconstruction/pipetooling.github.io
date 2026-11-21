SET lock_timeout = '3s';

-- Training: the fourth course's seed row (Intro to HVAC; Taunya, 2026-11-20: HVAC is the company's trade and the
-- next training to add). Off until the owner or a dev turns it on in Settings → Training after a licensed HVAC
-- reader has read the course; offered to every role and required of nobody for the first version, so nobody is
-- clocked on words no licensed person has checked; good for 120 months so a pass is taken once.
-- One insert; nothing existing changes; no table is created, so no fence applier. `required_roles` empty passes the
-- table's check (a subset of the nine role words) and training_state_for() reads nothing for it.

INSERT INTO public.training_courses (slug, title, enabled, required_roles, good_for_months, offered)
VALUES ('intro-hvac', 'Intro to HVAC', false, '{}'::text[], 120, true)
ON CONFLICT (slug) DO NOTHING;
