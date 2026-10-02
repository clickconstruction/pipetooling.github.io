---
name: "GC mode: Bids, mirrored. We are the general contractor and the trades bid to us"
number: 81
group: gated
status: explored 2026-10-02 as a design spike · a playable prototype on made-up data lives on branch `spike/gc-mode` (page `/bids/gc`, dev only) · nothing is on main, nothing touches the database · the owner is still shaping it screen by screen
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

Everything runs on one fixture through one reducer in
[`src/lib/gcMode/gcModel.ts`](../../src/lib/gcMode/gcModel.ts). No table, RPC, edge function or
email is involved. The office is on the left; **See what the trade sees** shows one trade
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
| The ring on each row | How far the project is through its stage (`stageProgress` in the model; `GcProgressRing`). Hover it, tap it on a phone, or tab to it: a card lists what the ring counts by type, what is left in each spelled out, what is done in one line, and an *Also* list it does not count. Bidding: enough quotes (2 per hired trade), a number to carry, quotes on the newest plans, our bid sent. Buyout: the Get started checklist by kind of step (the owner side, awarded, master agreement, insurance, W-9, statement of work). Building: work reported per trade, weighted by its statement of work; draws and waivers waiting under *Also*. |
| **Project Board** | Projects in three sections: Bidding to the owner, Buying out, Building. Each row leads with the days left before our bid (red inside a week, amber inside two), then the name, the owner and architect (each a link), chips, the Bid Board's folder and plans icons, and the price. |
| Plans icon on a row | A plans window over the board: newest set first, the sheet list by discipline, what the last addendum changed, arrow keys flip sheets. Drawings are stand-ins. |
| Owner or architect name | One company window, shaped by what the company is to us: an owner gets money, how they buy and pay, projects we build for them; an architect gets addenda and questions waiting on them. One call log either way. |
| **Trades** tab | One row per trade: who we asked with each bid in thousands, our budget, the lowest all in, what we carry. **Compare bids** opens the comparison. **On a map** opens the map. |
| Compare bids | Sentences first ("Voltage Brothers bid $166,000 and left out fire alarm. Covering that adds $14,000, so they come to $180,000."), then the table behind them: is each piece of work in their price, a cost to cover what is not, the all-in total, who is lowest. |
| On a map | The project in the middle, every company in the trade as a numbered pin (closest first), the same companies in a list beside it to work down. "Will not do it" / "Cannot do it" moves you to the next closest. |
| **Plans** tab | **A new set of plans came in**: paste what changed, sheets are read out of the notes, trades guessed from the sheet letters, the list of who is emailed, the email preview. Then a table: told, opened, their number (needs confirming or good). |
| **Our number** | Carried trades + general conditions + contingency + fee = the price to the owner. **We sent our bid**, **We won this**. |
| **Bid tabs** | After our bid is in, each trade's quotes go back to the companies that quoted, low to high, their own row marked, names hidden unless ticked. |
| **Contracts** | Per trade: paperwork chips, award, the statement of work drafted from the bid, send, sign. |
| **Get started** | The checklist before work starts: owner contract, permit, start date, and five steps per trade. Start stays shut until nothing is missing. |
| **Draws** | Percent reported per line, a draw asked from the portal with a conditional waiver, approve, pay, unconditional waiver. |
| **Follow up** (board tab) | Everyone we are waiting on across every project, the ones to call first. Log a contact; record the day they promised a quote; a passed day returns them to the top. |
| **Trade partners** (board tab) | By trade: the bench, who answers when asked, every project short of quotes, coverage (where they drive from, how far they go), one press to ask the companies not yet asked. **Actions for assistants** on top: each standard as the ideal, where we are, and what closes the gap. |
| The trade's portal | Paperwork, the newest plans, the invitation and the bid form, "tell Click when your number will come", confirm a number after an addendum, the bid tab, sign the master agreement and statement of work, report work, ask for a draw. |

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

## My defaults the owner has not confirmed

Each is a constant or a rule in `gcModel.ts`. Change them freely.

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

## Workflow steps not built yet

- Starting a project: New Project, with the plans coming in (the prototype's projects are pre-made).
- Splitting the plans into trades and writing each scope (the trades are pre-made).
- A trade asks a question about the plans, the architect answers, every bidder on the trade
  gets the answer. Three made-up questions show in the architect's window, read-only.
- Change orders, both to the owner and to a trade (a statement of work amendment).
- Closeout: retainage release, final waivers.
- Our billing to the owner. The owner's window shows billed and paid from the fixture only.
- No email is sent and nothing notifies anyone when a promised day passes.

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
| Waivers on a draw | The lien waiver train (v2.4274 to v2.4335), pointed the other way. |
| The map | The Bid Board's map and the app's geocoded addresses. The prototype draws its own from a short list of towns. |
| "See what the trade sees" | Punch list #62, the same idea for the GC's room. |
| Email | Resend through the existing edge functions. |

## The code on the branch

`src/pages/GcMode.tsx` (the shell, the board, the row and the days-left block) and
`src/components/gc/`:

| File | Holds |
|---|---|
| `src/lib/gcMode/gcModel.ts` | Types, the reducer, every selector, the fixture. The types are drawn the way the tables would be: read it as the first schema sketch. |
| `GcOfficeTabs.tsx` | Trades (with Compare bids), Plans, Our number, Contracts, Draws, the flat company list |
| `GcTradePortal.tsx` | The trade partner's side |
| `GcTradeBench.tsx` | Trade partners by trade, Actions for assistants |
| `GcTradeMap.tsx` | The map window |
| `GcAskThread.tsx` | The contact log, promises, the Follow up tab |
| `GcNewPlans.tsx` | The new-set-of-plans window |
| `GcStart.tsx` | Get started |
| `GcBidTabs.tsx` | Bid tabs |
| `GcCustomerWindow.tsx` | The one company window |
| `GcPlansQuickLook.tsx` | The plans window |
| `BidsModeToggle.tsx`, `gcUi.tsx`, `gcIcons.ts` | The switch, shared pieces, two copied Bid Board icons |

Two existing files are touched: `src/App.tsx` (the `bids/gc` route) and `src/pages/Bids.tsx`
(the switch, for a dev only).

State of the branch: `npm run typecheck` and the theme check pass. Lint has four fast-refresh
warnings in `gcUi.tsx` (it exports style objects beside components). There are no tests. The
kernel is pure and testable; the UI was checked by hand in the browser after every change.

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
  portal as Alamo Concrete press **My number stands on the new plans**.
- **Our number → We sent our bid**, then **Bid tabs** opens. **We won this** moves it to Buying out.
- **Helotes Dental Office → Get started**: from 14 of 24 steps to Start, signing as each
  company through **Sign it as them**. A new plan set after Start goes to four companies only.
- **Follow up**: log a call with a new day on Hillside Excavation and watch the card move down.

## Where it stands

2026-10-02: one session, the owner steering. He said "I think this has great potential" and has
been changing it screen by screen since. The last things built were the new-plans flow and Get
started. The prototype is a branch, not a PR: it should not merge as it is (fixture data inside
the client, no tests, one 2,400-line model file).
