---
name: "Records for an owner, on their portal: they ask, they sign, they download"
number: 86
group: gated
status: proposed 2026-10-06 · nothing built · waits on the owner's pick between the two shapes below
summary: >
  Today an owner's records request is worked by hand: the office puts their written request on
  file, prints the acknowledgment for them to sign, prints or downloads the packet and hands it
  over. The ask: let the owner do their part on their portal. They type their name, which must
  match the owner of record letter for letter, sign the acknowledgment with the signature pad the
  app already has, and once the office sends the packet they see it under Your papers, with
  Download and Email it to me. The portal, the signature pad, the e-sign consent, the sent-copies
  store and the records window all exist; this plugs them together. Two shapes are drawn: the
  full one (ask → sign → the papers live on the portal) and a shorter one the owner said he would
  accept (sign → download, nothing kept on the portal).
next: The owner picks shape A or B. Then PR 1, the acknowledgment signed on the portal.
size: M (shape A, four PRs) · S–M (shape B, two PRs)
blocker: The owner's pick. Counsel has not approved the cover note or the acknowledgment wording (`OWNER_RECORDS_WORDING_APPROVED` is false); a signed acknowledgment on the portal should wait for that, or carry the draft stamp.
opinion: build shape A — the owner's own act on the portal is their request in writing, so it fills check 1 and check 4 in one sitting; shape B saves one PR and loses the record of what they got.
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

1. **PR 1 (S–M): sign on the portal.** The name kernel + tests; `sign-owner-records`; the portal card's ask and signing stops; the `file` writes; the office window's **Offer it on their portal ›** and the request check's new words. Nothing is shown to the owner after signing but *Thank you. The office sends the records once it has checked our contract.*
2. **PR 2 (S): the office sends to the portal.** `OwnerRecordsSentHow` gains `portal`; *Record it as sent* files the packet and marks it shown; the Needs you line.
3. **PR 3 (S–M, shape A only): Your papers.** The `owner_records` verb returns the sent packets; the portal lists them with **Download** (signed URL) and **Email it to me**; `send-owner-records-email`.
4. **PR 4 (S, shape B instead of 3): the one Download.** The signed card shows **Download** once the office has sent.

Each PR ships its release note, its `docs/recent-features/` fragment, its `docs/EDGE_FUNCTIONS.md` section and the guide edit. The functions deploy after merge.

## Open questions for the owner

1. **A or B.** The card above says why A.
2. **Who may sign.** The owner of record alone (the name on the county roll), or anyone the office names on the request (a spouse, a property manager)? The letter match needs one name to match against. Proposed: the owner of record, and the office may type a second name on the request when the roll's name is a company (*Harbor Ridge Homes LP* cannot sign; its manager can).
3. **Counsel's wording.** The portal shows the acknowledgment to a member of the public. Wait for counsel, or ship behind the same draft stamp the window shows today?

## How to verify

- Dev login on localhost, then a ZZ TEST owner: make a records request on *ZZ TEST GC On Notice* (J1050–J1052), press **Offer it on their portal ›**, open the link in a private window, sign as the test owner, and read the request row's `file`. **This is prod data; use the ZZ TEST jobs only.**
- The name rule: a typed name with a double space, a hyphen and lower case matches; initials do not.
- Shape A: record it as sent with *On their portal*, reload the portal, press **Download**, then **Email it to me** to a test inbox.
