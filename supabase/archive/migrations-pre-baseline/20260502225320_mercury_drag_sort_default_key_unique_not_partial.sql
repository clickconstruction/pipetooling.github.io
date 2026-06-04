-- Drag Sort: PostgREST upsert sends ON CONFLICT (default_key) without a partial-index
-- predicate, so it cannot use UNIQUE ... WHERE (default_key IS NOT NULL). Replace with a
-- full unique index on default_key (PostgreSQL allows many NULLs — custom labels unchanged).

DROP INDEX IF EXISTS public.mercury_drag_sort_labels_default_key_uidx;

CREATE UNIQUE INDEX mercury_drag_sort_labels_default_key_uidx
  ON public.mercury_drag_sort_labels (default_key);

-- Idempotent seed if built-ins are missing (e.g. after upsert failures against the old index).
INSERT INTO public.mercury_drag_sort_labels (
  default_key,
  name,
  schedule_c_line,
  description,
  is_system_default,
  sort_order
)
VALUES
  ('advertising', 'Advertising', '8',
    'Marketing, ads, business cards, website promotion, truck wraps, flyers', true, 0),
  ('car_truck_expenses', 'Car and Truck Expenses', '9',
    'Vehicle fuel/gas, maintenance, repairs, insurance, registration (actual expenses or standard mileage rate)',
    true, 10),
  ('fuel_gas', 'Fuel / Gas', '9',
    'Gasoline, diesel, and fuel for business vehicles/trucks', true, 20),
  ('vehicle_maintenance_repairs', 'Vehicle Maintenance & Repairs', '9',
    'Oil changes, tires, brakes, and routine truck upkeep', true, 30),
  ('commissions_fees', 'Commissions and Fees', '10',
    'Referral fees, sales commissions, or marketplace/platform fees', true, 40),
  ('contract_labor', 'Contract Labor', '11',
    'Payments to independent contractors, subs, or 1099 helpers', true, 50),
  ('insurance', 'Insurance', '15',
    $d$Business liability, workers' comp, shop, and property insurance (vehicle portion may go in Line 9)$d$,
    true, 60),
  ('legal_professional', 'Legal and Professional Services', '17',
    'Accountant, lawyer, bookkeeper, and consulting fees', true, 70),
  ('office_expense', 'Office Expense', '18',
    'Paper, postage, software subscriptions, general office supplies', true, 80),
  ('rent_lease_20a', 'Equipment Lease', '20a',
    'Vehicles, machinery, and equipment', true, 90),
  ('rent_lease_20b', 'Property Lease', '20b',
    'other business property', true, 100),
  ('repairs_maintenance', 'Repairs and Maintenance', '21',
    'Repairs to shop, equipment, or property (not capital improvements)', true, 110),
  ('supplies', 'Supplies', '22',
    'General materials, parts, and consumables used in business', true, 120),
  ('job_materials_parts', 'Job Materials & Parts', '22 or COGS',
    'Pipes, fittings, valves, fixtures, and job-specific plumbing supplies', true, 130),
  ('consumables', 'Consumables', '22',
    'Blades, gloves, tape, solder, drill bits, and other quick-use items (e.g., Harbor Freight purchases)',
    true, 140),
  ('shop_supplies', 'Shop Supplies', '22',
    'General workshop consumables and safety items', true, 150),
  ('tools_small_equipment', 'Tools & Small Equipment', '22 or 13',
    'Hand tools, power tools, and small items (expensed if under de minimis limits)', true, 160),
  ('taxes_licenses', 'Taxes and Licenses', '23',
    'Business licenses, permits, and certain taxes', true, 170),
  ('travel', 'Travel', '24a',
    'Airfare, hotels, rental cars for business travel (not commuting)', true, 180),
  ('meals', 'Meals', '24b',
    'Business meals (usually 50% deductible)', true, 190),
  ('utilities', 'Utilities', '25',
    'Electricity, water, internet, and phone for business use', true, 200),
  ('wages', 'Wages', '26',
    'Employee salaries and wages (reduce by certain credits if applicable)', true, 210),
  ('other_expenses_27a', 'Other Expenses', '27a',
    'Catch-all items like uniforms, continuing education, protective gear, or miscellaneous (describe each)',
    true, 220),
  ('bad_debts_27b', 'Bad Debts', '27b (Other Expenses)',
    'Uncollectible customer invoices', true, 230),
  ('cogs_part_iii', 'Cost of Goods Sold', 'Part III',
    'Direct materials and labor costs tied to jobs (if you track inventory)', true, 240),
  ('income_part_i', 'Income', 'Part I',
    'Gross receipts or sale', true, 250)
ON CONFLICT (default_key) DO NOTHING;
