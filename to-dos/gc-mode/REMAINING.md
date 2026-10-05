# GC mode: what is left to build (the big list)

Written 2026-10-03 by the Board lane at the owner's ask, from the plan (`README.md`), the lanes'
messages and what the Board lane found. **Each lane owns its section below. Work down your section
in order, and test along the way.** The owner's words: "work down that list testing along the way."

**The Board lane (GC 0) drives the list** (the owner, 2026-10-03): it checks in with each lane,
answers questions about the code, the files and the rules, and takes the owner's decisions to him and
brings back his words. Ask GC 0 when you are stuck.

Lanes: **Board** (GC 0, port 5237) · **Building** (GC 1, 5242) · **New Project** (GC 2, 5243) ·
**Portal** (GC 3, 5241) · **Owner Billing** (GC 4, 5244). *Owner* means a decision only the owner
makes; nobody builds it until he answers.

## How to work your section

1. Take the next open item in your section. Start with `git fetch origin && git merge origin/spike/gc-mode`
   (the Board lane: `git pull`), as *Working in parallel* in `README.md` says.
2. Build it in your own files. In a shared file, only add.
3. **Test it before you share it:**
   - `npm run typecheck`
   - `npx vitest run src/lib/gcMode`: the golden test must pass without `-u`.
   - Look at it in the prototype on your port, at a desk width and a phone width.
   - A walkthrough stop or help words: plain words (`plainWordsFailures` in `src/lib/plainWords.ts`).
4. **A golden snapshot that moves is a behavior change.** Stop, name the steps that move and what
   they say, and get the owner's OK before you write them (`-u -t "<step>"`, those steps only). Ask
   in your own session, or send it to GC 0, who asks the owner and sends back his exact words; your
   session's own rules decide whether a relayed OK is enough. A new action adds a step at the end.
5. Share: commit your files by name, merge `origin/spike/gc-mode`, test again, push. A push counts
   only when `git merge-base --is-ancestor <your commit> origin/spike/gc-mode` says so; the
   "spike/gc-mode -> spike/gc-mode" line also prints on a rejected push.
6. Mark the item here: `~~the item~~ done <commit>`, one line. Add a line to `README.md`'s
   *What the prototype has* when a screen changes. Tell a lane whose file or words you touched.
7. An item that needs the owner first: ask him (or GC 0), then leave it until he answers. Take the
   next one. When your section is done, tell GC 0.

## Board (GC 0)

**Done 2026-10-03: items 1-10.** Item 11 (the ring) built too, on the owner's yes. The owner gave the Board lane a standing OK (2026-10-03): it commits, moves its own golden snapshots, shares and tells the lanes without asking him, naming every move in the commit.


1. ~~**A "Money" board tab.**~~ done 0ecca9192. Place the Owner Billing lane's `GcOwnerBillingMoney` (built; the owner
   approved it) after Trade partners: `BoardTab` gets `'money'`, `onOpenBill` opens the project on
   Bill the owner. A Screens row in `README.md`.
2. ~~**The company window shows "waiting on the architect" and "certified, not paid"**~~ done a900e11dc (under They owe us now) from
   `ownerAccount` (`waitingOnArchitect`, `certifiedUnpaid`).
3. ~~**Compare bids and Trades read what trades send now:**~~ done 54bfc2a63 (shown, not counted: question 14 stays the owner's) alternates, an attached quote, and how
   many days the number holds (question 14's built half).
4. ~~**Spec sections on the Plans tab:**~~ done (set cards list "Sections revised"; a line tied to a revised section is named; 0ac0cd4be) each set card lists `set.changedSpecs` beside its sheets,
   and the "what changed" words (`staleWords`) name a revised section.
5. ~~**A line's sheets beside it in Compare bids**~~ done ("E-301?" when matched from its words, "the electrical sheets as a whole" when it names none; 21be90ce6) (the owner's option 1, the half not built).
6. ~~**A board-row chip for a pay application sent back twice**~~ done b6219f390 ("Roofing: sent back 2 times", red) (`timesSentBack`, `sentBackOpen` in
   `gcBuilding.ts`; the Building lane offered it).
7. ~~**No "Click" written into the words:**~~ done b6219f390 (bidTabResult reads `GC_COMPANY.shortName`) `bidTabResult` and any other Board words read the
   company's name from the model (`GC_COMPANY`), per question 1 (nothing Click-only).
8. ~~**A second walkthrough inside a project:**~~ done (*Walk me through this job*, 12 stops; *New here?* opens itself on a first visit; 7374e4327) Trades, Our number, Get started, Draws. And
   *New here?* may open itself on a first visit.
9. ~~**A phone pass on the Board's project tabs:**~~ done (all at 375 px with no sideways page scroll; fixed the "+ ?" marker's hidden words widening Trades and Our number; 0f881958f) Trades, Plans, Our number, Bid tabs, Contracts,
   Get started, Follow up, Trade partners.
10. ~~**Tidy `README.md`:**~~ done for the Board's lines (this commit); each lane tidies its own. its *Workflow steps not built yet* still lists what is built (the Closed
    section, the owner window's money, the schedule's Board parts). Each lane tidies its own lines.

## Building (GC 1)

1. ~~**Our own crew's percent from its Pipeline job**~~ done c0a4c6c61: real build only, how it plugs in is in the README.
2. ~~**A phone pass on Building's tabs:** Draws, Schedule, Closeout.~~ done 248c99720
3. ~~**The walk's order (owner first, item 12 in Owner):** move "Draw Helotes's schedule" before Start.~~
   done (this commit): the owner said yes and to fix the gap first; New Project's `issuePlanSet`
   now puts a set's new work on a drawn schedule (4241d807b), so the storefront stays on it.
4. ~~**Notifications for Building's events**~~ done ac44df256: the table under *Workflow steps not built yet*.
5. ~~**Tidy your lines in `README.md`.**~~ done c3de80230

## New Project (GC 2)

1. ~~**A scope line tied to its spec section, exclusions, budgets from real costs, and taking a sheet
   out of the set in a later set** (README, *New Project past its first form*).~~ done: spec sections
   742e4b567, taking a sheet out 0e8159e2d (a whole new set), exclusions fccdfc474 (Not in this
   trade, the gaps between the trades), budgets from our past jobs per square foot.
2. ~~**The days a set adds to the schedule carry onto the change order they start** (with Owner Billing).~~
   done: Owner Billing's `days` c3b453453, and the set's days ride on one change order
   (`changeOrderTakingTheDays`), so the signed ones add up.
3. ~~**The made-up questions (owner first, item 13 in Owner):** if he says they were sent, give Marsh &
   Vale's two Boerne questions a `sentToArchitectOn`, so they count against the architect again.~~ done: the owner, 2026-10-04,
   "yes they were sent": both carry `sentToArchitectOn` (the day each was asked).
4. ~~**A phone pass on New project, A new set of plans came in, and Questions about the plans.**~~
   done: New project's five steps are a row of numbers on a phone; the new-set window no longer
   scrolls sideways (0e8159e2d); Questions already fit; the plans window stacks the drawing over
   the list.
5. ~~**Notifications for New Project's events** (a set goes out, a question is answered).~~ done:
   the table in README.md after Owner Billing's, every row by email (question 29).
6. ~~**Tidy your lines in `README.md`.**~~ done: five steps, budgets from past jobs, the change
   order going on to the trade, the not-built line untangled, the lane's preview port.

## Portal (GC 3)

1. ~~**Pass `lang` to `bidTabResult`** in `GcTradePortal.tsx` (agreed).~~ done 6463bf58c
2. ~~**The lost-bid portal (owner's OK to commit, item 15 in Owner).**~~ done 83dcdcd20, a018d96df (owner's OK in the Portal session)
3. ~~**A trade asks a question in its portal and sees the answer there** (`tradeAskQuestion` is ready).~~ done c2a22ad26
4. ~~**"Left to bill" counts signed change orders** (`sowContractSum`).~~ done (the job block and Your pay both read `sowContractSum`)
5. ~~**The Spanish list for a native speaker to read** before anything ships (question 25), and no
   "Click" written into the portal's words (Board item 7).~~ done 6225b3fb7 (the list in PORTAL_SPANISH.md; the portal's own words already read `GC_COMPANY`, the bid tab's since b6219f390)
6. ~~**A phone pass on the portal.** It is the screen trades use most on a phone.~~ done 0f89c3048 (every company, both languages; the bid tab fits its 283px block since the Board lane's bea149e4e)
7. ~~**Notifications for the portal** (a new ask, a set that changed their trade, a promise passed),
   in the company's language.~~ done 59665d04d (README, the portal's events; question 29 on texts)
8. ~~**Tidy your lines in `README.md`.**~~ done da16bfbda

## Owner Billing (GC 4)

1. ~~**The owner's change order reads the trade's percent on its line**~~ done f8b43ad59 (`changeOrderPct` reads `changeOrderTradePct` once the trade signs; the bill, the form and the owner's portal all go through it).
2. ~~**Change orders carry the days a set added**~~ done c3b453453 (my half: `ChangeOrder.days`, `draftChangeOrder` takes `days`, signed ones add up in `contractDaysAdded` on Bill the owner and the owner's portal; New Project passes the set's days; moving substantial completion is open question 28).
3. ~~**A phone pass on Bill the owner, the owner's portal and Money.**~~ done 39ef92cc5 (all at 375 px with no sideways page scroll: Money's grid let its tables widen the page; the bill's lines, the weeks and the jobs now stack on a phone; the owner's and the architect's portals, the forms and the pay application window already fit, the 703 scrolls inside its sheet).
4. ~~**Notifications for the owner side**~~ done f30582691: the table under *Workflow steps not built yet*, every one by email (question 29).
5. ~~**Tidy your lines in `README.md`.**~~ done f30582691 (the files and lanes rows, Money's row and a try-it line).

## Round 2: the owner's answers of 2026-10-04

The owner answered questions 2, 3, 6, 7, 8 and 12 (`README.md`, *Open questions*). Same rules as
above: your section, in order, tested, marked here when shared. **The Board pushes the shared types
first** (a partner's vetting, the promise record), so build on those once GC 0 says they landed.

### Board (GC 0)

1. ~~**Q6 words:**~~ done (this commit). *Compare bids* becomes *Compare quotes*; a trade's number is a quote across the
   Board's screens, the walkthroughs and the Board's log lines. Our number to the owner stays *our bid*.
2. ~~**Q3 types first:**~~ done 90df3d85a. `Partner.vetting` (not vetted, approved, approved up to $X, declined). A
   known company with no record is approved.
3. ~~**Q8 types first:**~~ done 90df3d85a. the promise record (`gcPromises.ts`): one shape for every kind, kept when
   the thing happens, listed in Follow up, counted in the company's word record.
4. ~~**Q3 the office side:**~~ done dcf1d4ef5. a quote from a company not vetted shows "not vetted yet"; *Award at*
   stays locked until it is approved (or the number is over its limit); *Approve*, *Approve up to
   $X* and *Decline* on Trade partners and Compare quotes.
5. ~~**Q8 the Board's kinds:**~~ done dcf1d4ef5 (Follow up's *Insurance, papers and other promises*). insurance (the renewal: a Follow up row from 30 days before the
   certificate runs out), a W-9, a signed statement of work.
6. ~~**Q7 Bid tabs:**~~ done (this commit). *Mark awarded*, set by any estimator on our team, shown on the tab with who set it.
7. ~~**Q7 Start anyway**~~ done (this commit) on Get started: with a reason, logged; what was missing stays listed as owed.

### Building (GC 1)

1. ~~**Q12 the trade's pay application:** the notary block; materials stored on site (column F, into
   G); downloads as the AIA Excel template the Jobs Stages tab fills and as a PDF. One builder with
   Owner Billing's.~~ done: stored materials f98aabc52; ⤓ Excel, ⤓ PDF and the notary block in the
   trade's window 8b713255e (Owner Billing's `gcPayAppFile.ts`, `tradePayAppParties`).
2. ~~**Q8 Building's kinds** on the Board's promise record: a start or move-in day, submittals, a
   material delivery, a pay application fixed and sent again, punch items fixed, closeout papers
   and lien waivers.~~ done 2f9ac3ca7: `buildingPromisesKeptBy` (gcBuildingPromises.ts), *They gave
   a day* where each lives (Schedule's Starting soon, Submittals, Draws, the punch list, Closeout).
3. ~~**Q6 words** on Building's screens.~~ done: none said "bid" for a trade's number; nothing to
   change.

### New Project (GC 2)

1. ~~**Q3:** *Who to ask* can add a company not on the bench; it comes in not vetted.~~ done:
   **+ Ask a company not on our list** on each trade (`strangerActions`); a company the Board flags
   shows its vetting chip there too.
2. ~~**Q6 words** on New Project's screens.~~ done: a trade's number reads as a quote or as what we
   price ourselves ("every company quoting", "Our guess", "the scope we price ourselves"); "bid"
   stays for our bid to the owner and the Trades mode record. "Compare bids" stays while the
   Board's button is named so.

### Portal (GC 3)

1. ~~**Q6 words:** the portal says quote, in English and Spanish; redraw `PORTAL_SPANISH.md`.~~ done d716ce4e0
2. ~~**Q3 the new company's form:** license, insurance, years in business, references, past jobs, in
   both languages, and where it stands (being checked, approved, approved up to $X).~~ done 799694a69 (walked in the browser with a stranger added on Trade partners: form, checking, approved up to $150,000 and its email)
3. ~~**Q8:** the trade sees its open promises and can give or move a date; a reminder 30 days before
   its insurance runs out, with sending the new certificate.~~ done 75200a585 (the 30-day reminder was already built; COI_WARN_DAYS now reads INSURANCE_ASK_DAYS)

### Owner Billing (GC 4)

1. ~~**Q12 the owner's pay application:**~~ the notary block, materials stored on site, the Excel and
   PDF downloads, on one builder with Building's. Notary and downloads done 4011250e9 (`gcPayAppFile.ts`,
   `GcPayAppNotary.tsx`, Spanish too for the trade's window; Building wires it). Stored materials
   done 964183cb0: each trade's newest stored rolls into its line on ours (column F, line 4, retainage).
2. ~~**Q6 words** on the owner side, where a trade's number shows.~~ done: nothing to change. The
   owner side shows no trade's number as a bid; "still bidding" is our bid to the owner and stays.

### Still the owner's

- ~~Q4, Q7's map order, Q9~~: answered 2026-10-04, see Round 3.

## Round 3: the owner's answers of 2026-10-04 (later)

- **Q4:** draws by percent with retainage. Capture each trade's own first schedule of values
  (rough-in, top out, trim, or its own lines) with its quote, and show it side by side with ours.
- **Q7:** the trade map lists the most reliable company first.
- **Q9:** "Assistants could follow up the same way estimators could": every Follow up move is
  theirs too; Actions for assistants stays on Trade partners.

### Board (GC 0)

1. ~~**Q4 types first:**~~ done (this commit). the trade's schedule of values on its quote (`SubBid.sov`), carried onto
   the statement of work at award (`Sow.theirSov`), and a kernel for where a draw stands against
   it (claimed to date: through rough-in, into top out).
2. ~~**Q4 on the statement of work:** theirs beside ours on Contracts.~~ done (this commit).
3. ~~**Q7 the map order:** most reliable first (`tradeLineup`), the shortest drive breaking a tie.~~ done (this commit).
4. ~~**Q9:** no move is held back from an assistant in the prototype; say so in *Access* for the
   real build.~~ done (this commit; README, *The plan*).

### Building (GC 1)

1. ~~**Q4 on each draw:** their schedule of values beside the draw (the Board's kernel: "claimed
   $45,000 to date: through Rough-in, 40% into Top out").~~ done (Building, 2026-10-04): a line on
   each draw on Draws, and the side by side in the office's pay application window.

### Portal (GC 3)

1. ~~**Q4:** the quote form takes their schedule of values (Rough-in, Top out, Trim as a start; any
   lines; it adds up to the quote), in both languages.~~ done 8fd901616

### New Project (GC 2)

1. ~~**Q7:** Who to ask picks from `tradeLineup`, so its first picks follow the new order. Check
   the words that say "closest".~~ done 0c94ed85d ("The most reliable companies in range are
   ticked", "Tick the most reliable again").

## Round 4: the scope book (the owner, 2026-10-04)

The owner, on New project's step 4: "I would like to add a scope book where the user can set a
trade and set scope that they can search in that book and pull from." Mock-up, the critique of the
first idea, the revised version and this plan: `scope-book-mockup.html`. Built after New Project's
sheet index tools and the $/sq ft budget summary.

### New Project (GC 2)

1. ~~**The book in the model**~~ done (`gcScopeBook.ts`, tested). A line has its trade, words, spec section,
   an optional "leaves out, done by", the jobs it was used on, and the jobs where it came in late
   (a later set, a change order, a gap between trades). A set is a named list of one trade's lines.
   Seeded from every scope on the made-up jobs and `TRADE_TEMPLATES`. Readers: search (this trade
   first, most used, missed flagged), sets for a trade, often missed (late lines not in this
   scope), duplicates.
2. ~~**Step 4: Start from the book.**~~ done. A set picker and *Use these lines*, which merges and keeps the
   lines already there. Book lines carry a "book" mark.
3. ~~**Step 4: Often missed on <trade>.**~~ done. An amber callout with *+ Add* on each; hidden when empty.
4. ~~**Step 4: Add a line searches the book**~~ done, on the window's searchable picker: this trade first,
   then other trades ("from Concrete"), then "+ Add as a new line". A new line offers *Save to the
   book*. A book line brings its spec section and its "leaves out, done by".
5. ~~**The book's page**~~ done (*Open the scope book*, `GcScopeBookWindow`; `GcScopeBookButton` for a door): lines and sets by trade, edit, save this project's
   scope as a set, merge duplicates. The same search in *A new set of plans came in*.

### Board (GC 0)

1. ~~A door to the book from Trade partners, a walkthrough stop, the README row, once GC 2's page lands.~~ done (this commit): *Scope book* on Trade partners (GC 2's `GcScopeBookButton`), New here?'s *Trade partners and the scope book* stop.

## Round 5: exclusions by company (the owner, 2026-10-04)

The owner, after `vendor-exclusions-before-after.html`: "I like this idea. We need to also figure
out the intake where when someone goes and applies, we can record the exclusions they detailed in
their bid. And then once we've got the job, we send them a contract specifying what they're going to
do."

### Board (GC 0)

1. ~~**Types and the kernel**~~ done (this commit): `SubBid.exclusions` / `exclusionsAnswered` /
   `exclusionCovers`, `Sow.excluded`; `gcExclusions.ts` (`COMMON_EXCLUSIONS`, `exclusionsFor`,
   `exclusionName` folds "permits" and "Permit fees" onto "Permits and fees", `exclusionRows`,
   `exclusionCoversTotal` in `leveledTotal`, `uncoveredExclusions`, `partnerExclusionHabits`,
   `sowExcluded`); `setQuoteExclusion`, `setExclusionCover`; `tradeSubmitBid` takes the lists;
   award copies them onto the statement of work.
2. ~~**Compare quotes: Their exclusions**~~ done (this commit)., one row per exclusion any company names: excluded (with
   cover), included, not said (Ask them), expected (a Known exclusion); + Exclusion from their
   quote for an emailed one; the flip warning.
3. ~~**Contracts: the statement of work says what they will not do**~~ done (this commit). (and who does it instead).
4. ~~**Trade partners: what a company usually leaves out**~~ done (this commit). ("Permits and fees, 5 of 6").

### Portal (GC 3)

1. ~~**The quote form: What your quote leaves out**: `exclusionsFor(trade)` as ticks, typed ones,
   a unit price where it fits; sends `exclusions` and `exclusionsAnswered` (every tick offered) on
   `tradeSubmitBid`. Both languages.~~ done 6ef5b43ea
2. ~~**The statement of work in the portal** shows "What you will not do" from `Sow.excluded`.~~ done 6ef5b43ea

### New Project (GC 2)

1. ~~**Exclusion names in the book**~~ done: `scopeBookExclusions` keeps each trade's exclusions
   (the usual ones, Known exclusions on jobs, quotes' own, folded by `exclusionName`), shown on the
   book's page beside the lines; `exclusionsFor(trade, book?)` puts the book's first.

## Round 6: customer, not owner (the owner, 2026-10-04)

The owner: "Sometimes we are working for the owner, sometimes we are working for another GC or an
owner's rep who then works and bills the owner." He said ok to: (1) step 1 asks who we work for, (2)
"owner" becomes "customer" everywhere it means who we bill, (3) pay applications go to the customer and
show the property's owner when different. The words are in README.md, *Words: customer and owner*.
**Each lane changes the words in its own files** (screens, walkthroughs, help, log lines, Spanish);
code names stay. Golden moves on words are each lane's own, under its standing OK.

- ~~**Board (GC 0):**~~ done b5c64d8bd. the stage names, Bill the customer's tab name, Our number, the ring's words, the
  company window, Lost and Closed, Bid tabs, New here? and Walk me through this job.
- **New Project (GC 2):** step 1's *We work for*: the owner, another general contractor, an owner's
  rep (`GcProject.customerRole`); not the owner shows *Owner of the property* on its own. Then its own
  words.
- **Owner Billing (GC 4):** its tab and windows ("Bill the customer", the customer's portal, "the
  customer pays"); the pay application goes to the customer and names the property's owner when
  different. Then its words.
- **Building (GC 1)** and **Portal (GC 3):** their own words where "owner" means who we bill.
  Portal done df682115a.

## Round 7: the company window (the owner, 2026-10-04)

The owner: "click on any of the paperwork buttons and have that paperwork appear", with information
about the company, a ledger of what happened with them, and their documents, in three tabs. Mock-up
`company-window-mockup.html` (the first idea, the critique, the revised version); he said build it.

- ~~**Board (GC 0):**~~ built. One window for every company: About, Activity, Documents. Paperwork
  chips open it at that paper, a trade's name opens it on About, and a customer's window gets the same
  tabs. Details in README.md, *The company window*.
- ~~**Board (GC 0):**~~ built. **Their portal**, a fourth tab: active or not yet, the link, and the
  portal itself beside it (the owner, 2026-10-04). Customers turn on and off there.
- ~~**Board (GC 0):**~~ built. **Send a paper**: each missing or waiting paper's button opens the
  send beside the list, with the email as they get it and a day Follow up chases (the owner,
  2026-10-04; `send-a-paper-mockup.html`). Its emails reach *Their messages* through one add-only line
  in the Portal lane's `portalMessages`.
- **Other lanes:** nothing owed. If a lane adds a paper or an event a company should see (a new
  promise kind, a new paper in the trade's portal), add it to `partnerDocuments` or `partnerActivity`
  in `gcCompanyFile.ts` and to its test.

## Round 8: a trade asks for a change (the owner, 2026-10-04)

The owner, asked what the portal builds next: "A trade asks for a change". Money changes only went
one way: we send a change order and the trade signs it. Now a trade asks from its portal: what
changed, why (something on site, the customer asked for more, the plans changed), what it asks, the
days and a photo. Details in README.md, *A trade asks for a change in its portal*.

- ~~**Portal (GC 3):**~~ done (this commit). `TradeChangeRequest` on the project, `tradeAskChange`,
  `draftChangeOrderFromRequest` (drafts through `draftChangeOrder` and links the request),
  `turnDownChangeRequest`; *Changes to your work* on the job page with where each stands, its three
  emails, the company window's Activity lines. Seeded: Tri-County's rock on Fair Oaks.
- ~~**Owner Billing (GC 4):** the office's list on Bill the customer's change orders:
  `openChangeRequests(project)` with company, what, why, amount, days and the photo's name;
  *Make a change order* (prefilled from the request: its words, its amount as our cost, the days)
  dispatches `draftChangeOrderFromRequest`; *Turn down* asks why and dispatches
  `turnDownChangeRequest`.~~ done 3ae5d95eb.
- **Board (GC 0), if it fits:** a Needs you line while a request waits ("Tri-County Site asked for a
  change on Fair Oaks").

## Round 9: back-charges a company can see (the owner, 2026-10-05)

The owner, asked what the portal builds next: "Back-charges they can see". The other way from
Round 8: we charge a company for cleanup, damage or work we finished for it, and it sees why before
the money comes off a draw. Details in README.md, *A company sees what we charge it for*.

- ~~**Portal (GC 3):**~~ done (this commit). `BackCharge` on the statement of work and four actions:
  `backCharge`, `tradeAnswerBackCharge`, `settleBackCharge`, `takeBackCharge` (lowers an approved,
  unpaid draw's net and records it on `Draw.backCharges`). *Charges from Click* on the job page,
  the to-do, four emails, "less $X in back-charges" on the draw in the portal and Your pay, the
  company window's Activity lines. Seeded: Iron Horse's cut power line on Fair Oaks, $1,250.
- **Building (GC 1):** the office's screen, beside each trade's draws: *Charge them* (amount, what
  for, a photo) dispatching `backCharge`; each charge's state (`backChargeState`); *Keep it* or
  *Drop it* with a reason on a disputed or unanswered one (`settleBackCharge`); *Take it off draw N*
  on one `backChargeCanTake` allows, for each draw `backChargeDraws` gives (`takeBackCharge`).
  `backChargesToAct(sow, today)` is the list that needs the office.
- **Owner Billing (GC 4), nothing owed:** the cash forecast reads `draw.net`, which is already less.

## Round 10: who at the company gets which emails (the owner, 2026-10-05)

The owner, asked what the portal builds next: "Who at the company gets what". Every email went to
one contact; now a company names its people and the kinds each gets. Details in README.md, *Each
email goes to the right person at the company*.

- ~~**Portal (GC 3):**~~ done (this commit). `Partner.people`, `contactGets`, three actions, *Who
  gets our emails* on the home, every email addressed and greeted by its kind (`portalMailGroup`,
  `mailRecipients`). Seeded: Pecan Valley's bookkeeper gets pay and papers.
- **Board (GC 0), if it fits:** the company window's About could list the people and what each
  gets; Follow up's Email could pick the person for the kind it chases (a quote: `quotes`; a waiver
  or a W-9: `pay`) through `mailRecipients(partner, group)`.

## Owner (the decisions)

11. ~~**A carried quote with a line that has no cost:** does it hold the ring open?~~ Answered 2026-10-03: yes, until every line has a cost. Built by the Board (this commit).
12. ~~**The golden walk's order:** draw Helotes's schedule before Start?~~ Answered: yes (Building item 3, done).
13. ~~**Marsh & Vale's made-up questions:** were they sent to the architect?~~ Answered 2026-10-04: **already sent.** (New Project gives them a sent date.)
14. **The open questions in `README.md`:** 2 (start at buyout?), 3 (vetting new trades), 4 (draws
    by stage or percent), 5 (where the plans live), 6 ("quote" or "bid"), 7 (mark who was awarded
    on a bid tab; closest or most reliable first; "start anyway"), 8 (track other promises), 9
    (group the board by customer), 12 (pay application extras and its file), 14 (do alternates
    change our number; does a quote that ran out stop counting). Answered 2026-10-04: 2 (start
    with bidding), 3 (vet strangers: quote yes, award after approval), 6 (quotes from trades, our
    bid to the owner), 7 (any estimator marks awarded; start anyway yes), 8 (track every kind), 12
    (notary, stored materials, Excel and PDF); 5 (Google
    Drive, checked by someone), 7's first half (yes, set by the job's estimator), 9 (a By stage \|
    By customer switch, stage by default; built by the Board), 14 (left to the Board: built
    e04a397c4), 28 (yes, signed change-order days move substantial completion).
15. ~~**The Portal lane's lost-bid portal:** OK to commit?~~ Answered 2026-10-03 in the Portal session: yes; shared at 83dcdcd20 and a018d96df.
22. ~~**The Spanish:** who reads it?~~ Answered 2026-10-03: someone the owner names reviews it when GC mode goes to production; nothing to do before then. The list is ready in `PORTAL_SPANISH.md` (*For a native speaker to read*).

## Everyone

21. **Notifications.** Email only for now (the owner, 2026-10-03; question 29): no text sender. Nothing emails or notifies anyone yet. Each lane names its own events (in
    its section above); the real build sends them through Resend.

## The real build (not yet: only when the owner says the shape is settled)

From `README.md`, *The plan*. Nobody starts these until he says so.

23. Schema from the model: the tables, row-level security, the two read-only block calls.
24. The model's calculations as tested kernels.
25. The board and one project, read-only, on real data, behind the dev gate.
26. Invitations and the company-keyed portal (the sub portal's pattern).
27. Plans: sets, the email, who opened which set.
28. Compare, carry, our number.
29. Award, master agreement, statement of work, Get started.
30. Draws and waivers.
31. Across all of it: email through Resend, money for the owner and controller only, help guides,
    release notes and docs with each step.
