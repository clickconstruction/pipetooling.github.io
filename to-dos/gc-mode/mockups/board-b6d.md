---
name: "B6-d: our contract to the customer, sent from the customer's window and signed in their portal"
rows: board-b6c.md (calls, D; Out); BOARD_REAL_BUILD.md (:46-48 Owner Billing owns the signed price and gc_sign_owner_contract, :180 the send is the Board's); OWNER_BILLING_REAL_BUILD.md (:60-64 the customer reads the app's own portal, :110-114 decision 5, :589 "Sending the contract is B6's"); owner-billing-o7.md (O7c, the customer portal's GC presses)
branch: this plan on spike/board-b6d-plan (from origin/spike/gc-mode); the PRs from origin/main
status: plan 2026-10-10 by Helper 2 (gc 2, the Board lane) at the lead's ask. The lead answered D1 to D8 the same day, and Owner Billing (gc 5) answered D5, D8 and B6-d-i's shape with changes (Amendments, below). B6-d-i is cut as v2.5160, migration 20261010090000; its SQL as built is the migration file on its PR.
---

# B6-d: our contract to the customer

## What it is

Call D (board-b6c.md): our contract to the customer goes out from the customer's window and is signed in their portal. Until now **Mark it signed** on Get started covers a contract signed on paper. Three PRs:

- **B6-d-i, the database** (one migration): the sends of our contract, each with the price it went with and the file; the send; the customer's signing as the service role; a new e-sign record type.
- **B6-d-ii, the office's screen** (no migration):
  - the customer's window, first cut (About and Documents);
  - **Send to sign**, **Remind them** and **Send the new price**;
  - the contract email (a `gc-customer-email` kind);
  - Get started's row opening it.
- **B6-d-iii, the customer's portal** (no migration): the sign block, and the `submit-portal-request` kind that signs.

## What main has (origin/main b3c5e508d)

1. **`gc_projects.owner_contract_sent_on`** exists (B1, `20261008020000:107`), is read (`gcIo.ts:394`) and mapped (`boardRows.ts:508-509`). **Nothing writes it.** Get started already reads "sent <day>, waiting on their signature" when it is set (`start.ts:44-53`).
2. **`owner_contract_signed_on`** is Owner Billing's (O1, `20261008010000:24`). Its only writer is `gc_sign_owner_contract` (`:356-432`):
   - SECURITY INVOKER; it refuses a caller with no `auth.uid()` (`:369`) and is granted to `authenticated` only (`:432`);
   - its first sign writes `gc_owner_contract_lines` from the price by line the client sends (`ownerContractWorthNow`), and checks that every trade is named, with gc, contingency and fee;
   - its Undo refuses once a pay application went out (`:380-384`).

   Pay applications, interest bills and office notices each refuse an unsigned job (`20261009200000:147`, `20261009220000:77`, `20261010060000:73,112`). B6-c-ii (#5308) calls it as **Mark it signed**.
3. **No customer sends are kept.** `CustomerSend` (`types.ts:1037-1052`) and `GcState.customerSends` (`:843`) exist, and the call list reads them:
   - `customerSend.ts:15-40` gives `customerSentWords`, `customerReminderLate` and `contractWaitingOn`;
   - `projectPeople.ts:236-243` makes Who to call's `contract` line, red once the sign-by day passes;
   - `projectPeople.ts:396-406` is the Follow up ask.

   Nothing maps a row into them, and no table holds them.
4. **No GC customer window.** `GcCompanyWindow.tsx` is the trades'. The spike's `GcCustomerWindow.tsx` (644 lines), `GcCustomerSend.tsx` and `GcCustomerContractSign.tsx` stay on the spike. Owner Billing's O2 kernels (`customerDocuments`, `customerPaper`) are not on main either.
5. **The customer portal is the app's own** (`/portal?t=`, `/p/:slug`; `CustomerPortal.tsx`), read through `customer-portal` and written through `submit-portal-request`. Those are the Pipeline's two functions, and the lead's call 5 (v2.5025) says nobody else on the crew touches the customer portal.
   - Owner Billing's O7c put GC there: `_shared/gcPortal.ts:53-126` (won jobs only, change orders, `canAccept`), and `submit-portal-request`'s `gc_change_order_answer` and `gc_accept_work` (`:79-87`, `:198-228`).
   - Those calls run the database's own function as the service role with `how = 'portal'`, after `gcPortalOwns`.
   - O7c's change-order Sign keeps no name, consent or ink.
6. **The customer's link** is `customer_portal_links`: hashed, one active per customer and audience (`20260821213000:15-23`). It is minted by `mint_customer_portal_link(customer, audience, rotate)`, which takes dev, assistant or master. Nothing in GC mode mints one. `gc-customer-email` adds the link line only when one exists, never minting (`index.ts:171-174`). A link of audience `gc` is left out of GC jobs (`customer-portal/index.ts:698`).
7. **`gc-customer-email`** kinds (`_shared/gcCustomerEmails.ts:23`): pay_app, certify_ask, certified, change_order, reminder, interest_bill and weekly. There is **no contract kind**.
   - Every kind but weekly is the money team's.
   - Each kind checks the row it is about (`index.ts:114-148`).
   - It takes a PDF as base64 (`:191`).
   - It files the sent copy on `billing_job_id` (`:213-224`), which exists only after the first bill.
8. **E-sign:** `esign_consents.record_type` was last widened by `20261010071000:22-26` (… gc_sow, gc_draw, gc_trade_change). The trade's **sign the statement of work** is the pattern to copy:
   - `submit-gc-trade-portal` checks consent, stores the PNG in `contract-signer-signatures/gc-sows/<id>/`, and reads the IP and user agent;
   - it calls the service-role-only `gc_trade_sign_sow(company, sow, name, path, ip, ua)` (`20261010043000`), which writes `gc_sows.signer_*` and returns the consent time;
   - then `recordEsignConsent` writes the ledger row at that same time.
9. **What "our contract" is in the prototype:** no document. The paper pane's foot says "In the real build, the file itself opens here." (`gcCompanyFile.ts:277`). The decided part is the price frozen by line (`gcTypes.ts:373`). board-b5.md:248: "Anyone who reads the owner contract can work backwards to our markup."
10. **The prototype's flow** (`gcReducer.ts:551-580`):
    - Every send is a `CustomerSend {first, on, by, note}`. Only the first stamps `ownerContractSentOn`, and every send turns the customer's portal on.
    - The customer's **Sign the contract** freezes `ownerContractWorth ?? ownerContractWorthNow` on the day they sign, so a price that moved between the send and the signing is the one kept. It keeps no consent, name or ink.
    - There is no un-send or decline.

## Calls for the lead

- **D1. What they read and sign: the office's own contract file, attached at the send.** *My pick.*
  - The office uploads a PDF (an AIA A101, the customer's own form, or ours). The portal shows our summary above it, then Sign: the job, the address, the price as one number, retainage, the days to pay and the sign-by day.
  - It needs no contract words from us, and works when the customer brings the contract.
  - **The other way:** a contract we generate from the job's terms. It waits on the owner's own words, as the Master Services Agreement does, and can come later as a second source for the same send.
  - **The owner's call**, since it decides what a customer signs.
- **D2. The price is frozen at the send, not the signing.** *My pick.*
  - Each send keeps the price by line it went with (`worth`, checked in SQL as `gc_sign_owner_contract` checks it). Signing in the portal writes `gc_owner_contract_lines` from that send.
  - So the price kept is the one they read. The prototype keeps the price on the day they sign, which can differ from the email.
  - When our price changes after a send, the window offers **Send the new price**, a new send, and the portal shows only the newest.
  - **Mark it signed** on paper keeps today's price, unchanged.
- **D3. Who sends: a dev until award's door, then the money team.**
  - The price by line is Our number's, and `gc-customer-email`'s kinds are the money team's.
  - `gc_send_owner_contract` refuses anyone but a dev in words until the door, as `gc_start_project` does.
- **D4. Who builds the portal half (B6-d-iii).** Call 5 keeps the customer portal to the lane that owns GC's footprint there, Owner Billing's O7c. *My pick:* the Board lane builds it to O7c's pattern line for line, and Owner Billing's helper and you read it back before it is cut. *Or:* Owner Billing builds B6-d-iii from this plan. Your call.
- **D5. Owner Billing's function, restated with no change in behavior.** The portal cannot call `gc_sign_owner_contract`, which needs a signed-in caller.
  - *My pick:* lift its checks and line-writing into `gc_owner_contract_keep(project, day, worth)`, called by both `gc_sign_owner_contract` and the portal's signing, so the two can never drift. (Amended: it is granted to `authenticated` and `service_role`, not to no one; see Amendments.)
  - It adds one refusal to Undo: a contract the customer signed in their portal stays signed ("They signed it in their portal, so it stays signed.").
  - Needs Owner Billing's OK, since the function is theirs.
- **D6. Their portal link: the first send makes one when they have none.** That is the prototype's "the first send turns their portal on".
  - The send window calls the app's own `mint_customer_portal_link(customer, 'all', false)`. That is a call into the Pipeline's function, not a change to it. It makes the merged link, the app's default since the custom-links train (`20260821233000`), and gives back the one already on, so every send may call it.
  - (Amended 2026-10-10: the plan first said audience `customer` and a refusal for a customer whose only link is `gc`. A merged link shows their GC jobs, so no refusal is needed. The email links `all` first, else a `customer` view, never `gc`.)
- **D7. E-sign as the trade's statement of work does it:**
  - record type `gc_owner_contract`, audience `customer`;
  - the signer's five fields on the signed send;
  - the PNG in `contract-signer-signatures/gc-owner-contracts/<send id>/`;
  - the ledger row after the signing function, at its consent time.

  The file's SHA-256 is kept on the send, so the signature binds to those bytes. The file lives in a new private bucket, `gc-owner-contracts`, because the sent copy files on a billing job that does not exist yet.
- **D8. The email is a `gc-customer-email` kind, `contract`** (Owner Billing's function; the deploy is yours).
  - The spike's `contractEmail` words, with the PDF attached and the portal line always on.
  - The kind checks that its send is the project's newest and unsigned.
  - Until B6-d-iii is live, B6-d-ii hides the email tick behind `OWNER_CONTRACT_SIGN_LIVE`, as `SOW_SIGN_SCREEN_LIVE` held the statement of work's. The email must never ask a customer to sign where nothing can be signed.

## B6-d-i, the database (shape; the full SQL follows the calls)

- **`gc_owner_contract_sends`**, one row per send:
  - `id`, `project_id` (to `gc_projects`, `ON DELETE CASCADE`), `customer_id` (the project's customer at the send);
  - `first`, `sent_on`, `sign_by` (on or after `sent_on`), `note` (500 characters at most);
  - `worth jsonb` (the price by line), `total numeric`;
  - `file_path`, `file_name`, `file_sha256`;
  - `sent_by` (default `auth.uid()`);
  - once signed: `signed_on`, `signer_printed_name`, `signer_signature_storage_path`, `signer_consented_at`, `signer_ip`, `signer_user_agent`;
  - `created_at`.

  Named CHECKs as B6-a's: a signed send has all its signer fields, and a send's total is the sum of its worth. Policies as `gc_paper_sends`: a dev's until award's door, then the money team. It ends with the three house calls (read-only write blocks, statement blocks, the twin fence) and joins `doors.ts`.
- **`gc_send_owner_contract(p_project_id, p_sign_by, p_note, p_worth, p_file_path, p_file_name, p_file_sha256) RETURNS uuid`**, SECURITY INVOKER.
  - **It refuses, in words:** a training account, a digital twin, anyone but a dev (until the door), a project not there, one still bidding, one lost, one already signed, a sign-by day before today, a price that does not name every trade with gc, contingency and fee (`gc_owner_contract_worth_ok`, shared with the keep), and a file with no path or hash.
  - `first` is true when no send went before. The first send stamps `owner_contract_sent_on = app_today()`. It returns the send's id.
- **`gc_customer_sign_owner_contract(p_customer_id, p_send_id, p_printed_name, p_signature_path, p_ip, p_user_agent) RETURNS timestamptz`**, service role only, after `gc_trade_sign_sow`.
  - **Its refusal keys** are said in the customer's words, with the reason as DETAIL:
    - `notFound`;
    - `notYours` (another customer's project);
    - `notNewest` ("We sent you a newer one. Sign that one.");
    - `alreadySigned`;
    - `lost`;
    - `priceChanged` (a trade added after the send: "Our price changed after we sent this. We will send you the new one.");
    - `nameNeeded`;
    - `tooLong`.
  - It writes the signer's fields and `signed_on` on the send, then `gc_owner_contract_keep(project, today, send.worth)`, which writes the lines and `owner_contract_signed_on`. It returns the consent time.
- **`gc_owner_contract_keep` and `gc_owner_contract_worth_ok`** (call D5), with `gc_sign_owner_contract` restated to call them. Its parity is shown in the bed by running Owner Billing's existing scenarios unchanged.
- **`esign_consents_record_type_check`** widened with `gc_owner_contract`, keeping every value it has, as `20261010071000` did.
- **The bucket `gc-owner-contracts`**, private:
  - `storage.objects` policies let a dev read and insert under `<project id>/`;
  - the service role signs the portal's read URLs.
- **The bed** `supabase/tests/gc_owner_contract` (`scripts/sql-beds.txt`, `pgtest-gc-owner-contract.sh`):
  - every refusal of both functions;
  - a first send and a reminder;
  - Send the new price, after which the old send is refused as `notNewest`;
  - the signing writing the lines from the send, not from today's price;
  - Undo refused after a portal signature;
  - Owner Billing's own scenarios still green;
  - the CHECK's old values kept.

  `ownerContractSql.test.ts` holds every refusal to the plain-words rules.

## B6-d-ii, the office's screen (after B6-d-i's types)

- **The mapper:**
  - `loadGcBoardRows` reads `gc_owner_contract_sends` for the money team into `state.customerSends` (paper `contract`). Get started's sent line, Who to call's `contract` line and the Follow up ask then read real rows with no change of their own.
  - The customer's `portalOn` comes from their active link (audience `customer` or `all`). It is read with that table's own policies, or through a small RPC if they do not open it to the GC team.
- **The customer's window, first cut** (`GcCustomerWindow.tsx`, opened by `openCustomer(customerId, at)` through its own context like the company opener):
  - **About:** the name, the contact, the billing email, and their portal (on or off).
  - **Documents:** **Our contract with them**, one row per won job of theirs.
  - B2b fills in the rest: Activity, their money, and every other paper.
- **The Documents row**, after the spike's `gcCompanyFile.ts:169-183`, with a late wording added:
  - **Not sent:** "not sent yet". "Send it to sign in their portal. Signed on paper? Mark it on Get started."
  - **Sent or reminded:** "waiting on their signature", plus the `customerSentWords` line. Once the sign-by day passes it reads "late, asked to sign by <day>".
  - **Price changed since the send:** "Our price changed after we sent it." with **Send the new price**.
  - **Signed:** "signed <date>". In their portal, it also shows who signed. "Their price stays what they signed."
- **The send** (`GcCustomerContractSend.tsx`), the spike's `GcCustomerSend` on `GcPaperSend.tsx`'s send view:
  - **The file:** required on the first send. A reminder reuses the last one unless it is replaced.
  - **Sign by:** `paperDayChoices`, a week out first.
  - **Your line**, then the email as they will get it, with "with their portal link" in **To**.
  - **The press:** upload the file and hash it, then `gc_send_owner_contract`, then make their link if they have none (D6), then the `contract` email (D8) once `OWNER_CONTRACT_SIGN_LIVE` is on. A refused email is said after the board reads the send, as the statement of work's is.
- **Get started:** the contract row gains **Send to sign** or **Remind them**, which opens the customer's window at that job's row with its send open, beside **Mark it signed** ("Signed on paper, outside their portal"). This is the spike's `GcStart.tsx:149-161`.
- **Where else the window opens:** the customer's name on the board card and on the project's head.
- **The guide** "send our contract to a GC customer to sign", and the Get started guide's customer section.

## B6-d-iii, the customer's portal (D4's lane, after B6-d-ii)

- **`customer-portal`** (`_shared/gcPortal.ts`) adds `contract` to each won GC job:
  - while the newest send is unsigned: `{ sendId, signBy, total, retainagePct, payDays, fileName, fileUrl }`. The URL is signed for an hour, and the price shows only as one number (board-b5.md:248);
  - once signed: `{ signedOn, signerName }`.

  A contract to sign counts as something to show, so a job with only that appears.
- **`PortalGcJobs.tsx`** leads with **Your contract · to sign**, the spike's `GcCustomerContractSign` words:
  - the job and its price, and "It names the work, the price, and how billing works…";
  - "Please sign it by <day>." and **Read the contract**;
  - `ContractAcceptSignatureForm` with audience `customer`: the printed name, a drawn or typed signature, and the consent box.
- **`submit-portal-request`** gains kind `gc_owner_contract_sign`, after O7c's `gc_change_order_answer`:
  1. `gcPortalOwns`;
  2. the consent;
  3. the PNG stored (D7) and the IP and user agent read;
  4. `gc_customer_sign_owner_contract` as the service role;
  5. `recordEsignConsent` at the returned time.

  A refusal comes back in the customer's words. As O7c's do, it makes no inbox row and sends no email.
- **Then `OWNER_CONTRACT_SIGN_LIVE`** turns on in a one-line PR, and the email ticks show.
- **Proof:** the kind's parse and refusal tests, the sign block's render test, and a fixture in `_shared/customerSampleFixtures.ts`.
- **Guide:** `share-a-customer-their-portal` gains "When they sign our contract".

## Out

- A contract we write ourselves (D1's other way), until the owner's words.
- Declining or asking to change our contract from the portal. They call us, and we send a new price.
- Who to call and Needs you on the customer: B2b's (board-b6c.md:261). The `contract` line already lights once sends are mapped.
- The customer window's Activity, money and other papers: B2b and Owner Billing's O2 kernels.

## Is this the best we can do?

- **Freezing the price at the send is the one real change from the prototype.** It costs a jsonb column and one more refusal (`priceChanged`). It buys a contract whose kept price is the one the customer read, which the prototype cannot promise.
- **An uploaded file is less elegant than a generated contract, and more honest.** We have no contract words of our own yet, and GC customers often bring theirs. The summary above the file keeps the portal readable either way.
- **The shared keep function touches Owner Billing's code.** That is the price of never having two copies of the lines' rules, the trap B6-a's `gc_leveled_total` warned about.
- **What it does not close:**
  - A customer can sign a file that says a different price than our summary, if the office uploads the wrong file. The send shows the file's name and the price side by side before the press. A check that the PDF's text holds the price is possible later.
  - The signer is whoever holds the link, as on every portal surface today.

## Amendments, 2026-10-10 (the lead's answers, and Owner Billing's changes)

- **D1:** as picked. The owner's new Master Services Agreement is the trade partners' paper (B6-b's master agreement), not our contract with the customer. The office's own contract file for the customer is uploaded at the send. The generated contract stays Out until the owner's words.
- **D2, D3, D6, D7:** as picked.
- **D4:** the Board builds B6-d-iii line for line on O7c's pattern. Owner Billing (gc 5) and the lead read it back before it is cut.
- **D5 (Owner Billing's yes, with three changes):**
  1. **`gc_owner_contract_keep` is granted.** It is `SECURITY INVOKER`, with `PUBLIC` and `anon` revoked and `authenticated` and `service_role` granted. An invoker caller (`gc_sign_owner_contract` runs as `authenticated`) needs EXECUTE. RLS on `gc_owner_contract_lines` and `gc_projects_owner_terms_guard` still decide who writes. Keep refuses a project already signed, so a direct call does no more than Mark it signed's first sign.
  2. **Keep holds only the first sign:** the lines from the price by line, then the day. `gc_sign_owner_contract` keeps its own Undo branch and its "signed already, only the day moves" branch. Owner Billing's bed (`scripts/pgtest-gc-owner-billing.sh`) must stay green unchanged.
  3. **The portal signature holds the day as well as the price.** Moving the day of a contract signed in the portal is refused too ("They signed it in their portal on Oct 12, so its day stays."), beside Undo's refusal. Both are keyed on a signed `gc_owner_contract_sends` row. A definer, `gc_owner_contract_portal_signed_on`, reads that row for the money team, since the table is a dev's.

  The portal's signing pre-checks the price with `gc_owner_contract_worth_ok` and raises `priceChanged` before keep, so a customer never reads the office's words. The office's words come from one shared `gc_owner_contract_worth_problem`.
- **The sends table and the bucket are a dev's now and the money team's at award's door,** never award's wider audience (Owner Billing): the price by line is our markup. `doors.ts` says so. The bed asserts that an estimator, an assistant and a leader read no send.
- **D8 (Owner Billing's yes, with five details, for B6-d-ii's email):**
  1. **The function attaches the file itself.** The client sends no PDF for this kind. `gc-customer-email` reads the send's `file_path` from `gc-owner-contracts` as the service role and checks its SHA-256 against `file_sha256`. A mismatch is refused `fileChanged`.
  2. **The portal line is required.** With no live link of audience customer the send is refused `noPortal`: "They have no portal link yet. Send it from their window first."
  3. **The address is contact first, then billing** (`GC_CUSTOMER_EMAIL_ADDRESS.contract = 'contact'`, as weekly). The signer is their owner, not their payables.
  4. **The sent copy is filed** as `gc_owner_contract`, with source `{ table: 'gc_owner_contract_sends', id }` and the customer. `jobIds` is empty until the billing job exists.
  5. **The usual registries:**
     - `GC_CUSTOMER_EMAIL_KINDS` and its records;
     - the gc journey's step with a sample;
     - personJourney's na line;
     - customerEmail.test's kinds table;
     - the [TEST] door attaching the same file.

     The kind checks the send is the project's newest and unsigned. The deploy is the lead's.
- **B6-d-i as built** (v2.5160, `20261010090000_gc_owner_contract_sends`):
  - Column grants close the sends table to people: the office inserts only a send's own columns, and nobody signed in updates or deletes one.
  - `total` is generated from `worth`, and `created_at` is `clock_timestamp()`, so the newest send is well defined within one transaction.
  - The bed has five mutants, each failed.
  - Owner Billing's bed passed unchanged, 294 checks.

## As built: B6-d-iii in two cuts (2026-10-10)

The lead split B6-d-iii in two, so B6-d is four cuts: i (v2.5160, #5314), ii (v2.5167, #5320), iii-a and iii-b.

- **iii-a, the customer signs in their portal** (no email, no migration):
  - **`_shared/gcPortal.ts`:**
    - A won job's `contract` while the newest send is unsigned and the job is going: the price as one number, every term we bill by (`gcContractTermsLines`), the sign-by day, and a one-hour link to the file.
    - `priceChanged` when `gc_owner_contract_worth_ok` says the send's price is no longer whole. The page then shows no sign form.
    - Once signed there: who signed and when, with "Read what you signed".
    - A contract signed on paper shows nothing.
  - **`submit-portal-request` kind `gc_owner_contract_sign`:**
    1. refuses a `gc` link;
    2. `gcPortalOwns`;
    3. the e-sign consent, required;
    4. the file's SHA-256 against the send's, else `fileChanged`;
    5. the drawn PNG stored, and taken back on a refusal;
    6. `gc_customer_sign_owner_contract` as the service role;
    7. the e-sign ledger row (`gc_owner_contract`) at its time.

    No inbox row and no email.
  - **`PortalGcJobs`** draws it with `ContractAcceptSignatureForm`, audience `customer`.
  - **Also in iii-a:** the sample portal shows a contract to sign, and What customers see registers `gc-portal-sign-contract`.
  - **Owner Billing's four changes:** the hash check before signing, every billing term, the signed copy's link, and the price pre-check.
  - **The bed's check:** "the service role signs and checks the price" (69 checks).
  - **Deploys:** customer-portal and submit-portal-request, the lead's.
- **iii-b, the email** (`gc-customer-email` kind `contract`, with D8's five details):
  1. The function attaches the send's own file after the same SHA-256 check (`fileChanged`), the client sends no PDF, and a test copy attaches the same file.
  2. The portal line is required (`gcContractPortalUrl`: `all`, else `customer`, never `gc`; none is `noPortal`).
  3. It goes to the contact first.
  4. It is filed as `gc_owner_contract` with the send as its source.
  5. The registries: the journey step `gc-contract-email`, the sample, personJourney and the kinds table.

  The other refusals are `notNewest` and `alreadySigned`.
  - **The send pane:** a box, **Email it to them now, with their portal link**, which starts off as every GC send's does, with the email beside it. The press keeps the send, makes the link (D6, amended), then emails, saying who it went to or why not.
  - **Deploy:** gc-customer-email, the lead's, right on the merge.

## Status

Plan written 2026-10-10 by Helper 2 (gc 2), from:
- a survey of origin/main at b3c5e508d (file:line above);
- the spike's prototype (`gcReducer.ts:551-580`, `GcCustomerSend.tsx`, `GcCustomerContractSign.tsx`, `gcCustomerSend.ts:53-130`, `gcCompanyFile.ts:169-297`);
- the plans named in `rows`.

Calls answered 2026-10-10 (Amendments, above). B6-d-i merged as v2.5160 (#5314), and 090000 is on prod. B6-d-ii is v2.5167 (#5320). B6-d-iii-a and iii-b are approved, and cut in that order once #5320 merges (As built, above).
