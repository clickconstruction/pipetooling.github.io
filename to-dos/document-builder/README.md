---
name: "Document builder: a tab on Documents where the Sub NDA and a job's insurance requirements are made, published and sent"
number: 404
group: ready
status: asked 2026-11-19 · the Sub NDA's step-by-step flow was built as a working spike the owner shaped in four rounds · the tab, a second builder and the send were then drawn, looked at as one design and drawn again · he approved it and asked for it to be saved so another person on another computer can build all of it · on main there is only this card and its clickable mock-up
summary: >
  One more tab on Documents, for a dev only for now. It holds builders. A builder makes one kind of paper.
  The first is the Sub NDA from #389: someone walks it and picks a level, page by page. The second is
  insurance requirements for subs: one sheet for each job the company runs as the GC, with the company's
  name on it and that job's owner as additional insured. In both you press the words on the document and
  type, publish a numbered revision, and send it with the same send. A GC or a trade gets an email, finds
  it on the page they already open, or opens it by link. The office sees the day it went and the day it
  was opened. When a trade's certificate comes in, the sheet's own lines are the check list. No attorney
  has read the Sub NDA's words and no insurance agent has set the sheet's amounts: every word is a placeholder.
next: Step 5, the send to a job's trades. Steps 1 to 4 are built (v2.7980, v2.7988, v2.8005, v2.8007, v2.8008), and step 5's table is in the database.
size: L as a train of ten (S · M · M · S · M · M · M · S · S · M)
blocker: None for the build. An attorney's read of the Sub NDA's words and an insurance agent's read of the sheet come before either is sent to a real GC or a real trade.
---

# Document builder (#404)

This card is written for someone who was not in the room. Everything needed is here, in
[mockup.html](mockup.html), and on one branch. Nothing else exists: no notes elsewhere, no file on
anyone's computer.

**The mock-up works.** One state drives its five drawn screens, so a press on one shows on the others.
Open it and press things before reading on. It is the reference for every state and every word.

**The spike's code is on branch `spike/document-builder`**, pushed and not meant to merge. It is the
Sub NDA's step-by-step flow, working in the app on made-up data:

| File | What it is |
|---|---|
| `src/lib/paperBuilder/paperBuilder.ts` | The rules, pure. Levels, topics, the basis, what is off it, the breach lines split into new and carried, the site lines, a level's facts, the steps and which are shut. It names nothing after secrecy. |
| `src/lib/paperBuilder/paperBuilder.test.ts` | 38 tests on those rules, with a second made-up paper to prove the kernel is not about NDAs. |
| `src/lib/paperBuilder/secrecyPaper.fixture.ts` | The contents, one `PaperDef`: four levels, seven topics, every placeholder line. Made to be swapped whole. |
| `src/components/paperBuilder/PaperFlow.tsx` | The eleven steps in one frame. State in memory. |
| `src/components/paperBuilder/PaperLevelSlider.tsx`, `levelTone.ts` | The slider, the level chips and colours. |
| `src/components/paperBuilder/PaperFlow.render.test.tsx` | 9 render tests on the wiring. |
| `src/pages/PaperBuilderSpike.tsx` | The page, open to the `dev` role only. |
| `src/App.tsx`, `src/index.css` | One lazy route, `/paper-builder`, and the slider's CSS. |

To run it: check the branch out, `npm install`, `npm run dev`, sign in as a dev, open `/paper-builder`.
No link in the app opens it. It reads and writes nothing in the database.

**Only the Sub NDA's flow is built.** The tab, the editing, the send, the link, the insurance builder
and the certificate check exist as the mock-up and this card, and nowhere else.

## Not legal advice, not insurance advice, and no legal text here

- No attorney has read any wording for the Sub NDA. No insurance agent has set any amount or wording
  for the sheet.
- This card, the mock-up, the spike and every test, fixture, doc and release note the build writes
  carry **made-up names and placeholder words only**. Never a real company, person, address or amount.
- **No clause wording goes in the repo.** A clause is drawn as grey bars. The plain words beside a
  clause (what a level means, what puts a person in breach, what the site must have) are placeholders
  and are marked so on the page. Real wording goes into the app by hand, into the database, after it
  has been read.
- The insurance sheet's sample came from another company. **None of its wording or names is in the
  repo, and none may be added.** The sheet's words in the mock-up were written for the drawing.
- Do not tell the owner what amounts to require, and do not build a default that reads as advice.
  The amounts in the mock-up are placeholders and say so.

## The ask, in the owner's words

All on 2026-11-19. Typing is kept as he wrote it.

Where the Sub NDA builder lives:

> I've decided how we are going to use this NDA builder, How it is going to be offered in the app and
> where we can park it for now
>
> Inside of the documents page, I would like to add a document builder tab where this exists where
> Where a dev can make edits to it where a dev c can share a link to it and a dev can choose what GCs to
> expose it to.
>
> Because this is the kind of tool that may only be used once, at the moment it's going to be dev only.
> But long term, in the document builder section of documents, we are going to add other things like
> insurance requirements for subcontractors that we hand out on a job-to-job basis.

The second builder, with a one-page sample from another company attached:

> So when it comes to the documents builder, that is definitely one of the documents that is the most
> complex because it takes in information from a GC and then has a pipeline that it has to adhere to.
> Can we take a look at this other document that I may need to build, These are insurance requirements
> for jobs that we would give to our subcontractors, and they would have our name on it and the property
> as an additionally insured. The purpose is for it to be easy for a subcontractor of ours to be able to
> know w what they need to fill out or maybe they hand this to their insurance and their insurance does
> it. Because we're going to be building these for each individual job that we GC, the insurance
> requirements are going to change even though our name will stay the same, and the person who they need
> to additionally insure is going to change. I've attached a sample of what another company has that I'd
> like for ours to look like.

> In the insurance requirements for subs, I'm going to want each of those fields editable.

Asked whether a job may change the company's own name and the title too: "Yes, any field".

The send:

> Have we already thought through the flow of adding a document in here to a GC portal in the sense
> that we would send the GC a document and they'd be able to access it via link or see it in their G C
> portal?

Told it was only partly thought through: "Yes, draw it".

The whole design:

> Awesome, now look at what you're proposing Across the two documents and workflows. holistically, and
> let me know if this is the best we can do?

Told it was not, with five faults named: "Yes, all five".

Saving it:

> Can you save it all to a punch list card so another session can build all of it?

> That session will be a different user on a different computer.

## How this card sits beside #389

[#389](../sub-nda-builder/README.md) is the Sub NDA builder itself: the idea, the four levels, the
seven topics, the step-by-step flow, and a longer train that ends with a job requiring the paper its
settings make. **This card is where that builder is parked and offered for now**, apart from any job,
plus a second builder and the parts both share.

- This card's steps do **not** touch a job's gate, the Contract Book or `job_required_papers`.
- #389's own train (the Contract Book takes settings, then a job requires the paper) is untouched and
  comes later. Its step 4, the office's settings page on a job, would reuse this flow.
- #389's `mockup.html` is its own drawing of the flow and the wider screens. Where it and the spike
  differ on the flow, **the spike is newer**: the owner shaped it after that drawing. The same holds
  for the contents: where #389's drawing and the spike's fixture differ, the fixture is newer.
- #389's *Points for an attorney* holds three questions that belong to this flow: what *aligned with
  military bases and defense plants* promises (12), what the disclaimer must say and whether a tick
  makes it hold (13), and what a rule nobody enforces does to the rest of the paper (14).

## The idea, in one line

A builder has a part that stays the same and a part that changes for one job or one GC, and in both
you see what differs from the usual and the way back.

That one idea shows three times: the Sub NDA's **basis** and the pages moved off it, the insurance
sheet's **standing sheet** and the fields a job changed, and a **published revision** against the
changes not yet published.

## The two kinds of builder

Insurance requirements do not fit levels and topics. So the tab holds two kinds.

| | Sub NDA | Insurance requirements for subs |
|---|---|---|
| Kind | **Walked.** Someone picks a level, page by page. | **Filled.** One page with blanks, and each job fills them. |
| Who it goes to | A GC | A job's trades, and through them their insurance agent |
| The part that stays | Four levels, seven topics, the words on each | The standing sheet: the company's name, the opening words, the usual coverage |
| The part that changes | The basis, and any page moved off it | Who must be named, the place, and any amount that differs on this job |
| How often | Rarely. The owner said it may be used once. | For every job the company runs as the GC |

What they share: the tab, typing on the document itself, **Publish** with numbered revisions, the mark
that someone read a revision, the link, and the send.

## What the owner approved, screen by screen

The mock-up's section numbers are in brackets.

### The tab [1]

- **Document builder** is the last tab on Documents. Only the `dev` role sees it.
- It lists the builders, one row each, with chips that say where each stands and an **Open** press.
- No **New builder** press. A new kind is added in code.

### The Sub NDA's flow, as built in the spike

Eleven steps in one frame of one height, so the slider stays put while the page above it changes.

1. **Before you start.** Three plain lines: not legal advice, use it with your own attorney present,
   experimental. They are his three points, put into short sentences. A box, *I have read this.*, must
   be ticked before any later step opens. The box was the session's addition, which he saw and did not
   object to. The minute it was ticked is kept.
2. **The basis.** The level the paper should express. Four rows, each a level with its line: *Aligned
   with regular businesses*, *Aligned with hospitals, banks and government buildings*, *Aligned with
   military bases and defense plants*, *Aligned with private research labs*. The slider sets the same
   thing. Above the slider, four facts for the picked level change in place as it moves: *Secrecy
   lasts*, *Time to return files*, *Time to report a leak*, *The site must have*. *Off* on this slider
   means no paper, and *Next* then skips to *Review*.
3. **Match the paper to the site.** His note on real site conditions, and what the basis asks of the
   site. **Its last two lines are not his words.** His note stopped mid-sentence, after "active
   perimeter enforcment staff". The lines *A rule nobody enforces protects nothing. It also puts people
   in breach of a rule they cannot follow.* and *Ask your attorney what an unenforced rule does to the
   paper.* are the session's ending. He was asked whether that was the point he meant and has not
   answered.
4. to 10. **One page a topic.** In this order on the page: one line of what the level means, then
   *What puts a person in breach*, then *What the site must have*, then *The core clause* as one thin
   strip of grey bars. The slider is at the bottom and the page changes while the handle is dragged.
   - The breach lines are in two groups. On top, one chip, *New at Elevated*, and the lines this level
     brings. Under a rule, *Also applies*, in grey: the lines the level one step looser has too. A line
     the level replaced is in neither, since it no longer applies.
   - The basis is marked on the slider: a ring on the track and the word *Basis* under that stop. A
     press on that stop is the way back. There is no line of words saying a page is off the basis.
   - Three topics are in every paper and have no *Off*: how long secrecy lasts, files at the end,
     reporting a leak.
11. **Review.** Each topic is a row with a small track: a dot at its level against a tick at the basis.
    A press on a row opens that topic. Under them, *What this site must have*, for the paper as it now
    stands.

The step bar is the paper's shape: each topic's dash takes its level's colour, the basis dash takes
the basis's, and the current dash is taller.

Motion: the handle glides and rests on its stop. A line that stays slides to its new place, and a new
one eases in. Nothing moves when the person asks for less motion.

### The Sub NDA, open in the tab [2]

- Two sides. On the right, **what a GC sees**: the flow. On the left, **Edit** or **Share**.
- **You type on the GC's view itself.** Every piece of words on it is a field. A line can be added or
  taken off. A field that differs from the published revision is marked.
- **Edit** holds the map: a row a topic, a column a level, 28 cells. A press on a cell opens that page
  at that level on the right. At desktop width a cell shows its words, since reading across a row is
  its use. On a phone the map is 28 small squares. Nobody types in the map.
- Under the map: the pages changed since the published revision, each with **Open it** and **Back to
  revision 2**.
- **Publish revision 3** makes the changes what everyone outside sees. Until then they see revision 2.
- **Marks are on** switches the marks off, to read it as a GC does.

### Insurance requirements for subs, open in the tab [4]

- **The sheet is the editor.** One page, laid out in the order of the sample: the company's name and
  address, the title, a line saying which job, the opening words, a box saying who the certificate
  must name and for work where, the certificate holder, a table of coverage beside its least amount,
  and a line at the foot.
- **Every piece of words on it is a field.** Its mark says where the words come from: **your usual**,
  **filled from the job**, or **changed for this job**.
- **This job** and **The standing sheet** are the same sheet. In *The standing sheet* you change the
  usual for every job, and the job's blanks show as blanks.
- On a job, the left side lists what differs, each with **Back to the usual** and **Make this the
  usual**. A coverage line can be left off one job or added for one job.
- Any field can be changed on any job, the company's own name included. That is the owner's call.
- In *The standing sheet* the press reads **Publish to 3 jobs**. The left side names each job that
  gets the change and each job it holds: a job with no sheet yet, or with changes of its own waiting.
- The sheet has its own link, and **Print the sheet**.

### The send, the same in both [2, 3, 4, 5]

One row for each GC, or each trade on the job.

- **Send it to them** opens a box under the row: who it goes to, a note, and for a GC which job it is
  about, or *All their jobs with you*. The press names the person: **Send to Dana Whitlock**.
- After it: *Sent Nov 20 to Dana Whitlock*, then *Opened Nov 21* or *Not opened yet*. Then **Send it
  again** and **Take it off their page**.
- **One press for everyone who is ready**: *Send to 2 trades who are ready*. Under it the page names
  who it held and why.
- Someone with **no page yet**: the row says so, and sending to them alone makes one.
- Someone whose **page was turned off**: the row says so and the send is dead. **Turn their page on**
  is its own press. A send never turns a page back on.
- After a new revision, someone who opened the old one reads *Changed since they opened it*, with
  **Tell them it changed**. Publishing emails nobody by itself.
- They get an email with the note and one press. It is also on the page they already open: a GC's
  under the job it is about, a trade's beside *Your certificate of insurance*.
- The **link** is a second way in, for someone with no page of their own. It can be switched off, and
  a new link stops the old one.
- Each send is kept under **Sent copies** on Documents.

### A certificate, checked against the sheet [4]

- A trade's row also says where its certificate stands: none yet, came in, or good until a day.
- **Check it against the sheet** puts the certificate beside what the sheet asks, one line to tick
  each: each name, the place, the certificate holder, each coverage with its amount.
- **Mark it good** needs every line ticked and the day it is good until. **Send it back, naming 2
  things missing** sends the unticked lines back in words.
- A certificate is **outdated** when a name, the place or an amount on the job's published sheet
  changes. Not when the other words change.

### The mark that someone read it [2, 4]

- *Not read by an attorney* and *Not checked by your insurance agent* are presses, not labels.
- The press asks who read it, and records the name, the day and the revision.
- A new revision is unread again.
- A send shows a warning with a box to tick, *Send it anyway*, until the revision is read.
- On the insurance side the mark is on the usual. A job that differs from a checked usual says how
  many things differ.

## The rules, and the tests they need

Kernels first, each pure with its tests. The spike's kernel already holds the first group.

**In the spike, tested (`paperBuilder.ts`):** a level's place and name · a topic's floor · what a level
means on a topic · the breach lines split into what a level brings and what it keeps · what the site
must have, for a level and for the paper as it stands · a level's facts · the basis, and that picking
one sets every page back · a level becomes the basis once every page is on it · which step is shut ·
what *Next* and *Back* open when the paper is off · every placeholder line passes the plain-words rules.

**New, to write:**

| Kernel | What it decides |
|---|---|
| A field | What a document says in one place: its own words when it has any, else its base. What differs, as a list with the base's words. A job keeps only the fields that differ. |
| A revision | What differs between a draft and its published copy, page by page or field by field. What *Publish* will change. |
| The read mark | Whether a revision is read, by whom and when. That a new revision is unread. |
| The send | A recipient's state: not sent, sent, opened, changed since they opened it. The batch: its count, who is ready, who is held and why. A page that is off is never ready. |
| A job's sheet | The standing sheet laid over a job. What is missing before it can be published. |
| The usual's publish | Which jobs get a change to the usual and which are held, with the reason. |
| The asks | A published sheet as the lines a certificate is checked against. That a certificate is outdated when they differ from the ones it was checked against. |

A batch follows the repo's rule: it acts on what is ready, lists what it held with the reason, keeps
going past a row that fails, and its press says its count (`batchWords`, `countedLabel`).

## What is pretend, and what the build makes real

| In the mock-up or the spike | In the build |
|---|---|
| One made-up job, GC and set of trades, in the page's own script | The app's jobs, customers, GC projects and trade partners |
| The Sub NDA's contents in a fixture file | A row in the database, with a draft and a published copy |
| State in memory | Saved, with who and when |
| The email, drawn as a card | The app's own email path |
| *Opened* set by a press on the drawn page | Set when their page or the link really opens it |
| A certificate drawn as grey bars | The file the trade uploaded on their page |
| The review's press, which requires nothing | Out of scope here: that is #389's train |

## Where it plugs in

Read in the code on 2026-11-19. Check each again on the day.

- **Documents tabs.** `src/pages/Documents.tsx` draws the tab row. `src/lib/documentsPageTab.ts` parses
  `?tab=`, and `shownDocumentsPageTab` is where a role without a tab is shown another. A tab's own
  component lives in `src/components/documents/`.
- **A GC's page is the customer portal.** `/portal` and `/p/:slug` (`src/pages/CustomerPortal.tsx`),
  answered by `supabase/functions/customer-portal/index.ts`. A link is a `customer_portal_links` row
  with an `audience` of the customer's own jobs, the jobs they are the GC on, or both. Jobs are found
  by `jobs_ledger.gc_customer_id`. It already lists agreements, bills, waivers and test reports.
- **A page is made by a press**, `mint_customer_portal_link`
  (`src/components/customers/CustomerPortalGlobeButton.tsx`). That code never re-mints a page that was
  turned off, and never mints one for a customer nobody shared with. The send keeps both rules.
  `src/hooks/useGcPortalLinks.ts` reads the links for a set of GC customers.
- **A GC's presses** go through `supabase/functions/submit-portal-request/index.ts` as kinds.
- **Jobs the company runs as the GC** are GC mode's: `gc_projects`, a row a `projects` row, with
  `property_owner_customer_id`. Trade partners are `gc_companies`.
- **The certificate pipeline already exists.** `gc_paper_sends` records an ask for a paper, `insurance`
  among them. `src/lib/gc/paperSend.ts` and `paperEmail.ts` write the ask and its reminder. A trade
  uploads from its own page: `src/lib/portal/pageWords.ts` holds `PAPER_WORDS.coi`, in English and
  Spanish. `src/lib/gc/companyPapers.ts` reads a company's certificate and the day it runs out from
  `person_contract_documents`. **A certificate is kept for a company today, not for a job.**
- **Sent copies.** `sent_documents`, drawn on Documents → Sent copies.
- **Printing** goes through `src/lib/printRoot.ts`.

## The plan

Ten steps in three groups. Each is one PR with its release note and fragment, and is useful by
itself. **Insurance comes before the rest of the Sub NDA**: every job needs a sheet, and the send is
then built once where it is used most.

| # | Step | What a person can do after it | Size | Waits on |
|---|---|---|---|---|
| | **Both builders** | | | |
| 1 | The tab, with the spike in it | A dev opens Documents, presses *Document builder*, opens *Sub NDA* and walks the flow on the made-up job. `/paper-builder` goes away. | S | Nothing |
| 2 | A builder's contents move into the database | Nothing new to see. A builder's standing part is saved, with a draft, a published copy, a revision and who read it. | M | 1 |
| | **Insurance requirements for subs** | | | |
| 3 | The standing sheet and a job's sheet | Type on the standing sheet, then on a job's. See what differs, with the way back. *Publish to 3 jobs*. Mark the agent's check. Print. | M | 2 |
| 4 | The sheet's link | A published sheet opens by link with no login. | S | 3 |
| 5 | The send, built once, to a job's trades | The row, the box, *Opened*, *Tell them it changed*, the one press. A trade's own page says what the certificate must name, with *Open the sheet*. | M | 4 |
| 6 | A certificate for each job, checked against the sheet | The check list, *Mark it good*, *Send it back*. A changed name or amount marks the certificates it outdates. | M | 5, and the owner's call |
| | **Sub NDA** | | | |
| 7 | Edit on the GC's view, and Publish | Press the words and type. The map shows what changed, with the way back. *Publish* makes a revision, and the attorney's read is marked on it. | M | 2 |
| 8 | The link | Switch it on, copy it, make a new one. Anyone with it walks the published builder. Look only. | S | 4 and 7 |
| 9 | Send it to a GC | Step 5's send, pointed at GCs, with the job it is about. It is on their page, under that job. | S | 5 and 8 |
| 10 | Send their picks | A GC's last step reads *Send these picks*. They land under *Picks sent to you*, and in **Needs you**. | S to M | 9, and the owner's call |

Later, and not part of this train: a row for each job (its sheet, its secrecy paper, each trade's
standing), and #389's own train.

### For each step

**Step 1.** No migration.
- `documentsPageTab.ts` gains `builder`. `shownDocumentsPageTab` shows it to a dev only. Add the tab's
  press to `Documents.tsx`, last in the row.
- A small registry lists the builders. Today that is one.
- Bring the spike's files across from `spike/document-builder`. **Rename them to the owner's name for
  it**: `paperBuilder` becomes `documentBuilder` in folders, files and identifiers. The kernel's own
  word for one thing built from settings can stay *paper*.
- Remove the `/paper-builder` route and `PaperBuilderSpike.tsx`. The flow opens inside the tab.
- The frame's height: the page measures where the frame starts and ends it at the bottom of the
  screen. Keep that, since the slider must stay in reach on a phone.
- Docs: `docs/DOCUMENTS_PAGE_ARCHITECTURE.md`, `docs/GLOSSARY.md`, `docs/ACCESS_CONTROL.md`, and a
  help guide for devs. `docs/twins/APP_DIRECTORY.md` needs no line, since no page is added.

**Step 2.** A migration alone, pushed before any client reads it.
- `document_builders`: a row a builder, its kind (walked or filled), a draft, a published copy, a
  revision, who published and when, and who read which revision.
- Read and written by a dev only. Start it with the lock timeout and end it with the four fence calls
  (`CLAUDE.md`).
- A kernel checks a definition before it is saved: every topic has every level, and every line
  passes the plain-words rules.
- The first draft is loaded from the fixture by a press in the app. The migration writes no words.

**Step 3.**
- `document_builder_sheets`: a builder and a project, the job's blanks and its own fields as a draft
  and a published copy, and the usual's revision it was published on.
- The blanks start from the job: `gc_projects.property_owner_customer_id` and the project's address.
  The company's name comes from its own settings, as the portal's letterhead does.
- A field is a text box drawn as the sheet's own words. Plain text only.
- The press that publishes the usual is a batch.

**Step 4.** An edge function answers a published sheet for a link's token, and refuses one that is
off. A public page outside the app's frame, light, with no login. Keep only the token's hash. Add the
function's section to `docs/EDGE_FUNCTIONS.md`. Step 8 reuses the function and the page's frame.

**Step 5.**
- `document_builder_sends`: the builder or the sheet, who it went to, the contact, the job it is
  about, the day it went, the day and the revision they opened.
- The email is the insurance ask `paperEmail.ts` already writes, with the link added.
- The trade portal's answer gains each job's published sheet. `PAPER_WORDS.coi` gains its line and
  its press, in both languages.
- A send makes a page for someone who never had one, never turns one back on, and writes a sent copy.

**Step 6.**
- A certificate's row in `person_contract_documents` gains the project it is for and the asks it was
  checked against.
- `companyPapers.ts` reads a company's certificate for a job. The start gate keeps reading the
  company's own certificate until this lands.

**Steps 7 to 10.**
- Step 7 turns the flow's words into fields and adds the map. No clause wording is typed here: the
  clause stays grey bars, and its wording stays in the Contract Book.
- Step 9 adds only the customer portal's block, placed by job.
- Step 10 is a new kind on `submit-portal-request` that writes the picks and nothing else.

## Decided by the owner, 2026-11-19

1. The builders live in a **Document builder** tab on Documents, **for a dev only for now**.
2. There a dev can edit a builder, share a link to it, and choose which GCs see it.
3. The second builder is **insurance requirements for subs**: one sheet for each job the company runs
   as the GC, with the company's name on it and that job's property as additional insured, laid out
   like the sample.
4. **Every field** on the insurance sheet is editable. Asked whether a job may change the company's
   own name and the title too: "Yes, any field".
5. A GC is **sent** a document. They open it by link, or see it on their own page.
6. The five faults of the first drawing are fixed as drawn: one send, one way to edit, one press for
   the usual, the certificate check, and marks that have a way out. "Yes, all five".
7. In the Sub NDA's flow: the breach lines show what also applies from the level below, in grey,
   under a title. The five changes of the spike's second round. What each level does, on *The basis*.

The four levels, their names, their places and the words *aligned with* were settled before this card
and are in #389.

## Calls still open, each with its default

The build can start on the defaults. Each can be flipped.

| Call | The default | Why |
|---|---|---|
| Which builder is built first | Insurance | Every job the company runs as the GC needs a sheet. The Sub NDA may be used once. |
| A certificate for each job, or one for each company | One for each job | The additional insured changes with the job. The owner should ask his agent whether one certificate can cover several jobs. |
| Who fills a job's sheet | A dev, while the tab is dev only | Making a sheet for each job is office work. Opening the tab to the office is the next call. |
| Sending something nobody has read | A box to tick, *Send it anyway* | A hard stop would block a send to a test customer while the words are still being set. Make it a hard stop for a real customer once the office can send. |
| What outdates a certificate | A change to a name, the place or an amount | A fix to the foot line would otherwise send every trade back to their agent. |
| *Make this the usual*, pressed on a job | Keep it | It moves a job's own words onto the standing sheet. |
| Which jobs get a sheet | Only jobs the company runs as the GC | That is where the company sets what its subs carry. |
| The sheet in Spanish | English only | An insurance agent reads it. The words around it on a sub's page stay in both. |
| What a send to a GC is about, when nobody picks | All their jobs | The builder is not about one job. |
| What a GC can do with the Sub NDA at first | Look only | Sending picks is step 10. |
| What a GC reads as its name | *Secrecy on your jobs* | *Sub NDA* is the owner's word for it. |
| What counts as secret, and what happens after a breach | The same in every paper, as #389 has them | #389's session suggests both could move with the level. Today everything about the job is secret, including that it exists, which is heavy for *Standard* and cannot hold on a public job. This is that session's suggestion and not the owner's call. Publicity, a sub's business answering for its people, and what the paper never stops stay the same in every paper, and the last must. |

The spike made these guesses in the flow. None was overruled, and none was confirmed in words:

- A page off the basis reads *Standard, 1 page off it*. There is no *Custom mix* tag.
- A level becomes the basis once every page has been moved onto it.
- The review's press requires nothing of anyone.
- The first three facts on *The basis* come from the three topics that are a number. The four topics
  that are a rule have no fact. A grid of levels by topics would be the place for them, and #389's
  session has drawn one in its own mock-up: all 28 boxes, for the read named under *Where it is still
  weak*. It was not on `main` when this card was written.

## Where it is still weak

- **The Sub NDA's contents were never read box by box.** What each level means, the breach lines and
  the site lines, for seven topics at four levels, were written in one pass as placeholders. The owner
  has not gone through them one by one. That read comes before any wording goes to an attorney.
- **The tab is sorted by builder, and the work is sorted by job.** Both documents end at what a sub
  owes on one job. A row for each job would be the truer home later.
- **Each builder mixes setting it up with using it.** Splitting the two is what lets the office in.
- **The check list is ticked by hand.** Reading the certificate would be a later step.
- ***Opened* means their page or the link was opened.** It does not say the right person read it.
- **The send is an email only.**
- **A field is plain words.** A logo at the top of the sheet would be one more field.
- **A finished paper for a GC is not drawn.** What goes to a GC here is the builder, a thing to walk.

## How the design got here

So the same turns are not taken twice.

1. The flow's topic page first led with the clause's grey bars. On a phone, at the strictest level,
   none of the breach list was on screen. The breach list now leads.
2. A line of words said a page was off the basis, and it pushed the page down mid-drag. The basis is
   now on the slider.
3. The Sub NDA was first edited in a form beside the GC's view, and the insurance sheet in a form
   beside the sheet. With every field editable the form grew as long as the page. Both are now typed
   on the document.
4. GCs were first ticked in a list, which told nobody. Trades first had one press and a list, with no
   *Opened* and no case for a trade with no page. Both now use one send.
5. A change to the usual first needed each job published again by hand.
6. A certificate was first marked outdated by any new revision. It is now only a change to what the
   sheet asks.
7. A level's facts on *The basis* were first drawn inside the picked row, and slid under the fold on
   a phone. They now sit above the slider.

## How to verify

- **Step 1.** The spike's 47 tests pass after the rename. Signed in as a dev: Documents shows the tab,
  the flow walks from the disclaimer to *Review*, and `/paper-builder` is gone. Signed in as any other
  role: no tab, and `?tab=builder` lands on the page's opening tab. Check at desktop and phone width,
  in light and dark.
- **Steps 2 and 3.** A pg bed as each role: only a dev reads or writes. On prod as a dev, with a ZZ
  Test project only: fill a job's sheet, publish it, change the usual, and see the job held or
  published as the mock-up shows.
- **Steps 4, 5, 8 and 9.** A test customer or a test trade only. A page that is off stays off after a
  send. A link that is off answers that it is off.
- **Step 6.** A certificate checked against a sheet stays good after a change to the foot line, and
  is marked outdated after a change to an amount.
- **Every step.** Made-up names in every test, fixture and screenshot. The Browser pane runs against
  prod, so press nothing that writes to a real customer.

## How the mock-up is made

- One file, no build. One state for the Sub NDA (`S`), one for insurance (`I`, `STD`, `JOBS`), and
  three shared functions: `field`, `readChip` with `readForm`, and `sendList`.
- `?theme=dark` opens it dark. The GC's view, the sheet and every customer page stay light.
- Under about 900 px the two sides stack. Under about 700 px the Sub NDA's grid gives way to the small
  map.
- Its last two sections are the critique and the plan as the owner read them. This card holds the
  same, in more detail.

## Where it stands

The owner approved the design on 2026-11-19 and asked for it to be saved so another person can build all
of it. The same day he said to build it.

| Step | State |
|---|---|
| 1 · The tab, with the spike in it | **Built**, v2.7980. A dev opens Documents → Document builder → Sub NDA and walks the flow on the made-up job. The spike's files came across by path, renamed. The branch `spike/document-builder` is not merged and stays as it is. |
| 2 · A builder's contents move into the database | **Built**, v2.7988 (the tables) and v2.8005 (the tab). The tab reads `document_builders`, a builder with no row offers **Load the first draft**, and the Sub NDA's flow runs on the row's draft. v2.7988 also laid the tables steps 3 to 5 need, in a second migration: `document_builder_sheets`, `document_builder_links`, `document_builder_sends`. |
| 3 · The standing sheet and a job's sheet | **Built**, v2.8007. A second builder, **Insurance requirements for subs**: the usual sheet and one sheet a job, typed on in place, a job holding only what differs, and a publish of the usual that goes to each job that is ready and names the ones it held. Every amount is the placeholder *An amount*. Nothing leaves the building yet. |
| 4 · The sheet's link | **Built**, v2.8008. A published sheet has one live link, `/d/<code>`, that opens it with no login, made, copied, replaced and switched off from a card on the sheet. Only the code's hash is kept. The function is `document-builder-link`. Nothing is sent: a person copies the link. |
| 5 to 10 | Not built. |

One thing step 1 changed from the spike: the frame's height. Inside the tab on a phone the tab row
pushed the frame down and the **Next** press under the fold, so the frame is now sized to the screen from
the builder's own top there, and the builder scrolls itself to the top once (`frame.ts`). On a computer
it still ends at the bottom of the screen, as the spike had it.
