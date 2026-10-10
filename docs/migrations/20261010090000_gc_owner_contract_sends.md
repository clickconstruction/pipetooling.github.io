# 20261010090000_gc_owner_contract_sends.sql (2026-10-10, v2.5160)

GC mode, the Board's B6-d-i: our contract to the customer, sent from their window and signed in their portal, in the database. The plan is `to-dos/gc-mode/mockups/board-b6d.md` on branch `spike/gc-mode`. The lead answered calls D1 to D8 on 2026-10-10, and Owner Billing (gc 5) answered D5, D8 and this PR's shape the same day.

**What it creates:**
- one table, `gc_owner_contract_sends`;
- one private bucket, `gc-owner-contracts`, with two storage policies;
- seven functions;
- a restatement of Owner Billing's `gc_sign_owner_contract`;
- one widened CHECK on `esign_consents`.

It is applied on merge, after `20261010080000`. The CHECK is added `NOT VALID` and then validated, so the scan runs without the ledger's write lock.

## What it does

1. **`gc_owner_contract_sends`**: one row per send of our contract.
   - **What it keeps:**
     - the customer it went to, `first`, the day it went, `sign_by` and our line;
     - the price by line it went with (`worth`, ownerContractWorth's shape), with `total` generated from it;
     - the file's path, name and SHA-256;
     - once the customer signs, the signer's fields: the day, printed name, signature path, consent time, IP and user agent.
   - **Named CHECKs:**
     - sign-by on or after the day it went;
     - a line of 500 characters at most;
     - `worth` an object;
     - a file named;
     - a 64-hex fingerprint;
     - a signature whole.
   - **Who reads and writes it.** It is a dev's until award's door, then the money team's. It is never award's wider audience, because the price by line is our markup (board-b5.md:248).
     - The client inserts only the send's own columns, through `gc_send_owner_contract`.
     - No one signed in may UPDATE or DELETE a send.
     - Only the service role writes the signer's fields.
     - The three house calls cover it.
2. **The bucket `gc-owner-contracts`**: private, with files under `<project id>/`.
   - A dev reads and adds one. Training accounts and twins are refused, said in the policy since the table's fences do not reach storage.
   - There is no UPDATE or DELETE policy, so a file a signature binds to is never replaced.
   - The portal reads it through the service role.
3. **The price by line's checks, shared.** `gc_owner_contract_worth_problem(project, worth)` returns why a price is not whole, in `gc_sign_owner_contract`'s own words and order, or NULL. `gc_owner_contract_worth_ok` is its yes or no. A trade added or deleted since a send makes that send's price not whole.
4. **`gc_owner_contract_keep(project, day, worth)`**: our contract's first sign, shared by Mark it signed and the portal (Owner Billing's D5).
   - It writes `gc_owner_contract_lines` from the price by line, then `owner_contract_signed_on`.
   - It refuses a project already signed.
   - It is `SECURITY INVOKER`, granted to `authenticated` and `service_role`. RLS and `gc_projects_owner_terms_guard` decide who writes, exactly as before.
5. **`gc_owner_contract_portal_signed_on(project)`**: the day the customer signed in their portal, or NULL. A definer over the dev-only table, so Mark it signed's refusals see it whoever presses. It answers only the money team.
6. **`gc_sign_owner_contract`, restated.**
   - Its words and branches are Owner Billing's, and its first sign is now `gc_owner_contract_keep`.
   - Two refusals are new, for a contract the customer signed in their portal:
     - Undo: "They signed it in their portal, so it stays signed."
     - Moving its day: "They signed it in their portal on Oct 12, so its day stays."
7. **`gc_send_owner_contract(project, sign_by, note, worth, file_path, file_name, sha256)`**: `SECURITY INVOKER`, returns the send's id.
   - **Who may send.** It refuses, in words: no sign-in, a training account, a digital twin, and anyone but a dev until award's door (call D3).
   - **Which jobs.** It refuses a job that is not there, one still bidding, a lost one, and one signed already.
   - **The send itself.** It refuses: no sign-by day, or one gone by; a line over 500 characters; a price by line that is not whole (the shared words); no file; another job's file; a fingerprint that is not one; a file never uploaded.
   - The first send stamps `owner_contract_sent_on`. It sends no email: the client's `gc-customer-email` kind `contract` follows it (B6-d-ii).
8. **`gc_customer_sign_owner_contract(customer, send, name, signature_path, ip, user_agent)`**: service role only (B6-d-iii's `submit-portal-request` kind), after `gc_trade_sign_sow`.
   - It takes only the newest send, the customer's own, on a job still going, not signed yet, with its price still whole.
   - Its refusal keys carry the customer's reason as DETAIL: `notFound`, `notYours`, `lost`, `alreadySigned`, `notNewest`, `priceChanged`, `nameNeeded` and `tooLong`. `priceChanged` is pre-checked, so a customer never reads the office's words.
   - It writes the signer's fields on the send, then keeps the send's price through `gc_owner_contract_keep`. The price kept is the one they read.
   - It returns the consent time, for the e-sign ledger row.
9. **`esign_consents_record_type_check`** gains `gc_owner_contract`, keeping its nine values.

## Checked before the push

**The SQL bed** `supabase/tests/gc_owner_contract/20_scenario.sql` (`npm run test:pg:gc-owner-contract`; GitHub's `SQL beds`, job `gc-owner-contract`). It applies every migration, then this one a second time. Then it:
- refuses no sign-in, a training account, a twin, an estimator and a leader, each in words, and checks that anon calls none of the five functions;
- refuses each job state and each send that is not whole, in words, the price by line in Owner Billing's;
- keeps the first send whole, with the day it went stamped;
- treats the new price as a later send, keeping the first day;
- shows an estimator, an assistant and a leader no send and no file (and the estimator adds none), while a dev reads all three;
- refuses a dev who writes a signature, inserts a signed send or deletes one, and anyone signed in who signs for the customer;
- as the service role, refuses every key with its reason, including a trade added since the send;
- has the newest send signed at the time it gives back, its signature kept on it and its price kept line by line (the new fee, not the first);
- after the portal signature, refuses Undo and moving the day, a send after it, and the shared first sign, and a leader's Undo too;
- leaves Mark it signed on paper working as it did: Owner Billing's words, a first sign by line, the day moved, Undo refused once a pay application went out, then Undo;
- has the e-sign ledger take `gc_owner_contract` and its nine old record types, and refuse one it never had.

**Mutants.** Five broken copies of the migration were applied over the kept container, and the bed failed each one:
- the send with no dev gate;
- the signing with no newest check;
- the signing with no price pre-check;
- Undo allowed after a portal signature;
- the sends opened to the office team.

The real migration passed again after them.

**Owner Billing's own bed** (`scripts/pgtest-gc-owner-billing.sh`) passed unchanged on this branch: 294 checks, including every call to `gc_sign_owner_contract` in its 20_scenario, 30_interest, 40_closeout and 90_card_bills.

`src/lib/gc/ownerContractSql.test.ts` checks that the bed asserts every refusal and key the migration can raise. It also holds each one to the plain-words rules.

## After the push

`npm run gen-types` (the crew's types PR), so B6-d-ii can call `gc_send_owner_contract` and read the sends.
