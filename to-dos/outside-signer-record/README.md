---
name: "Where an outside signer lives: a paper names a contact the app already keeps, and says who signs"
number: 403
group: waiting
status: asked 2026-11-19, the owner's yes to a session that lays out the options · read in the code and on prod the same day, counts only · four options weighed and one picked · the mock-up drawn, rendered at desktop and phone width in light and dark, then redrawn after a second look · 2026-11-19 the owner settled call 1, the record lives on the contact, and call 2, a business and its signer are two things · nothing is built · four calls are left
summary: >
  The app can send a paper to anyone with a link, and it can only file one under a name on the roster.
  A supply house, a vendor, a customer's contact or a sub's business has no record that holds a paper,
  so the office cannot send one, list it or remind on it. This card maps every place an outside party
  already has a record, weighs four places the signer's record could live, and picks one: the paper
  names a contact. Messages already keeps one contact for every customer, every person at a customer,
  every supply house and its reps, every sub and every trade company. The paper points at that contact
  as the party and keeps the signer's name, title and email in its own row. No new list is made, and
  People keeps everything it has. The owner took that pick on 2026-11-19, and that a business and its signer are two things. Nothing is built, and four calls are left at the foot.
next: The owner's four calls that are left, the next being where a sub's business name lives. Then PR 1, the ground, which changes no screen.
size: L as a train of five (M · S · M · S · S)
blocker: Call 4. It says who reads an outside party's paper, and PR 1 writes that. Calls 3, 5 and 6 shape later steps.
opinion: build option D — one link from the paper to a record the app already keeps for every kind of outside party, with the signer's name and email kept on the paper; it costs one column where the other options cost a new list or a new link per kind
---

# Where an outside signer lives (#403)

The mock-up is [mockup.html](mockup.html). It draws the pick: Documents → Agreements with outside papers
in the list, **Send a paper** picking an outside party, and what People still shows for a sub. It was
rendered in the Browser pane at 1280 and 375 pixels wide, in light and dark, before it was shown. It was
then looked at again and redrawn once. Its last section says what changed. Every person, company, email,
job and date on it is made up.

This is wider call 3 of card #389 and the leftover *an outside party as a record* of card #376. Those
cards point here.

## The ask, in the owner's words

2026-11-19:

> We still want there to be contract details in people, but we also want to be able to manage contracts
> and documents so then we can build out our external signing features.

Told the outside signer's record was the decision the rest waits on, he said yes to a session that lays
out the options. This card is that. It builds nothing.

## What ties a signing to a person today

Read in the code on 2026-11-19 (`send-contract-for-signature`, `get-contract-for-signer`,
`accept-contract`, the migrations named below).

- **The paper is filed under a name.** `person_contract_documents.person_name` is text, required, and is
  what People → Contracts groups by. One name holds one copy of each version of a paper
  (`person_contract_documents_person_lineage_version_key`).
- **The person is worked out from the name.** `person_id` points at the roster (`people`). The trigger
  `contract_docs_set_person_id` fills it by looking the name up (`resolve_pay_person_id`,
  `20260801200000_contract_doc_types_expiry.sql`). It is empty when no roster name matches.
- **Two other anchors exist.** `company_id` points at a GC mode trade company (`gc_companies`), with the
  name forced to `gc-company:<id>` so no person can share it (`20261010009000_gc_papers.sql`).
  `partnership_id` points at a partnership.
- **The signer is what they typed.** `signer_printed_name`, the time, the IP and the browser go on the
  row. `esign_consents` keeps the consent words with `record_type = 'person_contract_document'` and the
  paper's id.
- **The signing page needs no person.** It finds the paper by its link (`public_token_hash`).
  `accept-contract` never reads `person_id`.
- **The signer's email is not kept.** It is typed in the Send for signature window, used for one email,
  and left only in the sent copy and the email log.

So signing already works for anyone. What fails for someone off the roster is everything around it:

1. **No door.** Both pickers offer the living roster and nothing else (`sendRosterNames` in
   `src/lib/documents/agreementsSend.ts`, `ContractQuickSendPicker`).
2. **A name that matches a teammate is filed as the teammate's.** The trigger resolves by name alone.
3. **A name that matches nobody reads as Staff.** `person_id` stays empty and the Agreements line tags
   every person paper that is not a sub's as *Staff* (`agreementsLedger.ts`). Three papers on prod are in
   this state.
4. **No business.** `people` has no business column and the signature has no *Signing for* line.
5. **No reminder and no copy.** The only reminder is a Dashboard prompt, and an outsider has no
   Dashboard. With no address on the row, nothing can be emailed later.
6. **The sent copy has no home.** It is filed under the one roster person the name finds, or under none.

## Every place an outside party has a record

Found in `supabase/migrations/` and `src/types/database.ts`, then counted on prod through the dev seat as
the dev, read only, on 2026-11-19. Counts only.

| Kind of party | Where it lives | Holds | An email a paper could go to | On prod | Who reads it | Can a paper hang on it today |
|---|---|---|---|---|---|---|
| Staff, and a sub as a person | `people` | A human. No business | `email`, optional | 24 living subs, all with an account row, 11 with an email on the roster | The office's four roles, and a person's own master | **Yes**, by name and `person_id` |
| A sub's business | Nowhere | | | | | No |
| A trade company, when the company is the GC | `gc_companies`, `gc_company_people` | A business with a main contact, and its people with what each gets | Both | 2 companies, 1 person | The office and estimators | **Yes**, `company_id`. Sending is dev only |
| A customer. A GC who hires the company, an architect and a property owner are customers too | `customers` | A business or a human | In `contact_info`, and `billing_email` | 194 living commercial customers, 3 with a billing email | The office, and others by scope | Only a job's contract, through the job |
| A person at a customer | `customer_contact_persons` | A human | `email` | 39 people, 30 with an email | The office and estimators | No |
| A supply house or a vendor. An insurer and a rental yard are rows here | `supply_houses`, with `vendor_kind` | A business | None. The row's email was retired | 23 | The office, estimators, primaries, superintendents | No |
| A rep or a desk at a supply house | `supply_house_contacts` | A human or a desk | `email`, required | 8, of which 7 are at 6 of the 23 houses | The office and estimators | No |
| A partner | `partnerships`, on a `people` row | A human with a company name | The roster's | 1 | Dev only | **Yes**, `partnership_id` on a person's paper |
| A law firm and its people | `legal_firms`, `legal_firm_recipients` | A business and humans | Both | 1 firm | The office | No |
| A matter's people | `legal_matter_people` | A human with an organization, copied from a customer, a contact person or a property | `email` | 1 | The office | No |
| A property's owner | `customer_addresses`, `job_property_owners` | A human or a business | `owner_email` | Not counted | The office | No |
| A lead, a hiring candidate | `prospects`, `team_prospects` | Not signers of the company's papers | | 65 candidates | | No |
| **A contact** | `contacts`, `contact_channels` | One row for each party above that Messages knows, pointing at exactly one of those records. Its emails and numbers are channels | A channel of kind `email` | 24 for supply houses (7 reps with an email, 17 counters), 22 subs, 2 trade companies, 1 architect, and customers and teammates not counted | The office and estimators. A tech reads the ones they hold | No, but a change order's signer already points at one |

Three things in that table decide the rest.

- **No table holds a sub's business.** A sub is a person on the roster. GC mode's `gc_companies` is for
  trade partners on jobs the company runs as the GC, which is another relationship.
- **Most businesses have no named person with an email.** 6 of 23 supply houses have a rep. 39 people
  are on file for 194 commercial customers. A design that needs a person on file before a paper can go
  would stop the office most of the time.
- **One record already spans every kind.** `contacts` was built for Messages as "a view over a person
  the app already has, never a fifth list" (`20261012010000_messages_spine.sql`). It points at a
  customer, a person at a customer, a trade company, a person at one, a roster person, a lead, a supply
  house, a rep or a candidate, and the database holds it to exactly one. Merging two contacts already
  carries their rows along (`contacts_fold`, which runs any `contacts_fold_<something>` function).

## How the 59 staff and sub papers split

Read on prod, 2026-11-19. 37 are staff papers. 19 are subs' papers, across 7 subs. 3 name someone the
roster does not find: 2 signed and 1 not sent. Every one of the 19 is filed under the sub as a person.
None is filed under a business, because nothing lets one be. None is a trade company's, a partner's or a
job's required paper. Every roster signer has an account row.

## The four options

### A. A party list of its own, that every kind points at

A new table of outside parties, with a table of people at each. A customer, a supply house and a sub
each link to their party row.

- **Costs.** Large. Two new tables with row security and the four fences. A screen to keep them. A
  backfill from five places. A rule for what happens when a customer is renamed or merged.
- **Reuses.** The signing path and the Agreements view.
- **The Agreements list.** One clean branch for every outside paper.
- **Row security.** Its own policy, written fresh. That is the freedom and the risk.
- **The Legal desk.** A matter could name a party. It would be a third copy of the same people, beside
  the customer and the matter's own people.
- **A later portal.** A clean thing to hang a portal on.
- **Rules out.** Nothing. But the same supply house then lives in two places, and the app already has a
  record that does this job.

### B. The paper hangs on whichever record the party already has

`person_contract_documents` gains `customer_id` and `supply_house_id` beside `person_id`, `company_id`
and `partnership_id`. The signer's name and email are typed onto the paper.

- **Costs.** Medium, and it repeats. Each kind is a new link, a new rule that only one link is set, a new
  branch of the view and a new place to look up an email.
- **Reuses.** Every record as it is. Each record's page reads its papers with one filter.
- **The Agreements list.** A branch per kind. The third anchor already needed a made-up name
  (`gc-company:<id>`) to fit a table keyed on a person's name. Two more make five.
- **Row security.** The papers stay the office's four roles. Nothing new.
- **The Legal desk.** Reads a customer's papers by `customer_id`. Simple.
- **A later portal.** The customer portal lists by customer, the sub's page by person. Simple.
- **Rules out.** A new kind of party without database work. A law firm, an insurer or a landlord each
  needs its own link, or is forced into a kind it is not.

### C. Everything outside becomes a roster row

A vendor or a GC's contact is added to People, with a new kind.

- **Costs.** Small to start, because the paper side needs no change. Then every reader of the roster
  must learn to leave these rows out: pay, hours, the schedule, crew pickers, reports and Messages, which
  holds a roster row to *sub* or *teammate* and nothing else (`contacts_kind_record`). A roster row also
  needs an account row since #260.
- **Reuses.** People → Contracts, whole.
- **The Agreements list.** Works today. Every outsider reads *Staff* until the tags learn new kinds.
- **Row security.** The roster is read more widely than a contract should be.
- **The Legal desk and a later portal.** A supply house would be a person in one list and a business in
  another, with nothing tying the two.
- **Rules out.** A business as the party. This is the option that makes the two-layer case worse.

### D. The paper names a contact (the pick)

The paper gains one link, to the `contacts` row of the party it is with. It keeps the signer's name,
title and email in its own row, and the business name as it stood on the day it was sent.

- **Costs.** Medium, once. One link whatever the kind. A function so a merge of two contacts carries the
  papers. A branch of the view. No new list and no screen to keep parties, since each kind keeps its page.
- **Reuses.** The contact record and its one-record rule. Its merge. Its email channels, with the usual
  one already picked (card #118). A change order's signer already points at a contact
  (`gc_change_orders.signer_contact_id`, `20261012180000_change_orders_from_messages.sql`).
- **The Agreements list.** One branch. The tag comes from the contact's kind: *Customer*, *Supply house*,
  *Trade company*. One new chip, **Outside companies**.
- **Row security.** The papers stay the office's four roles, with no policy change. A contact is read by
  those four and estimators, so the list can always name the party.
- **The Legal desk.** A matter reads a customer's papers by walking from the customer to its contacts.
  One step more than B.
- **A later portal.** The customer portal, the sub's page and the trade portal each already know their
  record, and a contact points at it. A supply house has no portal, and a signing link is enough.
- **Rules out.** A paper to someone who is in no list at all, until the office adds them to one. That is
  call 6. It also ties papers to a record Messages owns, so a change to how contacts work has to keep
  papers in mind.

## The two layers: a business, and the human who signs for it

Card #389 calls this the *Signing for* line. The pick treats them as two things.

- **The party** is who the paper is with. It is a record: the supply house, the customer, the trade
  company, or a person when a person signs for themselves.
- **The signer** is a name, a title and an email, kept on the paper as it was sent. The office picks a
  person on file at that business, or types one. A person on file is offered, never required.
- **Why the signer is not a second link.** A rep leaves a supply house. The paper must still say who
  signed and where the link went. The words on the paper are the evidence, so they are frozen there.
- **What the paper says.** *Lena Park, Branch manager, signing for Tallgrass Supply Co.* The same line is
  on the Agreements list and on the signed record.
- **A sub.** A sub is a person on the roster and stays one. Their business is one line on their People
  row, **Signs for**, and each paper freezes it when it is sent. That gives #389 the business name its
  settled call 4 shows a GC.
- **What does not fit yet.** A sub's worker who signs for the boss's company. The worker is a person, and
  the company is only a line on the boss's row. Call 3 is where that is settled.

## The pick, and why

**Option D.** Three reasons, each from the code.

1. **The record exists.** Every kind of outside party in the map already has a contact, or gets one on
   first use (`contact_for_customer`). A fifth list would copy it.
2. **One link, not one per kind.** The table is keyed on a person's name and already bends to hold a
   company. A law firm or an insurer later costs nothing more.
3. **The email comes with it.** A contact's channels hold the address and the usual one. The paper keeps
   the address it was sent to, which is what reminders and the signer's copy both wait on.

What it gives up against B: a customer's page reads its papers through one more step. That is a join,
and the view does it once.

## The plan

Each step is one PR with its release note and fragment. Nothing is built until the owner says build.

1. **The ground (M). The first PR.** A migration and no screen. `person_contract_documents` gains
   `party_contact_id`, `party_name`, `signer_name`, `signer_title`, `signer_email` and `signing_for`. The
   name trigger leaves a paper with a party alone. `contacts_fold_papers` carries papers through a merge.
   `agreements_on_file` gains the branch and three kinds. A kernel `paperParty.ts` says what a line reads
   for each kind, with tests. An SQL bed proves each role reads what it reads today and no more. It
   merges alone and is pushed before any client calls it.
2. **The send keeps the signer (S).** `send-contract-for-signature` writes the name, title and address on
   the row for every paper, staff and sub papers too. The Send for signature window gains **Signer name**
   and **Title (optional)**. This is the column the reminders and the signer's copy in #376 wait on.
3. **Who is it with? (M).** The second window of **Send a paper** searches people and companies, as the
   mock-up draws. **Keep … with …** adds the typed person to the customer or the supply house. The
   Agreements tab gains the **Outside companies** chip and the line's second row. The guide *find an
   agreement we sent or signed* is updated.
4. **The party's own page (S).** A supply house's window lists its papers. The Customer page's
   **Agreements** card lists them beside the job contracts it has today.
5. **A sub's business (S).** **Signs for** on a sub's People row, frozen onto each paper. This is the
   *Signing for* line of #389's step 3.

After the train: reminders by email and the signer's copy (#376's leftovers), the company's own signature
(#389's wider call 4), and the company's own secrecy paper to a vendor (#389's step 8).

## The second look

The first drawing had four windows: pick a paper, **Who is it with?**, **Who signs?**, then the email.
Rendered and looked at again, three things changed.

- **Who signs?** is gone. The search finds the people at a company, so one pick names both. The signer's
  name and title moved into the email window the office already uses. The flow is three windows, as today.
- A company with no one on file needs no extra step. The name is typed once, and one tick keeps the
  person with the company.
- The windows are drawn at the width the app opens them.

Kept as first drawn: one chip for all outside companies, no *add a new company* inside the window, and a
second line that says who signs in words.

## How this meets the NDA builder spike

The spike of #389's flow runs in its own session. Its branch was not read here. From the card, it builds
the builder's screens on made-up data and decides nothing about where a signer lives. It meets this card
in two places. Its step 3 adds the *Signing for* line, which is step 5 here. Its step 8, the company's own
secrecy paper to a vendor or a customer, needs steps 1 to 3 here. Nothing in the spike's direction argues
against the pick.

## What to know before building

- `person_name` is required and unique per paper version, and the trigger resolves it by name. A party's
  paper needs the guard the trade company's papers use, so a company named like a teammate never lands on
  the teammate.
- A contact's record link is `ON DELETE RESTRICT`. Where a screen deletes a record, a trigger moves its
  contact off the row first. `party_name` is frozen on the paper so a paper never loses the name of who
  it was with.
- A customer's contact is made on first use. Supply houses, reps and subs were seeded and are kept by
  their own triggers. PR 1's bed should check each kind.
- GC mode's `company_id` papers stay as they are. A trade company has a contact, so they can move later.
- `esign_consents.audience` allows *customer*, *sub* and *gc*. A supply house needs a value.
- `sendCompanyPaper` in `send-contract-for-signature` is the pattern for a paper to a company: it mails
  every person whose `gets` holds *contracts*.
- The repo is public. Every fixture, test, note and mock-up uses made-up names.

## How to verify, once built

- **PR 1.** The bed, as each role: the view answers the new kinds to the office's four roles and to no
  one else. Fold two contacts and the paper follows. A party named like a roster person keeps no
  `person_id`.
- **PR 2.** On prod as a dev, with a ZZ Test person: send a paper, read the row, see the name and address
  on it. Nothing else about the send changes.
- **PR 3.** On prod with a ZZ Test customer and a made-up supply house: send to a person on file, then to
  a company with no one on file. See both lines under **Outside companies**. Sign one through its link
  with no login. Count the requests after opening the window.
- **PR 4 and 5.** The supply house's window and the Customer page show the paper. A sub's People row
  shows **Signs for**, and a paper sent after it carries the line.

## The owner's calls

Each is one question. The session's pick is first.

1. **Where does an outside signer's record live?** **Settled 2026-11-19: on the contact the app already
   keeps (D).** Shown the four options and the mock-up, he answered "On the contact". Not taken: on each
   record with a link per kind (B), a new list of outside parties (A), on People (C).
2. **Are a business and the person who signs for it two things?** **Settled 2026-11-19: yes.** The
   business is the party, and the signer is a name, a title and an email kept on the paper. He answered
   "Yes, two things". Not taken: one thing, the paper with the person and the business a typed line.
3. **Where does a sub's business name live?**
   **One line on the sub's People row, Signs for.** Or every sub's business becomes a company record of
   its own, with its workers under it.
4. **Who in the office may read an outside party's paper?**
   **The four roles that read staff and sub papers today: dev, master technician, assistant and
   controller.** Or those four and the estimator. Or dev, master technician and controller only.
5. **Does sending stay on both People and Documents?** This is #389's wider call 5.
   **Both. People sends to a person on the roster. Documents sends to anyone, and an outside company's
   paper is sent only from Documents or from its own page.** Or sending moves to Documents alone.
6. **May a paper go to someone who is in no list?**
   **No. The office adds them as a customer, a supply house or a person first.** Or yes, with a typed
   name and email and no record behind them.

## Where it stands

Nothing is built. The map, the counts, the four options and the pick are above. The mock-up draws the
pick and was redrawn once. The owner settled two calls on 2026-11-19. Call 1: the record lives on the contact.
Call 2: a business and its signer are two things. Calls 3 to 6 are open. PR 1 waits on call 4.
