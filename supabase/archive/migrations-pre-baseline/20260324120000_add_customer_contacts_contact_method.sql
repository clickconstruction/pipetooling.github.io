-- Optional contact channel for general customer outreach (Builder Review customer notes UX parity with bid notes)

ALTER TABLE public.customer_contacts
  ADD COLUMN IF NOT EXISTS contact_method text;

COMMENT ON COLUMN public.customer_contacts.contact_method IS 'e.g. Phone, Email — mirrors bids_submission_entries.contact_method';
