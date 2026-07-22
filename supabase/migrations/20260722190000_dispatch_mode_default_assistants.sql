-- Dispatch Mode default-on for assistants (v2.912): NULL now means "no explicit
-- choice", letting the client default assistant-like roles to ON while everyone
-- else defaults OFF. Existing false rows (nobody had explicitly opted out in the
-- hours since v2.905 shipped) become NULL so current AND future assistants get
-- the default. Idempotent: re-running the ALTERs is a no-op and the UPDATE only
-- touches explicit-false rows.
ALTER TABLE public.users ALTER COLUMN dispatch_mode_enabled DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN dispatch_mode_enabled DROP DEFAULT;
UPDATE public.users SET dispatch_mode_enabled = NULL WHERE dispatch_mode_enabled = false;
