---
name: "Contracts & terms: every contract a customer signs, side by side"
number: 50
group: ready
status: planned 2026-09-27 from a five-way read of the app · the build started the same sitting on `claude/contract-management-consolidation-d0947b`
summary: >
  The app offers customers **eight contract texts** from Estimates, Bids and Jobs, kept five
  different ways — one Settings text, per-record boxes, built-in wording in code, the Contract
  Book, and page state that is never saved. Only the job service agreement carries a date and a
  frozen copy of what each customer agreed to. The ask is one place in Settings that shows them
  side by side, says when each last changed, and opens what is being sent. The read also found
  that what customers receive is not always what Settings says (the bid room can publish with no
  Terms, the sweep sends old wording, a change order signed in the bid room records no consent),
  so the plan fixes those beside the catalog and makes "what did we last send" part of the core.
next: >
  PR 1 (the catalog tab) and the three gap fixes, then the history migration, then last-sent.
size: M — seven PRs, one migration
blocker: None. One question is the attorney's, not the app's — three independent terms texts or one master with addenda.
opinion: build — the catalog alone would show the template while customers receive something else, so the gap fixes and last-sent are in the train, not after it
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
- **What customers see shows stand-in terms** for the job agreement, not the Book document.
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

## Not in this train

- Saving the per-bid letter boxes — `src/pages/Bids.tsx` is mid-move (the Bids second pass).
- The approval PDF reading the org defaults — same file.
- A signed copy to the estimate or bid signer.
- The job agreement sample on *What customers see* reading the Book document (an edge function).
- One master terms text — the attorney's question.

## How to verify

- The tab: Settings → Contracts & terms as dev, master and assistant; every card shows wording;
  *Compare* puts two or three in columns; each *Edit* door lands on its editor.
- PR 2: a bid with empty boxes and no org default publishes a room that shows Terms and Exclusions.
- PR 3: edit the standard terms from the sweep, then preview and send a job that already had a
  draft — the new wording goes out.
- PR 4: sign a change order on the sample bid room; `esign_consents` gains a row.
- PR 5–7: change a text, see the date and the history row; the card's last-sent line.
