# Lien run through Docsmit: phased code plan

---
file: docs/DOCSMIT_LIEN_RUN_PLAN.md
type: Engineering plan (draft, not yet agreed)
purpose: Give the company one certified-mail door (a vendor-agnostic mail_pieces table, an edge function per provider, an hourly poll) and open it first on the Lien desk's run, so a notice's envelope goes out through the Docsmit API (US-Letter PDF in, USPS number and delivery status back) instead of being printed and walked to the post office; then let delivery drive the collections cadence (owner call on day 3, a per-piece short link that says when the owner read it, letter two from the later clock) and send standing-rule GCs by cron. Written 2026-10-12 from a read of the Docsmit API reference and the run's code, widened the same day after the "is this the best we can do" pass; mockups linked below; of the PR train only PR 1, the kernels (v2.5375, `src/lib/mail/`), is on main.
audience: Owner, Developers, AI Agents
last_updated: 2026-10-12
sections:
  - The thesis
  - What stays the same
  - Owner decisions (open)
  - Facts the plan leans on
  - The shape
  - Past delivery
  - Signed with a pen
  - The run, shown not told
  - The order of everything
  - PR train
  - Live rollout
  - Risks and the trap list
---

Mockups (private artifacts): the run window with the Docsmit door, https://claude.ai/artifact/49e7Bi2Zh7FPVZcqVnNzzU; what a notice can tell you once it is mailed, https://claude.ai/artifact/Eo9atKWfs3BLX7sNqnDRuN. A playable prototype lives at `docs/prototypes/lien-docsmit-prototype.html` (open it in a browser; it keeps your notes in the browser only).

## The thesis

The run already thinks in envelopes. One name at one address is one envelope with one method and one tracking number, and the notices inside it stay the unit of record. Docsmit thinks the same way: one message is one recipient, one PDF, one USPS number. So the wiring is one new door on the run, **Mail through Docsmit**, that does what steps 1 and 2 do today (print, drive, type the numbers) and lands the run on step 3 with the numbers filled. Everything downstream, the filing row, the month grid, the Timeline, the affidavit's proof of service, counsel's portal, reads `job_lien_filings.sends` exactly as it does now.

Two things are new in kind, not just in plumbing. The USPS number may arrive **after** the send (Docsmit issues it when the piece is produced, and the `mailed` callback carries it), so the record must be honest about a number that is coming rather than owed. And Docsmit reports **delivery**, which the desk has never stored. That is the real prize: the affidavit and counsel get "delivered on the 14th, signed for" instead of "we mailed it".

Three more facts widen the plan past the mail. A certified notice is **given the day USPS accepts it** (§ 53.003; counsel to confirm), so the desk's mail-by day becomes a send-to-Docsmit-by time with Docsmit's production cutoff in it. The notice exists to **get paid**, so delivery should start the owner call, not a ten-day wait, and a per-piece short link on the pay page tells the desk when the owner read it. And everything else that goes certified (affidavit copies, the § 31.04 demand, releases, Collections demands, hazmat notices, HR letters) wants the same door, so the table is the company's, with the lien run as its first user and the provider as a column.

## What stays the same

- The statutory recipients (owner of record, original contractor), the envelope grouping (`src/lib/jobs/runEnvelopes.ts`), the approval flow, the master's first-notice rule, the hold-backs (no address, unsigned, nothing to claim).
- The recorded method word stays `certified_mail`. Every reader of `sends[]` (`lienSendTracking.ts`, `lienMonthGrid.ts`, `lienDeadlines.ts`, `LienFilingTabs.tsx`) keeps working with no change.
- The paper path stays as the fallback. An envelope whose method is hand, courier or email, or one Docsmit refuses, goes out as it does today. "Just this one" and "Already mailed? Record it…" are untouched.
- The courtesy PDF email to the GC still goes through `send-lien-filing-email` on record.
- Counsel's portal keeps leaving out tracking (`_shared/legalLienBookShape.ts`); whether it later shows "delivered" is a separate decision.

## Owner decisions (open)

| # | Question | Recommendation |
|---|---|---|
| D1 | Return receipt type. Docsmit offers *Certified, Electronic Return Receipt* (a PDF signature record) and *Certified, Return Receipt* (the green card). | Electronic, as the default. § 53.003 asks for certified or traceable service, so either satisfies it. One question to counsel before the first prod run, because the § 31.04 presumption reads "return receipt" and counsel may want the card for that letter only. Hold the choice in one constant so it can flip. |
| D2 | Which account email. Docsmit's callback host must be on the same domain as the account email. | A `@clickplumbing.com` mailbox the office owns (not a person's). The sandbox (Tracksmit) is a separate signup. |
| D3 | Who tops up credit, and the floor. Sending fails with 402 when prepaid credit is short. | The run shows the balance and the run's price before anything sends. The Dashboard's Needs you line names the balance when it is under one month's typical run. |
| D4 | Callbacks or polling for the number and the delivery status. | Poll first (an hourly edge cron reading `GET /messages/sent?messageIDList=`), callbacks later if an hour is too slow. Polling needs no DNS, no Worker and no dashboard-mirrored code, and it survives a missed callback. Lien deadlines run in days, not minutes. |
| D5 | Does the office still print a file copy. | No. The PDF Docsmit mailed is filed in `sent_documents`, and the Certification PDF (proof of mailing, then proof of delivery) is filed beside it when it arrives. |
| D6 | The GC's copy through Docsmit too, or paper. | Through Docsmit. Both are statutory recipients and the GC's envelope is the one that holds several notices. |
| D7 | The owner call on day 3 after delivery, in the Followup call queue. Whose queue, and is three days the cadence? | Three days, to the notice's drafter, with the master's rule per GC able to change it. |
| D8 | The cron on the 12th for standing-rule GCs, after a 6 pm digest the evening before. Comfortable with notices going out that nobody touched? | Yes, with the digest's Hold button and the existing first-notice rule (a GC's first notice never rides the cron). |
| D9 | Letter two's clock: from mailed as today, from delivered, or the later of the two. | The later of the two, shown with its reason. |
| D10 | Vendor. Docsmit's Certification PDF is court-grade; Lob and PostGrid carry per-scan webhooks and better-kept APIs; the label service the desk already exports to has an API too. | Build vendor-agnostic (a `provider` column, one edge function per provider). Spend one afternoon comparing proof quality and price before the first prod run, unless Docsmit was chosen for a reason, such as an account counsel already trusts. |
| D11 | Unclaimed mail: when USPS leaves a notice and nobody collects it, send the plain First Class copy at once, or wait for the return? | At once, as a Needs you row with one button. |
| D12 | Counsel's portal and the GC's portal: show the delivered lines and the Certification PDF? Today the firm portal hides tracking on purpose. | Firm portal yes, for referred matters. GC portal: owner's call. |

## Facts the plan leans on

Verified in the worktree on 2026-10-12.

- `buildRunNoticePdf(n, recipientKey, invoiceDocs, payBlocks)` in `src/lib/jobs/lienDeskRunIo.ts` builds one recipient's full US-Letter PDF: counsel's letter, the conditional release, the form, the pay page, the invoices stamped INVOICE. It is called only on the email path today. It takes a `CombinedRunNotice`, so a property's combined notice works.
- `runEnvelopes()` gives the envelopes with every copy inside; `recordLienDeskRun()` writes one `job_lien_filings` row per notice with `sends: [{recipient, method, tracking, sent_on}]`, taking the tracking from the envelope's box. A combined notice writes one row per job sharing a `packet_id`.
- `runLabelRow()` in `lienRunLabels.ts` already splits the one-line mailing address into line 1, line 2, city, state and ZIP for the label vendor. Docsmit needs the same fields plus `firstName`/`lastName` or `organization`.
- `send-lien-filing-email` is the pattern for an office-only edge function: Bearer JWT checked in the body, a user-scoped client so RLS proves access to the job, `verify_jwt = false` in `config.toml`.
- Docsmit (see the API reference memory and https://secure.docsmit.com/api/v1/index.html): token from `POST /token` with the SHA-512 hex of the password and a softwareID; token as the Basic username; `POST /messages/new` (title, `physicalParties`, `clientMsgID`, return address) → `POST /messages/{id}/upload` (multipart PDF) → `GET /messages/{id}/priceCheck` → `POST /messages/{id}/send` (402 + `shortfall` when short). `GET /messages/{id}/parties` returns each piece's `USPSTrackingID`, `DeliveryStatus` and `DStatusao`. `GET /messages/{id}/documentation` is the Certification PDF. Envelope `#10` holds 5 sheets, `Flat` holds 47. US addresses only. Two processes sharing a softwareID at once can fail, so sends are serialized.
- Migration numbering starts from `origin/main`'s newest file (`20261012150000_contract_clauses.sql` today); a `CREATE TABLE` migration ends with the three fence calls and starts with `SET lock_timeout = '3s';`.

## The shape

### Data

One new table, `mail_pieces`: one row per envelope the company sends certified, whatever sent it. The lien run is its first user.

| column | holds |
|---|---|
| `id` uuid | |
| `kind` text | what the envelope is: `lien_notice_53_056`, `lien_retainage_53_057`, `lien_affidavit_copy`, `demand_31_04`, `lien_release`, `collections_demand`, `hazmat_notice`, `hr_letter`, … (check-constrained; each kind names where its facts land when they come back) |
| `source_ids` uuid[] | the rows behind it: every `job_lien_filings` row inside a lien envelope (one, or N for the GC's envelope, or the packet's rows for a combined notice); a demand letter id; a release id |
| `job_id` uuid null | the job, when there is one, so the piece's cost and its papers land on it |
| `provider` text | `docsmit` today; `lob`, `postgrid`, `labels_api` if ever; the edge function is chosen by this |
| `recipient` text | `owner`, `original_contractor`, `customer`, `person`, … |
| `short_code` text | the per-piece code under the QR and link on the pay page (the owner's copy), so an open on that page is this piece's own event; never sent to the provider |
| `name`, `organization`, `address1`, `address2`, `city`, `state`, `postal_code` | the address as sent, after CASS |
| `send_type`, `envelope`, `sheets` int | what was asked for |
| `provider_message_id` text, `client_msg_id` text | the provider's key and ours (`<kind>:<pieceUuid>`) |
| `price` numeric | from priceCheck |
| `status` text | `prepared` → `sent` → `mailed` → `in_transit` → `delivered` \| `notice_left` \| `returned` \| `failed` \| `unknown`; check-constrained; `unknown` is the "needs a person" bucket for a provider string the fold has not seen |
| `usps_tracking` text | filled when the provider has it |
| `mailed_at` timestamptz | the legal moment: when USPS accepted it; written to the filing's `sends[].sent_on` and read by the Months grid as the day the notice was given |
| `delivered_at` timestamptz, `signed_by` text | from the provider's delivered / signedFor |
| `delivery_status`, `delivery_as_of` | the provider's last status string and its as-of |
| `events` jsonb | append-only log: every poll or callback payload, and our own (prepared, sent, pay page opened, call queued) so the piece's timeline is one list |
| `opened_at` timestamptz | first open of the pay page through this piece's short code |
| `pdf_path` text | the mailed PDF in the sent-copies bucket |
| `certification_path` text | the Certification PDF once fetched |
| `created_by`, `created_at`, `updated_at` | |

RLS: office roles read and write; a piece with a `job_id` follows the job's predicate. Fenced for read-only users and twins.

`sends[]` gains two optional fields on a provider send: `via: 'docsmit'` (the provider) and `piece_id`. `sendNeedsTracking()` learns that a blank number with a live piece is **coming**, not owed, so the Dashboard stops nagging for a number the office cannot type.

### Edge function `mail-send-docsmit`

One function per provider, office-only (JWT + RLS on the job like `send-lien-filing-email`), with an `action` field. A thin `mail-send` kernel in `_shared/` holds what every provider shares (the piece row, the status fold, the sends patch) so a second provider is the HTTP part only. Secrets: `DOCSMIT_BASE_URL` (prod or Tracksmit), `DOCSMIT_EMAIL`, `DOCSMIT_PASSWORD_SHA512` (only the hash is ever stored, since that is all the API takes), `DOCSMIT_SOFTWARE_ID`. One `POST /token` per invocation; the token is never returned to the client.

- `prepare`: takes `piece` (the row's kind, address fields, send type, envelope, `source_ids`, `job_id`) and `pdf_path` (the client has already written the PDF to the sent-copies bucket, so no 6 MB base64 body). Runs `POST /utils/multiCASS` on the address and refuses with the correction or `nonMailable` text when the address will not mail. Creates the message, uploads the PDF, runs `priceCheck`, inserts the `mail_pieces` row as `prepared`, returns `{piece_id, price, correction}` plus the account's `creditBalance` from `/account/info`.
- `send`: takes `piece_ids[]`, serialized one at a time. `POST /messages/{id}/send`; on 201 marks the piece `sent` and writes `sent_on`; on 402 stops and returns the `shortfall` so the run can say *Docsmit credit is short by $X, nothing more was sent*. Reads `/parties` once after the send and fills `usps_tracking` if Docsmit already has it.
- `refresh`: takes `piece_ids[]` (or none, for every piece not yet delivered), reads `/messages/{id}/parties`, updates tracking, status and the event log, and writes the USPS number into each filing's `sends[]` through the `withTracking` shape. When the status reads delivered, fetches `/documentation` and files it.

`mail-poll` is a second, cron-driven function (X-Cron-Secret like `sync-salary-sessions`) that calls `refresh` for every open piece hourly, whatever its provider. It also lists `GET /messages/sent?turnOffSoftwareID=true` so a notice the office sent by hand from Docsmit's own site is matched by title and recorded as a piece.

`lien-standing-run` is a third cron, on the 12th of each month (two business days before the 15th window closes, so an outage still leaves the counter): for every open month whose GC has the standing rule and whose notice is approved by that rule, it builds, checks the address, sends and records, exactly as the run button would. At 6 pm the evening before, the master gets one push, "N notices go to Docsmit tomorrow at 3 pm by standing rule", with a Hold on each row; a held notice drops out and comes to him as today. A GC's first notice, a live promise, a held notice and a claim set by hand never ride the cron.

### Managed from Developer settings

The connection and its switches live on the Settings page's Developer section, dev role only, as a `DocsmitDevSettingsBlock` beside the existing dev blocks. Two homes, by the app's own pattern:

- **Secrets** (`DOCSMIT_EMAIL`, `DOCSMIT_PASSWORD_SHA512`, `DOCSMIT_SOFTWARE_ID`, one set per environment): Supabase Vault, written by a dev-only edge function `mail-config` (JWT + dev role in-body) that the block calls; the password is hashed in the browser and only the hash travels; `mail-send-docsmit` and `mail-poll` read Vault at call time; nothing is ever returned to a browser. (Vault replaces `supabase secrets set` for these three, so the owner can rotate them without a terminal.)
- **Switches and numbers**: `app_settings` rows: `docsmit_env` (`tracksmit` \| `prod`), `docsmit_paused` (runs open on paper and hide the button), `docsmit_run_default` (`docsmit` \| `paper` \| `last`), `docsmit_return_receipt` (`err` \| `card`), `docsmit_plus_default`, `docsmit_cutoff_local` (their production time, Central), `docsmit_send_by_buffer_days`, `docsmit_credit_warn`, `docsmit_poll_minutes`, `docsmit_callbacks`.

The block offers **Test the connection** (`mail-send-docsmit` action `ping`: a token and `/account/info`, returning only the account's name, balance and limits), **Poll now**, and a log of the last calls with status and timing (from the pieces' `events` and the function's own log table, `mail_api_calls`). The master's standing rule per GC can override the run default and the plain-copy default; the office never sees this page.

### The mailed date is the legal date

The Months grid and the deadline watch read a Docsmit send's day from `mail_pieces.mailed_at`, the day USPS accepted it, not from the day the button was pressed. Before the send, the run's strip says *Send to Docsmit by Oct 14, 3:00 pm* (the window's last day less one business day, at Docsmit's cutoff), and after the cutoff it says the month will mail late and offers the counter. Counsel confirms the rule; Docsmit confirms the cutoff; both live as constants in `src/lib/mail/mailPiece.ts`.

### The window envelope

Docsmit mails in a double-window #10 or a flat. The owner's page 1 is counsel's cover letter, so the PDF builder places the recipient block in the window zone and the pay page's QR and short link under it. The first Tracksmit run is read on paper for this before anything else.

### The run window

Step 1 grows one button beside the print button, **Mail through Docsmit · N envelopes**. It is enabled when at least one envelope is on `certified_mail` and has no problems. Pressing it:

1. Builds each certified envelope's PDF: `buildRunNoticePdf` per copy, merged in envelope order with `mergePdfBlobs` for an envelope holding several copies. Counts pages; picks `#10` for 5 sheets or fewer, `Flat` up to 47, and holds the envelope with a red line past that.
2. Writes the PDF to the sent-copies bucket (one filed copy per envelope, `how: 'docsmit'`), then calls `prepare` for each. The window lists each envelope with its price and any address correction, and shows the total against the balance. A `nonMailable` address shows as a held row, like a missing address does today.
3. **Send N through Docsmit ▸** opens the review (below). **Mail these N envelopes ▸** on the review calls `send`. Each sent envelope's tracking box reads *mailed through Docsmit · number coming* (or the number, if it came back at once), locked from typing. The run moves to step 3 with **Mailed on** set to today.

### Review before it mails

Nothing goes to Docsmit until the office has seen it the way Docsmit will mail it. The review is a modal over the run (`DocsmitReviewModal`), one envelope at a time, fed by the same PDF `prepare` uploaded:

- **The envelope face**, drawn as Docsmit's double-window #10 or flat: the return address in the upper window, the recipient as checked (the ZIP+4 line, the corrected street) in the lower, the *Certified Mail · Electronic Return Receipt* line, and a placeholder where Docsmit's label and number go.
- **The pages, in order**, as a strip of numbered thumbnails and one page large: counsel's letter with the address block in the window zone and the QR under it, the conditional release, the § 53.056 form with the signature frame, the pay page, the invoices stamped INVOICE. The large page is the PDF's own page rendered (pdf.js is already in the bundle for the viewer; the mock draws paper). Arrow keys walk the pages, up and down walk the envelopes, Esc closes; the same keys as the run's existing preview.
- **As Docsmit mails it**: US Letter, single-sided, black and white, N sheets in a #10 or a flat, the send type, the return address, the price; *Open the exact file ›* opens the PDF the function uploaded; *not in this envelope*: color, staples, the plain copy (its own piece).
- **A check line** the office reads before pressing: the address shows in the window, the signature is on page N, the months and the claim as the form states them, the invoices count.
- **The footer**: *Back* and *Mail these N envelopes · $21.86 ▸*, with *Docsmit mails today's batch at 3:00 pm* beside it. A review of a held or problem envelope shows the problem on the face and has no Mail.

The review is the same component the Sent row's *The mailed copy ›* opens later, read-only, so what was reviewed and what was mailed are one thing.
4. **Record the mailing** runs `recordLienDeskRun` as today. For a Docsmit envelope the send record carries `via`, `piece_id` and whatever tracking is known. The function's `prepare` already knew the filing ids are not minted until this moment, so after the insert the client patches `mail_pieces.source_ids` (one small update per piece).

Envelopes on other methods keep their print and type path in the same run. A run can mix.

The Sent footer, the Lien window's filings list and the Dashboard read the piece: *mailed through Docsmit · Oct 14*, then *delivered Oct 17, signed for*, then a link to the Certification PDF. "Tracking owed" is reserved for paper sends. Pressing a recipient's chip opens the piece: the legal line (given on the 13th, two days to spare), the timeline, the papers (what we mailed, the Certification PDF, the return receipt), the facts (number, type, cost, covers), and the doors (USPS tracking, send a plain copy, mail to another address, refer to counsel). A **Deliveries** filter on Sent groups every piece under Needs you (notice left, returned, unknown status, number missing, credit short), In flight and Landed.

## Past delivery

The notice exists to get paid, so the piece's timeline keeps going after the delivered scan.

- **The owner call on day 3.** When `delivered_at` lands, the desk queues an owner call three days out in the Followup call queue (the queue and the owner's-call record already exist), to the notice's drafter. A recorded owner call or a payment clears it.
- **The owner read it.** The owner's copy carries a QR and a short link to the pay page with this piece's `short_code`. The pay page records the first open on the piece (`opened_at`, plus an event). Nothing about this goes to the provider.
- **Letter two from the later clock.** `lienLetterTwo.ts` takes the later of mailed and delivered as day 0 and says which it used. An unclaimed or returned piece keeps the mailing clock and says why.
- **Unclaimed and returned are Needs you rows**, each with one door: send the plain First Class copy now, mail it to another address, send by courier. A returned piece flags the owner gate on every open job at that address.
- **Counsel's packet assembles itself.** A referred matter's card in the firm portal carries, per notice and recipient, mailed, delivered, signed by, and the Certification PDF; an affidavit's served dates fill from the mailed dates of its copies. The portal still shows only what the owner allows (D12).
- **Cost on the job.** Each piece's price posts to the job as a lien cost line, so the chase cost sits beside the money recovered.

### Words

Help guide `send-lien-notices-from-the-lien-desk.md` gets a section under *Sending the run*, in plain words: what the button does, what the price line means, what *number coming* means, and that the paper path is still there. `texas-lien-rules-the-app-follows.md` gets one sentence under *When certified mail is required* naming the electronic return receipt, once D1 is decided.

## Signed with a pen

Found 2026-10-12 when Taunya asked what happens with a wet signature: a packet printed Oct 9, the leader signed the papers with a pen, she mailed them, and Record the mailing held three envelopes as *Unsigned* with no way to say he had already signed the paper. The signing rule (v2.5086) shipped the day after that packet printed, so every packet printed before it sits in the same spot. This is a paper-path fix, independent of Docsmit, and it ships first.

**The rule.** The app already says a signature is the record, not the mark (`lienNoticeSignature.ts`). A pen signature is the leader's own act on the paper as printed; the record names who signed, when, who wrote it down, and how they know, and it is tied to the paper by the record id the frame already prints in its corner (`L878-4C2E91`). It mirrors *Approve on his word*: the office writes it down, the leader sees it on his phone under *Signed by pen, as recorded*, and can confirm or say *Not what I signed*.

**Data.** `signer_signature_mode` gains `'pen'` beside `'type'` and `'draw'`. Three columns join the seven: `signed_recorded_by` (the office user), `signed_witness_how` (`watched` | `told` | `page`), `signed_leader_confirmed_at`. `signer_signature_storage_path` holds the photo or scan of the signed page when there is one; `signed_fields_hash` is the hash of the fields **as printed** (the sent copy's), so a draft edited after printing is refused, as today. Migration: a check-constraint widening and three `ADD COLUMN IF NOT EXISTS`, `lock_timeout` first.

**Where.** (1) On the run's held envelope line, a third door after the phone and the screen: *he signed the paper with a pen · Record it ▸*. It opens one pane for every held notice in the run: who (the job's leader, from People), when (the print day filled in), how you know, the signed page (optional; the record ids are read off it and matched), which notices (all ticked). *Record N pen signatures ▸* writes the columns, the envelopes unhold, and Record the mailing goes on. (2) The same door on the notice's footer beside *Sign ▸*, and in the Lien window's notice tab. (3) The leader's phone that evening: *Taunya recorded your pen signature on 3 notices*, with *Yes, I signed these* and *Not what I signed*; a flag opens a problem row for the office and counsel. (4) The Sent footer and the piece drawer read *signed by pen · Oct 9 · recorded by Taunya · signed page on file · leader confirmed*; counsel's packet carries the same line. (5) The Dashboard's Needs you counts pen records with no photo and no confirmation, for the leader.

**Docsmit.** A Docsmit envelope mails the PDF, so it still needs the electronic signature; the pen door is hidden on it. Later, if wanted: sign the signature page on paper, scan it, and the scan rides in the PDF in place of the frame.

**Decisions (owner, 2026-10-12).** D13: the photo is asked for, not required; Needs you nags until it is there. D14: *he told me* counts on its own; the affidavit's served line says which of the three it was. D15: the leader's confirmation is not needed; it strengthens the record when it comes and its absence blocks nothing.

**PRs.** Pen-1: kernel (`lienNoticeSignature.ts` reads `pen`, audit-line words, `runNoticeProblems` unchanged) + migration + types. Pen-2: the pane (`LienPenSignaturePane`) on the run and the notice footer, the Sent words, the help guide section *He signed it with a pen* under *Sending the run*, release note. Pen-3: the leader's phone confirm and the Needs you count. Prototype: tab 6 of `docs/prototypes/lien-docsmit-prototype.html`.

## The run, shown not told

Approved 2026-10-12 from the before-and-after page (https://claude.ai/artifact/Q47fboVoTnAzojaVz8dUZY) and built into tab 2 of the prototype. The run window stops telling the process in a strip of pills and red sentences and shows it: a journey across the top, a card per envelope that changes shape as the envelope moves, one button at the foot, a screen for step 2, two lanes for a mixed run, and the run's own bar on the desk's door. It is independent of Docsmit; it ships before the Docsmit train because the review modal and the pen pane both hang off the card.

**What it is.**

- **The journey** replaces the step strip: six nodes (Built, Signed, Sent, In the mail, Recorded, Delivered), a count under each (`2 of 3`), the blocker drawn on the node it blocks (`1 waits on the leader`, amber), the fill moving as envelopes move. On a phone it wraps to two rows of three.
- **The envelope card** replaces the table row: an envelope glyph that is open, sealed, postmarked or delivered; the envelope's own dots (Built, Checked, Signed, then Sent/Mailed/Delivered for Docsmit, Printed/Mailed/Recorded for paper, Printed/Handed over/Recorded by hand); one state chip; only the buttons that move it (Sign here, He signed the paper, Preview the pages, Print this envelope); the notices inside with their in-this-run ticks; the how-it-goes-out menu and its add-ons. Held and waiting are the card's colour, not a sentence.
- **The foot** is one status line (what pressing does, what will not go) and one big button named for the next thing with its count and price: Review and mail N, then Print the packet N, then Record the mailing N. Envelope faces, labels, Mailed on, Saved copy, Print again and Take back live under **More**.
- **Step 2 gets a screen**: the printed checklist sheet, live, one row per paper envelope with stuffed, slip on, mailed and the number box; it appears when the packet prints and reads back into the cards.
- **A mixed run** shows two lanes after the send, Docsmit and in your hands, each with its own dots.
- **The door on the desk** carries the run's bar (green sealed, amber waiting, grey to do) and the count of who is waiting, so nobody opens the run to find out.

**What does not change.** The envelope as the unit and the notices as the record (`runEnvelopes.ts`, `job_lien_filings`); every hold reason, word for word; the packet and its divider pages; Combine the jobs at one property; the courtesy tick; every write the run makes today (`recordLienDeskRun`, `printAndFile`, `markLienDeskItemSent`). This is a re-skin of `LienDeskRunModal.tsx` over the same state and the same writes.

**How to build it without breaking the busiest file in the app.** `LienDeskRunModal.tsx` is 3,440 lines with 119 commits in 90 days (`docs/LIEN_DESK_ARCHITECTURE.md`). Kernels first, then additive UI, then the swap, each its own PR, each cut from fresh main and merged before the next, with a session card in `.claude/sessions/active/` so parallel sessions see the surface is hot.

1. **Run-1 · kernels** (no UI). `src/lib/jobs/runJourney.ts`: envelopes + notices + printed/sent/mailed/recorded facts → the six nodes with counts, the current node, the blocker; `runEnvelopeStage.ts`: one envelope → its lane, its stage list, the first stage not done, waiting or not, the glyph state; `runFootAction.ts`: the run → the primary action (`review_mail` \| `print` \| `record` \| `none`) with its count, price and the two status lines; `runChecklist.ts`: the paper envelopes → the live sheet's rows and the record-readiness. Unit tests for every branch the prototype shows, including the mixed run and the all-waiting run.
2. **Run-2 · the journey, additive.** `LienRunJourney.tsx` rendered above the existing table from `runJourney()`; the old step strip stays one PR longer; render smoke.
3. **Run-3 · the cards.** `LienRunEnvelopeCard.tsx` replaces the table body; the glyph as an inline SVG component with four states; the existing method menu, add-ons, courtesy tick, sign-here and Preview move into the card unchanged; the step strip comes out; render smokes for open, waiting, sealed, postmarked, delivered, held and not-this-run. The help guide's *Sending the run* section is rewritten in plain words for the new shape (the words a first-timer reads; `helpGuidePlainWords.test.ts` holds it).
4. **Run-4 · the foot and More.** `LienRunFoot.tsx` from `runFootAction()`; the secondary controls behind More; `PROJECT_DOCUMENTATION.md` updated for the new button names.
5. **Run-5 · step 2 and the lanes.** `LienRunChecklist.tsx` from `runChecklist()`, shown once `printed_at` is set, writing the ticks and numbers into the same envelope state the record reads; `LienRunLanes.tsx` when the run is mixed; the Do now row's door becomes the run pill (`runJourney()` again, read from the desk's own data, no new query).
6. **Run-6 · the pen pane in the card** (Pen-2 from the section above lands here if it has not already).

**Decisions (owner, 2026-10-12).** D16: six nodes; Checked is the address check and it is worth seeing. D17: the office's cards show Sign here; it is the same door as today's Leader here, sign. D18: the live checklist is for both the phone and the desk; the paper stays.

## The order of everything

Three trains, in this order, each shipping small from fresh main:

1. **Pen** (Pen-1 to Pen-3): the signed-with-a-pen path. Unblocks Taunya's held run and every packet printed before the signing rule. No Docsmit, no redesign.
2. **Run** (Run-1 to Run-6): the run shown, not told. The review modal and the pen pane hang off the card, so the card comes before Docsmit.
3. **Docsmit** (1 to 9 below), with the dev settings block landing with PR 3 and the review modal with PR 5, both onto the card.

## Working beside the Messages and GC mode train

Checked 2026-10-12 21:45Z: main took 73 commits that day, about 40 PRs were open, 20 versions (v2.5343 to v2.5363) and 9 migrations (20261012180000 to 20261013090000) were claimed in the day, all from the owner's other session on Messages, flows and GC mode. None of its open PRs and none of the day's main commits touch the lien desk: not `LienDeskRunModal.tsx`, the lien kernels, `runEnvelopes.ts`, `lienNoticeSignature.ts`, `lienDeskRunIo.ts` or the lien help guide. It does touch `src/pages/Settings.tsx` (three merges that day, two PRs open), `supabase/config.toml` and `docs/EDGE_FUNCTIONS.md`, which only the Docsmit train needs, weeks out.

So the plan's content stands and only its mechanics change:

- **Start now with Pen-1.** Its files are disjoint from the other train and Taunya is waiting on it. Drop a session card in `.claude/sessions/active/` first so the other session sees the lien desk is taken.
- **Claim late, rebase before every push.** `npm run claim` right before the PR opens, never ahead; main moves 70 commits a day, so rebase before each push and re-arm auto-merge after. Never touch the other session's branches.
- **Migrations through the claim tool, after a fetch.** The newest claim is 20261013090000; Pen-1's migration claims after it and is rebased again before `supabase db push`. List pending before pushing: the other session's merged migrations may be pending too, and pushing them is its call, so say so on the session card.
- **Keep the shared docs to one touch per train.** `PROJECT_DOCUMENTATION.md`, `GLOSSARY.md` and `index.css` are the only files both trains edit; put each train's edits in its last PR.
- **Expect queue latency.** With 40 PRs ahead, each of ours waits hours in the merge queue; the train's cadence is one PR a day, not one an hour. Do not stack PRs; the queue's squash breaks stacks.
- **Hold the Docsmit train's shared-file PRs** (the dev settings block on `Settings.tsx`, the `config.toml` entries, the `EDGE_FUNCTIONS.md` sections) until the Messages train's Settings and edge-function work has merged, or cut them from fresh main the same morning.

## PR train

Ship small; each PR is one `npm run claim` version with its release note and `docs/recent-features` fragment.

1. **Kernels** (no UI, no schema) — shipped as v2.5375. `src/lib/mail/mailAddress.ts`: envelope name + one-line address → provider party (organization vs first/last split, reusing `splitCityStateZip`). `src/lib/mail/mailPiece.ts`: page count → envelope choice, the sendType constant for D1, `clientMsgID` format, the status fold over a provider's payload with `unknown` for strings it has not seen, the send-by time from a window's last day and the cutoff. `lienSendTracking.ts`: `via`/`piece_id` and the "coming, not owed" rule. `lienLetterTwo.ts`: the later-clock rule. Unit tests for all, including the hostile addresses the label CSV already handles.
2. **Migration** `mail_pieces` — shipped as v2.5379 (`20261013120000_mail_pieces.sql`) + RLS + the three fences + `docs/migrations/<version>_mail_pieces.md` + regenerated `src/types/database.ts`. Pushed with `supabase db push` after merge.
3. **Edge functions** — shipped as v2.5381 (deploy owed; Docsmit secrets are the owner's to set). `mail-send-docsmit` and `mail-poll` with the `_shared/mailSend.ts` kernel, `config.toml` entries, `docs/EDGE_FUNCTIONS.md` sections and TOC lines, handler tests under vitest with a recording fake Docsmit (the mocked-URL-imports recipe). Deployed against **Tracksmit** first; the base URL secret decides which Docsmit it talks to.
4. **The PDF for the window** — shipped as v2.5382 (migration `20261013130000_mail_piece_opened.sql`; the zone to be read on paper from Tracksmit): the owner's page 1 with the address block in the window zone and the QR + short link under it; the pay page records the open on the piece. Read on paper from Tracksmit.
5. **The run window** — 5a, the pure side (`src/lib/mail/runDocsmit.ts`, `docsmitSettings.ts`), shipped as v2.5384; 5b, the window itself, after the run train lands: the button, the send-by strip with the cutoff, the price step, the send step, the locked tracking box, the record patch, the Sent-footer chips and the piece drawer, the render smoke, the help guide section, `PROJECT_DOCUMENTATION.md` line for the new button.
6. **Delivery drives the desk** — 6a, the poll's cron and the switches' policies (`20261013150000_mail_poll_cron.sql`), shipped as v2.5385; 6b part 1, the desk reads the pieces (Sent row + footer), shipped as v2.5455; the rest of 6b after it: the poll cron scheduled, the mailed date as the given date in the Months grid, the owner call queued on delivery, the Deliveries filter with its Needs you rows and doors, the Certification PDF filed on delivery, the cost line on the job, the credit-balance line on Needs you.
7. **The standing-rule cron** `lien-standing-run` with the 6 pm digest push and its Hold.
8. **Counsel's packet** — shipped as v2.5388 (the firm portal's envelope line, the Certification links, the affidavit's served day from its mailed copy); on the firm portal for referred matters (D12), the affidavit's served dates from the copies' pieces.
9. **Optional, later**: a callback receiver. A path on the existing `my.clickplumbing.com` Worker (`portal-link-shell`, dashboard-edited and mirrored in `scripts/cloudflare/`) that forwards `/docsmit/<secret>/*` to a `mail-callback` function, since Docsmit has no signing secret and the host must sit on the account's domain. Only if the hourly poll proves too slow. Also later: the other kinds (affidavit copies, the § 31.04 demand, releases, Collections, hazmat, HR) open on the same door one at a time.

## Live rollout

1. Tracksmit account on the D2 mailbox, credits requested by email, softwareID requested by email. Secrets set on the prod project pointing at Tracksmit.
2. End-to-end on a ZZ TEST job with the owner's own address as the owner of record and the office as the GC: prepare, price, send, poll until delivered, Certification PDF filed. Confirm whether `USPSTrackingID` is present right after `send` or only after `mailed`; the "number coming" words exist for the second case.
3. Flip `DOCSMIT_BASE_URL` to prod, with prod credentials and a credit top-up.
4. First real run: one envelope, a GC with a standing rule, with the master watching. Keep the paper path in the same run for the rest that day.
5. After a week: compare the Dashboard's tracking-owed count before and after, and the time from approval to "delivered".

## Risks and the trap list

- **The number may not exist at send time.** Design assumes it arrives by poll. If it does arrive at send, nothing changes except fewer "coming" words.
- **The cutoff.** A send after Docsmit's production cutoff mails the next day, and the month can be late. The strip warns before the button; the cron never runs late in the day; the counter stays as the fallback.
- **The window.** A cover letter whose address block misses the window zone mails blank. The Tracksmit paper check is the gate for PR 4.
- **Unattended sends.** The cron sends legal notices nobody touched that day. The digest, the Hold, the first-notice rule and Sent on your word are the four guards; the cron is PR 7, after a month of hand-pressed runs.
- **Vendor lock.** The provider column, the shared kernel and the fold keep the vendor to one function; the status vocabulary is ours, not theirs.
- **A one-line address is a guess.** The CASS pre-flight is the guard; a corrected address is shown before the send and the correction is kept on the piece, never written back to the customer without a person pressing something.
- **Sheet limits.** A packet with many invoices can pass 47 sheets. The run holds that envelope with a reason rather than splitting it.
- **Two senders at once.** Two office screens pressing the button in the same minute share one softwareID. `send` runs one piece at a time inside one invocation; a second invocation that sees a `prepared` piece already `sent` skips it. Good enough for one office.
- **Edge function wall clock.** `prepare` for a run of ten envelopes is ten uploads; the client calls `prepare` per envelope, not once for the run, so no call outruns the limit.
- **Credit.** 402 stops the loop cleanly; pieces after the shortfall stay `prepared` and the button offers to send them again after a top-up.
- **Tokens.** One per invocation, never cached in a table, never sent to the browser.
- **The counsel question (D1).** Settle it before the first prod envelope, not after.
- **Docs drift.** Docsmit's page has its own inconsistencies (`upload2`, `MessageID` vs `id`); the fake Docsmit in the tests is built from what Tracksmit actually returns, recorded during step 2 of the rollout.
