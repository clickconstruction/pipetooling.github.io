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
3. **The walk's order (owner first, item 12 in Owner):** if he says yes, move "Draw Helotes's
   schedule" before Start in the golden walk, since Start is shut until the schedule is drawn.
   The owner said yes, and to fix a gap first (2026-10-03): a trade a later set brings in does
   not join a drawn schedule. Waiting on the New Project lane's `issuePlanSet`.
4. ~~**Notifications for Building's events**~~ done ac44df256: the table under *Workflow steps not built yet*.
5. ~~**Tidy your lines in `README.md`.**~~ done c3de80230

## New Project (GC 2)

1. **A scope line tied to its spec section, exclusions, budgets from real costs, and taking a sheet
   out of the set in a later set** (README, *New Project past its first form*).
2. **The days a set adds to the schedule carry onto the change order they start** (with Owner Billing).
3. **The made-up questions (owner first, item 13 in Owner):** if he says they were sent, give Marsh &
   Vale's two Boerne questions a `sentToArchitectOn`, so they count against the architect again.
4. **A phone pass on New project, A new set of plans came in, and Questions about the plans.**
5. **Notifications for New Project's events** (a set goes out, a question is answered).
6. **Tidy your lines in `README.md`.**

## Portal (GC 3)

1. ~~**Pass `lang` to `bidTabResult`** in `GcTradePortal.tsx` (agreed).~~ done 6463bf58c
2. ~~**The lost-bid portal (owner's OK to commit, item 15 in Owner).**~~ done 83dcdcd20, a018d96df (owner's OK in the Portal session)
3. ~~**A trade asks a question in its portal and sees the answer there** (`tradeAskQuestion` is ready).~~ done c2a22ad26
4. ~~**"Left to bill" counts signed change orders** (`sowContractSum`).~~ done (the job block and Your pay both read `sowContractSum`)
5. ~~**The Spanish list for a native speaker to read** before anything ships (question 25), and no
   "Click" written into the portal's words (Board item 7).~~ done 6225b3fb7 (the list in PORTAL_SPANISH.md; the portal's own words already read `GC_COMPANY`, the bid tab's since b6219f390)
6. ~~**A phone pass on the portal.** It is the screen trades use most on a phone.~~ done 0f89c3048 (every company, both languages; the bid tab scrolls in its own box until its table fits a 283px block)
7. ~~**Notifications for the portal** (a new ask, a set that changed their trade, a promise passed),
   in the company's language.~~ done 59665d04d (README, the portal's events; question 29 on texts)
8. ~~**Tidy your lines in `README.md`.**~~ done da16bfbda

## Owner Billing (GC 4)

1. ~~**The owner's change order reads the trade's percent on its line**~~ done f8b43ad59 (`changeOrderPct` reads `changeOrderTradePct` once the trade signs; the bill, the form and the owner's portal all go through it).
2. ~~**Change orders carry the days a set added**~~ done c3b453453 (my half: `ChangeOrder.days`, `draftChangeOrder` takes `days`, signed ones add up in `contractDaysAdded` on Bill the owner and the owner's portal; New Project passes the set's days; moving substantial completion is open question 28).
3. ~~**A phone pass on Bill the owner, the owner's portal and Money.**~~ done 39ef92cc5 (all at 375 px with no sideways page scroll: Money's grid let its tables widen the page; the bill's lines, the weeks and the jobs now stack on a phone; the owner's and the architect's portals, the forms and the pay application window already fit, the 703 scrolls inside its sheet).
4. **Notifications for the owner side** (a pay application to certify, a payment late).
5. **Tidy your lines in `README.md`.**

## Owner (the decisions)

11. ~~**A carried quote with a line that has no cost:** does it hold the ring open?~~ Answered 2026-10-03: yes, until every line has a cost. Built by the Board (this commit).
12. **The golden walk's order:** draw Helotes's schedule before Start? (Building moves the step.)
13. **Marsh & Vale's made-up questions:** were they sent to the architect? (New Project.)
14. **The open questions in `README.md`:** 2 (start at buyout?), 3 (vetting new trades), 4 (draws
    by stage or percent), 5 (where the plans live), 6 ("quote" or "bid"), 7 (mark who was awarded
    on a bid tab; closest or most reliable first; "start anyway"), 8 (track other promises), 9
    (group the board by customer), 12 (pay application extras and its file), 14 (do alternates
    change our number; does a quote that ran out stop counting).
15. **The Portal lane's lost-bid portal:** OK to commit?
22. ~~**The Spanish:** who reads it?~~ Answered 2026-10-03: someone the owner names reviews it when GC mode goes to production; nothing to do before then. The list is ready in `PORTAL_SPANISH.md` (*For a native speaker to read*).

## Everyone

21. **Notifications.** Nothing emails or notifies anyone yet. Each lane names its own events (in
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
