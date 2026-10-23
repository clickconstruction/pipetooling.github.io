---
name: "Messages: one Who is this? on a New row, and a live way to link the sender to a customer"
number: 149
group: gated
status: PR 1 shipped v2.5793 (one control on the row, the pick is A) · PR 2 built v2.5795 on the owner's yes of 2026-10-23 (A customer we know with why, A new customer as one live press) · delete this to-do once both are on main
summary: >
  The New lane's row said Who is this? twice, a chip beside the name and a button under the
  subject, both opening the same card. PR 1 keeps one: the question as a small blue pill beside
  the name. PR 2 is the gap the owner named: an Invitation to Bid from a general contractor on
  bids@ gets three guesses that each say Add … first and nothing about a customer, though a
  general contractor is a customer in this app. The sort card's first block becomes A customer
  we know, each match with why (the address on file, a bid or a job that names them, the
  company's domain, the name, the number), and A new customer becomes one live press that makes
  the customer and moves the thread to them with its history.
next: >
  Both PRs on main, then delete this to-do; the release notes and the fragments carry the record,
  the mock-up stays linked from v2.5793's fragment.
size: PR 1 S · PR 2 M (one PR, or 2a matches and 2b the new customer)
blocker: none, the queue
opinion: build — the card already asks the question; today it answers an Invitation to Bid with three dead ends, and the one live answer (Someone else) is a search the office has to drive.
mockup: to-dos/messages-who-is-this/mockup.html
---

# Messages: one Who is this? on a New row, and a live way to link the sender to a customer (#149)

## The ask, in the owner's words (2026-10-23)

> in messages I think that putting 'Who is this' twice is non ideal, perhaps we can rename the bottom who is this and put it next to the right of the name. and I think we should take this as an opportunity to link them to a customer if we can come up with that live flow.

## The decision

- **PR 1, one control (shipped v2.5793).** Three options drawn in `mockup.html` §1. **A** picked: the chip becomes the control, a small blue pill beside the name reading the sort's question with a › (*Who is this? ›*, *Which job? ›*, *Who has it? ›*), the button under the subject gone. The press reads exactly like the card it opens, the lane's three questions stay the lane's vocabulary, and the row itself still opens the thread. **B** (the chip stays as the state, a verb pill beside it: *Name them ›*) is the literal reading of the ask and the fallback. **C** (the verb alone, the question in the grey line) renames what the card, the guide and Sort all call *Who is this?*.
- **PR 2, the card links them to a customer (built v2.5795, the owner's yes of 2026-10-23).** Drawn in `mockup.html` §2. The press opens the thread as today, the sort card at the top and the email under it. The card's first block is **A customer we know**, each match with why, the strongest first; then **A new customer** as one live press with the sender's name in a field; then the rest as today.

## Where it plugs in

- The row: `src/components/followUp/FollowUpSections.tsx` (`NewRowView`), its test `FollowUpPanel.render.test.tsx`.
- The card: `src/components/followUp/NewLaneCard.tsx` draws, `NewLaneSlot.tsx` presses, `src/lib/followUp/newLane.ts` guesses (`whoGuesses`, `customerGuesses`, `tradeGuesses`), `newLaneRows.ts` says why a guess waits (`guessWait`), `newLaneCardIo.ts` reads the records and presses `name_contact` (`messagesIo.ts`'s `nameContact`, `nameAsLead`).
- The write that moves a thread with its history: the SQL `name_contact` (`20261015010000_contacts_team_kind.sql`), which re-points the contact or folds it into the person's own (`contacts_fold`), and ties the thread to a job when one is passed. A new customer is the lead doors' pattern (`messages/leadDoorsIo.ts`'s `convert`: insert the customer, then `name_contact`), never `contact_for_customer`.
- The signals: `customers.contact_info` (phone, email) and `customer_contact_persons` (name, email, phone); `bids.gc_contact_email`, `gc_contact_name`, `customer_id`, `project_name`; `jobs_ledger.customer_email`, `customer_id`; `companyDomain` in `newLane.ts` for the company's own domain; the From line's name on the contact (`email_place_address`), `nameInText` for a text's *this is Dale*.

## The plan for PR 2

1. Kernel: `customerMatches(row, known)` in `newLane.ts` (or its own `followUp/customerLink.ts`), pure, tests beside it; the guesses' words and order; `guessWait` no longer holds a new customer.
2. Io: `loadKnown` reads customers and the people at them by email, by domain and by name, bids and jobs by the address; `name` makes the customer when the guess has no record and the kind is customer (commercial on bids@, residential on the team number), then names the contact; a bid match passes the bid as the job.
3. Card: the **A customer we know** block and the **A new customer** field; the render smoke.
4. Words: the guide `sort-new-messages` § Who is this?, `docs/MESSAGES_ARCHITECTURE.md`, the Glossary's Messages entry, a release note and a fragment.

## How to verify

PR 1: `/messages` as the dev, the New lane's row shows one blue pill beside the name and nothing under the words; the pill and the row open the thread at the card. PR 2: a ZZ test contact of kind `unknown` with an email at a made-up domain, a ZZ customer carrying that address, and a ZZ bid naming it; never a real sender's thread. Delete the ZZ rows after.
