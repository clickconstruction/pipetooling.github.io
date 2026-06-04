-- =====================================================================
-- supabase/seed.sql — auto-loaded on `supabase db reset` (config.toml [db.seed]).
-- Supplies what the schema-only baseline (20250101000000_baseline.sql) cannot carry:
-- reference/lookup data (current prod state), storage buckets, and cron jobs.
--
-- MANUAL PREREQUISITES for a FRESH environment (already present on prod):
--   1. Enable extensions pg_cron + pg_net (Supabase dashboard → Database → Extensions).
--   2. Create the two Vault secrets the cron jobs read (cannot be dumped):
--        select vault.create_secret('https://<ref>.supabase.co', 'PROJECT_URL');
--        select vault.create_secret('<cron-secret-value>', 'CRON_SECRET');
--   The cron block at the bottom is guarded and self-skips if pg_cron/pg_net are absent.
-- =====================================================================

SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict icxGRUJIi9xk1huISyjNNcvc04WESxb73slsNTe5sBNWBsKMwD22MDu7DZPChI2

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."app_settings" ("key", "value_num", "value_text") VALUES
	('drive_mileage_cost', 0.70, NULL),
	('drive_time_per_mile', 0.02, NULL),
	('default_labor_rate', 55.00, NULL),
	('prospect_copy_no_response_email_subject', NULL, 'Follow up - [company name]'),
	('prospect_copy_phone_followup_email_subject', NULL, 'Re: [company name]'),
	('prospect_copy_just_checking_in_email_subject', NULL, 'Re: [company name]'),
	('estimate_line_item_catalog', NULL, '[]'),
	('job_owner_override_ad5f7f76-153a-4a19-8da8-db028b3bf4d7', NULL, '4b37092c-27eb-43e9-a9a0-eb38e6fd7771'),
	('job_owner_override_d628cadf-033f-422b-b360-a7b348993b7a', NULL, '4b37092c-27eb-43e9-a9a0-eb38e6fd7771'),
	('prospect_copy_no_response_email', NULL, 'Hi this is [User name] from Click Plumbing, Electrical, and HVAC,

We want to bid your work! Click Plumbing is actively seeking long-term trade partnerships and we see great value supporting [company name]''s upcoming projects. Our RMP Master, Malachi Whites, has previously worked with D.R. Horton San Antonio, Ashton Woods, M/I Homes, Michael Holub Custom Homes, H&I Construction, and Triple B Homes, among others.

We hold 2mm General and 2mm occurance insurance and can provice any additional information you may need to qualify us. We would love the opportunity to bid your upcoming work.

You may reach me directly at [user phone number] or [user email], or contact Malachi Whites at (830) 946-0050 or malachi@clickplumbing.com. Additional information about our company and capabilities is available at https://clickplumbing.com/.

Thank you again for your time and consideration. We look forward to the opportunity to work together. We want to bid your work!

Best regards,'),
	('prospect_copy_phone_followup_email', NULL, 'Hi I just spoke to _______, this is [User name] from Click Plumbing, Electrical, and HVAC,

We want to bid your work! Click Plumbing is actively seeking long-term trade partnerships and we see great value in the opportunity to support [company name]''s upcoming projects. Our RMP Master, Malachi Whites, has previously worked with D.R. Horton San Antonio, Ashton Woods, M/I Homes, Michael Holub Custom Homes, H&I Construction, and Triple B Homes, among others.

We hold 2mm General and 2mm occurance insurance and can provice any additional information you may need to qualify us. We would love the opportunity to bid your upcoming work.

You may reach me directly at [user phone number] or [user email], or contact Malachi Whites at (830) 946-0050 or malachi@clickplumbing.com. Additional information about our company and capabilities is available at https://clickplumbing.com/.

Thank you again for your time and consideration. We look forward to the opportunity to work together. We want to bid your work!'),
	('prospect_copy_just_checking_in_email', NULL, 'Hi I''ve been trying to reach y''all at _______, this is [User name] from Click Plumbing, Electrical, and HVAC,

We want to bid your work! Click Plumbing is actively seeking long-term trade partnerships and we see great value in the opportunity to support [company name]''s upcoming projects. Our RMP Master, Malachi Whites, has previously worked with D.R. Horton San Antonio, Ashton Woods, M/I Homes, Michael Holub Custom Homes, H&I Construction, and Triple B Homes, among others.

We hold 2mm General and 2mm occurance insurance and can provice any additional information you may need to qualify us. We would love the opportunity to bid your upcoming work.

You may reach me directly at [user phone number] or [user email], or contact Malachi Whites at (830) 946-0050 or malachi@clickplumbing.com. Additional information about our company and capabilities is available at https://clickplumbing.com/.

Thank you again for your time and consideration. We look forward to the opportunity to work together. We want to bid your work!'),
	('job_owner_override_cda62e3a-5f71-421b-8f39-8d79ba372b83', NULL, '4b37092c-27eb-43e9-a9a0-eb38e6fd7771'),
	('job_owner_override_fc73b30a-5705-493b-a867-d9d53234d951', NULL, '4b37092c-27eb-43e9-a9a0-eb38e6fd7771'),
	('quickfill_jobs_billing_min_hcp', 406.00, NULL),
	('estimate_email_subject_template', NULL, 'Click Plumbing and Electrical Estimate: {{title}}'),
	('estimate_email_body_template', NULL, 'Our team wants to be there for you. Please review and accept your estimate if you would like us to move forward with the following link:

{{accept_url}}

If you have any questions please don''t hesitate to reach out.
Phone: 512-360-0599
Email: office@clickplumbing.com

Protecting our neighbors since 2014,
Thank you from the Click Plumbing and Electrical Team'),
	('estimate_accept_section_title', NULL, 'Accept'),
	('job_tally_min_posted_ymd', NULL, '2026-03-31'),
	('estimate_thank_you_body', NULL, 'Your response has been recorded. The contractor will follow up with you. We are excited to see you soon.'),
	('estimate_accept_instructions', NULL, 'Type your full name and confirm you agree to the estimate and terms above.'),
	('estimate_accept_name_field_label', NULL, 'Full name'),
	('estimate_public_terms_body', NULL, 'Click Plumbing and Electrical Terms & Conditions
CLICK PLUMBING AND ELECTRICAL – TERMS AND CONDITIONS

(Applicable to all invoices, proposals, and contracts unless superseded by a fully executed written agreement)

1. Payment Terms

Payment is due immediately upon receipt of invoice unless otherwise stated. Acceptable forms of payment include check, ACH, wire, or credit card (3% processing fee applies to credit card payments).

2. Late Payment / Prompt Payment Act

Pursuant to Texas Property Code Chapter 28 (Prompt Payment to Contractors and Subcontractors), invoices unpaid after 45 days from the invoice date shall bear interest at the rate of one and one-half percent (1.5%) per month (18% per annum) on the unpaid balance. Customer shall also be responsible for all collection costs, reasonable attorney’s fees, and court costs incurred to collect any overdue amount.

3. Conditional Lien Waiver

Any lien waiver provided with an invoice is conditional and becomes effective only upon receipt and collection of good funds in the full amount of the invoice. Click Plumbing and Electrical expressly reserves all mechanic’s lien, payment bond, and stop-payment notice rights until payment has cleared.

4. Change Orders

Any additional work or modifications to the original scope must be paid before the final invoice is complete. Payments may be applied partially to change orders before they are applied to the final bill at the discretion of Click Plumbing and Electrical, this may lead to lien waivers. Approved change orders will be billed at the rates shown or at time-and-material rates if no price is stated.

5. Warranty

Click Plumbing and Electrical warrants its workmanship for one (1) year from the date of substantial completion. Manufacturer warranties on materials and equipment shall pass through to Customer to the extent permitted by the manufacturer. This warranty does not cover damage caused by misuse, neglect, acts of God, or work performed by others.

6. Price Validity

Quoted prices are valid for 30 days from the date of the proposal unless otherwise noted.

7. Cancellation / Restocking Fees

Special-order materials are non-cancelable and non-refundable. A restocking fee of up to 30% may be charged on returned stock items.

8. Dispute Resolution & Venue

Any disputes arising under this agreement shall be governed by the laws of the State of Texas. Venue for any legal action shall lie exclusively in Guadalupe County, Texas.

9. Entire Agreement

These Terms and Conditions, together with the face of the invoice or signed proposal, constitute the entire agreement between the parties and supersede all prior discussions or agreements.

10. Severability

If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.

Click Plumbing and Electrical
5501 Balcones Dr, Ste A-141
Austin, Texas 78731
Phone: 512-360-0599
Email: office@clickplumbing.com
Texas State Board of Plumbing Examiners License RMP 41130

www.clickplumbing.com/terms'),
	('estimate_accept_checkbox_label', NULL, 'I agree to conduct business electronically with Click Plumbing and Electrical and have read and agree to this estimate and the terms above.'),
	('estimate_accept_submit_label', NULL, 'Submit acceptance'),
	('estimate_accept_submitting_label', NULL, 'Submitting…'),
	('estimate_thank_you_title', NULL, 'Thank you'),
	('estimate_doc_title_fallback', NULL, 'Estimate'),
	('estimate_doc_valid_through_prefix', NULL, 'Expires on: '),
	('estimate_doc_line_items_heading', NULL, 'Line items'),
	('report_edit_window_days', 2.00, NULL),
	('report_sub_visibility_months', 3.00, NULL),
	('quickfill_hidden_section_ids', NULL, '["hours","crew-jobs","unpriced-fixtures","banking-sorting","jobs-billing","difficult-people"]'),
	('estimate_doc_terms_heading', NULL, 'Terms'),
	('estimate_doc_total_label', NULL, 'Total'),
	('estimate_accept_page_footer', NULL, 'Reliable service today, innovative solutions for tomorrow.
Click Plumbing and Electrical
12925 FM 20, Kingsbury, TX 78638
Ph: 512-360-0599
Malachi Whites RMP M-41130

Regulated by the Texas State Board of Plumbing Examiners
929 E 41st St, Austin, TX 78751 (512) 936-5200'),
	('quickfill_section_order', NULL, '["office-arriving","texts","email-inbox","physical-inbox","schedule","dispatch-inbox","warnings","no-customer-stages","hours","difficult-people","people-hours-new","banking-sorting","crew-jobs","email-follow-up","email-next-actions","billed-awaiting","unpriced-fixtures","cant-reach","supply-houses","jobs-billing","tomorrow-schedule","prospects","office-leaving"]'),
	('bank_payments_kind_badges_v1', NULL, '{"checkDeposit":{"nickname":"Cheque","color":"#b30505"},"debitCardTransaction":{"nickname":"","color":"#e5e7eb"},"incomingDomesticWire":{"nickname":"Wire","color":"#0f56e6"},"internalTransfer":{"nickname":"","color":"#e5e7eb"},"other":{"nickname":"ACH/DirectDeposit","color":"#fde808"},"outgoingPayment":{"nickname":"","color":"#e5e7eb"}}'),
	('bank_payments_sorting_config_v1', NULL, '{"v":1,"kinds":["checkDeposit","incomingDomesticWire","other"],"accountIds":["63fb1084-4598-11f0-8886-a3bb9e128e6a","f4c77adc-f2f8-11ef-a22b-b35f40296016"],"debitCardIds":[],"startDateYmd":"2026-04-01","excludeCounterpartyContains":["Housecall"],"excludeNoteContains":[]}'),
	('quickfill_office_leaving_items', NULL, '[{"id":"3ef3ed69-95b8-4509-aff0-42b1c3c405bd","label":"Take out trash no matter what because there are food products"}]'),
	('map_default_view_v1', NULL, '{"centerLat":29.7212604,"centerLng":-97.8407811,"zoom":10,"addressLabel":"12921 FM 20 Kingsbury TX 78638"}'),
	('quickfill_section_banners', NULL, '{"schedule":"Are there any obvious schedule conflicts?","texts":"Did anything fall through the cracks from today or yesterday?","email-inbox":"Are my work@ and bids@ inboxes clean?","physical-inbox":"Can I get to the bottom of the pile?"}'),
	('dispatch_note_requirement_config_v1', NULL, '{"v":1,"require_note_user_ids":["f848e56b-4f46-4e16-ac00-99c119ccefc2","7b00609e-6971-45c0-b738-9228a1b2f631"],"skip_note_user_ids":["fc73b30a-5705-493b-a867-d9d53234d951","d628cadf-033f-422b-b360-a7b348993b7a","cda62e3a-5f71-421b-8f39-8d79ba372b83","ad5f7f76-153a-4a19-8da8-db028b3bf4d7","4b37092c-27eb-43e9-a9a0-eb38e6fd7771"],"skip_note_job_ids":[]}'),
	('quickfill_office_arriving_items', NULL, '[{"id":"6297c422-bcf2-467d-a080-24d4a1bac1c0","label":"Open the window shades"},{"id":"684e7c4f-8162-457f-8a00-f1e55185a082","label":"turn on the lights"},{"id":"fc30899f-5c39-415f-bf82-15deea5160be","label":"mop and sweep where needed"}]'),
	('quickfill_office_leaving_done', NULL, '{"3ef3ed69-95b8-4509-aff0-42b1c3c405bd":true}'),
	('physical_invoice_footer_presets_v1', NULL, '{"v":2,"builtinOverrides":{"standard":"Click Plumbing and Electrical\nQuestions about this invoice? Reply to this email or call the office.\nPh: 512-360-0599\n12925 FM 20 Kingsbury TX 78638\n\nRMP M-41130 TDLR #: 40852 | office@clickplumbing.com | (512) 360-0599\nRegulated by the Texas State Board of Plumbing Examiners\n929 E 41st St, Austin, TX 78751 (512) 936-5200 https://tsbpe.texas.gov\nRegulated by the Texas Department of Licensing & Regulation.\n920 Colorado St, Austin, TX 78701 (512) 463-6599 tdlr.texas.gov","alternate":"Click Plumbing and Electrical\nQuestions about this invoice? Reply to this email or call the office.\nPh: 512-360-0599\n12925 FM 20 Kingsbury TX 78638\n\nRMP M-41130 TDLR #: 40852 | office@clickplumbing.com | (512) 360-0599\nRegulated by the Texas State Board of Plumbing Examiners\n929 E 41st St, Austin, TX 78751 (512) 936-5200 https://tsbpe.texas.gov\nRegulated by the Texas Department of Licensing & Regulation.\n920 Colorado St, Austin, TX 78701 (512) 463-6599 tdlr.texas.gov"}}'),
	('stripe_invoice_footer_presets_v1', NULL, '{"plumbing":"Click Plumbing and Electrical\nReliable service today, innovative solutions for tomorrow.\nPh: 512-360-0599\n12925 FM 20 Kingsbury TX 78638\nMalachi Whites RMP M-41130 \nRegulated by the Texas State Board of Plumbing Examiners","electrical":"Click Plumbing and Electrical\nPh: 512-360-0599 | office@clickplumbing.com\n12925 FM 20 Kingsbury TX 78638\nPh: 512-360-0599 TECL#: 40694\nRegulated by the Texas Department of Licensing & Regulation.\n920 Colorado St, Austin, TX 78701\ntdlr.texas.gov 512-463-6599"}'),
	('physical_invoice_issuer_v1', NULL, '{"companyName":"Click Plumbing and Electrical","addressText":"5501 Balcones Dr A141\nAustin, TX 78731","phone":"(512) 360-0599","email":"office@clickplumbing.com","tagline":"Thank you for being our customer, we want to always be there when you need it!","licenseLine":""}'),
	('bill_customer_memo_presets_v1', NULL, '{"v":2,"builtinOverrides":{"standard":"Cheques can be sent to:\nClick Plumbing\n12925 FM 20\nKingsbury TX 78638","alternate":"Cheques can be sent to:\nClick Plumbing\n12925 FM 20\nKingsbury TX 78638\n\nWires and ACHs can be sent to:\nBeneficiary Name: Click Plumbing LLC\nAccount Number: 202511226605\nType of Account: Checking\nBeneficiary Address: 5501 Balcones Drive Ste A 141 Austin, TX 78731\nABA Routing Number: 091311229\nBank Name: Choice Financial Group\nBank Address: 4501 23rd Avenue S Fargo, ND 58104"},"builtinLabelOverrides":{"standard":"Check","alternate":"Wire"}}'),
	('quickfill_office_arriving_done', NULL, '{"3c7c2908-04b7-400d-89a5-1a3be1c74fda":true,"11063f3d-aa55-4ce3-8f5b-41cc70cf313e":true,"cb857165-5cad-4cb5-927d-965997b27aa8":true,"03bdd59a-8c49-45ce-a6fc-7b27a4bce9a9":true}'),
	('field_dispatch_phone_v1', NULL, '+15123600599'),
	('overhead_office_job_ledger_id_v1', NULL, 'e9c41b08-2774-4c97-8763-752a36d2dbd1');


--
-- Data for Name: service_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."service_types" ("id", "name", "description", "color", "sequence_order", "created_at", "updated_at", "ledger_job_prefix", "ledger_bid_prefix") VALUES
	('d53845ab-79ed-498b-88d1-d3a069cf2e73', 'Plumbing', 'Plumbing fixtures and materials', NULL, 1, '2026-02-10 16:45:27.518752+00', '2026-04-30 20:42:27.754432+00', 'JP', 'BP'),
	('6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Electrical', 'Electrical fixtures and materials', NULL, 2, '2026-02-10 16:45:27.518752+00', '2026-04-30 20:42:27.754432+00', 'JE', 'BE'),
	('21296f21-9b81-4487-9a09-8b5fb292585e', 'HVAC', 'Heating, ventilation, and air conditioning', NULL, 3, '2026-02-10 16:45:27.518752+00', '2026-04-30 20:42:27.754432+00', 'JH', 'BH');


--
-- Data for Name: assembly_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."assembly_types" ("id", "service_type_id", "name", "category", "sequence_order", "created_at", "updated_at") VALUES
	('da4f70c9-2337-463d-8836-75d8f9be4605', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Bathroom', NULL, 0, '2026-02-13 04:57:06.414984+00', '2026-02-13 04:57:06.414984+00'),
	('b787ba3a-4ca2-48e2-a868-25311787326b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Kitchen', NULL, 1, '2026-02-13 04:57:06.414984+00', '2026-02-13 04:57:06.414984+00'),
	('d0636fcf-a975-4ec7-b9a1-0be1cb867d3e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Utility', NULL, 2, '2026-02-13 04:57:06.414984+00', '2026-02-13 04:57:06.414984+00'),
	('a3aa82db-e13c-4e1f-b4db-b0d2df95d033', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Commercial', NULL, 3, '2026-02-13 04:57:06.414984+00', '2026-02-13 04:57:06.414984+00'),
	('bcdd7c69-f851-4b28-93c0-686dea25cd8f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Residential', NULL, 4, '2026-02-13 04:57:06.414984+00', '2026-02-13 04:57:06.414984+00'),
	('d302b730-0a0c-4077-a51d-b0b13bf06535', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Other', NULL, 5, '2026-02-13 04:57:06.414984+00', '2026-02-13 04:57:06.414984+00'),
	('d54374e0-9e79-488e-936b-66fda78d30f7', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Lights', NULL, 1, '2026-02-13 05:04:32.370774+00', '2026-02-13 05:04:32.370774+00'),
	('bacf4276-73cc-4465-9618-895610d0660d', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Gear', NULL, 2, '2026-02-13 05:04:36.945364+00', '2026-02-13 05:04:36.945364+00'),
	('5fae01d8-bc1f-4b4f-8e8f-c325c82bb300', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Wiring Devices', NULL, 10, '2026-02-13 20:54:10.864372+00', '2026-02-13 20:54:10.864372+00'),
	('65bca750-7097-4ff4-a628-f8da5db981d2', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Non Metalic Boxes', NULL, 9, '2026-02-13 20:54:05.084933+00', '2026-02-13 20:54:05.084933+00'),
	('061ee41b-c908-4d19-96ed-0b8438c34e2c', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Metal Boxes', NULL, 8, '2026-02-13 20:53:24.112102+00', '2026-02-13 20:53:24.112102+00'),
	('8b518a48-2043-4fad-a58e-86dedaf6b6a6', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Conduit Fittings', NULL, 7, '2026-02-13 15:16:26.055273+00', '2026-02-13 15:16:26.055273+00'),
	('fd6771de-31ba-434b-ab96-a2e95c0629e1', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Wire Nuts and Lugs', NULL, 5, '2026-02-13 15:16:18.062509+00', '2026-02-13 15:16:18.062509+00'),
	('ed235077-f9ab-46d6-8787-a6c2f929eea1', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Generators / Transfer Switches', NULL, 3, '2026-02-13 20:54:20.647476+00', '2026-02-13 20:54:20.647476+00'),
	('c57a3d85-936b-4599-a136-6a682af54881', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Wire Runs', NULL, 4, '2026-02-13 05:04:42.374986+00', '2026-02-13 05:04:42.374986+00'),
	('c2b312db-fa50-41d2-9d54-8d1a07c6e0ec', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Pumps', NULL, 6, '2026-02-13 22:44:46.657778+00', '2026-02-13 22:44:46.657778+00');


--
-- Data for Name: counts_fixture_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."counts_fixture_groups" ("id", "service_type_id", "label", "sequence_order", "created_at", "updated_at") VALUES
	('856e6c20-0394-4a4d-b9db-25bdc88a1248', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Bathrooms:', 1, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('8080f892-dfe1-4c3f-803c-5e7ae8c42488', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Kitchen:', 2, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('26dd52e5-5df4-42cf-9acf-d59e6ad3c968', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Laundry:', 3, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('cf329fe6-c200-486a-af3b-761b44f325bb', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Plumbing Fixtures:', 4, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('e1276ed3-bb3f-4715-9b7d-0f7b7f6ad7f1', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Appliances:', 5, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('8b4e7bce-55f2-4193-8e8b-32fc66ddc1be', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Gear:', 1, '2026-02-11 23:57:27.995562+00', '2026-02-11 23:57:27.995562+00'),
	('a1ac37be-e693-45c8-97db-80dc2297019b', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Wiring:', 2, '2026-02-11 23:57:34.393847+00', '2026-02-11 23:57:34.393847+00'),
	('51292d26-4afb-4994-87ad-d687e1a131db', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Lighting Packages:', 3, '2026-02-11 23:57:45.420372+00', '2026-02-11 23:57:45.420372+00'),
	('67670bc4-3749-4ea1-b973-84617ce21577', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Control Packages', 4, '2026-02-12 00:17:46.526325+00', '2026-02-12 00:17:46.526325+00'),
	('4440f6f1-2ea1-49df-95eb-b6db52d3b3f2', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Digging', 6, '2026-02-13 06:31:08.881694+00', '2026-02-13 06:31:08.881694+00');


--
-- Data for Name: counts_fixture_group_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."counts_fixture_group_items" ("id", "group_id", "name", "sequence_order", "created_at", "updated_at") VALUES
	('077ced14-f096-447a-80d6-029e96137ada', '856e6c20-0394-4a4d-b9db-25bdc88a1248', 'Toilets', 1, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('ff2ebca4-7819-424f-8ebb-3a3ae2a05cfb', '856e6c20-0394-4a4d-b9db-25bdc88a1248', 'Bathroom sinks', 2, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('3782b603-4a38-4770-8ed3-e3d061d13efc', '856e6c20-0394-4a4d-b9db-25bdc88a1248', 'Shower/tub combos', 3, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('418c940f-a635-4783-9f90-ff46b19305fa', '856e6c20-0394-4a4d-b9db-25bdc88a1248', 'Showers no tub', 4, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('3ba01193-b61d-48f6-9784-03edfd9ed4cb', '856e6c20-0394-4a4d-b9db-25bdc88a1248', 'Bathtubs', 5, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('1571d404-8f08-4c9e-852f-deb7ec3df12b', '856e6c20-0394-4a4d-b9db-25bdc88a1248', 'Urinals', 6, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('24ca752e-8fc4-447b-bb01-cfcc660d0c88', '8080f892-dfe1-4c3f-803c-5e7ae8c42488', 'Kitchen sinks', 1, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('78cf5f61-a3ca-43cb-b800-ed142c7941fa', '8080f892-dfe1-4c3f-803c-5e7ae8c42488', 'Garbage disposals', 2, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('8cae38d0-6810-4342-a33e-7bd51828732e', '8080f892-dfe1-4c3f-803c-5e7ae8c42488', 'Ice makers', 3, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('e28b90c9-5e29-480d-aaf0-b8358161601b', '8080f892-dfe1-4c3f-803c-5e7ae8c42488', 'Pot filler', 4, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('b23a30b1-23ad-46f9-bfd0-e8490679a8a4', '26dd52e5-5df4-42cf-9acf-d59e6ad3c968', 'Laundry sinks', 1, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('2a8c271f-05e7-4370-abc1-94c12c8c30da', '26dd52e5-5df4-42cf-9acf-d59e6ad3c968', 'Washing machine', 2, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('4bfdf1a5-79ae-4f12-833d-8d89e6a3c7a7', 'cf329fe6-c200-486a-af3b-761b44f325bb', 'Hose bibs', 1, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('6c121f2a-1067-462e-b757-2fb1f57df00f', 'cf329fe6-c200-486a-af3b-761b44f325bb', 'Water fountain', 2, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('c2ccaf99-5cc5-4da8-b1a9-b47dc1f2808a', 'cf329fe6-c200-486a-af3b-761b44f325bb', 'Gas drops', 3, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('37d59b2c-4f8a-44ef-9e62-abeb2aaaeb5c', 'cf329fe6-c200-486a-af3b-761b44f325bb', 'Floor drains', 4, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('53cbbd3f-cbe8-4e37-9030-d3e1daa1c13c', 'cf329fe6-c200-486a-af3b-761b44f325bb', 'Dog wash', 5, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('bb215d86-befa-47a4-a9ab-2cde4c0e544b', 'e1276ed3-bb3f-4715-9b7d-0f7b7f6ad7f1', 'Water heaters (gas)', 1, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('429005a0-4a0c-4bf0-bdbe-5f9f5d7b2e40', 'e1276ed3-bb3f-4715-9b7d-0f7b7f6ad7f1', 'Water heaters (electric)', 2, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('2da70750-18bf-4de6-8fb1-ec90be7c1331', 'e1276ed3-bb3f-4715-9b7d-0f7b7f6ad7f1', 'Water heaters (tankless)', 3, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('8adba03e-383a-4ec5-a30b-45089f15891d', 'e1276ed3-bb3f-4715-9b7d-0f7b7f6ad7f1', 'Water softener', 4, '2026-02-11 23:49:39.663212+00', '2026-02-11 23:49:39.663212+00'),
	('e65bfabc-4fa9-4c53-a9c2-dc077914a001', '8b4e7bce-55f2-4193-8e8b-32fc66ddc1be', 'Panel', 1, '2026-02-12 00:00:28.374217+00', '2026-02-12 00:00:28.374217+00'),
	('0bd34dcd-cade-4b6e-9ba6-393c2555e701', '8b4e7bce-55f2-4193-8e8b-32fc66ddc1be', 'Subpanel', 2, '2026-02-12 00:01:01.065416+00', '2026-02-12 00:01:01.065416+00'),
	('644d693b-1371-4719-8c65-43daca3212cc', '8b4e7bce-55f2-4193-8e8b-32fc66ddc1be', 'Transformer', 3, '2026-02-12 00:01:13.027928+00', '2026-02-12 00:01:13.027928+00'),
	('9ff552e0-3d87-47f6-8478-cdfddda339e3', '8b4e7bce-55f2-4193-8e8b-32fc66ddc1be', 'Fuse', 4, '2026-02-12 00:01:34.743552+00', '2026-02-12 00:01:34.743552+00'),
	('45b144d2-80f9-4652-af01-ab0a0b0347f3', 'a1ac37be-e693-45c8-97db-80dc2297019b', 'Wire', 1, '2026-02-12 00:16:48.733708+00', '2026-02-12 00:16:48.733708+00'),
	('26ae6b50-55d6-4259-ab5d-35b185d9134c', 'a1ac37be-e693-45c8-97db-80dc2297019b', 'Conduit', 2, '2026-02-12 00:16:56.600051+00', '2026-02-12 00:16:56.600051+00'),
	('f701c1c4-0f76-4516-972b-f2c60828373c', 'a1ac37be-e693-45c8-97db-80dc2297019b', 'Fittings', 3, '2026-02-12 00:17:02.960691+00', '2026-02-12 00:17:02.960691+00'),
	('65dcc9f7-baf3-47a9-bd58-06c171c3c1d9', '67670bc4-3749-4ea1-b973-84617ce21577', 'Switch', 2, '2026-02-12 00:18:18.488987+00', '2026-02-12 00:18:18.488987+00'),
	('70b92e39-1d19-49df-8b0d-20b961bb4930', '67670bc4-3749-4ea1-b973-84617ce21577', 'Dimmer', 3, '2026-02-12 00:18:22.964322+00', '2026-02-12 00:18:22.964322+00'),
	('2657c6e1-d60b-486e-916c-8d54c1506f4b', '51292d26-4afb-4994-87ad-d687e1a131db', 'Recessed Lights', 1, '2026-02-12 00:18:48.334804+00', '2026-02-12 00:18:48.334804+00'),
	('51415237-f1ad-4975-b25d-8f1e0c17d990', '51292d26-4afb-4994-87ad-d687e1a131db', 'Emergency Lights', 2, '2026-02-12 00:19:03.045706+00', '2026-02-12 00:19:03.045706+00'),
	('e2aa9ec3-3871-44ad-861d-a7cc33fcda14', '51292d26-4afb-4994-87ad-d687e1a131db', 'Exit Lights', 3, '2026-02-12 00:19:09.728754+00', '2026-02-12 00:19:09.728754+00'),
	('c6fc5170-2c36-43d3-9e29-fe457255cd4a', '67670bc4-3749-4ea1-b973-84617ce21577', 'Outlet', 1, '2026-02-12 00:18:13.254372+00', '2026-02-12 00:20:21.098252+00'),
	('f81b8fe3-313f-4415-8087-045aa04fb5e4', '4440f6f1-2ea1-49df-95eb-b6db52d3b3f2', 'feet of Trenching', 1, '2026-02-13 06:31:41.544007+00', '2026-02-13 06:31:41.544007+00'),
	('7a9e94ca-8dc3-4a25-9d98-0a023dae2d54', '4440f6f1-2ea1-49df-95eb-b6db52d3b3f2', 'square feet of Digging', 2, '2026-02-13 06:31:56.42118+00', '2026-02-13 06:31:56.42118+00');


--
-- Data for Name: fixture_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."fixture_types" ("id", "service_type_id", "name", "category", "sequence_order", "created_at", "updated_at") VALUES
	('9a4050f9-ddc9-44a9-93c0-811c36fb35c1', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Sink', 'Fixtures', 4, '2026-02-10 18:12:53.691344+00', '2026-02-10 18:12:53.691344+00'),
	('74966e1b-3cb4-46d1-af4c-70db2fad9917', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Faucet', 'Fixtures', 5, '2026-02-10 18:12:53.691344+00', '2026-02-10 18:12:53.691344+00'),
	('7f2b0f7b-5c90-4d8d-83af-7db8c0327743', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet', 'Fixtures', 6, '2026-02-10 18:12:53.691344+00', '2026-02-10 18:12:53.691344+00'),
	('799a66b8-9606-4a6b-9340-ee2207543914', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Kitchen sinks', 'Kitchen', 24, '2026-02-10 18:12:53.691344+00', '2026-02-10 18:12:53.691344+00'),
	('aeb14df7-9bc2-4a98-8e2b-9dec79a197ec', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hose bibs', 'Plumbing Fixtures', 30, '2026-02-10 18:12:53.691344+00', '2026-02-10 18:12:53.691344+00'),
	('01ec5885-f4d1-42a3-aa13-277b9a149f43', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'ADDER FOR FREESTANDING TUB', 'Other', 40, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('ea0d9b71-88d4-4680-b0b7-e4dca49d0131', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Bath tub and valve', 'Labor', 41, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('81248e08-8d53-4923-8aa0-672a435a7f65', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Garbage Disposal', 'Labor', 41, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('a90ea853-8aab-4dea-ac0e-c7e90cb8b3ea', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Gas drop', 'Labor', 41, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('d3118ea8-0181-4476-85cf-9d5079a03018', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hose bib', 'Labor', 41, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('9db14a09-6c05-4555-b805-2308821da54e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Shower no tub', 'Labor', 41, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('0ca1245a-ed51-46b3-b2a8-43796953f579', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Tankless Water Heater', 'Labor', 41, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('8b277aab-0510-4f49-b5e5-0fa41ef09018', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water heater (electric)', 'Labor', 41, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('59f3dbc2-2d14-4034-9161-af0bb9074241', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water heater (gas)', 'Labor', 41, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('e76ce7ae-790b-4b48-b873-739d3dc6192b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'SHOWER CUSTOMER SUPPLIES SHOWER PAN AND VALVE', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('e0d95051-b1b6-4680-8f30-5e9e978969a1', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Shower tub combo (no wall kit included)- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('2500e66a-c2f1-4ecd-bbb3-dd9c5f5d4a20', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Fountain- Commerial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('af62a85f-7feb-42ae-9765-07c4b0475a4b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Laundry sink (no sink or faucet included)- Reisdential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('c43a28f7-5d71-4df3-a78d-e249def82224', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Feet of Trenching Dirt - Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('8db0cfd6-0a8b-4cbd-907f-3c77f51fd4f5', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Kitchen Sink- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('993d8a34-0388-4631-9b16-7250ddb01737', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater (gas) 50 gal- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('3a9e14cd-06be-412c-8204-10ad8b5123a0', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Showers no tub- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('32b33294-a8e8-4f47-ae7e-f38ebdfa92ad', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'lav sink no fixture', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('8a3b8d97-13ef-4542-9071-4ee9e8a9a445', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'SHOWER CUSTOMER SUPPLIED TUB AND VALVE/TRIM', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('c97bcbc3-42bf-4a4e-973e-9ebc2d145f8b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'ice maker connection', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('6cae7aac-2b9a-4ff6-911b-1243189e83aa', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'WATER SOFTENER PRE PLUMB', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('288d509e-73eb-43ca-8308-2185f1207b52', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Showers no tub- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('8e9bf7fd-7044-47e8-8203-7e379ea5011e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Urinal and Valve', NULL, 41, '2026-02-10 18:13:15.788321+00', '2026-02-12 03:58:40.297248+00'),
	('e2a3958d-95de-4bef-b474-f395005e48f8', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Fountain', NULL, 31, '2026-02-10 18:12:53.691344+00', '2026-02-12 03:58:45.602599+00'),
	('a9947f0e-074e-423f-9d00-37ed58615226', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet - Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('3fc0c83d-ee62-4471-bfd8-e1cea8f38a3c', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Tankless Water Heater (gas)- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('b79c754b-4b00-4f7d-b1ce-886a2545af94', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet - Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('82303fc8-20bf-4eae-b39d-6ec1e215ad16', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'WASHING MACHINE', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('6331aa79-122b-4f41-814a-fe76695fa1e0', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Garbage Disposal- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('7fc8f8e7-9ec7-4bee-a86a-009d1ffc9e2b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Laundry sink (no sink or faucet included)- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('c9acb92e-efac-40fa-b2dc-0406a84c1471', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Feet of 24-36in of trenching', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('a4a825b0-aacd-4d17-aa62-edbdb352e349', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '63k', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('8dda9eae-2ca4-4e4f-a834-cd42666fb50a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Gas Drops- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('b4c3f575-ddc3-46d5-b37b-e979a183109a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Bath tub & Valve- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('77ae8aa5-2577-4772-b59c-1df404d06074', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Bathroom Sink- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('67e6a2b1-5034-4da5-a08d-4a51748d7296', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hose Bib- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('5a40ddc4-36bb-4cc8-a8a2-8d129ec04fa9', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'feet of water line', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('6b840c14-28d9-42c5-8cc0-bc7d352c342c', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Shower tub combo (no wall kit included)- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('c5dc4b84-1bb4-4b55-9ba2-478356dd276d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Bathroom Sink - Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('30df1812-fd91-4cab-bf4e-f4825ce5287e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Tankless Water Heater (gas)- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('1b21c69f-b510-4d9e-80ce-56c59f8376af', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'GRINDER PUMP AND CONNECTION', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('12678aee-9c69-4597-a9a9-a26b2037c8e3', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'feet of sewer line', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('1eb28b6a-543b-4091-b172-36d5ad4dee87', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Gas Drops- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('682127fe-59fb-4cf3-9542-099c52619aa1', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater (electric) 52 gal- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('c3ebf76c-ac3e-4d37-82f9-b336c64b7823', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater (gas) 50 gal- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('b2f543e3-90bb-4142-b9c1-fa376015a42a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet | Floor Mount - Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('b83afd97-20fc-48c6-8c12-51c6c9b2959e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'KICHEN SINK NO SINK OR FAUCET DISPOSAL', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('818a82b8-315a-420c-aca2-926ce6e690ea', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater (electric) 52 gal- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('8550dab1-e976-4788-844d-e590ec03e80a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'tub/shower combo no tub included', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('cebd4923-97d7-4b26-81e9-758eb2f18941', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Bath tub & Valve- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('6621b72d-8bf4-4c33-b06c-ce92e3cc5989', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'toilet no fixtures', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('abfffdbb-80a3-4815-ae8f-cb4942beb9cb', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Fountain- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('c431a003-02e5-4986-9a0e-5aa92dc1e1ed', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Kitchen Sink- Residential', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('47dbb72c-6aff-448d-8607-5bcd934053f2', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hose Bib- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('d1f9ec56-e42e-461e-8333-d40ef5fa00fc', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet - Commercial Turnkey', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('bc9fab89-ef90-4699-abc6-ee3ad59b62aa', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Garbage Disposal- Commercial', 'Pricing', 42, '2026-02-10 18:13:15.788321+00', '2026-02-10 18:13:15.788321+00'),
	('e973560a-a317-48a8-8e77-0d19646e7c74', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '16.2K', 'Other', 43, '2026-02-11 01:50:29.444421+00', '2026-02-11 01:50:29.444421+00'),
	('967dd9c5-2578-489b-a7ee-7adeacd6fd7d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '10.8K', 'Other', 44, '2026-02-11 01:54:54.398271+00', '2026-02-11 01:54:54.398271+00'),
	('1fc116cc-2244-4520-b326-2ca158f3bc6d', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', '38k', 'Other', 1, '2026-02-11 17:21:11.431045+00', '2026-02-11 17:21:11.431045+00'),
	('9f1f8dd4-e100-4bd0-ae6d-affcfa4ab870', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'light fixture install', 'Other', 2, '2026-02-11 17:21:45.606196+00', '2026-02-11 17:21:45.606196+00'),
	('321e69da-647d-4b1c-a57e-67cef8691972', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'light fixture', 'Other', 3, '2026-02-11 17:22:30.527181+00', '2026-02-11 17:22:30.527181+00'),
	('9bc6ed7b-a010-442e-b16e-19ded9c75fb3', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'feet of 12thhn', 'Other', 4, '2026-02-11 17:23:22.473162+00', '2026-02-11 17:23:22.473162+00'),
	('2d4fc6a9-f722-415c-b495-6cc935b5a748', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', '1200a Transformer', 'Other', 5, '2026-02-11 18:03:01.315107+00', '2026-02-11 18:03:01.315107+00'),
	('c8ad0af0-cb76-4f8e-96a1-ced6bdd6d5d4', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'led lights', 'Other', 6, '2026-02-11 18:05:51.23639+00', '2026-02-11 18:05:51.23639+00'),
	('7b463bfd-fca1-4716-aae4-747a0392ada4', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Urinal & Valve - Commercial', NULL, 42, '2026-02-10 18:13:15.788321+00', '2026-02-12 03:58:29.934282+00'),
	('55d2ee9c-5754-4c82-be02-841663b51126', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Urinal & Valve - Residential', NULL, 42, '2026-02-10 18:13:15.788321+00', '2026-02-12 03:58:35.135947+00'),
	('0230a36c-579b-4c2c-9fa4-b051436ca8a2', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'subpanel', 'Other', 7, '2026-02-12 23:42:17.456946+00', '2026-02-12 23:42:17.456946+00'),
	('73ec7383-3599-4e43-a620-e541122ace94', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', '1g outlet', 'Other', 8, '2026-02-12 23:42:56.139663+00', '2026-02-12 23:42:56.139663+00'),
	('fd8186e3-f701-4b40-8dff-1308b4e1ddcd', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', '2x2 lights', 'Other', 9, '2026-02-13 00:17:54.338737+00', '2026-02-13 00:17:54.338737+00'),
	('6f38e2f3-7adb-48e4-ae70-bdedf0de514a', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'lights', 'Other', 10, '2026-02-13 06:40:01.203732+00', '2026-02-13 06:40:01.203732+00'),
	('eb80f03d-2506-4968-b89c-bd8aab3dd0d7', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'wc repair', 'Other', 45, '2026-02-16 17:36:06.539077+00', '2026-02-16 17:36:06.539077+00'),
	('c1a977b7-ff79-45bf-aaa6-725ba5285dc8', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Floor Drain', 'Other', 46, '2026-03-06 23:56:47.305712+00', '2026-03-06 23:56:47.305712+00'),
	('b1f741ec-3822-4165-9bf6-76ff972ec5ae', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet - Commercial (WC W/C)', 'Other', 47, '2026-03-07 00:20:06.884531+00', '2026-03-07 00:20:06.884531+00'),
	('1913c604-7af4-4760-9a3c-ad11a8916ef3', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet - Residential (WC W/C)', 'Other', 48, '2026-03-07 00:20:42.31324+00', '2026-03-07 00:20:42.31324+00'),
	('076a017d-7570-4afb-b647-a45768e64d14', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Tankless Water Heater (gas)- Commercial (WH)', 'Other', 49, '2026-03-07 00:21:33.230706+00', '2026-03-07 00:21:33.230706+00'),
	('b2c5654b-7c15-4e9b-a1cf-b3fdcf7cbc97', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Tankless Water Heater (gas)- Residential (WH)', 'Other', 50, '2026-03-07 00:21:46.978034+00', '2026-03-07 00:21:46.978034+00'),
	('d04340b0-07b1-457a-ba29-ddc96a857863', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater (electric) 52 gal- Commercial (WH)', 'Other', 51, '2026-03-07 00:21:54.311504+00', '2026-03-07 00:21:54.311504+00'),
	('a0c58ba1-98b7-4562-8e21-cedee30765b3', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater (electric) 52 gal- Residential (WH)', 'Other', 52, '2026-03-07 00:22:00.288278+00', '2026-03-07 00:22:00.288278+00'),
	('c172d753-c9e4-46f1-a8b0-bd8b7080021a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater (gas) 50 gal- Commercial (WH)', 'Other', 53, '2026-03-07 00:22:05.139274+00', '2026-03-07 00:22:05.139274+00'),
	('02461490-9e55-40f0-b9c9-cfbc64b0575b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater (gas) 50 gal- Residential (WH)', 'Other', 54, '2026-03-07 00:22:09.276583+00', '2026-03-07 00:22:09.276583+00'),
	('19b101d5-41fb-4086-b10d-cbf71f3b18cb', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hose Bib- Commercial (HB)', 'Other', 55, '2026-03-07 00:22:30.323064+00', '2026-03-07 00:22:30.323064+00'),
	('be3f5e60-d7c9-48ef-a364-104bcd23ffeb', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hose Bib- Residential (HB)', 'Other', 56, '2026-03-07 00:22:36.805496+00', '2026-03-07 00:22:36.805496+00'),
	('614a60fc-c60e-499b-aa36-a147143efdcd', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Air Conditioning Drip Line -Commercial', 'Other', 57, '2026-03-07 00:24:10.314016+00', '2026-03-07 00:24:10.314016+00'),
	('11051ed6-b638-4ab2-a510-2e1f1383cc1d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Air Conditioning Drip Line -Commercial (A/C AC)', 'Other', 58, '2026-03-07 00:25:18.300791+00', '2026-03-07 00:25:18.300791+00'),
	('a78c6fdd-8cb0-4369-8dc2-9030c76c6aae', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Dish Washer', 'Other', 59, '2026-03-07 00:26:16.192824+00', '2026-03-07 00:26:16.192824+00'),
	('e3ef0249-0d71-4eaa-a1f5-712f0186de8f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'WATER SOFTENER\', 'Other', 60, '2026-03-07 02:17:26.111334+00', '2026-03-07 02:17:26.111334+00'),
	('e383c1db-603a-49fa-a88f-ec3b7074495a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Custom', 'Other', 61, '2026-03-07 02:18:17.970034+00', '2026-03-07 02:18:17.970034+00'),
	('974eda3a-2be3-4e49-8322-db166b1e0661', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'ADDER FOR FREESTANDING TUB | Expert', 'Other', 62, '2026-03-10 20:01:41.5279+00', '2026-03-10 20:01:41.5279+00'),
	('a90724f2-4fca-4e0e-91ed-12b0585e591d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'ADDER FOR FREESTANDING TUB | Expert Install', 'Other', 63, '2026-03-10 20:01:55.809718+00', '2026-03-10 20:01:55.809718+00'),
	('b3307d00-2705-468e-a98c-370d478b293b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'ADDER FOR FREESTANDING TUB | Intermediate Install', 'Other', 64, '2026-03-10 20:02:24.365792+00', '2026-03-10 20:02:24.365792+00'),
	('4dd0b14d-70df-49c2-8f5f-0e06b0aacf86', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Fixture', 'Other', 65, '2026-03-11 19:43:50.137867+00', '2026-03-11 19:43:50.137867+00'),
	('021df313-2df0-4ac3-bb9c-6af80cd0f9ca', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Extra Valves', 'Other', 66, '2026-03-11 19:45:00.339136+00', '2026-03-11 19:45:00.339136+00'),
	('a10cdc57-86bb-4831-8c7a-cbf5e530b2c3', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Softener Loop', 'Other', 67, '2026-03-11 19:46:10.211093+00', '2026-03-11 19:46:10.211093+00'),
	('1f1e357c-cd54-428b-ae9b-3f1f80e75058', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Ice Maker', 'Other', 68, '2026-03-11 19:47:57.684243+00', '2026-03-11 19:47:57.684243+00'),
	('4712a415-de02-4658-8e38-29bf34b6e605', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Wall Mount Pot Filler', 'Other', 69, '2026-03-11 19:50:36.232195+00', '2026-03-11 19:50:36.232195+00'),
	('29b99e7e-7f99-421a-b8c9-cd76e5500952', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'feet of water line 1 1/4', 'Other', 70, '2026-03-11 20:06:00.06333+00', '2026-03-11 20:06:00.06333+00'),
	('f95255af-bbe3-4102-ad47-ec7236ac7ff5', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Master Valve and Pressure Regulator Valve (PRV)', 'Other', 71, '2026-03-11 20:08:43.481905+00', '2026-03-11 20:08:43.481905+00'),
	('b865e329-c865-4076-ba16-39002cf07553', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Acorn sink 2200.00', 'Other', 72, '2026-03-11 20:21:15.179786+00', '2026-03-11 20:21:15.179786+00'),
	('49422fcf-f5c4-41e4-a77d-697e1ff8d968', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'acorn', 'Other', 73, '2026-03-11 20:29:24.06565+00', '2026-03-11 20:29:24.06565+00'),
	('7862aa2d-1c25-4426-aeb4-1a47e30e1b40', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Acorn toilet', 'Other', 74, '2026-03-11 20:30:57.318477+00', '2026-03-11 20:30:57.318477+00'),
	('7912e4cb-0162-430d-a24f-baf5e4023815', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'acorn urinal', 'Other', 75, '2026-03-11 20:31:43.892307+00', '2026-03-11 20:31:43.892307+00'),
	('b8f824c5-03d0-4e29-99db-8c9c4a077bff', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'acorn sink', 'Other', 76, '2026-03-11 20:32:13.618685+00', '2026-03-11 20:32:13.618685+00'),
	('32e554ef-477d-4e7c-a19a-31b24352d5b0', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'urinal wax', 'Other', 77, '2026-03-11 20:32:54.332353+00', '2026-03-11 20:32:54.332353+00'),
	('cd67f358-6227-42f6-b7e5-b5c2dcaec3c2', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'toilet wax ring', 'Other', 78, '2026-03-11 20:33:19.669159+00', '2026-03-11 20:33:19.669159+00'),
	('f3971753-eb3f-4fd7-9e10-edd24e23a826', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'toilet bolt set', 'Other', 79, '2026-03-11 20:33:40.444395+00', '2026-03-11 20:33:40.444395+00'),
	('afdfeecb-292b-4688-b12a-278bad17e900', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1.5 p-trap', 'Other', 80, '2026-03-11 20:34:09.98318+00', '2026-03-11 20:34:09.98318+00'),
	('0ff12f5b-5cee-416c-9b1d-84b5d1d694f8', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1.5 extension tubular', 'Other', 81, '2026-03-11 20:34:36.561385+00', '2026-03-11 20:34:36.561385+00'),
	('21812fed-622b-499e-a23f-443f365034cb', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1/2x3/8 stop', 'Other', 82, '2026-03-11 20:35:21.159952+00', '2026-03-11 20:35:21.159952+00'),
	('4411fa9b-7064-4fbc-b912-65c82cc41436', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'sloan toilet valve', 'Other', 83, '2026-03-11 20:35:43.508254+00', '2026-03-11 20:35:43.508254+00'),
	('9f6fde52-ee4a-4774-b62c-1fe97456f78c', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'sloan urinal valve', 'Other', 84, '2026-03-11 20:36:06.433482+00', '2026-03-11 20:36:06.433482+00'),
	('73f0aa51-af39-4f1c-b24f-6f3f9260d2c4', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1/2 oscussion', 'Other', 85, '2026-03-11 20:36:44.029514+00', '2026-03-11 20:36:44.029514+00'),
	('13bfca39-24bf-452f-9c1a-ede102b511c6', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1.5 oscussion', 'Other', 86, '2026-03-11 20:37:02.923541+00', '2026-03-11 20:37:02.923541+00'),
	('1861cd53-1bab-463f-9c22-f65d55edee63', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'knee protectors', 'Other', 87, '2026-03-11 20:37:28.039533+00', '2026-03-11 20:37:28.039533+00'),
	('92ae8863-e0a1-43d9-a5e3-5864cabb6efb', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'AAA Hammer Arrestors', 'Other', 88, '2026-03-11 20:38:09.985899+00', '2026-03-11 20:38:09.985899+00'),
	('82f8dd3a-4f4b-45c3-bb4c-b6456cadd422', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Mixing Valve 3/8 Undersink', 'Other', 89, '2026-03-11 20:38:56.569561+00', '2026-03-11 20:38:56.569561+00'),
	('b500eff7-d3f5-45a2-8aa8-74dbf3a74da5', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '42" Grab bars', 'Other', 90, '2026-03-11 20:39:22.629436+00', '2026-03-11 20:39:22.629436+00'),
	('3faf68ff-4a8c-4c1c-a945-0d610ffb9200', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3/4" backflow RPZ', 'Other', 91, '2026-03-11 20:39:52.192055+00', '2026-03-11 20:39:52.192055+00'),
	('458fa953-873f-4b2d-bcda-2df015652098', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Lavatory flex 1/2x3/8', 'Other', 92, '2026-03-11 20:40:26.66474+00', '2026-03-11 20:40:26.66474+00'),
	('10147122-c76b-45f2-a532-40fbb351fed3', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3/8x3/8x1" braided supply line', 'Other', 93, '2026-03-11 20:41:18.736828+00', '2026-03-11 20:41:18.736828+00'),
	('4ec1f71e-5720-40ed-9d9a-066b5fde13d4', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1.5 tubular extension', 'Other', 94, '2026-03-11 20:42:06.885751+00', '2026-03-11 20:42:06.885751+00'),
	('7edfb1f3-64ce-4bb9-9700-43a61acea1c0', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'water fountain duel level', 'Other', 95, '2026-03-11 20:44:02.505908+00', '2026-03-11 20:44:02.505908+00'),
	('423b2c7b-b95c-4583-b861-53171633988f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Labor', 'Other', 96, '2026-03-11 20:47:13.98755+00', '2026-03-11 20:47:13.98755+00'),
	('2762c014-32a3-4a90-877e-a36bd6d44714', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hotel cost', 'Other', 97, '2026-03-11 20:47:56.165823+00', '2026-03-11 20:47:56.165823+00'),
	('b8c8519a-7d3b-417a-98d5-119a9fc76caf', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'gas/travel per day diesel 4.50 gallon', 'Other', 98, '2026-03-11 20:49:03.553984+00', '2026-03-11 20:49:03.553984+00'),
	('3832f3e6-304b-4e36-a845-d86b86ab729a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'permit fee', 'Other', 99, '2026-03-11 20:49:41.924435+00', '2026-03-11 20:49:41.924435+00'),
	('cad7a493-8570-4d04-b053-26de47cbbd93', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'master and helper 375.00 hr', 'Other', 100, '2026-03-11 20:56:04.642206+00', '2026-03-11 20:56:04.642206+00'),
	('0611a7d6-cb92-4ccf-b206-04bf62bc466d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'gas charge/ travel', 'Other', 101, '2026-03-11 20:56:33.691701+00', '2026-03-11 20:56:33.691701+00'),
	('00f0fd88-b88f-44ca-b470-7220f4b7ac35', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'hotel charge', 'Other', 102, '2026-03-11 20:57:05.85842+00', '2026-03-11 20:57:05.85842+00'),
	('735fe3f9-8d86-4905-8952-7ba7f10a76ab', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Acorn R2141 toilet', 'Other', 103, '2026-03-11 21:11:33.565895+00', '2026-03-11 21:11:33.565895+00'),
	('fddde7f7-46c9-46b5-a797-2fa038607b29', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Acorn  R2141 Urinal', 'Other', 104, '2026-03-11 21:12:16.456241+00', '2026-03-11 21:12:16.456241+00'),
	('e86a0b3f-ea1e-4a88-b3e2-58a5975c16dd', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Acorn  1652 LRB sink', 'Other', 105, '2026-03-11 21:15:13.477349+00', '2026-03-11 21:15:13.477349+00'),
	('f2ee5747-8b4d-48bd-90ad-025d1b0a4d43', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Acorn 2141 toilet', 'Other', 106, '2026-03-11 21:17:31.822189+00', '2026-03-11 21:17:31.822189+00'),
	('3378e328-686c-440c-b59b-213fa5c5889b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet Trace', 'Other', 107, '2026-03-13 13:24:56.310251+00', '2026-03-13 13:24:56.310251+00'),
	('2ed5de5f-9046-41af-ae25-a65bf0418673', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet Malachi', 'Other', 108, '2026-03-13 13:25:14.492966+00', '2026-03-13 13:25:14.492966+00'),
	('6fe80133-847f-424f-bb47-b88aa522012f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Faucet Trace', 'Other', 109, '2026-03-13 13:25:33.799601+00', '2026-03-13 13:25:33.799601+00'),
	('4e1cd8ad-fdb2-435e-a9f5-af4687f7c57a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Faucet Malachi', 'Other', 110, '2026-03-13 13:27:01.532735+00', '2026-03-13 13:27:01.532735+00'),
	('b95d6c6b-514b-4871-8713-3103ac4fb9d4', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater Malachi', 'Other', 111, '2026-03-13 13:27:37.138379+00', '2026-03-13 13:27:37.138379+00'),
	('5e61e968-092c-4dca-9887-c5648cde29a3', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater Trace', 'Other', 112, '2026-03-13 13:27:49.189883+00', '2026-03-13 13:27:49.189883+00'),
	('8bd4c4d9-4ea2-4d57-abf2-aea98a85d183', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Tankless Water Heater Malachi', 'Other', 113, '2026-03-13 13:28:08.252132+00', '2026-03-13 13:28:08.252132+00'),
	('8ac34010-ee28-4a0c-88a4-8b6243133a4e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Tankless Water Heater Trace', 'Other', 114, '2026-03-13 13:28:28.510709+00', '2026-03-13 13:28:28.510709+00'),
	('27fa66e7-3894-4c9c-ab3a-84f847028e6b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Washing Machine Trace', 'Other', 115, '2026-03-13 13:28:54.448821+00', '2026-03-13 13:28:54.448821+00'),
	('c323e2bc-46ad-49ee-bfb3-2307d6d8fe10', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Washing Machine Malachi', 'Other', 116, '2026-03-13 13:29:12.617577+00', '2026-03-13 13:29:12.617577+00'),
	('94225180-795c-455c-91bc-ecc5d57c5414', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Shower Malachi', 'Other', 117, '2026-03-13 13:29:38.392921+00', '2026-03-13 13:29:38.392921+00'),
	('b1bc6b32-bd46-46da-935a-3759d9afbca4', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Shower Trace', 'Other', 118, '2026-03-13 13:30:13.087153+00', '2026-03-13 13:30:13.087153+00'),
	('75c2cf07-7a75-4ef5-9db9-8db4b1f81015', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Freestanding Tub Adder Trace', 'Other', 119, '2026-03-13 13:30:36.316144+00', '2026-03-13 13:30:36.316144+00'),
	('167235e8-8439-46b6-b389-2f24fdfffce8', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Freestanding Tub Adder Malachi', 'Other', 120, '2026-03-13 13:30:55.498954+00', '2026-03-13 13:30:55.498954+00'),
	('35ca0ebb-0c13-486d-ae7f-a19e74a04858', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Softener Loop Trace', 'Other', 121, '2026-03-13 13:31:48.199872+00', '2026-03-13 13:31:48.199872+00'),
	('b1e8fc83-d224-47b5-91f0-67b2d2af38e9', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hose Bib Malachi', 'Other', 122, '2026-03-13 13:33:15.103441+00', '2026-03-13 13:33:15.103441+00'),
	('35e12029-fbf4-418e-98ee-7b4943985f71', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hose Bib Trace', 'Other', 123, '2026-03-13 13:33:37.44844+00', '2026-03-13 13:33:37.44844+00'),
	('a2f19f68-03a0-4b8a-99be-3f29963c318a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Floor Drain Trace', 'Other', 124, '2026-03-13 13:34:18.518384+00', '2026-03-13 13:34:18.518384+00'),
	('ad30a487-a247-44b5-8a4f-fa5bc9958987', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Floor Drain Malachi', 'Other', 125, '2026-03-13 13:34:33.128584+00', '2026-03-13 13:34:33.128584+00'),
	('f0493969-9f3c-458a-a759-98cbe6ba042e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'IM Malachi', 'Other', 126, '2026-03-13 13:35:22.796624+00', '2026-03-13 13:35:22.796624+00'),
	('10a883d5-88f9-43d4-b7fb-aac990264b63', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'IM Trace', 'Other', 127, '2026-03-13 13:35:38.496063+00', '2026-03-13 13:35:38.496063+00'),
	('5058f24a-837b-4e6a-993e-f5fbefe8584a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Additional Valve Trace', 'Other', 128, '2026-03-13 13:36:21.364614+00', '2026-03-13 13:36:21.364614+00'),
	('28dc46a1-5034-4097-a964-ae87a1fda941', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Additional Valve Malachi', 'Other', 129, '2026-03-13 13:36:34.997354+00', '2026-03-13 13:36:34.997354+00'),
	('0a2a43d5-3325-456c-91e6-1aa91610b95f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Wall Mount Pot Filler Trace', 'Other', 130, '2026-03-13 13:36:56.286153+00', '2026-03-13 13:36:56.286153+00'),
	('0b45a2d6-e59a-4e19-8f19-de2d3a12c5f5', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Gas Drop Trace', 'Other', 131, '2026-03-13 13:37:14.479716+00', '2026-03-13 13:37:14.479716+00'),
	('d62b4652-eaf8-4dbc-8865-1e913f233c80', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Gas Drop Malachi', 'Other', 132, '2026-03-13 13:37:26.677105+00', '2026-03-13 13:37:26.677105+00'),
	('f072b7a8-2c3d-422d-9565-702c36cdba12', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Ft of Trenching Trace', 'Other', 133, '2026-03-13 13:38:31.285254+00', '2026-03-13 13:38:31.285254+00'),
	('8998670f-b3cd-47f3-8817-266b3df6466e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Ft of Water Line', 'Other', 134, '2026-03-13 13:38:47.438157+00', '2026-03-13 13:38:47.438157+00'),
	('c7859cf2-6a27-491d-a284-49f00879d43d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Meter Valve and PRV Trace', 'Other', 135, '2026-03-13 13:39:06.580905+00', '2026-03-13 13:39:06.580905+00'),
	('5527164c-dd9f-4109-96ca-45d0757c6c1a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/2 x1 1/2x1 1/2 PPEX Tee', 'Other', 136, '2026-03-24 19:42:07.551788+00', '2026-03-24 19:42:07.551788+00'),
	('06b9f042-9688-43eb-aff7-c4ccea156791', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/2 x1 1/2x1 1/2 PEX Tee', 'Other', 137, '2026-03-24 19:42:24.572284+00', '2026-03-24 19:42:24.572284+00'),
	('2b111964-49af-4991-be3b-dfa1b1692d8d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Gas Manifold', 'Other', 138, '2026-03-25 14:26:48.606642+00', '2026-03-25 14:26:48.606642+00'),
	('4ec022c8-b5d9-475a-8c3f-1c972b8acf96', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Gas Regulator', 'Other', 139, '2026-03-25 14:32:31.841586+00', '2026-03-25 14:32:31.841586+00'),
	('6e9af10b-552f-44c9-b68e-8afd3e1937fa', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Hub Drain', 'Other', 140, '2026-03-25 16:07:15.597139+00', '2026-03-25 16:07:15.597139+00'),
	('e45e7e8a-e238-4e13-a4e5-b4b9e6f5428f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Mirror BOBRICK B-1556', 'Other', 141, '2026-03-30 18:46:43.872985+00', '2026-03-30 18:46:43.872985+00'),
	('be06b410-7f99-4c04-a8a4-b51911cca811', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Soap Dispenser BOBRICK B-2111', 'Other', 142, '2026-03-30 19:02:32.243843+00', '2026-03-30 19:02:32.243843+00'),
	('1cb2de78-dba8-47c1-a33a-641eb188838e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Automatic Hand Dryer BOBRICK B-715', 'Other', 143, '2026-03-30 19:04:15.669027+00', '2026-03-30 19:04:15.669027+00'),
	('a5742f51-4bc3-4db7-9265-2ba97e9b35f9', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet Paper Dispenser GEORGIA PACIFIC 59009', 'Other', 144, '2026-03-30 19:06:41.369343+00', '2026-03-30 19:06:41.369343+00'),
	('4723adc8-157e-41f4-a540-acdeba7f598c', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Grab Bar Bobrick B-6806.99×36', 'Other', 145, '2026-03-30 19:10:47.853292+00', '2026-03-30 19:10:47.853292+00'),
	('f898c1cd-80a3-4eb7-9b8d-18ed6e8ae714', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Grab Bar Bobrick B-6806.99×42', 'Other', 146, '2026-03-30 19:11:26.138545+00', '2026-03-30 19:11:26.138545+00'),
	('3f6baa33-4c74-4419-9132-1bc34580ce1b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Roll Paper Towel Dispenser BOBRICK B-72860', 'Other', 147, '2026-03-30 19:12:29.85812+00', '2026-03-30 19:12:29.85812+00'),
	('217002cd-b13a-4406-a0b7-1606bc9b4237', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Paper Towel & Waste Combo BOBRICK B-3944', 'Other', 148, '2026-03-30 19:23:23.757492+00', '2026-03-30 19:23:23.757492+00'),
	('5131d7f7-7bd4-49c8-bddf-60645f1d6795', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Well', 'Other', 149, '2026-04-06 13:58:53.259165+00', '2026-04-06 13:58:53.259165+00'),
	('96bd8725-1355-4760-b1d6-394da927ffa7', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Coffe Brewer connection', 'Other', 150, '2026-04-08 14:22:46.224631+00', '2026-04-08 14:22:46.224631+00'),
	('caf12516-0a8f-443c-b4fd-58b6cb554d4a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1/2" Backflow Preventer', 'Other', 151, '2026-04-08 18:33:54.414023+00', '2026-04-08 18:33:54.414023+00'),
	('6d241d5d-2d83-4a48-9eae-a6f10b19bb45', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4" Backflow Preventer', 'Other', 152, '2026-04-08 18:34:23.462489+00', '2026-04-08 18:34:23.462489+00'),
	('3ddec80f-b0fc-43f3-a458-1d2531f28b49', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '8" Schedule 80', 'Other', 153, '2026-04-09 19:27:23.828501+00', '2026-04-09 19:27:23.828501+00'),
	('e88b286e-665a-4130-b783-3d87703a5eda', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '6" Schedule 80', 'Other', 154, '2026-04-09 19:29:49.909564+00', '2026-04-09 19:29:49.909564+00'),
	('a7a07b0c-a816-4bbf-ba03-3a2cfb44cb62', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4" Schedule 80', 'Other', 155, '2026-04-09 19:31:48.339935+00', '2026-04-09 19:31:48.339935+00'),
	('57d7f9ef-dbf0-4e2d-938d-1e4abae3d8ad', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3" Schedule 80', 'Other', 156, '2026-04-09 19:33:40.038897+00', '2026-04-09 19:33:40.038897+00'),
	('fd2a472b-5e35-4b8f-b26c-aea05d5b87c9', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2" Schedule 80', 'Other', 157, '2026-04-09 19:34:57.187347+00', '2026-04-09 19:34:57.187347+00'),
	('a7b6e29d-6d85-4cdf-ab42-3b2e8571bc00', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/2" Schedule 80', 'Other', 158, '2026-04-09 19:37:36.444697+00', '2026-04-09 19:37:36.444697+00'),
	('816af841-1bac-40e5-8552-4a49394f8afe', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Floor Clean Out', 'Other', 159, '2026-04-13 19:04:22.859737+00', '2026-04-13 19:04:22.859737+00'),
	('6325fae1-0204-45a4-8c50-3ed2d2d05315', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Wall Clean Out', 'Other', 160, '2026-04-13 19:04:38.502789+00', '2026-04-13 19:04:38.502789+00'),
	('38979783-0690-4f23-a618-b80d9273bd50', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Wall Clean Out (WCO)', 'Other', 161, '2026-04-13 19:05:02.610742+00', '2026-04-13 19:05:02.610742+00'),
	('72c1ca61-e198-4c9b-ae03-9bfce32f8b13', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Floor Clean Out (FCO)', 'Other', 162, '2026-04-13 19:05:16.734353+00', '2026-04-13 19:05:16.734353+00'),
	('a8f64ace-98d6-46db-9ea1-138917662332', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2 Way Clean Out', 'Other', 163, '2026-04-13 19:05:35.648541+00', '2026-04-13 19:05:35.648541+00'),
	('79220917-e531-405b-9494-effb689fc371', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'feet of 3/4" copper', 'Other', 164, '2026-04-15 21:56:28.449121+00', '2026-04-15 21:56:28.449121+00'),
	('2aac7459-b19a-4cbf-8ffd-5b070cb28a29', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4" PVC WYE', 'Other', 165, '2026-04-15 22:14:29.992017+00', '2026-04-15 22:14:29.992017+00'),
	('1a86838b-2223-4174-a494-fd241809d9da', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4" DOUBLE SANITARY TEE', 'Other', 166, '2026-04-15 22:14:52.092075+00', '2026-04-15 22:14:52.092075+00'),
	('919dee32-9bce-42ba-b470-773bd5ee902f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 1" COPPER', 'Other', 167, '2026-04-15 22:15:37.866926+00', '2026-04-15 22:15:37.866926+00'),
	('93877ef9-d8c8-4e9e-87a8-30a319ff79f5', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 2" COPPER', 'Other', 168, '2026-04-15 22:15:54.126098+00', '2026-04-15 22:15:54.126098+00'),
	('63c4a2a5-50d7-4dc4-a85b-da9bfcdb41c5', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 2" CAST IRON', 'Other', 169, '2026-04-15 22:42:54.594827+00', '2026-04-15 22:42:54.594827+00'),
	('c59f1795-e069-4cbc-bbf9-7499659f2c1c', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2" COPPER 90', 'Other', 170, '2026-04-15 22:48:15.152962+00', '2026-04-15 22:48:15.152962+00'),
	('1980d498-f86f-43d0-b56a-a6c949a9f939', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1" COPPER 90', 'Other', 171, '2026-04-15 22:50:42.49215+00', '2026-04-15 22:50:42.49215+00'),
	('5f1c570c-a822-46da-a444-592fd5722802', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF SEWER', 'Other', 172, '2026-04-15 23:15:27.24076+00', '2026-04-15 23:15:27.24076+00'),
	('031cf5f9-6c79-4b82-93cd-c97423201028', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 3" CAST IRON', 'Other', 173, '2026-04-15 23:16:59.848524+00', '2026-04-15 23:16:59.848524+00'),
	('82a411b0-10ef-492d-bf51-a0e78254e4dd', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 1/2" COPPER', 'Other', 174, '2026-04-15 23:18:18.484392+00', '2026-04-15 23:18:18.484392+00'),
	('92579eef-2108-4e54-9284-7fd3b314855a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4" PVC SANITARY TEE', 'Other', 175, '2026-04-15 23:22:13.802091+00', '2026-04-15 23:22:13.802091+00'),
	('f579d47f-1ca3-42a1-bf86-e80a5fe3675a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3/4" Ball Valve', 'Other', 176, '2026-04-21 15:57:28.094977+00', '2026-04-21 15:57:28.094977+00'),
	('e7b9baaf-cb1e-4514-b5ef-4b1917789d54', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/2" Ball Valve', 'Other', 177, '2026-04-21 15:58:19.634294+00', '2026-04-21 15:58:19.634294+00'),
	('a384dbe4-1ad4-4429-acbd-78832c546330', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/2in black iron', 'Other', 178, '2026-04-24 17:04:21.679149+00', '2026-04-24 17:04:21.679149+00'),
	('2a084a73-5665-4fe8-acff-83bc6db45cea', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2 1/2in black iron', 'Other', 179, '2026-04-24 17:05:08.060725+00', '2026-04-24 17:05:08.060725+00'),
	('ff411a26-5f71-431c-8237-4426d1fb6aec', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2in black iron', 'Other', 180, '2026-04-24 17:06:09.469956+00', '2026-04-24 17:06:09.469956+00'),
	('8d088877-0f83-42e0-8be9-e8cf581b60fd', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 1IN COPPER', 'Other', 181, '2026-04-29 09:00:19.250659+00', '2026-04-29 09:00:19.250659+00'),
	('546fc6a7-a52e-4398-b7de-0abc389c742f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 2IN COPPER', 'Other', 182, '2026-04-29 09:00:42.045017+00', '2026-04-29 09:00:42.045017+00'),
	('f62639c5-5aad-48f9-bd39-1720bd1b33f9', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 1 1/4IN COPPER', 'Other', 183, '2026-04-29 09:01:27.767878+00', '2026-04-29 09:01:27.767878+00'),
	('15e7b507-33df-4093-a141-8900f449452f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 1/2IN COPPER', 'Other', 184, '2026-04-29 09:02:08.952355+00', '2026-04-29 09:02:08.952355+00'),
	('924e89ca-48c0-4ef4-849a-ee72b657872a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 1 1/2IN COPPER', 'Other', 185, '2026-04-29 09:03:15.715464+00', '2026-04-29 09:03:15.715464+00'),
	('f5df2c75-349e-43e0-9e37-157b72cb0e08', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'VIEGA 1/2IN 90', 'Other', 186, '2026-05-12 17:07:54.432397+00', '2026-05-12 17:07:54.432397+00'),
	('ed6d2e0b-5aff-4607-937c-67799d06e71f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1/2IN 90 VIEGA', 'Other', 187, '2026-05-12 17:08:31.90567+00', '2026-05-12 17:08:31.90567+00'),
	('184e61e2-dacb-4106-a027-d6f2e6cc6c8d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1/2IN T VIEGA', 'Other', 188, '2026-05-12 17:17:33.919152+00', '2026-05-12 17:17:33.919152+00'),
	('26c2ba29-cce3-4ea5-bb80-0cae82e99cc4', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3/4IN 90 VIEGA', 'Other', 189, '2026-05-12 17:25:01.162363+00', '2026-05-12 17:25:01.162363+00'),
	('a883176e-1aad-4408-be67-ab2e11eefa19', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3/4IN T VIEGA', 'Other', 190, '2026-05-12 17:25:52.223842+00', '2026-05-12 17:25:52.223842+00'),
	('2e94ef04-f723-496c-b0de-020ad90cf275', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1IN 90 VIEGA', 'Other', 191, '2026-05-12 17:26:46.308333+00', '2026-05-12 17:26:46.308333+00'),
	('a65687a1-8d74-4318-831e-b7db7c8a1745', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1IN T VIEGA', 'Other', 192, '2026-05-12 17:27:42.773721+00', '2026-05-12 17:27:42.773721+00'),
	('386ca8c5-2fb4-4f7f-8fa0-09e15d2bfacb', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/4IN 90 VIEGA', 'Other', 193, '2026-05-12 17:30:27.184443+00', '2026-05-12 17:30:27.184443+00'),
	('c49ad4c6-6a06-4d25-bcaf-c8a7126fe83a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/4IN T VIEGA', 'Other', 194, '2026-05-12 17:32:29.239771+00', '2026-05-12 17:32:29.239771+00'),
	('903caba7-4cda-41c0-9839-7b2a301e11cd', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1IN X 3/4IN X 3/4IN VIEGA', 'Other', 195, '2026-05-12 17:38:18.981539+00', '2026-05-12 17:38:18.981539+00'),
	('bdd33fd0-f7ef-4200-ac01-1b8702f82ae6', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FT SEWER LINE', 'Other', 196, '2026-05-12 17:44:59.095075+00', '2026-05-12 17:44:59.095075+00'),
	('24c1b287-7c98-4e56-ba64-d11b6a49e16c', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/4IN 90 PVC', 'Other', 197, '2026-05-12 17:56:00.824116+00', '2026-05-12 17:56:00.824116+00'),
	('18b6a450-973a-4bf9-985e-bbdab476aba8', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/4IN T PVC', 'Other', 198, '2026-05-12 18:30:12.823388+00', '2026-05-12 18:30:12.823388+00'),
	('f0ca14d7-13de-443a-bdb3-dc20649bfcdf', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/2IN 90 PVC', 'Other', 199, '2026-05-12 18:32:57.473192+00', '2026-05-12 18:32:57.473192+00'),
	('54ef7466-a2f4-44f9-a841-c08e920a9df5', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2IN 90 PVC', 'Other', 200, '2026-05-12 19:28:42.716337+00', '2026-05-12 19:28:42.716337+00'),
	('4905b55d-fe08-45b0-8c66-39fbe0b44d7b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2IN T PVC', 'Other', 201, '2026-05-12 19:31:50.500734+00', '2026-05-12 19:31:50.500734+00'),
	('3cc03530-462d-4bb6-9f0f-8825b7d7c66e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3IN TEE PVC', 'Other', 202, '2026-05-12 19:33:36.254595+00', '2026-05-12 19:33:36.254595+00'),
	('72209c58-52a7-4b57-8eed-7df9fce98ce0', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3IN 90 PVC', 'Other', 203, '2026-05-12 19:34:46.633396+00', '2026-05-12 19:34:46.633396+00'),
	('b1450fd7-f634-47ea-a094-1ad3905af940', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4IN TEE PVC', 'Other', 204, '2026-05-12 19:37:15.992213+00', '2026-05-12 19:37:15.992213+00'),
	('096e2cb1-70f9-452c-9e0e-304e1652e740', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2IN TEE PVC', 'Other', 205, '2026-05-12 19:37:39.70376+00', '2026-05-12 19:37:39.70376+00'),
	('35a6ca0d-b2bc-4db0-bcb7-9f3f3a0760ad', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/4IN TEE PVC', 'Other', 206, '2026-05-12 19:37:46.995375+00', '2026-05-12 19:37:46.995375+00'),
	('e6d18e83-7f64-41db-b94c-0d265bf0708d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/2IN 90 VENT/SEWER', 'Other', 207, '2026-05-12 19:38:43.440795+00', '2026-05-12 19:38:43.440795+00'),
	('7143631d-30be-48ec-905a-5a2ba4337401', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FT OF 6IN SEWER', 'Other', 208, '2026-05-20 20:23:20.230884+00', '2026-05-20 20:23:20.230884+00'),
	('6d13966c-5adc-48c4-9b10-5ce9d5d2b6ac', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/2IN T VIEGA', 'Other', 209, '2026-05-21 17:35:52.508371+00', '2026-05-21 17:35:52.508371+00'),
	('23743df1-3df6-4f68-b58a-391d90951c60', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/2IN 90 VIEGA', 'Other', 210, '2026-05-21 17:37:47.815238+00', '2026-05-21 17:37:47.815238+00'),
	('b16f9f54-9206-4f25-be5e-313460d70c56', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4in 90 PVC', 'Other', 211, '2026-05-21 17:38:39.025939+00', '2026-05-21 17:38:39.025939+00'),
	('8b27903a-4cd6-49b5-bf6a-bae9fd6aa5a2', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 3/4IN COPPER', 'Other', 212, '2026-05-28 18:47:31.8891+00', '2026-05-28 18:47:31.8891+00'),
	('54cdd8ab-631a-47d2-8363-2cd6677b74a8', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 3IN COPPER', 'Other', 213, '2026-05-28 18:50:01.455611+00', '2026-05-28 18:50:01.455611+00'),
	('9585e0d2-d3e4-4ffb-a392-71eeddaaafdb', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 4IN COPPER', 'Other', 214, '2026-05-28 18:50:36.695625+00', '2026-05-28 18:50:36.695625+00'),
	('6a554ccc-83cf-40f2-9d19-fdc9bb679236', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 5IN COPPER', 'Other', 215, '2026-05-28 18:51:14.1551+00', '2026-05-28 18:51:14.1551+00'),
	('bb7139d6-0e16-4f9f-8197-376447b4d2f8', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 6IN COPPER', 'Other', 216, '2026-05-28 18:51:35.594284+00', '2026-05-28 18:51:35.594284+00'),
	('efa6d1a6-1202-4b77-85da-eb9e06f30c9f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 4IN CAST IRON', 'Other', 217, '2026-05-28 18:54:58.48048+00', '2026-05-28 18:54:58.48048+00'),
	('8338d003-afb9-41e7-beae-9ce18e98f767', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4IN 90 CAST IRON', 'Other', 218, '2026-05-28 19:11:57.229975+00', '2026-05-28 19:11:57.229975+00'),
	('abce1b2a-5bff-49bc-b2ae-b3191ef537f1', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4IN T CAST IRON', 'Other', 219, '2026-05-28 19:14:45.709229+00', '2026-05-28 19:14:45.709229+00'),
	('a7f445c2-a882-473f-9b01-bc6110354bce', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3IN T SEWER', 'Other', 220, '2026-05-28 19:16:33.29099+00', '2026-05-28 19:16:33.29099+00'),
	('38cb6617-8c08-476e-bf11-998632a11b6e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3IN 90 CAST IRON', 'Other', 221, '2026-05-28 19:18:11.55742+00', '2026-05-28 19:18:11.55742+00'),
	('b698ed34-fef0-4473-b64a-4a9d36c45ada', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3IN T CAST IRON', 'Other', 222, '2026-05-28 19:18:35.411127+00', '2026-05-28 19:18:35.411127+00'),
	('dc3d3a59-bb46-4a50-91a4-6c133638962f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2IN 90 CAST IRON', 'Other', 223, '2026-05-28 20:03:34.66432+00', '2026-05-28 20:03:34.66432+00'),
	('83dd9300-18b1-4ce2-b7c4-1f0da828d967', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2IN T SEWER', 'Other', 224, '2026-05-28 20:11:49.818613+00', '2026-05-28 20:11:49.818613+00'),
	('5c8a72f1-23e6-45ff-b028-14b31f3cbf50', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4X4X3 T SEWER', 'Other', 225, '2026-05-28 20:13:37.059402+00', '2026-05-28 20:13:37.059402+00'),
	('b4d86da2-e3b6-4c9a-a084-b2b6957f88b6', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4X4X2 T SEWER', 'Other', 226, '2026-05-28 20:14:22.584609+00', '2026-05-28 20:14:22.584609+00'),
	('7e06165c-2708-4802-b3f6-086c5aeba5e0', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3X3X2 T CAST IRON', 'Other', 227, '2026-05-28 20:15:34.627175+00', '2026-05-28 20:15:34.627175+00'),
	('288c97ab-6b5e-4f8d-8227-734870f20f3c', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4X4X2 T CAST IRON', 'Other', 228, '2026-05-28 20:16:10.190023+00', '2026-05-28 20:16:10.190023+00'),
	('1f03c1a2-1d71-4540-a2ec-c27b10242035', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4X4X3 T CAST IRON', 'Other', 229, '2026-05-28 20:17:32.399352+00', '2026-05-28 20:17:32.399352+00'),
	('e3b9cd91-2d5f-4025-a2df-02952da0da6f', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3X2X2 T CAST IRON', 'Other', 230, '2026-05-28 20:20:04.393791+00', '2026-05-28 20:20:04.393791+00'),
	('c546e7cb-77bb-4281-9982-d93ae1742803', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '4X3X3 T CAST IRON', 'Other', 231, '2026-05-28 20:26:03.484977+00', '2026-05-28 20:26:03.484977+00'),
	('2dc9c1af-5715-40f7-8605-458b07bb3808', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1 1/4IN 90 COPPER VIEGA', 'Other', 232, '2026-05-28 20:28:41.153611+00', '2026-05-28 20:28:41.153611+00'),
	('6e5e4cb6-0c44-4e02-ad69-2a0b04cb8ef3', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1IN 90 COPPER VIEGA', 'Other', 233, '2026-05-28 20:30:42.153648+00', '2026-05-28 20:30:42.153648+00'),
	('76c4b7f4-f69a-454c-80b4-dc43522d6b89', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1IN T COPPER VIEGA', 'Other', 234, '2026-05-28 20:32:18.734689+00', '2026-05-28 20:32:18.734689+00'),
	('ed2a43ab-ac5d-4091-8f33-7bc1a08e0eba', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3/4IN 90 COPPER VIEGA', 'Other', 235, '2026-05-28 20:34:32.316553+00', '2026-05-28 20:34:32.316553+00'),
	('92ae19a1-24fe-4b92-8950-5d8dbcff723a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3/4IN T COPPER VIEGA', 'Other', 236, '2026-05-28 20:36:36.896551+00', '2026-05-28 20:36:36.896551+00'),
	('a380764c-701b-400e-ae80-c0272ca463f7', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1/2IN 90 COPPER VIEGA', 'Other', 237, '2026-05-28 20:38:36.942797+00', '2026-05-28 20:38:36.942797+00'),
	('517dd2e0-5b0f-48b8-b137-56f2b485fb2d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1/2IN T COPPER VIEGA', 'Other', 238, '2026-05-28 20:39:52.84042+00', '2026-05-28 20:39:52.84042+00'),
	('89a5b1f8-541e-4430-b533-bece0cd5a154', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '3/4X1/2X1/2 T COPPER VIEGA', 'Other', 239, '2026-05-28 20:41:15.251483+00', '2026-05-28 20:41:15.251483+00'),
	('ef196eab-301d-49eb-ab33-46cc73d663ed', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '2IN T CAST IRON', 'Other', 240, '2026-05-28 20:55:14.07843+00', '2026-05-28 20:55:14.07843+00'),
	('4231303b-f955-4b95-a7fa-78f1aa32006e', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', '1-1/4" Aluminum Gas Pressure Regulator, FPT', 'Other', 241, '2026-06-01 18:41:09.434293+00', '2026-06-01 18:41:09.434293+00'),
	('7a1ebab5-21d4-431a-b49e-8dfe477ef1cc', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'FEET OF 1 1/4IN BLACK IRON', 'Other', 242, '2026-06-01 22:00:22.616047+00', '2026-06-01 22:00:22.616047+00'),
	('92deadd4-e160-447a-8ef0-904ec7ccf77d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'DEMO FIXTURE', 'Other', 243, '2026-06-01 22:00:51.993283+00', '2026-06-01 22:00:51.993283+00');


--
-- Data for Name: inspection_quick_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inspection_quick_links" ("id", "label", "url", "sequence_order", "created_at", "updated_at") VALUES
	('0deecfd4-f84c-4eab-b3ca-bd903babfba0', 'City of New Braunfels', 'https://nbpermits.nbtexas.org/publicaccess/template/Login.aspx', 0, '2026-03-06 23:14:29.222673+00', '2026-03-06 23:14:29.222673+00'),
	('4705f729-179c-4b60-8449-35a214bd6679', 'Alamo Heights', 'https://www.mgoconnect.org/cp/portal', 1, '2026-03-06 23:14:29.222673+00', '2026-03-06 23:14:29.222673+00'),
	('6fc52f14-7349-43bb-959b-51d7dd04d738', 'Shavano Park', 'https://www.mgoconnect.org/cp/portal', 2, '2026-03-06 23:14:29.222673+00', '2026-03-06 23:14:29.222673+00'),
	('7489efc5-4de0-42ea-90bf-6ff54d70e1bf', 'Terrell Hills', 'https://www.mgoconnect.org/cp/portal', 3, '2026-03-06 23:14:29.222673+00', '2026-03-06 23:14:29.222673+00'),
	('f4b097bb-e174-4435-863f-5861276917ba', 'City of San Antonio', 'https://aca-prod.accela.com/COSA/Login.aspx', 4, '2026-03-06 23:14:29.222673+00', '2026-03-06 23:14:29.222673+00'),
	('12950dfc-39e6-4948-a2a2-cd01e5654486', 'City of Kyle', 'https://kyletx-energovpub.tylerhost.net/apps/selfservice#/home', 5, '2026-03-06 23:14:29.222673+00', '2026-03-06 23:14:29.222673+00'),
	('e1a4268b-c390-49e9-a69b-b9a402e83dc9', 'City of Schertz', 'https://development.schertz.com/Portal/', 6, '2026-03-06 23:14:29.222673+00', '2026-03-06 23:14:29.222673+00');


--
-- Data for Name: inspection_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inspection_types" ("name", "sequence_order", "created_at", "updated_at") VALUES
	('Plumbing Rough-In', 0, '2026-03-06 22:51:00.470795+00', '2026-03-06 22:51:00.470795+00'),
	('Plumbing Pre Pour', 1, '2026-03-06 22:51:00.470795+00', '2026-03-06 22:51:00.470795+00'),
	('Gas Rough-In', 2, '2026-03-06 22:51:00.470795+00', '2026-03-06 22:51:00.470795+00'),
	('Gas Final', 3, '2026-03-06 22:51:00.470795+00', '2026-03-06 22:51:00.470795+00'),
	('Plumbing Top Out', 4, '2026-03-06 22:51:00.470795+00', '2026-03-06 22:51:00.470795+00'),
	('Shower Pan', 5, '2026-03-06 22:51:00.470795+00', '2026-03-06 22:51:00.470795+00'),
	('Sewer & Water Service (water line)', 6, '2026-03-06 22:51:00.470795+00', '2026-03-06 22:51:00.470795+00'),
	('Plumbing Final', 7, '2026-03-06 22:51:00.470795+00', '2026-03-06 22:51:00.470795+00');


--
-- Data for Name: mercury_drag_sort_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."mercury_drag_sort_labels" ("id", "name", "sort_order", "created_at", "schedule_c_line", "description", "is_system_default", "default_key", "account_type") VALUES
	('6ee22c22-e877-4863-ad35-2bf5c874c4c0', 'Income', 250, '2026-05-02 19:33:27.575707+00', 'Part I', 'Gross receipts or sale', true, 'income_part_i', 'income'),
	('5ea2960e-6b7a-48d5-8e13-6569f3a96296', 'Cost of Goods Sold', 240, '2026-05-02 19:33:27.505412+00', 'Part III', 'Direct materials and labor costs tied to jobs (if you track inventory)', true, 'cogs_part_iii', 'expense'),
	('e95cc65d-c0ec-490d-9091-7ac4158df5a7', 'Owners Equity', 251, '2026-05-20 21:14:51.257397+00', NULL, NULL, false, NULL, 'equity'),
	('fa77e62a-0c55-45a8-ad40-955decf11f50', 'Car and Truck Expenses', 10, '2026-05-02 19:33:21.281284+00', '9', 'Vehicle fuel/gas, maintenance, repairs, insurance, registration (actual expenses or standard mileage rate)', true, 'car_truck_expenses', 'expense'),
	('07fd81ec-f64e-4e41-bdbe-5ca92cc5adec', 'Fuel / Gas', 20, '2026-05-02 19:33:21.468367+00', '9', 'Gasoline, diesel, and fuel for business vehicles/trucks', true, 'fuel_gas', 'expense'),
	('f25df1d7-e184-4c55-83a6-8b87b65393ee', 'Advertising', 0, '2026-05-02 19:33:21.151373+00', '8', 'Marketing, ads, business cards, website promotion, truck wraps, flyers', true, 'advertising', 'expense'),
	('af59ab5a-9b53-40b7-8a2a-521391857be8', 'Internal Transfers', 270, '2026-05-25 15:59:40.69761+00', 'N/A', 'Movement between your own Mercury accounts. Not an expense — excluded from Schedule C totals and from job/material cost rollups. Cannot be assigned to a job split.', true, 'internal_transfers', 'transfer'),
	('df22f236-e451-4043-a0c3-e6f7fa9f6886', 'Vehicle Maintenance & Repairs', 30, '2026-05-02 19:33:21.662305+00', '9', 'Oil changes, tires, brakes, and routine truck upkeep', true, 'vehicle_maintenance_repairs', 'expense'),
	('ca47df1d-c281-4034-88a0-a900d0ddd838', 'Commissions and Fees', 40, '2026-05-02 19:33:21.814423+00', '10', 'Referral fees, sales commissions, or marketplace/platform fees', true, 'commissions_fees', 'expense'),
	('b9065d5c-4134-45ac-a2cf-bfc2f1afbd1b', 'Contract Labor', 50, '2026-05-02 19:33:22.115454+00', '11', 'Payments to independent contractors, subs, or 1099 helpers', true, 'contract_labor', 'expense'),
	('ccb4b877-d1a3-4f0a-b8db-080824e2cd83', 'Insurance', 60, '2026-05-02 19:33:22.350073+00', '15', 'Business liability, workers'' comp, shop, and property insurance (vehicle portion may go in Line 9)', true, 'insurance', 'expense'),
	('f8fbaed6-559e-4ede-b35d-40708ab19b4f', 'Legal and Professional Services', 70, '2026-05-02 19:33:22.608417+00', '17', 'Accountant, lawyer, bookkeeper, and consulting fees', true, 'legal_professional', 'expense'),
	('bf8cc99c-ff40-414b-b6a3-aa3dcab20f58', 'Office Expense', 80, '2026-05-02 19:33:22.811975+00', '18', 'Paper, postage, software subscriptions, general office supplies', true, 'office_expense', 'expense'),
	('25e5e9f5-51f0-4762-8225-a2b779b54e3a', 'Repairs and Maintenance', 110, '2026-05-02 19:33:23.295108+00', '21', 'Repairs to shop, equipment, or property (not capital improvements)', true, 'repairs_maintenance', 'expense'),
	('65126cd1-942c-4b62-86a7-58e04498560d', 'Supplies', 120, '2026-05-02 19:33:23.421589+00', '22', 'General materials, parts, and consumables used in business', true, 'supplies', 'expense'),
	('ab84b879-7471-4278-8247-5403de38d628', 'Job Materials & Parts', 130, '2026-05-02 19:33:23.536523+00', '22 or COGS', 'Pipes, fittings, valves, fixtures, and job-specific plumbing supplies', true, 'job_materials_parts', 'expense'),
	('2741b8fd-e452-48a5-83f3-f351d83c51f4', 'Consumables', 140, '2026-05-02 19:33:23.791595+00', '22', 'Blades, gloves, tape, solder, drill bits, and other quick-use items (e.g., Harbor Freight purchases)', true, 'consumables', 'expense'),
	('eb7d3f48-9924-44a5-84eb-9e8f5e644c52', 'Shop Supplies', 150, '2026-05-02 19:33:23.976422+00', '22', 'General workshop consumables and safety items', true, 'shop_supplies', 'expense'),
	('1653e7c3-e6db-442a-b49c-2d4a53d699be', 'Tools & Small Equipment', 160, '2026-05-02 19:33:24.445873+00', '22 or 13', 'Hand tools, power tools, and small items (expensed if under de minimis limits)', true, 'tools_small_equipment', 'expense'),
	('2defabd2-f53d-48fd-b2e9-401e503a4bf7', 'Taxes and Licenses', 170, '2026-05-02 19:33:24.893725+00', '23', 'Business licenses, permits, and certain taxes', true, 'taxes_licenses', 'expense'),
	('6e2bbd36-4ad4-40dd-9089-191b73e39f06', 'Travel', 180, '2026-05-02 19:33:25.070728+00', '24a', 'Airfare, hotels, rental cars for business travel (not commuting)', true, 'travel', 'expense'),
	('c7bd169f-ef1d-44fc-89d9-d04c87d10fc3', 'Meals', 190, '2026-05-02 19:33:25.303407+00', '24b', 'Business meals (usually 50% deductible)', true, 'meals', 'expense'),
	('257c4e47-16b7-465e-a07d-badb3cb5ec30', 'Utilities', 200, '2026-05-02 19:33:25.424814+00', '25', 'Electricity, water, internet, and phone for business use', true, 'utilities', 'expense'),
	('3b6d4121-9df6-45c8-8dce-353a15c5e32e', 'Wages', 210, '2026-05-02 19:33:25.562861+00', '26', 'Employee salaries and wages (reduce by certain credits if applicable)', true, 'wages', 'expense'),
	('2e3b13fe-aab0-4240-ac13-e858f67943ad', 'Other Expenses', 220, '2026-05-02 19:33:26.568201+00', '27a', 'Catch-all items like uniforms, continuing education, protective gear, or miscellaneous (describe each)', true, 'other_expenses_27a', 'expense'),
	('86d98f56-7968-4d80-93fe-55bf2370e1b6', 'Bad Debts', 230, '2026-05-02 19:33:26.926024+00', '27b (Other Expenses)', 'Uncollectible customer invoices', true, 'bad_debts_27b', 'expense'),
	('ffeec82c-5b1f-4648-9256-a6f97d5780cc', 'Employee Benefits', 90, '2026-05-20 16:13:01.751445+00', '19', 'deductible contributions you made as an employer to certain employee benefit programs for your employees (not for yourself as the sole proprietor)', true, 'employee_benefits', 'expense'),
	('ac6b873c-c315-4225-97e0-1659a6070d8b', 'Equipment Lease', 90, '2026-05-02 19:33:22.928581+00', '20a', 'Vehicles, machinery, and equipment', true, 'rent_lease_20a', 'expense'),
	('f18fe4a9-dbd2-4c1a-971f-42f4333c194a', 'Property Lease', 100, '2026-05-02 19:33:23.174046+00', '20b', 'other business property', true, 'rent_lease_20b', 'expense');


--
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."notification_templates" ("id", "template_type", "push_title", "push_body", "created_at", "updated_at") VALUES
	('e3052e52-78b2-4ab3-abc2-34f9d8370528', 'checklist_completed', 'Checklist completed', '{{assignee_name}} completed: {{item_title}}', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:27.819427+00'),
	('65c8764b-ac75-4fea-bd0f-d114875b39f2', 'test_notification', 'Test notification', 'If you see this, push notifications are working!', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:30.686739+00'),
	('636c6939-48e6-4882-8639-d3c385a4b5b5', 'stage_assigned_started', 'Stage started', '{{project_name}} - {{stage_name}} has been started. Assigned to {{assigned_to_name}}.', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:32.950971+00'),
	('dde0594e-fda8-4f45-8f8b-7b8bfe408db3', 'stage_assigned_complete', 'Stage completed', '{{project_name}} - {{stage_name}} has been completed by {{assigned_to_name}}.', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:36.022778+00'),
	('50d96c7c-d385-4b1d-99e0-413dfbb08ce4', 'stage_assigned_reopened', 'Stage re-opened', '{{project_name}} - {{stage_name}} has been re-opened. Assigned to {{assigned_to_name}}.', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:37.865699+00'),
	('f6ec0877-131a-4971-a9e5-14acf82ae66c', 'stage_me_started', 'Stage started', '{{stage_name}} in {{project_name}} has been started.', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:40.796909+00'),
	('984497e2-2616-43a6-bbce-14081d8ee59f', 'stage_me_complete', 'Stage completed', '{{stage_name}} in {{project_name}} has been completed.', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:43.437082+00'),
	('30eccac4-3f60-4561-9e8d-c298c68f5ed7', 'stage_me_reopened', 'Stage re-opened', '{{stage_name}} in {{project_name}} has been re-opened.', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:48.775371+00'),
	('2ceab05f-a1cc-48cc-a55a-7234a5e4a205', 'stage_next_complete_or_approved', 'Your turn: Stage completed', '{{stage_name}} has been completed. You''re up next for {{next_stage_name}}.', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:51.305983+00'),
	('bcc9cac9-47ad-4ce6-b15d-0dc7d16e16aa', 'stage_prior_rejected', 'Stage rejected', '{{stage_name}} was rejected. Reason: {{rejection_reason}}', '2026-02-17 14:52:01.420671+00', '2026-02-17 15:20:53.324997+00');


--
-- Data for Name: part_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."part_types" ("id", "service_type_id", "name", "category", "sequence_order", "created_at", "updated_at") VALUES
	('11bb142a-8ae7-4b26-945b-7d67031762da', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Fitting', 'Parts', 1, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('9ef9562c-a6bc-4040-a144-64bdf11005d6', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Pipe', 'Parts', 2, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('e7a59bff-e20f-41a0-bae4-afcc7c8e473b', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Drain', 'Parts', 3, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('ea89f241-2438-45f9-99d7-8138ed2be8ce', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Sink', 'Fixtures', 4, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('7531832c-7e13-4f16-bf56-3de49c667548', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Faucet', 'Fixtures', 5, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('6fdda064-432a-4d52-9566-6058d8be61b5', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Toilet', 'Fixtures', 6, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('571019d5-8e1b-4dd8-8a0f-4f4e892286b6', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Shower', 'Fixtures', 7, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('d6c555a8-09e8-49e2-8653-3527361e6bee', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Bathtub', 'Fixtures', 8, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('013f453d-343e-4639-aed9-dddb3a57011a', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Valve', 'Parts', 9, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('fc2f35e2-de62-4ad3-b9ca-e667a267e1aa', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Water Heater', 'Appliances', 10, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('2f895723-3c99-45b6-998c-4fbda9658cbf', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Wire', NULL, 1, '2026-02-11 17:37:03.117381+00', '2026-02-11 17:37:03.117381+00'),
	('104b2e8f-0f5e-4206-974e-c51da54e94b0', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Trap', 'Parts', 12, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('06e77de3-8cc2-49aa-9e90-f28149c6ac2d', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Elbow', 'Parts', 13, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('dc8bfbd7-fc21-4603-af6c-0a5f82205978', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Tee', 'Parts', 14, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('9ce33c18-64e3-44a3-a97f-327bcbb8b746', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Coupling', 'Parts', 15, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('4050a8a4-f75e-4085-8013-8329cea23b03', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Other', 'Parts', 16, '2026-02-10 18:28:47.304693+00', '2026-02-10 18:28:47.304693+00'),
	('401ef201-2f2a-4a5a-9ddc-a9debff6d6ad', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Gear', NULL, 2, '2026-02-11 17:37:07.069418+00', '2026-02-11 17:37:07.069418+00'),
	('67e4566c-65b7-4394-977a-77826eb1e836', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Lighting Fixtures', NULL, 3, '2026-02-11 17:37:12.092031+00', '2026-02-11 17:37:12.092031+00'),
	('9d57172e-857c-4738-a24a-a249c48099bc', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Other', NULL, 4, '2026-02-11 17:37:19.272478+00', '2026-02-11 17:37:19.272478+00'),
	('e76c8007-62b3-4264-ae77-5231e30e5a9a', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Rental Equipment', NULL, 5, '2026-02-11 17:37:28.961136+00', '2026-02-11 17:37:28.961136+00'),
	('6a096288-2383-4f92-813b-1edf0f83c8e9', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Rental Equipment', NULL, 17, '2026-02-11 17:37:37.966621+00', '2026-02-11 17:37:37.966621+00'),
	('bfa497ff-bd3a-495b-9fe0-90c7145514e4', '21296f21-9b81-4487-9a09-8b5fb292585e', 'Rental Equipment', NULL, 1, '2026-02-11 17:37:41.744892+00', '2026-02-11 17:37:41.744892+00'),
	('4b849ff8-c000-426b-a031-42eb2670e764', '21296f21-9b81-4487-9a09-8b5fb292585e', 'Ducts', NULL, 2, '2026-02-11 17:37:47.10832+00', '2026-02-11 17:37:47.10832+00'),
	('0e622aa1-6e45-4f62-b75b-1736dc9f00ad', '21296f21-9b81-4487-9a09-8b5fb292585e', 'Other', NULL, 3, '2026-02-11 17:37:51.71868+00', '2026-02-11 17:37:51.71868+00'),
	('5a5b09d1-6dfb-4c4e-90c5-a17d442611ac', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Digging', NULL, 6, '2026-02-11 17:38:17.29022+00', '2026-02-11 17:38:17.29022+00'),
	('c53ee014-251f-4d7e-9630-2a3a0a01ef4c', 'd53845ab-79ed-498b-88d1-d3a069cf2e73', 'Digging', NULL, 18, '2026-02-11 17:38:24.626039+00', '2026-02-11 17:38:24.626039+00'),
	('681b2c12-20b7-4126-b987-3d8b8bbe1a59', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Couplings', NULL, 7, '2026-02-12 16:44:20.729043+00', '2026-02-12 16:44:20.729043+00'),
	('fc730144-25b5-4fdf-9ea1-0bb0572d93f2', '6c1aa49c-35c0-4c0b-baa8-7ae347846561', 'Conduit', NULL, 8, '2026-02-12 16:44:37.880128+00', '2026-02-12 16:44:37.880128+00');


--
-- Data for Name: report_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."report_templates" ("id", "name", "sequence_order", "created_at", "updated_at", "app_managed") VALUES
	('48090d04-f4e4-4dce-b7d9-f7976ab7574c', 'Walk Report', 1, '2026-02-21 20:45:20.733913+00', '2026-02-21 20:45:20.733913+00', false),
	('09380950-e7f0-482c-a5f2-fcc81a42e615', 'Note', 999, '2026-02-22 23:53:36.206483+00', '2026-02-22 23:53:36.206483+00', false),
	('54efdea2-961c-4d3a-8900-b497c735bd29', 'EOD', 999, '2026-03-08 17:36:47.261718+00', '2026-03-08 17:36:47.261718+00', false),
	('d724a23c-8819-4746-84bf-cb287b990b92', 'Status Report', 0, '2026-02-21 20:45:20.733913+00', '2026-02-21 20:45:20.733913+00', false),
	('1c86ed4c-7b52-4408-85c0-aa9ccc488c2f', 'Job Complete', 1000, '2026-04-28 20:55:14.195426+00', '2026-04-28 20:55:14.195426+00', true);


--
-- Data for Name: report_template_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."report_template_fields" ("id", "template_id", "label", "sequence_order", "created_at", "input_type") VALUES
	('2a587984-1120-4042-a230-de55dd962b87', 'd724a23c-8819-4746-84bf-cb287b990b92', 'What is the status of the job?', 1, '2026-02-21 20:45:20.733913+00', 'long_text'),
	('26dbbd8d-7603-4f22-b962-6af618cc4bad', 'd724a23c-8819-4746-84bf-cb287b990b92', 'What needs to be done to get to the next stage?', 2, '2026-02-21 20:45:20.733913+00', 'long_text'),
	('76180216-362b-4d3b-81d7-ca16ba2147ed', '48090d04-f4e4-4dce-b7d9-f7976ab7574c', 'What is a risk?', 0, '2026-02-21 20:45:20.733913+00', 'long_text'),
	('9c0eba26-2949-4a15-9a1f-35f16a04b570', '48090d04-f4e4-4dce-b7d9-f7976ab7574c', 'What makes us look bad?', 1, '2026-02-21 20:45:20.733913+00', 'long_text'),
	('6c8e11c7-e19d-4b73-8088-6a84331c6bf5', '48090d04-f4e4-4dce-b7d9-f7976ab7574c', 'What needs to be dealt with?', 2, '2026-02-21 20:45:20.733913+00', 'long_text'),
	('e4e6647f-a430-42d7-ab51-a37229a015fd', '09380950-e7f0-482c-a5f2-fcc81a42e615', 'Note', 0, '2026-02-22 23:53:36.385376+00', 'long_text'),
	('67c53c84-359e-4cf6-919d-d7fcd2dbb790', '54efdea2-961c-4d3a-8900-b497c735bd29', 'What did you ship / complete / make measurable progress on today?', 0, '2026-03-08 17:36:47.525357+00', 'long_text'),
	('67c61ba5-196c-449e-82f3-0c13c7939f61', '54efdea2-961c-4d3a-8900-b497c735bd29', 'What (if anything) is now blocked or at risk of slipping?', 1, '2026-03-08 17:36:47.525357+00', 'long_text'),
	('086b2afd-20d3-4cff-b6b5-4b78e761dcf9', '54efdea2-961c-4d3a-8900-b497c735bd29', 'Metrics impact (if relevant):', 2, '2026-03-08 17:36:47.525357+00', 'long_text'),
	('727fed80-2f99-4d6d-9274-54dc840aa7ad', '54efdea2-961c-4d3a-8900-b497c735bd29', 'One sentence on the single most important thing for tomorrow / next 24h:', 3, '2026-03-08 17:36:47.525357+00', 'long_text'),
	('c57fcaca-b2d5-4883-9db9-f0581a3487ac', 'd724a23c-8819-4746-84bf-cb287b990b92', 'How complete is the job?', 0, '2026-02-21 20:45:20.733913+00', 'percent_0_100'),
	('4ba6de0b-b16c-402f-abf6-e87083e877e7', '1c86ed4c-7b52-4408-85c0-aa9ccc488c2f', 'Scope of work performed', 0, '2026-04-28 20:55:14.195426+00', 'long_text'),
	('78519a15-1a0b-4feb-89be-e5d324f2c13a', '1c86ed4c-7b52-4408-85c0-aa9ccc488c2f', 'Any deviations or issues encountered', 1, '2026-04-28 20:55:14.195426+00', 'long_text'),
	('154a5f9d-8a64-4216-bc61-f807716b7052', '1c86ed4c-7b52-4408-85c0-aa9ccc488c2f', 'Signature', 2, '2026-04-28 20:55:14.195426+00', 'signature_png');


--
-- Data for Name: team_feedback_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."team_feedback_settings" ("id", "enabled", "cadence_days", "intro_copy", "thank_you_copy", "manager_section_enabled", "peer_section_enabled", "home_entry_enabled", "comment_only_enabled", "updated_at", "inclusion_title", "inclusion_subtitle", "inclusion_label_manager", "inclusion_label_peer", "inclusion_label_open", "manager_likert_prompts", "peer_likert_prompts", "manager_overall_prompt", "manager_step_heading", "peer_step_heading") VALUES
	(1, false, 14, '100% Anonymous — No names or employee IDs are attached. Your feedback helps us run better, safer jobs.', 'Your feedback helps us build a stronger, safer team.', true, true, false, false, '2026-04-13 00:37:05.883+00', NULL, NULL, NULL, NULL, NULL, '["My manager clearly explains the job scope, parts needed, and customer expectations before I leave the shop.", "My manager is quick and helpful when I call or text with problems on the job", "My manager assigns jobs, and tough calls fairly.", "I feel safe bringing up safety concerns or process improvement ideas with my manager.", "My manager gives clear, actionable feedback that actually helps me do my job better."]', NULL, NULL, NULL, 'Teammate Feedback');


--
-- Name: bids_bid_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."bids_bid_number_seq"', 307, true);


--
-- Name: estimates_estimate_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."estimates_estimate_number_seq"', 3, true);


--
-- Name: projects_project_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."projects_project_number_seq"', 7, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict icxGRUJIi9xk1huISyjNNcvc04WESxb73slsNTe5sBNWBsKMwD22MDu7DZPChI2

RESET ALL;

SET session_replication_role = DEFAULT;

-- ============ Storage buckets ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('contract-signer-signatures', 'contract-signer-signatures', false, 524288, '{image/png}'),
  ('estimate-acceptor-signatures', 'estimate-acceptor-signatures', false, 524288, '{image/png}')
on conflict (id) do nothing;

-- ============ Cron jobs (read PROJECT_URL/CRON_SECRET from Vault at run time) ============
-- Guarded so the seed never fails on a fresh project without pg_cron/pg_net enabled.
do $seed$
begin
  if exists (select 1 from pg_extension where extname='pg_cron')
     and exists (select 1 from pg_extension where extname='pg_net') then
    perform cron.schedule('auto-clock-out-eod', '* * * * *', $cronjob$ SELECT public.auto_clock_out_eod_if_due(); $cronjob$);
    perform cron.schedule('recurring-job-report-dispatch', '*/15 * * * *', $cronjob$ SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/recurring-job-report-dispatch', headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')), body := '{}'::jsonb) AS request_id; $cronjob$);
    perform cron.schedule('schedule-day-email-dispatch', '*/15 * * * *', $cronjob$ SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/schedule-day-email-dispatch', headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')), body := '{}'::jsonb) AS request_id; $cronjob$);
    perform cron.schedule('schedule-share-dispatch', '*/15 * * * *', $cronjob$ SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/schedule-share-dispatch', headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')), body := '{}'::jsonb) AS request_id; $cronjob$);
    perform cron.schedule('send-scheduled-reminders', '*/15 * * * *', $cronjob$ SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/send-scheduled-reminders', headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')), body := '{}'::jsonb) AS request_id; $cronjob$);
    perform cron.schedule('sync-mercury-transactions', '*/30 * * * *', $cronjob$ SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/sync-mercury-transactions', headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')), body := '{"lookback_days": 2}'::jsonb) AS request_id; $cronjob$);
    perform cron.schedule('sync-salary-sessions', '*/5 * * * *', $cronjob$ SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/sync-salary-sessions', headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')), body := '{}'::jsonb) AS request_id; $cronjob$);
  else
    raise notice 'pg_cron/pg_net not enabled — skipping cron seed. Enable extensions + set Vault PROJECT_URL/CRON_SECRET, then re-run this block.';
  end if;
end
$seed$;
