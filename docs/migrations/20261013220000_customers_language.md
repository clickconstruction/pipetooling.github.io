# 20261013220000_customers_language.sql (2026-10-12, v2.5422)

Messages, residential R8 · 16 (Customer communication helper 6, directed by customer-comunication). Where a customer's
language lives: one column on the customer row, as `gc_companies.lang` is on a trade partner's. Card 16 of
`to-dos/gc-mode/messages/customer-messages-integrations-mockups.html` on spike/gc-mode. Nothing writes it until the
customer form's screens PR, and nothing reads it until the reads PR, so nothing changes for anyone yet.

## What it does

1. **`customers.language`**: `'en'` or `'es'`, held by `customers_language_known`. Null is English, so every customer
   reads English until the office sets it, and nothing guesses from a name.
2. It is read and written through the row's own policies and the table's grants, as every other `customers` column
   is. No policy changes, no new table, so the three house calls do not apply.
3. Spanish still waits on the portal's gate, `PORTAL_SPANISH_ON` in `src/lib/gc/portalI18n.ts`, until a native speaker
   reads the words. The reads pass the column through `portalShownLang`.

The check rides on `ADD COLUMN IF NOT EXISTS`, so a second run skips the whole clause. The new column is all nulls, so
the check has nothing to scan.

## For the screens PR

The customer form saves in two places: a new customer in `src/components/NewCustomerForm.tsx` (the
`from('customers').insert(payload)`), and an edit in `src/components/EditCustomerForm.tsx` (its two
`from('customers')` updates). The **Language** field goes on both.

## Verify after the push

```sql
-- The column and its check, read only.
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'language';
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'customers_language_known';
-- Every row reads English.
SELECT count(*) FILTER (WHERE language IS NOT NULL) AS set FROM public.customers;
```

Expect one nullable `text` column, `CHECK (language IS NULL OR language = ANY (ARRAY['en'::text, 'es'::text]))`, and
`set = 0`. Then regenerate `src/types/database.ts` from prod in its own types PR.
