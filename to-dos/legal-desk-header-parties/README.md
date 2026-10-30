---
name: "Legal desk header: the account's head shows who we have a contract with, who owns the building, and the venue, with the map one press away"
number: 219
group: gated
status: asked 2026-10-30 · read and mocked up 2026-10-30 (three shapes of the header, two shapes of the map, the states, the portal, a second pass) · branch `claude/elastic-snyder-dfe3fe` · waiting on the owner's pick
summary: >
  The Legal desk's account head says the payer's name, the payer's office address, a twenty-word
  venue sentence and the balance. The three facts an attorney asks first are not in it: who Click
  has the contract with is the name alone, the owner of the building is a column in the Property
  record table four screens down, and the venue is prose. Shape A draws the three as one strip of
  cells under the name, each the record's words with a door: the customer, the property record,
  and for the venue the desk's own Map opened on the county with the case held and the two places
  a suit can be filed on the county card. The line under the name becomes the building's address;
  the venue sentence goes. The firm's portal mirrors the strip in a third PR.
next: the owner's pick (A with V1 is recommended) and his answers to the four questions in the mock-up, then three small PRs: the strip, the venue press, the portal's mirror.
size: S + S + S
blocker: None. The owner's look at mockup.html.
opinion: build A with V1, all three PRs; the strip alone already answers two of the three, and V1 draws no second map
mockup: mockup.html (today; A the strip with the phone; B three lines; C title-band chips; V1 the Map on the county and V2 a street-map window; six states; the portal; the second pass; the recommendation and four questions)
---

# Legal desk header: the parties and the venue (#219)

## The ask

> In the legal desk, I would like to improve the header, I think we should show the person we have
> a contract with, the person who owns the building, and the venue where a person can click on it
> and it brings up a map. — the owner, 2026-10-30

## What the header shows today

Read on the dev server on 2026-10-30, on a live subcontract account (the mock-up's names are made
up). The desk has two headers. The **desk's title band** (`LegalDesk.tsx` ~L756–840) is the
scales and *Legal Desk*, the **Accounts · Map** switch (v2.5784), the firm group (the firm's name
with the county that picked it as a quiet tail, Emails, Portal link, v2.5792), **Firms…** and the
legend. The **account's head** (~L897–915) is the payer's name, a line of *job numbers · the
payer's address*, the venue line (`venueLineWords`, hidden for a released or given-up matter), the
balance with the oldest bill's age, then the readiness pill, Print packet and the three exits.

The three faults the ask points at, on that account:

- The address under the name is the payer's office, hundreds of miles from the building.
- The venue is a twenty-word sentence, half of it about the firm (*no counties are colored yet,
  so the firm takes every account*).
- The owner of the building is not in the head at all. It is the *Owner of record* column of the
  Property record table on the Account tab, under the four questions, the money bars and the fix
  list.

Where the three facts live:

- **The party we hold the contract with** is the packet's payer: `payerForJob` in
  `src/lib/legal/legalPacket.ts` takes the job's GC (`gc_customer_id`, `viaGc` true, Click a
  subcontractor for the lien clock) else the customer; a name-only payer has no customer record.
  The signed agreement is per job on the Paper tab (`paper.agreements[].coverage`,
  `JobContractCoverage.kind === 'signed'`), and the signer's name is on the coverage
  (`signer_printed_name`, `co_signer_name`, read by `signedNames` in `jobContractSigners.ts`);
  the theory's `contract` key stands when one exists. The Account tab's Basis column already says
  *signed contract* / *sworn account holds* / *needs …*. The customer's kind (`customerType`) and
  city (`cityOfAddress`) come from the same packet.
- **The building's owner** is the property record's owner of record: `resolveLegalJobProperties`
  (`src/lib/legal/legalProperty.ts`) over `resolveLienProperty` (`src/lib/jobs/lienProperty.ts`)
  gives each job a `LegalPropertyLine` with `owner` (the job's `job_property_owners` override, else
  the `customer_addresses` record's `owner_name` / `owner_company`; `owner_mode = building_owner`
  reads the company first), `ownerMailingAddress`, `ownerSource` (`job_override` /
  `property_record` / `none`), `propertyKind`, `homestead`, `lienReady` and `gaps`. The § 53.056
  notice and the lien affidavit read the same line. The record is typed on the customer's profile
  (`CustomerPropertyRecordPanel`, *Owner of record*), the desk's existing *Property record ↗* door.
- **The venue** is the county. `firmForAccount` (`src/lib/legal/firmForAccount.ts`) takes each
  job's county from its property record, else from where its geocode falls on the county map
  (`countyAt` over `public/geo/tx-counties.json`), else from a guess by the address's city
  (`suggestTxCountyForCity`), and picks the firm that covers it (`legal_firm_counties`).
  `venuePlaces` (`src/lib/legal/jpVenue.ts`) gives the two places TRCP 502.4 allows, where the work
  was done and where the defendant is, with `courtWords` (*Williamson County · justice precinct not
  yet* until the record's `jp_precinct` or the office's court map names one), `justiceCourtCap`
  and `lienForeclosureLine`; the printed packet prints the same paragraph. The desk's **Map**
  (`LegalDeskMapView` over `LegalFirmCountyMap` in `lens` mode, `useLegalMapCases`) already places
  every account by its first job's geocode and lists a county's cases on `LegalCountyContentsCard`
  with *Open on the desk ›*. No record on the desk carries a justice precinct today: the office has
  not drawn its court map (`court_areas`, v2.4769, drawn on the Map page's street map).

## The shapes (mockup.html)

- **A, the parties strip** (recommended): three cells under the account's name, in the owner's
  order. *Contract with*: the payer, its kind, who signed, its city; opens Edit customer. *Owns the
  building*: the owner of record as the record spells it, where it mails, the property's kind;
  opens the property record. *Venue*: the county and the precinct where the work was done, then
  *or <county>, where <payer> is*, and the justice-court cap; opens the map. The line under the name
  reads the job's address; the venue sentence is retired. On a phone the cells stack as rows.
- **B, three labelled lines** under the name (not picked: a caption, not a door; an unknown has
  no shape; six lines of small type on a phone).
- **C, chips in the title band** beside the firm group (not picked: the account's facts in the
  desk's row, which already wraps at 1040 px and cuts the firm's name first; four lines of chips
  above the name on a phone).
- **V1, the venue press opens the desk's Map** on the county with the case held, and the county
  card gains a *Venue for job N* block: the two places, the rule lines, a door to the Map page
  where precincts are drawn (recommended: one map, nothing new drawn, the county is all the
  records can say about venue today).
- **V2, a window on the street map** (drawn live in the mock-up; not recommended: a second map on
  one desk that says nothing more until the office draws its precincts, which can then be laid on
  the county map instead).

The states: a homeowner who owns the building merges the first two cells; an owner not on the
record, a county unknown and a name-only payer are amber cells whose press is the record; two
buildings count and open the Property record table; with the firm or given up, the strip stays.

**The portal**: the firm's matter page (`LegalFirmMatterView.tsx`, the `legal-portal` mirror)
already carries the Payer line, the Property record table and *Where to file* lower down. PR 3
mirrors the strip at its top from the same kernel, with no office doors; its venue cell opens the
portal's *Who covers what* (v2.5862).

## Is this the best we can do?

The second pass in the mock-up changed the first draft in eight places: the building's address
replaced the payer's office under the name; a fourth cell for Click was cut; the street-map window
lost to the desk's own Map once the precinct argument was weighed against the records; the owner's
name stays as the record spells it; the contract cell names the signer; the venue cell says both
counties; the firm words of the old sentence stay on the firm segment's hover; a name-only payer
was a missing state. Cut: a tenant or brand cell, a courthouse pin, a cell for the firm's office,
an inline fold for the map.

**Plain words**: the cells' quiet lines are fragments in the rail's own style (*1 job · GC pays ·
signed*). Every sentence the strip or the card writes (*Add the owner to the property record.*,
*Link the job to its property record.*) keeps to `src/lib/plainWords.ts`; the rule lines on the
county card are the packet's existing words, quoted as printed.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The head | `LegalDesk.tsx` ~L897: name, `jobs.map(number) · customerAddress`, `venueLine`, the balance | `LegalPartiesStrip.tsx` under the name; the line reads the job's address (`packet.account.jobs[].address`) |
| Contract with | `packet.account.payer` (`name`, `viaGc`, `customerId`), `customerType`, `paper.agreements[].coverage` (`kind`, `signedNames`), `cityOfAddress(customerAddress)`; the doors `openEditCustomer` / *Link a customer* | `lib/legal/legalParties.ts`: the cell's words, state and door |
| Owns the building | `packet.account.properties[]` (`LegalPropertyLine`); the door `customerDoor('Property record')` | the merge rule (payer is the owner of record), the count for two buildings, the amber gap |
| Venue | `venuePlaces` / `courtWords` / `justiceCourtCap` / `lienForeclosureLine` (`jpVenue.ts`); `firmForAccount` for the county and its source | the cell's one line |
| The map | `LegalDeskMapView`, `LegalFirmCountyMap` (`lens`, `selectedCounty`, `heldCaseId`), `useLegalMapCases`, `LegalCountyContentsCard` | an opening county and held case on the view; the venue block on the card; `pressVenue` on the desk |
| The portal | `LegalFirmMatterView.tsx` (Payer, Property record, Where to file), `LegalPortalCoverage.tsx` | the strip from the same kernel; a `legal-portal` deploy |
| Guide | *review a collections account before it goes to your attorney* | a section on the three cells and the venue press |

## The plan

1. **PR 1, the strip** (S): `legalParties.ts` kernel + tests (every state above), `LegalPartiesStrip.tsx`, the name line, the venue sentence retired (its test moved to the cell), render smoke, the guide section, release note + fragment, `docs/GLOSSARY.md` → Legal desk amended in place.
2. **PR 2, the venue press** (S): `LegalDeskMapView` opening props, the venue block on `LegalCountyContentsCard`, the strip's venue cell wired; render smoke; the guide's Map section; release note + fragment.
3. **PR 3, the portal** (S): the strip on the firm's matter page from the same kernel; `legal-portal` deploy after the merge; the portal guide; release note + fragment.

## How to verify

Dev server, `/legal-desk`: a GC-paid account whose property record names an owner reads the three
cells as the mock-up draws them; a homeowner account merges the first two; a GC job with no owner
on its record draws the owner cell amber and its press opens the property record. The Venue press
switches to Map with the county outlined, the case held and the venue block on the county card;
*Show ›* on the defendant's place pans or says it is off the map. Phone at 375: the rows stack.
Prod reads only; nothing is written.
