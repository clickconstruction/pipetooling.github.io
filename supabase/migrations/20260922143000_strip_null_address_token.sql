-- Addresses no longer end in "Null" — the stored rows (v2.2609 fixed the display only).
--
-- Old imports wrote a literal "Null" where the zip belongs ("9703 Lenox Hl
-- San Antonio, TX Null", "… 78751 Null"). Since v2.2609 every list and card
-- strips it at display time, but the lien paper (the § 53.056 notice, the
-- affidavit, the demand letter, the GC run's cover letter) reads the raw
-- column and printed it — found live by the notice preview on 2026-09-21.
-- This strips the trailing token from the stored values, so the row reads
-- the way every screen has shown it for three weeks. Only a trailing
-- ", Null" / " Null" / " null" goes; a real zip stays; "Nullarbor Way" is
-- untouched (the token must be the whole last word). Idempotent: a second
-- run matches nothing.
SET lock_timeout = '3s';

DO $$
DECLARE
  n_jobs int;
  n_addr int;
  n_mail int;
BEGIN
  UPDATE public.jobs_ledger
     SET job_address = regexp_replace(job_address, '[\s,]+null\s*$', '', 'i')
   WHERE job_address ~* '[\s,]null\s*$'
     AND regexp_replace(job_address, '[\s,]+null\s*$', '', 'i') <> '';
  GET DIAGNOSTICS n_jobs = ROW_COUNT;

  UPDATE public.customer_addresses
     SET address = regexp_replace(address, '[\s,]+null\s*$', '', 'i')
   WHERE address ~* '[\s,]null\s*$'
     AND regexp_replace(address, '[\s,]+null\s*$', '', 'i') <> '';
  GET DIAGNOSTICS n_addr = ROW_COUNT;

  UPDATE public.customer_addresses
     SET owner_mailing_address = regexp_replace(owner_mailing_address, '[\s,]+null\s*$', '', 'i')
   WHERE owner_mailing_address ~* '[\s,]null\s*$'
     AND regexp_replace(owner_mailing_address, '[\s,]+null\s*$', '', 'i') <> '';
  GET DIAGNOSTICS n_mail = ROW_COUNT;

  RAISE NOTICE 'strip_null_address_token: jobs_ledger.job_address %, customer_addresses.address %, customer_addresses.owner_mailing_address %', n_jobs, n_addr, n_mail;
END $$;
