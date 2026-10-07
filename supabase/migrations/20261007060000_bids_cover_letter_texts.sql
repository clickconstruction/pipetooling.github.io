SET lock_timeout = '3s';

-- The Cover Letter's three per-bid boxes are saved (v2.4737; to-dos/bid-history PR 0a, punch list
-- #73). Additional inclusions, Exclusions and scope, and Terms and warranty were React state only:
-- typed, shown on the letter, never written anywhere, so a reload emptied them — one of the two
-- silent ways Wendi's work vanished. Three nullable text columns on bids: null means nobody has
-- typed in the box for this bid (the letter falls back to the org default, then the built-in
-- wording, as before); a string, even an empty one, is what was typed.
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS cover_letter_inclusions text,
  ADD COLUMN IF NOT EXISTS cover_letter_exclusions text,
  ADD COLUMN IF NOT EXISTS cover_letter_terms text;

COMMENT ON COLUMN public.bids.cover_letter_inclusions IS 'The Cover Letter''s Additional inclusions box for this bid (v2.4737): one line per bullet; null when nobody typed in it.';
COMMENT ON COLUMN public.bids.cover_letter_exclusions IS 'The Cover Letter''s Exclusions and scope box for this bid (v2.4737); null = the org default, then the built-in wording.';
COMMENT ON COLUMN public.bids.cover_letter_terms IS 'The Cover Letter''s Terms and warranty box for this bid (v2.4737); null = the org default, then the built-in wording.';

-- Bid history keeps them: the three join bid_changes_bid_columns() (the newest definition, whole,
-- from 20261007040000_bid_changes), and the bids trigger's UPDATE OF list is rebuilt from it so a
-- change to any of the three is recorded. CREATE OR REPLACE TRIGGER swaps the list in place.
CREATE OR REPLACE FUNCTION public.bid_changes_bid_columns()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'accepted_alternate_tags',
    'account_manager_id',
    'address',
    'agreed_value',
    'alternate_group_tags',
    'bid_date_sent',
    'bid_due_date',
    'bid_due_time',
    'bid_number',
    'bid_submission_link',
    'bid_to_marked_plans',
    'bid_value',
    'count_tooling_plans_link',
    'cover_letter_alt_texts',
    'cover_letter_exclusions',
    'cover_letter_inclusions',
    'cover_letter_terms',
    'customer_id',
    'declined_alternate_tags',
    'design_drawing_plan_date',
    'distance_from_office',
    'drive_link',
    'estimated_job_start_date',
    'estimator_id',
    'gc_builder_id',
    'gc_contact_email',
    'gc_contact_name',
    'gc_contact_phone',
    'include_materials_by_stage',
    'include_payment_schedule',
    'include_schedule_of_values',
    'itb_links',
    'loss_category',
    'loss_reason',
    'notes',
    'outcome',
    'outcome_at',
    'plans_link',
    'profit',
    'project_id',
    'project_name',
    'selected_bid_version_id',
    'selected_labor_book_version_id',
    'selected_price_book_version_id',
    'selected_takeoff_book_version_id',
    'service_type_id',
    'sov_letter_total_only',
    'sov_material_factor',
    'sov_shape',
    'sov_split_labor_material',
    'submitted_to'
  ]::text[]
$$;

COMMENT ON FUNCTION public.bid_changes_bid_columns() IS
  'The bids columns bid_changes records, and the bids trigger''s UPDATE OF list: what a person types or picks on Edit Bid, Pricing, Cover Letter (its three boxes since v2.4737) and the schedule of values.';

DO $$
BEGIN
  EXECUTE format(
    'CREATE OR REPLACE TRIGGER record_bid_change AFTER INSERT OR DELETE OR UPDATE OF %s ON public.bids FOR EACH ROW EXECUTE FUNCTION public.record_bid_change()',
    (SELECT string_agg(quote_ident(c), ', ') FROM unnest(public.bid_changes_bid_columns()) AS c)
  );
END $$;
