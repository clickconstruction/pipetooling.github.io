SET lock_timeout = '3s';

-- The doors on an envelope that came back (the Docsmit train, 6b-3 — docs/DOCSMIT_LIEN_RUN_PLAN.md, "Delivery
-- drives the desk"): a piece the provider returned, could not deliver or refused stays as history, and the office
-- answers it one of three ways — a plain First Class copy through the provider, the same letter mailed again to
-- another address, or by hand (a courier, a visit). The answer marks the piece resolved so the desk stops asking;
-- a copy or a re-mail is a new piece pointing back at the one it answers.

ALTER TABLE public.mail_pieces
  ADD COLUMN IF NOT EXISTS resend_of uuid REFERENCES public.mail_pieces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_note text;

COMMENT ON COLUMN public.mail_pieces.resend_of IS 'The piece this one answers: a plain copy or a re-mail of an envelope that came back (6b-3).';
COMMENT ON COLUMN public.mail_pieces.resolved_at IS 'When the office answered this envelope (a copy sent, re-mailed, or handled by hand); the desk stops asking.';
COMMENT ON COLUMN public.mail_pieces.resolved_note IS 'How it was answered, in a few words.';

CREATE INDEX IF NOT EXISTS mail_pieces_resend_of_idx ON public.mail_pieces (resend_of) WHERE resend_of IS NOT NULL;
