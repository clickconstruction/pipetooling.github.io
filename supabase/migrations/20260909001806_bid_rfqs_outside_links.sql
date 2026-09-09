SET lock_timeout = '3s';

-- v2.3175 — Price requests table on Edit Bid → Files & Links.
-- A request the estimator sent by hand (email, phone) becomes a bid_rfqs row
-- like the ones the app sends, so "who did I ask on this bid?" stays ONE list
-- everywhere (the Pricing desk reads this table too). Outside rows carry a
-- house, the date it was requested, and two links: the request that went out
-- and the quote that came back. App-sent rows keep their token / email / scope
-- and gain the same two optional links.
--
-- Additive and idempotent. Pushed after the client that reads it deploys — the
-- client treats a missing column as "no outside rows".

ALTER TABLE public.bid_rfqs
  ADD COLUMN IF NOT EXISTS sent_via text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS requested_on date,
  ADD COLUMN IF NOT EXISTS request_url text,
  ADD COLUMN IF NOT EXISTS quote_url text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_rfqs_sent_via_check') THEN
    ALTER TABLE public.bid_rfqs
      ADD CONSTRAINT bid_rfqs_sent_via_check CHECK (sent_via IN ('app', 'outside'));
  END IF;
  -- An outside request has no vendor quote page: no token, no email lane.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_rfqs_outside_has_no_token') THEN
    ALTER TABLE public.bid_rfqs
      ADD CONSTRAINT bid_rfqs_outside_has_no_token CHECK (sent_via = 'app' OR token IS NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.bid_rfqs.sent_via IS 'app = sent by Send price requests (token, email, scope); outside = recorded by hand on Edit Bid (v2.3175): house + requested_on + links only.';
COMMENT ON COLUMN public.bid_rfqs.requested_on IS 'The day the request went out, for outside rows (app rows use created_at).';
COMMENT ON COLUMN public.bid_rfqs.request_url IS 'Link to the request as sent — a Drive copy of the email, a PDF (v2.3175).';
COMMENT ON COLUMN public.bid_rfqs.quote_url IS 'Link to the quote as received — a Drive PDF, a shared sheet (v2.3175). A quote plugged in on Pricing is bid_quotes.rfq_id, not this.';
