SET lock_timeout = '3s';

-- Estimate Options, Phase 3 (v2.2462): the activity feed learns which options the customer
-- looked at. Widens the estimate_customer_events CHECKs for the new event and its source
-- (logged by the new public edge function log-estimate-option-view, token-validated).

ALTER TABLE public.estimate_customer_events
  DROP CONSTRAINT IF EXISTS estimate_customer_events_event_type_check;
ALTER TABLE public.estimate_customer_events
  ADD CONSTRAINT estimate_customer_events_event_type_check
  CHECK (event_type = ANY (ARRAY['public_link_view'::text, 'public_accept_submitted'::text, 'option_viewed'::text]));

ALTER TABLE public.estimate_customer_events
  DROP CONSTRAINT IF EXISTS estimate_customer_events_source_check;
ALTER TABLE public.estimate_customer_events
  ADD CONSTRAINT estimate_customer_events_source_check
  CHECK (source = ANY (ARRAY['get-estimate-for-customer'::text, 'accept-estimate'::text, 'log-estimate-option-view'::text]));

COMMENT ON COLUMN public.estimate_customer_events.event_type IS
  'public_link_view: successful get-estimate-for-customer 200; public_accept_submitted: successful accept-estimate; option_viewed: customer selected/inspected an option on the acceptance page (metadata.option_key/option_name).';
