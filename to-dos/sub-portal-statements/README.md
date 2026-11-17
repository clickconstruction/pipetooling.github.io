---
name: "The sub's page: a Statements view with their work statements, payment records and statement of account"
number: 371
group: ready
status: asked 2026-11-17 · the mock-up and this card the same day · the owner answered all seven calls 2026-11-17, each with the card's pick · step 1, the function, live 2026-11-17 (v2.7569): its migration pushed and `sub-portal` deployed on the owner's go · the list was drawn on made-up data in the sub labor spike and is not wired to the page
summary: >
  Card #350 gave the office three papers for a sub. A sub still cannot find them on their own page:
  the page shows open sheets and 90 days of payment lines, with no paid sheets, no numbers, no
  period and nothing tying one check's lines together. This card adds a Statements view to the
  sub's page, one tap from the page they know. It holds the statement of account to date, every
  work statement with paid ones too, and every payment as one record, each with the same PDF the
  office prints. A sub can mark a payment received or say a figure looks wrong. It was step 6 of
  card #350 and moves here with its own mock-up, because it puts papers in front of subs and has
  calls of its own.
next: step 2, the switch and the list, cut from the spike's snapshot and fitted to the page; the owner reads its Spanish words before they ship
size: M as a train of four (M · S · M · S); left: steps 2 to 4 (S · M · S)
blocker: the owner reads the Spanish words before step 2 ships them (call 5); Confirm waits on counsel and is not in this card
opinion: build it as a switch at the top, Today and Statements, so the page a sub knows does not change; never let the sub's page give out a number; ship Got it as a quiet chip and Something is wrong as the one thing that asks the office to act
mockup: to-dos/sub-portal-statements/mockup.html
---

# The sub's page: a Statements view (#371)

## The ask

The owner, 2026-11-17, at the end of card #350's build, when the portal tab was the one step not started:

> help me mock up The portal tab: not started. so we can add it to a punchlist card

It was step 6 of card #350 (*Sub papers*). Taunya picked that card on 2026-11-15 and kept the papers' names on 2026-11-16. This card is the same work, moved out with a mock-up of its own.

## What a sub sees today

Read on the code on 2026-11-17.

- **One page, not tabs.** `src/pages/SubPortal.tsx` draws one long page as a paper: *Work & pay statement*, the sub's name, *Owed to you* with its figure, then **Your jobs right now**, **New work for you**, **What you've been paid**, **Your paperwork on file** and **Your days**. Card #350's mock-up drew tabs the page does not have.
- **English and Spanish.** Every word is in `src/lib/subPortal/subPortalI18n.ts`, and the page has an Español switch. The file's own rule is reviewed copy.
- **Open sheets only.** A settled sheet leaves the page.
- **90 days of payments**, a line per sheet. One check over two sheets is two lines with nothing tying them. A line carries no method and no number.
- **Print prints the page.** There is no paper for one job, no period and no PDF of its own.
- **Whose sheets.** The page's function reads every sheet that names the sub (`people_labor_job_assignees`). The papers are for a sheet that is one person's alone (`sheetOwedTo`). A sheet two people share is on the page today and would not be on the Statements view.

## What it becomes

Mock-up: `to-dos/sub-portal-statements/mockup.html` (on the dev server at `/to-dos/sub-portal-statements/mockup.html`). Made-up names and amounts throughout.

**A switch at the top: Today and Statements.** *Today* is the page as it is. *Statements* is a second view of the same page.

- **Statement of account.** To date, live, with *Still open* and the last payment. **Save as PDF** and **Pick dates**.
- **Work statements.** Every sheet that is the sub's alone, open first, then paid. Each row has its number where the office has given one, what it comes to, what was paid, what is open, and **PDF**.
- **Payments.** One line for each check or transfer, newest first, with what went to each statement. **PDF**, and **Got it** until it is marked received.
- **The PDF** is the paper the office prints, from the same kernel, drawn in the sub's browser. A memo the office hid stays off. The amounts always show.
- **Got it** asks one question and records the answer the way a signed work order is recorded. **Something is wrong** sends the office a note about one statement or payment. Neither is a condition of being paid.
- **The office sees it back**: a chip on the payment's line in Jobs → Subs → Pay, and a flag when a sub says something is wrong.

**What the sub's page never does.**

- It never gives out a number. A number shows only where the office has made the paper. A statement of account a sub saves reads *Saved from your page* with the day and time.
- It never shows a paper that does not add up. The set is checked first, as on the office's window. A sub reads that the office is checking, with the office's phone number.
- It never shows another person's sheet, or a sheet two people share.
- It draws no **Confirm**. That press is behind `SUB_PAPER_CONFIRM_LIVE`, off, and waits on counsel.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The papers' model and check | `supabase/functions/_shared/subPapers.ts` (v2.7401) | reused |
| The PDFs | `_shared/subPapersPdf.ts` (v2.7401) | reused, drawn in the sub's browser |
| A sheet as the papers read it | `src/lib/subWorkOrders/subPapersInputs.ts`, client side | the same shape built in the function from the rows it already reads |
| Whose a sheet is | `sheetOwedTo` in `src/lib/subWorkOrders/teamSheetRule.ts`, with `sheetParties.ts` beside it. Client side only | the function needs the same rule, so the two kernels move under `supabase/functions/_shared/` and the client imports them from there, as `subPapers.ts` does |
| The numbers | `sub_papers`, `mint_sub_paper` (v2.7474, v2.7552), office only | the function reads a sheet's live number with the service key. It never mints |
| Where an answer is kept | `sub_paper_acks` (v2.7474): `received`, `confirmed`, `something_wrong`, with the revision seen. Nothing writes it | the function writes `received` and `something_wrong` |
| The page's function | `supabase/functions/sub-portal/index.ts`: open sheets, 90 days of payment lines, no method, no sending | a `papers` block: every sheet that is the sub's alone, paid ones too, each payment with its method, its reference, its sending and its number, a hidden memo left blank. Two actions for the answers |
| The list | `SubPortalStatementsTab.tsx` on the spike's snapshot (`claude/sub-labor-spike-82d6a9` at `7616bc399`), walked on made-up data, not wired | fitted to the page: the switch, the portal's own look (`src/lib/portal/portalTheme.ts`), both languages |
| The words | `subPortalI18n.ts`, English and Spanish | about twenty new strings, the Spanish read by a person first |
| The office's side | the payment's line in `JobsSubLaborTab.tsx` | a chip from `sub_paper_acks`, and a flag for *something wrong* |

A payment record's answer hung on a paper in the register (`sub_paper_acks.paper_id`). A payment whose record the office has not made has no row to hang on, and neither has a sheet whose work statement the office has not made. **Settled in step 1: the answer is kept on the thing itself.** Migration `20261117150000_sub_paper_ack_targets.sql` lets an answer name its sheet, its sending or its lone payment, and its person. Where the office has made the paper, the answer names that paper and the revision the sub saw as well. The other way, the function registering the page's own copy, was dropped: a work statement registered from the page would hold the place the office's first number goes, which is the page giving out a number (call 2).

## The plan

1. **The function** (M, an edge deploy of `sub-portal`). The `papers` block and the two actions, with a handler test and a kernel test for the sheets it builds. Nothing on the page reads it yet. Deployed only on Taunya's go that names it.
2. **The switch and the list** (S). `SubPortalStatementsTab` cut from the snapshot and fitted, the Today and Statements switch on `SubPortal.tsx`, the strings in both languages, the PDFs. A guide for the office (`see-what-a-sub-sees-on-their-portal` gains the view) and one for the sub's own start page.
3. **Got it and Something is wrong** (M). The two presses, their one-question sheets, the record, and the office's chip and flag.
4. **The walk** (S). On the test sub and its ZZ Test job only: a paper saved, a payment marked received, a note sent, in English and in Spanish, on a phone. Every row the walk makes is deleted and named.

## Where it stands

Step 1 is live since 2026-11-17 (v2.7569). The page a sub opens is unchanged until step 2 reads the new block.

- **The `papers` block.** `sub-portal` hands back every sheet that is the sub's alone, paid ones too, as the papers' kernel reads a sheet, with the letterhead, the answers already given and whether the set adds up. A set that does not add up hands back no figure. A failure in the block leaves the rest of the page as it is.
- **The two answers.** A `POST` with `action: 'got_it'` or `action: 'something_wrong'` writes one row of `sub_paper_acks`. A second *Got it* on one payment changes nothing.
- **A number is read, never given.** The block reads a sheet's live number and revision from `sub_papers` and says whether today's figures are the ones the office issued (`numbers[sheet].asIssued`). Step 2 prints a revision's number only on a paper whose figures are as issued. A sheet that changed since reads its number, the day of the office's copy and *Saved from your page*.
- **Whose a sheet is.** `sheetParties`, `teamSheetRule`, `rosterSub` and `laborJobPersonMatch` moved under `supabase/functions/_shared/`. Their old paths re-export them, so no screen's import changed.
- **Left out of step 1.** An earlier copy of a changed statement (the mock-up's *Copy of Oct 29*) is not handed over. A memo the office hid after that copy was made would still be in it, so it needs a rule of its own before a sub can open it.

**Pushed and deployed 2026-11-17**, on the owner's go that named `sub-portal`. The migration went up by `supabase db push --include-all` from a checkout at `origin/main`: the dry run named this one file, and two later stamps were already on prod. `sub-portal` was deployed from the same checkout, and the deployed copy reads byte for byte as main's, 41 files.

Checked live, with nothing written but one preview visit:

- The function boots, and the sample page's read answers as before.
- The new refusals answer: a sample page, an unknown link and an empty body.
- The test sub's page, read as an office preview, carries `papers` with the letterhead from Settings and the office's phone.

Not checked live: a person with sheets. The test sub has none today, so the sheets, the payments, the numbers and both answers were not exercised on prod. Every column the block reads was read through the dev seat and exists. Step 4's walk covers the rest on the test sub and a ZZ Test job.

## The calls

Each puts something in front of a sub, so each was Taunya's. **The owner answered all seven himself on 2026-11-17**, in the build session, each with the pick the mock-up draws.

1. **A switch, or one more section on the same page?** Pick: the switch. The other way is the mock-up's section 7. **Answered 2026-11-17: the switch at the top, Today and Statements.**
2. **Does the sub's page ever give out a number?** Pick: no. It shows a number the office gave, and a statement a sub saves takes none. **Answered 2026-11-17: never.**
3. **How far back?** Pick: every sheet and every payment, paid ones under open ones. The other way is the last 12 months. **Answered 2026-11-17: everything.**
4. **Got it and Something is wrong.** Pick: both. Got it is a quiet chip for the office. Something is wrong flags the sheet and tells the office. **Answered 2026-11-17: both.**
5. **Spanish.** Who reads the draft words before they go on the page? The PDFs stay in English for now. **Answered 2026-11-17: the owner reads them himself.** Step 2 hands him the draft strings, and none goes on the page before he has read it.
6. **Does the Statements view say *Still open* where the page says *Owed to you*?** Pick: yes, so the view and the papers use one word. *Today* keeps its words. **Answered 2026-11-17: yes, *Still open*.**
7. **Who is told a paper is there?** Pick: nobody, by itself. The office sends a paper when it wants a sub to look (card #350's Send). **Answered 2026-11-17: nobody, by itself.**

Not a call here: **Confirm** stays off until counsel has written what a confirm means (card #350, sentence 2).

## How to verify

- **Kernel tests carry the load:** the sheets the function builds give the same three papers the office's window gives for the same person, a hidden memo is blank, a shared sheet is left out, and a payment from before sendings is a record of its own.
- **A handler test** runs the function's own code with a recorded database: another sub's link reads nothing of this sub's, an answer is written once, and a second *Got it* changes nothing.
- **On a phone**, in both languages: the figure at the top is the same on Today and Statements, and equals the office's *Still open* for that sub.
- **Test rows:** the test sub and its ZZ Test job. Never a real sub's page.
- **Gotchas:** a sub with two portal links still has one set of papers. `payment_date` is a bare date and most old rows have none, so a line says *recorded* for those. The page's print styles (`data-screen-only`, `data-print-page`) are the Today view's, and the Statements view must not print as a list of buttons.
