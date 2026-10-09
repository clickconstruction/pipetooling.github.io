# P2c: a trade signs its statement of work (Portal lane)

The plan for P2c of `PORTAL_REAL_BUILD.md` (*The PRs, in order*, item 6), as the lead approved its read-back on 2026-10-09. A company awarded a trade signs that trade's statement of work in its portal. It types its name, signs by typing or drawing, and ticks the e-sign consent, as a customer signs a job contract on `/contract/accept`.

It changes item 6 in three ways:

- **The statement of work is signed in the portal**, not on `/contract/accept`. The sign screen is a portal block that reuses `/contract/accept`'s form, and the submit function does what `accept-contract` does around the write.
- **The master agreement is the Board's.** B6-b-i's `send-contract-for-signature` emails a company's `contracts` people their `/contract/accept` link. P2c only reads the paper: `gc_trade_sign_sow` refuses until the company has signed it (`msaFirst`).
- **`send_sov` is not in P2c.** The prototype's `TheirSovOnSow`, the report and the draws go with U6 and P5c.

What is already on main:

- **The words, from P0**: `gotJobTitle`, `sowDraft`, `sowTitle`, `sowLine`, `sowWillDo`, `sowWillNot`, `signSow`, `signMsaFirst`, `signedOn` and `readSign`, with `portalSowExcluded` in `portal.ts`.
- **The tables, from B6-a** (#4973): `gc_sows`, with the signer's five fields its comment saves for "the trade's sign verb", and `gc_sow_lines`. B6-a also put `gc_sow` in `esign_consents`' record types (its call E).
- **The office's send**, from B6-a-ii: `sendGcSow` moves a draft to `sent`. Helper 12's `sowEmail.ts` holds its email until P2c turns on `SOW_SIGN_SCREEN_LIVE`.
- **The portal's own work, from P4b-i and P4b-ii**: the slice carries the company's statements of work, and the trade's page leaves a hole for this block (`awardedToMe ? null`).

It comes as two PRs, as P2a and P2b did:

- **P2c-i**: the trade's verb, `gc_trade_sign_sow`. It is a migration with no table change. It cuts after P4b-iii, once B6-b-i (#5115) is on main and its `company_id` on `person_contract_documents` is on prod.
- **P2c-ii**: the slice's lines, the `sign_sow` kind, the sign block and the flip of `SOW_SIGN_SCREEN_LIVE`. It has no migration and goes after P2c-i's push and types. The lead deploys `gc-trade-portal` and `submit-gc-trade-portal`.

## Who owns what (the seams)

| Piece | Owner | When |
|---|---|---|
| `gc_sows`, `gc_sow_lines`, the signer's five fields, `gc_sow` in the ledger's CHECK | Board (B6-a) | on main |
| Sending a statement of work (`sendGcSow`) and its email (`sowEmail.ts`) | Board (B6-a-ii) | on main; P2c-ii flips its flag |
| A company's papers: `company_id` on `person_contract_documents`, `gc_company_paper`, the master agreement's `/contract/accept` email, the msa promise kept by `gc_company_paper_kept` | Board (B6-b-i, #5115) | before P2c-i |
| The partner's `msa` in the mapper, which disables the portal's button | Board (B6-b-ii) | after B6-b-i's types |
| `gc_trade_sign_sow` | Portal (P2c-i) | after P4b-iii and B6-b-i |
| The slice's lines, the `sign_sow` kind, the sign block, the flip | Portal (P2c-ii) | after P2c-i's push and types |
| The report, the draws, `send_sov`, the unconditional waiver | Building (U6) with the Portal (P5c) | with the draws |

## How signing works today

`/contract/accept` (`accept-contract`) and the sub portal's offer (`submit-sub-portal`) sign the same way:

- the signer types a name, picks Type or Draw (`ContractAcceptSignatureForm` with `SignatureTypeOrDrawInput`) and ticks the consent (`EsignConsentLine`; the words are `esignConsentText`, `ESIGN_CONSENT_VERSION` 2);
- the edge function decodes a drawn PNG (`decodeSignaturePng`, 512 KiB at most) and stores it in the bucket `contract-signer-signatures`;
- it reads the IP (`clientIp`) and the user agent from the request;
- it writes the row only while it is still sent, and deletes the PNG if that fails;
- it then writes the `esign_consents` row through `recordEsignConsent`, with the same timestamp as the row's `signer_consented_at`.

A SQL verb cannot read the IP or the user agent, or store a file. So P2c keeps the edge function's part in `submit-gc-trade-portal`, and the write, its refusals and the promise in the verb.

## P2c-i: the verb

One migration, stamped at the cut, `SET lock_timeout = '3s';` first. It makes no table, so it needs none of the three `apply_*` calls.

**`gc_trade_sign_sow(p_company_id, p_sow_id, p_printed_name, p_signature_path, p_ip, p_user_agent)`**, returning `timestamptz`. It is `SECURITY INVOKER`, for the service role alone, with the link's company first, as P2a's verbs are. It locks the statement of work's row first, so two presses at once sign it once.

The refusals, in this order:

- `notFound`: no statement of work with that id.
- `notYours`: another company's, said before its status, so a company learns nothing of another's work.
- `alreadySigned`: signed already. It is new, and it also holds a second press.
- `sowNotSent`: a draft the office has not sent, or one it cancelled. It is new.
- `msaFirst`: the company has no signed master agreement. That is a `person_contract_documents` row with its `company_id`, `doc_type` `agreement` and status `signed`. It is new. It is said before the name, so a blank name never hides it.
- `nameNeeded`: a blank name (exists).
- `tooLong`: a name past 200 characters (exists).

The writes:

- status `signed`, and `signed_on` the app's day;
- `signer_printed_name`, trimmed;
- `signer_signature_storage_path`, the path the submit function stored, or null for a typed signature;
- `signer_consented_at`, the database's time;
- `signer_ip` and `signer_user_agent`, blank as null;
- the `sow` promise kept, through `gc_keep_promises(company, 'sow', project, package)`, as the prototype's `promisesKeptBy` did.

It returns the consent time it wrote. The submit function gives that time to the ledger row, so the two match, as `accept-contract`'s one timestamp does.

**The guard**: P4a's guard in `gcTradeSubmit.test.ts` reads the three new keys. P2c-i lists them in `WAITING` as `'P2c-ii'`, beside U4a's `fileNeeded` and `notYourMove`. Building's U5a adds `jobNotBuilding` to the same list, and whichever of U5a and P2c-i lands second keeps every line.

**The check (P2c-i)**: the bed `supabase/tests/gc_trade_sign_sow/20_scenario.sql`, on GitHub's `SQL beds` against the whole schema (`scripts/pgtest-gc-trade-sign-sow.sh`, with its job and npm script). The local Postgres 15 bed could not start on 2026-10-09, because the system refused it shared memory. Its fixture is a building clinic with five trades:

- Electrical is sent to Iron Horse, which signed our master agreement.
- Plumbing is sent to Brushstroke, whose agreement went out but is not signed.
- Drywall is a draft and Paint is signed, both Iron Horse's.
- Concrete was sent to Level Line, then cancelled.
- Iron Horse promised the signed statement of work on Electrical.

The papers are made by name (`gc-company:<id>`), so B6-b-i's trigger fills their `company_id`. The checks:

- only the service role may run the verb;
- each refusal by its key and its words, and nothing signed by any of them;
- Iron Horse signs Electrical. The verb returns the consent time, and the row holds the status, the day, the trimmed name, the drawn signature's path, the time, the IP and the browser. The promise is kept;
- a second signature is refused;
- once Brushstroke's agreement is signed, it signs by typing, with no image. A blank path, IP and browser are kept as null;
- a signed-in dev is refused with `42501`.

## P2c-ii: the portal's side

**The slice** (`gc-trade-portal`): a new list, `sowLines` (`id`, `sow_id`, `position`, `label`, `amount`), only on the company's own statements of work that are not cancelled. `sows` gains `excluded`. Each field joins `TRADE_PORTAL_FIELDS`. The never-sees test plants a line on another company's statement of work.

**The mapper** (`tradePortalState.ts`): `sow.sov` from the lines in position order, with `pctBilled` and `pctReported` 0 until U6. `sow.excluded` from the column. The partner's `msa` stays `'none'` until B6-b-ii reads the papers.

**The kind**: `sign_sow` takes `sowId`, `printedName`, an optional `signaturePngBase64` and `esignConsent`.

- It is not under the hourly cap, since `alreadySigned` holds a repeat.
- The consent is required. Without it the press is refused with `consentNeeded`, before any write, as `sign-owner-records` refuses.
- A drawn signature goes to `contract-signer-signatures/gc-sows/<sow id>/<uuid>.png`, and is deleted if the verb refuses. A typed one stores no image.
- After the verb, `recordEsignConsent` writes record type `gc_sow`, the verb's consent time, the printed name, the method (`draw` or `type`), the IP and the browser.
- `gc_sow` joins `EsignConsentRecordType` in `_shared/esignConsent.ts` and `src/hooks/useEsignConsent.ts`, which both lack it today.
- A sample press answers ok and writes nothing.

**The block**: `GcTradePortalSow`, the sign part of the prototype's `SowBlock`. It fills P4b-ii's `awardedToMe ? null`:

- **a draft**: `gotJobTitle` and `sowDraft`;
- **sent**: the price with `sowLine` (the retainage and the plans), the lines, and `sowWillDo` and `sowWillNot` when it excludes anything. Then `/contract/accept`'s form in the company's language, its button `signSow`;
- **signed**: the `signedOn` chip.

Until B6-b-ii, the button shows and the verb refuses with `msaFirst`'s words, the prototype's rule. After it, the button is disabled with `signMsaFirst` beside it, as the prototype draws it.

**The words**: every word above is on main from P0. `msaFirst` says `signMsaFirst`'s words. Three keys are new, each with its status and its English and Spanish words: `sowNotSent`, `alreadySigned` and `consentNeeded`. `nameNeeded` keeps its words ("Type the person’s name."), since the form needs a name before its button works.

**The flip**: `SOW_SIGN_SCREEN_LIVE` becomes true in `sowEmail.ts`, so Send to their portal to sign emails the company. This was agreed with Helper 12 on 2026-10-08.

## Errors, as keys

| Key | Status | When |
|---|---|---|
| `sowNotSent` | 409 | a draft the office has not sent, or one it cancelled |
| `alreadySigned` | 409 | signed already, or a second press |
| `msaFirst` | 409 | the company has not signed our master agreement |
| `consentNeeded` | 400 | the submit function's own: a press without the e-sign consent (P2c-ii) |
| `nameNeeded` | 400 | (exists) no name |
| `tooLong` | 400 | (exists) a name past 200 characters |
| `notYours` | 409 | (exists) another company's statement of work |
| `notFound` | 404 | (exists) no statement of work with that id |

## Tests

- **P2c-i**:
  - the SQL bed, on GitHub;
  - the guard, with the three keys in `WAITING`.
- **P2c-ii**:
  - `parseTradeSubmit`'s `sign_sow`: typed, drawn, a PNG that does not decode, and no consent;
  - the slice's never-sees test with the lines;
  - the mapper's `sov` and `excluded`;
  - the page for a draft, a sent one and a signed one. On a sent one, the form needs a name and the consent, and posts the body. An `msaFirst` refusal shows in the company's words, and the preview posts nothing;
  - the flip, in `sowEmail.test.ts`.

## Docs

- **P2c-i**: `docs/migrations/<stamp>_gc_trade_sign_sow.md` with its Status; the bed's script with its `SQL beds` job and npm script; a release note and its fragment.
- **P2c-ii**:
  - `EDGE_FUNCTIONS.md`: `gc-trade-portal`'s lines, and `submit-gc-trade-portal`'s `sign_sow`;
  - `ACCESS_CONTROL.md`: the trade signs through the service role, and `recordEsignConsent` writes the ledger;
  - `PROJECT_DOCUMENTATION.md`'s trade portal paragraph;
  - the guide `share-a-trade-partner-its-portal`, for what the trade can now do;
  - a release note and its fragment.

## The live check

- **P2c-i**: the lead pushes the migration. The doc's two verify steps read who may call it and what it returns, then `notFound` in its words, as the service role inside a transaction that rolls back.
- **P2c-ii**, after the lead's two deploys, on the test company's link:
  1. a dev sends a test agreement and the company signs it on `/contract/accept`;
  2. a dev awards a test trade and sends its statement of work;
  3. the company signs it in the portal, drawn, at 375 px;
  4. the board reads it signed. The ledger has its `gc_sow` row, and the promise is kept.

  Every press on prod waits for the owner's yes, as every send does.

## Decisions

1. **Two PRs**, the SQL and then the portal (the lead, 2026-10-09).
2. **The master agreement first, from the start.** `msaFirst` unless the company has a signed agreement paper of its own (the lead's call 1, 2026-10-09).
   - It is the rule B6-b-i's `gc_company_paper_kept` keeps: a company's paper that is not a W-9 or a certificate keeps the `msa` promise.
   - The button's state comes with B6-b-ii's mapper. Until then the verb says it in words.
3. **Typed or drawn, both**, as `/contract/accept` signs (the lead, 2026-10-09). `gc_sows` has no column for which, so the ledger's `method` records it.
4. **The verb returns the consent time it wrote**, not the day. The read-back said `date`. It changed while this plan was written, so the ledger row's `consented_at` equals `gc_sows.signer_consented_at`, as `accept-contract`'s one `nowIso` does. The page re-reads the day from the slice.
5. **The refusals' order**: the company, then the status, then the master agreement, then the name.
6. **The signature image is the submit function's.** It stores the PNG before the verb and deletes it if the verb refuses. The verb keeps the path it is given, and a blank one as null.
7. **`send_sov`, the report and the draws are U6's and P5c's.**
8. **For the Board's door** (a question for the Board lane). Today `gc_sows` is dev only, for every verb. When the door opens it to the office, `status = 'signed'` and the signer's five fields could stay the service role's, through column grants as P4a's are. Then only the trade signs.

## Status

Plan written 2026-10-09 by Helper 13 (the Portal lane), after the lead approved the read-back with call 1 changed: the `msaFirst` gate from the start. P2c-i's SQL below passed all 16 checks of its bed on GitHub (`SQL beds` run 37932356974), over main and B6-b-i's migration, applied twice. P2c-i cuts after P4b-iii, once B6-b-i (#5115) is on main and prod. Its stamp is claimed at the cut.

## P2c-i's SQL as built

`supabase/migrations/<stamp>_gc_trade_sign_sow.sql`, prepared on main at e5cef92f0 over B6-b-i at d05e38d4e, word for word. The stamp is `20261010019000` until it is claimed at the cut. A difference between the migration and this block that is not a comment or the stamp is a question for the Portal lane.

```sql
SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P2c-i (to-dos/gc-mode/mockups/portal-p2c.md on branch spike/gc-mode): the trade
-- signs its statement of work in its portal. The submit function (P2c-ii) has already turned the link into its company,
-- stored a drawn signature and read the signer's IP and browser; it calls this with the company first, and after it
-- writes the e-sign ledger row (recordEsignConsent, record type gc_sow) with the consent time this returns, so the two
-- match as accept-contract's one timestamp does. Only a statement of work the office sent, the
-- company's own, and only once the company signed our master agreement (the prototype's rule, B6-b-i's papers). A
-- refusal raises a key the page says in the company's language (decision 11), with the reason in plain words as its
-- DETAIL. No table changes. Doc: docs/migrations/.

CREATE OR REPLACE FUNCTION public.gc_trade_sign_sow(p_company_id uuid, p_sow_id uuid, p_printed_name text, p_signature_path text, p_ip text, p_user_agent text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_sows%ROWTYPE;
  v_project_id uuid;
  v_name text := btrim(coalesce(p_printed_name, ''));
  v_today date := public.app_today();
  v_at timestamptz := now();
BEGIN
  SELECT * INTO v FROM public.gc_sows WHERE id = p_sow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No statement of work with that id.';
  END IF;
  IF v.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That statement of work is another company''s.';
  END IF;
  IF v.status = 'signed' THEN
    RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'That statement of work is signed already.';
  END IF;
  IF v.status <> 'sent' THEN
    RAISE EXCEPTION 'sowNotSent' USING ERRCODE = 'P0001', DETAIL = 'That statement of work is not sent to sign.';
  END IF;
  -- Our master agreement comes first: a signed agreement paper of the company's own (person_contract_documents, B6-b-i).
  IF NOT EXISTS (
    SELECT 1 FROM public.person_contract_documents d
    WHERE d.company_id = p_company_id AND d.doc_type = 'agreement' AND d.status = 'signed'
  ) THEN
    RAISE EXCEPTION 'msaFirst' USING ERRCODE = 'P0001', DETAIL = 'Sign our master agreement first.';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'nameNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type your name to sign.';
  END IF;
  IF char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the name under 200 characters.';
  END IF;
  UPDATE public.gc_sows
  SET status = 'signed',
      signed_on = v_today,
      signer_printed_name = v_name,
      signer_signature_storage_path = nullif(btrim(coalesce(p_signature_path, '')), ''),
      signer_consented_at = v_at,
      signer_ip = nullif(btrim(coalesce(p_ip, '')), ''),
      signer_user_agent = nullif(btrim(coalesce(p_user_agent, '')), '')
  WHERE id = v.id;
  -- The statement of work it promised is kept (gc_keep_promises, B1), as the prototype's promisesKeptBy did.
  SELECT k.project_id INTO v_project_id FROM public.gc_trade_packages k WHERE k.id = v.package_id;
  PERFORM public.gc_keep_promises(p_company_id, 'sow', v_project_id, v.package_id, v_today);
  RETURN v_at;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_sign_sow(uuid, uuid, text, text, text, text) IS 'GC mode (P2c-i): the trade signs its own statement of work from its portal, once it is sent and once the company signed our master agreement (msaFirst); writes the status, the day and the signer''s fields, and keeps the sow promise. Returns the consent time it wrote, for the e-sign ledger row the submit function writes after it; the submit function also stores the signature. Service role only.';

-- Only the service role: the submit function, after it has turned a link into its company.
REVOKE ALL ON FUNCTION public.gc_trade_sign_sow(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_sign_sow(uuid, uuid, text, text, text, text) TO service_role;
```
