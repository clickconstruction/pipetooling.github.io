---
name: "Documents: an Agreements tab, every agreement the app makes in one list"
number: 376
group: close
status: asked 2026-11-17 · the owner took all seven picks and said build the whole train the same day · all five built and live: the rules v2.7604, the view and the read v2.7612, the tab v2.7617, Search v2.7620, GC mode’s three kinds v2.7625 · both migrations pushed 2026-11-17 and 2026-11-18 · checked on the live list in a local build, in the live build’s files, and by role through the dev seat · asked again 2026-11-19 to finish the section so the office manages a paper there · a second train of three, all built: a waiting line acts where it sits v2.7932, send a paper from the tab v2.7937, the Contract library door v2.7938 · each walked in a dev preview, the sends on a ZZ Test person only · 2026-11-19 night: the first two things under What is left built on branches on four picks · 2026-11-20: each cut onto that day's main as its own PR, held for his calls and armed by him alone, the reminders v2.8013 first and the signer's copy in the PR on top of it · 2026-11-21: Taunya answered the six calls, the first five kept as built and the estimator let in to open a plain paper's PDF, and moved the company's own signature to card #412 · the reminders landed that day on her go, v2.8013, its migration pushed and `send-contract-for-signature` and `remind-person-papers` deployed, the switch off · the signer's copy landed that day too on her go, v2.8016, its migration pushed and `accept-contract` and `person-paper-pdf` deployed · both walked signed in on prod that night on a ZZ Test person: a paper sent, reminded once by the hourly job, sent again, signed, its copy emailed with the PDF, and the PDF opened from the signed record · 2026-11-24: card #403's train is on main, so the call it held, whether an outside company's paper is reminded, is back with Taunya · 2026-11-24: walks 3, 5 and 6 walked on prod in one sitting, on one ZZ Test Supply paper, by app presses alone: the outside signer's copy and its PDF hold, the signing page holds at 375 px, the ask scrolled sideways at 375 px, and the reminder email was not read · the sitting's paper and its two kept copies deleted as the dev that day, on Diane's yes · the ask's sideways scroll fixed as v2.8500 the same day, on the rendered template, and the functions that send it redeployed · walk 2 walked the same day: the estimator's sample account opens ZZ Test Supply's signed PDF, and a waiting line's presses read 44 px on the live tab at phone width · 2026-11-25 (UTC): walk 4, the reminder-email walk, taken off on the user's word in the managing session, and the reminders switch stays off · left: the owner’s own look, and the loose ends and calls under What is left
summary: >
  The owner looked for agreements on the Documents page and found none. The page has ten tabs and
  none lists agreements. A job's signed paper shows only as a line under its job on the Jobs tab,
  which reads the newest 200 jobs and whose search does not match that line. Staff, sub and partner
  agreements and sub work orders are not on the page at all. This card adds an Agreements tab for the
  office: one list of every agreement, newest first, with chips for kind and state and a find box. A
  press opens the window that kind already has. The list is one database view over the tables that
  hold agreements, so each table's own row security decides what a reader sees, and nobody reads a
  paper here that they cannot read today. It renames nothing: Contract under a job stays.
next: The owner takes the first walk under What is left, on Documents → Agreements. Walk 4 was taken off on 2026-11-25 on the user's word. Walks 3, 5 and 6 were walked on 2026-11-24, and their paper and kept copies are deleted. The reminders and the signer's copy both landed on 2026-11-21 and were walked signed in on prod that night, on a ZZ Test person. Reminders stay off until someone turns them on in Settings → People & teams. Call 2 there, an outside company's paper reminded, is back with Taunya since card #403's train landed on 2026-11-23. No statement of work and no owner contract send exists yet, so a GC line is proven by the database test until one is sent. Call 7’s card is #377.
size: M as a train of five (S · M · M · S · S), then M as a second train of three (M · M · S)
blocker: None.
ver: v2.7604 · v2.7612 · v2.7617 · v2.7620 · v2.7625 · v2.7932 · v2.7937 · v2.7938 · v2.8013 · v2.8016 · v2.8500
opinion: build — the papers exist and the office already reads them in four places; the tab is a read over what is there, with no new table and no change to who can see what
---

# Documents: an Agreements tab (#376)

The mock-up is [mockup.html](mockup.html). Its first frame works: the chips and the find box filter the
list. Every screen on it is drawn by one script from one list of made-up agreements, so a count on a chip
or a band is counted from the lines drawn. It was rendered with Playwright at desktop and phone width, in
light and dark, before it was shown.

## The ask, in the owner's words

2026-11-17:

> Across the app can you look at how we handle agreements? I don't currently see Agreements in the
> documents tab

Shown what the look found, he answered **Yes, design it**. This card is the design. No app code ships
from it until he says build.

Shown the mock-up and the seven calls the same day, and asked whether he takes the picks as drawn, he
answered **Take the picks**. That settles the calls.

The same day he said **Build the entire PR train in order**.

## What the look found

Read in the code on 2026-11-17, and on prod through the dev seat for counts only.

### The Documents page today

- Ten tabs: Search, Estimates, Bids, Jobs, Supply invoices, Sent copies, Photos, Painted maps, Company,
  Where files go (`src/lib/documentsPageTab.ts`, the router at the foot of `src/pages/Documents.tsx`).
  There has never been an Agreements or Contracts tab.
- A job's contract shows only on the **Jobs** tab, as a child line under its job
  (`DocumentsJobsLedger`, the `job_contracts` read with `status != 'draft'`). That tab reads the newest
  200 jobs, its search matches job fields, bills and test reports and never a contract line, and drafts
  are left out. The read fails soft, so a role the database refuses sees no line and no error.
- **Sent copies** holds the emailed or printed copy of a job contract, a person's contract and a work
  order, under the *Contracts and estimates* chip. That is the copy as it went, not the agreement and
  its state.
- `docs/twins/APP_DIRECTORY.md` already tells the digital twins *Contracts and document packets →
  `/documents`*. The page has never had that list.

### Where each agreement lives

| Kind | Table | Made and kept | States, in its own words |
|---|---|---|---|
| Job contract | `job_contracts`, `kind = 'contract'` | The Contract window (`JobContractModal`) | draft · sent ×N · opened N× · handed over · PDF emailed · signed ✓ · voided (`jobContractChips`) |
| Warranty in place of a contract | `job_contracts`, `kind = 'warranty'` | The same window | the same |
| A GC's own paper, signed by us | `job_contracts`, `kind = 'their_paper'` | The strip's Their paper sheet | signed by both · signed by us only, they rely on it (`theirPaper.ts`) |
| A signed paper the office filed | `job_contracts`, `signer_mode = 'paper'` | Add the contract, and the Customer page's **Agreements** card for one paper over several jobs (`covers_group_id`) | on file · paper |
| Staff and sub agreements | `person_contract_documents`, `doc_type = 'agreement'` | People → Contracts, by person and by document (`ContractsAgreementsPanel`) | unsent · sent · viewed, not signed · never opened · signed |
| Partner agreement | the same table with `partnership_id` | Partnerships → Agreements, a dev's page | not sent · sent · signed · lapsed |
| A trade company's agreement | the same table with `company_id` | GC mode, the trade's page | sent · signed |
| Sub work order | `step_commitments` | The work order window (`WorkOrderAssemblerModal`), signed on the sub's page | Drafted · Sent, awaiting signature · Offer expired · Signed · Declined (`workOrderCoverage.ts`) |
| Our contract with the owner on a GC job | `gc_owner_contract_sends` | GC mode's customer window | not sent yet · waiting on their signature · late · signed |
| A trade's statement of work | `gc_sows` | GC mode's trade card | drafted · waiting on their signature · signed · cancelled |

Not agreements, and not rows of their own: **Not needed** is a mark on the job
(`jobs_ledger.contract_not_needed_at`). A customer-accepted estimate and a proposal signed in the bid room
count as a job's contract cover (`jobContractCoverage.ts`) and live on the Estimates and Bids tabs. A
machine rental keeps only `vehicles.rental_agreement_no`. An in-kind arrangement has no signature.

### Who the database lets read each one

The newest `SELECT` policy of each table, read in `supabase/migrations/`:

| Table | Who reads it |
|---|---|
| `job_contracts` | dev, master technician, assistant, controller (`is_office_staff()`) |
| `person_contract_documents` | the same four, the roles that open People → Contracts (`canAccessContracts`) |
| `step_commitments` | those four and the estimator; a superintendent on their own jobs; the sub named on the row |
| `gc_sows` | dev, master technician, controller (`gc_money_team()`) |
| `gc_owner_contract_sends` | dev only |
| `sent_documents` | dev, master technician, assistant, controller |

So an estimator, a primary and a superintendent reach `/documents` today and read none of these papers
there. The estimator reads work orders only, where they make them.

### Where the signed file is

A signed job contract's PDF is in Supabase storage (`job-contract-documents`), and its emailed copy is a
`sent_documents` row. When this was read nothing went to Google Drive or the file index. Card #377 changed
that: a signed job contract is now filed in its job's Drive folder, under Team only › Contracts, and
**Find a file** finds it. The office can still type a Drive link of its own (`signed_document_url`). A person's signed form is in a
service-only bucket and opens through `open-contract-form-pdf`. A work order and a statement of work have
no stored PDF: the page is rebuilt from the row.

### The size of it

Counts only, read on prod as the dev on 2026-11-17. `job_contracts` holds 19 rows: 8 signed, 7 of those
filed on paper, 1 sent, 2 drafts, 8 voided. 28 people's agreements are sent or signed, 26 of them signed.
There is no work order, no statement of work and no owner contract send yet. The list is short today.
Voided rows are almost half of the job contracts, which is why the tab keeps them behind their own chip.

## The design

### The tab

**Agreements**, id `agreements`, after Sent copies in the tab row, since both are the office's ledgers of
paper. Its own file, as Sent copies, Photos and Painted maps are.

One line per agreement, drawn as a list line in the grammar of Sent copies and never a wide table, so a
phone needs no sideways scroll:

- a **kind tag**: Contract, Warranty, Their paper, Staff, Sub, Partner, Work order, and in GC mode Owner
  contract, Statement of work, Trade company;
- the **paper's name** as the press: the template's name, the document's name, the work order's number
  and scope, *Signed paper · scan* for a filed paper with no name;
- **who it is with**, then the **job** as a link to the job, or nothing more for a person's paper. A paper
  that covers several jobs names the first and says *and 2 more jobs*;
- the **state**, one chip in that kind's own words, in one of three tones: waiting, signed, ended;
- the **day**: *Signed Nov 14*, *Sent Nov 16*, *Voided Oct 15*.

The lines run newest first by that day, under a band per month with its count.

### The chips and the find box

- **Kind**: All · Job contracts · Warranties · Staff and subs · Partners · Work orders, and GC projects for
  a role that can read GC mode's papers.
- **State**: Sent and signed · Waiting on a signature · Signed · Voided or ended. The tab opens on *Sent
  and signed*. *Waiting on a signature* carries its count, which is the list of what to chase.
- **Find an agreement**: a customer, a job number, a person, a company, a paper's name. Asked of the
  database once the typing rests, two letters at least, every word having to match.
- Under the list, two doors in one quiet line: a job with no contract is in the Contract sweep on the
  Pipeline, and an accepted estimate is on the Estimates tab.

### What a press opens

No new viewer. Each kind opens the window it has today.

| Line | Opens |
|---|---|
| Contract, warranty, their paper, signed paper | `JobContractModal` on that record after `fetchJobWithDetailsById`, the same door the Jobs tab's line uses. Since v2.7932 one that waits on a signature opens the window too, where it is sent again or voided. A voided one opens the preview of the page that went out, since the window never opens on a voided record |
| A person's agreement, signed | `PersonContractSignedRecordModal` with the document's id |
| A person's agreement, waiting | `/people?tab=contracts&doc=<id>`, the door the signing page already uses. Since v2.7932 its line also carries **Send again** and **Copy the signing link** |
| Work order | `WorkOrderAssemblerModal` with that job and `initial.commitmentId`, read only once sent |
| Owner contract, statement of work, trade company agreement | The GC page, `/gc`. GC mode has no address that opens one project, so PR 5 opens the page. A trade company's signed agreement opens its signed record |

### The read

One view, `agreements_on_file`, `WITH (security_invoker = true)`, a `UNION ALL` over the tables above,
as `uploaded_photos` is for the Photos tab. Each branch answers the same columns: `kind`, `source_id`,
`paper_name`, `with_name`, the job's id, number, name and address, the person's or company's id, `state`
(waiting, signed, ended), the kind's own status columns the state words need, `at` (the day the line
sorts on), `sent_at`, `signed_at`, and `find_text`, the lower-case words the box searches.

- **Row security decides.** The view runs as the reader, so each table's own policy and the ledger's
  scope answer for its branch. A branch the reader may not read answers no rows. The view grants nothing
  new, and no policy changes.
- **Not capped and paged honestly.** The database sorts, filters by chip, searches and pages. The tab
  reads a hundred lines and **Show more** reads the next hundred.
- Drafts and unsent papers are left out in the view itself. Voided, declined, cancelled and expired rows
  are in, with `state = 'ended'`.
- A paper filed over several jobs is one line: the branch keeps one row per `covers_group_id` and counts
  the rest.

### Who sees the tab

`canSeeAgreements(role)`: dev, master technician, assistant, controller. The same four as Sent copies,
and the roles whose rows the list would hold. An estimator, a primary and a superintendent get no tab, and
an old link to it lands on Estimates. If a role without the tab ever asked the view directly, the database
would still answer only what that role's policies allow.

Changed 2026-11-20 by card #403's call 8: the tab will open to an estimator too, for the lines their role
reads, in that card's step 4. Nothing of that is built.

### The words

The tab is **Agreements**. *Contract* under a job on the Jobs tab, in the job window's Documents tab and
on the Contract window stays as it is. The Customer page's **Agreements** card, People → Contracts and
Partnerships → Agreements keep their names. This tab adds a view over them.

### The states the tab can be in

All drawn on the mock-up: the list, a chip pressed, the find box typed, voided or ended, nothing on file
yet (the empty state names what fills it and offers **Open the Pipeline**), nothing matches (**Clear the
search** or **Clear the filters**), and a failed read on `OfflineRetryPanel` with its reason and Retry.

## The plan

Each step is one PR, with its release note and fragment. Nothing is built until the owner says build.

1. **PR 1, the rules (S).** `src/lib/documents/agreementsLedger.ts`: the row type, the kind tags and
   groups, the state tone and words for each kind over the kernels that hold them today
   (`jobContractChips`, `theirPaper`, `workOrderCoverage`, the people panel's states), the day words, the
   find filter, the month bands, the count words, `canSeeAgreements`, and `agreements` in
   `documentsPageTab.ts`. Unit tests. No screen.
2. **PR 2, the read (M).** The migration for `agreements_on_file` (starting `SET lock_timeout = '3s';`,
   `CREATE OR REPLACE VIEW`, no table, so no fence calls), its `docs/migrations/` page, an SQL bed that
   proves each role reads only what its tables allow, and `agreementsLedgerIo.ts`: the paged read that
   throws with its reason, and the waiting count. Pushed right after the merge, then the types PR. No
   screen calls it yet, so nothing waits on the push.
3. **PR 3, the tab (M).** `src/components/documents/DocumentsAgreementsTab.tsx` and its render test, the
   tab button and mount in `Documents.tsx`, the lines, both rows of chips, the find box, Show more, the
   empty states, the retry panel and the presses. The help guide *find an agreement we sent or signed*,
   and `docs/DOCUMENTS_PAGE_ARCHITECTURE.md`, `docs/twins/APP_DIRECTORY.md`, `PROJECT_DOCUMENTATION.md`,
   `docs/GLOSSARY.md` and `docs/ACCESS_CONTROL.md`. Walked on prod as the office and as an estimator.
4. **PR 4, search (S).** The Documents Search tab mounts an Agreements section under Jobs for the office,
   fed by the same read with the typed words, so one box finds a job and its paper.
5. **PR 5, GC mode's kinds (S).** The owner contract, the statement of work and the trade company's
   agreement join the view as three more branches, with the GC projects chip. Each shows only to the
   roles GC mode gives it to.

## The second train: manage a paper here, not only find it

Asked 2026-11-19, in the owner's words:

> can you work on finishing getting an agreements section in documents?

A look the same day found the tab was a read with doors. It found, filtered and opened, and it could not
send, send again or reach the Contract Book. Those lived only on People → Contracts and on a job's Contract
window. This train puts them on the tab. Nothing leaves People → Contracts and no page is renamed: both
pages keep a door. The seven picks above stand as taken. Row security still decides what a reader sees, and
there is no migration.

1. **A waiting line acts where it sits (M), v2.7932.** A staff, sub or partner paper that waits carries
   **Send again** and **Copy the signing link**. Both go through `send-contract-for-signature`, the sender
   People uses, whose Send for signature window was lifted into a shared file for this. A job contract that
   waits opens its real Contract window, where **Resend email**, **Void & redo** and **File the signed copy**
   are. A voided one keeps the preview. Walked on the live list, and for real on a ZZ Test person.
2. **Send a paper from the tab (M), v2.7937.** **Send a paper**, beside the find box, picks a paper from the
   Contract Book, then a person, and opens the same email window. It is People's quick send: the same person
   picker, one rule for the pick (`quickSendPickPlan`), and nothing written until **Send email**. The new line
   then shows on the list. Walked on a ZZ Test person.
3. **The Contract library from the tab (S), v2.7938.** **Contract library**, beside Send a paper, opens the
   window People → Contracts opens, in place. The role rules are People's, now one copy both pages call: the
   owner and a dev delete, the controller and a dev see the Forms tab. **Send to…** on a paper there starts
   Send a paper at the person. Walked read only.

### What is left

The first two are built, live and walked: the reminders as v2.8013 and the signer's copy as v2.8016, both landed on 2026-11-21. Taunya answered their calls that day, and each row says its answer. The other two are not built here: each moved to a card of its own, #403 and #412. The walks still owed, the loose ends and the calls follow the table.

| What | Today | What it takes | Size |
|---|---|---|---|
| **Reminders by email** for a staff or sub paper | Only a prompt on the person's Dashboard. A job contract already gets three reminders, three days apart (`remind-job-contracts`) | **Built 2026-11-19, live 2026-11-21, v2.8013.** Merged on Taunya's go. Migration `20261120133000_person_paper_reminders.sql` was pushed right after the merge and before any function. Then `send-contract-for-signature` was deployed, then the new timed function `remind-person-papers`. Proved on prod by a read of the database, an unsigned call to each function, and the hourly job's first call, which the function answered with the switch off. Walked signed in on prod on 2026-11-21, on a ZZ Test person at the mail service's test address. The Settings switch was turned on and a paper sent. Its line read *0 of 3 reminders sent* with the next day, and its own **Turn reminders off** and **Turn reminders on** worked. The paper's date was moved up by hand, and the hourly job sent the first reminder at its own minute. **Send again** started the count over. **Copy the signing link** stopped the reminders, and the link before it then said it no longer works. The switch was on for 21 minutes and is off again. No other paper was sent in that time. An outside company's paper gets no reminder. Taunya's answer of 2026-11-21 was not yet, until card #403's train lands. That train landed on 2026-11-23, so the question is back with her, as call 2 below. Built on two picks. One: three reminders, three days apart, as a job contract gets. Two: the four roles that send a paper turn them off for one paper on its line, and one Settings switch for all, the owner's and a dev's, ships off. A paper sent while the switch is off is never reminded, so turning it on reaches no paper already out. Each reminder carries a new signing link and ends the one before it, since a link is kept only as a hash. The calls were how many, how far apart, and who may turn them off. Taunya's answer of 2026-11-21: keep each as built | M, built |
| **A copy to the signer, and a PDF of a plain paper** | Nobody is emailed once a person signs. A form makes a PDF. A paper of plain words or clauses makes none | **Built 2026-11-19, live 2026-11-21, v2.8016.** Merged on Taunya's go, PR #9182. Migration `20261120134000_person_paper_signed_copy.sql` was pushed about two hours after the merge and before any function. Then `accept-contract` was deployed, then the new `person-paper-pdf`. Nobody signed a paper in those two hours, so no signer missed a copy. Proved on prod by a read of the database, an unsigned call to each function, and the live build's files, which hold the **Open the PDF** press. Walked signed in on prod on 2026-11-21. The ZZ Test person signed, and the copy went to the test address within a second with the PDF attached. **Open the PDF** on the signed record opened the same five pages. An older signed test paper got its PDF on the first open, and nobody was emailed. The estimator's door was not walked: the unit tests hold its rule. The new function opens for the four office roles, and for an estimator on a paper with an outside company, as card #403's call 10 lets them open such a company's signed form. That is Taunya's answer of 2026-11-21 to the sixth call: as first built it refused the estimator. Built on two picks. Three: the office gets no copy by email, since the signed paper is on this tab and the signer's email is kept as a sent copy. Four: an old signed paper gets its PDF the first time someone opens it, and nobody is emailed about an old paper. An hours statement, a W-9 and a certificate are never emailed. The calls were whether the office gets a copy too, and whether old signed papers get a PDF. Taunya's answer of 2026-11-21: keep each as built | M, built |
| **An outside party as a record** | Built on its own card, #403, which closed on 2026-11-24 | Every step and all four decisions are built and live, v2.7977 to v2.8530. What that card left is under Loose ends | L |
| **The company's own signature** | Moved to its own card, #412, on Taunya's word of 2026-11-21 | Card #412 says what it takes and holds the two calls: who may sign, and whether every paper needs it or only some | M to L |

**Where it stands, read 2026-11-22.** Both pieces are merged, pushed, deployed and walked. The reminders went first: PR #9181, with its types in PR #9252. The signer's copy followed: PR #9182, with its types in PR #9294. All four functions run main's code: `send-contract-for-signature`, `remind-person-papers`, `accept-contract` and `person-paper-pdf`. The dev seat was redeployed after PR #9294, on Taunya's go, and reads the new columns. No migration of this card is left to push. The walk on prod of 2026-11-21 is written up in PR #9343. Read again against main on 2026-11-24: no PR of this card is open, and nothing of it was built since. Walks 3, 5 and 6 were walked that day, as the list below says. What card #403's train and the phone-press PR changed for this card is said on the lines below.

**Walks still owed.** Each uses ZZ Test rows only, and email goes only to the mail service's test address, `delivered+<label>@resend.dev`. Every row a walk makes is deleted before it ends, and the switch is put back off. Still owed: walk 1. Walk 4 was taken off on 2026-11-25 on the user's word, and walk 5's reminder email was owed with it. Walk 2 was walked later on 2026-11-24. Walks 3, 5 and 6 were walked on 2026-11-24 in one sitting, on one paper, by app presses alone, with the switch off. No press removes what that sitting made. Its paper and its two kept copies were deleted as the dev afterwards, on Diane's yes, and what only the service role can take is listed under Loose ends.

1. **The owner's own look.** As the owner, on their own account, at a desk width and on a phone, in light and in dark. Open Documents → Agreements. Press **Waiting on a signature**, then **Staff and subs**, then **Outside companies**. Type a person's name in **Find an agreement**. Open a signed line and press **Open the PDF**. Press **Send a paper**, pick a paper and a person, read the email window, and press **Cancel**. Press **Contract library** and close it. On the Search tab, type a person's name and find their paper under **Agreements**. In Settings → People & teams, read **Paper reminders by email** and leave it as it is. Should see: each press opens what its words say, and nothing is sent. Not walked yet: the look is the owner's to take.
2. **An estimator opens an outside company's PDF.** Walked on prod on 2026-11-24, and it holds. Through Settings → View as, as the estimator's sample account, in dark, at 1280 and 375 px. Under **Outside companies** the list showed four lines, each an outside party's or a trade company's, and no staff or sub paper. The chips were **All**, **Outside companies** and **Work orders**, and no line carried an act. A press on the name of `ZZ Test Supply`'s signed *Subcontractor Agreement (Internal)*, paper `197de1dc-aad1-475c-ae8c-84dfda7153d6`, opened the **Signed contract** window. **Open the PDF** there opened the PDF at both widths: 23 pages, *For ZZ Test Supply* on top, and *ZZ Test Rep*, *for ZZ Test Supply* in the signature block. Nothing scrolled sideways at 375 px. The press wrote nothing. The PDF was already made by an earlier open that day, so the make on a first open was not seen as an estimator. The walk of 2026-11-21 saw that make as a dev. View as was ended afterwards, and it leaves one line in the app's own View as log.
3. **An outside company's signer gets a copy.** Walked on prod on 2026-11-24, and it holds. As a dev at 1280 px, **Send a paper** sent the test-only *Job Secrecy Agreement* to `ZZ Test Supply` at the test address. The picker read *No one on file* for the company, so the signer `ZZ Test Rep` and the address were typed. **Keep ZZ Test Rep with ZZ Test Supply** comes ticked and was unticked, so no contact was made. The window read *The paper will say: ZZ Test Rep, signing for ZZ Test Supply.* The paper was signed from the emailed link in a signed-out browser. The copy left within a second with its PDF, and the email log reads *delivered*. The PDF is five pages. Its top reads *For ZZ Test Supply*, and its signature block reads *ZZ Test Rep*, *for ZZ Test Supply*. **Open the PDF** on the signed record opened the same file, byte for byte, as the attachment kept under Sent copies. The paper took no reminder date. It was paper `a5e81414-f3f9-4c76-8c20-a1fa103e2e6a`, deleted after the walk.
4. **The second and third reminder, and the stop.** As a dev, with the Settings switch on for the walk only, at 1280 and 375 px in light. Send a ZZ Test person a paper and move its reminder date up by hand three times, one hourly run apart. Should see: the line reads *1 of 3*, *2 of 3*, then *3 of 3*, and no fourth goes. Then archive a ZZ Test person whose paper waits and move that date up. Should see: no reminder goes and the date clears. Not walked yet: the walk of 2026-11-21 sent one reminder and looked in dark only. **Taken off on 2026-11-25 (UTC) on the user's word.** The managing session asked whether to run it, since it needs the team's reminders switch on for about five hours. The answer, quoted from that session's record of the user's answers: *Drop walk 4. The switch stays off.* The walk was never taken.
5. **The three emails as the signer reads them.** Two of the three were read on 2026-11-24, from Documents → Sent copies, at 1280 and 375 px, before any cleanup. The signed copy fits at both widths. It greets the signer by first name and says the copy is attached as a PDF, and the window names the file. The ask fits at 1280 px. At 375 px the ask scrolled sideways, a finding under Loose ends that v2.8500 fixed the same day. The fixed ask has not been read from Sent copies yet. The reminder was not read, so it was still owed, with walk 4. Walk 4 was taken off on 2026-11-25 and the switch stays off, so no reminder goes for it to be read from. The switch stayed off, so no reminder went, and Sent copies keeps no reminder for a person's paper. Each was read in the copy's own window, not in a mail app.
6. **The signing page on a phone.** Walked on 2026-11-24 at 375 by 812 px, and it holds. The paper, the name box, both ticks and **Submit signature** fit. The page has no sideways scroll before the ticks, with both ticked, or on *Thank you*. The name box is 285 by 44 px. **Type** and **Draw** are 44 px tall, and **Submit signature** is 285 by 48. Each tick's label is the press, 44 px tall or more. **How electronic signing works** is 42.5 px tall, the one press under 44. The paper sits in a box of its own that scrolls down only. Looked at in Chromium, not on a real phone and not in WebKit.

**Loose ends.**

- **The reminders switch is off,** `0`, read again 2026-11-24 at 07:45 UTC through the dev seat, after that day's walk, and no paper carries a reminder date. Turning it on reaches only papers sent after.
- **A job's paper built from settings is never reminded.** Since v2.8156 such a paper can be sent with no words of its own. While the switch is on, its send sets a first reminder date. Then `remind-person-papers` finds nothing to sign, holds it and clears the date. Seen in the code on 2026-11-21 and not fixed. The fix would read the job's settings the way the send does. It waits on the first call below.
- **Test files a dev cannot delete,** left by the walk of 2026-11-21. Their rows are deleted, so no screen reads them, and a delete as the service role would take them.
  - `contract-form-pdfs/7484d33e-a6aa-464e-af7b-dce28a8c5d9e/signed-paper.pdf`.
  - Five files in `sent-documents`, under `ef25c215-8c12-43b4-b9e6-9821e43ce2d6/`, `2a4a643f-916d-4a45-b005-2f8012dc2de2/`, `5839f588-9507-4ab7-87b3-582553075eb6/` and `5dbe1ea9-e5b9-485d-bb4f-a6ba0de0b155/`.
  - Four `email_send_log` lines: `a9233ed3-8040-4e9b-be54-8a94da5a0e81`, `45a3fafc-aa96-4511-a942-73e431403b3d`, `308a07fd-0643-4253-8f90-6df72a8ed0ea` and `1ee781cd-a030-474c-9800-3fcbbf52143b`.
- **Test rows no press removes,** left by the walk of 2026-11-24. Take back refuses a signed paper, People → Contracts leaves an outside party's paper out, and Sent copies has no delete. So each removal is a direct write. No person, account or contact was made.
  - Deleted as the dev on 2026-11-24 at 07:53 UTC, on Diane's yes, and read back gone: the signed paper `a5e81414-f3f9-4c76-8c20-a1fa103e2e6a` and the kept copies `669d71c9-5dcb-421c-884a-a1ab1ed2eb64` and `ccc3a606-21ff-4627-842b-0b7f839ed831`. No screen reads them now.
  - Still there, the service role's to take: `email_send_log` lines `ce84e114-fd9b-49c6-8ab4-a2aaf71cdfcc` and `37322ee7-ad10-459c-969d-febeddb32f80`, and the `esign_consents` row `a664003a-3613-4931-831f-df838a7c131f`.
  - Four files, the service role's too: `contract-form-pdfs/a5e81414-f3f9-4c76-8c20-a1fa103e2e6a/signed-paper.pdf`, and in `sent-documents` the two `copy.html` files under `669d71c9-5dcb-421c-884a-a1ab1ed2eb64/` and `ccc3a606-21ff-4627-842b-0b7f839ed831/` with that copy's attached PDF.
- **The ask scrolled sideways on a phone. Fixed, v2.8500.** Seen on 2026-11-24 in the kept copy at 375 px: the email was 455 px wide. The line *Or open* with the signing link was 419 px, and the link did not break. The header's right side and the paper's name were cut at the edge. PR #9675 lets the written-out link break inside itself. The link, the button and the words are the same. On the rendered template the email is 320 px wide at 320 px and 375 px wide at 375 px, with nothing past the edge. A reminder is the same email, so it fits too. The two functions that send it, `send-contract-for-signature` and `remind-person-papers`, run the new template: each deployed copy was downloaded on 2026-11-24 and is the same as main's. Five more functions import the file and were redeployed with them. Not seen yet: a sent ask on a phone or in a mail app. Chromium on the rendered template only.
- **The kept copy of the ask shows the signing link in full.** The link is kept only as a hash on the paper's row, and that does not hold for the copy under Sent copies. The four roles that read Sent copies may also copy a link, so nobody gains a reach. Seen 2026-11-24, left as it is.
- **The signed copy's line under Sent copies names the company.** The ask's line reads *to ZZ Test Rep* and the copy's reads *to ZZ Test Supply*, and both went to one address. Seen 2026-11-24, left as it is.
- **`ZZ Test Hand`'s paper,** `4358a4e4-0f9b-4ecd-a121-f86182d4b5f5`, is a standing test row from an earlier walk. Its first open on 2026-11-21 made its PDF, `contract-form-pdfs/4358a4e4-0f9b-4ecd-a121-f86182d4b5f5/signed-paper.pdf`. It was left in place.
- **Two old claims still stand:** `refs/claims/migration-20261120060000` and `refs/claims/migration-20261120061000`, from the first cut of these migrations. They landed as `20261120133000` and `20261120134000`. The claim script releases versions and punch-list numbers only. Both still stand on GitHub, read 2026-11-24. Taking one down is a push, so it waits for a yes.
- **What card #403 left,** when it closed on 2026-11-24. Each was seen there and not fixed, and none is asked for yet.
  - The audit's finding 8: a signer kept at a supply house becomes its price-request rep. Set aside on Taunya's word of 2026-11-21.
  - A signer who opens a used link reads that it no longer works, and not that the paper is signed.
  - The consent row is written only when the signing page posts it.
  - Nothing freezes the words of a signed paper that is not built from clauses.
  - A signer has the signing page open when their paper is taken back or sent again, and then presses to sign. They read *We couldn't record that. Please try again later.* and not the words for a link that no longer works. Nothing is signed. The fix is the sign call's refusal in `ContractAccept.tsx`, with a Spanish sentence beside it.
  - The reminders switch on a line (#9181) is not gated on the four roles. It is drawn only on staff, sub and partner papers, which an estimator reads none of, so no press reaches an estimator today.
  - A trade company we emailed stays on the bench after its paper is taken back, by the bench's own rule.
- **Test rows card #403's walks left on prod,** each with no press that removes it. They are ZZ rows, and no person reads their mail.
  - `ZZ Test Supply`'s signed agreement `197de1dc`, with the PDF its first open made. Walk 2 above reads it, so it is kept on purpose.
  - The contact ZZ Test Walk Nolist (`aee8b1a5`), on no list, with the test inbox's address. It holds no paper.
  - The trade company ZZ Test Walk Co (`1442cc09`), its signer's row there (`7a0e4483`) and one trade message row (`e124fad9`). The bench keeps a company we emailed.
  - The copies of the emails that went out, under Sent copies, and their email log lines. Three copies are from 2026-11-24 (`f2e382e0`, `cbd60a3a`, `63d10713`), with three log lines (`4f76cf98`, `7208e7b1`, `e02f920a`).
- **Small presses.** On a waiting line, **Turn reminders off**, **Send again** and **Copy the signing link** are 28 px tall at 375 px, and the Settings press is 32 px. They match the presses the line had before, so this card did not change them. PR #9579, v2.8430 on card #403, merged on 2026-11-24. As written it stands a line's presses 44 px tall at phone width, these three among them. Its harness measured **Send again** and **Copy the signing link**, and not **Turn reminders off**, which takes the same floor in the code. It does not touch the Settings press, which stays 32 px. Seen on the live tab on 2026-11-24 at 375 px, as a dev: **Send again**, **Copy the signing link** and **Take back** are 44 px tall on every waiting line, and so are **Send a paper**, **Contract library** and the chips. Nothing scrolls sideways. Three links are 16 px tall: a job's name inside a line's sentence, and *Pipeline* and *Estimates* in the foot, which v2.8430 left for a layout call. **Turn reminders off** was on no line, since the switch is off, so it is not measured live, and the Settings press was not measured again. In the **Signed contract** window at 375 px, **Close** is 32 px tall and **Open the PDF** is 29 px, and **Open the PDF** sits at the window's bottom edge. Neither was changed.

**Calls still open.**

1. Whether a job's paper built from settings is reminded. Built today: it is not.
2. Whether an outside company's paper is reminded. Taunya's answer of 2026-11-21: not yet, and it comes back once card #403's train lands. It has landed. Every step of card #403's plan and all four of its decisions were on main by 2026-11-23. The last were decision 2, how far an estimator reaches (v2.8378, v2.8388), and step 6, a sub's company on People (v2.8381, v2.8394, v2.8419). So the call is back, and it is Taunya's to answer. Built today: it is not. The send sets a reminder date only for an agreement filed under a person, never for a company's paper or an outside party's (`paperTakesReminders`).
3. When the reminders go on for the whole team. Built: the switch ships off, and the owner or a dev turns it on.
4. The company's own signature, on card #412.

Smaller things the tab still leaves to People, each S, none asked for yet:

- **Take a staff or sub paper back.** People deletes a teammate's or a sub's paper that is not signed. The tab has no press for that paper. Since v2.8348, on card #403, the tab does have **Take back** on an outside party's paper that is not signed: a customer's, a supply house's, a trade company's, or someone's on no list. It is a dev's and the controller's since v2.8530, where it was the leader's and a dev's. It asks first, and it deletes the paper and ends its link. Since v2.8488 it covers a trade company's own paper too. A paper a job requires still comes off on the job.
- **File a signed paper for a person**, and **Enter from paper**. Both stay on People → Contracts.
- **A waiting paper's name still opens People**, on that paper's own line (v2.7924). The line's two presses cover the
  chase, so the name was left as the door to everything else about the paper.

## Left out on purpose

- **Drafts.** A draft stays in the window that made it, as on every Documents tab today (call 6, settled).
- **What is missing.** A job with no contract, or one marked Not needed, is the Contract sweep's list on
  the Pipeline. This tab lists paper that exists and points there.
- **Accepted estimates and signed bid proposals.** They stay on the Estimates and Bids tabs (call 1).
- **Papers that are not agreements.** A W-9, an insurance certificate, a licence, an hours statement, a
  lien waiver, a sub's statement of account (#350).
- **A machine rental's agreement number** and **in-kind arrangements**.
- **Any change to row security**, and any new viewer or new table.
- **The Jobs tab.** Its contract lines, its 200-job read and its search stay as they are.
- **The follow-up, as its own card (call 7):** a signed job contract was not saved to Google Drive or the
  file index, so Find a file could not find it. Card #377 built that.

## The owner's calls, settled 2026-11-17

He took all seven picks as the mock-up draws them.

1. **Which kinds are in.** Job contracts, warranties, a GC's own paper, signed papers the office filed,
   staff and sub agreements, partner agreements and work orders, with GC mode's three in PR 5. Not taken:
   accepted estimates as lines too.
2. **Staff papers on this page.** In. The four office roles already read them on People → Contracts, and
   a line shows the paper's name and state only. Not taken: off the list until the Staff and subs chip is
   pressed, or left on People alone.
3. **Who sees the tab.** The office's four roles, as with Sent copies. Not taken: the estimator too, with
   work orders only. He took the estimator on 2026-11-20, on card #403's call 8.
4. **One list or sections.** One list, newest first, with chips for kind and state. Not taken: a section
   per kind.
5. **The word.** The tab is Agreements, and Contract under a job stays. Not taken: Contracts.
6. **Drafts and voided.** Drafts out, and voided, declined and cancelled behind their own chip. Not
   taken: a Drafts chip.
7. **Signed contracts in Google Drive.** A card of its own after this one. Not taken: folding it into
   this train. That card is #377, `to-dos/signed-contracts-in-drive/README.md`.

## How to verify, once built

- The SQL bed of PR 2: as each role, the view answers only the kinds that role's tables allow, and a
  primary and a superintendent read no job contract.
- On prod with a ZZ Test job (`live-test` recipe): send a contract, see it under *Waiting on a
  signature* with the count one higher, sign it, see the chip turn, void it, see it leave the default
  list and show under *Voided or ended*. Find it by the job's number and by the customer's name.
- Open `/documents` as an estimator's sample account. Since card #403's call 8 (v2.8175) the Agreements tab
  shows, with the estimator's chips only and no press that acts.
- Hold the read to see the retry panel, and filter to nothing to see both empty states.
