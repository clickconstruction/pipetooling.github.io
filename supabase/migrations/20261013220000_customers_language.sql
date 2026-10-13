SET lock_timeout = '3s';

-- Messages, residential R8 · 16 (to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md → R8, card 16 of
-- customer-messages-integrations-mockups.html v0.2 on branch spike/gc-mode): where a customer's language lives. One
-- column on the customer row, as gc_companies.lang is on a trade partner's, read by every contact of theirs: the
-- customer's own contact and each person at the customer.
--
--   * customers.language: 'en' or 'es'. Null is English, so every customer reads English until the office says
--     otherwise, and nothing guesses from a name.
--   * Read and written through the row's own policies and grants, as every other customers column is. No policy
--     changes and no new table.
--   * Spanish still waits on the portal's gate (PORTAL_SPANISH_ON in src/lib/gc/portalI18n.ts) until a native speaker
--     reads the words; the reads pass the column through portalShownLang.

-- The check rides on the column, as gc_companies.lang's does: a column that is already there skips the whole clause.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS language text
    CONSTRAINT customers_language_known CHECK (language IS NULL OR language IN ('en', 'es'));

COMMENT ON COLUMN public.customers.language IS
  'Messages (residential R8 · 16): the language the customer reads, en or es. Null: English. Read by every contact of theirs; Spanish waits on the portal''s gate.';
