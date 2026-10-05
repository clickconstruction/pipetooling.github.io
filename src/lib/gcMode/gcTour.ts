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
    body: 'In GC mode we build the whole job. We hire a company for each trade. Every project moves through three stages, top to bottom:',
    // The owner, 2026-10-04: the three stages as a list, numbered, each stage's name in bold, and the
    // same three titles on the board highlighted with 1, 2 and 3.
    numbered: true,
    marks: [
      { anchor: 'gc-stage-title-pursuing', label: '1' },
      { anchor: 'gc-stage-title-buyout', label: '2' },
      { anchor: 'gc-stage-title-building', label: '3' },
    ],
    bullets: [
      'Bidding to the customer: we price the job and try to win it.',
      'Buying out: we pick one company per trade and get it all signed.',
      'Building: the crews work, and we pay them as the work gets done.',
    ],
  },
  {
    anchor: 'gc-stage-pursuing',
    title: 'Stage 1. Bidding to the customer',
    body: 'The question here is: can we win this job? The customer is picking a builder. We are one of the builders giving a price. Nothing is ours yet.',
  },
  {
    anchor: 'gc-new-project',
    title: 'Start a new project',
    body: 'A project starts the day its plans come in. Tap + New project. A window walks you through five steps: the project, the plans, the trades, each trade’s scope and who to ask. Tap Create the project. It lands here, open on Trades. The companies you ticked are asked to quote.',
  },
  {
    anchor: 'gc-row-pursuing',
    title: 'What you do while bidding',
    body: 'You ask companies to quote each trade. Get at least two quotes for every trade. You compare them and pick one number to carry. Our price to the customer adds up those numbers. Then it adds our costs and our fee.',
    missingBody: 'No project is bidding right now. A new one starts here.',
  },
  {
    // The owner, 2026-10-04: light the ring itself, then the block, each on its own stop.
    anchor: 'gc-ring-pursuing',
    title: 'The ring',
    body: 'The ring fills as the bid comes together. It counts the steps done out of all the steps. Point at it to see what is done and what is left.',
    missingBody: 'No project is bidding right now.',
  },
  {
    anchor: 'gc-due-pursuing',
    title: 'The days left',
    body: 'This block says how many days until our bid is due. It turns amber inside two weeks. It turns red inside one week.',
    missingBody: 'No project is bidding right now.',
  },
  {
    anchor: 'gc-row-pursuing',
    title: 'How bidding ends',
    body: 'Open the project and go to Our number. Tap We sent our bid when the price goes to the customer. When the customer picks us, tap We won this. The project moves down to Buying out. If the customer picks someone else, tap We lost this.',
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
    body: 'Open the project and go to Get started. It lists every step left before work starts. You need the contract with the customer, the permit, a start date and the schedule drawn. The ring on the row fills as these steps get done. The block beside it counts the days to the planned start. Start stays locked until nothing is missing. Tap Start and every trade hears that work has begun.',
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
    anchor: 'gc-stage-closed',
    title: 'Closed',
    body: 'A finished job moves down here. Close it on its Closeout tab with Close the job. That button comes once every trade is closed out and the customer paid our last bill. Closed jobs stay here for the record.',
  },
  {
    anchor: 'gc-stage-lost',
    title: 'Lost',
    body: 'A bid we did not win moves down here. Each one says why we lost it and who won, if we know. Nobody is chased on it anymore. Tap Bring it back on Our number if the customer comes back to us.',
  },
  {
    anchor: 'gc-group-switch',
    title: 'By stage or by customer',
    body: 'The board opens by stage. Tap By customer to group the jobs by who they are for. Each customer shows what we are bidding them and what they owe us. Tap By stage to go back.',
  },
  {
    anchor: 'gc-tab-partners',
    title: 'Trade partners and the scope book',
    body: 'Trade partners lists every company we use, by trade. Press a company’s name to open its window. Press a paperwork chip to see that paper. It also holds the scope book. The book keeps the scope lines we use for each trade. On step 4 of a new project, you pull lines from it. It warns you about lines we missed on past jobs.',
  },
  {
    anchor: 'gc-new-here',
    title: 'Try it',
    body: 'Open Boerne Retail Shell and start on Trades. Tap See what the trade sees to watch the trade partner’s side. Tap Start over at any time to put the made-up projects back. Tap New here? to see this again.',
  },
]

/**
 * The walkthrough inside one project (the big list, Board item 8): a stop on each tab, in the
 * order a job goes, from asking the trades to closing out. The anchors are the tab buttons
 * (`gc-ptab-<key>`), so every stop is on the page whichever tab is open.
 */
export const GC_PROJECT_TOUR_STEPS: SpotlightTourStep[] = [
  {
    anchor: 'gc-project-header',
    title: 'One project',
    body: 'This is one job, from the first quote to the last payment. The tabs below follow it in order.',
  },
  {
    anchor: 'gc-ptab-packages',
    title: 'Trades',
    body: 'One row for each trade. Ask companies to quote. Tap Compare quotes to see them side by side. Then carry one number.',
  },
  {
    anchor: 'gc-ptab-plans',
    title: 'Plans',
    body: 'Every set of plans and who got it. When the architect sends a new set, tap A new set of plans came in.',
  },
  {
    anchor: 'gc-ptab-number',
    title: 'Our number',
    body: 'The trades we carry, plus our costs and our fee, make our price. Tap We sent our bid. Then tap We won this or We lost this.',
  },
  {
    anchor: 'gc-ptab-tabs',
    title: 'Bid tabs',
    body: 'Once our bid is in, each company that quoted sees where its quote stood. It is the thanks for quoting.',
  },
  {
    anchor: 'gc-ptab-contracts',
    title: 'Contracts',
    body: 'After we win, award each trade to one company. Send the master agreement and the statement of work to sign.',
  },
  {
    anchor: 'gc-ptab-start',
    title: 'Get started',
    body: 'Everything that must be done before work starts. Start waits until nothing is missing. If the job cannot wait, tap Start anyway and say why. What is missing stays here as owed.',
  },
  {
    anchor: 'gc-ptab-submittals',
    title: 'Submittals',
    body: 'Each trade sends what it will put in: product data, shop drawings or samples. We look and send them to the architect. The architect approves them or sends them back. A trade cannot start that work until it is approved.',
  },
  {
    anchor: 'gc-ptab-schedule',
    title: 'Schedule',
    body: 'The dates for each trade and what waits on what. Start locks it as the plan we measure against.',
  },
  {
    anchor: 'gc-ptab-log',
    title: 'Daily log',
    body: 'The superintendent writes one log each work day. It says the weather, which trades were on site and how many workers. It also says what got done and what held work up. A day with no log shows on the ring.',
  },
  {
    anchor: 'gc-ptab-draws',
    title: 'Draws',
    body: 'Trades report their work and ask to be paid. You approve and pay. We hold back retainage until the end.',
  },
  {
    anchor: 'gc-ptab-owner',
    title: 'Bill the customer',
    body: 'Our own pay applications to the customer. The architect certifies each one. Then the customer pays it.',
  },
  {
    anchor: 'gc-ptab-closeout',
    title: 'Closeout',
    body: 'The last papers and the last payments. When everything is in, tap Close the job.',
  },
  {
    anchor: 'gc-see-trade',
    title: 'What the trade sees',
    body: 'Tap here to watch a trade partner’s portal beside the office. A press on either side shows on the other.',
  },
]
