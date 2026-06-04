-- Bid Date Sent attestation (checkbox acknowledgments + audit timestamps)

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS bid_date_sent_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bid_date_sent_attested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bid_date_sent_ack_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bid_date_sent_ack_email_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bid_date_sent_ack_phone_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bid_date_sent_ack_phone_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bid_date_sent_ack_honesty_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bid_date_sent_ack_honesty_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bids.bid_date_sent_attested_at IS 'When user confirmed Bid Date Sent attestation modal';
COMMENT ON COLUMN public.bids.bid_date_sent_attested_by IS 'User who confirmed attestation';
COMMENT ON COLUMN public.bids.bid_date_sent_ack_email_at IS 'When user checked email-sent attestation';
COMMENT ON COLUMN public.bids.bid_date_sent_ack_phone_at IS 'When user checked phone follow-up attestation';
COMMENT ON COLUMN public.bids.bid_date_sent_ack_honesty_at IS 'When user checked honesty attestation';
