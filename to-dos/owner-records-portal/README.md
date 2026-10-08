---
name: "Records for an owner, on their portal: they ask, they sign, they download"
number: 86
group: close
status: live 2026-10-06 (v2.4650, v2.4651, v2.4702) · walked end to end on ZZ TEST requests 2026-10-07, all eight steps passed; two fixes v2.4866 · left: the first real owner
summary: >
  Today an owner's records request is worked by hand: the office puts their written request on
  file, prints the acknowledgment for them to sign, prints or downloads the packet and hands it
  over. The ask: let the owner do their part on their portal. They type their name, which must
  match the owner of record letter for letter, sign the acknowledgment with the signature pad the
  app already has, and once the office sends the packet they see it under Your papers, with
  Download and Email it to me. The portal, the signature pad, the e-sign consent, the sent-copies
  store and the records window all exist; this plugs them together. Two shapes were drawn: the
  full one (ask → sign → the papers live on the portal) and a shorter one (sign → download,
  nothing kept on the portal). The owner picked the shorter one, and it is live.
next: Nothing to build. Delete this folder once the first real owner has signed.
size: XS
blocker: The first real owner who asks for records.
ver: v2.4650 · v2.4651 · v2.4702 · v2.4866
---

# Records for an owner, on their portal

Mock-up: [`mockup.html`](./mockup.html) — the owner's portal as they would see it, three stops, with shape B as a fourth frame.

## The ask

The owner, 2026-10-06, on the Records for an owner window: *"I think the acknowledgment is great. What I would like to do is be able to offer them in a portal where I can capture the homeowner's name and signature, where the name must be a letter match, and then the homeowner can see the files in the portal and have the option to download them or have them sent to his or her email. Elsewhere in the app we have signature tools we can use."* And: *"I am okay with changing the plan such that we don't present it and just offer it as a download after they sign."*

## What exists today

| Piece | Where | What it already does |
|---|---|---|
| The owner's portal | `/p/<slug>` and `/portal?t=<token>` (`CustomerPortal.tsx`, `customer-portal` function) | A no-login page behind a capability link. An owner of record is a customer row; Put a GC on notice's fourth tick already shows an owner their property's bills there (v2.3826, `shareBillsWithOwnersOfJobs`). *Your papers* lists signed lien waivers (v2.4304, `PortalWaiverPapers`). |
| The signature pad | `SignatureTypeOrDrawInput` (type a name in cursive, or draw), `EsignConsentLine` (the consent sentence and box, versioned words in `esignConsent.ts`) | Shared by the contract signer, the bid room, the estimate acceptance and the lien waiver seat. |
| A signing door with a token | `/contract/sign?t=…` (`JobContractSign.tsx`, `get-contract-for-signer`, `sign-job-contract`) | Reads the paper by token, takes the printed name, the consent, the ink, the signer's IP and agent, and writes them on the row. The pattern to copy. |
| The records window | `LienOwnerRecordsModal`, `lien_owner_record_requests.file` (`OwnerRecordsFile`: `request`, `contractChecked`, `acknowledgment`, `sent`) | Four checks before *Record it as sent*; Print and Download the packet (v2.4619); each print or download is a sent copy. |
| Sent copies | `sent_documents` + the `sent-copies` bucket (v2.4554) | The packet and the acknowledgment as they went, by kind, with `how` in `print · email · hand · mail · link · download`. |
| Email with a PDF | `send-lien-release-email` (Resend attachments) | The pattern for *Email it to me*. |

Nothing above is new. What is new is the owner's side of the acknowledgment, the name rule, and the two portal cards.

## The decision to make: two shapes

**Shape A — the papers live on the portal.**

1. The office presses **Offer it on their portal ›** on the records window. The app mints the owner's portal link (the same `mintCustomerPortalLink`, audience *owner*) and the office copies it or emails it.
2. The owner opens their portal and sees one card: **Our records for 9703 Lenox Hill**. It says what they will get and asks them to sign for it.
3. They type their full name. It must match the owner of record **letter for letter**: the same letters in the same order, ignoring case, spaces, punctuation and accents (`Umar Khan` matches `UMAR  KHAN` and `Umar-Khan`; `U. Khan` does not). The page says *Type your name as the county lists it: Umar Khan* when it does not match, so the rule is not a riddle.
4. They tick the consent and sign (type or draw). The acknowledgment is stored as a signed PDF with the ink, the way a lien waiver is (`lienReleaseInk`), filed as a sent copy of kind `owner_records_acknowledgment` with `how: 'link'`, and written to the request's `file`: `request` (on: today, how: `portal`, from: the name they typed) and `acknowledgment` (signedOn: today, link: the copy). **Checks 1 and 4 turn green in one act.** The Dashboard's Needs you gets a line: *Umar Khan signed for the records on 9703 Lenox Hill.*
5. The leader ticks check 2 (the contract) as today. Check 3 is the app's. The office presses **Record it as sent**, picking **On their portal** (a new `OwnerRecordsSentHow`). The packet is filed as today, and now also shown.
6. The owner's portal shows **Your papers → Records for 9703 Lenox Hill**: the statement as of the day it was sent, **Download** (the PDF from the sent copy, through a signed URL the function mints) and **Email it to me** (the address on file for the owner, or one they type; `send-owner-records-email`, a copy of `send-lien-release-email`). A second send makes a second row; the old one stays, dated.

**Shape B — sign, then download, nothing kept on the portal.**

Stops 1 to 4 as above. At stop 5 there is no portal card: once the office presses **Record it as sent**, the owner's page shows the packet's **Download** button once, on the same card they signed on, and the office's copy is the record. No *Email it to me*, no list.

**Why A is the better one.** The owner asked for the packet because someone (a lender, a title company, their own lawyer) wants it. They will want it again in a month and they will not have the file. Under B the office answers that call by hand. Under A the portal answers it. A also gives the office the same proof it has for a bill the owner viewed: the portal records the view. The cost of A over B is one portal card and one email function.

**What stays the office's.** The contract check (a clause can stop us sharing) and *Record it as sent*. The owner never sees the packet before the office sends it, under either shape. That is the gate counsel asked for, and it is why the portal does not simply publish the statement the moment they sign.

## Rejected

- **Signing inside the office's window on a shared screen.** It exists today (print, sign, *They signed it*). It does not reach an owner who is not in the room.
- **A bare link that opens the packet with no signature.** The acknowledgment is the paper that says what they asked for and what they got. Without it the packet is just a statement in the wild.
- **Matching the name loosely (first and last, any order).** The owner asked for a letter match. The rule stays strict and the page tells them the exact name to type.
- **Letting the owner pick the jobs.** The packet is the property, as today. One owner, one property, every job on it.

## Where it plugs in

- **Token and page.** A new audience on `customer_portal_links` is not needed: the owner is a customer; the existing link serves. The records card reads from a new verb on `customer-portal` (`owner_records`: the open request for this customer, its state, the signed copy, the sent packets).
- **The write.** A new function `sign-owner-records` (shape of `sign-job-contract`): token → request row → name rule → ink PDF → sent copy → `file.request` + `file.acknowledgment`. Service role, the link is the capability, RLS untouched.
- **The name rule.** A pure kernel, `ownerNameLetterMatch(typed, onRecord)`, with the fold (case, spaces, punctuation, accents) and tests. Lives in `src/lib/jobs/ownerRecords.ts`; the function mirrors it in `_shared/`.
- **The office side.** `LienOwnerRecordsModal`: **Offer it on their portal ›** (mints and copies the link; the `request` check reads *Offered on their portal <day>* until they sign), a fifth `OwnerRecordsSentHow` (`portal`), and the footer line.
- **The owner side.** `PortalOwnerRecordsCard` (the ask and the signing; the signed state) and a row group in *Your papers* (shape A). Light theme, the statement's palette, as every portal card.
- **Email.** `send-owner-records-email`: the packet PDF as an attachment, to the owner's address on file or the one they type; logged through `logEmailSend`.
- **Guides.** *give an owner our records for their property* (the portal path beside the printed one); a new *ask for the plumber's records on your property* for the owner's side is not needed — the card carries its own words.

## The plan

1. **PR 1 (S–M): sign on the portal — built v2.4650.** The name kernel + tests; `sign-owner-records`; the portal card's ask and signing stops; the `file` writes; the office window's **Offer it on their portal ›** and the request check's new words. Nothing is shown to the owner after signing but *Thank you. The office sends the records once it has checked our contract.*
2. **PR 2 (S): the office sends to the portal — built v2.4651.** `OwnerRecordsSentHow` gains `portal`; *Record it as sent* files the packet and marks it shown. The Needs you line came later, as v2.4702.
3. **PR 3 (S–M, shape A only): Your papers.** The `owner_records` verb returns the sent packets; the portal lists them with **Download** (signed URL) and **Email it to me**; `send-owner-records-email`.
4. **PR 4 (S, shape B instead of 3): the one Download — built v2.4651.** The signed card shows **Download** once the office has sent.

Each PR ships its release note, its `docs/recent-features/` fragment, its `docs/EDGE_FUNCTIONS.md` section and the guide edit. The functions deploy after merge.

## The owner's answers (2026-10-06)

- **Shape B.** One Download on the card they signed, after the office sends; nothing listed, no *Email it to me*. PR 3 is not built.
- **Who may sign: the owner of record, and a second name the office adds when it offers** (a spouse, a property manager, the manager of a company on the roll). The letter match runs against either.
- **Counsel approved the wording** (v2.4627). The portal acknowledgment carries the approved words.

## Where it stands

**Live 2026-10-06.** Both PRs merged (v2.4650 as #4641, v2.4651 as #4643). Migration `20261006040000` is pushed. `sign-owner-records` and `customer-portal` are deployed, and each answers an empty POST with 400 *Missing token*. The client is on clicktooling.com. Shape B is complete.

**Walked 2026-10-07, v2.4866.** All eight steps under *How to verify* passed on two ZZ TEST requests, J1064 and J904, since the ZZ sweep had folded J1050–J1053 into the sink. The first `lien_owner_record_request` consent row is on prod. The walk found two things, both fixed in [v2.4866](../../docs/recent-features/v2.4866.md): a job with no address left the acknowledgment's first sentence blank, and check 1 still offered Change after a portal signing. Left: the first real owner. A ZZ property reaches the picker only with a notice row on the desk; the fragment says how the walk made one and voided it after.

**The Dashboard's Needs you line, v2.4702.** The plan's stop 4 line, which v2.4650 and v2.4651 left out: a portal signing puts *Umar Khan signed for the records on 9703 Lenox Hill* on the Needs you card, and Quickfill's, until the request is recorded as sent. **Open their request** opens the Lien desk with this window on that property (`?ownerrecords=<job id>`).

**What each PR holds.** v2.4650: `_shared/ownerNameMatch.ts`; `sign-owner-records`; `customer-portal`'s `ownerRecords`; `PortalOwnerRecordsCard`; the window's **Offer it on their portal ›** with the second name; `file.offer` and the portal `acknowledgment`; migration `20261006040000` for the consent ledger. v2.4651: *On their portal* is the fifth way to record it as sent (offered only once the records were offered there); that send files the packet as a PDF, and the owner's card shows **Download the records** with a signed URL to it (good for an hour, minted each time the portal loads).

## How to verify

The walk. **This is prod data: use a ZZ TEST request only** (the ZZ jobs left after the sweep: J1064 *ZZ TEST sink* and J904 in 2026-10-07's walk). What it writes stays as test residue on those jobs: one request row, one portal link, one `esign_consents` row, and the packet PDF (plus the ink PNG when drawn) in `sent-documents`.

1. **Sign in on localhost.** Copy `.env` and `.env.local` from the main checkout into the worktree (worktrees lack them), run `npm run dev`, and open `http://localhost:<port>/dev-login?as=1&to=/jobs`. Then open the Lien desk at `/jobs?tab=stages&liendesk=1`.
2. **Open the request.** Press **An owner asked for records ›** and pick a ZZ TEST property. **Offer it on their portal ›** shows only when the property's owner of record is a customer row; make sure that customer is a test one, since the offer mints that customer's portal link.
3. **Offer it.** Press **Offer it on their portal ›**, type a second name in *Also allowed to sign*, and press **Offer it and copy the link**. Check 1 reads *Offered on their portal <day>. Waiting for them to sign.* The built-in browser pane refuses clipboard writes; the window then shows the link in a toast for 12 seconds instead.
4. **Sign as the owner.** Open the link in a private window (the portal needs no sign-in). The card *Our records for <address>* asks them to sign. Type initials first: it answers *Type your name as the county lists it: <owner>*. Then type the owner's name with a double space, a hyphen and lower case: it matches. Tick the consent, sign typed, and press **Sign and send my request**. The card thanks them by name.
5. **Read it back in the office.** Open the Dashboard. Needs you reads *<name> signed for the records on <address>*. Press **Open their request**: the Lien desk opens with the records window on that property. Check 1 reads *On their portal from <name>, <day>. Their signing is the request.* Check 4 reads *Signed on their portal <day> by <name>, typed.* with no Change. On the row: `file.request.how = 'portal'`, `file.acknowledgment.printedName`, and an `esign_consents` row with `record_type = 'lien_owner_record_request'`.
6. **Send it.** Tick check 2 (the contract), pick *On their portal*, and press **Record it as sent**. A `sent_documents` row of kind `owner_records_packet` gets a `copy_path`, and `file.sent.how = 'portal'`. Back on the Dashboard the Needs you line is gone.
7. **Download as the owner.** Reload the portal. The card reads *The office sent your records on <day>.* **Download the records** saves one PDF: the cover note and the statement.
8. **The second name.** On a second ZZ TEST request, offer with a second name and sign as that name, drawn this time. It matches, and check 4 reads *drawn*.
