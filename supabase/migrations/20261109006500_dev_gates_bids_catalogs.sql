SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 11, v2.6764: Settings → Bids & materials, rows 27 to 29 of the audit table (row 63
-- is client lines alone), every recommendation taken as written by the owner on 2026-11-08:
--   row 27  Prospect copy, Book names, Counts quick-add names, Bid cover letter defaults — the estimators' own words, so
--           the estimator writes their keys and the counts quick-add tables. The line item catalog's RPC and
--           fixture_types admitted the estimator already.
--   row 28  Estimate customer experience defaults, Public estimate terms — the wording a customer meets, the owner.
--   row 29  Bid Board value rule — how a package counts on his board, the owner.
-- Additive and idempotent: no table is created, so no fence call is owed.

-- 1) The estimators' keys (row 27): prospect copy and the cover letter defaults, both upserted.
DROP POLICY IF EXISTS estimator_or_dev_insert_bids_words ON public.app_settings;
CREATE POLICY estimator_or_dev_insert_bids_words ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (
    key = ANY (ARRAY['prospect_copy_no_response_email', 'prospect_copy_phone_followup_email', 'prospect_copy_just_checking_in_email', 'prospect_copy_no_response_email_subject', 'prospect_copy_phone_followup_email_subject', 'prospect_copy_just_checking_in_email_subject', 'bid_cover_letter_closing_v1', 'bid_cover_letter_exclusions_default_v1', 'bid_cover_letter_terms_default_v1', 'bid_sov_labor_share_pct_v1', 'bid_sov_material_factor_v1', 'bid_tax_rate_pct_v1'])
    AND (public.is_dev() OR public.is_estimator())
  );
DROP POLICY IF EXISTS estimator_or_dev_update_bids_words ON public.app_settings;
CREATE POLICY estimator_or_dev_update_bids_words ON public.app_settings FOR UPDATE TO authenticated
  USING (
    key = ANY (ARRAY['prospect_copy_no_response_email', 'prospect_copy_phone_followup_email', 'prospect_copy_just_checking_in_email', 'prospect_copy_no_response_email_subject', 'prospect_copy_phone_followup_email_subject', 'prospect_copy_just_checking_in_email_subject', 'bid_cover_letter_closing_v1', 'bid_cover_letter_exclusions_default_v1', 'bid_cover_letter_terms_default_v1', 'bid_sov_labor_share_pct_v1', 'bid_sov_material_factor_v1', 'bid_tax_rate_pct_v1'])
    AND (public.is_dev() OR public.is_estimator())
  )
  WITH CHECK (
    key = ANY (ARRAY['prospect_copy_no_response_email', 'prospect_copy_phone_followup_email', 'prospect_copy_just_checking_in_email', 'prospect_copy_no_response_email_subject', 'prospect_copy_phone_followup_email_subject', 'prospect_copy_just_checking_in_email_subject', 'bid_cover_letter_closing_v1', 'bid_cover_letter_exclusions_default_v1', 'bid_cover_letter_terms_default_v1', 'bid_sov_labor_share_pct_v1', 'bid_sov_material_factor_v1', 'bid_tax_rate_pct_v1'])
    AND (public.is_dev() OR public.is_estimator())
  );

-- The counts quick-add names (row 27): the estimator manages both tables beside the dev.
DROP POLICY IF EXISTS "Estimators manage counts_fixture_groups" ON public.counts_fixture_groups;
CREATE POLICY "Estimators manage counts_fixture_groups" ON public.counts_fixture_groups USING (public.is_estimator()) WITH CHECK (public.is_estimator());
DROP POLICY IF EXISTS "Estimators manage counts_fixture_group_items" ON public.counts_fixture_group_items;
CREATE POLICY "Estimators manage counts_fixture_group_items" ON public.counts_fixture_group_items USING (public.is_estimator()) WITH CHECK (public.is_estimator());

-- 2) The owner's keys (rows 28, 29): the estimate experience defaults, the public terms and the value rule.
DROP POLICY IF EXISTS master_or_dev_insert_estimate_wording ON public.app_settings;
CREATE POLICY master_or_dev_insert_estimate_wording ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (
    key = ANY (ARRAY['estimate_accept_checkbox_label', 'estimate_accept_instructions', 'estimate_accept_name_field_label', 'estimate_accept_page_footer', 'estimate_accept_section_title', 'estimate_accept_submit_label', 'estimate_accept_submitting_label', 'estimate_doc_line_items_heading', 'estimate_doc_terms_heading', 'estimate_doc_title_fallback', 'estimate_doc_total_label', 'estimate_doc_valid_through_prefix', 'estimate_email_body_template', 'estimate_email_subject_template', 'estimate_thank_you_body', 'estimate_thank_you_title', 'estimate_public_terms_body', 'bid_board_value_rule_v1'])
    AND public.is_master_or_dev()
  );
DROP POLICY IF EXISTS master_or_dev_update_estimate_wording ON public.app_settings;
CREATE POLICY master_or_dev_update_estimate_wording ON public.app_settings FOR UPDATE TO authenticated
  USING (
    key = ANY (ARRAY['estimate_accept_checkbox_label', 'estimate_accept_instructions', 'estimate_accept_name_field_label', 'estimate_accept_page_footer', 'estimate_accept_section_title', 'estimate_accept_submit_label', 'estimate_accept_submitting_label', 'estimate_doc_line_items_heading', 'estimate_doc_terms_heading', 'estimate_doc_title_fallback', 'estimate_doc_total_label', 'estimate_doc_valid_through_prefix', 'estimate_email_body_template', 'estimate_email_subject_template', 'estimate_thank_you_body', 'estimate_thank_you_title', 'estimate_public_terms_body', 'bid_board_value_rule_v1'])
    AND public.is_master_or_dev()
  )
  WITH CHECK (
    key = ANY (ARRAY['estimate_accept_checkbox_label', 'estimate_accept_instructions', 'estimate_accept_name_field_label', 'estimate_accept_page_footer', 'estimate_accept_section_title', 'estimate_accept_submit_label', 'estimate_accept_submitting_label', 'estimate_doc_line_items_heading', 'estimate_doc_terms_heading', 'estimate_doc_title_fallback', 'estimate_doc_total_label', 'estimate_doc_valid_through_prefix', 'estimate_email_body_template', 'estimate_email_subject_template', 'estimate_thank_you_body', 'estimate_thank_you_title', 'estimate_public_terms_body', 'bid_board_value_rule_v1'])
    AND public.is_master_or_dev()
  );
