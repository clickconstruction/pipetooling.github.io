---
name: "Where an outside signer lives: a paper names a contact the app already keeps, and says who signs"
number: 403
group: ready
status: asked 2026-11-19, the owner's yes to a session that lays out the options · read in the code and on prod the same day, counts only · four options weighed and one picked · the mock-up drawn, rendered at desktop and phone width in light and dark, then redrawn after a second look · 2026-11-19 the owner settled call 1, the record lives on the contact, call 2, a business and its signer are two things, call 3, a sub's business is a company record of its own, call 4, the office's four roles and the estimator read an outside party's paper, call 7, a sub's company is the trade company record the app already keeps, call 5, sending stays on both People and Documents, and call 6, a paper may go to a typed name that is added to a list afterwards · the mock-up redrawn for calls 3 and 6 · 2026-11-19 the word to build · PR 1, the ground, is built (v2.7977) · PR 2, the send keeps the signer, is built (v2.7986) · Who is it with? is built (v2.7995) · Add to a list is built (v2.7998) · all four on main and on prod by 2026-11-20, each walked there with ZZ test records · the walks found one gap, noted under Where it stands · 2026-11-20 the owner settled call 8, an estimator finds an outside company's paper on its own page and on the Agreements tab, and the mock-up draws that tab, and call 9, the estimator reads every kind of an outside company's paper, tax forms among them, which the built policy does not do yet, and call 10, an estimator opens an outside company's signed form, which the built gate does not do yet, and call 11, that reaches a signed W-9 · all eleven calls are settled · step 4's first PR, the estimator's read widened and the signed form's gate opened, is built (v2.8108) · on main and on prod by 2026-11-21, read there as the estimator's sample account, a ZZ test W-9 among their papers · step 4's second PR, the party's own page, is built (v2.8162) · step 4's third PR, the Agreements tab for an estimator, is built (v2.8175) · both on main and on prod by 2026-11-21, walked there as the dev and as the estimator's sample account with the ZZ test papers · step 4 is built · 2026-11-21 Taunya asked for the audit's findings 5 and 9 to be fixed, built as v2.8240 and v2.8244, live 2026-11-22, finding 9 walked on prod · 2026-11-22 the card passed to the owner, and step 5's ground, a sub's company as a record, is built (v2.8313) · 2026-11-22 the owner took the card's pick on all four decisions · 2026-11-23 on main: the office sends a trade company its paper (v2.8322), the open log outlives its paper (v2.8323, decision 4), a second signer at a company gets a copy of their own (v2.8325, decision 3), and decision 1, Take back (v2.8348), the not sent state with Send on its line (v2.8352) and every outside party's paper on the Agreements tab (v2.8354), the two migrations among them pushed
summary: >
  The app can send a paper to anyone with a link, and it can only file one under a name on the roster.
  A supply house, a vendor, a customer's contact or a sub's business has no record that holds a paper,
  so the office cannot send one, list it or remind on it. This card maps every place an outside party
  already has a record, weighs four places the signer's record could live, and picks one: the paper
  names a contact. Messages already keeps one contact for every customer, every person at a customer,
  every supply house and its reps, every sub and every trade company. The paper points at that contact
  as the party and keeps the signer's name, title and email in its own row. No new list is made, and
  People keeps everything it has. The owner took that pick on 2026-11-19, and that a business and its signer are two things. He also chose that a sub's business becomes a company record with its workers under it, and that the estimator reads an outside party's paper beside the office's four roles. A sub's company is the trade company record the app already keeps. Sending stays on both People and Documents. A paper may go to a typed name with no record, and one press adds them to a list afterwards. An estimator finds an outside company's paper on its own page and on the Agreements tab. The estimator reads every kind of an outside company's paper. An estimator opens an outside company's signed form. That reaches a signed W-9. PR 1, the ground, is built, and all eleven calls at the foot are settled. Step 4's first PR is built and live: the estimator reads every kind, and opens the signed form. Step 4 is built and live: a supply house's window and the Customer page list a company's papers, and an estimator reads the Agreements tab.
next: Decision 2, how far an estimator reaches, then step 6, a sub's company on People. The walks listed under Where it stands are owed, and the questions decision 1 asks wait on the owner.
size: L as a train of nine (M · S · M · S · S · S · S · M · M); left: decision 2 in two PRs and step 6 in three
blocker: None.
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
- **Row security.** As weighed, the papers stay the office's four roles, with no policy change. The
  owner's call 4 then added the estimator for an outside party's paper, which is one new read policy. A
  contact is read by those four and estimators, so the list can always name the party.
- **The Legal desk.** A matter reads a customer's papers by walking from the customer to its contacts.
  One step more than B.
- **A later portal.** The customer portal, the sub's page and the trade portal each already know their
  record, and a contact points at it. A supply house has no portal, and a signing link is enough.
- **Rules out.** As weighed, a paper to someone who is in no list at all. The owner's call 6 lifts that:
  a contact can stand with no record behind it, as a number nobody has named does in Messages. It also
  ties papers to a record Messages owns, so a change to how contacts work has to keep papers in mind.

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
- **Someone in no list.** The owner's call 6: the office may type a name, an email and a company, and
  send. That signer is a contact with no record yet, made from the address (`contact_make_for_channel`).
  **Add to a list** on the paper's line then says what they are: a customer, a supply house, a trade
  company, or a person at one the app has. It is the act Messages calls *Who is this?* (`name_contact`).
  The paper points at the contact, so it comes along and nothing is copied. An address the app already
  knows is named in the window before the send, so no second contact is made.
- **A sub.** The owner's call 3: a sub's business is a company record of its own, with its workers under
  it. A sub stays a person on the roster and gains a link to their company. A paper with the business,
  such as the subcontractor agreement, a W-9 or an insurance certificate, is the company's. A paper a
  person signs for themselves, such as a job's secrecy paper, stays the person's and says *signing for*
  their company. That gives #389 the business name its settled call 4 shows a GC, from a record.
- **A sub's worker.** A worker on the roster links to the same company as their boss. They sign their own
  papers and the line reads their company. The session's pick for call 3 was one line on the sub's People
  row, which left this case out. His choice covers it.
- **That company record is the trade company the app already keeps.** The owner's call 7. GC mode's
  trade company (`gc_companies`) holds a business, its people and what each is emailed, its license,
  its portal link, and its master agreement, W-9 and insurance as papers (`company_id`). A lead on
  Prospects → Subs already turns into one (`prospects.converted_gc_company_id`). One record now serves
  any business the company subcontracts to, whoever is the GC on the job. Nothing ties a roster person
  to one today, and sending a company's paper is dev only (`GC_TRADE_EMAIL_ROLES`). Steps 5 and 6 change
  both.

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

Each step is one PR with its release note and fragment. The word to build came on 2026-11-19, and step 1 is built.

1. **The ground (M). The first PR.** A migration and no screen. `person_contract_documents` gains
   `party_contact_id`, `party_name`, `signer_name`, `signer_title`, `signer_email` and `signing_for`. The
   name trigger leaves a paper with a party alone. `contacts_fold_papers` carries papers through a merge.
   `agreements_on_file` gains the branch and three kinds. A kernel `paperParty.ts` says what a line reads
   for each kind, with tests. One new read policy lets an estimator read a paper whose party is an
   outside company, a trade company's `company_id` papers among them, and nothing filed under a person
   (calls 4 and 7). An SQL bed proves each other role reads
   what it reads today and no more, and that an estimator reads no staff paper and no sub's own paper.
   It merges alone and is pushed before any client calls it.
   **Built 2026-11-19 as v2.7977** (`20261120010000_paper_party.sql`, `docs/recent-features/v2.7977.md`), with three
   things the plan did not name. The view gains four kinds, the fourth for a party on no list (call 6). A door,
   `paper_party_contact`, finds or makes a party's contact, so step 3 needs no migration. The e-sign ledger takes the
   audience *outside*. It was also built with two narrower readings, which are calls 9 and 10.
2. **The send keeps the signer (S).** `send-contract-for-signature` writes the name, title and address on
   the row for every paper, staff and sub papers too. The Send for signature window gains **Signer name**
   and **Title (optional)**. This is the column the reminders and the signer's copy in #376 wait on.
   **Built 2026-11-19 as v2.7986.** The email itself is unchanged. A link made to hand over keeps no
   address, and only names a signer the paper never had.
3. **Who is it with? (M), then Add to a list (S).** Two PRs. The second window of **Send a paper**
   searches people and companies, as the mock-up draws, and its last row is **Someone not in any list**
   (call 6). People → Contracts keeps its own send to a person on the roster, untouched (call 5). The
   second PR puts **Add to a list** on the line of a paper whose party has no record, and on its signed
   record. **Keep … with …** adds the typed person to the customer or the supply house. The
   Agreements tab gains the **Outside companies** chip and the line's second row. The guide *find an
   agreement we sent or signed* is updated.
   **Who is it with? built 2026-11-19 as v2.7995**, with the chip, the line's signer and the guide. The
   signing page and the signed record say who signs and for whom. A person's paper still goes out by
   their roster name, and someone who signed a paper is not offered a second copy, as People's picker has it.
   **Add to a list built 2026-11-19 as v2.7998.** It offers a new customer, a new supply house or vendor,
   and someone at a customer or a supply house the app has. A trade company is not offered yet: the office
   has no page for one until step 6, and the second look kept a party off no page of the app.
4. **The estimator's read widened (S), the party's own page (S), then the tab for an estimator (S).**
   Three PRs. The first is a migration for call 9: the estimator's policy drops its *agreement only*
   line, so an estimator reads every kind of paper that is with a customer, a supply house or a trade
   company, a W-9 and a certificate among them. A paper filed under a person and a party on no list
   stay closed. The beds change with it, and so does the note of the Board's call of 2026-10-10, which
   kept a trade company's W-9 and certificate for the office. The same PR, or one beside it, opens the
   PDF gate for call 10: `open-contract-form-pdf` lets an estimator open a signed form that is with an
   outside company, a signed W-9 among them (call 11), and logs the open as it does every other.
   **The first PR built 2026-11-20 as v2.8108** (`20261120080000_estimator_reads_outside_papers.sql`,
   `docs/recent-features/v2.8108.md`), the read and the gate in one PR. The rule has a name,
   `paper_is_outside_company`, which the policy asks. The gate asks the same rule through `estimator_reads_paper`, so
   the two cannot come apart. A digital twin is refused by the function itself, and a link is handed over only once the
   open is written down. No screen lists these papers for an estimator yet. A supply house's window
   lists its papers. The Customer page's **Agreements** card lists them beside the job contracts it has
   today. Then the Agreements tab opens to an estimator (call 8): `canSeeAgreements` takes the role,
   and the list shows what the database answers them, which is outside companies' agreements and work
   orders. Chips for kinds they cannot read are left out. They get no **Send a paper**, no **Contract
   library** and no press on a line, since sending stays with the four roles. An old link to the tab
   stops landing them on Estimates. The guide and `docs/ACCESS_CONTROL.md` are updated.
   **The party's own page built 2026-11-21 as v2.8162** (#9212, `docs/recent-features/v2.8162.md`). The list reads the
   papers' own table, so it holds every kind and every state: a W-9 is on it, and so is a paper that was made and
   never sent, which reads *not sent*. A signed paper's name opens its signed record, for an estimator too. An
   estimator has no Agreements card on the Customer page, so the papers get a card of that name there.
   **The tab for an estimator built 2026-11-21 as v2.8175** (#9225, `docs/recent-features/v2.8175.md`). Their chips are
   *All*, *Outside companies* and *Work orders*, and a trade company's agreement sits under *Outside companies* for
   them. A line has no press, so an estimator opens a signed paper from the company's own page.
5. **A sub's company, the ground (M).** A roster person gains a link to a trade company
   (`gc_companies`, call 7), and a company can hold people who are on the roster. The office, not only
   a dev, can send a company's paper. A person's paper freezes *signing for* from that link.
   This is the *Signing for* line of #389's step 3.
   **The ground built 2026-11-22 as v2.8313** (`20261123020000_sub_company_ground.sql`,
   `docs/recent-features/v2.8313.md`). The link is a table of its own, `person_trade_companies`, since the roster
   is read too widely for a column. The four roles make a company's paper. A person's paper takes *signing for*
   when it is made and each time it is sent, by a trigger, since a job's paper can be signed with no send.
   **The office's send built 2026-11-22 as v2.8322** (#9436): the four roles send a company's paper by email, where a dev
   alone could, and an archived account is refused. That gate is in the send function.
6. **A sub's company on People (M).** People shows a sub's company with its workers under it, as the
   mock-up draws: the company's papers once, and each person's own papers on their row. **Send a paper**
   finds a worker by their name or the company's. No sub has a business on file today, so the office
   enters each one. There are 24 living subs.
   **The company rows built 2026-11-23 as v2.8381** (#9517, `docs/recent-features/v2.8381.md`). The card drew no
   control to enter a company. It is *Their company*, a value in place on a sub's opened row: it offers the trade
   companies we have, takes a new name with the trade Plumbing, and has **Same as their name**. The tab is a table of
   people, not the mock-up's cards, so a company is a row above its workers' rows.
   **The company's papers built 2026-11-23 as v2.8394** (#9527, `docs/recent-features/v2.8394.md`). Two things the card
   did not foresee. The company branch of the send mails the people at the company who get its contracts, and a
   company entered from People has none, so the send first keeps the signer there. The paper entry function files a
   person's form and the table refuses a company's name there, so **Enter from paper** keeps a company's paper as
   signed with a link to the scan and keys no boxes.
   **Send a paper by company, the chip's move and Add to a list** wait on decision 2's screens (#9523), whose files
   they share. Papers already filed under a person stay where they are, on the owner's default.

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

Redrawn a third time on 2026-11-19, for the owner's call 3. The People screen shows a sub's company with
its workers under it, and the Agreements line for a sub's agreement names the company and who signed.
That screen was rendered again at both widths and in both themes.

Redrawn a fourth time the same day, for his call 6. The window's last row is **Someone not in any list**,
and a new section draws the typed-in send, its line on Agreements and the **Add to a list** window. It
replaces the line that sent the office to another page first. Rendered at both widths and in both themes.

Redrawn a fifth time on 2026-11-20, for his call 8: a section draws the Agreements tab as an estimator
sees it. Rendered at both widths and in both themes.

## How this meets the NDA builder spike

The spike of #389's flow ran in its own session and became card #404, the Document builder tab. Its
branch was not read here. From the two cards, it builds the builder's screens and decides nothing about
where a signer lives. #404's sends go to a GC and to a job's trades and keep the contact each went to,
which sits with calls 1 and 7 here. It meets this card
in two places. Its step 3 adds the *Signing for* line, which is step 5 here, now fed by a company record. Its step 8, the company's own
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
- A trade company's agreement is listed under the **GC projects** chip today, for the roles that read GC
  mode's papers. With call 7 a sub's company's agreement is one of those lines, and the office looks for
  it under **Staff and subs**. The kind's group moves in step 6.
- `gc_companies` requires one trade at least, and GC mode's own pages are dev only. Step 6 is the
  office's door to a company.
- `esign_consents.audience` allows *customer*, *sub* and *gc*. A supply house needs a value.
- `sendCompanyPaper` in `send-contract-for-signature` is the pattern for a paper to a company: it mails
  every person whose `gets` holds *contracts*.
  Since v2.8322 it takes the office's four roles, where it took a dev, and refuses an archived account.
  A request that says `from: 'office'` goes out under the name a sub knows, and not the GC's.
  Every other email to a trade partner is still a dev's (`GC_TRADE_EMAIL_ROLES`).
- The estimator's read (call 4) is on the paper's row. A signed form's PDF opens through
  `open-contract-form-pdf`, which checks the role itself, so it needs the same rule or an estimator sees
  the line and cannot open the file. Built in v2.8108: both ask `paper_is_outside_company`.
- A read policy for one more role also opens every function that reads a paper as its caller and then acts with the
  service role. Each names the roles it takes first, and `src/lib/paperCallerReadGates.test.ts` holds the list.
- A contact with no record is kind *unknown* today, which Messages reads as a number nobody has named.
  A typed-in signer has a name. PR 1's bed should prove a named contact with no record is allowed, and
  that one with no message shows on no Messages lane.
- `name_contact` folds the contact into the record's own contact when it has one. `contacts_fold_papers`
  is what carries the paper then, so **Add to a list** rests on PR 1.
- Until a typed-in party is added to a list, nothing says what kind they are. The estimator's read
  (call 4) covers them only once they are a customer, a supply house or a trade company.
- The repo is public. Every fixture, test, note and mock-up uses made-up names.

## How to verify, once built

- **PR 1.** The bed, as each role: the view answers the new kinds to the office's four roles and to an
  estimator, and to no one else. An estimator reads no person's paper. Fold two contacts and the paper follows. A party named like a roster person keeps no
  `person_id`.
- **PR 2.** On prod as a dev, with a ZZ Test person: send a paper, read the row, see the name and address
  on it. Nothing else about the send changes.
- **PR 3.** On prod with a ZZ Test customer and a made-up supply house: send to a person on file, then to
  a company with no one on file. See both lines under **Outside companies**. Sign one through its link
  with no login. Count the requests after opening the window. Then send to a typed name with a made-up
  address, see the line read *Not on a list*, press **Add to a list**, pick the ZZ Test customer, and
  see the same paper on the Customer page. Type an address a contact already holds and see the window
  name them.
- **PR 4.** The supply house's window and the Customer page show the paper. As an estimator's sample
  account: the tab is there, it lists outside companies' agreements and work orders and nothing else,
  it has no **Send a paper**, and no staff paper, sub's own paper, job contract or paper of a party on
  no list is on it.
- **PR 5 and 6.** On prod with a ZZ Test sub and a made-up company: link the sub to the company, send the
  company a paper as the office, and send the sub a paper of their own. The company's paper shows once
  under the company. The sub's paper carries *signing for* the company. A second ZZ Test worker linked to
  the same company shows under it.

## The owner's calls

Each is one question. The session's pick is first.

1. **Where does an outside signer's record live?** **Settled 2026-11-19: on the contact the app already
   keeps (D).** Shown the four options and the mock-up, he answered "On the contact". Not taken: on each
   record with a link per kind (B), a new list of outside parties (A), on People (C).
2. **Are a business and the person who signs for it two things?** **Settled 2026-11-19: yes.** The
   business is the party, and the signer is a name, a title and an email kept on the paper. He answered
   "Yes, two things". Not taken: one thing, the paper with the person and the business a typed line.
3. **Where does a sub's business name live?** **Settled 2026-11-19: every sub's business becomes a
   company record of its own, with its workers under it.** He answered "Its own company record". The
   session's pick was one line on the sub's People row, **Signs for**, and he did not take it. His
   choice is the larger build. It covers a worker who signs for the boss's company, and it puts a
   company's W-9 and insurance on the company. It raises call 7.
4. **Who in the office may read an outside party's paper?** **Settled 2026-11-19: the four roles and
   the estimator.** He answered "The same four rolls and the estimator." The session's pick was the four
   roles alone. What it means, as the session reads it:
   - The estimator reads a paper whose party is a customer, a supply house, a vendor or a trade company.
   - The estimator still reads no staff paper and no paper filed under a sub as a person. Those hold pay
     terms and tax forms, and they stay the four roles'.
   - A sub's company's papers count as an outside company's, so the estimator reads them. He was told
     this reading on 2026-11-19 and can turn it down.
   - It is reading only. Sending stays with the four roles.
   - An estimator had no Agreements tab, by #376's call 3. Call 8 opens it.
5. **Does sending stay on both People and Documents?** This is #389's wider call 5. **Settled
   2026-11-19: both.** He answered "Yes, both". People sends to a person on the roster, as today.
   Documents sends to anyone. An outside company's paper is sent only from Documents or from its own
   page. Not taken: sending moves to Documents alone.
6. **May a paper go to someone who is in no list?** **Settled 2026-11-19: yes, typed in.** His words:
   "Yes, typed in, But we want to make it easy after the fact to add them to a list." The session's
   pick was no, add them first. The design for it is in *The two layers* and step 3: the typed signer is
   a contact with no record, and **Add to a list** names them afterwards with the paper coming along.
7. **Is a sub's company the same record as a trade company in GC mode?** New on 2026-11-19, from call 3.
   **Settled the same day: yes, one record.** He answered "Yes, one record". One company record for any
   business the company subcontracts to, whoever is the GC on the job. Not taken: a new list for the
   company's own subs' businesses, kept apart from GC mode.
8. **Where does an estimator find an outside company's paper?** New on 2026-11-19, from call 4.
   **Settled 2026-11-20: both.** He answered "On the company's page and on agreements too". The
   session's pick was the party's own page alone. The tab opens to the estimator and lists only the
   lines their role reads. This changes #376's call 3, which gave the tab to the four roles, and that
   card says so. As the session reads it, the estimator's tab is for reading: no **Send a paper** and no
   press on a line.
9. **Does the estimator's read stop at agreements?** New on 2026-11-19, from building PR 1.
   **Settled 2026-11-20: no, every kind.** He answered "No, every kind". The build's pick was
   agreements only, and PR 1 is built that way, so step 4 opens with a migration that widens it. He
   was told the W-9's row carries the last four of a tax number. The Agreements tab lists agreements
   for every role, so an estimator finds a W-9 or a certificate on the company's own page. What the
   build's pick rested on: on 2026-10-10 the Board's call kept a trade company's
   W-9 and certificate to their states for the office, because the row carries the tax number's last
   four, the answers' PDF and the signer's details. Call 4's reason for closing a person's paper was the
   same, and a person's paper stays closed.
10. **May an estimator open a signed form's PDF?** New on 2026-11-19, from building PR 1.
    **Settled 2026-11-20: yes, an outside company's.** He answered "Yes, outside companies'". The
    build's pick was no, as today, and PR 1 is built that way. The file opens today for a dev, the
    controller and a pay-approved master. An assistant reads the row and is refused the file, and stays
    refused: he was told an estimator could then open a file an assistant cannot. A person's signed
    form and a signed hours statement stay as they are.
11. **Does that reach a signed W-9?** New on 2026-11-20, from call 10. The session told him a W-9's row
    carries the last four of a tax number. It had not told him that the signed PDF is the one place the
    whole number is, which is why the gate is held so tight (`open-contract-form-pdf`). So he is asked
    once more, with that said. **Settled 2026-11-20: yes.** He answered "Yes, W-9s too". The
    session's pick was no, not tax forms. The estimator opens every signed form of an outside company,
    the whole tax number included. Every open is logged (`contract_form_pdf_opens`), as today.

## Where it stands

PR 1, the ground, is built (v2.7977): the columns, the stored name and its checks, the fold's helper, the
door for a party's contact, the estimator's read and the view's four kinds, with a bed for each. No
screen shows any of it yet. The map, the counts, the four options and the pick are above. The mock-up
draws the pick and was redrawn once. The owner settled seven calls on 2026-11-19. Call 1: the record lives on the contact.
Call 2: a business and its signer are two things. Call 3: a sub's business is a company record of its
own, which was not the session's pick, and which added call 7. Call 4: the four roles and the estimator
read an outside party's paper, which was not the session's pick either, and which added call 8. Call 7:
a sub's company is the trade company record the app already keeps. Call 5: sending stays on both People and Documents. Call 6: a paper may go to a typed name, with a press to add them to a list afterwards, which was not the session's pick. Call 8, settled 2026-11-20: an estimator finds an outside company's paper on its own page and on the
Agreements tab, which was not the session's pick. Call 9, settled 2026-11-20: the estimator reads every kind of an outside company's paper, which the built
policy does not do yet. Call 10, settled 2026-11-20: an estimator opens an outside company's signed form, which the built gate does not do yet. Call 11, settled the same day with the whole tax number said: it reaches a signed W-9. All eleven calls are settled. PR 2, the send keeps the signer, is built (v2.7986). Grace's word to build came on 2026-11-19.

Step 4's first PR is on main and live since 2026-11-21 (v2.8108, #9122, its migration pushed and `open-contract-form-pdf` redeployed): the estimator reads every kind of an outside company's paper, a W-9 and a certificate among them, and opens its signed form, a signed W-9 among them. A paper filed under a person, a party on no list, a digital twin and a signed hours statement stay closed, and the assistant is still refused the file. It was read on prod as the estimator's sample account. They read the four outside papers there, three ZZ test agreements and a ZZ test W-9, and the signed form's gate says yes for each and no for a person's W-9. The W-9 is ZZ Test Supply's (`b920fa57`), added unsent by the dev on 2026-11-21 for this proof and kept for the rest of step 4. The two screens that list these papers came next, and are below.

The rest of step 4 is on main and live since 2026-11-21: the party's own page (v2.8162, #9212, merged 15:03 UTC) and the Agreements tab for an estimator (v2.8175, #9225, merged 18:22 UTC). Neither has a migration or a function. Each was walked on prod the same day, read only, as the dev and as the estimator's sample account, with the ZZ test papers. ZZ Test Supply's window lists two papers under **Papers**: its signed agreement, whose name opens the signed record for the dev and for the estimator, and its W-9 (`b920fa57`), which reads *not sent*. The ZZ test customer's **Agreements** card lists its two waiting agreements under *Papers with this customer*. The estimator's tab opens from the old link, has the chips *All*, *Outside companies* and *Work orders*, lists the three ZZ agreements and no W-9, and has no press on a line. The office's tab is whole. Not walked on prod: the estimator's card on the Customer page, since a ZZ test customer's page is drawn for a dev alone, and a work order or a trade company's agreement on the estimator's tab, since the sample account is answered none. Render smokes hold those. Steps 5 and 6 are next.

**What step 4 asks the owner.** None of these is decided, and each is in its PR.

1. An unsent paper is listed on the company's own page as *not sent*, with no press. Should it stay listed, and should the line carry a press to send it or take it back?
2. A W-9 and a certificate are on the company's own page and not on the Agreements tab, which lists agreements. Should the tab list them, for the office, for an estimator, or for neither?
3. A party on no list has no page, so their W-9 or unsent paper is still on no screen until **Add to a list** gives them one. Is that right?
4. An estimator's role is refused two reads the signed record makes: the form's layout and the signature's image. The window says so in words now. Should an estimator read both for an outside company's paper? That is a policy change, so a migration.
5. An estimator's line on the tab has no press, as this card reads call 8. A trade company has no page until step 6, so an estimator reads its agreement's line and cannot open it. Should a signed line open its record from the tab?
6. On an estimator's tab a trade company's agreement sits under **Outside companies**. Is that the right chip?
7. The guide says of a person who already has a paper out, *The window says so*. That is not true for an outside party, and the sentence is left as it was. What should the window say?

The audit's own file (`review-403/REPORT.md`) answered Permission denied while step 4 was built, and that was not worked around. It was read on 2026-11-21 once it was shared. Its findings 2 and 4 are answered above as far as the pages go. Findings 5 and 9 are fixed (below). Finding 3 is the third decision below, and finding 8 is set aside.

Steps 1 to 3 are on main and live since 2026-11-20: PR 1 (#8977, its migration pushed), PR 2 (#8992), **Who is it with?** (#9004) and **Add to a list** (#9010), with their edge functions deployed. Each was walked on prod as the dev with ZZ test records and the mail service's test addresses. The send kept the signer's name, title and address. Papers went to a ZZ test customer, a made-up supply house and a typed name, and their lines read Customer, Supply house and Not on a list. One was signed through its link with no login, and its e-sign record says `outside`. An address the app already keeps was named before the send. **Add to a list** then put the typed name at the ZZ test customer, and their paper came with them. The Customer page showing the paper is step 4's, not built.

**A gap the walks found, closed by v2.8348.** No press removed an outside party's paper. People → Contracts leaves a `party:` paper out, and Documents → Agreements had no take-back for any paper. Since v2.8348 a line that is not signed carries **Take back** (decision 1, below). The walks' three ZZ papers stay under **Outside companies**, where the office sees them, until a dev removes them. A take-back on the line, as People has for a person's paper, would close it. Step 4 did not build it: the company's own page lists a paper and removes none. It is the owner's call.

**Three older calls, noted and not built.** Each was found while step 4's first PR was built (#9122), each is older than that PR and unchanged by it, and each was read again on main on 2026-11-21. Taunya asked for them on the card on 2026-11-21. No fix is built for any of them: they are the owner's calls.

1. **An estimator can say what an unlisted party is, and then reads that party's papers.** Call 4 keeps a party on no list closed to an estimator until **Add to a list** names them. But saying who a contact is belongs to Messages' **Who is this?** (`name_contact`, with `contacts_fold`), and that is open to the whole office team, the estimator among them (`gc_office_team`, through the contacts' own policy). The papers follow the contact (`contacts_fold_papers`). So once an estimator names such a party a customer, a supply house or a trade company, the estimator's read covers that party's papers, a W-9 among them. The ground's bed tests this on purpose. The helper that carries the papers can also be asked for by itself, and then one party's papers move to another contact with the two contacts left apart. It refuses a training account, a digital twin, an archived account and anyone off the office team, and it does not refuse an estimator. **The call:** should naming a party need one of the four roles when the contact holds papers?
2. **An estimator's training account reads these papers and may open the signed file.** The read policy asks for an estimator who is not a digital twin, and the signed form's gate follows the policy. Neither asks whether the account is in training. A twin is refused by both. A training account still writes nothing. **The call:** should a training account read an outside company's papers, and open its signed form?
3. **Deleting a paper deletes its open log.** Every open of a signed form is a line in `contract_form_pdf_opens`, and that line is tied to its paper with `ON DELETE CASCADE`. So when a paper is deleted, the record of who opened its signed form goes with it. Only the four roles delete a paper, never a training account, a twin or an archived account, and no screen deletes an outside party's paper today (the gap above). **The call:** should the open log outlive its paper?

**Two audit findings fixed, and a lean on the rest (2026-11-21).** Taunya asked for two fixes that hold no choice. Finding 5: **Send email** waits until a typed-in signer's address is checked, so a quick press no longer sends to someone on the roster (v2.8240, #9309). Finding 9: a line says *signing for* the business its paper names when the party beside it is another, on the Agreements tab and on the company's own page (v2.8244, #9315). Both merged on 2026-11-22 and went live in one deploy about 05:04 UTC. Finding 9 was walked on prod that morning as the dev: the ZZ paper whose company had been lost (`f21fa8ac`) reads *signing for ZZ Test Outside Co* on the tab and on the ZZ test customer's page, and the other ZZ lines read as before. Finding 5 is not walked yet (below).

What is left above sorts into four decisions, each with the session's pick. Taunya leaned with the pick on each. **The owner answered all four on 2026-11-22.** Asked "Take the card's pick on all four of #403's decisions?", he said "Yes, all four". He was shown the four as they are written here, so each is built to the pick below and no wider. Each is its own PR or train, smallest first. Decisions 1, 3 and 4 are built (below), and decision 2 is not yet. Where a pick means something this card does not spell out, such as what **Take back** does to a paper its signer has already opened, that part is asked before it is built.

1. **Where an outside party's paper shows, and whether it can be taken back.** This covers step 4's questions 1 to 3, the gap, and the audit's findings 2 and 4. The pick: the Agreements tab lists every paper that is with an outside party, of any kind and any state, a party on no list among them, and one that is not signed carries **Send** and **Take back**. Asked on 2026-11-23 what **Take back** does, the owner answered "delete the paper and end its link". **Built 2026-11-23 as v2.8348, v2.8352 and v2.8354** (#9468, #9469, #9470, `20261123083000_agreements_every_party_paper.sql` pushed). A line that is not signed carries **Take back** for the leader and a dev, the two the app lets delete a paper on People. The paper's row is deleted, its link stops, and nobody is emailed. A signed paper is never taken back, and one signed a moment before the press is kept and the office is told. The tab lists every paper that is with an outside party, of any kind and any state: a W-9 or a certificate carries a second tag, and one made and never sent reads *not sent* under a **Not sent** chip, with **Send** on its line.
2. **How far an estimator's reach goes.** This covers step 4's questions 4 to 6 and the first two older calls. The pick: a signed line opens its record from the tab. An estimator reads the form's layout and the signature's image for an outside company's paper. Naming a party who holds papers needs one of the four roles. A training account reads the line and is refused the signed file. A trade company's chip stays where it is until step 6.
3. **A second signer at the same company.** This is the audit's finding 3 and step 4's question 7. The pick: the window says who already has the paper out, and offers to send it to them again or to send a second copy to someone else. **Built 2026-11-22 as v2.8325** (#9464): picking a company that has the paper out opens a window that names who has it and the day it went, with **Send it to … again** and **Send a second copy to someone else**. A second copy is a row of its own, so the first signer and their link are left alone.
4. **Whether the open log outlives its paper.** This is the third older call. The pick: it does. **Built 2026-11-22 as v2.8323** (`20261123030000_form_pdf_opens_outlive_paper.sql`): a deleted paper empties the line's link and leaves the line, which keeps the paper's name and who it was with.

The audit's finding 8, a signer kept at a supply house becoming its price-request rep, is set aside for now on Taunya's word.

**What decision 1 asks the owner (2026-11-23).** Each was met while it was built, and none is built past the pick.

1. Who may take a paper back? Built: the leader and a dev, the two the app lets delete a paper on People. The database lets the office's four roles delete one, so opening it to an assistant and the controller is one function and no migration.
2. Should taking a paper back leave a trace? The email's copy stays under Sent copies. Nothing else says the paper was made, who took it back or when, and a paper is not in Recently deleted.
3. A trade company's W-9 and certificate kept in GC mode are not on the tab, and its agreement is. Should they be?
4. A teammate's or a sub's paper that was never sent, and their tax forms, stay on People and off the tab. Is that right?
5. The **Not sent** chip shows only while a paper is not sent. Should it always show?
6. Should **Take back**, and **Send** on a paper never sent, be on the company's own page too? Today they are on the tab alone.

**Left to do and to walk (2026-11-22, brought up to date 2026-11-23).** Written for someone picking this card up on another computer. None of these is walked yet. The builds left are decision 2 and step 6, under *The plan*.

Walks owed on prod, read only unless a line says otherwise, as the dev or as a sample account through Settings → **View as**:

- **Finding 5, Send email waits for the address check (v2.8240).** Documents → Agreements → **Send a paper** → **Someone not in any list**, as the dev, at 1280 wide, light. Type an address and press **Send email** at once, three times. With a ZZ test person's address on the roster: the window refuses and nothing is written. With an address a ZZ test contact holds: the window names them and asks for a second press; close it there. With a made-up address at the mail service's test domain: the paper sends, and its ZZ row is deleted after. Not walked because the last case is a real send, and none was made the night it shipped. Render tests hold all four cases.
- **The estimator's card on the Customer page (v2.8162).** As the estimator's sample account, a customer's page with a paper of its own should show a card named **Agreements** with that paper and no press but the signed paper's name. Not walked because a ZZ test customer's page is drawn for a dev alone, and no real customer has such a paper. It needs a non-ZZ test customer, or the owner's word on showing ZZ pages to an estimator. A render smoke holds it.
- **A work order and a trade company's agreement on the estimator's tab (v2.8175).** As the estimator's sample account, a sub work order under **Work orders** and a trade company's agreement under **Outside companies**, each with no press. Not walked because the sample account reads no work order and no ZZ trade company has an agreement. Render smokes hold both.
- **Finding 9 at phone width.** Walked at 1280 only. At 390, light and dark, the *signing for* words should wrap under the signer with no sideways scroll.
- **Decision 1 (v2.8348, v2.8352, v2.8354).** As the dev, Documents → Agreements → **Not sent**: ZZ Test Supply's W-9 (`b920fa57`) reads *Supply house*, *W-9* and *not sent*, with **Send** and **Take back**. Press **Take back** and close its window at the confirm, which should name the paper and say nobody holds a link. As the estimator's sample account the same line has no press. Taking a ZZ paper back is a prod write, so it waits on the owner's word on the ZZ rows. Render tests and the `paper_party` bed hold every case.
- **Decision 3 (v2.8325).** As the dev, **Send a paper**, the paper the ZZ test customer has out (`5130560e`), then whoever that paper is with, the customer or the person on file there: a window should name who has it and the day it went, with the two presses. Close it there: a second copy is a real send.

Test rows kept on prod on purpose, all from the walks of 2026-11-20 and 2026-11-21: ZZ Test Supply's signed agreement `197de1dc`, the ZZ test customer's two waiting agreements `5130560e` and `f21fa8ac`, and ZZ Test Supply's unsent W-9 `b920fa57`. They are what every walk above reads. Since v2.8348 the leader or a dev takes back the three that are not signed from their lines, and a dev deletes the signed one, `197de1dc`, by id. Each is a prod write, done when the card closes and only on the owner's word.

On 2026-11-22 the card passed from Taunya to the owner, who took these walks and builds over. Step 5's ground is built since then (v2.8313), merged and its migration pushed, and no screen calls it yet. The office's send of a company's paper (v2.8322) and decisions 1, 3 and 4 followed, all on main, and their migrations are pushed. Nothing else is in flight.

Faults seen and not fixed, each the owner's:

- The audit's finding 8: a signer kept at a supply house becomes its price-request rep. Built today: they do. Set aside on Taunya's word.
- Small presses on a phone, from the audit's look notes: the tab's chips are 28 px tall, the party picker's close is 21 by 22, **Send email** is 34. Older than this card.
- Older than this card, from the audit: a signer who opens a used link reads that it no longer works rather than that it is signed; the consent row is written only when the page posts it; and nothing freezes the words of a paper that is not built from clauses once it is signed.
- Found while v2.8348 was built: a signer who has the signing page open when their paper is taken back, or sent again, and then presses to sign, reads *We couldn't record that. Please try again later.* and not the words for a link that no longer works. Nothing is signed. The fix is the sign call's refusal in `ContractAccept.tsx`, with a Spanish sentence beside it.
- The reminders switch on the Agreements tab (#9181) is not gated on the four roles. It is drawn only on staff, sub and partner papers, which an estimator reads none of, so no press reaches an estimator today.

What was built for each of the four decisions before the owner's answer of 2026-11-22. Decisions 1, 3 and 4 are built since (above):

1. A company's own page lists every kind and state of its papers. The tab lists sent and signed agreements only. Nothing takes a paper back.
2. An estimator's line on the tab has no press. They are refused the form's layout and the signature's image. They can name a party in Messages and then read its papers. A training account reads and opens like any estimator.
3. A second send to the same company replaces the first signer.
4. Deleting a paper deletes its open log.
