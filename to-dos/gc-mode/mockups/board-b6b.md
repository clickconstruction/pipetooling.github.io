---
name: "B6-b: a trade partner company's papers (the master agreement, the W-9, the insurance certificate) and every send of a paper"
rows: board-b6.md (section 3, call 5; The PRs, in order, B6-b); BOARD_REAL_BUILD.md (decision 5, B6-b); the reader audit board-b6-reader-audit.md, brought to origin/main c049ce2f1
branch: this plan on spike/board-b6b-plan (from origin/spike/gc-mode); the PRs from origin/main when the lead says go
status: plan 2026-10-09 by Helper 12 (the Board lane). The lead approved the read-back the same morning (two PRs; call 5 yes with the three additions and the six display guards; S = A with a pin test; R accepted; B by name and doc_type). Nothing cut or claimed.
---

# B6-b: a company's papers

## What it is

- **B6-b-i, the papers in the database** (one migration, three edge functions, two client guards, no GC screen):
  - `person_contract_documents.company_id`, with a CHECK both ways and the person trigger keeping a company's paper free of any person.
  - `gc_paper_sends`, every send of a paper, and `gc_send_paper`, which records a send and its promise in one transaction.
  - `gc_company_paper`, which makes a company's copy of one Contract Book entry (the Master Subcontract Agreement, or the W-9 form).
  - The six places a company's paper would show its stored name, guarded before any company row can exist.
  - `send-contract-for-signature` learns a company branch (call S, A): the signing link goes to the company's contracts people in GC's words.
- **B6-b-ii, the screens** (no migration): the mapper reads a company's papers; the company window's Documents tab; Send a paper; Record their insurance; the guide "send a trade its papers".

## The reader audit, brought to main (2026-10-09, origin/main c049ce2f1)

Nothing that touches `person_contract_documents` changed since the audit (a1137d746). Four facts it adds:

1. **The CHECK in board-b6.md holds one way only.** A row named `gc-company:…` with `company_id` null passes it, and `create_pending_contract_versions_after_book_save` (baseline :3411-3435) copies `person_name` into new versions without any `company_id`. Hence the CHECK both ways and the trigger below.
2. **The person trigger fires on `person_name` only** (`20260801200000:58-61`), so a change to `company_id` alone would not pass through it. It now fires on both.
3. **`resolve_pay_person_id('gc-company:…')` already returns null** (`20260722268000:35-51`): no person can match the name. The trigger says so explicitly anyway.
4. **Six places would show the stored name** `gc-company:<uuid>`:
   - People → Contracts' Agreements panel (`contractsAgreementsPanel.ts:96-126`, fed every row at `PeopleContractsTab.tsx:647-651`, which would also count it in the totals);
   - the signed record's "For:" line (`PersonContractSignedRecordModal.tsx:310`, opened only from that tab);
   - the signing email's "For" line (`_shared/contractSigningEmail.ts:133,173`);
   - the sent copy's recipient name (`send-contract-for-signature:306-309`);
   - the W-9's name box, prefilled from `person_name` (`get-contract-for-signer:159-164`);
   - the form PDF's download name (`open-contract-form-pdf:80`).
   Every other name-keyed reader drops a name no roster has.

## B6-b-i's SQL

```sql
SET lock_timeout = '3s';

-- GC mode, the Board's B6-b-i (to-dos/gc-mode/mockups/board-b6b.md on spike/gc-mode): a trade partner company's papers
-- (the master agreement, the W-9, the insurance certificate) are rows of person_contract_documents keyed to the company,
-- under a name no person can have, and every send of a paper is a gc_paper_sends row. Call 5, with the reader audit's
-- additions: the CHECK both ways, the person trigger deriving the company and firing on it, and no
-- person_contract_assignments row for a company.

-- 1) A paper's company.
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.gc_companies(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_person_contract_documents_company
  ON public.person_contract_documents (company_id) WHERE company_id IS NOT NULL;

COMMENT ON COLUMN public.person_contract_documents.company_id IS
  'GC mode (B6-b-i): the trade partner company this paper is for. Its person_name is then ''gc-company:'' || company_id, which no person can have, and person_id is null.';

-- 2) Both ways: a company's paper carries its company's name and no person, and that name never stands without its company.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_company_paper' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_company_paper
      CHECK (
        (company_id IS NULL AND person_name NOT LIKE 'gc-company:%')
        OR (company_id IS NOT NULL AND person_id IS NULL AND person_name = 'gc-company:' || company_id::text)
      ) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_company_paper;

-- 3) The person trigger: a company's paper keeps no person, and a copy that lost its company (the Book's new versions
-- copy person_name only) takes it back from the name. It fires on company_id too.
CREATE OR REPLACE FUNCTION public.contract_docs_set_person_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.person_name ~ '^gc-company:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    NEW.company_id := substr(NEW.person_name, 12)::uuid;
  END IF;
  IF NEW.company_id IS NOT NULL THEN
    NEW.person_id := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.person_id IS NULL THEN
      NEW.person_id := public.resolve_pay_person_id(NEW.person_name);
    END IF;
  ELSE
    IF NEW.person_id IS NOT DISTINCT FROM OLD.person_id THEN
      NEW.person_id := public.resolve_pay_person_id(NEW.person_name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER set_person_id_on_write
  BEFORE INSERT OR UPDATE OF person_name, company_id ON public.person_contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.contract_docs_set_person_id();

-- 4) Every send of a paper (PaperSend): the day it went, the day we asked for it by, our line, and whether it was the
-- first send of a master agreement or a statement of work. A waiver's ask names the draws it covers.
CREATE TABLE IF NOT EXISTS public.gc_paper_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  paper text NOT NULL
    CONSTRAINT gc_paper_sends_paper_known CHECK (paper IN ('msa', 'sow', 'insurance', 'w9', 'waiver')),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  -- PaperSend.on and PaperSend.by ("on" is a reserved word).
  sent_on date NOT NULL DEFAULT public.app_today(),
  due_on date NOT NULL,
  note text NOT NULL DEFAULT '',
  first boolean NOT NULL DEFAULT false,
  draws integer[],
  sent_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A statement of work and a waiver are one trade's on one job; the company's own papers are not.
  CONSTRAINT gc_paper_sends_job_paper CHECK ((paper IN ('sow', 'waiver')) = (package_id IS NOT NULL)),
  CONSTRAINT gc_paper_sends_trade_on_a_job CHECK (package_id IS NULL OR project_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_gc_paper_sends_company ON public.gc_paper_sends (company_id, sent_on);

COMMENT ON TABLE public.gc_paper_sends IS
  'GC mode (B6-b-i): every send of a paper to a trade partner company (PaperSend), written by gc_send_paper with its promise.';

ALTER TABLE public.gc_paper_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_paper_sends_dev ON public.gc_paper_sends;
CREATE POLICY gc_paper_sends_dev ON public.gc_paper_sends FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
REVOKE ALL ON public.gc_paper_sends FROM anon;

-- 5) A send and its promise, in one transaction: the prototype's sendPaper. The promise moves if one is open, as
-- gc_record_promise does. The first master agreement's own row is gc_company_paper's, before this.
CREATE OR REPLACE FUNCTION public.gc_send_paper(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company uuid := nullif(btrim(coalesce(p->>'companyId', '')), '')::uuid;
  v_paper text := btrim(coalesce(p->>'paper', ''));
  v_project uuid := nullif(btrim(coalesce(p->>'projectId', '')), '')::uuid;
  v_pkg uuid := nullif(btrim(coalesce(p->>'packageId', '')), '')::uuid;
  v_due date := nullif(btrim(coalesce(p->>'dueOn', '')), '')::date;
  v_draws integer[];
  v_id uuid;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev sends a trade its papers while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;
  IF v_company IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = v_company) THEN
    RAISE EXCEPTION 'No company with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_paper NOT IN ('msa', 'sow', 'insurance', 'w9', 'waiver') THEN
    RAISE EXCEPTION 'That is not a paper we send.' USING ERRCODE = 'P0001';
  END IF;
  IF (v_paper IN ('sow', 'waiver')) <> (v_pkg IS NOT NULL) THEN
    RAISE EXCEPTION 'A statement of work or a waiver is for one trade on a job.' USING ERRCODE = 'P0001';
  END IF;
  IF v_due IS NULL THEN
    RAISE EXCEPTION 'Pick the day to ask for it by.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p->'draws') = 'array' THEN
    v_draws := ARRAY(SELECT jsonb_array_elements_text(p->'draws')::integer);
  END IF;

  INSERT INTO public.gc_paper_sends (company_id, paper, project_id, package_id, due_on, note, first, draws)
  VALUES (v_company, v_paper, v_project, v_pkg, v_due, btrim(coalesce(p->>'note', '')), coalesce((p->>'first')::boolean, false), v_draws)
  RETURNING id INTO v_id;

  -- Its promise (paperStep's promiseKind: a waiver's is closeout), moved if one is open.
  PERFORM public.gc_record_promise(jsonb_build_object(
    'companyId', v_company,
    'kind', CASE v_paper WHEN 'waiver' THEN 'closeout' ELSE v_paper END,
    'projectId', v_project,
    'packageId', v_pkg,
    'dueOn', v_due,
    'source', 'office',
    'what', coalesce(p->>'what', '')
  ));
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_send_paper(jsonb) IS
  'GC mode (B6-b-i): one send of a paper to a company, {companyId, paper, projectId?, packageId?, dueOn, note?, first?, draws?, what}, with its promise through gc_record_promise. Dev only until the papers'' door. SECURITY INVOKER.';

-- 6) A company's copy of one Contract Book entry, as materializePacket makes a person's: a new row the first time,
-- else the Book's link and an empty signing body refreshed on the latest copy. No assignment row: the Book's cascade
-- never sees a company.
CREATE OR REPLACE FUNCTION public.gc_company_paper(p_company_id uuid, p_book_entry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_entry public.contract_template_documents%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev sends a trade its papers while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'No company with that id.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_entry FROM public.contract_template_documents WHERE id = p_book_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That paper is not in the Contract Book.' USING ERRCODE = 'P0001';
  END IF;

  SELECT d.id INTO v_id FROM public.person_contract_documents d
  WHERE d.company_id = p_company_id AND d.document_name = v_entry.document_name
  ORDER BY d.lineage_version DESC
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.person_contract_documents
    SET canonical_document_url = nullif(btrim(coalesce(v_entry.canonical_document_url, '')), ''),
        applied_contract_template_document_id = v_entry.id,
        signing_body_html = CASE WHEN btrim(coalesce(signing_body_html, '')) = '' THEN v_entry.book_body_html ELSE signing_body_html END,
        signing_body_format = CASE WHEN btrim(coalesce(signing_body_html, '')) = '' THEN v_entry.book_body_format ELSE signing_body_format END
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.person_contract_documents (
    person_name, company_id, document_name, contract_lineage_id, lineage_version, supersedes_person_contract_document_id,
    status, canonical_document_url, signing_body_html, signing_body_format, applied_contract_template_document_id
  ) VALUES (
    'gc-company:' || p_company_id::text, p_company_id, v_entry.document_name, gen_random_uuid(), 1, NULL,
    'unsent', nullif(btrim(coalesce(v_entry.canonical_document_url, '')), ''), v_entry.book_body_html, v_entry.book_body_format, v_entry.id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_company_paper(uuid, uuid) IS
  'GC mode (B6-b-i): a trade partner company''s copy of one Contract Book entry (the master agreement, the W-9 form), named ''gc-company:'' || its id, the form trigger stamping a W-9''s doc_type. Returns the paper''s id. Dev only until the papers'' door. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_send_paper(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_company_paper(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_send_paper(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_company_paper(uuid, uuid) TO authenticated;

-- 7) Training mode and digital twins: gc_paper_sends gets its blocks; the three create only what is missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
```

Notes on the shape:
- `person_contract_documents` keeps its own row-level security (the office and pay roles) for a company's papers (call R). `gc_paper_sends` is dev only until the papers' door.
- The CHECK is added `NOT VALID`, then validated in its own statement, so the scan holds a lighter lock. No existing name starts with `gc-company:` (the migration doc checks on prod first).
- `CREATE OR REPLACE TRIGGER` swaps the trigger in place. The form trigger (`set_form_template_on_write`) still runs first, alphabetically, and stamps a W-9's `doc_type`.
- An ADD COLUMN needs no re-run of the read-only or twin sweeps on `person_contract_documents`: its allowance stays as it is.
- The push is the evening batch after 23:00 UTC (the lead's rule): it alters and re-triggers a table People and Contracts use all day.
- A company with papers cannot be deleted (`ON DELETE RESTRICT` keeps a signed paper). The sweep of the test rows (call 4) deletes the test company's papers first.

## B6-b-i's three edge functions (the lead deploys them at the push)

- **`send-contract-for-signature`, the company branch (call S, A).** Right after the row is read (it now selects `company_id`), a company's paper takes its own path and the person path is left as it is:
  - the token is minted exactly as today (64 hex, its hash stored, 14 days);
  - the recipients are the company's 'contracts' group (`gc_companies`, `gc_company_people` with `gets`), through `tradeEmailRecipients` and `tradeEmailReach` in `_shared/gcTradeEmail.ts`, first address To and the rest cc, as `gc-trade-email` does; nobody reachable is refused in words;
  - the email is GC's: Click Construction, the company's language, the master agreement's portal words (`mMsaSubject`, `mMsaHere`, `mMsaOpen`) with the signing link as its own line, and its portal link when it has one (read only: nothing minted);
  - a `gc_trade_messages` row (kind `msa`, or `paper` for a W-9, group 'contracts'), so the portal and the office see the send;
  - the sent copy names the company, not the stored name.
  `sendEmailViaResend` learns cc.
- **`get-contract-for-signer`**: a W-9 for a company prefills the company's name, not the stored name.
- **`open-contract-form-pdf`**: the PDF's download name is the company's.

**The pin test (the lead's condition on S).** Before the branch, the person path is pinned byte for byte against main:
1. The first commit adds `src/lib/contractSigningSend.pin.test.ts`, whose expected request refusals, email (subject, text, HTML, From name) and sent-copy record are literals captured by running main's own code on fixed inputs (a sub's agreement, a W-9 form, an intro and a subject override, an expired-portal person).
2. The second commit moves the handler's request checks, its email call and its sent-copy record into a pure `_shared/contractSigningSend.ts`, unchanged, and the handler calls it. The pinned test stays green on the same literals.
3. Only then the company branch, beside it, with its own tests. The pinned literals never change in this PR.

## B6-b-i's client guards

- `PeopleContractsTab.tsx`'s load of every paper gains `.is('company_id', null)`: the Agreements panel never lists a company and never counts one, and the signed record (opened only from this tab) never shows one.
- `PersonContractSignedRecordModal.tsx` shows "a trade partner company" for a stored company name anyway, through the one shared helper.
- The helper: `supabase/functions/_shared/companyPaper.ts` (`COMPANY_PAPER_PREFIX = 'gc-company:'`, `companyPaperName(id)`, `companyIdFromPaperName(name)`), imported by the client as `tradeEmail.ts` imports its shared module. A unit test pins the prefix, as board-b6.md asked.

## The SQL bed (`supabase/tests/gc_papers`, a job in `sql-beds.yml`)

Every migration, this one twice, then:
- a company's paper is written by `gc_company_paper` with the stored name and no person, and a second call refreshes the same row;
- the CHECK refuses a stored name with no company, a company with a person, and a company with another company's name;
- the trigger takes a lost company back from the name (a Book-save copy), and leaves a person's paper to `resolve_pay_person_id` as before;
- `create_pending_contract_versions_after_book_save` versions a person's paper as before and never touches a company's, which has no assignment;
- `gc_send_paper` writes the send and adds its promise, a second send moves the promise and keeps the first day, and a waiver's promise is closeout;
- each refusal in words: a non-dev, no company, an unknown paper, a statement of work with no trade, no day;
- only a dev reads or writes `gc_paper_sends`; a training-mode dev and a twin are refused;
- a project delete still cascades through `gc_paper_sends`.

## Verify after the push (the migration doc)

1. No `users.name` and no `people.name` starts with `gc-company:` (expected 0 and 0). Run before the push as well.
2. The CHECK is validated, and the trigger fires on `person_name, company_id`.
3. As a dev, rolled back: `gc_company_paper` on the test company with the Book's master agreement makes one row, named `gc-company:ff11d0fb-…`, no person; `gc_send_paper` makes a send and an msa promise.
4. People → Contracts as the office lists no company (after the client guard is live).

## Docs

`docs/migrations/<stamp>_gc_papers.md`; `docs/EDGE_FUNCTIONS.md` (the three functions); `docs/CONTRACT_FORMS.md` (papers keyed to a company); ACCESS_CONTROL (a company's papers follow the table's own policies; `gc_paper_sends` dev only); the GLOSSARY; the release note and fragment.

## B6-b-ii, after B6-b-i's types

- The mapper: `msa`, `msaSentOn` and `msaSignedOn` from the company's agreement paper (the Book's master agreement by name); `w9` from a signed `w9` paper; `coiExpires` from the newest `coi` paper's `expires_at`; `paperSends` from `gc_paper_sends`.
- The company window gains its Documents tab (`partnerDocuments`, `paperStep`'s verbs), and **Send a paper**, ported from the spike's `GcPaperSend.tsx`: Sign by with three days, Your line, the email as they get it, Send to sign or Send the reminder or Send the ask. The first master agreement calls `gc_company_paper`, then `send-contract-for-signature`, then `gc_send_paper`.
- **Record their insurance**: the office files a certificate with its expiry and link, as `SubDocumentAddForm` does for a sub.
- The Book entries by name and doc_type, no constant (call B): the Subs packet's sub-audience entries, the master agreement by its name and the W-9 by its form's doc_type.

## Calls, answered

- **5.** Yes, with the CHECK both ways, the trigger deriving the company and firing on it, no assignment row for a company, and the six display guards in the same PR.
- **S.** A, with the pin test above.
- **R.** Accepted: a company's papers follow the table's own policies.
- **B.** By name and doc_type, no constant.

## Status

Plan written 2026-10-09 by Helper 12. B6-b-i is cut after #5109 merges; its push is the evening batch after 23:00 UTC, with the three function deploys, the lead's. B6-b-ii follows its types; B6-c (Get started) after B6-b.
