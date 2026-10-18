SET lock_timeout = '3s';

-- Training: the third course's seed row (punch list #120, Intro to electrical). Off until a dev turns it on in
-- Settings → Training after the owner's reader has signed the course off; offered to every role and required of
-- nobody for the first version (the owner's calls 2 and 3, 2026-10-18: electrical is not the company's trade, so
-- nobody is clocked on it until the owner flips helpers to required); good for 120 months so a pass is taken once.
-- One insert; nothing existing changes; no table is created, so no fence applier. `required_roles` empty passes the
-- table's check (a subset of the nine role words) and training_state_for() reads nothing for it.

INSERT INTO public.training_courses (slug, title, enabled, required_roles, good_for_months, offered)
VALUES ('intro-electrical', 'Intro to electrical', false, '{}'::text[], 120, true)
ON CONFLICT (slug) DO NOTHING;
