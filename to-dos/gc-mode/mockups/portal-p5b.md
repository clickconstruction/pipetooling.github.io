---
name: "P5b: a trade partner company's own papers from its portal (Portal lane)"
rows: PORTAL_REAL_BUILD.md, The PRs in order, item 10 (P5b) and the verbs table (gc_trade_vetting_form, gc_trade_coi, gc_trade_w9; kinds coi, w9, vetting_form); board-b6b.md (the papers' rows, calls C and D); portal-p5a.md (the kind file and gc_trade_files)
branch: this plan on claude/gc-portal-p5b-plan (from origin/spike/gc-mode at 251d18223); the PRs from origin/main when the lead says go
status: plan 2026-10-10 by gc 6 at the lead's ask (GC MODE), for gc 3, who holds the Portal lane, to co-sign. Nothing cut, nothing claimed. Facts read from origin/main de411a24e.
---

# P5b: a company's own papers from its portal

A trade partner company has four papers of its own, on no job: the **master agreement**, the **W-9**, the
**insurance certificate**, and, for a company new to us, the **vetting form**. Since B6-b the office sends the
first three and the portal shows each as a to-do line. The trade can do none of them from its portal. It signs
the master agreement and the W-9 only from the emailed link, and it answers an insurance ask by replying to the
email. P5b lets the trade do all four from its portal.

## What is on main already

- **The papers are rows of `person_contract_documents`** keyed to the company (B6-b-i, `20261010009000`):
  `company_id`, `person_name` = `'gc-company:' || company_id`, `doc_type` `agreement` | `w9` | `coi`, `status`
  `unsent` | `sent` | `signed`, `expires_at`, and `url` for a filed certificate. When one is signed or filed, the
  trigger `gc_company_paper_kept` keeps its promise (`msa`, `w9`, `insurance`).
- **The office's three writes** are dev only and SECURITY INVOKER. `gc_company_paper` makes the company's copy of
  a Contract Book entry. `gc_send_paper` records a send and its promise. `gc_record_company_coi` files a
  certificate with its expiry and https link. `send-contract-for-signature`'s company branch mints a 14-day token
  and emails the `/contract/accept` link. The insurance ask goes by `gc-trade-email` and says *Reply to this
  email with the certificate.* (`coiReply`, `src/lib/gc/paperEmail.ts:29`).
- **The W-9's tax number lives only in the signed PDF.** `accept-contract` fills and flattens the W-9 into the
  private bucket `contract-form-pdfs`, and keeps `form_values` without the sensitive answers and `form_hints`
  with their last four. No column holds the number.
- **The portal's read** (`gc-trade-portal`) already passes each paper's
  `id, company_id, doc_type, status, sent_at, signed_at, expires_at` (`TRADE_PORTAL_FIELDS.papers`,
  `_shared/gcTradePortalSlice.ts:149`), never its link, body or values. It also passes the company's
  `vetting_status, vetting_limit, vetting_decided_on`, never `vetting_note` or `vetting_decided_by`.
  `companyPapers` (`src/lib/gc/companyPapers.ts:46`) maps the rows to `Partner.msa`, `msaSentOn`,
  `msaSignedOn`, `w9` and `coiExpires`.
- **The kernels and the words are lifted.** `portalInsurance`, `portalVetting`, `portalPapers` and `portalTodos`
  are in `src/lib/gc/portal.ts`. Every `paper*`, `vet*`, `coi*`, `w9*`, `cert*` and `todo*` key is in
  `portalI18n.ts`. The home's Needs you draws the papers' to-dos as plain lines that open nothing
  (`GcTradePortalView.tsx:223-226`).
- **The vetting form's table** `gc_company_vetting_forms` (one row a company: `license`, `insurance`,
  `years_in_business`, `reference_list`, `past_jobs`, `sent_on`) is on main under the office team's policy.
  Nothing writes it. The office reads it for companies still `new` (`gcIo.ts:441`), and decides with
  `gc_vet_company`.
- **Not on main:** the spike's `GcPortalPaperwork.tsx` (the block), `GcPortalPapers.tsx` (*Your papers*) and
  `GcPortalAgreement.tsx`; any kind for these papers; any trade verb for them. `gc_trade_files` takes only a
  file on a job (`project_id NOT NULL`, purpose `submittal`, `change`, `quote` or `waiver`).

## What a trade sees

**The paperwork block**, on the portal's home, and on a job's page while a paper the job needs is missing, as the
prototype places it (`GcTradePortal.tsx:269` on the spike, `paperworkMissing`). Anchored `#paperwork`, so a
paper's to-do in Needs you opens it.

```
Your paperwork with Click
──────────────────────────────────────────────────────────────────────────
Your company            not sent yet                [Tell us about your company]
  Click checks a company it has not worked with before. You can quote now…
Master agreement        Click sends it when they pick your quote
                        (once sent)                 [Read and sign]
Insurance certificate   ran out Sep 30 · good to Mar 3, 2027 · runs out in 12 days
                                                    [Send your certificate] / [Send a newer one]
W-9                     none on file                [Fill in your W-9]
                        on file
You sign the master agreement once. Each job after that is a short statement of work.
See every paper →
```

Each line is the prototype's, through the lifted kernels: the vetting line from `portalVetting` (`known` draws
no line), the certificate's chip from `portalInsurance`, the master agreement's from `Partner.msa`.

- **Tell us about your company** opens the form inline: *Your license: its kind and number*, *Your insurance
  company and your limits*, *Years in business*, *Two or three people we can call, with their phone numbers*,
  *Jobs like this one you have done*, then **Send it to Click** and **Not now**. Every line is needed, as on the
  spike. Once sent, the line reads *Click is checking it · sent Oct 10*. A company approved or declined sees
  *approved* (with its limit) or *Click cannot work with you right now*, and no button.
- **Read and sign** (a master agreement the office sent) and **Fill in your W-9** (whether the office sent one
  or not) open the signing page, `/contract/accept`, in the same tab, through the kind `paper_link`: the page
  checks that `signPath` starts with `/contract/accept?` and sets `window.location.href`, as the sub portal's
  `sign_link` does (`SubPortal.tsx:1502-1506`). A new tab opened after the answer comes back is blocked by
  Safari on an iPhone, which is how trades open the portal (gc 3). It is the same page the emailed link opens:
  the master agreement's words, or the W-9 filled on the page, the e-sign consent, and the signature. Back on
  the portal, a reload reads it signed.
- **Send your certificate** opens the spike's form: *A photo or PDF of the certificate* (the P5a-1 picker,
  `GcTradePortalFile.tsx`), *The day the policy runs out* (a year from today to start, `aYearFrom`), **Send it
  to Click** and **Not now**. The file goes up first through the kind `file`, then the kind `coi` files it.
- **See every paper** opens *Your papers* (`portalPapers`, read and print only): the company's papers first,
  then each job's. The W-9 reads *on file* and never its number. Nothing opens a paper's link.

**Left out of the block:** the spike's *Not ready? Tell Click the day it will come.* under an owed paper. No
kind writes a trade's own day for a paper yet (better way 3). The spike's inline W-9 form (name, kind, tax
number, a certify box) and `GcPortalAgreement.tsx` stay on the spike: the real W-9 and master agreement are
signed on `/contract/accept`, one paper system.

## The kinds on `submit-gc-trade-portal`

| Kind | Fields | Verb | Answer | Under the cap |
|---|---|---|---|---|
| `vetting_form` | `license`, `insurance`, `years`, `references`, `pastJobs` | `gc_trade_vetting_form` | `{ ok, value: sent_on }` | no: one row a company, overwritten |
| `paper_link` | `paper`: `msa` or `w9` | `gc_trade_paper_open` | `{ ok, value: { signPath } }` | no |
| `file`, `for: 'coi'` | `name`, `base64` (no record id) | none (P5a-1's `placeFile`) | `{ ok, value: { id, name, url } }` | the file cap, 20 an hour |
| `coi` | `expiresOn` (`YYYY-MM-DD`), `fileUrl` | `gc_trade_coi` | `{ ok }` | no |

- **`paper_link`** mints a token as the sub portal's `sign_link` does (`submit-sub-portal/index.ts:286-322`):
  64 hex characters from two UUIDs, its SHA-256 to the verb with an expiry 14 days out, and
  `/contract/accept?t=<raw>` to the page. The raw token never reaches the database. The newest link wins, so
  the emailed link stops working once the trade opens the paper from its portal (decision B).
- **`file` with `for: 'coi'`** is a company's file on no job. `parseTradeFile` takes it with no record id, and
  `fileHome` claims it for the link's company. Its folder is not a job's: it goes under the jobs Shared Drive's
  root (`DRIVE_JOBS_FOLDER_ID`, a secret every function reads) in **GC trade partners → <company>**, found or
  made by name (decision A). Its name in Drive is the minute it came, as every non-submittal file
  (`2026-10-10 1342 - certificate.pdf`). Its `gc_trade_files` row has no project.
- **`coi`** files the certificate with the link of the company's own upload, never a typed one, and ties the
  upload to the paper.

**The keys** (status, raised by, the words as `portalI18n.ts` holds them, `err<Key>`, with `{gc}` and never a name,
both languages written now; `PORTAL_SPANISH_ON` holds the Spanish back, and each joins `PORTAL_SPANISH.md`'s list):

| Key | Status | Raised by | EN | ES |
|---|---|---|---|---|
| `vetDecided` | 409 | vetting_form | {gc} has decided already. Reload the page. | {gc} ya decidió. Vuelva a cargar la página. |
| `formIncomplete` | 400 | vetting_form | Fill in every line. | Llene cada línea. |
| `msaNotSent` | 409 | paper_link | {gc} sends the master agreement when they pick your quote. | {gc} envía el contrato maestro cuando elige su cotización. |
| `noW9Form` | 409 | paper_link | The W-9 form is not ready yet. Ask {gc} for it. | El formulario W-9 todavía no está listo. Pídaselo a {gc}. |
| `coiDayNeeded` | 400 | coi | Pick the day the policy runs out. | Elija el día que vence la póliza. |
| `coiPast` | 400 | coi | That certificate has run out. Send the current one. | Ese certificado ya venció. Envíe el vigente. |
| `coiTooFar` | 400 | coi | That day is more than three years away. Check the certificate. | Ese día está a más de tres años. Revise el certificado. |
| `certNeeded` | 400 | coi | Add a photo or PDF of the certificate. | Agregue una foto o PDF del certificado de seguro. |
| `alreadySigned` (have) | 409 | paper_link | This is signed already. | Esto ya está firmado. |
| `tooLong` (have) | 400 | vetting_form | That is too long. Make it shorter. | Es demasiado largo. Hágalo más corto. |

Each new key goes in `TRADE_SQL_ERRORS` with its status, `TRADE_ERROR_WORDS` and `portalI18n.ts`. The guard
test that reads every `gc_trade_*` body for its keys covers the three new verbs, so **P5b-m parks the eight new
keys in `WAITING` as `'P5b'`** (`gcTradeSubmit.test.ts:444`, where 13a parked `datesTakenBack` and `dayNeeded`
as `'P5d'`), or main fails between P5b-m and P5b-1. P5b-1 maps them and takes them off; the test fails if one
stays (gc 3).

## P5b-m, the migration

No new table, so no block calls. The three verbs are SECURITY INVOKER, take the link's company first, and are
granted to the service role only, as `gc_trade_sign_sow` is. Claimed at the cut as `20261010140000` (amendment 2).

```sql
SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P5b-m (to-dos/gc-mode/mockups/portal-p5b.md on branch spike/gc-mode): a trade
-- partner company's own papers from its portal. Three verbs the service role calls (submit-gc-trade-portal), each
-- taking the link's company first, and the files ledger widened for a certificate, which is the company's and on no job:
--   - gc_trade_files: purpose 'coi', and a project only on a file that is not a certificate.
--   - gc_trade_coi: the company files its insurance certificate, a signed coi paper with its expiry and the link of its
--     own upload, as gc_record_company_coi files one for the office. gc_company_paper_kept keeps the insurance promise.
--   - gc_trade_vetting_form: a company new to us sends its form, until the office decides.
--   - gc_trade_paper_open: the company opens its master agreement or its W-9 to sign on /contract/accept. It stores the
--     hash of the signing token the function minted, as the sub portal's sign_link does. A W-9 with no paper yet is
--     copied from the Contract Book's W-9 form first, as gc_company_paper copies one for the office.
-- A refusal raises a key the page says in the company's language, as every trade verb does.
-- Doc: docs/migrations/20261010140000_gc_portal_p5b_papers.md.

-- 1) A certificate is the company's, on no job.
ALTER TABLE public.gc_trade_files DROP CONSTRAINT IF EXISTS gc_trade_files_purpose_known;
ALTER TABLE public.gc_trade_files ADD CONSTRAINT gc_trade_files_purpose_known
  CHECK (purpose IN ('submittal', 'change', 'quote', 'waiver', 'coi')) NOT VALID;
ALTER TABLE public.gc_trade_files VALIDATE CONSTRAINT gc_trade_files_purpose_known;
ALTER TABLE public.gc_trade_files ALTER COLUMN project_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_trade_files_job_or_company' AND conrelid = 'public.gc_trade_files'::regclass) THEN
    ALTER TABLE public.gc_trade_files ADD CONSTRAINT gc_trade_files_job_or_company
      CHECK ((purpose = 'coi') = (project_id IS NULL)) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.gc_trade_files VALIDATE CONSTRAINT gc_trade_files_job_or_company;

-- 2) The company files its insurance certificate.
CREATE OR REPLACE FUNCTION public.gc_trade_coi(p_company_id uuid, p_expires_on date, p_file_url text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_url text := public.gc_trade_file_link(p_file_url);
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  IF p_expires_on IS NULL THEN
    RAISE EXCEPTION 'coiDayNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say the day the policy runs out.';
  END IF;
  IF p_expires_on <= public.app_today() THEN
    RAISE EXCEPTION 'coiPast' USING ERRCODE = 'P0001', DETAIL = 'The day the policy runs out has passed.';
  END IF;
  IF p_expires_on > public.app_today() + 1096 THEN
    RAISE EXCEPTION 'coiTooFar' USING ERRCODE = 'P0001', DETAIL = 'The day the policy runs out is more than three years away.';
  END IF;
  -- The link is the company's own upload of a certificate, not yet filed: never a typed link, never another company's.
  IF v_url IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.gc_trade_files f
    WHERE f.company_id = p_company_id AND f.purpose = 'coi' AND f.drive_url = v_url AND f.record_id IS NULL
  ) THEN
    RAISE EXCEPTION 'certNeeded' USING ERRCODE = 'P0001', DETAIL = 'A certificate is a file the company uploaded from its portal.';
  END IF;
  INSERT INTO public.person_contract_documents (
    person_name, company_id, document_name, doc_type, expires_at, url, status, signed_at, contract_lineage_id, lineage_version
  ) VALUES (
    'gc-company:' || p_company_id::text, p_company_id, 'COI (from their portal)', 'coi', p_expires_on, v_url, 'signed', public.app_today(), gen_random_uuid(), 1
  )
  RETURNING id INTO v_id;
  PERFORM public.gc_trade_file_tie(p_company_id, 'coi', v_url, v_id);
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_coi(uuid, date, text) IS
  'GC mode (P5b): a trade partner company files its insurance certificate from its portal, a signed coi paper with its expiry and the link of its own upload (gc_trade_files, purpose coi), tied to the paper. gc_company_paper_kept keeps the insurance promise. Service role only (submit-gc-trade-portal, kind coi). SECURITY INVOKER.';

-- 3) A company new to us sends its vetting form, until the office decides.
CREATE OR REPLACE FUNCTION public.gc_trade_vetting_form(p_company_id uuid, p_license text, p_insurance text, p_years integer, p_references text, p_past_jobs text)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_license text := btrim(coalesce(p_license, ''));
  v_insurance text := btrim(coalesce(p_insurance, ''));
  v_references text := btrim(coalesce(p_references, ''));
  v_past_jobs text := btrim(coalesce(p_past_jobs, ''));
BEGIN
  SELECT c.vetting_status INTO v_status FROM public.gc_companies c WHERE c.id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  -- Null is a company we know (approved); only a company still new sends the form.
  IF v_status IS DISTINCT FROM 'new' THEN
    RAISE EXCEPTION 'vetDecided' USING ERRCODE = 'P0001', DETAIL = 'The office has decided on this company.';
  END IF;
  IF v_license = '' OR v_insurance = '' OR v_references = '' OR v_past_jobs = '' OR p_years IS NULL OR p_years < 0 THEN
    RAISE EXCEPTION 'formIncomplete' USING ERRCODE = 'P0001', DETAIL = 'Every line of the form is needed.';
  END IF;
  IF greatest(char_length(v_license), char_length(v_insurance), char_length(v_references), char_length(v_past_jobs)) > 2000 OR p_years > 200 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'A line is over 2,000 characters, or the years over 200.';
  END IF;
  INSERT INTO public.gc_company_vetting_forms (company_id, license, insurance, years_in_business, reference_list, past_jobs, sent_on)
  VALUES (p_company_id, v_license, v_insurance, p_years, v_references, v_past_jobs, public.app_today())
  ON CONFLICT (company_id) DO UPDATE SET
    license = EXCLUDED.license,
    insurance = EXCLUDED.insurance,
    years_in_business = EXCLUDED.years_in_business,
    reference_list = EXCLUDED.reference_list,
    past_jobs = EXCLUDED.past_jobs,
    sent_on = EXCLUDED.sent_on;
  RETURN public.app_today();
END;
$$;

COMMENT ON FUNCTION public.gc_trade_vetting_form(uuid, text, text, integer, text, text) IS
  'GC mode (P5b): a trade partner company new to us (vetting_status new) sends its vetting form from its portal, written to gc_company_vetting_forms, a second send replacing the first. Refused once the office decides. Service role only (submit-gc-trade-portal, kind vetting_form). SECURITY INVOKER.';

-- 4) The company opens its master agreement or its W-9 to sign.
CREATE OR REPLACE FUNCTION public.gc_trade_paper_open(p_company_id uuid, p_paper text, p_token_hash text, p_expires_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_entry public.contract_template_documents%ROWTYPE;
  v_id uuid;
BEGIN
  IF coalesce(p_paper, '') NOT IN ('msa', 'w9') OR coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' OR p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'A paper is msa or w9, with a token hash and a later expiry.';
  END IF;
  -- One press at a time a company, so two presses never copy two W-9s.
  PERFORM 1 FROM public.gc_companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  v_type := CASE p_paper WHEN 'msa' THEN 'agreement' ELSE 'w9' END;
  -- The newest of its papers of that kind still to sign: a master agreement the office sent, a W-9 sent or not.
  SELECT d.id INTO v_id FROM public.person_contract_documents d
  WHERE d.company_id = p_company_id AND d.doc_type = v_type
    AND (d.status = 'sent' OR (p_paper = 'w9' AND d.status = 'unsent'))
  ORDER BY d.created_at DESC, d.id
  LIMIT 1
  FOR UPDATE;
  IF v_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.person_contract_documents d WHERE d.company_id = p_company_id AND d.doc_type = v_type AND d.status = 'signed') THEN
      RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'The company has signed this paper.';
    END IF;
    IF p_paper = 'msa' THEN
      RAISE EXCEPTION 'msaNotSent' USING ERRCODE = 'P0001', DETAIL = 'The office has not sent the master agreement.';
    END IF;
    -- The Contract Book's W-9, as loadCompanyPaperEntries finds it: the first sub entry whose form is a W-9.
    SELECT e.* INTO v_entry FROM public.contract_template_documents e
    JOIN public.contract_form_templates f ON f.id = e.form_template_id
    WHERE e.audience = 'sub' AND f.doc_type = 'w9'
    ORDER BY e.sequence_order
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'noW9Form' USING ERRCODE = 'P0001', DETAIL = 'The Contract Book has no W-9 form for subs.';
    END IF;
    -- gc_company_paper's insert; the form trigger stamps the W-9's doc_type.
    INSERT INTO public.person_contract_documents (
      person_name, company_id, document_name, contract_lineage_id, lineage_version, supersedes_person_contract_document_id,
      status, canonical_document_url, signing_body_html, signing_body_format, applied_contract_template_document_id
    ) VALUES (
      'gc-company:' || p_company_id::text, p_company_id, v_entry.document_name, gen_random_uuid(), 1, NULL,
      'unsent', nullif(btrim(coalesce(v_entry.canonical_document_url, '')), ''), v_entry.book_body_html, v_entry.book_body_format, v_entry.id
    )
    RETURNING id INTO v_id;
  END IF;
  UPDATE public.person_contract_documents
  SET status = 'sent',
      sent_at = coalesce(sent_at, now()),
      public_token_hash = p_token_hash,
      public_token_expires_at = p_expires_at
  WHERE id = v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_paper_open(uuid, text, text, timestamptz) IS
  'GC mode (P5b): a trade partner company opens its master agreement (one the office sent) or its W-9 (copied from the Contract Book''s W-9 form when it has none) to sign on /contract/accept: the paper is sent, with the hash of the token the function minted, the newest link winning. Service role only (submit-gc-trade-portal, kind paper_link). SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_trade_coi(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gc_trade_vetting_form(uuid, text, text, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gc_trade_paper_open(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_coi(uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gc_trade_vetting_form(uuid, text, text, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gc_trade_paper_open(uuid, text, text, timestamptz) TO service_role;
```

**Locks.** `gc_trade_files` takes two short locks (a CHECK swapped, the NOT NULL dropped); only the portal's
`file` kind writes it. The functions take none. Either batch works.

**The bed** (`supabase/tests/gc_portal_p5b/` with its `scripts/pgtest-gc-portal-p5b.sh`, one line `gc-portal-p5b` in `scripts/sql-beds.txt`):

- `gc_trade_coi`: each refusal in order (no company, no day, a day passed, a day four years out, a typed link,
  another company's upload, an upload already filed, a link that is not https as `badRequest`); a good one
  writes a signed `coi` paper with its expiry and link, ties the upload, and keeps the open insurance promise;
- `gc_trade_vetting_form`: a known company (null) and a decided one refused `vetDecided`; a blank line and
  negative years `formIncomplete`; a line over 2,000 `tooLong`; a new company's form written with `app_today()`,
  and a second send replacing it;
- `gc_trade_paper_open`: a bad paper, hash or expiry `badRequest`; a master agreement never sent `msaNotSent`,
  one sent opened with the hash and expiry, one the office made and never sent `msaNotSent` (decision C), one
  signed `alreadySigned`, another company's never found; a W-9
  with none copied once from the Book's W-9 and stamped `w9` by the form trigger, a second press re-opening the
  same row with the new hash, and a Book with no W-9 form `noW9Form`;
- `gc_trade_files`: a `coi` row with no project kept, a `coi` row with a project and a `quote` row with none
  refused;
- the grants: `authenticated` refused on all three, the service role allowed.

By HELPERS.md's rule, the PR also runs every bed that touches what it changes: `gc-portal-p5a` (P5a's,
`gc_trade_files` and `gc_trade_file_tie`) and `gc-papers` (the keep trigger, `gc_record_company_coi`).

## The read and the page (P5b-1)

- **The slice** gains `vettingForm`: the company's own `gc_company_vetting_forms` row, its `sent_on` only, so
  `portalVetting` reads *checking* once it is sent. The answers do not pass: the office reads them, and the trade
  types a new form only while it is still new. The never-sees test plants a marked `vetting_note`,
  `vetting_decided_by`, a vetting answer, a paper's `url`, `form_values`, `form_hints` and
  `public_token_hash`, and another company's paper and form. None may appear.
- **The mapper** (`tradePortalState.ts`, `partnerOf`) sets `vetting.form` from it (`sentOn`, the answers empty).
- **`GcTradePortalPapers.tsx`**, ported from the spike's `GcPortalPaperwork.tsx` and `GcPortalPapers.tsx`, with
  `dispatch` swapped for the portal's press hook (`usePress`, `gcTradePortalPress.ts`), as P1b did: the block, the vetting form, the
  two signing buttons and *Your papers*. Its window rules hold for *Your papers* (the five window checks).
- **Needs you**: a paper's to-do (`projectId` null) opens `#paperwork` on the home.
- **The certificate's line** shows its chip and no button until P5b-2. A block whose kind is not live is hidden
  (`PORTAL_REAL_BUILD.md`).
- **The signing page's dead link** (gc 3, decision B): `/contract/accept` says the bare *Not found* when a token
  was replaced (`get-contract-for-signer` answers 404, `ContractAccept.tsx` shows its `error`). P5b-1 makes the
  page say, on a 404, *This link no longer works. A newer link may have replaced it. Ask the office for a new
  link.* It is the whole app's signing page, read by employees, subs and customers with no portal, and a dead
  token cannot say whose paper it was, so the words name no portal and no company (gc 3, amendment 2).

## The certificate (P5b-2)

**The owner's call 3, 2026-10-10: "Office looks first."** A certificate the trade sends from its portal lands as
**received**. It counts for nothing until the office marks it good from the company's Documents tab: not the start
gate, not Follow up, not the insurance promise. *COI (from their portal)* on the Documents tab stays the office's
cue, with one press beside it, **Mark it good** (amendment 3).

**What the trade does and reads:**

- **Send your certificate** opens the form (unchanged): *A photo or PDF of the certificate* (the P5a-1 picker),
  *The day the policy runs out* (a year out to start), **Send it to Click**, **Not now**. The file goes up through the
  kind `file` (`for: 'coi'`), then the kind `coi` files it.
- **While it waits**, the certificate's line reads *Click is checking it · sent Oct 10* (`coiChecking`, en
  *{gc} is checking it · sent {date}*, es *{gc} lo está revisando · enviado el {date}*, the vetting line's words for
  a certificate), with no button. A certificate that ran out still reads so beside it until the office looks.
- **Needs you** drops the certificate's to-do while one waits (`portalTodos` reads `coiReceivedOn`), so the trade is
  not asked twice. Once the office marks it good, the line reads *good to <day>* as any certificate does.
- **Sending another while one waits** replaces the waiting one: the same paper takes the new link and day.

**What the office does:** the company window's **Documents** tab shows the waiting certificate as
*COI (from their portal)* · *came in Oct 10* · *good to <the day they typed>*, with its Drive link and
{{button:blue|Mark it good}}. The press signs it with today's day, and the keep trigger keeps the insurance promise in
the same transaction. Until then the insurance row still reads as owed, Follow up still lists it, and **Get started**
still waits on it, as the owner said. **Record their insurance** stays for a certificate that comes by email.

**P5b-2m, one migration**, cut first and pushed in the evening (it swaps a CHECK on `person_contract_documents`, a
live table, as B6-b-i did). `gc_trade_coi` (P5b-m, #5351) is called by nothing until P5b-2, so no certificate is ever
filed as signed by the trade; this migration redefines it before its kind ships. #5351 stays as it is.

```sql
SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P5b-2m (to-dos/gc-mode/mockups/portal-p5b.md, amendment 3, on branch spike/gc-mode):
-- the owner's call 3, "Office looks first." A certificate the trade sends from its portal lands as received and counts
-- for nothing (the start gate, Follow up, the insurance promise) until the office marks it good from the company's
-- Documents tab:
--   - person_contract_documents.status gains 'received', held to a company's certificate;
--   - gc_trade_coi files the trade's certificate as received, with the time it came in (sent_at), one waiting at a time:
--     a second send replaces the first; it keeps no promise (gc_company_paper_kept fires only on 'signed');
--   - gc_mark_company_coi_good, the office's one press: a received certificate signed with today's day, which the keep
--     trigger turns into the insurance promise kept.
-- Doc: docs/migrations/<stamp>_gc_portal_p5b_coi_received.md.

-- 1) A received certificate: a status only a company's certificate takes.
ALTER TABLE public.person_contract_documents DROP CONSTRAINT IF EXISTS person_contract_documents_status_check;
ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_status_check
  CHECK (status IN ('unsent', 'sent', 'signed', 'received')) NOT VALID;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_status_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_received_is_a_company_coi' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_received_is_a_company_coi
      CHECK (status <> 'received' OR (company_id IS NOT NULL AND doc_type = 'coi')) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_received_is_a_company_coi;

-- 2) The trade's certificate lands as received. Its refusals are P5b-m's, word for word.
CREATE OR REPLACE FUNCTION public.gc_trade_coi(p_company_id uuid, p_expires_on date, p_file_url text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_url text := public.gc_trade_file_link(p_file_url);
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  IF p_expires_on IS NULL THEN
    RAISE EXCEPTION 'coiDayNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say the day the policy runs out.';
  END IF;
  IF p_expires_on <= public.app_today() THEN
    RAISE EXCEPTION 'coiPast' USING ERRCODE = 'P0001', DETAIL = 'The day the policy runs out has passed.';
  END IF;
  IF p_expires_on > public.app_today() + 1096 THEN
    RAISE EXCEPTION 'coiTooFar' USING ERRCODE = 'P0001', DETAIL = 'The day the policy runs out is more than three years away.';
  END IF;
  -- The link is the company's own upload of a certificate, not yet filed: never a typed link, never another company's.
  IF v_url IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.gc_trade_files f
    WHERE f.company_id = p_company_id AND f.purpose = 'coi' AND f.drive_url = v_url AND f.record_id IS NULL
  ) THEN
    RAISE EXCEPTION 'certNeeded' USING ERRCODE = 'P0001', DETAIL = 'A certificate is a file the company uploaded from its portal.';
  END IF;
  -- One waiting at a time: a second send replaces the first, which the office has not looked at.
  SELECT d.id INTO v_id FROM public.person_contract_documents d
  WHERE d.company_id = p_company_id AND d.doc_type = 'coi' AND d.status = 'received'
  ORDER BY d.created_at DESC, d.id
  LIMIT 1
  FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.person_contract_documents (
      person_name, company_id, document_name, doc_type, expires_at, url, status, sent_at, contract_lineage_id, lineage_version
    ) VALUES (
      'gc-company:' || p_company_id::text, p_company_id, 'COI (from their portal)', 'coi', p_expires_on, v_url, 'received', now(), gen_random_uuid(), 1
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.person_contract_documents SET expires_at = p_expires_on, url = v_url, sent_at = now() WHERE id = v_id;
  END IF;
  PERFORM public.gc_trade_file_tie(p_company_id, 'coi', v_url, v_id);
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_coi(uuid, date, text) IS
  'GC mode (P5b-m, received since P5b-2m): a trade partner company sends its insurance certificate from its portal, a coi paper received with its expiry, the link of its own upload (gc_trade_files, purpose coi) and the time it came in, one waiting at a time. It counts for nothing until the office marks it good (gc_mark_company_coi_good). Service role only (submit-gc-trade-portal, kind coi). SECURITY INVOKER.';

-- 3) The office marks it good: signed with today's day, which keeps the insurance promise (gc_company_paper_kept).
CREATE OR REPLACE FUNCTION public.gc_mark_company_coi_good(p_paper_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_doc record;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev sends a trade its papers while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT d.id, d.status, d.doc_type, d.company_id, d.expires_at INTO v_doc
  FROM public.person_contract_documents d WHERE d.id = p_paper_id FOR UPDATE;
  IF NOT FOUND OR v_doc.company_id IS NULL OR v_doc.doc_type <> 'coi' OR v_doc.status <> 'received' THEN
    RAISE EXCEPTION 'That certificate is not waiting for a look.' USING ERRCODE = 'P0001';
  END IF;
  IF v_doc.expires_at IS NULL OR v_doc.expires_at <= public.app_today() THEN
    RAISE EXCEPTION 'That certificate has run out. Ask them for the current one.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today() WHERE id = p_paper_id;
END;
$$;

COMMENT ON FUNCTION public.gc_mark_company_coi_good(uuid) IS
  'GC mode (P5b-2m): the office marks a certificate a trade partner sent from its portal good, from the company''s Documents tab: received to signed with today''s day; gc_company_paper_kept keeps the insurance promise. Dev only until the papers'' door. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_mark_company_coi_good(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_mark_company_coi_good(uuid) TO authenticated;
```

`gc_trade_coi` keeps its signature, so its grant (the service role alone) stands. The bed `gc-portal-p5b` changes in
the same PR, as HELPERS.md's rule for a redefined verb asks: its certificate cases expect *received* with the
promise still open, a second send replacing the first, and **Mark it good** (refused to a non-dev, to a paper that is
not a waiting certificate, and to one run out; then signed with today's day and the insurance promise kept);
`person_contract_documents` refuses `received` on a person's paper and on a company's W-9. Its script re-applies
P5b-2m after P5b-m, so its schema is main's. `gc-papers` runs with it.

**P5b-2, the code**, after P5b-2m is on prod and its types:

- `parseTradeFile`'s `for` gains `coi`, with no record id; `fileHome` claims it for the link's company with no
  job, its answer's `projectId` and `packageId` now `string | null`; `tradeFileFolders('coi', company)` is
  `['GC trade partners', <company>]` under `DRIVE_JOBS_FOLDER_ID` in place of the job's folder. A missing root is
  `failed`, logged, as a missing service account is; a certificate is never `noJobFolder`. The upload is
  `made_by` `trade`, so it counts under P5a-1's file cap (a signed waiver, `portal`, does not).
- The kind `coi` (`expiresOn`, `fileUrl`) and its form.
- `companyPapers` gains `coiReceived` (the waiting certificate: its id, the day it came in from `sent_at`, and the day
  the trade typed), and the mapper sets `Partner.coiReceivedOn`; `coiExpires` still reads only a signed certificate,
  so the start gate and every other reader are unchanged. `portalTodos` skips the certificate's to-do while one waits.
- The portal's certificate line reads `coiChecking` while one waits.
- The Documents tab's waiting row and **Mark it good** (`markCompanyCoiGood` in `papersIo.ts`, after which the board
  reloads), in the Board's files with gc 2's nod.
- **The office's insurance ask** (`paperEmail.ts`) says *Send it from your portal with the link below. Or reply
  to this email with it.* (es *Envíelo desde su portal con el enlace de abajo. O responda a este correo con él.*)
  in place of `coiReply`, **only when the email carries the company's portal link**; with none it keeps
  *Reply to this email with the certificate.* (gc 2). Both are pinned in `paperEmail`'s tests, and the sample
  email in `customerSampleEmails` follows if it shows this ask. The flip is `COI_PORTAL_LIVE` in `paperEmail.ts`,
  true in this PR, as `DRAW_PORTAL_LIVE` flipped with its screens.

## Who owns what (the seams, for gc 3 to co-sign)

| Piece | Owner |
|---|---|
| The migration, the three verbs and the bed | this plan (P5b-m) |
| `submit-gc-trade-portal`, `_shared/gcTradeSubmit.ts`, `_shared/gcTradeFile.ts`, `gc-trade-portal`, the slice, the sample | Portal (gc 3); P5b edits them after P5a-2 (#5340) merges, and rebases over the waiver flip |
| `tradePortalState.ts`, `GcTradePortalView.tsx`'s Needs you | Portal (gc 3) |
| `paperEmail.ts`'s certificate words, the Documents tab | the Board (gc 2): one sentence in P5b-2, its nod asked |
| The office's vetting screen (`GcVetting.tsx`) reading the form | the Board, unchanged |
| The deploys (`gc-trade-portal`, `submit-gc-trade-portal`) and the push | the lead |

## The PRs, in order

Each is cut from `origin/main` once the one before it is in, claimed at the cut, with its release note, fragment
and docs, and armed with `gh pr merge <n> --auto`.

0. **P5b-m, the migration and its bed.** *Check:* the doc's verify steps through the management API, each in
   `BEGIN … ROLLBACK`: the two CHECKs read back, `authenticated` refused on the three verbs, and the service
   role's `gc_trade_paper_open` on the test company's W-9 copying the Book's W-9, then rolled back.
1. **P5b-1, the block, the vetting form and the two signing links** (after P5b-m on prod and its types). The
   kinds `vetting_form` and `paper_link`, their keys, the slice's `vettingForm`, the mapper, the block, *Your
   papers*, Needs you's to-dos. *Check:* on the test company's link, the block reads its papers as the
   Documents tab holds them; **Fill in your W-9** opens `/contract/accept` with the company's name filled.
   Every press waits for the owner's yes (below).
2. **P5b-2m, a certificate received until the office looks** (migration, an evening push; amendment 3).
   *Check:* the doc's verify steps, each in `BEGIN … ROLLBACK`: the two CHECKs read back validated, a person's paper
   refused `received`, and `gc_mark_company_coi_good` refused to a non-dev.
3. **P5b-2, the certificate** (after P5b-2m on prod and its types). The file's `coi`, the kind `coi`, the form, the
   waiting line, the Documents tab's **Mark it good**, `COI_PORTAL_LIVE` and the ask's words. *Check:* a test PDF
   lands in **GC trade partners → GC test trade company, delete me**; the portal reads *Click is checking it*; the
   Documents tab shows it waiting, the insurance promise still open; **Mark it good** keeps the promise and the
   line reads *good to <day>*.

## Tests

- **P5b-m**: the bed above.
- **P5b-1**: `parseTradeSubmit` for `vetting_form` (trimmed lines, years as a whole number) and `paper_link`
  (only `msa` or `w9`); the token's shape and its hash; the never-sees test; the mapper's `vetting.form`; the
  block drawn in each state (vetting new, checking, approved, declined, known; the master agreement none, sent,
  signed; the W-9 on file or not); the presses posting their bodies; a refusal in the company's words; the
  preview posting nothing; each new sentence through `plainWordsFailures`.
- **P5b-2**: `parseTradeFile` with `for: 'coi'` and no record id; `tradeFileFolders('coi', …)`; the kind `coi`
  (the date's shape, the link); the form says a file too big before it sends; `paperEmail`'s ask before and
  after the flip.

## Docs

- `EDGE_FUNCTIONS.md`: `submit-gc-trade-portal`'s three kinds, the file's `coi` and their keys;
  `gc-trade-portal`'s `vettingForm`.
- `ACCESS_CONTROL.md`: the Portal's bullet in the door paragraph (its own bullet, blank lines kept, as HELPERS.md
  says) for the three verbs (service role only) and the trade's papers.
- `PROJECT_DOCUMENTATION.md`'s trade portal paragraph; `docs/DRIVE_INTAKE_SETUP.md` (the **GC trade partners**
  folder); `GLOSSARY.md` (vetting form, if it has no line).
- The guides: `share-a-trade-partner-its-portal` (what the trade does with its papers) and `send-a-trade-its-papers`
  (the trade can sign or send each from its portal; **Record their insurance** for one that comes by email).
- `docs/migrations/20261010140000_gc_portal_p5b_papers.md`. A release note and fragment for each PR.

## The live check

Every press writes prod: the vetting form a row, **Fill in your W-9** a paper and its token (a new W-9 row on
the test company when it has none), a certificate a Drive file and a paper. Each waits for the owner's yes, typed
in the pressing helper's own chat. A relayed yes is no yes. The vetting form needs a company whose status is
`new`; if the test company is approved, the check makes a second test company named *… delete me*, and its id
goes to the lead for call 4's sweep. No press sends an email.

## Decisions (defaults; say if any is wrong)

A. **Where a certificate goes in Drive**: **GC trade partners → <company>** under the jobs Shared Drive's root.
   A certificate is the company's, on no job, and the office finds every company's papers in one place. *The
   other way:* the newest job's **Team only → From trades → <company>**. Not taken: a company with no job yet
   could not send one, and its papers would scatter across jobs.
B. **The newest signing link wins**, as the sub portal's `sign_link` and the office's resend do. A token is minted
   only on the trade's press, so the emailed link stops working only once the trade opens the paper from its
   portal, and then the page says so in plain words (P5b-1). *The other ways* (gc 2's ask, 2026-10-10): sign
   from the portal on the portal's own proof, or a second token column, so the emailed link lives on. Not
   taken: either changes the app's shared signing functions (`get-contract-for-signer`, `accept-contract`) or
   `person_contract_documents`, a live table, for a link the trade has already left for its portal. The lead's
   call, put to it again with gc 2's ask.
C. **A master agreement opens from the portal only once the office sent it.** A W-9 opens any time, and is copied
   from the Book when the company has none, as the prototype lets a trade fill its W-9 unasked. An `unsent`
   master agreement reads *Click sends it when they pick your quote*, as `companyPapers` reads it.
D. **The W-9 and the master agreement are signed on `/contract/accept`**, the page the email opens: one paper
   system, the tax number only in the signed PDF. The spike's inline W-9 form and `GcPortalAgreement.tsx` are not
   lifted.
E. **No hourly cap on `vetting_form` and `paper_link`.** Each writes one row a company, overwritten. A
   certificate's upload counts under the file cap.
F. **A certificate's day**: after today and at most three years out. The form starts a year from today.
G. **The vetting form's answers never pass back to the portal.** Only its day does.

## The owner's calls

1. **The live checks**: the owner's yes, typed in the pressing helper's chat, before any press on the test link.
2. **The Drive folder** (decision A): *GC trade partners* at the root of the jobs Shared Drive.
3. ~~**A certificate from the portal counts as in at once**~~ **Answered 2026-10-10: "Office looks first."** A
   certificate from the portal lands as *received* and counts for nothing (the start gate, Follow up, the insurance
   promise) until the office presses **Mark it good** on the Documents tab (amendment 3).

## Is this the best we can do?

Three ways it could be better:

1. **Sign in the portal itself**, as the statement of work signs (`GcTradePortalSow.tsx`, the kind `sign_sow`),
   with no new tab. *My pick: not now.* The W-9's form, its tax number's handling and its signed PDF live in the
   Contract Forms flow, and a second signing path would be a second paper system.
2. **Read the certificate's day off the PDF** (an ACORD 25 has it in its text layer) and the insurer's name, so
   the trade types nothing. *My pick: later*, beside the plan's PDF reading (`src/lib/pdfjsDocument.ts`). The
   typed day with a year's start is the prototype's.
3. **The trade's own day for a paper**, the spike's *Not ready? Tell Click the day it will come.*, as a kind that
   moves the paper's promise (`gc_record_promise` with source trade). *My pick: next, as its own small PR on the
   owner's word*, since it reaches Follow up's call list and the board's counts.

## Status

Planned 2026-10-10 by gc 6, read from origin/main de411a24e. Waits on gc 3's co-sign and the lead's read-back.

**Amendment 1, 2026-10-10, with gc 3's co-sign and gc 2's nod** (after the lead's approval at e664fb89a): the
signing page opens in the same tab; the words take `{gc}` and both languages now; P5b-m parks the eight keys
in `WAITING`; `fileHome`'s answer may have no job; `coiPast` reads *That certificate has run out. Send the
current one.*; the insurance ask's new line only with the portal link; the signing page's dead link in plain
words; decision B put to the lead again with gc 2's ask; the owner's call 3. gc 2 checked: `gc_trade_coi` sets
`signed_at` to the upload day, as `gc_record_company_coi` does, so `companyPapers` sorts it newest; and the
office's W-9 send reuses the one the trade opened, since `gc_company_paper` finds the company's newest copy by
the Book entry's name. gc 2 will make `paperStep` say *Started in their portal <day>* for a sent W-9 with no send.

**Amendment 2, 2026-10-10, at the cut**: P5b-m is cut as v2.5191 with migration `20261010140000_gc_portal_p5b_papers`
(both claimed on `claude/gc-portal-p5b-m`), and the stamp is filled in the SQL block above, which the migration equals
byte for byte. The bed adds the master agreement the office made and never sent (decision C) and was proved by six
mutants. The signing page's dead-link words name no portal (gc 3).

**Amendment 3, 2026-10-10, on the owner's call 3 ("Office looks first", through the lead)**: P5b-2 becomes two PRs.
P5b-2m adds `received` to `person_contract_documents.status`, held to a company's certificate, redefines
`gc_trade_coi` to file the trade's certificate as received (one waiting at a time, a second send replacing it), and
adds the office's `gc_mark_company_coi_good`. P5b-2 ships the kind, the trade's *Click is checking it* line, Needs
you's dropped to-do while it waits, and the Documents tab's **Mark it good**. #5351's `gc_trade_coi` is called by
nothing until then, so it stays as merged. P5b-1 is unchanged.
