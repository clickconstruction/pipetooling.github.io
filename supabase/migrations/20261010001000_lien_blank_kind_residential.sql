SET lock_timeout = '3s';

-- A property whose kind is not set dates as residential (v2.5031; the owner's call of 2026-10-09, lien punch
-- item K). The earlier date is the safe one: a house read as commercial loses its lien a month late. Before,
-- both deadline functions gave the earlier month only to 'residential', so a blank kind ('' — the default on
-- customer_addresses, and on every job with no property record) ran the later, commercial clock in every RPC
-- that calls them (list_lien_notice_months, the affidavit queue, list_gc_unpaid_months, the owner confirm
-- lists). Now only 'non_residential' gets the later month, as the client's src/lib/jobs/lienDeadlines.ts does.
-- Signatures, volatility and grants are unchanged (CREATE OR REPLACE keeps the ACL); idempotent.

CREATE OR REPLACE FUNCTION public.lien_notice_deadline(p_month text, p_property_kind text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d date;
BEGIN
  IF p_month !~ '^\d{4}-\d{2}$' THEN RETURN NULL; END IF;
  d := (to_date(p_month || '-15', 'YYYY-MM-DD')
        + make_interval(months => CASE WHEN p_property_kind = 'non_residential' THEN 3 ELSE 2 END))::date;
  IF extract(dow FROM d) = 6 THEN d := d + 2;
  ELSIF extract(dow FROM d) = 0 THEN d := d + 1;
  END IF;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.lien_filing_deadline(p_month text, p_property_kind text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d date;
BEGIN
  IF p_month !~ '^\d{4}-\d{2}$' THEN RETURN NULL; END IF;
  d := (to_date(p_month || '-15', 'YYYY-MM-DD')
        + make_interval(months => CASE WHEN p_property_kind = 'non_residential' THEN 4 ELSE 3 END))::date;
  IF extract(dow FROM d) = 6 THEN d := d + 2;
  ELSIF extract(dow FROM d) = 0 THEN d := d + 1;
  END IF;
  RETURN d;
END;
$$;
