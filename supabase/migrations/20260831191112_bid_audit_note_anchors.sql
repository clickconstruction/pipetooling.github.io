SET lock_timeout = '3s';

-- v2.2535: anchor a twin's audit question to the plans and its stakes.
-- sheet_ref = where the twin saw it (e.g. 'P2.1'); context = what it saw and
-- what rides on the answer. Nullable + additive: human-authored notes and all
-- existing rows stay NULL, and the Audits card renders them only when present.
ALTER TABLE public.bid_audit_notes ADD COLUMN IF NOT EXISTS sheet_ref text;
ALTER TABLE public.bid_audit_notes ADD COLUMN IF NOT EXISTS context text;

COMMENT ON COLUMN public.bid_audit_notes.sheet_ref IS 'Plan-sheet anchor for twin questions (e.g. P2.1) — shown on the Audits card';
COMMENT ON COLUMN public.bid_audit_notes.context IS 'Twin''s why-I''m-asking: what it saw and what rides on the answer';
