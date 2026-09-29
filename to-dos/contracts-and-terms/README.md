---
name: "Contracts & terms: every contract a customer signs, side by side"
number: 50
group: close
status: planned and built 2026-09-27 / 28 · PR 1 shipped v2.3977 (the tab, Compare, the doors) · PR 2 shipped v2.3968 (the bid room gets the wording the letter prints) · PR 3 shipped v2.3965 (an unsent draft goes out with the current standard terms) · PR 4 shipped v2.3964 (consent on a change order signed in the bid room) · PR 5 shipped v2.3987 (the history tables and triggers) · PR 7 shipped v2.3992 (Last sent) · PR 6 shipped v2.3994 (History, What did it say on, Mark reviewed) — all seven built · then v2.4098 (Read it as the customer sees it — the customer's own page in sample mode, in a modal; the sample agreement now prints the Book document) and v2.4108 (the tab reads as an index: six sections in the customer's order, one row per contract, lenses and a find box) · left: a month of use, four things deliberately not built, one question for the attorney
summary: >
  The app offers customers **eight contract texts** from Estimates, Bids and Jobs, kept five
  different ways — one Settings text, per-record boxes, built-in wording in code, the Contract
  Book, and page state that is never saved. Only the job service agreement carried a date and a
  frozen copy of what each customer agreed to. Settings → **Contracts & terms** now shows all of
  them side by side, with where each is kept and edited, when it last changed and what it said
  before, when it was last read, and what last went out — as an index of six sections, each
  row opening its card, and any contract readable as the customer sees it with sample
  information. The read that started it also found that what customers received was not
  always what Settings said; four of those are fixed.
next: >
  Use the tab for a month. Then decide two things — whether the estimate and bid terms move into
  the Contract Book (rejected for now, see The decision), and which of the five items under
  *Not in this train* to build (the sample-agreement one shipped v2.4098). Take the interest-clause disagreement to the attorney.
size: S — what is left is use, and four small builds if they are wanted
blocker: A month of use. The interest clauses (45 days from the invoice; 30 days after the due date) are the attorney's call.
ver: v2.3977 · v2.3968 · v2.3965 · v2.3964 · v2.3987 · v2.3992 · v2.3994 · v2.4098 · v2.4108
opinion: your call — everything planned is built and the tab has had two more passes on the owner's live reads; the four items left out are each small, and the first to build is the signed copy to the customer, because the consent tells them they have one
mockup: not required — built in the same sitting as the plan; the live tab is the drawing
---

# Contracts & terms

## The ask, in the owner's words

> We have many different parts of my app that offer contracts to the customer, one is in bids,
> another in estimates, and there are some I started to build in Jobs Stages. Can you help me find
> all of them and can we come up with a way to expose them in settings? The idea is that I want to
> be able to see all the contracts offered to customers side by side so I can know at any point in
> time when to update them. Or if I need to reference one to jump back and see what we're sending
> out.

Then: *ask yourself, is this the best we can do.*

## What exists (read 2026-09-27 from the code; production read the same day through the tab)

### Contracts a customer accepts or signs

| # | Text | Where the wording lives | Where it is edited | Dated? | Customer's copy kept? |
|---|---|---|---|---|---|
| 1 | Estimate Terms and Conditions (`/estimate/terms`) | `app_settings` `estimate_public_terms_body` | Settings → Bids & materials (dev) | No | No |
| 2 | Per-estimate Terms box | `estimates.terms_snapshot`, starts blank | Estimates editor | — | Yes, at send |
| 3 | Estimate acceptance wording | built-in → `app_settings` `estimate_accept_*` → per-estimate override | Settings → Bids & materials (dev); Estimates | No | Yes, at send |
| 4 | Bid terms & warranty | built-in → `app_settings` `bid_cover_letter_terms_default_v1` → per-bid box | Settings → Bids & materials (dev); Bids → Cover Letter | No | Bid room only, at publish |
| 5 | Bid exclusions | built-in → `bid_cover_letter_exclusions_default_v1` → per-bid box | same | No | Bid room only, at publish |
| 6 | Bid closing paragraph | built-in → `bid_cover_letter_closing_v1` | Settings → Bids & materials (dev) | No | No |
| 7 | Job service agreement — standard terms | Contract Book, `audience = 'customer'` (built-in wording as the fallback) | Contract window, the sweep, People → Contract library | Yes | Yes, per agreement |
| 8 | Electronic-signature consent | code, `ESIGN_CONSENT_VERSION` | code only | Version number | Yes, `esign_consents` |

Wording that rides with those and is fixed in code: the job agreement's payment line presets, the
bid letter's wet-ink acceptance block and bid-basis clause, the agree sentences on the three
signing pages, the Bids → Lien Release conditional waiver and payment terms.

### Notices a customer receives and does not sign

Lien waiver and release, the § 53.056 notice and homestead statement, the final demand letter, the
biohazard fee notice, the invoice footers, the test-report certification, the portal's property
notice card. The catalog lists them as a second group.

### Left out, on purpose

Staff and sub paperwork (W-9, I-9, DWC-83, direct deposit, the § 53.284 sub waivers), partner
agreements, sub work orders, and `customers.payment_terms` (the office's credit posture — never
shown to a customer).

### "Jobs Stages"

The job service agreement is finished and live end to end. The piece that is not built is the
customer-level master agreement (`owner-decisions-pending.md`); it stays there and is not part of
this train.

## What the read found wrong

Confirmed in the code:

- **The bid room can publish with no Terms and no Exclusions.** The printed letter falls back to
  the built-in wording; the room is handed `''` and hides the block. In production the bid terms
  default is not set (the exclusions default is), so a bid whose Terms box was never typed in
  publishes a room with no Terms today.
- **Per-bid Inclusions, Exclusions and Terms are never saved** — page state, lost on reload.
- **The sweep sends old wording.** After a standard-terms edit an existing draft keeps the old
  terms, and the save that follows strips the terms fields.
- **A change order signed in the bid room records no consent** — the card posts no `esignConsent`.
- **What customers see shows stand-in terms** for the job agreement, not the Book document — fixed v2.4098 (`get-job-contract`'s sample prints the newest customer Book document; the fixture's terms only when the Book holds none).
- **The texts disagree**: the estimate terms charge interest 45 days from the invoice, the job
  agreement 30 days after the due date (read in production on the tab, 2026-09-27).
- **`app_settings` has no date column**, so texts 1 and 3–6 have no "last changed" at all.

Reported by the read, not re-checked: the approval PDF ignores the org defaults; an estimate or
bid signer gets no signed copy though the consent says the page and its PDF are their copy; filing
a customer's own paper writes our terms onto the row.

## The decision

1. **A catalog, not a move.** One registry in code names every text, where it lives, where it is
   edited, where the customer meets it and where their copy is kept. A test fails CI when a
   customer-facing public page has neither a catalog entry nor a stated reason. The texts stay
   where they are.
2. **Its own tab.** *What customers see* is ordered by the journey; this is ordered by the
   document. Settings → **Contracts & terms**, Company zone, the same people who see *What
   customers see*. Each links to the other.
3. **Dates come from a history, not from a column.** One table records every change to these
   texts with who and when, fed by triggers, so every write path is covered. It also answers
   "which terms were in force when this customer accepted".
4. **Last sent is core.** Each card reads the newest frozen copy and says whether it still matches.
5. **Rejected for now: moving estimate and bid terms into the Contract Book.** The job-contract
   pickers load every customer document as a terms choice, four readers and two edge functions
   would change, and the history table already gives the dates. Revisit after a month with the tab.

## The plan

| PR | What | Touches |
|---|---|---|
| 1 | The catalog: kernel, the tab, compare, doors to each editor and to *What customers see* | new `src/lib/contracts/customerContractCatalog.ts`, new `SettingsContractsTab`, Settings wiring, the guide |
| 2 | Bid room gets the wording the letter prints | `BidsCoverLetterTab`, a wording kernel |
| 3 | A draft follows its Book document until it is sent | `jobContractDraftWrite`, `jobContractQuickSend`, the sweep |
| 4 | Consent on a change order signed in the bid room | `BidRoom` |
| 5 | The history: `contract_text_versions` + `contract_text_reviews`, triggers, a baseline row per text | one migration |
| 6 | Last changed, the history list, *Mark reviewed*, review due | the tab, the kernel |
| 7 | Last sent against current; drafts still on old wording | the tab, the kernel |

PRs 2–4 are independent of the rest and of each other.

## Where it stands

All seven PRs are built, and two owner asks on the live tab followed: **v2.4098** — *Read it as the
customer sees it* on every card with a rendered surface (the customer's own page, email or paper in
sample mode, in a modal, the card's wording found and lit; `ContractReaderModal`, `contractReader.ts`);
**v2.4108** — the page reads as an index (`contractsIndex.ts`: six sections in the order a customer
meets them, rows closed until pressed, *Needs a look* as a lens not a section, a find box, Open all /
Close all, a linked card open on arrival). What the tab said about production the day it shipped
(2026-09-28, read only, as the dev login):

- The estimate terms, the estimate checkbox sentence and the bid exclusions are the office's own
  wording. **The bid terms and the bid closing were never set**, so the letter prints the
  built-in wording.
- **The last proposal published to a bid room (Sep 4, rev 1) went out with no Terms at all.**
  New publishes carry them since v2.3968; that room keeps what it was published with until
  someone presses *Publish update* on the Cover Letter.
- The last estimate sent (Sep 24) went out with the Terms box empty.
- The last agreement sent (Sep 23) and the last signature (Sep 22) carry today's wording.
- The Contract Book holds one customer document, dated Sep 20.

## Not in this train

- Saving the per-bid letter boxes — `src/pages/Bids.tsx` is mid-move (the Bids second pass).
- The approval PDF reading the org defaults — same file.
- A signed copy to the estimate or bid signer.
- One master terms text — the attorney's question.
- The proposal section of the bid room shows its own agree box and stores a consent clause that
  ends with a checkbox sentence the signer never saw (found in PR 4; left for a decision, because
  either fix changes what every GC sees or what is stored under consent version 2).
- A sweep left open across an edit to the standard terms still mints **new** drafts on the
  wording it loaded (found in PR 3; existing drafts are guarded). The fix is a re-read of the
  document before a send.
- Nothing outside the tab says a review is due — no Dashboard card, no email.

## How to verify

- The tab: Settings → Contracts & terms as dev, master and assistant; six sections, every row
  opens its card with wording; *Compare* puts two or three in columns; each *Edit* door lands on
  its editor; *Read it* opens the customer's page in sample mode with the wording lit (v2.4098's
  Verified block has the per-card results; a phone width and the light theme are still unlooked-at).
- PR 2: a bid with empty boxes and no org default publishes a room that shows Terms and Exclusions.
- PR 3: edit the standard terms from the sweep, then preview and send a job that already had a
  draft — the new wording goes out.
- PR 4: sign a change order on the sample bid room; `esign_consents` gains a row.
- PR 5–7: change a text, see the date and the history row; the card's last-sent line.
