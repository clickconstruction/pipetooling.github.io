---
name: "GC mode: Bids, mirrored. We are the general contractor and the trades bid to us"
number: 81
group: gated
status: explored 2026-10-02 as a design spike · a playable prototype on made-up data lives on branch `spike/gc-mode` (page `/bids/gc`, dev only) · nothing is on main, nothing touches the database · the owner is still shaping it screen by screen · five lanes build it at once since 2026-10-02 (Board, Portal, Building, New Project, Owner Billing: see Working in parallel)
summary: >
  The owner's idea (2026-10-02): Bids manages our bid as a trade to a GC. Offer a second mode
  where we are the GC: a set of plans comes in once, each trade is offered to several trade
  partners, their quotes come back through a portal, we compare them and carry a number, give
  the owner a price, then award, sign (one master agreement per company, one statement of work
  per job), start, and pay draws. A Trades | GC switch on the Bids page flips between the two.
  The prototype plays the whole loop on a fixture with the office on one side and a trade
  partner's portal on the other, so every screen and rule below was decided by using it.
next: >
  The owner keeps walking the prototype and answering the open questions in this file. When he
  says the shape is right: write the schema from the model file, then build it for real in the
  order under "The plan".
size: XL (a new mode: about ten tables, a company-keyed portal, email, and six to eight screens)
blocker: The owner's calls listed under "Open questions". No engineering blocker.
mockup: not required — the mock-up is the running prototype at /bids/gc on branch spike/gc-mode
opinion: your call — the prototype is far enough along to judge the idea; nothing should be built for real until the open questions are answered
---

# GC mode

## The ask, in the owner's words

> "I am starting to notice we have a bids page setup to manage trades that bid on work, and we
> have tools in place to manage sub contracts and do projects, and a document room that can hold
> all these things. I would like to ideate with you such that we offer an additional mode for
> Bids where instead of managing bids for trades we manage projects as a whole as a GC."

> "…a new and unique view either as a different page or a different view mode in the bids page
> where a user can fully toggle between GC mode and Trades Mode. Such a page would use many of
> the same tools where we take in a set of plans but then its purpose is to manage that
> communication with the various trades making sure each has a portal and access to the latest
> set of plans and can submit bids and sign contracts with us through their portal and report
> their project on jobs and request stage draws."

> "We would work with these subs via an MSA-SOW model where they sign our Master Services
> agreement and then we agree to statements of work for specific things. Long term this could
> look like having a full contract builder going into jobs for part of this."

He called it "totally new and exploratory" and asked for a prototype to play with.

## How to open the prototype

1. Check out `spike/gc-mode`, `npm install`, `npm run dev`.
2. Open `http://localhost:<port>/dev-login?as=1&to=/bids/gc` (`AGENTS.md` → dev login).
3. The **Trades | GC** switch also shows on `/bids`, for a dev only.
4. **Start over** (top right) resets the made-up data. Nothing is saved anywhere.

Everything runs on one fixture through one reducer, in the files under
[`src/lib/gcMode/`](../../src/lib/gcMode/) (import them through the barrel `gcModel.ts`). No
table, RPC, edge function or email is involved. The office is on the left; **See what the trade sees** shows one trade
partner's portal on the right, and a press on either side shows on the other.

## The model, in one paragraph

Bids today: one project, estimated once, offered to several GCs. GC mode is the mirror: one set
of plans, split into trades, each trade offered to several trade partners. A trade we do
ourselves (plumbing) is a row whose number comes from our own Trades-mode bid, which is the
bridge between the two modes and the reason it is a switch on Bids and not a second app.

## What the prototype has (walk it in this order)

| Where | What it does |
|---|---|
| **New here?** (top right) | An 11-stop spotlight walkthrough of the three stages on the Project Board: each stage's question, what you do in it, how it ends, then where to try it. Stops in `src/lib/gcMode/gcTour.ts`, on the app's `SpotlightTour`. |
| The ring on each row | How far the project is through its stage (`stageProgress` in the model; `GcProgressRing`). Hover it, tap it on a phone, or tab to it: a card lists what the ring counts by type, what is left in each spelled out, what is done in one line, and an *Also* list it does not count. Bidding: enough quotes (2 per hired trade), a number to carry, quotes on the newest plans, our bid sent. Buyout: the Get started checklist by kind of step (the owner side, awarded, master agreement, insurance, W-9, statement of work). Building: work reported per trade, weighted by its statement of work, and our own crew's percent weighted by our own number; draws and waivers waiting under *Also*. |
| **Project Board** | Projects in three sections: Bidding to the owner, Buying out, Building. Each row leads with the days left before our bid (red inside a week, amber inside two), then the name, the owner and architect (each a link), chips, the Bid Board's folder and plans icons, and the price. |
| **+ New project** (beside *Bidding to the owner*) | One window in four steps, each feeding the next. **The project**: name, address, town, owner and architect from the one customer list ("Someone new" makes a record), bid due, size. **The plans**: the set's name (Bid set, Pricing set, Permit set or typed), the day it came in, the sheet index pasted from the cover sheet and read as you paste (A-101, A101, A1.01, FP-101; capitals become sentence case; a line not read is listed). **The trades**: guessed from the sheets in build order, each with the sheets behind it; untick, add, mark **Ours**, a budget. **Each scope**: each trade's usual lines to change, each with the sheets it reads from (guessed from its words, × takes one off, **+ sheet** adds one; none means the trade's sheets as a whole); Enter starts the next line. **Create the project** puts it under Bidding to the owner and opens it on Trades. **Paste a made-up sheet index** tries it. |
| Plans icon on a row | A plans window over the board: newest set first, the sheet list by discipline, what the last addendum changed, arrow keys flip sheets, and under each sheet the scope lines that read from it. Drawings are stand-ins. |
| Owner or architect name | One company window, shaped by what the company is to us: an owner gets money, how they buy and pay, projects we build for them; an architect gets addenda and questions waiting on them. One call log either way. |
| **Trades** tab | One row per trade: who we asked with each bid in thousands, our budget, the lowest all in, what we carry. **Compare bids** opens the comparison. **On a map** opens the map. |
| Compare bids | Sentences first ("Voltage Brothers bid $166,000 and left out fire alarm. Covering that adds $14,000, so they come to $180,000."), then the table behind them: is each piece of work in their price, a cost to cover what is not, the all-in total, who is lowest. |
| On a map | The project in the middle, every company in the trade as a numbered pin (closest first), the same companies in a list beside it to work down. "Will not do it" / "Cannot do it" moves you to the next closest. |
| **Plans** tab | **A new set of plans came in**: name the set (Addendum, Bulletin, Revised set, Permit set, Construction set, or typed; addenda and bulletins count apart), paste what changed, sheets are read out of the notes (A-401, A401, A1.01) and matched to the index, a sheet new to the set gets its title, trades guessed from the sheet letters and titles, a trade the job does not have yet can come with the set (its usual scope, a budget; nobody asked yet), the scope lines it touches per trade, the list of who is emailed, the email preview (it names the lines it touches). Then a table: told, opened, their number (needs confirming or good). |
| **Our number** | Carried trades + general conditions + contingency + fee = the price to the owner. **We sent our bid**, **We won this**. |
| **Bid tabs** | After our bid is in, each trade's quotes go back to the companies that quoted, low to high, their own row marked, names hidden unless ticked. |
| **Contracts** | Per trade: paperwork chips, award, the statement of work drafted from the bid, send, sign. |
| **Get started** | The checklist before work starts: owner contract, permit, start date, and five steps per trade. Start stays shut until nothing is missing. |
| **Draws** | Percent reported per line, a draw asked from the portal with its pay application (the 702 and 703) and a conditional waiver, approve, pay, unconditional waiver. **Pay application** on each draw opens the signed form read-only. **Send back** returns a waiting draw with a note and the percent we see on each line we doubt; the trade gets **Fix and resend** in its portal, our numbers filled in, and the fixed one comes back marked "revised". A trade our own crew does shows as **Our own crew** with its percent and its Pipeline job: no draws there. |
| **Bill the owner** | Our pay application to the owner, once a month: one line per trade with the work its company reported, then general conditions, contingency and fee, which follow the trades. Done so far, less what the owner holds, less what we asked for before, is this bill. **Send to** the owner keeps it as it went, and next month's starts from it. **So far with** the owner lists what went, with **Mark paid**. A trade our own crew does (plumbing) has a percent-done picker on its line. **Waivers with this bill** says whose waiver is missing. **See what the owner sees** puts their portal beside it: their contract, each bill with every line and **Pay**, and their papers (our lien waivers and the trades'). Once every line is billed, **Closeout with** the owner replaces the draft: every trade's final, the owner's **Accept the work**, then **Send the final pay application** for what they hold. |
| **Follow up** (board tab) | Everyone we are waiting on across every project, the ones to call first. Log a contact; record the day they promised a quote; a passed day returns them to the top. |
| **Trade partners** (board tab) | By trade: the bench, who answers when asked, every project short of quotes, coverage (where they drive from, how far they go), one press to ask the companies not yet asked. **Actions for assistants** on top: each standard as the ideal, where we are, and what closes the gap. |
| The trade's portal | One link per company, carried by every message we send (**Their messages** beside **Their portal**: the invitation as an email and a text, reminders, new plan sets, bid tabs). The first visit opens on a welcome until **Got it**. The link opens on the company's **home**: what needs them across every project (late or blocking first), their money once a dollar moves, their jobs, what they are asked to bid, their paperwork, and what came before. A row opens that project's page, with **← Everything with Click** back. On a project page: paperwork done by the company itself (read and sign the master agreement, send an insurance certificate, fill in and sign a W-9), the plans window (sets, sheets, whether a set changes their trade), the invitation and the bid form (each line with its sheet numbers, a tap opens that sheet; after a new set the lines it touches are marked; how many days the number is good for; alternates that add or take off; their own quote attached), "tell Click when your number will come" (a passed day shows in red), answer a line the office could not read (its own short step, the number stays), confirm a number after an addendum, the bid tab, sign the statement of work, report work, ask for a draw with its pay application (next row). |
| Pay application (from the portal) | **Fill out pay application N**: four steps on a rail like the Release of Lien window (Check your work, Fill in a few details, Sign it, Send it to Click) beside the 702 and 703, which fill in as the trade types and mark what each step fills. The app knows the job, the contract, the lines, what was billed and the retainage; the trade checks the percents, picks the period, types its address once, and signs. Closing the window keeps the draft. |
| **Closeout** | Each trade's last six steps: every line billed, **Accept the work** (the punch list is done), their warranty letter, their final pay application for the retainage with a conditional waiver on final payment, **Approve the release** and **Mark paid**, their unconditional waiver on final payment. Totals for held, paid back and trades closed out. In the portal the same steps show as the trade's closeout list, ending "You are closed out on this job." |

## Decided by the owner (2026-10-02)

- **One customer record.** The owner of a project is the app's own customer record, and so is
  the architect. One company can be an owner, an architect, and a GC we bid to in Trades mode.
  What a company is comes from the project (`customerId`, `architectId`), never from the record.
- **Two quotes at a minimum** on every trade, from different companies (`BIDS_WANTED`).
- **Days left gets its own block** at the head of a project row. It is the number an estimator
  plans the week around.
- **"Level bids" was not understood.** The screen says "Compare bids", "all in", "cost to cover
  it". The words level and plug do not reach the screen.
- **Bid amounts beside each company read in thousands** with a small K.
- **Distance pricing is out.** A table of multiples by distance (50 mi normal, 100 mi ×1.2) was
  built and removed: "not done the way I want". Coverage stayed. Ask how he wants distance to
  move a price before building it again.
- **"Thin bench" is not a chip.** It is obvious to an owner. It lives in **Actions for
  assistants**, which explains the ideal and where we are.
- **Bid tabs: one table per trade.** Showing our view, their view and the portal was three
  copies of the same thing.
- **A new set of plans emails the right people**: every company bidding while we bid; once the
  job is ours, only the company on each trade.
- **Communication is tracked per ask**, and a promised quote date is watched.
- **A guess never closes a trade.** Our own budget carried as a trade's number fills the price,
  but the ring and the board's chip count only a real quote (or our own crew's number from a
  Trades mode bid). The chip names the guesses ("· 1 on our guess"); the card says "Carry one to
  close it" (`isGuess` in the model).
- **Click does the GC work itself** (answered 2026-10-02, was open question 1): "It's for Click
  doing GC work ourselves, but the entire app is designed in a way where a later company could
  put their company in this app." Build for one company; name nothing Click-only, so a later
  company could be added the way the rest of the app allows.
- **New Project starts with the plans** (approved as built, 2026-10-02): a **+ New project**
  button beside *Bidding to the owner* opens four steps: the project, the plans, the trades,
  each scope. The trades are a guess from the sheet index (discipline letters plus title words
  like "roof" or "door", `TRADE_TEMPLATES` in `gcNewProject.ts`); each scope starts from the
  trade's usual lines. Nobody is asked until the office asks on Trades. The company's own trades
  (`OUR_TRADES`, plumbing) come in ticked as ours.
- **A later set says what it is** (approved as built, 2026-10-02): **A new set of plans came in**
  names the set (an addendum while we bid, a bulletin once the job is ours, or a whole revised,
  permit or construction set), gives a sheet new to the index its title, and can bring a trade
  the job did not have, put in build order with its usual scope (`issuePlanSet`). The trade guess
  is the one New Project uses, so a title like "Roof plan" flags roofing.
- **Each scope line names its sheets** (approved as built, 2026-10-02): a line carries the sheets
  it reads from (`ScopeItem.sheets`), guessed from the words it shares with the trade's sheet
  titles and changed by the office. A new set then says which lines it touches, and each
  company's email names them. A line with no sheet stands for the trade as a whole, so it counts
  as touched whenever any of the trade's sheets changes (the owner's call, 2026-10-02:
  `lineReads`, `linesOnSheets`). Projects written before lines had sheets show the guess
  (`lineSheets`).
- **Each draw comes with a 702 and 703** (2026-10-02, Building lane): the trade fills the pay
  application in its portal and watches the form fill, typing only what the app cannot know. Most
  of it comes from the job and from the work they reported (`gcBuilding.ts`, `GcBuildingPayApp.tsx`).
- **Closeout runs per trade** (approved as built, 2026-10-02, Building lane): the retainage
  comes back as the trade's last draw, asked for with a final pay application and the
  final-payment waivers, once every line is billed, we accept the work and the warranty letter
  is in (`tradeCloseout` in `gcBuilding.ts`, `GcCloseout.tsx`). The retainage the owner holds on
  us stays Owner Billing's.
- **Our own crew counts in Building** (approved as built, 2026-10-02, Building lane): a trade we
  do ourselves weighs in the Building ring by our own number, from the one percent Bill the owner
  bills from (`ownCrewWork`). Draws shows it with the same picker; it has no draws, retainage or
  waivers, since we pay our own crew through payroll.
- **We bill the owner once a month** (Owner Billing lane, 2026-10-02): one pay application a
  month covering every trade's work since the last one, not a bill each time a trade asks for a
  draw. The day of the month is a default (`OWNER_BILL_DAY` in `gcOwnerBilling.ts`).
- **Lien waivers to the owner: ours and the trades'** (Owner Billing lane, 2026-10-02). Our
  conditional waiver on progress payment goes with each pay application for the amount it asks;
  marking the bill paid signs our unconditional one (the real build waits for the money to clear,
  as the Jobs board does). Each trade's waivers go too. A trade whose waivers do not cover its
  work on the bill is a warning on the bill and a note on the owner's portal, never a stop.
- **The owner sees every line** of each pay application in their portal, not the totals only.
- **The owner's retainage comes back at the end** (Owner Billing lane, 2026-10-02): once every
  line is billed, the owner accepts the work in their portal, and our final pay application asks
  for everything they hold, with our conditional waiver on final payment; paying it signs our
  unconditional one. Our final waits until every trade has sent its own final pay application.
  A trade's retainage is paid only after the owner has paid us ours (`ownerReleasedRetainage`):
  that rule is the Building lane's to apply on Closeout.
- **A trade sees "Click Construction"** (2026-10-02). The name comes from one record
  (`GC_COMPANY` in `gcFixture.ts`: the full name and the short "Click" used in sentences), never
  typed into the portal's words.
- **A company's link lands on its home** (2026-10-02), not on one project: everything the company
  has with us, what needs them first. A project's page is one tap away.

## My defaults the owner has not confirmed

Each is a constant or a rule in the model files under `src/lib/gcMode/`. Change them freely.

- No statement of work goes out and no draw is approved without the master agreement, current
  insurance and a W-9.
- A bid is stamped with the plan set it was priced on; a newer set that changes the trade makes
  it "needs confirming".
- Draws go by percent per schedule-of-values line with 10% retainage.
- Bid tabs open only after our bid is in; names are hidden; quotes show as sent, not our all-in.
- A bench is deep at three companies that usually answer (`BENCH_WANTED`); "often silent" is
  under 40% of asks answered, "answers" is 75% or more, nobody is judged on fewer than two asks.
- A company should open the plans within three days (`OPEN_WITHIN_DAYS`).
- A promise that passed stays on a company's record even after a new day; a day moved before it
  came does not count against them.
- Start is a hard stop: no "start anyway".
- Red inside 7 days and amber inside 14 on the days-left block.
- A new set starts as an addendum while we bid and a bulletin once the job is ours. In pasted
  notes a sheet number without a dash needs three digits (A101, not R30), and a sheet the index
  lacks is written the way the index writes its others (S301 reads S-301).
- The pay application asks for the period date every time, the address and license once (kept on
  the company), and a typed name and title with the waiver tick as the signature. A line can be
  lowered to what was billed before, never below. The 702's "To" line reads Click Construction,
  the name the portal already uses (`GC_COMPANY_NAME`).
- Closeout: the release waits for nothing else (not the owner, not a number of days). Its
  approval is locked by the same paperwork rules as a draw. "Held" counts until the release is
  paid, not when it is approved (`retainageHeldNow`).
- Sending a draw back: the note is required; a resend keeps the same application number; only a
  draw waiting on us can go back (a retainage release too); nothing billed changes. The resend's
  percents become the trade's report, even lower than it was.
- Owner billing (`gcOwnerBilling.ts`): the pay application goes on the 25th. A trade's line on
  the owner's bill is the work its company reported, before we approve their draw. General
  conditions, contingency and fee follow the share of the trades' work done, so the bill totals
  the same whether they show as lines or spread into the trades. The owner holds the percent on
  their customer record, 10% when it says nothing. Our own crew reports one percent for the whole
  trade, in 10% steps, the way the Pipeline keeps one percent on a job.
- A new insurance certificate counts the moment the company sends it; nobody in the office checks
  it first. A new one is good for a year until they change the day.
- A company answers every line the office marked "not clear" (in or left out) before its number
  can go again. A new set that does not change their trade asks them to open it but does not warn.
- The invitation names the trade, the address and size, the due day, the newest plans and the
  scope lines; the text says the same in one sentence with the link. A company sees the welcome
  until it presses **Got it**; one that already bid, opened plans or signed the master agreement
  never sees it.
- The bid form shows a sheet the office did not set (matched from the line's words, `lineSheets`)
  with a dashed edge, beside the ones it did. Lines are marked against the company's number, or
  against the set it last opened when it has no number; a company that never opened the plans
  has nothing marked.
- A number is good for 30 days unless the company picks 15, 60 or 90; past its last good day it
  shows as ran out and asks to be sent again. Alternates are the company's own (another way, at a
  different price); the office does not set alternates every bidder must price. Only the quote
  file's name is kept.

## Open questions (the owner's to answer)

1. ~~Is this for Click taking GC work itself, or a product other GCs use?~~ Answered: Click
   itself, built so a later company could be added (see *Decided by the owner*).
2. Does the first real version need the price-to-the-owner side, or does it start at buyout?
3. Are trade partners mostly known companies, or do strangers get invited and need vetting?
4. Draws by stage (rough, top out, trim) or by percent with retainage, as drawn?
5. Where do a GC project's plans live: Drive folders as today, or hosted so "who opened which
   set" is real?
6. "Quote" or "bid" for a trade partner's number? He said quote; the older screens say bid.
7. Should a bid tab mark who was awarded? Should the map list run closest first or most
   reliable first? Should Start allow a "start anyway"?
8. Should promises other than a quote date be tracked (insurance by Friday, a start date)?
9. Should the Project Board also group by customer, and should Actions for assistants also sit
   on the Project Board?
10. A trade ticked **Ours** on a new project counts as a real number on the ring, even at $0.
    Should ticking it start our own bid in Trades mode, and count only once that bid is priced?
11. A new project's budgets start blank. Should a budget come from the size (a cost per square
    foot for each trade)? Asked before building, after distance pricing was built and removed.
12. The pay application leaves out the notary block, materials stored on site (column F reads $0)
    and change orders (line 2 reads $0). Which of these do our trades need? Should it also
    download as the AIA Excel template the Jobs Stages tab fills, or as a PDF?
13. On the owner's bill, do our general conditions, contingency and fee show as lines of their
    own, or spread into each trade's line so the owner never sees the fee? (Built as lines of
    their own for now. The total is the same either way.)
14. ~~Should a trade also give alternates, attach its own quote, and say how many days the number
    is good for?~~ Built on the owner's word (2026-10-02). Still open: Compare bids and Trades do
    not read them yet (the Board lane's change). Should an alternate the office takes change the
    number we carry, and should a number that ran out stop counting toward the two quotes?
15. ~~Should answering a "not clear" line be a move of its own?~~ Built (2026-10-02):
    `tradeAnswerLines`, logged as "answered on Concrete: Rebar supply is in their number".
16. Should a trade's retainage wait until the owner releases ours (pay when paid), or for some
    days after we accept the work? Built with no wait.
17. What papers must a trade turn in before its retainage comes back? Built with a warranty
    letter only. Some trades may owe drawings of what was built, equipment manuals, or final
    waivers from their own suppliers.
18. Should a project whose trades are all closed out leave Building for a fourth section on
    the board? It stays under Building today. That is the Board lane's change.
19. Besides sending a draw back, should the office be able to approve less than was asked, the
    way an architect certifies a smaller amount on a 702? Should a draw sent back twice flag
    anything on the board?
20. Should the office see which companies never opened their link (a chip on Trades and in
    Follow up)? The portal records the first visit (`portalOpenedOn`). That is the Board lane's change.
21. Our own crew reports one percent for the whole trade. Should it report by stage instead
    (underground, rough in, top out, trim), the way the Pipeline runs a plumbing job?
22. Should a trade see sheets the office did not set (the dashed ones, matched from the line's
    words), or only the sheets the office set when writing the scope?

## Workflow steps not built yet

- New Project past its first form: a scope line tied to its spec section, exclusions, and a
  budget from the size (open question 11). A line's sheets show only in New Project, a new set
  and the plans window; the portal's bid form, Trades and Compare bids do not show them yet. A
  later set cannot yet take a sheet out of the set, or add a scope line to a trade already out
  to bid.
- A trade asks a question about the plans, the architect answers, every bidder on the trade
  gets the answer. Three made-up questions show in the architect's window, read-only.
- Change orders, both to the owner and to a trade (a statement of work amendment).
- Closeout for the job as a whole: the owner's final payment and the retainage the owner holds
  on us (Owner Billing), and a closed job leaving the board (open question 18). Each trade's
  closeout is built.
- Our billing to the owner, the rest: the owner's window still shows billed and paid from the
  fixture, not from the pay applications on **Bill the owner** (`ownerAccount` has the numbers);
  our own crew's percent read from its Pipeline job (typed on **Bill the owner** for now);
  a trade's retainage held until the owner has paid us ours (the Building lane's Closeout).
- No email is sent and nothing notifies anyone when a promised day passes.
- The portal's messages leave out the master agreement sent, the statement of work sent and work
  starting: the model keeps no day for them yet.

## Where it plugs into the app that exists

Do not build a second system for any of these. Each already exists and the prototype only
imitates it.

| GC mode piece | What exists today |
|---|---|
| The owner and architect record | `customers`, the Customer Hub (`/customers/:id`), the contacts ledger |
| A trade partner's portal | The sub portal ([`docs/SUB_PORTAL_ARCHITECTURE.md`](../../docs/SUB_PORTAL_ARCHITECTURE.md)): a link that is the key, sign-to-accept, percent done, EN/ES. It is keyed to a person today; GC mode needs it keyed to a company. |
| The statement of work | `step_commitments` (draft → offered → accepted → approved → settled) in [`docs/RUN_SUBS_PLAN.md`](../../docs/RUN_SUBS_PLAN.md). A statement of work is that, plus scope, a schedule of values, retainage and the plan set it is based on. |
| The master agreement | The Master Subcontract Agreement in the Contract library's Subs packet; work-order acceptance already binds to it. Contract Forms ([`docs/CONTRACT_FORMS.md`](../../docs/CONTRACT_FORMS.md)) covers the W-9. |
| Asking several companies and comparing | The supply-house price requests ([`docs/SUPPLY_HOUSE_RFQ_PLAN.md`](../../docs/SUPPLY_HOUSE_RFQ_PLAN.md)): one request to several houses, a link to answer, a compare. |
| The call log and promises | `bids_submission_entries` (every contact is an entry) and the payment promises (append-only promise events, v2.3280 to v2.3286). |
| Our price to the owner | The cover letter and the bid room: a signable link with options. |
| Waivers on a draw | The lien waiver train (v2.4274 to v2.4335), pointed the other way. Its four forms are the ones GC mode uses: conditional and unconditional, on progress and on final payment (`LienWaiverFormType`). |
| The map | The Bid Board's map and the app's geocoded addresses. The prototype draws its own from a short list of towns. |
| The pay application (702 and 703) | The Jobs Stages tab's AIA G702-G703 window: `aiaG702G703Template.ts` (fields and cells) and `fillAiaG702G703Workbook.ts` (fills the bundled xlsx). The prototype draws the form on screen; the real build fills that template. |
| "See what the trade sees" | Punch list #62, the same idea for the GC's room. |
| Email | Resend through the existing edge functions. |

## The code on the branch

`src/pages/GcMode.tsx` (the shell, the board, the row and the days-left block) and
`src/components/gc/`:

| File | Holds |
|---|---|
| `src/lib/gcMode/gcModel.ts` | The barrel: re-exports the model files below, so every import of `./gcModel` works. Add code to the file for its area, never here. |
| `gcTypes.ts` · `gcWords.ts` | The record shapes, every action and the state (drawn the way the tables would be: the first schema sketch) · money and date words. Neither imports anything. |
| `gcLookups.ts` | `planLabel`, `currentRev`, `partnerById`: the small lookups many areas read. |
| `gcPlans.ts` · `gcStart.ts` · `gcProgress.ts` | Plans, sheets, what a later set is called and who hears about it (tested in `gcPlans.test.ts`) · the Get started checklist · the ring and its hover card. |
| `gcBids.ts` · `gcCustomers.ts` · `gcMap.ts` | Compare all in, what we carry, our price, bid tabs, statement-of-work money · the company window's summaries · towns, the drive and the map's list. |
| `gcFollowUp.ts` · `gcBench.ts` | Promised days, word records, who to call first · the bench by trade and Actions for assistants. |
| `gcNewProject.ts` · `gcNewProject.test.ts` | New Project: the sheet index read from a paste, the trades guessed from the sheets (a later set uses the same guess, `packagesForSheets`), each trade's usual scope and each line's sheets (`guessLineSheets`, `lineSheets`, `linesOnSheets`), the project made from the draft (`createProject`), trades a later set brings · its kernel test. |
| `gcPortal.ts` · `gcPortal.test.ts` | What the portal tells one company: its home (every ask sorted into bidding, jobs and before, what needs it in order, its money), plan news for its trade, its promised day, its insurance, the lines the office could not read, each line's sheets and what a newer set changed (`portalLines`, on `lineReads`) · its kernel test. |
| `gcReducer.ts` · `gcReducerHelpers.ts` · `gcFixture.ts` | Every action applied to the state · its small helpers (not in the barrel) · the made-up data (`initialGcState`). |
| `gcModel.test.ts` | The golden test (see *Working in parallel*). |
| `GcOfficeTabs.tsx` | Trades (with Compare bids), Plans, Our number, Contracts, Draws, the flat company list |
| `GcTradePortal.tsx` | The trade partner's side: the frame, each trade's plans, bid, bid tab, statement of work and draws |
| `GcPortalBidExtras.tsx` | The bid form past the number: good for how many days, alternates, the company's own quote, answering the lines the office could not read |
| `GcPortalLineSheets.tsx` | The sheet numbers beside each line of the bid form, and the lines a new set touches |
| `GcPortalHome.tsx` · `GcPortalMessages.tsx` | The company's home in its portal, where the link lands, with the first-visit welcome · what we sent the company, each message carrying the link |
| `GcPortalPaperwork.tsx` · `GcPortalAgreement.tsx` · `GcPortalPlans.tsx` · `GcPortalUi.tsx` | The portal's paperwork block (insurance and W-9 forms) · the master agreement to read and sign · the plans window as a trade sees it · the portal's block, note and window |
| `GcTradeBench.tsx` | Trade partners by trade, Actions for assistants |
| `GcTradeMap.tsx` | The map window |
| `GcAskThread.tsx` | The contact log, promises, the Follow up tab |
| `GcNewPlans.tsx` | The new-set-of-plans window: its name, the sheets and their titles, a trade it brings, who hears, the email |
| `GcNewProject.tsx` | The New project window and its **+ New project** button |
| `GcBuildingPayApp.tsx` · `src/lib/gcMode/gcBuilding.ts` | The pay application window (progress and final), its door in the portal (which turns into the trade's closeout list) and its read-only view from Draws · the 702 and 703 numbers, the four steps, retainage held and each trade's closeout (tested in `gcBuilding.test.ts`) |
| `GcOwnerBillingTab.tsx` · `GcOwnerBillingPortal.tsx` · `src/lib/gcMode/gcOwnerBilling.ts` | Bill the owner: the owner's lines, the draft pay application, the ones sent and paid · what the owner sees · the lines and the 702 math, `ownerAccount`, our waivers and the trades' (tested in `gcOwnerBilling.test.ts`) |
| `GcCloseout.tsx` | The Closeout tab |
| `GcBuildingSendBack.tsx` | The Send back form under a waiting draw, and the list of what went back |
| `GcBuildingCrew.tsx` | The Our own crew card on Draws |
| `GcStart.tsx` | Get started |
| `GcBidTabs.tsx` | Bid tabs |
| `GcCustomerWindow.tsx` | The one company window |
| `GcPlansQuickLook.tsx` | The plans window |
| `BidsModeToggle.tsx`, `gcUi.tsx`, `gcIcons.ts` | The switch, shared pieces, two copied Bid Board icons |

Two existing files are touched: `src/App.tsx` (the `bids/gc` route) and `src/pages/Bids.tsx`
(the switch, for a dev only).

State of the branch: `npm run typecheck`, the theme check, the golden test and each lane's
kernel tests pass. Lint has
four fast-refresh warnings in `gcUi.tsx` (it exports style objects beside components). The UI is
checked by hand in the browser after every change; the model is pinned by the golden test.

## Working in parallel

Since 2026-10-02 several sessions build the prototype at once, one area each. Each lane is a
branch and a dev-server port of its own; `spike/gc-mode` is where the lanes meet.

| Lane | Branch | Port | Area | Files it owns |
|---|---|---|---|---|
| Board | `spike/gc-mode` (works on it directly) | 5237 | The Project Board and a project's office tabs: the row, the ring and its card, New here?, Trades and Compare bids, Our number, Bid tabs, Contracts, Get started, Follow up, Trade partners, the map, the company window | `src/pages/GcMode.tsx`; `src/components/gc/`: `GcOfficeTabs.tsx` (all but `GcDrawsTab`), `GcProgressRing.tsx`, `GcStart.tsx`, `GcBidTabs.tsx`, `GcAskThread.tsx`, `GcTradeBench.tsx`, `GcTradeMap.tsx`, `GcCustomerWindow.tsx`, `BidsModeToggle.tsx`, `gcUi.tsx`, `gcIcons.ts`; `src/lib/gcMode/`: `gcProgress.ts` (all but `buildingProgress`), `gcStart.ts`, `gcBids.ts`, `gcFollowUp.ts`, `gcBench.ts`, `gcMap.ts`, `gcCustomers.ts`, `gcTour.ts` |
| Portal | `spike/gc-mode-portal` | 5241 | The trade partner's portal: everything a company sees and presses | `src/components/gc/GcTradePortal.tsx`; new files `src/components/gc/GcPortal*.tsx`, `src/lib/gcMode/gcPortal.ts` |
| Building | `spike/gc-mode-building` | 5242 | Building and Closeout: reports, draws, retainage release, final waivers | `GcDrawsTab` inside `src/components/gc/GcOfficeTabs.tsx` (that function only); `buildingProgress` in `src/lib/gcMode/gcProgress.ts` (that function only); new files `src/components/gc/GcBuilding*.tsx` / `GcCloseout*.tsx`, `src/lib/gcMode/gcBuilding.ts` |
| New Project | `spike/gc-mode-new-project` | 5243 | New Project with the plans coming in, splitting the plans into trades, writing each scope; the plan sets that follow | `src/components/gc/GcNewPlans.tsx`, `GcPlansQuickLook.tsx`; `src/lib/gcMode/gcPlans.ts`; new files `src/components/gc/GcNewProject*.tsx`, `src/lib/gcMode/gcNewProject.ts` |
| Owner Billing | `spike/gc-mode-owner-billing` | 5244 | Billing the owner: our pay applications from the work the trades report, the retainage the owner holds on us, what the owner has paid | new files `src/components/gc/GcOwnerBilling*.tsx`, `src/lib/gcMode/gcOwnerBilling.ts`; the `OwnerBilling` record in `gcTypes.ts` (add fields only). It reads the trades' reported work (Building's) and never writes it; the owner window's billed and paid cells (`GcCustomerWindow.tsx`, `customerSummary`) stay the Board's to change |

**Shared files** — every lane may *add* to them; nobody renames, reorders or rewords what is there:
`src/lib/gcMode/gcTypes.ts` (new record shapes and fields, new actions at the end of `GcAction`),
`gcReducer.ts` (new `case`s at the end of the switch), `gcReducerHelpers.ts`, `gcFixture.ts`
(new made-up records), `gcLookups.ts`, `gcWords.ts`, the barrel `gcModel.ts` (one
`export * from './<your file>'` line for a new model file), and `gcModel.test.ts` (new steps at the
end of `STEPS`, new action types in its list). A lane that needs a way in from the board or a
project adds one entry point to `src/pages/GcMode.tsx` (a button, a tab) and nothing else there.
New calculations go in a new file for the lane's area, never in another lane's file.

**The golden test** (`src/lib/gcMode/gcModel.test.ts`) plays a scripted walk through every action
and pins what the main calculations say after each step. It must pass without `-u`. A changed
snapshot is a behavior change: only with the owner's OK, and the commit says which snapshots
moved and why. Adding made-up data moves *before any step*, *the whole state at the end* and any
step whose board-wide lists (Follow up, the bench, Actions for assistants) include the new
records: that is expected, and still asked for and named. A new action gets a step at the end of
the walk (new snapshots are written; existing ones must not move).

**The integration rule**

- `origin/spike/gc-mode` is where lanes meet. Never force-push it.
- Start each change with `git fetch origin && git merge origin/spike/gc-mode`.
- To share: commit on your lane, fetch and merge `origin/spike/gc-mode`, run `npm run typecheck`
  and `npx vitest run src/lib/gcMode`, then `git push origin HEAD:spike/gc-mode` (fast-forward
  only; if it is rejected, fetch, merge, retry). Push your lane branch too.
- The Board lane shares with `git pull` then `git push`.
- A changed golden snapshot is a behavior change: only with the owner's OK, and say which.
- Each lane keeps a session card in the main checkout's `.claude/sessions/active/`
  (`spike-gc-mode*.md`).

**Ports.** `.claude/launch.json` is gitignored, so it does not ride the branches: the five
configs (`dev-5237`, `dev-5241`, `dev-5242`, `dev-5243`, `dev-5244`) live in the main checkout's copy. A lane
whose worktree has none copies it from `/Users/todd/Documents/GitHub/pipetooling.github.io/.claude/launch.json`.
Never start another lane's port.

## The plan, when the shape is settled

1. **Schema from the model.** Projects reuse `projects`; new: plan sets and their sheets, trade
   packages, invitations with their contact lines, quotes, bid tabs, statements of work with a
   schedule of values, draws. A company-keyed trade-partner record with coverage. Every table
   with RLS and the two read-only block calls (`CLAUDE.md` → DB migrations).
2. **The kernel with tests.** Lift the selectors out of `gcModel.ts` into tested kernels:
   comparing bids, who is emailed, the follow-up order, the start checklist.
3. **The board and one project, read-only**, on real data, behind the dev gate.
4. **Invitations and the company portal** (the sub portal's pattern, keyed to a company).
5. **Plans: sets, the email, who opened it.**
6. **Compare, carry, our number.**
7. **Award, master agreement, statement of work, Get started.**
8. **Draws and waivers.**

Each step ships alone with its release note, docs fragment and help guide. The help guides
follow the plain-words rules; the prototype's own words were written to them as far as possible.

## How to verify (the walk used on 2026-10-02)

- **Boerne Retail Shell**: Trades → Compare bids on Electrical; type a cost on Concrete's rebar
  and watch the conclusion flip. Structural steel → On a map → Cannot do it → ask the next.
- **Plans → A new set of plans came in**: paste three lines with sheet numbers; issue; in the
  portal as Alamo Concrete tap the plans line under **Needs you** and press **My number stands on
  the new plans**. Then type "S301 is a new
  canopy framing sheet. L-101 adds a landscape plan": give S-301 its title and watch Structural
  steel ticked, press **Add Landscaping**, issue **Addendum 2**. Landscaping sits after Sitework
  on Trades. On Helotes the next set opens as **Bulletin 1**.
- **Our number → We sent our bid**, then **Bid tabs** opens. **We won this** moves it to Buying out.
- **Helotes Dental Office → Get started**: from 14 of 24 steps to Start, signing as each
  company through **Sign it as them**. A new plan set after Start goes to four companies only.
- **Follow up**: log a call with a new day on Hillside Excavation and watch the card move down.
- **Stone Oak Pharmacy → Bill the owner** (the job at its end, under Building): the closeout
  waits on Cool Breeze. In the owner's portal press **Accept the work**; as Cool Breeze send the
  warranty letter and the final pay application; then **Send the final pay application** and
  **Pay** it in the owner's portal. Their papers end with our waivers on final payment.
- **The portal's home**: see it as Voltage Brothers (a number on old plans, then the insurance that
  ran out, both red), Brightline Electric (one job, one bid), Hill Country Interiors (Helotes:
  money paid and held). Tap the insurance line: the certificate form opens in place.
- **+ New project**: pick an owner, **Paste a made-up sheet index**, see 21 sheets and 13 trades,
  change a scope line, **Create the project**. It opens on Trades and sits under Bidding to the
  owner with its days left. On Electrical, Lighting reads from E-101; add E-201 to Devices, then
  the plans window under E-201 lists Devices.

## Where it stands

2026-10-02: one session, the owner steering. He said "I think this has great potential" and has
been changing it screen by screen since. The last things built were the new-plans flow and Get
started. The prototype is a branch, not a PR: it should not merge as it is (fixture data inside
the client, one golden test and a few kernel tests). Since the evening of 2026-10-02 several
sessions build it at once (*Working in parallel*).
