---
name: "Where an outside signer lives: a paper names a contact the app already keeps, and says who signs"
number: 403
group: waiting
status: asked 2026-11-19, the owner's yes to a session that lays out the options · read in the code and on prod the same day, counts only · four options weighed and one picked · the mock-up drawn, rendered at desktop and phone width in light and dark, then redrawn after a second look · 2026-11-19 the owner settled call 1, the record lives on the contact, call 2, a business and its signer are two things, call 3, a sub's business is a company record of its own, call 4, the office's four roles and the estimator read an outside party's paper, call 7, a sub's company is the trade company record the app already keeps, call 5, sending stays on both People and Documents, and call 6, a paper may go to a typed name that is added to a list afterwards · the mock-up redrawn for calls 3 and 6 · 2026-11-19 the word to build · PR 1, the ground, is built (v2.7977) · PR 2, the send keeps the signer, is built (v2.7986) · Who is it with? is built (v2.7995) · Add to a list is built (v2.7998) · all four on main and on prod by 2026-11-20, each walked there with ZZ test records · the walks found one gap, noted under Where it stands · 2026-11-20 the owner settled call 8, an estimator finds an outside company's paper on its own page and on the Agreements tab, and the mock-up draws that tab, and call 9, the estimator reads every kind of an outside company's paper, tax forms among them, which the built policy does not do yet · one call is left, 10, which the build of PR 1 raised
summary: >
  The app can send a paper to anyone with a link, and it can only file one under a name on the roster.
  A supply house, a vendor, a customer's contact or a sub's business has no record that holds a paper,
  so the office cannot send one, list it or remind on it. This card maps every place an outside party
  already has a record, weighs four places the signer's record could live, and picks one: the paper
  names a contact. Messages already keeps one contact for every customer, every person at a customer,
  every supply house and its reps, every sub and every trade company. The paper points at that contact
  as the party and keeps the signer's name, title and email in its own row. No new list is made, and
  People keeps everything it has. The owner took that pick on 2026-11-19, and that a business and its signer are two things. He also chose that a sub's business becomes a company record with its workers under it, and that the estimator reads an outside party's paper beside the office's four roles. A sub's company is the trade company record the app already keeps. Sending stays on both People and Documents. A paper may go to a typed name with no record, and one press adds them to a list afterwards. An estimator finds an outside company's paper on its own page and on the Agreements tab. The estimator reads every kind of an outside company's paper. PR 1, the ground, is built, and one call is left at the foot.
next: Step 4, which no call holds now: the estimator's read widened for call 9, the party's own page, then the Agreements tab for an estimator. Call 10 is the owner's: whether an estimator opens a signed form's PDF.
size: L as a train of nine (M · S · M · S · S · S · S · M · M); left: steps 4 to 6 (S · S · S · M · M)
blocker: None for step 4. Call 10 widens one gate of what PR 1 built, if he turns it.
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
   kept a trade company's W-9 and certificate for the office. A supply house's window
   lists its papers. The Customer page's **Agreements** card lists them beside the job contracts it has
   today. Then the Agreements tab opens to an estimator (call 8): `canSeeAgreements` takes the role,
   and the list shows what the database answers them, which is outside companies' agreements and work
   orders. Chips for kinds they cannot read are left out. They get no **Send a paper**, no **Contract
   library** and no press on a line, since sending stays with the four roles. An old link to the tab
   stops landing them on Estimates. The guide and `docs/ACCESS_CONTROL.md` are updated.
5. **A sub's company, the ground (M).** A roster person gains a link to a trade company
   (`gc_companies`, call 7), and a company can hold people who are on the roster. The office, not only
   a dev, can send a company's paper. A person's paper freezes *signing for* from that link.
   This is the *Signing for* line of #389's step 3.
6. **A sub's company on People (M).** People shows a sub's company with its workers under it, as the
   mock-up draws: the company's papers once, and each person's own papers on their row. **Send a paper**
   finds a worker by their name or the company's. No sub has a business on file today, so the office
   enters each one. There are 24 living subs.

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
- The estimator's read (call 4) is on the paper's row. A signed form's PDF opens through
  `open-contract-form-pdf`, which checks the role itself, so it needs the same rule or an estimator sees
  the line and cannot open the file.
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
    **No, as today, and PR 1 is built so.** The file opens for a dev, the controller and a pay-approved
    master. An assistant reads the row and is refused the file. This card expected the estimator's rule
    to be copied there, which would let an estimator open a file an assistant cannot. Or the estimator
    opens an outside company's signed form, which is one gate in `open-contract-form-pdf`.

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
policy does not do yet. Call 10 is open, which the build of PR 1 raised. PR 2, the send keeps the signer, is built (v2.7986). Grace's word to build came on 2026-11-19.

Steps 1 to 3 are on main and live since 2026-11-20: PR 1 (#8977, its migration pushed), PR 2 (#8992), **Who is it with?** (#9004) and **Add to a list** (#9010), with their edge functions deployed. Each was walked on prod as the dev with ZZ test records and the mail service's test addresses. The send kept the signer's name, title and address. Papers went to a ZZ test customer, a made-up supply house and a typed name, and their lines read Customer, Supply house and Not on a list. One was signed through its link with no login, and its e-sign record says `outside`. An address the app already keeps was named before the send. **Add to a list** then put the typed name at the ZZ test customer, and their paper came with them. The Customer page showing the paper is step 4's, not built.

**A gap the walks found, noted and not built.** No press removes an outside party's paper. People → Contracts leaves a `party:` paper out, and Documents → Agreements has no take-back for any paper. The walks' three ZZ papers stay under **Outside companies**, where the office sees them, until a dev removes them. A take-back on the line, as People has for a person's paper, would close it. It is the owner's call whether it waits for step 4 or comes sooner.
