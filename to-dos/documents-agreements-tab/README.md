---
name: "Documents: an Agreements tab, every agreement the app makes in one list"
number: 376
group: close
status: asked 2026-11-17 · the owner took all seven picks and said build the whole train the same day · all five built and live: the rules v2.7604, the view and the read v2.7612, the tab v2.7617, Search v2.7620, GC mode’s three kinds v2.7625 · both migrations pushed 2026-11-17 and 2026-11-18 · checked on the live list in a local build, in the live build’s files, and by role through the dev seat · asked again 2026-11-19 to finish the section so the office manages a paper there · a second train of three, all built: a waiting line acts where it sits v2.7932, send a paper from the tab v2.7937, the Contract library door v2.7938 · each walked in a dev preview, the sends on a ZZ Test person only · 2026-11-19 night: the first two things under What is left built on branches on four picks · 2026-11-20: each cut onto that day's main as its own PR, held for his calls and armed by him alone, the reminders v2.8013 first and the signer's copy in the PR on top of it · 2026-11-21: Taunya answered the calls on the reminders, all kept as built, and moved the company's own signature to card #412 · left: the owner’s own look, and the two held PRs to arm
summary: >
  The owner looked for agreements on the Documents page and found none. The page has ten tabs and
  none lists agreements. A job's signed paper shows only as a line under its job on the Jobs tab,
  which reads the newest 200 jobs and whose search does not match that line. Staff, sub and partner
  agreements and sub work orders are not on the page at all. This card adds an Agreements tab for the
  office: one list of every agreement, newest first, with chips for kind and state and a find box. A
  press opens the window that kind already has. The list is one database view over the tables that
  hold agreements, so each table's own row security decides what a reader sees, and nobody reads a
  paper here that they cannot read today. It renames nothing: Contract under a job stays.
next: The owner opens Documents → Agreements, presses Send a paper, Send again and Contract library, and types a name on the Search tab. Then the two held PRs are armed, the reminders first: Taunya answered their calls on 2026-11-21, and each row under What is left says its answer. No statement of work and no owner contract send exists yet, so a GC line is proven by the database test until one is sent. Call 7’s card is #377.
size: M as a train of five (S · M · M · S · S), then M as a second train of three (M · M · S)
blocker: None.
ver: v2.7604 · v2.7612 · v2.7617 · v2.7620 · v2.7625 · v2.7932 · v2.7937 · v2.7938
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

The first two are built. Each reached main only in a PR held for the owner's calls, which he armed himself: the reminders in v2.8013, and the signer's copy in v2.8016 in the PR after it. Taunya answered their calls on 2026-11-21, and each row says its answer. The other two are not built here: each moved to a card of its own, #403 and #412.

| What | Today | What it takes | Size |
|---|---|---|---|
| **Reminders by email** for a staff or sub paper | Only a prompt on the person's Dashboard. A job contract already gets three reminders, three days apart (`remind-job-contracts`) | **Built 2026-11-19, v2.8013.** Cut onto main on 2026-11-20 as a held PR from `claude/376-paper-reminders-on-main-6f46c1`. Migration `20261120133000_person_paper_reminders.sql`, pushed after the merge and before any function. Then `send-contract-for-signature` is deployed, then the new timed function `remind-person-papers`. An outside company's paper gets no reminder, and that stays so on Taunya's answer of 2026-11-21. The question comes back once card #403's train lands. Built on two picks. One: three reminders, three days apart, as a job contract gets. Two: the four roles that send a paper turn them off for one paper on its line, and one Settings switch for all, the owner's and a dev's, ships off. A paper sent while the switch is off is never reminded, so turning it on reaches no paper already out. Each reminder carries a new signing link and ends the one before it, since a link is kept only as a hash. The calls were how many, how far apart, and who may turn them off. Taunya's answer of 2026-11-21: keep each as built | M, built |
| **A copy to the signer, and a PDF of a plain paper** | Nobody is emailed once a person signs. A form makes a PDF. A paper of plain words or clauses makes none | **Built 2026-11-19, not on main.** Branch `claude/376-signer-copy`, v2.8016, on top of the reminders. Migration `20261120061000_person_paper_signed_copy.sql`, not pushed. `accept-contract` changed and a new `person-paper-pdf`, neither deployed. Built on two picks. Three: the office gets no copy by email, since the signed paper is on this tab and the signer's email is kept as a sent copy. Four: an old signed paper gets its PDF the first time someone opens it, and nobody is emailed about an old paper. An hours statement, a W-9 and a certificate are never emailed. His calls: whether the office gets a copy too, and whether old signed papers get a PDF | M, built |
| **An outside party as a record** | Moved to its own card, #403 | Card #403 weighs the options, picks one and lists the owner's calls | L |
| **The company's own signature** | Moved to its own card, #412, on Taunya's word of 2026-11-21 | Card #412 says what it takes and holds the two calls: who may sign, and whether every paper needs it or only some | M to L |

**The calls are answered (Taunya, 2026-11-21).** Each piece is a PR cut from main on 2026-11-20, and its first line names the calls and their answers. A PR is armed on a named go, the reminders first, when whoever pushes and deploys is at hand. Then, on prod and in this order: the migration is pushed, `send-contract-for-signature` is deployed, the other functions are deployed, and a types PR follows. The send reads the new columns, so it never goes before the push. The switch for reminders stays off until he turns it on. Neither piece has run yet: this Mac has no Deno, so the functions link but were never run. The walk emails only the mail service's test address, on a ZZ Test person.

Smaller things the tab still leaves to People, each S, none asked for yet:

- **Take a waiting paper back.** People deletes a paper that is not signed. The tab has no press for it.
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
- Open `/documents` as an estimator's sample account: no Agreements tab, and `?tab=agreements` lands on
  Estimates.
- Hold the read to see the retry panel, and filter to nothing to see both empty states.
