SET lock_timeout = '3s';

-- v2.2370: same-page cover-letter alternates — per-bid customer-facing wording for the letter's
-- Alternates block (heading override + per-alternate label/note), edited inline on the Cover
-- Letter preview. Shape: { heading?: string, sections?: { [versionId[:pricingId]]: { label?, note? } } }.
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS cover_letter_alt_texts jsonb;

COMMENT ON COLUMN public.bids.cover_letter_alt_texts IS
  'Cover letter Alternates block wording (v2.2370): heading override + per-section {label, note}, keyed by bid_version_id or bid_version_id:offered_pricing_id. Null = automatic wording.';
