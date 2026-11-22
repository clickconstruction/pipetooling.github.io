-- Permits, the phone on a permit (migration *_permit_contact_phone): Austin rows as the pull stored them before the
-- column, the feed's whole record in `raw` and no phone of their own. The bed's script writes these, then runs the
-- migration again, which fills them as it filled the rows prod already held. Not rolled back: the copy is thrown
-- away. See scripts/pgtest-permit-name-contacts.sh. Never against prod. Every name and number is made up.
\set ON_ERROR_STOP 1
INSERT INTO public.permits (id, city, source, permit_number, permit_type, kind, stage, residential, work_type, address, address_key, submitted_on, contact, builder_key, raw) VALUES
  -- The contractor's company, with the city's mark: the contractor's phone, never the applicant's.
  ('00000000-0000-0000-0000-0000009422b1', 'Austin', 'bed', 'AU-1', 'Building Permit', 'building', 'issued', false, 'New commercial', '100 SAMPLE LN', '100 sample ln', CURRENT_DATE - 9, 'Ridgeway Builders', 'ridgewaybuilders', '{"contractor_company_name": "Ridgeway Builders ***MAIN***", "contractor_phone": "5125550101", "applicant_phone": "5125559999"}'),
  -- No company at all, and an applicant named: the applicant's phone, its extension dropped.
  ('00000000-0000-0000-0000-0000009422b2', 'Austin', 'bed', 'AU-2', 'Building Permit', 'building', 'issued', false, 'Commercial remodel', '77 KILN ST', '77 kiln st', CURRENT_DATE - 8, 'Dana Whitlock', 'danawhitlock', '{"contractor_company_name": " ", "applicant_full_name": "Dana Whitlock", "applicant_phone": "(512) 555-0202 x12", "contractor_phone": "5125550101"}'),
  -- Three digits is no phone.
  ('00000000-0000-0000-0000-0000009422b3', 'Austin', 'bed', 'AU-3', 'Building Permit', 'building', 'issued', false, 'Commercial remodel', '5 ASTER RDG', '5 aster rdg', CURRENT_DATE - 7, 'Tall Pine Development', 'tallpinedevelopment', '{"contractor_company_name": "Tall Pine Development", "contractor_phone": "512"}'),
  -- Nobody named: no phone kept.
  ('00000000-0000-0000-0000-0000009422b4', 'Austin', 'bed', 'AU-4', 'Building Permit', 'building', 'issued', false, 'Commercial remodel', '9 LARKSPUR CT', '9 larkspur ct', CURRENT_DATE - 6, NULL, NULL, '{"contractor_phone": "5125550303"}'),
  -- Another city's row is not read, whatever its record holds.
  ('00000000-0000-0000-0000-0000009422b5', 'San Antonio', 'bed', 'SA-1', 'Comm Remodel Permit', 'building', 'issued', false, 'Commercial remodel', '800 TOWER BLVD', '800 tower blvd', CURRENT_DATE - 5, 'Harbor Fitouts', 'harborfitouts', '{"contractor_phone": "2105550404"}'),
  -- One phone under four names: a service's. A leading 1 is dropped.
  ('00000000-0000-0000-0000-0000009422b6', 'Austin', 'bed', 'AU-6', 'Building Permit', 'building', 'issued', false, 'Commercial remodel', '1 MILL RD', '1 mill rd', CURRENT_DATE - 4, 'Permit Runners', 'permitrunners', '{"contractor_company_name": "Permit Runners", "contractor_phone": "15125550505"}'),
  ('00000000-0000-0000-0000-0000009422b7', 'Austin', 'bed', 'AU-7', 'Building Permit', 'building', 'issued', false, 'Commercial remodel', '2 MILL RD', '2 mill rd', CURRENT_DATE - 4, 'Oak Mill Co', 'oakmillco', '{"contractor_company_name": "Oak Mill Co", "contractor_phone": "5125550505"}'),
  ('00000000-0000-0000-0000-0000009422b8', 'Austin', 'bed', 'AU-8', 'Building Permit', 'building', 'issued', false, 'Commercial remodel', '3 MILL RD', '3 mill rd', CURRENT_DATE - 4, 'Fern Works', 'fernworks', '{"contractor_company_name": "Fern Works", "contractor_phone": "5125550505"}'),
  ('00000000-0000-0000-0000-0000009422b9', 'Austin', 'bed', 'AU-9', 'Building Permit', 'building', 'issued', false, 'Commercial remodel', '4 MILL RD', '4 mill rd', CURRENT_DATE - 4, 'Slate Build', 'slatebuild', '{"contractor_company_name": "Slate Build", "contractor_phone": "5125550505"}'),
  -- One digit ten times is no phone.
  ('00000000-0000-0000-0000-0000009422ba', 'Austin', 'bed', 'AU-10', 'Building Permit', 'building', 'issued', false, 'Commercial remodel', '5 MILL RD', '5 mill rd', CURRENT_DATE - 4, 'Zero Co', 'zeroco', '{"contractor_company_name": "Zero Co", "contractor_phone": "0000000000"}');
