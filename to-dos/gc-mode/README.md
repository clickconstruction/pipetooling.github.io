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

## Words: customer and owner (the owner, 2026-10-04)

"Sometimes we are working for the owner, sometimes we are working for another GC or an owner's rep
who then works and bills the owner." So:

- **Customer**: whoever hires us and pays us. That is the owner, another general contractor, or an
  owner's rep. Every screen that means "who we bill" says customer: *Bidding to the customer*,
  *Bill the customer*, *Price to the customer*, *the customer's portal*, *our contract with the
  customer*. Spanish: *el cliente*.
- **Owner**: only the property's owner, when it is not our customer (`propertyOwner`).
- Code names stay as they are (`owner`, `ownerBilling`, `sendOwnerPayApp` …): only the words on screen
  change.

## What the prototype has (walk it in this order)

| Where | What it does |
|---|---|
| **New here?** (top right) | An 18-stop spotlight walkthrough of the Project Board (the three stages as a numbered list with the board's titles marked 1, 2, 3, the ring and the days left each lit on their own, Who to call, + New project, Closed and Lost, By stage or by customer, Trade partners and the scope book): each stage's question, what you do in it, how it ends, then where to try it. Stops in `src/lib/gcMode/gcTour.ts`, on the app's `SpotlightTour`. |
| **Walk me through this job** (a project's tab row) | A 14-stop walkthrough inside one project, a stop on each tab in the order a job goes (Trades, Plans, Our number, Bid tabs, Contracts, Get started, Submittals, Schedule, Daily log, Draws, Bill the owner, Closeout) and on See what the trade sees (`GC_PROJECT_TOUR_STEPS` in `gcTour.ts`). *New here?* opens itself on a first visit, once per browser. |
| **+ ?** after a number | A quote that leaves out work with no cost set still counts that work as $0 in its all-in number, so every place that number shows says "+ ?": Trades' *Lowest, all in* and *We are carrying*, Compare bids' *All in*, the *Award at* buttons, Our number's *Carried*, *Trades* and the price, and the price on the board row and the project header. Hovering names the work ("1 line has no cost yet: roof curbs."). Against our budget reads "at least $X over" or "not known yet". Setting the cost in Compare bids clears it. `uncostedLines`, `carriedUncosted`, `proposalUncosted` in `gcBids.ts`; the totals themselves are unchanged. |
| The price card (the owner's pick B, 2026-10-04) | On a bidding job's board row the line reads "so far, with 4 holes", with "about $1.42M with every trade in" under it: each trade with no number at its lowest good quote, else our budget (our own bid at its figure so far), with contingency and fee. The line opens the card (the red coverage chip opened it too, until the Board folded the row's chips into its "N to call" pill, 2026-10-04): hover or focus opens it, a click keeps it open, Escape or a click outside closes it, a sheet from the bottom on a phone. It lists every trade by what happens next, with the button: *Pick a quote to carry* (**Carry Kendall Air**), *Waiting on an answer* (who has not opened it, who said no, the day quotes are due; **Open Follow up**), *Nobody asked yet* (**Who to ask**, **Use our budget**), *Our own bid to price*, *A number with a gap*, *A quote that ran out*, *Our guess*, *A real number*; then the price so far and about once every trade is in. Its counts follow the old chip's rule (Boerne: 3 real, 1 missing a cost, 4 with no number). `priceStanding` (`gcPriceStanding.ts`), `GcPriceCard.tsx`, `usePriceCard.ts`; built by Building on the Board's row. Mock-up: artifact NWQ1rueiKahZCQ3r6cp2vf. |
| What changed under a quote | A quote priced on older plans says what each newer set changed, set by set, from the New Project lane's line sheets: "Addendum 1 changed panels and feeders, and the trade as a whole." · "Addendum 1 changed the HVAC sheets." · "Addendum 2 added detention pond." (`staleChange`, `staleWords` in `gcStale.ts`). On the ring's card, Compare bids' *Plans they priced* row and its *Ask them to confirm* message, and the hovers on Trades' *old plans* and the Plans tab's *needs confirming*. Compare bids' own sentence keeps "They priced an older set of plans". |
| **Money** (board tab) | After Trade partners: the Owner Billing lane's `GcOwnerBillingMoney`, money across every job that is ours ("Across our 3 jobs we are $80,428 ahead", the totals, who owes us, each job with *Bill the owner*, which opens that project on its Bill the owner tab), and the next six weeks of money in and out (`cashAhead`). In the real build, for the owner and the controller only. |
| Alternates and numbers that ran out (question 14, the Board's call) | Compare bids' Alternates row has **Take it** / **Put it back** on each alternate (`takeAlternate`): a taken one moves that quote's all-in number (`takenAlternatesTotal` in `leveledTotal` and `compareBids`) and so what we carry; one not taken changes nothing. A quote past its good-until day (`quoteRanOut`) stops counting toward the two quotes and is not a real number to carry ("Their number ran out. Ask them to send it again."; the price card's "ran out") until the trade sends it again from the portal. |
| **By stage \| By customer** (top of the board) | Question 9. By stage is the board as it was, and it is what the board opens on every time (not remembered). By customer gives one section per customer we build for, soonest bid first: the name opens the company window, its kind and contact, and the window's money ("bidding $977,823 · under contract $1,488,762 · owes us $288,879", or "nothing billed yet"). Each customer's jobs sit under a small heading for each stage they are in (numbered and colored like the stages), in place of a chip on each row. Closed and lost jobs fold into one quiet "Also:" line under the customer. + New project sits beside the switch. `customerGroups`, `customerMoneyWords` in `gcBoardGroups.ts` (tested). |
| **The strip** (top of the board, stays in sight as it scrolls) | The owner, 2026-10-04: "just like on jobs stages I would like to see a header and these stages better broken down … so it's easy for a user to jump to a stage", then "once a user clicks on By customer, we should change the header". By stage: a pill per section, 1 Bidding to the customer → 2 Buying out → 3 Building · Closed · Lost, each with its count; pressing one jumps to its section, and the section in view is lit as the board scrolls. Each section opens on a heading band in its stage's color (the rings' amber, blue, green): its number, name, count, worth ("$977,823 priced so far", "$338,767 under contract") and what the stage is for. By customer: the strip lists the customers instead, each with a dot in the color of each stage it has jobs in, and jumps to that customer's heading band. On a phone the pills take a row of their own and scroll sideways. `boardSectionCounts`, `boardSectionWorthWords` in `gcBoardGroups.ts` (tested), `GcBoardStages.tsx`. |
| **Who to call** (the row's middle column) | The owner, 2026-10-04: "everything in this column are follow up actions … say number of people to call and then when a user hovers over it they see the details, much like the circle" (mock-up `people-to-call-mockup.html`; he said build it). One pill per row counts the people we are waiting on, each once: "6 to call · 2 late", red when anyone's day passed, amber when it is today, grey while all still have time; "✓ Nobody to chase" when none. It behaves like the ring: hover opens the card, a click pins it, Escape or a press elsewhere lets it go, a tap opens it on a phone. The card lists each person late first, with every reason under the name (a quote day passed, never opened the ask, has not opened the newest set, quoted before it and should confirm, a statement of work to sign, a pay application sent back twice, a waiver owed, insurance run out on a trade we hired, a day they gave on this job) and the last thing said; the architect counts for questions waiting on them, and the customer once our bid is out and for a change order waiting on their signature. Our own moves (a draft not sent, pre-bid minutes) stay off it: the ring lists those. **Call** dials and opens the Follow up sheet on "What did they say?"; **Follow up** opens it on a draft from you; **Work the list** opens it at the first. The sheet (the Building lane's) walks just this job's people, each with this job's reasons ticked (`projectFollowPeople`), the architect and the customer included: a call or message with them goes on their own record. **Open Follow up** opens the tab. **The counts match** (the owner, 2026-10-04): Follow up's badge, its Work the list and the dashboard's Needs you count `allPeople`, the board rows merged with each person once, plus what a company owes apart from a job (a W-9, insurance run out, a paper's day). Today 9 = 6 + 1 + 2, and 5 late = 3 + 0 + 2: a company we already call on a job also hears about its insurance there. Follow up lists everyone it counts: its quote cards, its papers, and **More to follow up on** for the rest (the architect, customers, the newest plans not opened, waivers, late bills), by job; Work the list walks them all (`allFollowPeople`). The price, plans, statements of work, "to call" and "sent back" chips left the row: the ring, the price line (which opens the price card) and the card say them. Pre-bid and lost chips stay. `projectPeople` in `gcProjectPeople.ts` (tested), `GcPeoplePill.tsx`; New here? has a Who to call stop. |
| **Trade partners: the trade strip and trade headings** | The owner, 2026-10-04 (relayed by the Portal lane): "Just like in the project board, I think that we should offer headers for this, showing each of the trades." By trade opens on the same kind of strip: a pill per trade with its to-dos across every standard (a red dot when it is short on quotes), which jumps to that trade's card and lights the one in view. Inside Actions for assistants, each standard's to-dos sit under a heading per trade. `tradeTodoCounts`, `itemsByTrade` and each item's `trade` in `gcBench.ts` (tested; the walk leaves `trade` out), `useJumpStrip` shared with the board. |
| **GC follow up on the dashboard's Needs you** | The owner, 2026-10-04: "I would like for the follow-up on this page to be exposed on the Needs you list of an assistant's dashboard." One item for the dev and assistant-like roles: "5 to follow up on in GC mode", the first three by name and why ("Hillside Excavation is late on their word · Tejas Power promised a quote today · Bexar Steel Erectors never opened the ask"), red once a day has passed, amber before; **Follow up** opens GC mode on its Follow up tab (`/bids/gc?tab=followup`). Its count is the Follow up badge's, which is the board rows' sum (the owner, 2026-10-04: "make them match"): `allPeople`, everyone we are waiting on across every job, each person once. The page's state now lives in one store for the session (`gcStore.ts`, `useGcStore`), so what is done on Follow up changes the dashboard's count without a reload; a reload starts over, as before. The GC model loads on the dashboard only for the roles that see the item. `gcNeedsYou.ts` (tested), `useGcFollowUpNeeds`, item `gc-follow-up` in `dashboardNeedsYou.ts` (tested). The real build reads the real follow-ups instead. |
| The owner's price once signed | The owner, 2026-10-04 (Owner Billing): once our contract with the owner is marked signed on Get started, their price stays what they signed (`ownerContractWorth`, kept by `setStartItem` and dropped if it is marked not signed). The board row and the project header show that price plus their signed change orders, "as signed", with no "+ ?" or holes (`priceToOwner` in `gcCustomers.ts`, which the company window's and By customer's *under contract* read too). Our number keeps today's carried price (*At today's numbers*) and says "Dr. Priya Raman signed for $338,767. Their price stays that." with how far under or over it today's numbers are. |
| Vetting a company new to us (question 3) | *Add a company* on Trade partners leaves *We have worked with them* off by default: the company comes in **not vetted yet** (`addPartner` with `known: false`). It can be asked and can quote; every award button (Compare quotes, Contracts, Get started) stays off and says why (`awardGate` in `gcVetting.ts`; the reducer refuses too). Trade partners opens with **New to us: approve before any award**: their portal form (license, insurance, years, references, jobs like ours, from the Portal lane), who is deciding (our team), and *Approve*, *Approve up to this* (a dollar limit on one award) or *Decline* (`vetPartner`). The chip ("not vetted yet", "approved up to $150,000", "declined") sits with each company's paperwork. |
| Insurance, papers and other promises (question 8) | Follow up ends with **Insurance, papers and other promises**: a policy that runs out within 30 days or ran out (`insuranceRenewals`), a W-9 missing for a company we awarded, a statement of work waiting on its signature (`paperAsks`), then every open promise of any lane's kind. *They said by* + *Write it down* records the day (`recordPromise`); a new day moves it and the old one is kept. The portal's own move keeps it (`promisesKeptBy`: a new certificate, a signed W-9, a signed statement of work, and Building's moves, see question 8); *It came* marks the rest. Kept and broken promises count in the company's word record; the Follow up badge adds promises whose day came and lapsed insurance with no day given. `gcPromises.ts`. |
| Who awarded it, and Start anyway (question 7) | Every award button has an *Estimator* pick (`GC_COMPANY.estimators`; any estimator on our team may award, the owner, 2026-10-04). `award` keeps `awardedBy`, the log says "Rosa Treviño awarded Sitework to Lonestar Earthworks", and our copy of the bid tab says "awarded by Rosa Treviño" (the trades' copies say only "awarded"). Get started has **Start anyway** under the missing list: a reason and who, then the job starts with what was missing kept as `startedAnyway` and listed as "Still owed", and the owner and trade steps stay open to finish. |
| The trade's own schedule of values (question 4) | A quote can carry the trade's own schedule of values (`SubBid.sov`, from the portal's quote form; often rough-in, top out, trim). Award copies it onto the statement of work (`Sow.theirSov`), and a trade awarded without one sends it later from its portal (`tradeSendSov`). Contracts shows **ours beside theirs** (`GcSovSideBySide`): our lines with what is billed, theirs with each line's share, and where the money claimed stands on theirs ("Claimed $89,000 to date: through Underground and gear, 19% into Rough-in.", `stageReached` in `gcTheirSov.ts`). Draws stay by percent with retainage on our lines. Pecan Valley on Fair Oaks D electrical has one in the made-up data. |
| The map's list order (question 7) | `tradeLineup` runs the companies that go this far first, then the most reliable (`compareReliability` in `gcReliability.ts`: answers when asked, then about half the time, then not judged yet, then mostly silent; then how often their word held; a declined company last), the shorter drive breaking a tie. The map's numbers, Who else?, Next in line and New project's ticked companies all follow it. |
| Interest in the company window | Owner Billing's interest on late bills (`ownerInterest`, summed over the customer's jobs) gets its own *Interest on late bills* stat beside *They are holding*: billed, then paid, owed and "built up, not billed yet". The contract numbers (*They owe us now*, `customerSummary`) leave interest out (Board and Owner Billing, 2026-10-04). |
| Why a company is out | *Will not do it* and *Cannot do it* (Follow up, and the trade map) ask why first (the owner, 2026-10-04): a quick pick (too busy, too far, too big or too small, not their kind of work, our terms or bonding or insurance, something else) and their words. It stays with the job (the Trades tab and Compare quotes chip: "will not do it · too busy", the words on hover) and with the company (its asks on Trade partners). `officeDecline` takes `reason` and `note`; `Invite.declineReason`; `gcDecline.ts`. |
| Exclusions by company (Round 5) | The owner, 2026-10-04 (`vendor-exclusions-before-after.html`): a quote carries its own exclusions (`SubBid.exclusions`, from the portal's quote form, or *+ Exclusion from their quote* for an emailed one, with a unit price like rock at $38 per cy). Compare quotes' **Their exclusions** lines every company up on every exclusion any of them named: excluded with a cost to cover it (into *All in*; `exclusionCoversTotal` in `leveledTotal`), included, not said (*Ask them*, *It is in their price*, *They leave it out*), expected (a Known exclusion). The sentences and the lowest follow ("Tri-County Site is lowest for the same work"). The statement of work says **What they will not do** (`Sow.excluded`, at award). Trade partners shows what a company usually excludes ("permits and fees, 5 of 6"). `gcExclusions.ts`. |
| **Lost** (board section) | *We lost this* on Our number (beside *We won this*): why, in Trades mode's loss reasons in GC words (price, another builder, project died, we never finished, no answer), who won it if we know, a note. The bid keeps its stage ('pursuing'), leaves Bidding for **Lost** at the bottom of the board (newest first, "lost" and the day in the block, the reason and the winner as a chip), and nobody is chased on it (`packageIsOpen`, `partnerAsks`); the company window counts it in *They picked us* and drops it from *in front of them*; its bid tabs say the owner picked another builder. *Bring it back* returns it to Bidding. `markLost`, `reopenLost`; `gcLost.ts`. |
| **Closed** (board section) | Under Building: a job whose `closedOn` is set (the Building lane's *Close the job* on Closeout, once every trade is closed out and the owner paid our last bill). Newest closed first; the block beside the ring reads "closed" and the day; the project header shows a grey Closed chip; *New here?* has a stop for it. The job keeps its stage ('building'). |
| The schedule on Get started and Trade partners | Get started has a step of its own, *The schedule is drawn* ("19 activities, 2 milestones" once drawn; *Draw it on Schedule* opens the Schedule tab). It counts toward the ring and Start stays shut until it is done; the first change after Start keeps the plan at Start as the baseline (the Building lane's `withBaselineKept`). Trade partners shows each company's record on our jobs under how they answer: "On our jobs: 3 of 4 milestones on time · look-ahead 73%" (`partnerScheduleRecord` in `gcPartnerSchedule.ts`, from the Building lane's measures). |
| The ring on each row | How far the project is through its stage (`stageProgress` in the model; `GcProgressRing`). Hover it, tap it on a phone, or tab to it: a card lists what the ring counts by type, what is left in each spelled out, what is done in one line, and an *Also* list it does not count. Each section's title says what to do (the owner, 2026-10-04). Bidding: *Get 2 quotes for each trade*, *Pick the quote we'll use for each trade*, *Confirm quotes after plan changes*, *Send our bid*. Buyout: the Get started checklist by kind of step (*Our contract, permit and start date*, *Award each trade*, *Get the master agreement signed*, *Get current insurance*, *Get each W-9*, *Get the statement of work signed*). Building: *Draw the schedule*, *Trades report their work*. Building: work reported per trade, weighted by its statement of work, and our own crew's percent weighted by our own number; draws and waivers waiting under *Also*, an approved draw with the day to pay it by, and one past that day first after the schedule. |
| **How the stage is going** (under a project's title) | The owner, 2026-10-04: "at the top of this page we should have some sort of visual that describes the health of the stage" (he took the revised design in `stage-health-mockup.html`). One strip, the same shape in every stage: where the job is in its life (Bidding, Buying out, Building, Closed), a verdict (**On track**, **Watch** or **Behind**) with its reason, **Next:** the one thing to do (it opens the tab), the stage's calendar (the owner, 2026-10-04: "squares for days separated with a little bit of space where one week becomes the next"; `bid-calendar-mockup.html`): a square a day, the weeks apart, Saturday and Sunday narrow, each day carrying what happened on it (a green dot a quote in, an amber mark a question, a hollow dot a quote promised by that day, "A1" on an addendum's day; the hover lists it all) under a count ("5 working days left, counting today · 9 of 14 quotes in · 2 questions open"). Bidding runs from the bid set to the bid date, with **Questions close · quotes wanted** three days before it (`quotesWantedOn`, the day we want every quote, so the quotes can be levelled). Buying out shows the last three weeks to the start date (papers coming in as dots), or *No start date* dashed with **Set a start date** right there. Building is a square a week, the months apart: the dry-in week red when late, the next milestone amber, the finish ringed. A week with nothing in it is one rectangle with its dates (the owner, 2026-10-04: "take weeks with no action and show a single rectangle for that week instead"; `quiet-weeks-mockup.html`): "5 working days" ahead, "nothing came in" gone by, dashed red with "No start date" on a job with no last day (`weekIsQuiet`, `weekWorkingDays`). A busy week shows both ends ("Sep 28 – Oct 4") and a weekday letter over each square, and its labels sit in their own lane under the squares: they never move a square, and one that would touch another drops a line. A strip too narrow for the full squares takes smaller ones before it scrolls. On a phone the weeks stack as rows of a small calendar, a quiet week one row, with the key dates listed under it, one tile a trade (bidding: its number and quote dots, amber on old plans; buying out: its five papers, red waiting on us, amber on them; building: its percent and what waits), and a few numbers. Building adds work done against the plan, time used, billed against the work in place, and paid; the money rows are marked for the owner and the controller in the real build. The verdict rules: bidding is behind with a trade that has no quote inside 7 days of the bid, or anything left inside 2; buying out is behind inside 7 days of the start with a trade not ready, and watched with no start date; building is behind past a 7-day slip, watched with any slip, a late milestone or a failed inspection (`HEALTH_*` in `gcStageHealth.ts`). A trade has a number by the ring's rule (`tradeHasNumber`: no line without a cost, not run out), and the header's Trades count now uses it too. `stageHealth`, `GcStageHealth.tsx`. |
| **Project Board** | Projects in three sections: Bidding to the owner, Buying out, Building. Each row leads with the days left before our bid (red inside a week, amber inside two), then the name, the owner and architect (each a link), chips, the Bid Board's folder and plans icons, and the price. |
| **+ New project** (beside *Bidding to the owner*) | One window in five steps, each feeding the next. **The project**: name, address, town, customer (with **+ Add an owner different from the customer** for a property owner who is someone else) and architect from the one customer list ("Someone new" makes a record), bid due, size. **The plans**: the set's name (Bid set, Pricing set, Permit set or typed), the day it came in, the sheet index pasted from the cover sheet and read as you paste (A-101, A101, A1.01, FP-101; capitals become sentence case; a line not read is listed), and the project manual's table of contents read as sections by division. **The trades**: guessed from the sheets and the sections, in the order the specs list trades, each with the sheets and sections behind it; untick, add, mark **Ours**, a budget. **Each scope**: each trade's usual lines to change and what it leaves out (**Known exclusions**, with who does each; gaps between the trades flagged with **Add it to …**), each line with the sheets and sections it reads from (guessed from its words, × takes one off, **+ add** adds one; no sheet means the trade's sheets as a whole); Enter starts the next line. **Who to ask**: for each trade we hire out, every company that does it, closest first, with its drive, how it answers asks and any missing paperwork; the closest three in range come ticked. **Create the project** puts it under Bidding to the owner, sends each ticked company the board's invitation, and opens it on Trades. **Paste a made-up sheet index** and **Paste a made-up table of contents** try it. On a phone the five steps are a row of numbers with the open step's name beside them. |
| Plans icon on a row | A plans window over the board: newest set first, the sheet list by discipline, what the last addendum changed, arrow keys flip sheets, and under each sheet the scope lines that read from it. Drawings are stand-ins. |
| Owner or architect name | One company window, shaped by what the company is to us: an owner gets money, how they buy and pay, projects we build for them; an architect gets addenda and questions waiting on them. One call log either way. An owner's **See what they see** and its *Customer's portal* chip open the window's **Their portal** tab (next row). |
| **The company window: About, Activity, Documents** (trades too) | The owner, 2026-10-04: "click on any of the paperwork buttons and have that paperwork appear", with information, a ledger and documents in three tabs (mock-up `company-window-mockup.html`, revised after asking whether it was the best we can do). One window for every company, not a second one for customers. Every paperwork chip on Trade partners and on a trade's quotes opens its company at that paper. A company's name opens it too: on Trade partners (About), on a job's Trades tab and its waiting list, Compare quotes' columns, the Plans tab's table and Contracts (that statement of work); on Follow up, a card's or a promise's name opens Activity with that promise lit and scrolled to. **About**: jobs with us, under contract, paid to them, what we hold; how they answer, their look-ahead record, what they usually exclude, vetting and insurance, their work with us, the times they passed and why. **Activity**: one timeline, newest first, merged from what the model already keeps (each ask's calls and notes, quotes, why they passed, the award with its day and who, promises and our own asks and sends, statements of work, draws, pay applications we sent back, change orders on their trade, daily-log delays, the master agreement, the company form, and what they did on the job: their submittals and the architect's answers, their punch items fixed and checked, and inspections that failed or passed on their work, Building's `buildingActivity`), filters (calls and notes, quotes and bids, paperwork, money, on the job), a link to each job, and **Log a contact** (`logPartnerContact`). **Documents**, status first: their company papers (master agreement, insurance, W-9, the company form), each job's papers (statement of work, pay applications, lien waivers) and their quotes; *N to get* on the tab counts what is missing or running out; **Ask for it** writes a promise due in a week that Follow up chases (an open one shows *asked · due Fri Oct 9*); picking a paper shows a made-up copy beside the list (the real build opens the file), and a W-9's tax number is never shown. **Send a paper** (the owner, 2026-10-04: "make this page actionable where a user could request that agreement"; mock-up `send-a-paper-mockup.html`): each paper a trade owes has one button for its next step (**Send to sign**, **Remind them**, **Ask for it**, **Ask for the waiver**; a signed or current paper has none). It opens the send in the paper's place: who it goes to and in what language, a *Sign by* or *Send by* day (in 3 days, a week, two weeks), a line of your own, and the email exactly as they will get it, with the paper attached; **Cancel** or Escape goes back to the paper. Sending writes the promise with its day (Follow up chases it after; signing or sending keeps it), puts the email in their portal's *Their messages*, adds a line to Activity, and puts "Reminded today · sign by Fri Oct 9" on the row. The first master agreement or statement of work is the same send the Contracts tab makes, and its email says the sign-by day and your line (`firstSendLines`; one sent from Contracts reads as before). A customer's window does the same for a change order waiting on their signature: **Remind them** on its Documents row, the day, your line and the email (`remindCustomer`, `gcCustomerSend.ts`, tested); it notes the reminder on their record, puts "Reminded today · sign by …" on the row, and counts the customer in the job's Who to call, red once the day passes. **Our contract** (the owner, 2026-10-04: "they sign it in their portal"): on a won job, the customer's contract row has **Send to sign**, then **Remind them**; Get started's contract line opens the same send (and keeps **Mark it signed** for one signed on paper) and reads "sent Oct 2, waiting on their signature". The first send turns their portal on. Their portal leads with *Your contract · to sign* (the job, the price, the sign-by day, **Sign the contract**); signing checks it off on Get started and keeps their price as signed. While it waits, the customer counts in the job's Who to call. `sendOwnerContract`, `ownerSignContract`, `GcCustomerContractSign.tsx`. **A late bill** (Owner Billing's rules and words, `gcOwnerBillingRemind.ts`): each pay application past its due day is its own row on the customer's Documents ("2 days late · $288,879 open") with **Remind them**: a pay-by day five days out (our ask, never their promise), the email as they get it, and "Reminded today · pay by …" on the row after. The customer counts in the job's Who to call, red, while a bill is late. It replaces the old *Ask for it*, which wrote a promise and sent nothing. `gcPaperSend.ts` (tested), `GcPaperSend.tsx`, action `sendPaper`, promise kind `msa`. **Their portal** (the owner, 2026-10-04: "see the customer's portal and if it is active or not yet"), the fourth tab, says it in its name (*Their portal · active*, *not opened yet*, *off*, *no link yet*): a status card with the last thing they did there or the day the link went out, the link with **Copy link**, and the portal itself beside it, live, as they see it. A trade's is its trade portal, fixed to that company (`partnerLocked`); a customer's is the Owner Billing portal, one job at a time with a job picker, and **Turn it on and send the link** / **Turn it off** (`setCustomerPortal`). An architect has no portal tab. `gcCompanyPortal.ts` (tested). On a phone the tabs are one row that scrolls. A customer or architect keeps everything it had under About; its Activity merges our calls, bids, wins and losses, pay applications and change orders, and its Documents hold our contract, the pay applications we sent and the change orders. `gcCompanyFile.ts` (tested), `GcCompanyWindow.tsx`, `GcCompanyFile.tsx`, `gcCompanyOpener.ts`. |
| **Trades** tab | One row per trade: who we asked with each bid in thousands, our budget, the lowest all in, what we carry. **Compare bids** opens the comparison. **On a map** opens the map. |
| Compare bids | Sentences first ("Voltage Brothers bid $166,000 and left out fire alarm. Covering that adds $14,000, so they come to $180,000."), then the table behind them: is each piece of work in their price, a cost to cover what is not, the all-in total, who is lowest. |
| On a map | The project in the middle, every company in the trade as a numbered pin (closest first), the same companies in a list beside it to work down. "Will not do it" / "Cannot do it" moves you to the next closest. |
| **Plans** tab | **A new set of plans came in**: name the set (Addendum, Bulletin, Revised set, Permit set, Construction set, or typed; addenda and bulletins count apart), paste what changed, sheets are read out of the notes (A-401, A401, A1.01) and matched to the index, a sheet new to the set gets its title, trades guessed from the sheet letters and titles, spec sections read out of the notes the same way (a section new to the manual gets its title), a whole set (Revised, Permit, Construction) pasting its new index and table of contents to see what is new, gone or renamed, **Take it out** / **Keep it** on any listed sheet or section, the lines left with nothing to read tied to another sheet, a trade the job does not have yet can come with the set (its usual scope, a budget; nobody asked yet), the scope lines it touches per trade and **+ Add a line this set brings** for work the set adds to a trade, the list of who is emailed, the email preview (it names the lines it touches). Then a table: told, opened, their number (needs confirming or good). |
| **Our number** | Carried trades + general conditions + contingency + fee = the price to the owner. **We sent our bid**, **We won this**. |
| **Bid tabs** | After our bid is in, each trade's quotes go back to the companies that quoted, low to high, their own row marked, names hidden unless ticked. |
| **Contracts** | Per trade: paperwork chips, award, the statement of work drafted from the bid, send, sign. |
| **Get started** | The checklist before work starts: owner contract, permit, start date, and five steps per trade. Start stays shut until nothing is missing. |
| **Draws** | Percent reported per line, a draw asked from the portal with its pay application (the 702 and 703) and a conditional waiver, approve, pay, unconditional waiver. **Pay application** on each draw opens the signed form read-only. **Send back** returns a waiting draw with a note and the percent we see on each line we doubt; the trade gets **Fix and resend** in its portal, our numbers filled in, and the fixed one comes back marked "revised". A trade our own crew does shows as **Our own crew** with its percent and its Pipeline job: no draws there. A change order the owner signed shows on its trade's card with **Send the change to** the company; the company signs it in its portal (**Sign the change**) and it becomes a line of its own on their statement of work, reported and billed like the others. Contract and the 702's line 2 count it. Each draw shows the day asked, approved and paid, or the day to pay by (red once late); **To pay** on top lists the approved draws not paid yet, late first (`drawPayDays`, `drawsToPay` in `gcBuildingPay.ts`). |
| **Bill the owner** | Our pay application to the owner, once a month: one line per trade with the work its company reported, each carrying its share of our general conditions, contingency and fee ("Their price $64,200 plus $23,852 of our costs and fee"). No fee line. Done so far, less what the owner holds, less what we asked for before, is this bill. **Send to** the owner keeps it as it went, and next month's starts from it. **So far with** the owner lists what went, with **Mark paid**. A trade our own crew does (plumbing) shows what **Draws → Our own crew** reports, its stages read-only. **Waivers with this bill** says whose waiver is missing. **See what the customer sees** puts their portal (with **Their messages**: every email we send them on the job, written out, newest first: our contract and change orders to sign, each bill sent, certified, paid and reminded, interest bills, the ask to accept the work; `customerMessages` in `gcOwnerBillingMessages.ts`; nothing is sent) beside it: their contract, each bill with every line and **Pay**, and their papers (our lien waivers and the trades'). A trade's pay application we sent back bills what we see on the lines we doubt. **Money in and money out**: what the owner has paid us beside what we have paid the trades ("So far we are $35,957 ahead"), what each side owes and holds, each trade on request; our own crew and general conditions have no cost here. A certified bill shows when it is due (their promise, or the day we expected it), red once late, with **They paid part…** and **They said when…**; "So far with" says what is late. Each sent bill waits on the architect, who certifies it in **See what the architect sees** (their portal: **Certify $X**, or **Certify less** with why); **Mark paid** and the owner's **Pay** open once certified, for the certified amount. **Pay application** on each bill (and **See the form** on the draft) opens it as the AIA G702 and G703, from us to the customer via the architect (naming the project's owner when it is someone else, `propertyOwner`), with the notary block under our signature, **⤓ Excel** (the template the Jobs Stages tab fills, every line on the 703) and **⤓ PDF**; materials a trade stored on site (its newest pay application's column F) go in our column F on its line, at its cost: our costs and fee follow once they are in place, and the owner holds retainage on them; the owner gets **⤓ Pay application** in their portal. **Change orders**: draft one (description, reason, whose work, the days it adds to the job, added work or a credit, what it costs us, what it adds), **Send for signature**, and the owner signs or declines in their portal; a signed one is its own line on the bill. Once every line is billed, **Closeout with** the owner replaces the draft: every trade's final, the owner's **Accept the work**, then **Send the final pay application** for what they hold. **Retainage**: what the owner holds, to the end or dropping partway, ours to choose with a preview of the next bill. **Finish date**: the contract's day beside the schedule's, days to spare or past, and the money at risk at the contract's late fee. **Interest on late bills**: off, or a rate a month; what has built up on each late bill, **Bill the interest** (a bill of its own the owner pays in their portal) and **Mark paid**. On a phone the bill's lines, and Money's weeks and jobs, stack one to a block. |
| **Follow up** (board tab) | Everyone we are waiting on across every project, the ones to call first. Log a contact; record the day they promised a quote; a passed day returns them to the top. **Call Greg** on each card dials in one click and opens the sheet on "What did Greg say?". **Work the list** (the badge's count, the Board's `allPeople`) and **Follow up** on any card or paper row open the Follow up sheet (the owner, 2026-10-04): the people down the side, one at a time; what they owe, ticked (other papers they owe show under it, unticked, to ask in the same message); a draft that names it, **From** me (the signed-in name, the default) or Click Construction, by **Text** or **Email**, as a **Quick nudge** or **A full note**, in Spanish for a company that chose it; their number with **Call**. From me opens my own Messages or mail with the draft filled in; from the company goes by email only for now (question 29), and in the prototype nothing leaves the app. Sending logs a line on each quote's ask and a note on the company for papers; a call logs what they said, and a day they gave becomes their promise, so they drop off the badge. Phone and email are made up (555-01xx, .example) until the record has them (`Partner.phone`, `Partner.email`). `gcFollowUpSheet.ts`, `GcFollowUpSheet.tsx`; built by Building on the Board's tab. Mock-up: artifact PuSXPWnuXhLRu9zbt3GN6S. |
| **Trade partners** (board tab) | By trade: the bench, who answers when asked, every project short of quotes, coverage (where they drive from, how far they go), one press to ask the companies not yet asked. **Actions for assistants** on top: each standard as the ideal, where we are, and what closes the gap. |
| The trade's portal | English or Spanish (**Español** on the portal's letterhead: every word the portal writes, and the messages). One link per company, carried by every message we send (**Their messages** beside **Their portal**: the invitation, reminders, new plan sets, bid tabs, the master agreement, a statement of work to sign, the day work starts, a draw approved for less with our reason, a change order to sign, a payment, an answer to a question, insurance running out, a bid we lost). The first visit opens on a welcome until **Got it**. The link opens on the company's **home** (with **Your papers** behind "See every paper": every paper it signed with us, to open or print; and **Your pay** behind "See every payment": every pay application asked, approved and paid, what is on the way and by when, what is held per job and when it comes back): what needs them across every project (late or blocking first; a pay application we sent back, a draw we approved for less, a change order to sign, punch items to fix, insurance running out within 30 days, their closeout steps), their money once a dollar moves, their jobs, what they are asked to quote, their paperwork, and what came before. A row opens that project's page, with **← Everything with Click** back. On a project page: questions about the plans under each trade's plans, the **Pre-bid meeting** for a company asked to it, **Who to call** (our superintendent on site, the project manager, pay and paperwork; made up), **Your next three weeks**, the weekly look-ahead (this week and the next two from our schedule, last week while anything in it is unmarked; **Done** or **Not done** with a reason, waiting on our superintendent, changeable until verified), then paperwork done by the company itself (read and sign the master agreement, send an insurance certificate, fill in and sign a W-9), the plans window (sets, sheets, whether a set changes their trade, the sheets a set took out struck through at the end, a renamed sheet with its old title), the invitation and the bid form (each line with its sheet numbers, a tap opens that sheet, and its manual sections under it; after a new set the lines it touches are marked, and a sheet it took out reads "taken out"; how many days the quote is good for; alternates that add or take off; their own quote attached; **Your schedule of values**, optional, adding up to the quote; **Known exclusions**, what the quote leaves out and who does it, from New Project's list, also in the invitation; **What your quote leaves out**, the company's own ticks with a unit price if it comes up), "tell Click when your quote will come" (a passed day shows in red), answer a line the office could not read (its own short step, the quote stays), confirm a quote after an addendum, the bid tab, sign the statement of work (and send their schedule of values if the quote had none), report work (with the days our daily log has them on site), ask for a draw with its pay application (next row). A bid we lost closes: it moves to what came before, with one line saying why and only its plans left to look at. On a phone (375px, checked for every company in both languages, again on 2026-10-04 with the newer pieces open: the company form, the dates, sections, taken-out sheets, Known exclusions) nothing widens the page: file pickers shrink to fit, long statuses wrap, and the bid tab fits (a company name longer than the made-up ones would scroll in its own box). |
| Pay application (from the portal) | **Fill out pay application N**: four steps on a rail like the Release of Lien window (Check your work, Fill in a few details, Sign it, Send it to Click) beside the 702 and 703, which fill in as the trade types and mark what each step fills. The app knows the job, the contract, the lines, what was billed and the retainage; the trade checks the percents, picks the period, types its address once, and signs. Closing the window keeps the draft. In a Spanish portal the door, the window and the 702 and 703 read in Spanish; the office's copy stays English. |
| **Closeout** | Each trade's last six steps: every line billed, **Accept the work** once every punch item is checked fixed (each trade's **Punch list** under its steps: **Add an item** with where on the job, **Checked, it is fixed** or **Not fixed** with a note that sends it back; the trade marks each **It is fixed** in its portal), their final pay application for the retainage with a conditional final release of lien, the owner paying our final and 10 days passing, **Approve the release** and **Mark paid**, their unconditional final release of lien. Totals for held, paid back and trades closed out; the owner's retainage on us, read from Bill the owner; **Close the job** once every trade is closed out, with what is left until then. In the portal the same steps show as the trade's closeout list, ending "You are closed out on this job." |
| **Schedule** | Each activity is a line of a trade's statement of work, or a stage our own crew runs, or an inspection (the job's own, no dollars: on the critical path, not in work done). Four measures on top: work done against the plan with days behind (by dollars), the critical path (no spare days), milestones hit within 3 days, and the look-ahead done as planned (verified marks, last 4 weeks). The chart: each trade's lines, the plan with percent done, the plan at Start under it where it moved, today, milestones. The look-ahead: this week and the next two, this week's marks with their state. In Buying out it is drawn here: **Draw a first draft** (every line of every trade, by phase), then pick any activity to set its dates and what it waits on (on **Save**, what comes after it moves out with it, keeping its length; work already done stays put, nothing moves earlier, and the editor says what will move first: `pushAfter`, owner 2026-10-04), and add, move or take off milestones; the first change after Start keeps the plan at Start as the baseline. **To verify**: each trade mark waiting, with what they reported against the plan; **Right**, or corrected with a reason; our own crew marked here, verified at once; an inspection due this week takes **It passed today** (also in its editor), which meets the milestone of the same name, or **It failed**: what failed, whose work (the trades it inspects come ticked) and the re-inspection day; it moves to that day and what waits on it moves out, the chart and the look-ahead say failed and when again, the ring card says so, and the trade's portal shows it above its pay application. Fair Oaks D's electrical service inspection failed Sep 28 and is inspected again today. On the Project Board, a building job with a schedule shows days behind or ahead, milestones hit and the look-ahead in place of its start day; the ring's card leads with the same sentence. Fair Oaks D has one drawn; draw Helotes. |
| **Daily log** | Our superintendent's log for each working day on a job being built: the weather (and whether work stopped for it), who was on site and how many, what got done, what held work up (the look-ahead's reasons), inspections and visitors. Today's log starts from the day before. A working day in the last week with no log shows with **Write** to catch it up. The week at a glance, then the days before. **To verify** on Schedule says what the log has each trade on site that week, and the ring card says when a working day has no log while work is still being reported. Fair Oaks D has logs from Sep 21; Sep 30 was missed. |
| **Submittals** | The register by trade: what each sends for the architect's approval before its work (product data, shop drawings, samples), numbered by its spec section. Whose move it is (the trade's, ours, the architect's, approved), when it is needed (the first start of the work it holds on the schedule, less the days from approval to on site) and how late. **Send to** the architect once it is in; record the architect's answer (**Approved**, **Approved as noted**, **Revise and resubmit** with what to change, which sends it back to the trade); **Add a submittal** with the work it holds and its lead days. On the schedule a line it holds says "waits on submittal …"; the ring card names one late, or one waiting on us. In the trade's portal (in its language), what to send with a file name and a note, what came back, and what is with us or the architect. Fair Oaks D has six. |

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
- **A quote missing a cost does not close a trade either** (2026-10-03): a carried quote with a line that has no cost holds the ring open until every line has one; the card says "Summit Roofing, 112K + ?. 1 line has no cost yet: roof curbs." and the row's chip "· 1 missing a cost".
- **A guess never closes a trade.** Our own budget carried as a trade's number fills the price,
  but the ring and the board's chip count only a real quote (or our own crew's number from a
  Trades mode bid). The chip names the guesses ("· 1 on our guess"); the card says "Carry one to
  close it" (`isGuess` in the model).
- **Click does the GC work itself** (answered 2026-10-02, was open question 1): "It's for Click
  doing GC work ourselves, but the entire app is designed in a way where a later company could
  put their company in this app." Build for one company; name nothing Click-only, so a later
  company could be added the way the rest of the app allows.
- **New Project starts with the plans** (approved as built, 2026-10-02): a **+ New project**
  button beside *Bidding to the owner* opens five steps: the project, the plans, the trades, each
  scope and who to ask (the last is below). The trades are a guess from the sheet index (discipline
  letters plus title words like "roof" or "door", `TRADE_TEMPLATES` in `gcNewProject.ts`); each
  scope starts from the trade's usual lines. The company's own trades (`OUR_TRADES`, plumbing) come
  in ticked as ours.
- **A later set says what it is** (approved as built, 2026-10-02): **A new set of plans came in**
  names the set (an addendum while we bid, a bulletin once the job is ours, or a whole revised,
  permit or construction set), gives a sheet new to the index its title, and can bring a trade
  the job did not have, put in the list's order with its usual scope (`issuePlanSet`). The trade guess
  is the one New Project uses, so a title like "Roof plan" flags roofing.
- **Each scope line names its sheets** (approved as built, 2026-10-02): a line carries the sheets
  it reads from (`ScopeItem.sheets`), guessed from the words it shares with the trade's sheet
  titles and changed by the office. A new set then says which lines it touches, and each
  company's email names them. A line with no sheet stands for the trade as a whole, so it counts
  as touched whenever any of the trade's sheets changes (the owner's call, 2026-10-02:
  `lineReads`, `linesOnSheets`). Projects written before lines had sheets show the guess
  (`lineSheets`). What a set names to a trade (its email, and the window's list of lines it
  touches) reads a line whose sheets were only guessed as its whole trade, the way the trade's
  portal reads it (the owner, 2026-10-04: `linesATradeHears`).
- **The project manual sits beside the sheets** (approved as built, 2026-10-03): on **The plans**
  the office pastes the manual's table of contents (07 54 23, 075423, Section 09 91 23), read as
  sections by division (`specIndexInText`). A section's number names its trade (`tradeForSpec`:
  09 91 is painting, 09 2 drywall), so the trade split reads the sheets and the sections together
  (`tradesForPlans`) and a trade the sheets miss, like storefront from 08 41 13, still comes in.
  Each scope line carries its sections beside its sheets (`ScopeItem.specs`, guessed by
  `guessLineSpecs`, changed with × and **+ add**); the project keeps the manual (`GcProject.specs`).
  No manual pasted: nothing changes. A later set reads section numbers out of its notes
  (`specsInText`: spaced, dotted or dashed anywhere, six bare digits only after "section"), gives
  a section new to the manual its title (`PlanSet.changedSpecs`, `addedSpecs`, read back by
  `specsAtRev`), ticks the trades each number names (`packagesForSpecs`) and reaches the lines
  that name the section or name none (`linesOnPlans`; the owner's whole-trade rule for sheets).
  The email lists "Spec sections:", a change order says "per" the sections too, and the plans
  window has a **Sheets · Specs** switch with "Scope that reads from 09 91 23" (2026-10-03).
- **Budgets from what each trade cost on our past jobs** (2026-10-03, REMAINING New Project 1):
  **Fill the empty budgets from the size** takes each trade's cost per square foot on our other
  jobs (a signed contract, the quote carried or awarded, or our own priced bid, over the job's
  size; never a plug), and uses the middle one times the new job's size. A trade with no past job
  uses the rough rate (`tradeCostHistory`, `budgetForSize`). Each filled budget says where it came
  from: "$18.35 a sq ft, from 3 past jobs" or "a rough rate".
- **Each scope says what the trade leaves out** (2026-10-03, REMAINING New Project 1): under its
  lines, each trade has **Known exclusions** (the owner, 2026-10-04: "This should be phrased known
  exclusions instead"; was *Not in this trade*), each with who does it instead (another trade,
  the owner or us), starting from the trade's usual list (`usualExcludes`: plumbing leaves gas
  piping to HVAC). The gap check flags what nobody picks up: left to a trade not on the job, or to
  one whose scope has no line for it (`scopeGaps`, a shared word). **Add it to HVAC** or **Add
  HVAC** closes it. The package keeps the list (`TradePackage.excludes`, `projectScopeGaps`).
- **The pre-bid meeting** (the owner, 2026-10-04: "Let's build the pre bid meeting into the
  prototype"): while we bid, the Plans tab has **Set a pre-bid meeting** (then **Pre-bid meeting ·
  Sat Oct 3**). The window sets the day, the time, the place, who runs it (the architect, or our
  own walk with the trades) and whether coming is required to quote (`schedulePreBid`). It keeps
  the day it was set, or last moved, since a move sends a new invitation (`setOn`). It lists
  every company quoting with the invitation each gets (`preBidInvited`, `preBidInviteEmail`). At
  the meeting the office ticks who came (`recordPreBidAttendance`); a company that missed a
  required meeting is flagged (`missedMandatoryPreBid`). Each question raised there is a question
  like any other, marked asked at the pre-bid meeting (`tradeAskQuestion` with `atPreBid`), so it
  goes to the architect and its answer to every company quoting. The minutes (when, where, who
  came, how many questions) ride in the next set, ticked beside the answers it carries
  (`preBidMinutesLine`, `issuePlanSet.preBidMinutes`).
- **Pickers with search in New project and a new set** (the owner, 2026-10-04: "I would like the
  dropdown to be more attractive, I would like for it to have search"): every dropdown in the New
  project, new-set and Questions windows is the app's SearchableSelect (`GcNewProjectPickers.tsx`).
  Rows show the name in bold and what it is beneath it. The Owner and Architect pickers put the
  ones that fit first (owners and developers, or architects), then everyone else, and typing a
  name the list does not have offers **Add "…" as someone new**. **Add a trade** is one picker
  that adds a typed trade the same way. Escape in an open picker closes only the picker. Step 2's
  set line is **Note to the trades (optional)**, with "Every company we ask sees this beside the
  set's name."
- **The sheets as one list: a plan PDF, a paste or typing** (the owner, 2026-10-04: "build 1, 4
  and 5 for the sheet index"): step 2 of New project and a whole set in **A new set of plans came
  in** share one table (`GcNewProjectSheetIndex.tsx`). **Drop the plan PDF** reads each page's
  title block with pdf.js: the biggest sheet number in the bottom right, and the title under its
  label or above the number, across lines (`readTitleBlock`). Each row keeps its page ("p. 4"). A
  page with no number becomes a row to fix ("Page 2: no sheet number found on it."), and the
  window will not go on until it is fixed or taken out (`rowProblems`). **Read a made-up plan
  PDF** draws one with jspdf (a title block on every sheet, a rendering with none as page 2) and
  reads it back for real. **Paste a sheet list** takes any layout: the number first or last, dot
  leaders, a list number or "Sheet" in front, a date after. Each line shows read, or skipped with
  why (a heading, no number, already listed), and a line with no number can be fixed in place
  (`readSheetLines`). Capitals read in sentence case. **+ Add sheet** fills in the next number
  (A-101 then A-102, `nextSheetNumber`). Rows move up and down, come out with ×, and a sheet whose
  letters say no discipline gets a picker (`PlanSheet.discipline`). The pick groups it on the right,
  in the quick look, and brings its trades on step 3 (`disciplineOf`, `withPickedDisciplines`).
  A sheet the PDF reads that is already listed only gets its page.
- **The plans come by their Google Drive link** (the owner, 2026-10-04: "I want to always have it go
  to a Google Drive link where there is a notification that says this link is accessible by
  anyone, this works, versus this link is only accessible by some, please correct"; then "keep an
  uploading option but say coming soon"; then "When the link is blocked and our helper cannot see
  the link without an account, we should give a warning"). New project step 2 and **A new set of
  plans came in** ask for the set's Drive link (`driveLink`: a file or folder link, else "This is
  not a Google Drive link"). Under it, green: "Anyone with the link can open it. This works." Red:
  "Only some people can open this link. Please correct it." with the fix in Drive and **Check
  again**. A restricted link warns and never stops Create or Issue. New project needs a link; a
  later set needs one when it brings drawings (`driveLinkProblem`). The set keeps it
  (`PlanSet.drive`: the link, anyone or restricted, the day checked). The warning stays on the set
  until a check finds it open (`checkPlanSetDrive`; `PlanSetDriveLine` in the quick look, and for
  the Plans tab's set card). The prototype cannot reach Drive (`driveAccessStandIn`): two made-up
  links to try, Check again reads as fixed in Drive, any other link is said to be treated as open.
  The real check is the owner's: a helper opens the link with no Google sign-in, and a sign-in page
  or "You need access" means restricted; it runs again when a set is issued. **Drop the plan PDF
  here** stays, turned off with **Coming soon**. **Read a made-up plan PDF** stays as the demo.
- **Follow up says each thing once per card** (the owner, 2026-10-04: "I feel like there is some
  unnecessary redundancy here"; `follow-up-card-mockup.html`): the section says why a company is
  there, the chip says the promised day and how late (or, with no promise, when we asked: "asked Sat
  Sep 19, 13 days ago"), and the last call says what they said, without "Quote by Sep 30" when the
  chip shows that day (the full story keeps every promise). The bid date sits in the job's chip
  ("Boerne Retail Shell · Sitework · bid Thu Oct 8"), not as a sentence on every card. Log a contact
  leaves the Follow up card, since Call and Follow up log it (the Trades tab and the company window
  keep it: `AskThread`'s `onList`). The paragraph at the top keeps no count of its own. The card's
  sentence (`FollowUp.words`) stays in the data for the sheet, the board's people count and Trade
  partners.
- **Customer, and an owner of the property when it is someone else** (the owner, 2026-10-04: "On
  this screen owner should become customer and then there should be a button to add owner
  different than customer"): step 1's picker is **Customer** ("The company we build it for, the
  one we bill"); it still sets `customerId` and `owner`. **+ Add an owner different from the
  customer** opens **Owner of the property** from the same list, with "Someone new" and × to take it
  off, for a landlord on a tenant finish-out. The project keeps it only when it differs from the
  customer (`GcProject.propertyOwnerId`, `propertyOwner`). Round 6: above it, **We work for**: the
  owner, another general contractor or an owner's rep (`GcProject.customerRole`, kept only when not
  the owner). The customer picker puts the ones that fit first and files someone new by it
  (General contractor, Owner's rep). Not the owner shows **Owner of the property (optional)** on its
  own: "The general contractor bills them, and we bill the general contractor." New Project's own
  words say customer where they mean who we bill (*Bidding to the customer*, *Change orders to the
  customer*, *Bill the customer*); the Kinds of plan sets card keeps "owner" for the building's
  owner, and a Known exclusion's "by the owner" stays (`BY_NOT_A_TRADE`, in `src/lib/gc`).
- **What the kinds of plan sets are** (the owner, 2026-10-04: "I think it's important that we explain
  to a user what these different kinds of plans are. Perhaps as a information icon to the right of
  the three plan set choosers"): an **i** after Bid set, Pricing set and Permit set opens a card on
  hover, focus or a click. Each kind says when it comes, who gets it, what is in it and what it is
  for, in the owner's own facts made short (`SET_KIND_HELP`, `GcNewProjectSetKinds.tsx`). A test
  holds the words to plain words. The new-set window's kinds (Addendum, Bulletin, Revised set,
  Permit set, Construction set) have no card yet: his text covers only Permit set there.
- **The budgets against the size** (the owner, 2026-10-04: "show the amount of square feet added at
  the prior page and then the cost per square foot, broken down by trade, and the total"): step 3
  closes with **The budgets**, a block only as wide as it needs and set to the right, like a receipt
  ("It can be indented right and only the width it needs to be"): the size from step 1, then each ticked trade with its budget and
  its cost per square foot to the cent ("$12.35/sq ft"), then the total (`budgetBySize`,
  `perSqFtWords`). A trade that is ours shows its guess the same way. Without a size it says "Give
  the size on step 1 to see the cost per square foot." Each budget box shows its own rate as it is
  typed.
- **The scope book** (the owner, 2026-10-04: "a scope book where the user can set a trade and set
  scope that they can search in that book and pull from"; he picked the revised design in
  `scope-book-mockup.html`): the book is read, not typed (`gcScopeBook.ts`). It holds every scope
  line on the jobs, the usual lines, and two finished jobs (Fair Oaks Shops, Buildings A and C)
  with the lines that came in late on them. A line remembers its spec section, what a trade with
  it leaves out and who does that, the jobs it was on, and each time it came in late: added by a
  later set, at the cost of a change order, or left out by quotes (`scopeBook`). The office's own
  changes sit on top (`GcState.scopeBook`: `saveToScopeBook`, `editScopeBookLine`,
  `mergeScopeBookLines`, `saveScopeSet`). On step 4 each trade has **Start from the book**: a set
  (one saved by hand, the trade's scope on another job, or the usual lines) and **Use these
  lines**, which keeps what is there (`scopeSetsFor`, `linesToAdd`). The set that adds the most
  comes up first. **Often missed on Sitework** lists the lines we added late before, each with
  why and **+ Add** (`oftenMissed`, `lateWords`). **Add a line** searches the book as you type:
  this trade's lines first, the ones already here greyed, other trades' lines "from Concrete",
  then **+ Add "…" as a new line** (`searchScopeBook`). A book line brings its section (when the
  job's manual has it) and its known exclusion. Each line shows **book**, or **Save to the book**.
  **Open the scope book** is the book's page (`GcScopeBookWindow`): lines by trade with **Edit**,
  **+ Add to the book**, the sets with **Save this scope as a set**, and **Duplicates to merge**
  ("Site clearing and grading" looks the same as "Clearing and grading"; "site" counts for nothing
  only in Sitework). The same search adds a line a set brings in **A new set of plans came in**.
  `GcScopeBookButton` opens the book from anywhere. Each trade also keeps its exclusions beside its
  lines (Round 5, exclusions by company): the usual ones, every Known exclusion on our jobs and every
  exclusion a quote named, each under its shared name (`scopeBookExclusions`, `exclusionName`), most
  named first, shown as **Known exclusions for Plumbing** on the book's page. The quote form can
  offer the book's names first: `exclusionsFor(trade, book)`.
- **New project, step 1 and 3 follow-ups** (the owner, 2026-10-04): no Town field; each company's
  drive is measured from the town in the address ("Drives are measured from Boerne"; the Board's
  `townFromAddress`), and a town picker shows only when the address names none. **Size** is square
  feet only, with **Size note (optional)** for the words; the project keeps one line ("6,800 sq ft
  clinic, one story") that every screen reads. A trade the office added on step 3 has **Remove**,
  which takes it off the draft with its scope and its picks.
- **A set says who checked it** (the owner, 2026-10-04: "plans live in google drive, uploaded by
  someone who checks them"; "yes, add the checked by step"): step 1 of **A new set of plans came
  in** asks **Checked by**, the job's own team first, then our other people, or someone typed
  in (`ourPeople`). The set does not go out until someone is named. The set keeps the name
  (`PlanSet.checkedBy`); the log and the plans window say "Checked by Dana Whitaker".
- **A whole new set is compared with ours** (approved, 2026-10-03): a Revised, Permit or
  Construction set pastes its new sheet index and table of contents. Each is compared with what we
  have (`indexDiff`): new, gone, renamed (same number, new title) and the same. Any listed sheet or
  section can be taken out or kept, and a note that says "delete sheet C-201" or "C-201 is
  deleted" marks it (`takenOutInText`). What goes is kept apart, crossed out in the plans window
  (`sheetsGoneAtRev`, `specsGoneAtRev`), so a quote priced on it still reads. A scope line left
  with nothing to read is listed and tied to another sheet or section, or to its trade as a whole
  (`linesLeftBehind`, `retiedLines`). The email says "Taken out of the set:". A line's guess now
  reads the sheets a set adds too, so a new fire alarm plan reaches Fire alarm.
- **A new set can add work to a trade already out to bid** (approved as built, 2026-10-02): the
  line goes on the end of the trade's scope with the changed sheets it reads from, and the set
  remembers it (`issuePlanSet.newLines`, `PlanSet.addedLines`). A quote already in never answered
  it, so Compare bids reads it as not clear until a cost is set to cover it or the company
  answers. The email says "It adds detention pond to your scope."
- **New Project ends with Who to ask** (approved as built, 2026-10-02): the step ticks the
  companies in range in the map's own order (`tradeLineup`), up to `BENCH_WANTED`, so the map
  and the step move together: the most reliable first (question 7, 2026-10-04). A company missing its master
  agreement, insurance or W-9 is still ticked, with what is missing in a muted line: paperwork is
  fixed before award, not before a quote. Create sends the board's own invite to each. **+ Ask a
  company not on our list** adds one by name and email or phone (the owner, 2026-10-04, question
  3: anyone can quote): it comes in not vetted, is asked like the rest, and nothing is awarded to
  it until the office approves it (`strangerActions`, the Board's `addPartner` known false).
- **Our own trade counts once our bid is priced** (answered 2026-10-02, was open question 10):
  ticking **Ours** on a new project starts our own bid in Trades mode (`selfPerform.priced:
  false`, our guess as its value). The trade becomes a real number when that bid is priced
  (`priceOwnBid`; `ownBidPriced` in `gcLookups.ts`). The made-up projects' own trades are priced
  already.
- **A won job's row shows what is next, not when our bid went in** (2026-10-03): on Buying out
  the block beside the ring shows the days until the planned start (the Board lane, now); on
  Building it shows the schedule's measures, days behind or ahead with milestones and the
  look-ahead, once the schedule is built (the Building lane builds the measures, the Board lane
  shows them).
- **A set issued on a job with a schedule says what it does to it** (approved as built,
  2026-10-03): **A new set of plans came in** lists the scheduled activities its changed sheets
  reach, each with its spare days, and takes the days the change adds to each. What waits on it
  moves out too, never earlier, and the plan at Start stays as the baseline. It says whether the
  job's last day moves and whether substantial completion still holds, on its day with signed
  change orders' days added (Building's `substantialCompletionOn`, question 28); it never moves that
  milestone, since more time is a change order. The set records the days (`PlanSet.pushed`), and
  each company's email names its new dates (`activitiesTouched`, `pushSchedule`,
  `issuePlanSet.schedulePushes`). Work a set brings onto a schedule already drawn (a new trade's
  lines, a line it adds) gets activities placed as the first draft places them, after what its
  stage waits on and never before today, and what waits on that stage waits on them too
  (`scheduleSetLines`; the owner, in the Building lane, 2026-10-03: "fix the gap"). A set that
  brings the job's first dry-in work (Helotes' storefront) adds the Dry-in milestone on its last
  finish, as the first draft would (`dryInMilestoneFor`; the owner, 2026-10-04: "add the milestone").
- **A set that changes a job we have won starts its change orders to the owner** (approved as
  built, 2026-10-03): **A new set of plans came in** gains **Change orders to the owner**, one row
  per trade the set touches or brings, ticked when it adds lines or days. Each is prefilled
  (`changeOrderFromSet`: "Bulletin 2, Electrical: data drops added at each operatory, per E-102",
  the time from the schedule push); the office types our cost and Owner Billing's rule adds the
  fee. Issuing drafts each one with a cost through Owner Billing's own `draftChangeOrder` (reason
  "plans"), to review and send on **Bill the owner**, with the days the set adds as a number
  (`ChangeOrder.days`; a signed one adds them to the contract time). The days ride on one change
  order only, the first going out whose trade caused them, so they are never counted twice
  (`changeOrderTakingTheDays`). A trade the set brings bills the owner only through its change
  order (Owner Billing: $0 on the owner's own lines), so its row warns while it is unticked or has
  no cost (the owner, 2026-10-04). Once the owner signs, it goes on to the trade's statement of work
  through the Building lane's `sendTradeChange`.
- **Questions about the plans** (approved as built, 2026-10-03): a trade asks about the plans
  (only a company asked to quote the trade can), we send it to the architect, we record the
  answer, and it goes to every company bidding the trade while we bid, or only the company on it
  once the job is ours, the same rule a new set follows. An answered question rides in the next
  set: A new set of plans came in offers it, ticked, in the note, and the question remembers the
  set (`tradeAskQuestion`, `sendQuestionToArchitect`, `answerQuestion`, `issuePlanSet.questionIds`;
  the window `GcNewProjectQuestions.tsx`). In the trade's portal (built 2026-10-03): the ask box
  under each trade's plans, the company's own questions in any state, another company's once the
  answer reached it with no name, a Needs you line for a week and a message when an answer comes
  (`portalQuestions` in `gcPortal.ts`, `GcPortalQuestions.tsx`).
- **The schedule** (2026-10-02, decided before anything is built): several activities per trade,
  like rough in, top out and trim. We draw it; the companies do not propose dates. It lives only
  inside GC mode for now, not on the app's Schedule page. A milestone counts as hit within a few
  days of its planned day. The look-ahead shows three weeks. Each week the trade marks its
  look-ahead activities done or not in its portal, and our superintendent verifies them; only a
  verified mark counts. How it works is under *The schedule*.
- **Each draw comes with a 702 and 703** (2026-10-02, Building lane): the trade fills the pay
  application in its portal and watches the form fill, typing only what the app cannot know. Most
  of it comes from the job and from the work they reported (`gcBuilding.ts`, `GcBuildingPayApp.tsx`).
- **A signed change order goes to the trade as a change to its statement of work** (approved as
  built, 2026-10-03, Building lane): once the owner signs, **Send the change to** the company on
  Draws, and the company signs it in its portal. It becomes a schedule-of-values line of its own
  (`changeOrderId`), so the original contract (`sow.price`) never moves; the 702's line 2 and the
  Contract on Draws add the changes (`sowContractSum`, `tradeChangesFor` in `gcBuilding.ts`,
  `GcBuildingChanges.tsx`). Our own crew's change orders have no trade side.
- **An inspection is an activity of its own on the schedule** (answered 2026-10-03, after first
  picking a wait in days on the link): it sits between the work it inspects and the work that
  waits on it, with its own days, so the wait stops reading as spare days. It is no trade's line
  and has no dollars, so it counts on the critical path but not in work done against the plan.
  An inspection can fail (owner, 2026-10-03): our superintendent records what failed, whose work
  and the re-inspection day; it moves there and what waits on it moves out (`failInspection`,
  `openInspectionFailures`). The first draft draws two (owner, 2026-10-03: "include the final inspection"): the rough-in
  inspection after every rough-in, which close-in waits on, and the final inspection after all
  the work, before substantial completion (`ScheduleActivity.inspection`, packageId ''). Built
  2026-10-03 on both halves: the chart shows the inspections as a group of their own ("Inspections ·
  The city"), and **It passed today** (`passInspection`) meets the milestone of the same name.
- **The schedule counts calendar days for now** (owner, 2026-10-03): weekends read as spare days,
  so a Monday inspection after a Friday finish leaves that work 2 spare days.
- **Closeout runs per trade** (approved as built, 2026-10-02, Building lane): the retainage
  comes back as the trade's last draw, asked for with a final pay application and the
  final-payment releases of lien, once every line is billed and we accept the work
  (`tradeCloseout` in `gcBuilding.ts`, `GcCloseout.tsx`). The retainage the owner holds on us
  stays Owner Billing's.
- **A punch list per trade gates acceptance** (approved as built, 2026-10-03, Building lane): our
  superintendent lists what is left on a trade we hire, the trade marks each item fixed in its
  portal, our superintendent checks it or sends it back with a note, and the work is accepted
  once every item is checked fixed. After acceptance nothing more goes on the list: that is
  warranty. Our own crew's closeout runs on the Pipeline (`gcBuildingPunch.ts`, `GcBuildingPunch.tsx`).
  On the trade's home (owner, 2026-10-03, Portal lane): one Needs you line per trade, "2 punch
  items to fix on Concrete for …", amber, and red once we sent one back. It opens the job page on
  the block that holds the list (`portalTodos` in `gcPortal.ts`).
- **A daily log for each working day** (approved as built, 2026-10-04, Building lane): the
  superintendent writes the weather, who was on site and how many, what got done, what held work
  up and who came by; a missed day can be written after (`saveDailyLog`, `gcBuildingLog.ts`).
  It backs up the look-ahead marks on **To verify**.
- **Submittals hold the work they cover** (approved as built, 2026-10-04, Building lane): a trade
  sends each for the architect's approval; we send it on and record the answer; revise sends it
  back for another round. It is needed by the first start of the work it holds, less its lead
  days (`gcBuildingSubmittals.ts`, `GcBuildingSubmittals.tsx`). On the trade's home (owner,
  2026-10-04, Portal lane): one Needs you line per trade, "1 submittal to send for HVAC on …",
  amber, red once one is late or came back to revise ("Click sent one back to revise."). It opens
  the job page on the block that holds them (`portalTodos` in `gcPortal.ts`).
- **A trade's retainage is paid 10 days after the owner pays ours** (answered 2026-10-02, was
  open question 16): the trade's final pay application can go in once we accept the work (our own
  final to the owner waits for every trade's); we approve and pay it 10 days after the owner pays
  our final pay application (`ownerRetainagePaidOn`, `TRADE_RETAINAGE_WAIT_DAYS`).
- **The one paper before release is the conditional final release of lien** (answered
  2026-10-02, was 17). It is signed with the final pay application; no warranty letter is asked
  for (`warrantyOn` stays only as a record). The words on screen are "conditional final release
  of lien" and "unconditional final release of lien".
- **A closed job leaves Building** (answered 2026-10-02, was 18): **Close the job** on Closeout
  once every trade is closed out, our own crew is done and the owner paid our final
  (`jobCloseout`, `closedOn`). The board's own Closed section is the Board lane's to build.
- **The office can approve less than asked, and a draw sent back twice is flagged** (answered
  2026-10-02, was 19): **Approve less** pays the lines we doubt at our percent and keeps what was
  asked on the draw (`draw.asked`); the rest stays the trade's to ask for. Sent back twice, the
  ring's card says to call them.
- **Our own crew reports by stage** (answered 2026-10-02, was 21): underground, rough in, top
  out, trim, each worth its share of the trade (`CREW_STAGE_WEIGHTS`); the whole-trade percent
  Bill the owner bills from follows from the stages.
- **Our own crew counts in Building** (approved as built, 2026-10-02, Building lane): a trade we
  do ourselves weighs in the Building ring by our own number, from the one percent Bill the owner
  bills from (`ownCrewWork`). Draws shows it with the same picker; it has no draws, retainage or
  waivers, since we pay our own crew through payroll.
- **A project already building opens with the page** (approved as built, 2026-10-02, Building
  lane): Fair Oaks Shops, Building D (`fairoaksd` in `gcFixture.ts`), with Pecan Valley Electric
  added for it. Its seven trades sit at different points so Draws, Closeout and the ring show on
  open. It uses only companies the other lanes' tests do not read.
- **We bill the owner once a month** (Owner Billing lane, 2026-10-02): one pay application a
  month covering every trade's work since the last one, not a bill each time a trade asks for a
  draw. The day of the month is a default (`OWNER_BILL_DAY` in `gcOwnerBilling.ts`).
- **Lien waivers to the owner: ours and the trades'** (Owner Billing lane, 2026-10-02). Our
  conditional waiver on progress payment goes with each pay application for the amount it asks;
  marking the bill paid signs our unconditional one (the real build waits for the money to clear,
  as the Jobs board does). Each trade's waivers go too. A trade whose waivers do not cover its
  work on the bill is a warning on the bill and a note on the owner's portal, never a stop; so
  is a draw we paid whose unconditional waiver the trade still owes.
- **The owner sees every line** of each pay application in their portal, not the totals only.
- **The owner's retainage comes back at the end** (Owner Billing lane, 2026-10-02): once every
  line is billed, the owner accepts the work in their portal, and our final pay application asks
  for everything they hold, with our conditional waiver on final payment; paying it signs our
  unconditional one. Our final waits until every trade has sent its own final pay application.
  A trade's retainage is paid only after the owner has paid us ours (`ownerReleasedRetainage`):
  that rule is the Building lane's to apply on Closeout.
- **Our costs and fee are spread into the trades** on the owner's bill (Owner Billing lane,
  2026-10-02, was open question 13): each trade's line carries its share of general conditions,
  contingency and fee, so the lines add up to the price and the owner never sees a fee line.
- **The architect certifies our pay application before the owner pays** (Owner Billing lane,
  2026-10-03, was open question 26), for what we asked or less, with the reason. The owner pays the
  certified amount; what was cut comes back on the next bill, since the G702's line 7 counts earlier
  certificates. The final pay application is certified the same way, a step in our closeout.
- **A pay application we sent back bills what we see** (Owner Billing lane, 2026-10-02): until
  the trade resends it, the owner's bill uses our percent on the lines we doubt, not theirs.
- **Reminding a customer to pay a late bill** (owner, 2026-10-04; the wording and rules are Owner
  Billing's, the button the Board's on the customer's Documents): a pay application that is
  certified, not paid, open and past its due day can be reminded. The email says what is open, the
  day it was due and whose day that was, thanks them for a part paid, says the interest when we
  charge it, asks for a pay-by day (5 days to start), and points to their portal or asks for a day.
  The reminder is kept on the bill (`reminders`, `remindCustomerToPay`, `gcOwnerBillingRemind.ts`)
  and is never a promise: the due day stays. The golden walk has no step for it, since its one late
  bill gets a new promised day before the end; the unit tests cover it.
- **A late-finish warning** (owner, 2026-10-04): Bill the owner's **Finish date** compares the
  contract's day (substantial completion with change orders' days) with the schedule's finish
  (the Building lane's `projectedFinish`, with its sentence of why). Past it, the days times the contract's late fee a day (liquidated damages, ours to enter
  per job: `ownerLateFinish`) is what is at risk, also on Money.
- **Interest on late bills is ours to offer** (owner, 2026-10-04): off unless we set a rate on the
  job (1.5% a month to start, the rate the contract names). It runs on what the architect certified
  and is still open, from the first day the bill was due (the owner's first promise or the day we
  expected it; a later promise does not move it), to the day it is paid. It goes on a bill of its
  own, never on the pay application, and the owner pays it in their portal
  (`ownerLateInterest`, `gcOwnerBillingInterest.ts`). In the real build the day it runs from is the
  contract's due date; Texas's prompt pay law for private jobs is the place to check the rate.
- **Retainage can drop partway, and it is ours to offer** (owner, 2026-10-04): per job we choose
  whether the owner holds their percent to the end, or a lower one once the work is far enough
  along (half done and 5% to start, both ours to change): on the work after that point, or on all
  of it, so some of what they held comes back on the next bill (`ownerRetainageStep`, **Retainage**
  on Bill the owner; the 702's line 5 says it). A bill that went keeps the step it went under.
- **The owner's price stays what they signed** (owner, 2026-10-04): the day the owner contract is
  signed, their price is kept by line (`ownerContractWorth`: each trade, then our costs and fee).
  Bill the owner bills from it, each trade's line its share done of what the owner signed for it.
  Buying a trade out for more or less is ours, never theirs; only a change order changes their
  price, and a trade that came after they signed bills through its change order. Until the
  Board lane's **Owner contract signed** keeps it, a project signed in the prototype follows what
  we carry (`ownerContractWorthOf`).
- **A trade sees "Click Construction"** (2026-10-02). The name comes from one record
  (`GC_COMPANY` in `gcFixture.ts`: the full name and the short "Click" used in sentences), never
  typed into the portal's words.
- **A company's link lands on its home** (2026-10-02), not on one project: everything the company
  has with us, what needs them first. A project's page is one tap away.
- **Questions about the plans** (2026-10-03): a company asks in its portal; when the answer goes
  out to the other companies on the trade, they see the question and the answer but not who asked.
  Questions close three days before the bid is due, and never once the job is ours
  (`questionsCloseOn`, `questionsOpen` in `gcPlans.ts`; the asking action refuses a late one, so
  the rule holds outside the portal too).
- **We pay an approved pay application within 10 days** (2026-10-03, `PAY_WITHIN_DAYS`); a
  trade's retainage keeps its own day. Draws keep the day they were approved and paid
  (`approvedOn`, `paidOn`); the made-up draws from before got made-up days. The office reads the
  same pay-by day on Draws (`drawPayDays` in `gcBuildingPay.ts`).
- **A trade sees only the sheets the office set** (2026-10-03). A line whose sheet was only
  guessed from its words shows no sheet number and counts as the whole trade, so any change to the
  trade's sheets marks it (`portalLines` in `gcPortal.ts`). The made-up projects set none.
- **A company's language is kept on its record** (2026-10-03): the portal opens in it, and the
  messages we send it go out in it. The company sets it in its portal; the office can set it too,
  on Trade partners.
- **The pay application reads in the portal's language, the 702 and 703 too** (owner, 2026-10-03,
  Building lane): in a Spanish portal the door, the closeout list, the window's steps and the form
  itself read in Spanish (`gcBuildingWords.ts`, on the Portal lane's words). The office's copy,
  opened from Draws, is always English.
- **A project we lost closes in the portal and says why in one line** (owner, 2026-10-03, on the
  Board lane's markLost): it leaves Bidding for Before, and the bid form, the questions box, Needs
  you and the paperwork block go away there. The plans stay open to look at. The line is "Click did
  not win this project." or, when the project died, "The customer stopped this project or put it on
  hold." (customer: whoever hires and pays us, the owner's word 2026-10-04), then "You do not
  need to send a quote. Thank you for your time." (or "Thank you for your quote." once one came). Once the company has opened the bid tab, its own line says how it
  ended, so the result block hides. Never the price and never who won. Each company still on a trade
  there gets one email the day it is marked, in its language; one that passed gets none. Bring it
  back opens it all again (`portalClosedWords`, the `closed` ask kind and message in `gcPortal.ts`).
- **A trade sees what its number leaves out** (owner, 2026-10-04): the New Project lane's "Not in
  this trade" list shows on the bid form as **Known exclusions** (the owner's name for it, 2026-10-04; Spanish "Exclusiones conocidas") under the lines it covers, and in the invitation, as
  "Gas piping (HVAC does it)" (`portalLeavesOut` in `gcPortal.ts`). Older projects have none.
- **A sheet a newer set took out reads "taken out" in the portal** (owner, 2026-10-04, on the New
  Project lane's `removedSheets`): struck through beside a line that named it, "Taken out in
  Revised set: C-201" for the trade's others, and "Taken out: C-201." in the plans note. It is never
  a sheet to open from the bid (`portalLines` in `gcPortal.ts`, `GoneSheet` in `GcPortalLineSheets.tsx`).
  The portal's plans window lists the sheets a set took out at the end, struck through with the set,
  and opens one faded so a company can read what it priced; a renamed sheet shows "was Site plan"
  (`sheetsGoneAtRev`, `SheetInSet.was`, in `GcPortalPlans.tsx`).
- **A line's spec sections show on the portal's bid form** (owner, 2026-10-04): under the line,
  "07 54 23 · Thermoplastic polyolefin roofing", only the sections the office set (as with sheets),
  titled from the newest set (`specsAtRev`). Amber once a newer set revised one, struck through once
  a set took it out. A set reaches a line through its revised sections the office's way, so the
  portal flags the lines the set's email names (`linesOnSpecs`: a line naming no section reads its
  whole trade's) (`portalLines`' `specs`, `LineSpecs` in `GcPortalLineSheets.tsx`). Projects
  without a manual show none.
- **The portal says "quote" for a trade's own number** (owner, 2026-10-04, question 6: trades give
  us quotes; we give the owner our bid). "Your quote is due Oct 8", "Send my quote", "Asked to
  quote"; Spanish "su cotización" (it was "su precio"), its words agreeing with it ("Envíela",
  "válida"). The attached file reads "Your quote file". The bid tab keeps its name, and "Click sent
  its bid" stays: that bid is ours to the owner.
- **A company we did not know fills in its form in its portal** (owner, 2026-10-04, question 3):
  "Your company" at the top of Your paperwork, only for a company the office added as new. It reads
  "not sent yet" with **Tell us about your company** (license, insurance, years in business,
  references, past jobs, every line needed), then "Click is checking it · sent Oct 4", then
  "approved", "approved for jobs up to $150,000 each" or "Click cannot work with you right now";
  never the office's note. Needs you asks until the form is in; the bid form says Click can pick
  the quote once the company is approved; an email goes out on the office's decision
  (`portalVetting` in `gcPortal.ts`, on the Board lane's `gcVetting.ts`).
- **A company sees every date it gave us, and gives or moves one** (owner, 2026-10-04, question 8,
  on the Board lane's `gcPromises.ts`): "Your dates with Click" on its home (renamed 2026-10-04, once the office could ask for a
  due day when it sends a paper) lists each open one, each saying "You gave this day" or "Click
  asked for this day" ("The renewed insurance certificate · by Fri
  Oct 9, in 7 days"), with **Move the date**; Needs you turns it amber the day it is due and red once
  it passes. Under the insurance and W-9 lines it owes: "Not ready? Tell Click the day it will
  come." The insurance email 30 days before says so too (`COI_WARN_DAYS` is the Board's
  `INSURANCE_ASK_DAYS`). A date is kept when the thing comes (`portalPromises` in `gcPortal.ts`,
  `GcPortalDates.tsx`).
- **A company says what its quote leaves out, and its contract says what it will not do** (owner,
  2026-10-04, exclusions by company, on the Board lane's `gcExclusions.ts`): the quote form's **What
  your quote leaves out**, beside Known exclusions, ticks the trade's usual exclusions (the scope
  book's first, then everyone's), with "If it comes up: $38 per cy" under a ticked one and
  **Something else you exclude**; every tick shown is sent as answered, so the office reads an
  unticked one as in the price. The sent quote says "Your quote leaves out: rock excavation ($38 per
  cy if it comes up) and sales tax." The statement of work shows **What you will do** and **What you
  will not do**. The names read in Spanish (`EXCLUSION_ES`) (`portalExclusionChoices`,
  `portalExclusionWords`, `portalSowExcluded` in `gcPortal.ts`; `ExclusionsEditor`).
- **A trade's quote is due the day we want quotes by** (owner, 2026-10-04, on the New Project
  lane's `quotesWantedOn`): three days before our own bid is due, so we have days to level the
  quotes. The invitation, the bid form, the home and Needs you all give that day ("Send your quote
  by Mon Oct 5"); a company asked after it is given our bid day (`portalQuoteDue` in `gcPortal.ts`).
- **A late quote's chip says late and the day they gave** (owner, 2026-10-04): "late: you said
  Sep 30" ("atrasado: dijo el 30 sep"), not "your day passed" (`chipDayPassed`). The office's
  "Their day passed" title went to the Board lane as "Late on their word".
- **A trade asks for a change in its portal** (owner, 2026-10-04): it hit something on site no one
  could see, the customer asked it for more, or the plans changed. On its job page, *Changes to your
  work* takes what changed, why, what it asks, the working days it adds and a photo or ticket. Each
  one then says where it stands: sent, being written up, with the customer as change order N,
  the customer's no or yes, ready to sign, signed, or turned down with our reason. It sees its own
  part, never our price to the customer. The office makes it a change order to the customer
  (`draftChangeOrderFromRequest`, drafted the way Bill the customer drafts one) or turns it down
  with a reason (`turnDownChangeRequest`); after the customer signs, the change goes to the trade
  the usual way. Fair Oaks has one waiting: Tri-County's rock at the north footings
  (`TradeChangeRequest`, `portalChangeRequests`, `openChangeRequests` in `gcPortal.ts`;
  `GcPortalChanges.tsx`). The office's list is the Owner Billing lane's to draw.
- **A company asked to the pre-bid meeting sees it in its portal** (owner, 2026-10-04, on the New
  Project lane's `preBid`): a block on the project page (when and where, who runs it, whether coming
  is required to quote, then "You came" or "You did not come"), Needs you before it (amber if
  required) and red after a required one it missed, and the invitation in Their messages, all in
  the company's language ("10 a. m." in Spanish). The invitation is dated the day the meeting was
  set or last moved (`setOn`) (`portalPreBid` in `gcPortal.ts`, `GcPortalPreBid.tsx`).
- **A trade sends its own schedule of values** (owner, 2026-10-04, question 4, on the Board lane's
  `gcTheirSov.ts`): the quote form's optional **Your schedule of values** starts as Rough-in, Top
  out, Trim (Spanish "Obra negra", "Antes de cerrar muros", "Acabados", for the native reader to
  check); the company renames, adds or takes out lines and sees the gap until they add up to its
  quote, and Send waits until they do or the amounts are cleared. Awarded without one, its
  statement of work offers **Send your schedule of values**, adding up to the price; once sent it
  reads "Billed $89,000 to date: through Underground and gear, 19% into Rough-in." on its own lines
  (`portalSovCheck`, `portalSovReached` in `gcPortal.ts`; `SovEditor`, `TheirSovOnSow`).
- **Your papers: every paper a company signed with us, in one list** (owner, 2026-10-04): behind
  **See every paper** under its paperwork, its own (the master agreement, W-9, insurance, its
  company form), then each job's (statement of work, change orders, each pay application with its
  conditional and unconditional waivers, the final releases), newest first, each with its day. A
  pay application or waiver opens its 702 and 703; the agreement opens read-only with **Print**;
  **Print this list** prints the list alone (`portalPapers` in `gcPortal.ts`, `GcPortalPapers.tsx`,
  `gcPortalPrint.ts`).
- **A company sees its days on site by our daily log** (owner, 2026-10-04, on the Building lane's
  log): above the percents it reports, "Our daily log has you on site 6 days since Mon Sep 21, the
  last on Thu Oct 1." It names the log's first day, so it never says more than the log can
  (`portalOnSite` in `gcPortal.ts`, on `onSite`). A job with no log shows nothing.

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
- The schedule's "a few days" of grace on a milestone is 3 days (`MILESTONE_GRACE_DAYS`, not built
  yet).
- A new project's budgets start blank. **Fill the empty budgets from the size** multiplies the
  square feet in the size line by each trade's middle cost per square foot on our past jobs, or by
  a rough rate when we have none (`BUDGET_PER_SQ_FT`, made-up numbers, $3 for painting to $18 for
  steel and electrical), rounded to $500. The owner left this call to the New Project lane.
- A new set starts as an addendum while we bid and a bulletin once the job is ours. In pasted
  notes a sheet number without a dash needs three digits (A101, not R30), and a sheet the index
  lacks is written the way the index writes its others (S301 reads S-301).
- The pay application asks for the period date every time, the address and license once (kept on
  the company), and a typed name and title with the waiver tick as the signature. A line can be
  lowered to what was billed before, never below. The 702's "To" line reads Click Construction,
  the name the portal already uses (`GC_COMPANY_NAME`).
- The daily log looks back 5 working days for a missed log (`LOG_LOOKBACK_WORKDAYS`), Monday to
  Friday, not before work started, and today is not late yet. The ring card asks for it only while
  work is still being reported (a job whose work is all in is closing out).
- The look-ahead's reliability is read over the
  last 4 weeks (`RELIABILITY_WEEKS`), this week counted once its marks are verified. A line we sent back counts at what we see on it. The first
  draft's stages and durations are the New Project lane's (`SCHEDULE_STAGES`).
- Closeout: a release's approval is locked by the same paperwork rules as a draw. "Held" counts
  until the release is paid, not when it is approved (`retainageHeldNow`). The stages of our own
  crew's work are worth underground 20%, rough in 35%, top out 25%, trim 20%
  (`CREW_STAGE_WEIGHTS`). Approving less needs a note, like sending back. **Close the job** is
  offered only when nothing is left; the model trusts the screen, as it does for Approve.
- Sending a draw back: the note is required; a resend keeps the same application number; only a
  draw waiting on us can go back (a retainage release too); nothing billed changes. The resend's
  percents become the trade's report, even lower than it was.
- A trade's change order is numbered and worded as the owner's ("Change order 3: Add a coffee bar
  cabinet…") and carries what it costs us, not what the owner pays. A credit is signed as done
  (100%), so it comes off the trade's next pay application.
- Owner billing (`gcOwnerBilling.ts`): the pay application goes on the 25th. A trade's line on
  the owner's bill is the work its company reported, before we approve their draw. General
  conditions, contingency and fee follow the share of the trades' work done, and each trade's
  line carries its share of them in proportion to its own amounts (`spreadMarkup`). The owner holds the percent on
  their customer record, 10% when it says nothing. Our own crew's line bills what Draws → Our
  own crew reports (`ownCrewWork`, by stage once reported that way); Bill the owner only shows it.
- Change orders to the owner (`gcOwnerBilling.ts`): the price starts at what it costs us plus the
  job's fee, and the office can type over it. A signed one raises the owner's price and bills as a
  line of its own, not spread, since its price already carries our fee. Its percent done is marked
  under Change orders until the trade signs the change; from then on it is the trade's report on
  that line (`changeOrderPct`, owner's call 2026-10-03), and the trade's own line leaves the
  change's line out, so the work bills once.
- The architect's certificate (`architectCertify`): the architect certifies in their own portal
  (**See what the architect sees** on Bill the owner, `GcOwnerBillingArchitect.tsx`): **Certify $X**,
  or **Certify less** with the amount and why. The made-up history counts as certified as asked.
  Their portal lists the trades' questions sent to them, read only: the New Project lane's
  `answerQuestion` records the answer. The screens wait for the certificate; the record still takes a payment
  that comes in without one, at what we asked.
- When the owner pays (`ownerPayDue`, `ownerLateBills`): a bill is due on the newest day the owner
  promised, else the day we expected it (the certificate plus their usual days to pay); it is late
  the day after, the Pipeline's rule. A promise that passed stays on the record after a new day. A
  part payment (`ownerPayPart`) leaves the rest open; **Mark paid** pays the rest. Each payment gets
  its own unconditional waiver for what it paid. The owner can pay another amount or give their
  word in their portal (`ownerPromisePay`, who: owner).
- Money in and money out (`projectCash`): paid in is what the owner paid on our pay applications
  (the made-up record before any went); paid out is the trades' paid draws, retainage released
  included. Our own crew (payroll) and general conditions carry no cost in the prototype. In the
  real build it is for the owner and the controller, like the rest of the app's money.
- Money across every job (`allJobsMoney`, `GcOwnerBillingMoney.tsx`, built by the Owner Billing
  lane for the Board lane to place as a **Money** tab on the board): the jobs that are ours (buying
  out or building) added up the way `projectCash` adds one ("Across our 3 jobs we are $80,428
  ahead"), then **Who owes us**, a late bill first and one waiting on the architect last, then each
  job on a row. **Bill the owner** on any row opens that job's tab.
- The next weeks of money (`cashAhead`, `gcOwnerBillingAhead.ts`, `GcOwnerBillingAhead.tsx`, on the
  Money tab): six weeks from this week's Monday, what comes in and goes out each week and where we
  stand at its end, starting from today's. Only what is on the books counts: an owner's bill on
  their promise or the day we expect it, an approved draw on its pay-by day, a draw asked for as if
  we approve it today. Owner money already late counts this week only when the box is ticked.
  Retainage on both sides waits until it has a day: a trade's is 10 days after the owner pays our
  final. What we expect counts too, marked expected, unless its box is unticked (owner's go-ahead
  2026-10-04): the bill each job sends on the 25th, on the day that customer usually pays, and each
  trade's next draw for the work it reported and has not drawn (what we see, on a pay application we
  sent back), less retainage, paid 10 days after the bill day. On the made-up jobs that moves the low
  point to $117,680 carrying the week of Nov 2: we pay the trades before the customers pay us.
- Insurance within 30 days of running out (`COI_WARN_DAYS`) turns its chip amber, asks under
  Needs you, and emails the company 30 days before the date.
- A new insurance certificate counts the moment the company sends it; nobody in the office checks
  it first. A new one is good for a year until they change the day.
- A company answers every line the office marked "not clear" (in or left out) before its number
  can go again. A new set that does not change their trade asks them to open it but does not warn.
- The invitation names the trade, the address and size, the due day, the newest plans and the
  scope lines; the text says the same in one sentence with the link. A company sees the welcome
  until it presses **Got it**; one that already bid, opened plans or signed the master agreement
  never sees it.
- Lines are marked against the company's number, or against the set it last opened when it has
  no number; a company that never opened the plans has nothing marked.
- A number is good for 30 days unless the company picks 15, 60 or 90; past its last good day it
  shows as ran out and asks to be sent again. Alternates are the company's own (another way, at a
  different price); the office does not set alternates every bidder must price. Only the quote
  file's name is kept.
- The portal's Spanish follows the sub portal's (usted, its terms: Contrato maestro, orden de
  trabajo, renuncia de gravamen). What the office typed (project names, trades, scope lines, notes)
  stays as typed. The choice is kept on the company's record and its messages go out in it. The
  Building lane's pay application reads it too, the 702 and 703 included (the owner's call), and
  so does the Board lane's bid tab (`usePortalLang` in `gcPortalLang.ts`; the words they share are
  in `PORTAL_SPANISH.md`).
- The look-ahead asks for this week's marks from Friday on (the week's end), and for last week's
  any day while one is unmarked; it shows only on a job being built. A mark replaces the
  company's earlier one for that week until our superintendent verifies it, then it stays.

## Open questions (the owner's to answer)

1. ~~Is this for Click taking GC work itself, or a product other GCs use?~~ Answered: Click
   itself, built so a later company could be added (see *Decided by the owner*).
2. ~~Does the first real version need the price-to-the-owner side, or does it start at buyout?~~
   Answered 2026-10-04: **start with bidding**, the order *The plan* below already runs (buyout's
   award picks from the quotes gathered while bidding).
3. ~~Are trade partners mostly known companies, or do strangers get invited and need vetting?~~
   Answered 2026-10-04: **strangers need vetting: anyone can quote, and award stays locked until
   the office approves them.** A new company fills a short form in its portal (license, insurance,
   years in business, references, past jobs); the office picks *Approve*, *Approve up to $X* or
   *Decline*. Their quote shows with a "not vetted yet" chip until then.
4. ~~Draws by stage (rough, top out, trim) or by percent with retainage, as drawn?~~ Answered
   2026-10-04: **by percent with retainage, as drawn.** "These usually match a schedule of values
   based on the rough in, top out, trim stage": **capture the trade's own first schedule of values**
   (with its quote) and show it **side by side** with ours on the statement of work and on each draw.
   On each draw (Building lane, 2026-10-04): Draws says where the draw landed on theirs ("Their
   schedule: through Underground and gear, 65% into Rough-in."), and the office's pay application
   window shows the two side by side with what it claims to date (`drawOnTheirSov`,
   `payAppClaimedToDate`: work in place on the original lines, without change orders or stored
   materials).
5. ~~Where do a GC project's plans live?~~ Answered 2026-10-04: **in Google Drive, uploaded by
   someone who checks them** before they go out. (Who opened which set is then read from the
   portal's link to the Drive file, not from Drive.)
6. ~~"Quote" or "bid" for a trade partner's number?~~ Answered 2026-10-04: **trades give us
   quotes; we give the owner our bid.** *Compare bids* becomes *Compare quotes*; *Bid tabs* keeps
   its name (the trade's own word for the list of everyone's numbers). Each lane changes its own
   words, the portal's Spanish too.
7. ~~Should a bid tab mark who was awarded?~~ Answered 2026-10-04: **yes, set by any estimator
   on our team.** ~~Should Start allow a "start anyway"?~~ Answered 2026-10-04: **yes.** ~~Should
   the map list run closest first or most reliable first?~~ Answered 2026-10-04: **most reliable
   first.**
8. ~~Should promises other than a quote date be tracked?~~ Answered 2026-10-04: **yes, all of
   them**: an insurance certificate (above all, its renewal before the policy runs out), a W-9, a
   signed statement of work, a start or move-in day, submittals, a material delivery, a pay
   application fixed and sent again, punch items fixed, closeout papers and lien waivers. They
   count in the company's word record like a quote date (the Board's default). Building's kinds
   are built (Building lane, 2026-10-04) on the Board's record, each written down where it lives
   (*They gave a day*): a start on Schedule's **Starting soon** (a trade due within two weeks and
   not on the daily log yet, with how far its day is past the plan), submittals and a delivery on
   Submittals, a pay application sent back on Draws, punch items on the punch list, and the papers
   a trade owes (each unconditional waiver for a paid draw, and the final pay application) on Draws
   and Closeout. The trade's own move keeps each (`buildingPromisesKeptBy`): the first daily log
   with its crew keeps a start on the log's day, the last submittal it owes, the pay application
   sent again, the last punch item fixed, and the last paper it owes. A delivery is marked by hand
   (*It came*). A kept day shows under the thing for a week. `gcBuildingPromises.ts`,
   `GcBuildingPromise.tsx`.
9. ~~Should the Project Board also group by customer?~~ Answered 2026-10-04, after the before and
   after mock-up (`board-by-customer-before-after.html`): **a switch, By stage | By customer, with
   By stage selected every time the board opens.** Built (Board). ~~Should Actions for assistants
   also sit on the Project Board?~~ Answered 2026-10-04: **"Assistants could follow up the same way
   estimators could."** Read as: an assistant has every Follow up move an estimator has (calls,
   dates, nudges, promises, Who else?); *Actions for assistants* stays on Trade partners.
10. ~~Should ticking **Ours** start our own bid in Trades mode, and count only once that bid is
    priced?~~ Answered 2026-10-02: yes (see *Decided by the owner*).
11. ~~Should a budget come from the size?~~ Left to the New Project lane, 2026-10-02: budgets
    start blank and **Fill the empty budgets from the size** fills them (see *My defaults*).
12. ~~The pay application leaves out the notary block and materials stored on site (column F
    reads $0). Which of these do our trades need? Should it download as the AIA Excel template or
    a PDF?~~ Answered 2026-10-04: **both the notary block and materials stored on site, and it
    downloads as both** the AIA Excel template the Jobs Stages tab fills and a PDF. Materials
    stored on site are built (Building lane, 2026-10-04): the trade enters what is on site per line
    on its pay application; it is column F and counts in G and line 4, with retainage held on it;
    the draw keeps it, and once it is built it moves from F into E and is never paid twice
    (`payApplication`'s `stored`, `drawMoney`). The Excel, the PDF and the notary block are one
    shared builder (the Owner Billing lane's `gcPayAppFile.ts`). The trade's window (Building lane)
    has **⤓ Excel** and **⤓ PDF** in its header, from the trade to us (`tradePayAppParties`, with
    each signed change order marked new since the last application or not), and the notary block
    under the trade's signature. In Spanish the files stay the AIA form in English, and the window
    says so.
13. ~~On the owner's bill, do our general conditions, contingency and fee show as lines of their
    own, or spread into each trade's line so the owner never sees the fee?~~ Answered: spread
    into the trades (see *Decided by the owner*).
14. ~~Should a trade also give alternates, attach its own quote, and say how many days the number
    is good for?~~ Built on the owner's word (2026-10-02); Compare bids and Trades read them
    (Board, 2026-10-03). ~~Should an alternate the office takes change the number we carry, and
    should a number that ran out stop counting?~~ The owner left it to the Board lane
    (2026-10-04), which decided: **an alternate changes our number only when the office takes it**
    on Compare bids; **a number past its good-until day stops counting** toward the two quotes and
    is not a real number to carry until the trade sends it again (the portal's bid form).
15. ~~Should answering a "not clear" line be a move of its own?~~ Built (2026-10-02):
    `tradeAnswerLines`, logged as "answered on Concrete: Rebar supply is in their number".
16. ~~Should a trade's retainage wait until the owner releases ours?~~ Answered: 10 days after.
17. ~~What papers must a trade turn in before its retainage comes back?~~ Answered: the
    conditional final release of lien.
18. ~~Should a closed-out project leave Building for its own section?~~ Answered: yes. The
    section on the board is the Board lane's to build.
19. ~~Approve less than asked? Flag a draw sent back twice?~~ Answered: yes and yes.
20. ~~Should the office see which companies never opened their link?~~ Built (owner, 2026-10-03):
    "never opened the link" in place of "not opened" on Trades and its list of who we asked, and on
    the Follow up card; amber, red past `OPEN_WITHIN_DAYS` (`linkNeverOpened` in `gcPortal.ts`,
    `GcPortalLinkChip.tsx`). The Portal lane placed it in the Board lane's two files, with the owner's OK.
21. ~~Should our own crew report by stage?~~ Answered: yes (*Decided by the owner*).
22. ~~Should a trade see sheets the office did not set, or only the ones it set?~~ Answered
    2026-10-03: only the sheets the office set (see *Decided by the owner*).
23. ~~The schedule: is a milestone hit only on its day, and how many weeks does the look-ahead
    show?~~ Answered 2026-10-02: within a few days, and three weeks.
24. ~~The schedule: who marks a look-ahead activity done or not each week?~~ Answered
    2026-10-02: the trade in its portal, verified by our superintendent.
25. ~~Should a company's language be kept on its record, so its emails go out in Spanish?~~
    Answered 2026-10-03: yes (`Partner.lang`, set by the company's **Español** button,
    `tradeSetLanguage`), and the office can set it too on Trade partners (`setPartnerLanguage`,
    `GcPortalLanguagePick.tsx`). The Spanish was written by the prototype; a native speaker should
    read it before it ships, from the list at the end of `PORTAL_SPANISH.md`.
26. ~~Does the architect certify our pay application before the owner pays, the usual AIA way and
    what lenders often want?~~ Answered 2026-10-03: yes (see *Decided by the owner*).
27. ~~A bid we lost (the Board lane's "We lost this"): should "A new set of plans came in" and
    "Questions about the plans" still open on it?~~ Answered 2026-10-03: no. The plans window
    stays to read; the Plans tab says "We lost this bid. Nothing goes out." in place of both doors
    (`GcPlansDoors` in `GcNewPlans.tsx`). `issuePlanSet` refuses a lost bid and `questionsOpen` is
    false on one, so a portal cannot ask either. Reopen it and both come back.
28. ~~Should a change order the owner signs move the substantial completion date by the days it
    adds?~~ Answered 2026-10-04: **yes.** Substantial completion is the milestone's day plus the
    signed change orders' days (`substantialCompletionOn` in `gcBuildingSchedule.ts`, reading
    `contractDaysAdded`), worked out, never written. Schedule, the owner's portal ("Substantial
    completion Dec 16: Dec 11 in the contract, plus 5 days by the change orders you signed") and
    the change orders chip on Bill the owner all read it. Against it, the finish the schedule
    forecasts (`projectedFinish`, Building, 2026-10-04, for Owner Billing's late-finish warning):
    the later of the plan worked through what waits on what, where nothing unfinished finishes
    before today, and the baseline's finish moved by how far the work runs behind. It comes with
    a sentence of why. Fair Oaks D: Dec 11, 3 days behind. Schedule's measures card shows it as
    **Projected finish** with days past the contract, no days to spare, or days to spare (the late
    fee in dollars stays on Bill the owner).
29. ~~Texts to trade partners: add a text sender before the real build, or send email only?~~
    Answered 2026-10-03: **email only for now** (through Resend, as the app sends today). Every
    lane's notification table reads "by email"; a text sender is not part of the first real build.

## The schedule (proposed 2026-10-02, built 2026-10-03)

Built 2026-10-03 by every lane. The Building lane: the **Schedule** tab with its four measures,
the chart and the look-ahead; drawing it in Buying out, with Start keeping the baseline; the
superintendent's verify list; inspections that pass or fail (`gcBuildingSchedule.ts`,
`GcBuildingSchedule.tsx`); the measures on a building job's board row and ring card
(`scheduleSummary`, `GcBuildingScheduleBlock`). The New Project lane: the first draft by stage of
the job, inspections included (`scheduleDraft`). The Portal lane: the trade's weekly done or not
(`tradeMarkLookAhead`, `GcPortalLookAhead.tsx`). The Board lane: the Get started step and the lines
on Trade partners (`gcPartnerSchedule.ts`). The owner's answers are under *Decided by the owner*;
the bullets below are the shape they set.

- **The activities are the statement of work lines**: the same schedule-of-values lines a trade
  reports its percent on and draws against. Our own crew has no statement of work; its activities
  are its scope lines, which it already reports by stage (`selfPerform.pctByLine`, `crewStages`
  in `gcBuilding.ts`): underground, rough in, top out and trim. So "how far along" and "how far
  along it should be" are read on the same line for every trade.
- **We draw it during Buying out.** Each activity gets a planned start and finish and the
  activities it waits on. The first draft comes from the stages of the job (`scheduleDraft`,
  `lineStage`, `SCHEDULE_STAGES` in `gcNewProject.ts`): each line falls in a stage by its words or
  its trade (site prep, foundations, underground, slab, structure, dry-in, framing, rough-in,
  close-in, finishes, trim, site finish, closeout), each stage waits on the one before it, the
  trades' rough-ins run side by side, close-in waits on the rough-in inspection, a final inspection
  follows all the work, and paving waits
  only on dry-in. The Building lane's **Draw a first draft** switches to it from its stand-in. Milestones (dry-in, rough-in
  inspection, substantial completion) are dates the schedule must meet; each can belong to a trade.
  **Get started** gains a step, "the schedule is drawn", and **Start** locks it as the baseline.
- **The four measures, read in Building:**
  - *Percent complete vs planned*: the percent reported on each line against the percent the
    baseline planned for today, weighted by each line's dollars, the way the ring weighs work now.
  - *Critical-path float*: each activity's spare days, from the links and durations. Zero spare
    days is the critical path.
  - *Milestone hit rate*: milestones finished within a few days of their planned day
    (`MILESTONE_GRACE_DAYS`), for the job and for each company.
  - *Look-ahead reliability*: each week the schedule lists the coming weeks' activities (two or
    three weeks). At the week's end the trade marks each done or not in its portal,
    with a reason when not (weather, the trade before, materials, crew), and our superintendent
    verifies the mark or corrects it. Verified done out of planned, per week, per trade and per
    company. A mark not yet verified is shown as waiting and does not count.
- **Where it shows**: a schedule view in Building; "4 days behind" on the board row and in the
  ring's card; milestone hit rate and look-ahead reliability on Trade partners, beside "answers
  when asked"; the weekly done or not in the trade's portal; the superintendent's verify list in
  Building.

## Workflow steps not built yet


- The schedule, the rest: days are calendar days for now.

- New Project past its first form: the past jobs a budget reads are the prototype's own made-up
  projects; the real build reads the company's closed jobs. A line's sheets show in New Project, a
  new set, the plans window, Compare bids (Board) and the portal's bid form; its sections in New
  Project, a new set, the plans window and the portal's bid form. What a trade leaves out shows in
  New Project, the Trades tab, Compare bids and the portal's bid form and invitation.
- Our billing to the owner, the rest: our own crew's percent read from its Pipeline job (real
  build only; see *Where it plugs in*). The company window reads the pay applications through
  `ownerMoney`, with certified and waiting-on-the-architect beside what they owe (Board, 2026-10-03).
- No email is sent and nothing notifies anyone when a promised day passes.
  Building's events, and where each would go (Building lane, 2026-10-03; email only for now, the
  owner's answer to question 29, sent through Resend; the office's go to the app's Inbox too):

  | Event | Who hears | Where |
  |---|---|---|
  | A trade asks for a draw (`tradeSendPayApp`, `tradeSendFinalPayApp`) | The project manager | Inbox and an email, "approve it on Draws"; the ring card already says so |
  | A draw sent back or approved for less | The trade | Email with our note; the portal already shows it, and its messages list has the approved-for-less note |
  | An approved draw's pay-by day (`drawPayDays`) | The office | Inbox the day before; the ring card and **To pay** already flag it once late |
  | Look-ahead marks to verify (`verifyList`) | The superintendent | An email Friday afternoon once the trades' marks are in, opening **To verify** |
  | A milestone due inside its grace, or late (`milestoneRows`) | The project manager | The morning email; the board row and ring card already show it |
  | An inspection failed (`failInspection`) | The named trades, the superintendent | The trades: email with what failed and the re-inspection day (the portal already shows it). The superintendent: a reminder the day before the re-inspection |
  | A punch item added or sent back; an item fixed | The trade; the superintendent | The trade: email with the item. The superintendent: **To verify** and an email when an item is marked fixed |
  | A change order sent to sign (`sendTradeChange`) | The trade | Email with its portal link (the Portal lane's messages) |
  | Retainage can be paid (`tradeRetainageOpensOn`) | The office, the trade | Inbox on that day; the trade hears that its release is coming |

  The trade portal's events, and where each would go (Portal lane, 2026-10-03). Every message goes
  out in the company's language (`Partner.lang`, set by the company or the office) and carries its
  one portal link (`portalLink`, no password). **Their messages** already shows each email as
  written (`portalMessages`); nothing is sent. Everything goes by email, through Resend (the
  owner, 2026-10-03: email only for now, question 29):

  | Event | Who hears | Where |
  |---|---|---|
  | A new ask (`invite`) | The company's contact | Email the day we ask: the trade, the project, the day the quote is due, what it should cover. Asked to quote on the home |
  | A set that changed their trade (`issuePlanSet`) | Each company on the trade: every one bidding it while we bid, only the one on it once the job is ours | Email the day the set goes out, naming the changed sheets. Needs you says "Confirm your number or change it" |
  | A promise passed (`askPromise`, and every date in `tradePromises`) | The company; the project manager | The company: one email the next morning, in Needs you's words ("You told Click your number would come by …"). The office: Follow up already lists it first; the project manager gets it in the morning email in the bid's last week |
  | An answer to their question (`answerQuestion`) | Every company bidding the trade, or the one on it once the job is ours. Never who asked | Email the day it is answered, with the question, the answer and the set it rides in. Needs you for a week |
  | A reminder the office sends (Follow up) | The company | Email |
  | A bid tab shared | Each company that quoted | Email; Needs you until opened |
  | The master agreement, a statement of work, or a change order to sign | The company | Email; Needs you until signed |
  | The day work starts | Each company on the job | Email |
  | A draw paid, or approved for less | The company | Email with the amount and the waiver it now asks for |
  | Insurance running out (`COI_WARN_DAYS`) | The company | Email 30 days before; Needs you, red once it ran out |
  | A bid we lost (`markLost`) | Each company still on a trade there | Email the day it is marked |
  | A pre-bid meeting set (`schedulePreBid`) | Each company still quoting a trade there | Email the day it is set, with when, where and whether it is required |
  | Look-ahead marks due (`lookAheadOwed`) | Each company on a job being built | An email Friday morning, "Mark your week"; Needs you already says so |
  | The office decided on a company it did not know (`vetPartner`) | That company | Email the day it is decided: approved, with its limit, or declined (Their messages already writes it) |
  | A company asked for a change (`tradeAskChange`) | The project manager | Email the day it comes, with what, why, the amount, the days and the photo. The office's list of changes asked for keeps it until answered |
  | We answered a change it asked for (`turnDownChangeRequest`, the change order sent, the customer's no) | The company | Email each time, with its part, never our price to the customer (Their messages already writes them) |

  Billing the owner's events, and where each would go (Owner Billing lane, 2026-10-03). Every one
  is an email, through Resend (question 29: email only for now). The owner and the architect get
  their one portal link in it, the way the app's customer portal statement and its pay link work
  today. Money across the jobs (Money, the forecast) goes only to the owner and the controller,
  like the rest of the app's money. The days marked *default* are the lane's guess until the owner
  says otherwise:

  | Event | Who hears | Where |
  |---|---|---|
  | Bill day is near (`nextOwnerBillDay`, the 25th) | The project manager | Email two days before: the draft's amount, and whose waivers are missing (`missingTradeWaivers`). *Default: two days* |
  | A trade we paid still owes its unconditional waiver (`tradesOwingUnconditional`) | The trade | Email the week before bill day, asking for it. Their portal's Needs you already lists papers to sign |
  | We send a pay application, or the final one (`sendOwnerPayApp`, `sendOwnerFinalPayApp`) | The architect; the owner | The architect: email, "Pay application 3 for $288,879 to certify", opening **Pay applications to certify**. The owner: email with the 702 and 703 and our conditional waiver; it shows under **Your bills** |
  | A pay application waits on the architect (`appCertified` null) | The architect; the project manager | The architect: a reminder email after 3 days. The project manager: an email after 5. *Default: 3 and 5 days* |
  | The architect certifies (`architectCertify`) | The owner; the office | The owner: email with the certified amount, the day we expect it and **Pay**. The office: an email only when it is certified less, with why and the amount the next bill carries |
  | A bill's day is near (`ownerPayDue`) | The owner | Email 3 days before the day they gave or the day we expect it. *Default: 3 days* |
  | A bill is late (`ownerLateBills`) | The project manager and the controller; the owner | The office: an email the next morning; **Who owes us** on Money and **So far with** on Bill the owner already put it first. The owner: one email the next morning, "Pay application 3 was due Sep 30, the day you gave". The real build runs it through the Pipeline's payment chase and its promise events |
  | The owner gives a day, or pays part (`ownerPromisePay` who owner, `ownerPayPart`) | The project manager | Email, with what they said or paid and what is still open |
  | The owner pays (`ownerPaid`, a part that closes it) | The office; the owner | The office: an email. The owner: an email with our unconditional waiver for what they paid (`ourOwnerWaivers`) |
  | A change order to sign (`sendChangeOrder`) | The owner | Email with its price and the days it adds; Needs you in their portal until they sign or decline. The office hears either answer by email; a signed one goes on to the trade (Building's `sendTradeChange`) |
  | Every line is billed (`ownerAllBilled`) | The owner | Email asking them to walk the space and accept the work; the office hears by email when they press **Accept the work** |
  | The forecast dips below today (`cashAhead`'s lowest week) | The owner and the controller | The Monday morning email: "We go down to $39,272 carrying the week of Oct 12", with the late money not counted |

  New Project's events, and where each would go (New Project lane, 2026-10-03). Every one is an
  email through Resend (question 29: email only for now). What a trade hears is in the Portal
  lane's table above; this one is the office's side and the architect's. The days marked *default*
  are the lane's guess until the owner says otherwise:

  | Event | Who hears | Where |
  |---|---|---|
  | A project is created (`createProject`) | The companies ticked on **Who to ask** | The board's ask, one per company (the Portal lane's "A new ask"). Nothing to the office, which just pressed the button |
  | A set goes out (`issuePlanSet`) | The trades (the Portal lane's row); the project manager and the superintendent once the job is ours | The office: email the day it goes out, with what it changed, what it takes out, the activities it moves or adds and the job's last day before and after. A trade that is ours gets it too, to check our own bid against the set |
  | A set changes a job we won | The owner | Only through the change order it starts (Owner Billing's "A change order to sign"), with the days it adds. Nothing more |
  | A question comes in (`tradeAskQuestion`) | The project manager running the bid | Email the day it is asked, with the company, its words and the sheets. **Questions about the plans** already shows the count |
  | A question goes to the architect (`sendQuestionToArchitect`) | The architect | Email with the question, the sheets and the day questions close. A reminder after 3 days without an answer. *Default: 3 days* |
  | The architect answers (`answerQuestion`) | The trades (the Portal lane's row) | Nothing to the office, which typed it in |
  | Questions close soon (`questionsCloseOn`) | Every company bidding; the project manager | The companies: email the day before questions close. The office: email that day with the questions still open |
  | An answer waits for a set (`answeredNotInSet`) | The project manager | The morning email after 2 days: "2 answers wait for the next set". *Default: 2 days* |
  | A gap between the trades (`projectScopeGaps`) while we bid | The project manager | The morning email until each gap is picked up. The Trades tab already shows it |
  | A pre-bid meeting is set or moved (`schedulePreBid`) | Every company quoting | Email with the day, the time, the place and whether coming is required (`preBidInviteEmail`); a reminder the day before |
  | The pre-bid meeting is held (`recordPreBidAttendance`) | The project manager | Email that day with who came and who missed a required meeting; the minutes ride in the next set |

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
| The pay application (702 and 703) | The Jobs Stages tab's AIA G702-G703 window: `aiaG702G703Template.ts` (fields and cells) and `fillAiaG702G703Workbook.ts` (fills the bundled xlsx). The prototype fills that template too, every line on the 703 from row 13, and draws a PDF with the notary block (`gcPayAppFile.ts`, one builder for ours and the trades'). The app's own filler writes only row 13. |
| Our own crew's percent done | The Pipeline job's percent reports, newest wins: `currentReportPctByJobId` (`jobSummaryPercentComplete.ts`) and `newestPercentEvent` (`jobChargesTimeline.ts`). In the real build our own trade names its Pipeline job (`selfPerform.ref`), each stage reads that job's newest report, and Draws shows the stages read-only with the day reported. The prototype has the stages set by hand on Draws. Building lane, real build only. |
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
| `gcPlans.ts` · `gcStart.ts` · `gcProgress.ts` | Plans, sheets (what each set took out, `sheetsGoneAtRev`; a pasted index against ours, `indexDiff`; what a note takes out, `takenOutInText`), what a later set is called and who hears about it (tested in `gcPlans.test.ts`) · the Get started checklist · the ring and its hover card. |
| `gcBids.ts` · `gcCustomers.ts` · `gcMap.ts` | Compare all in, what we carry, our price, bid tabs, statement-of-work money · the company window's summaries · towns, the drive and the map's list. |
| `gcFollowUp.ts` · `gcBench.ts` | Promised days, word records, who to call first · the bench by trade and Actions for assistants. |
| `gcNewProject.ts` · `gcNewProject.test.ts` | New Project: the sheet index read from a paste, the trades guessed from the sheets (a later set uses the same guess, `packagesForSheets`), each trade's usual scope and each line's sheets (`guessLineSheets`, `lineSheets`, `linesOnSheets`), the project manual read from a paste with each section's trade and each line's sections (`specIndexInText`, `tradeForSpec`, `tradesForPlans`, `guessLineSpecs`), the sections a later set names and what they reach (`specsInText`, `specsAtRev`, `packagesForSpecs`, `linesOnPlans`), what a whole new set leaves behind and the made-up reissues to try it (`linesLeftBehind`, `withRetiedLines`, `sampleReissue`, `sampleReissueSpecs`), the project made from the draft (`createProject`), trades a later set brings · its kernel test. |
| `gcPortalI18n.ts` · `gcPortalI18n.test.ts` | Every word of the trade's portal in English and Spanish, the Spanish dates, and the test that both languages carry the same blanks |
| `gcPortal.ts` · `gcPortal.test.ts` | What the portal tells one company: its home (every ask sorted into bidding, jobs and before, what needs it in order, its money), plan news for its trade, its promised day, its insurance, the lines the office could not read, each line's sheets and what a newer set changed (`portalLines`, on `lineReads`), its messages, its look-ahead, its pay, who to call, its questions, a bid we lost (`portalClosedWords`) · its kernel test. |
| `gcReducer.ts` · `gcReducerHelpers.ts` · `gcFixture.ts` | Every action applied to the state · its small helpers (not in the barrel) · the made-up data (`initialGcState`). |
| `gcModel.test.ts` | The golden test (see *Working in parallel*). |
| `GcOfficeTabs.tsx` | Trades (with Compare bids), Plans, Our number, Contracts, Draws, the flat company list |
| `GcTradePortal.tsx` | The trade partner's side: the frame, each trade's plans, bid, bid tab, statement of work and draws |
| `gcPortalLang.ts` | The portal's language, held by the frame and read by every portal screen (`usePortalLang`) |
| `GcPortalBidExtras.tsx` | The bid form past the number: good for how many days, alternates, the company's own quote, answering the lines the office could not read |
| `GcPortalLanguagePick.tsx` | For the office: a company's language on Trade partners |
| `GcPortalLinkChip.tsx` | For the office: a company we asked that never opened its portal link (Trades, Follow up) |
| `GcPortalQuestions.tsx` · `GcPortalContacts.tsx` | Questions about the plans in the trade's portal · Who to call on a job |
| `GcPortalPay.tsx` | Your pay in the trade's portal: every pay application, what is on the way, what is held |
| `GcPortalPapers.tsx` · `gcPortalPrint.ts` | Your papers: every paper the company signed with us, to open or print · printing one paper or list on its own |
| `GcPortalDates.tsx` | The dates a company gave us (question 8), with Move the date |
| `GcPortalLookAhead.tsx` | The weekly look-ahead in the trade's portal: three weeks, the company's done or not done with a reason |
| `GcPortalLineSheets.tsx` | The sheet numbers beside each line of the bid form, and the lines a new set touches |
| `GcPortalHome.tsx` · `GcPortalMessages.tsx` | The company's home in its portal, where the link lands, with the first-visit welcome · what we sent the company, each message carrying the link |
| `GcPortalPaperwork.tsx` · `GcPortalAgreement.tsx` · `GcPortalPlans.tsx` · `GcPortalUi.tsx` | The portal's paperwork block (insurance and W-9 forms) · the master agreement to read and sign · the plans window as a trade sees it · the portal's block, note, window and a status tag that wraps on a phone (`PortalTag`) |
| `GcTradeBench.tsx` | Trade partners by trade, Actions for assistants |
| `GcTradeMap.tsx` | The map window |
| `GcAskThread.tsx` | The contact log, promises, the Follow up tab |
| `GcNewPlans.tsx` | The new-set-of-plans window: its name, the sheets and sections and their titles, a trade it brings, who hears, the email; and the Plans tab's two doors (`GcPlansDoors`), gone on a lost bid |
| `GcNewProject.tsx` | The New project window and its **+ New project** button |
| `GcBuildingPayApp.tsx` · `src/lib/gcMode/gcBuilding.ts` · `gcBuildingWords.ts` | The pay application window (progress and final), its door in the portal (which turns into the trade's closeout list) and its read-only view from Draws · the 702 and 703 numbers, the four steps, retainage held and each trade's closeout (tested in `gcBuilding.test.ts`) · its words in English and Spanish (tested in `gcBuildingWords.test.ts`) |
| `GcOwnerBillingTab.tsx` · `GcOwnerBillingPortal.tsx` · `GcOwnerBillingArchitect.tsx` · `GcOwnerBillingChangeOrders.tsx` · `GcOwnerBillingPayApp.tsx` · `GcOwnerBillingCash.tsx` · `GcOwnerBillingMoney.tsx` · `GcOwnerBillingAhead.tsx` · `src/lib/gcMode/gcOwnerBilling.ts` · `src/lib/gcMode/gcOwnerBillingAhead.ts` · `GcOwnerBillingRetainage.tsx` · `GcOwnerBillingInterest.tsx` · `src/lib/gcMode/gcOwnerBillingInterest.ts` · `GcOwnerBillingFinish.tsx` · `src/lib/gcMode/gcOwnerBillingFinish.ts` · `src/lib/gcMode/gcPayAppFile.ts` · `GcPayAppNotary.tsx` | Bill the owner: the draft pay application, the ones sent, certified and paid, closeout · what the owner sees · what the architect sees · change orders · the 702 and 703 window · money in and out on one job · Money across every job · the next six weeks · the model: the lines and the 702 math, `ownerAccount`, waivers, change orders, when the owner pays, `allJobsMoney` · `cashAhead` (both tested in `gcOwnerBilling.test.ts`) |
| `GcCloseout.tsx` | The Closeout tab |
| `GcBuildingPunch.tsx` · `src/lib/gcMode/gcBuildingPunch.ts` | The punch list on Closeout and in the trade's portal · its counts and states (tested in `gcBuildingPunch.test.ts`) |
| `GcBuildingLog.tsx` · `src/lib/gcMode/gcBuildingLog.ts` | The Daily log tab · working days, missed logs, who was on site (tested in `gcBuildingLog.test.ts`) |
| `GcBuildingSubmittals.tsx` · `src/lib/gcMode/gcBuildingSubmittals.ts` | The Submittals tab and the trade's submittals in its portal · whose move, when needed, the lines held (tested in `gcBuildingSubmittals.test.ts`) |
| `GcBuildingSchedule.tsx` · `src/lib/gcMode/gcBuildingSchedule.ts` | The Schedule tab · its rows, the four measures and the look-ahead (tested in `gcBuildingSchedule.test.ts`) |
| `GcBuildingSendBack.tsx` | The Send back form under a waiting draw, and the list of what went back |
| `GcBuildingCrew.tsx` | The Our own crew card on Draws |
| `GcBuildingPayDays.tsx` · `src/lib/gcMode/gcBuildingPay.ts` | The days on each draw and the To pay card on Draws · pay by and days late from the owner's pay terms (tested in `gcBuildingPay.test.ts`) |
| `GcBuildingChanges.tsx` | A trade's change orders on Draws, with **Send the change to** (the trade signs in the pay application door in its portal) |
| `GcStart.tsx` | Get started |
| `GcBidTabs.tsx` | Bid tabs |
| `GcCustomerWindow.tsx` | The one company window |
| `GcPlansQuickLook.tsx` | The plans window: the sheets, and the manual's sections behind **Specs** |
| `BidsModeToggle.tsx`, `gcUi.tsx`, `gcIcons.ts` | The switch, shared pieces, two copied Bid Board icons |

Two existing files are touched: `src/App.tsx` (the `bids/gc` route) and `src/pages/Bids.tsx`
(the switch, for a dev only).

State of the branch: `npm run typecheck`, the theme check, the golden test and each lane's
kernel tests pass. Lint has
four fast-refresh warnings in `gcUi.tsx` (it exports style objects beside components). The UI is
checked by hand in the browser after every change; the model is pinned by the golden test.

## Working in parallel

**What is left, lane by lane: [`REMAINING.md`](./REMAINING.md)** (2026-10-03). Each lane works down its own section, testing along the way; the Board lane drives it.

Since 2026-10-02 several sessions build the prototype at once, one area each. Each lane is a
branch and a dev-server port of its own; `spike/gc-mode` is where the lanes meet.

| Lane | Branch | Port | Area | Files it owns |
|---|---|---|---|---|
| Board | `spike/gc-mode` (works on it directly) | 5237 | The Project Board and a project's office tabs: the row, the ring and its card, New here?, Trades and Compare bids, Our number, Bid tabs, Contracts, Get started, Follow up, Trade partners, the map, the company window | `src/pages/GcMode.tsx`; `src/components/gc/`: `GcOfficeTabs.tsx` (all but `GcDrawsTab`), `GcProgressRing.tsx`, `GcStart.tsx`, `GcBidTabs.tsx`, `GcAskThread.tsx`, `GcTradeBench.tsx`, `GcTradeMap.tsx`, `GcCustomerWindow.tsx`, `BidsModeToggle.tsx`, `gcUi.tsx`, `gcIcons.ts`; `src/lib/gcMode/`: `gcProgress.ts` (all but `buildingProgress`), `gcStart.ts`, `gcBids.ts`, `gcFollowUp.ts`, `gcBench.ts`, `gcMap.ts`, `gcCustomers.ts`, `gcTour.ts` |
| Portal | `spike/gc-mode-portal` | 5241 | The trade partner's portal: everything a company sees and presses | `src/components/gc/GcTradePortal.tsx`; new files `src/components/gc/GcPortal*.tsx`, `src/lib/gcMode/gcPortal.ts` |
| Building | `spike/gc-mode-building` | 5242 | Building and Closeout: reports, draws, retainage release, final waivers | `GcDrawsTab` inside `src/components/gc/GcOfficeTabs.tsx` (that function only); `buildingProgress` in `src/lib/gcMode/gcProgress.ts` (that function only); new files `src/components/gc/GcBuilding*.tsx` / `GcCloseout*.tsx`, `src/lib/gcMode/gcBuilding*.ts` |
| New Project | `spike/gc-mode-new-project` | 5243 (5245 while another account holds 5243) | New Project with the plans coming in, splitting the plans into trades, writing each scope; the plan sets that follow | `src/components/gc/GcNewPlans.tsx`, `GcPlansQuickLook.tsx`; `src/lib/gcMode/gcPlans.ts`; new files `src/components/gc/GcNewProject*.tsx`, `src/lib/gcMode/gcNewProject.ts` |
| Owner Billing | `spike/gc-mode-owner-billing` | 5244 | Billing the owner: our pay applications from the work the trades report, the retainage the owner holds on us, what the owner has paid | new files `src/components/gc/GcOwnerBilling*.tsx`, `src/lib/gcMode/gcOwnerBilling*.ts`; the `OwnerBilling` record in `gcTypes.ts` (add fields only). It reads the trades' reported work (Building's) and never writes it; the owner window's billed and paid cells (`GcCustomerWindow.tsx`, `customerSummary`) stay the Board's to change |

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
5. **Plans: sets, the email, who opened it.** New Project's part of steps 1 to 5 in detail (the
   tables, what it reuses, the kernels, nine PRs and the owner's five decisions first):
   `NEW_PROJECT_REAL_BUILD.md` (New Project lane, 2026-10-04).
6. **Compare, carry, our number.** The map's list runs most reliable first (question 7).
7. **Award, master agreement, statement of work, Get started.**
8. **Draws and waivers.** By percent with retainage on our lines; the trade's own schedule of
   values kept beside them (question 4).

Access (question 9, the owner, 2026-10-04): an assistant follows up the same way an estimator does.
Every Follow up move (log a call, write down a day, nudge, record or mark a promise, Who else?) is
theirs too. Awarding stays with an estimator (question 7), and money with the owner and controller.

Each step ships alone with its release note, docs fragment and help guide. The help guides
follow the plain-words rules; the prototype's own words were written to them as far as possible.

## How to verify (the walk used on 2026-10-02)

- **Boerne Retail Shell**: Trades → Compare bids on Electrical; type a cost on Concrete's rebar
  and watch the conclusion flip. Structural steel → On a map → Cannot do it → ask the next.
- **Plans → A new set of plans came in**: paste three lines with sheet numbers; issue; in the
  portal as Alamo Concrete tap the plans line under **Needs you** and press **My quote stands on
  the new plans**. Then type "S301 is a new
  canopy framing sheet. L-101 adds a landscape plan": give S-301 its title and watch Structural
  steel ticked, press **Add Landscaping**, issue **Addendum 2**. Landscaping sits after Sitework
  on Trades. On Helotes the next set opens as **Bulletin 1**.
- **Our number → We sent our bid**, then **Bid tabs** opens. **We won this** moves it to Buying out.
- **Helotes Dental Office → Get started**: from 14 of 24 steps to Start, signing as each
  company through **Sign it as them**. A new plan set after Start goes to four companies only.
- **Fair Oaks Shops, Building D** (under Building): point at the ring for what waits. On
  **Draws**, approve or **Send back** Iron Horse's draw 2; Pecan Valley's **Approve** stays shut
  on its insurance; **Approve less** Iron Horse's erection at 50% and see it in their portal. On
  **Closeout**, **Accept the work** on Concrete and read what is left before **Close the job**.
  In the portal as Summit Roofing, **Fix and resend pay application 1**; as Tri-County, **Fill out
  the final pay application**. On Draws, change a stage of our own crew's plumbing.
- **Follow up**: log a call with a new day on Hillside Excavation and watch the card move down.
- **Fair Oaks Shops, Building D → Bill the owner**: three pay applications to Cibolo, the third
  still waiting; **Mark paid** it. The October draft bills Summit Roofing at what we see (the
  membrane at 50%, they say 100%), and Summit and Cool Breeze are named for missing waivers.
- **Fair Oaks D → Bill the owner**, the owner paying late: pay application 3 is two days past
  Cibolo's promise (Sep 30, their controller on a call). In their portal **Pay another amount**,
  then **Tell Click when you will pay**; the late line and the waivers follow.
- **Stone Oak Pharmacy → Bill the owner** (the job at its end, under Building): the closeout
  waits on Cool Breeze. In the owner's portal press **Accept the work**; as Cool Breeze send the
  final pay application; then **Send the final pay application** and
  **Pay** it in the owner's portal. Their papers end with our waivers on final payment.
- **Money** (board tab): we go down to $39,272 carrying the week of Oct 12, when the steel and
  electrical draws come due. Tick the box to count Cibolo's late $288,879 and watch the weeks stay ahead.
- **The portal's home**: see it as Voltage Brothers (a number on old plans, then the insurance that
  ran out, both red), Brightline Electric (one job, one bid), Hill Country Interiors (Helotes:
  money paid and held). Tap the insurance line: the certificate form opens in place.
- **+ New project**: pick an owner, **Paste a made-up sheet index**, see 21 sheets and 13 trades,
  change a scope line, **Create the project**. It opens on Trades and sits under Bidding to the
  owner with its days left. On Electrical, Lighting reads from E-101; add E-201 to Devices, then
  the plans window under E-201 lists Devices. On **Who to ask**, Sitework ticks Lonestar and
  Tri-County and leaves Hillside, past its 50 miles; Create the project opens Trades with 15
  companies asked. Start again with **Paste a made-up table of contents** too: 25 sections, Glass
  and storefront joins from 08 41 13, and on Roofing, Roof membrane reads 07 54 23.
- **Plans → A new set of plans came in** on Boerne: type "C-101: a detention pond is added",
  press **+ Add a line this set brings** on Sitework, type Detention pond, issue. Compare bids on
  Sitework now says each quote "is not clear about detention pond".
- **The manual in a later set**: make a project with **Paste a made-up table of contents**, then on
  Plans type "Section 09 91 23: low-VOC paint throughout." and "Section 09 30 13 added for the
  restroom tile." Painting and Flooring tick, 09 30 13 asks for its title, the email lists both.
  Issue, open the plans, press **Specs**: 09 91 23 is stamped "Revised by Addendum 1", 09 30 13
  "Added by Addendum 1", and the Bid set shows 25 sections. Mark Pad B lost: its Plans tab says
  "We lost this bid. Nothing goes out."
- **A whole new set**: on that project pick **Permit set**, press **Paste a made-up new index** and
  **Paste a made-up new table of contents**: 2 new, 1 gone, 1 renamed; C-201 and 32 84 00 read
  "taken out". Under Lines left with nothing to read, tie Clearing and grading to C-101. Issue with
  no note. The plans window lists C-201 under Taken out, crossed out, and C-101 now carries
  Clearing and grading.

## Where it stands

2026-10-02: one session, the owner steering. He said "I think this has great potential" and has
been changing it screen by screen since. The last things built were the new-plans flow and Get
started. The prototype is a branch, not a PR: it should not merge as it is (fixture data inside
the client, one golden test and a few kernel tests). Since the evening of 2026-10-02 several
sessions build it at once (*Working in parallel*).
