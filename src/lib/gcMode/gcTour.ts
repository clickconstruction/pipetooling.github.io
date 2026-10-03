/**
 * GC mode — design spike: the "New here?" walkthrough's stops. It walks the Project Board's three
 * stages top to bottom, each stage's question first, then what you do in it and how it ends.
 *
 * The words follow the plain-words rules (`submittalTour.ts`): one idea per sentence, you + a
 * verb, the button's exact name, a trade word explained beside itself the first time, no dashes,
 * semicolons or parentheses inside a sentence.
 */
import type { SpotlightTourStep } from '../../components/SpotlightTour'

export const GC_TOUR_STEPS: SpotlightTourStep[] = [
  {
    anchor: 'gc-board',
    title: 'How a job moves',
    body: 'In GC mode we build the whole job. We hire a company for each trade. Every project moves through three stages, top to bottom. Each stage answers one question.',
  },
  {
    anchor: 'gc-stage-pursuing',
    title: 'Stage 1. Bidding to the owner',
    body: 'The question here is: can we win this job? The owner is picking a builder. We are one of the builders giving a price. Nothing is ours yet.',
  },
  {
    anchor: 'gc-new-project',
    title: 'Start a new project',
    body: 'A project starts the day its plans come in. Tap + New project. A window walks you through four steps: the project, the plans, the trades and each trade’s scope. Tap Create the project. It lands here, open on Trades, ready to ask companies for quotes.',
  },
  {
    anchor: 'gc-row-pursuing',
    title: 'What you do while bidding',
    body: 'You ask companies to quote each trade. Get at least two quotes for every trade. You compare them and pick one number to carry. Our price to the owner adds up those numbers. Then it adds our costs and our fee.',
    missingBody: 'No project is bidding right now. A new one starts here.',
  },
  {
    anchor: 'gc-row-pursuing',
    title: 'The ring and the days left',
    body: 'The ring fills as the bid comes together. Point at it to see what is done and what is left. The block beside it says how many days until our bid is due. It turns amber inside two weeks. It turns red inside one week.',
    missingBody: 'No project is bidding right now.',
  },
  {
    anchor: 'gc-row-pursuing',
    title: 'How bidding ends',
    body: 'Open the project and go to Our number. Tap We sent our bid when the price goes to the owner. When the owner picks us, tap We won this. The project moves down to Buying out.',
    missingBody: 'No project is bidding right now.',
  },
  {
    anchor: 'gc-stage-buyout',
    title: 'Stage 2. Buying out',
    body: 'The question here is: who does each trade, and is it all signed? We won the job. Buying out means turning our price into signed contracts. We priced with several quotes. Now we pick one company per trade.',
  },
  {
    anchor: 'gc-row-buyout',
    title: 'What you do in buyout',
    body: 'You award each trade to one company. Each company signs our master agreement once. It covers every job they do with us. Then they sign a statement of work. That is the scope and the price for this job. You also need their insurance and a W-9.',
    missingBody: 'No project is in buyout right now. A project lands here when you tap We won this.',
  },
  {
    anchor: 'gc-row-buyout',
    title: 'How buyout ends',
    body: 'Open the project and go to Get started. It lists every step left before work starts. You need the owner contract, the permit and a start date. The ring on the row fills as these steps get done. Start stays locked until nothing is missing. Tap Start and every trade hears that work has begun.',
    missingBody: 'No project is in buyout right now.',
  },
  {
    anchor: 'gc-stage-building',
    title: 'Stage 3. Building',
    body: 'The question here is: is the work done, and who gets paid? The crews are on site. Each trade reports how much of its work is done. The ring shows how much of the whole job is done. Now we talk only to the company on each trade.',
  },
  {
    anchor: 'gc-stage-building',
    title: 'What you do while building',
    body: 'A trade asks for a draw in its portal. A draw is a payment for the work done so far. It comes with a lien waiver. That paper says they will not put a lien on the property for that money. You approve the draw and pay it. We hold back 10 percent until the end. That is called retainage.',
  },
  {
    anchor: 'gc-new-here',
    title: 'Try it',
    body: 'Open Boerne Retail Shell and start on Trades. Tap See what the trade sees to watch the trade partner’s side. Tap Start over at any time to put the made-up projects back. Tap New here? to see this again.',
  },
]
