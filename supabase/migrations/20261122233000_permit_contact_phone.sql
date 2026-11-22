-- v2.8296 — Permits: the phone on a permit is kept, and one read says which names share a phone or a web
-- domain with one of our customers (punch list #307's leftovers: *the phone is not kept*, and *a phone or web
-- domain in Compare*).
--
-- Austin's feed names the contractor's phone on almost every permit. The pull kept the whole record in
-- `permits.raw` and mapped no phone. Read on prod 2026-11-22, read only: 4,898 of Austin's 4,928 permits
-- carry a contractor's phone, 1,339 of its 1,346 names have one, and a phone sits under one name, or two for
-- twelve of them. 433 of our 510 customers hold a phone. Three customer and name pairs share one today.
-- A web domain is thinner ground: 29 names have a website from a lookup.
--
-- 1. `permits.contact_phone`: the phone the feed lists for whoever `contact` names, as ten digits. The pull
--    writes it from here on (`permitRowFromAustin`), and the rows already held are filled from `raw` below.
-- 2. Two small rules, each with a twin in `supabase/functions/_shared/permitLookup.ts` held by a test:
--    `permit_phone_digits` (a US phone as ten digits, or null) and `permit_contact_domain` (the domain a
--    company answers from, off an email or a website, or null for a mail service or a site anyone can use).
-- 3. `permit_name_contact_matches`: every customer and name on permits that share a phone or a domain. The
--    client reads nothing new until its own PR, armed after this file is pushed.
SET lock_timeout = '3s';

-- 1. The column.
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS contact_phone text;
COMMENT ON COLUMN public.permits.contact_phone IS
  'The phone the feed lists for whoever contact names, as ten digits (permit_phone_digits). Austin''s feed gives one; the other cities'' do not, and theirs stays null.';

-- 2a. A US phone as ten digits. An extension is dropped, and a leading 1. Anything else is no phone: Austin
-- writes three digits, twelve, and one digit ten times.
CREATE OR REPLACE FUNCTION public.permit_phone_digits(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN d ~ '^[0-9]{10}$' AND d !~ '^([0-9])\1{9}$' THEN d END
  FROM (
    SELECT CASE WHEN raw ~ '^1[0-9]{10}$' THEN substr(raw, 2) ELSE raw END AS d
    FROM (SELECT regexp_replace(regexp_replace(COALESCE(p_value, ''), '\s*(x|ext\.?)\s*[0-9]+\s*$', '', 'i'), '[^0-9]', '', 'g') AS raw) r
  ) s;
$$;
COMMENT ON FUNCTION public.permit_phone_digits(text) IS
  'Permits: a US phone as ten digits, or null. An extension and a leading 1 are dropped; fewer or more digits, or one digit ten times, is no phone. The twin of phoneDigitsOf in supabase/functions/_shared/permitLookup.ts.';
REVOKE ALL ON FUNCTION public.permit_phone_digits(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permit_phone_digits(text) TO authenticated, service_role;

-- 2b. The domain a company answers from: the part after the @ of an email, or the host of a website, cut to
-- its last two labels. Null for a mail service anyone can sign up for, and for a site that hosts everyone's
-- page: sharing one of those says nothing.
CREATE OR REPLACE FUNCTION public.permit_contact_domain(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN d = ANY (ARRAY[
    -- SHARED_DOMAINS:START
    'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com',
    'me.com', 'aol.com', 'att.net', 'sbcglobal.net', 'comcast.net', 'proton.me', 'protonmail.com', 'ymail.com',
    'verizon.net', 'gvtc.com', 'satx.rr.com', 'rr.com', 'mac.com', 'mail.com', 'gmx.com',
    'facebook.com', 'instagram.com', 'linkedin.com', 'yelp.com', 'google.com', 'goo.gl', 'youtube.com',
    'twitter.com', 'x.com', 'nextdoor.com', 'bbb.org', 'angi.com', 'houzz.com', 'yellowpages.com',
    'mapquest.com', 'buildzoom.com', 'linktr.ee', 'wixsite.com', 'business.site', 'godaddysites.com',
    'squarespace.com', 'weebly.com', 'wordpress.com', 'webflow.io', 'github.io'
    -- SHARED_DOMAINS:END
  ]) THEN NULL ELSE d END
  FROM (
    SELECT substring(
             CASE WHEN v LIKE '%@%' THEN substring(v from '@([^@[:space:]>]+)>?$')
                  ELSE substring(v from '^(?:[a-z][a-z0-9+.-]*://)?([^/:?#[:space:]]+)') END
             from '([a-z0-9-]+\.[a-z]{2,})\.?$') AS d
    FROM (SELECT lower(btrim(COALESCE(p_value, ''))) AS v) s
  ) t;
$$;
COMMENT ON FUNCTION public.permit_contact_domain(text) IS
  'Permits: the domain a company answers from, off an email or a website, as its last two labels; null for a mail service or a site anyone can use. The twin of contactDomainOf in supabase/functions/_shared/permitLookup.ts, which holds the same list.';
REVOKE ALL ON FUNCTION public.permit_contact_domain(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permit_contact_domain(text) TO authenticated, service_role;

-- 1b. The rows already held. Austin's contact is the contractor's company, else the applicant's, else the
-- contractor, else the applicant: the phone is the same party's. Only rows with no phone yet, so a second
-- run writes nothing.
UPDATE public.permits p
SET contact_phone = f.phone
FROM (
  SELECT q.id,
         public.permit_phone_digits(
           CASE
             WHEN NULLIF(btrim(q.raw->>'contractor_company_name'), '') IS NOT NULL THEN q.raw->>'contractor_phone'
             WHEN NULLIF(btrim(q.raw->>'applicant_org'), '') IS NOT NULL THEN q.raw->>'applicant_phone'
             WHEN NULLIF(btrim(q.raw->>'contractor_full_name'), '') IS NOT NULL THEN q.raw->>'contractor_phone'
             ELSE q.raw->>'applicant_phone'
           END) AS phone
  FROM public.permits q
  WHERE q.city = 'Austin' AND q.contact IS NOT NULL AND q.contact_phone IS NULL
) f
WHERE f.id = p.id AND f.phone IS NOT NULL;

-- A name's phones are read by its key.
CREATE INDEX IF NOT EXISTS permits_contact_phone_idx ON public.permits (builder_key) WHERE contact_phone IS NOT NULL;

-- 3. The read. SECURITY INVOKER: a caller sees the pairs of the customers and the permits their own rules show.
CREATE OR REPLACE FUNCTION public.permit_name_contact_matches(p_customer_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  customer_id uuid,
  builder_key text,
  reason text,
  value text,
  heard_from text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH our_said AS (
    -- Every phone and every email we hold for a customer: on its own row, on a person of it, and on the
    -- contacts spine, where a contact points at the customer or at one of its people.
    SELECT c.id AS customer_id, 'phone'::text AS reason, public.permit_phone_digits(c.contact_info->>'phone') AS v FROM public.customers c
    UNION
    SELECT c.id, 'domain', public.permit_contact_domain(c.contact_info->>'email') FROM public.customers c
    UNION
    SELECT c.id, 'domain', public.permit_contact_domain(c.billing_email) FROM public.customers c
    UNION
    SELECT p.customer_id, 'phone', public.permit_phone_digits(p.phone) FROM public.customer_contact_persons p
    UNION
    SELECT p.customer_id, 'domain', public.permit_contact_domain(p.email) FROM public.customer_contact_persons p
    UNION
    SELECT COALESCE(ct.customer_id, cp.customer_id),
           CASE WHEN ch.kind = 'phone' THEN 'phone' ELSE 'domain' END,
           CASE WHEN ch.kind = 'phone' THEN public.permit_phone_digits(ch.value) ELSE public.permit_contact_domain(ch.value) END
    FROM public.contact_channels ch
    JOIN public.contacts ct ON ct.id = ch.contact_id
    LEFT JOIN public.customer_contact_persons cp ON cp.id = ct.customer_contact_person_id
    WHERE COALESCE(ct.customer_id, cp.customer_id) IS NOT NULL
  ),
  ours AS (
    SELECT customer_id, reason, v, count(*) OVER (PARTITION BY reason, v) AS holders
    FROM (SELECT DISTINCT customer_id, reason, v FROM our_said WHERE v IS NOT NULL) d
  ),
  -- A looked-up phone somebody said is wrong is no evidence: its newest check decides.
  wrong_lookups AS (
    SELECT lookup_id
    FROM (SELECT DISTINCT ON (k.lookup_id) k.lookup_id, k.verdict FROM public.builder_lookup_checks k ORDER BY k.lookup_id, k.said_at DESC) n
    WHERE n.verdict = 'wrong'
  ),
  their_said AS (
    SELECT p.builder_key, 'phone'::text AS reason, p.contact_phone AS v, 'permit'::text AS heard_from
    FROM public.permits p
    WHERE p.contact_phone IS NOT NULL AND p.builder_key IS NOT NULL
    UNION
    SELECT l.lookup_key, 'phone', public.permit_phone_digits(l.facts->>'phone'), 'lookup'
    FROM public.permit_lookups l WHERE l.kind = 'company' AND l.found
    UNION
    SELECT l.lookup_key, 'domain', public.permit_contact_domain(l.facts->>'website'), 'lookup'
    FROM public.permit_lookups l WHERE l.kind = 'company' AND l.found
    UNION
    SELECT b.builder_key, 'phone', public.permit_phone_digits(b.value), 'lookup'
    FROM public.builder_lookups b
    WHERE b.fact = 'phone' AND b.id NOT IN (SELECT lookup_id FROM wrong_lookups)
  ),
  theirs AS (
    SELECT builder_key, reason, v, heard_from, count(*) OVER (PARTITION BY reason, v) AS holders
    FROM (SELECT builder_key, reason, v, min(heard_from) AS heard_from FROM their_said WHERE v IS NOT NULL AND builder_key IS NOT NULL GROUP BY 1, 2, 3) d
  )
  -- A phone or a domain under more than three names, or held for more than three customers, is a service's
  -- and not a company's: it ties nobody.
  SELECT o.customer_id, t.builder_key, t.reason, t.v, t.heard_from
  FROM ours o
  JOIN theirs t ON t.reason = o.reason AND t.v = o.v
  WHERE o.holders <= 3 AND t.holders <= 3
    AND (p_customer_ids IS NULL OR o.customer_id = ANY (p_customer_ids))
  ORDER BY o.customer_id, t.builder_key, t.reason, t.v;
$$;
COMMENT ON FUNCTION public.permit_name_contact_matches(uuid[]) IS
  'Permits: every customer and name on permits that share a phone or a web domain, one row per pair and value. reason is phone or domain; value is ten digits or the domain; heard_from is permit (the city''s feed) or lookup. A value under more than three names or held for more than three customers ties nobody. With p_customer_ids, those customers only. SECURITY INVOKER: the caller''s own rules on customers and permits apply.';
REVOKE ALL ON FUNCTION public.permit_name_contact_matches(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permit_name_contact_matches(uuid[]) TO authenticated, service_role;
