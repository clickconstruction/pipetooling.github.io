/**
 * GC mode — design spike: the "New here?" walkthrough's stops. It walks the Project Board's three
 * stages top to bottom, each stage's question first, then what you do in it and how it ends.
 *
 * The words follow the plain-words rules (`submittalTour.ts`): one idea per sentence, you + a
 * verb, the button's exact name, a trade word explained beside itself the first time, no dashes,
 * semicolons or parentheses inside a sentence.
 */
import type { SpotlightTourStep } from '../../components/SpotlightTour'
import type { GcStage } from './gcTypes'

/** The project tabs the walk opens on the way (the tour's round five): the page's own tab keys. */
export type GcTourTab = 'schedule' | 'log'

/**
 * A stop of *Walk me through this job* (the tour's round five, `to-dos/gc-mode/mockups/tour-round-five.md`).
 * `tab`: the project tab its anchor is on, which the walk opens just before the stop shows.
 * `stages`: the job stages it belongs to, so each job walks only what it can show. Unset: every tab,
 * or every stage. A new stop is three sentences: what this is, what you do, what happens after.
 */
export type GcTourStep = SpotlightTourStep & { tab?: GcTourTab; stages?: GcStage[] }

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
    // The owner, 2026-10-04: one count of the people we are waiting on, in place of the row's chips.
    anchor: 'gc-people-pursuing',
    title: 'Who to call',
    body: 'This says how many people we are waiting on. Point at it to see who and why. Each person has Call and Follow up. When nobody owes us anything, it says Nobody to chase.',
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
    // The tour's round five: the door to every project's own walk, which lives only inside a project.
    anchor: 'gc-row-building',
    title: 'A walk through one job',
    body: 'Inside a project, Walk me through this job shows each tab and card. Open any project and tap Walk me through this job above its tabs. It opens each tab for you, in the order a job goes.',
    missingBody: 'Open any project. Walk me through this job is above its tabs.',
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
 *
 * Round five adds a stop at each door a first-timer would miss inside a tab. Those stops name
 * their tab, which the walk opens on the way, and their stages; `projectTourSteps` gives a job the
 * stops for its stage.
 */
export const GC_PROJECT_TOUR_STEPS: GcTourStep[] = [
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
    anchor: 'gc-ptab-rfis',
    title: 'RFIs',
    body: 'A question about the plans while we build. A trade asks from its portal, or we write one. We send it to the architect. The answer is needed three days before the work it holds. A cost answer starts a change order in one tap.',
  },
  {
    anchor: 'gc-ptab-schedule',
    title: 'Schedule',
    body: 'The dates for each trade and what waits on what. Start locks it as the plan we measure against.',
  },
  {
    anchor: 'gc-rough',
    title: 'A rough schedule while we bid',
    body: 'A job still bidding gets a rough schedule, drawn from the job’s stages. Tap Draw a rough schedule to count the weeks it takes to build. Our number then shows those weeks beside our price.',
    missingBody: 'It is on the Schedule tab of a job still bidding.',
    tab: 'schedule',
    stages: ['pursuing'],
  },
  {
    anchor: 'gc-gantt-toolbar',
    title: 'The chart',
    body: 'Each bar is one piece of a trade’s work. Zoom with Days, Weeks or Months. Group it by trade, by stage or by company. The pills count what is late, held or tight, and filter the chart. Pick one company to see only their work. Drag a bar to move it. Every move asks why.',
    missingBody: 'Open the Schedule tab on a job with a schedule drawn and the chart is here.',
    tab: 'schedule',
    stages: ['buyout', 'building'],
  },
  {
    // G-77 and G-138: the first held bar drawn, with both kinds marked on the chart.
    anchor: 'gc-held-bar',
    title: 'Bars held up, and bars not covered',
    body: 'A note beside a bar says what holds it up, or that its company has no insurance. Tap the bar to see the paper it needs and how to ask for it. The note goes once that paper comes in.',
    missingBody: 'Nothing on this job is held or uncovered today. A held bar is striped, and an uncovered one has a red note.',
    marks: [
      { anchor: 'gc-held-bar', label: 'Held' },
      { anchor: 'gc-uninsured-bar', label: 'No insurance' },
    ],
    tab: 'schedule',
    stages: ['buyout', 'building'],
  },
  {
    // G-115: the call list is built for a job being built only.
    anchor: 'gc-gantt-group',
    title: 'A call list from the chart',
    body: 'By company turns the chart into a call list. Tap By company to list everyone whose answer moves the chart. Each one has Call and Follow up beside it.',
    missingBody: 'It is on the chart’s toolbar, on the Schedule tab.',
    tab: 'schedule',
    stages: ['building'],
  },
  {
    // G-08 and G-84.
    anchor: 'gc-gantt-shows',
    title: 'Spare days and people on site',
    body: 'Two buttons add a layer to the chart. Tap Show spare days or Show people on site. The chart then shows each bar’s spare days, or each week’s people beside the daily log’s count.',
    missingBody: 'It is on the chart’s toolbar, on the Schedule tab.',
    tab: 'schedule',
    stages: ['buyout', 'building'],
  },
  {
    // G-21 and G-136.
    anchor: 'gc-gantt-files',
    title: 'Print it or send the file',
    body: 'The chart can go out on paper or as a file. Tap Print or PDF for landscape pages, or Export for a spreadsheet and the Microsoft Project file. Each one asks if the copy is for our team or the customer.',
    missingBody: 'It is on the chart’s toolbar, on the Schedule tab.',
    tab: 'schedule',
    stages: ['buyout', 'building'],
  },
  {
    // G-81.
    anchor: 'gc-what-if',
    title: 'Try moves on a copy',
    body: 'What if… makes a copy of the schedule to try moves on. Tap What if…, try your moves, then tap Keep or Throw it away. Keep puts each move on the real schedule with its reason.',
    missingBody: 'It is on the chart’s toolbar, on the Schedule tab.',
    tab: 'schedule',
    stages: ['buyout', 'building'],
  },
  {
    anchor: 'gc-walk-line',
    title: 'Update the week',
    body: 'A chart is only true on the day someone checked it. This line says when the schedule was last walked. Tap Update the week to go through every bar that should have moved, one at a time.',
    missingBody: 'It sits over the chart on a job being built.',
    tab: 'schedule',
    stages: ['building'],
  },
  {
    anchor: 'gc-tell-trades',
    title: 'Tell the trades',
    body: 'Every move is kept under the chart with who made it and why. When dates moved, tap Tell the trades. Each company gets one email with its old and new days. It answers from its portal.',
    missingBody: 'It shows under the chart once a move changed a company’s days.',
    tab: 'schedule',
    stages: ['building'],
  },
  {
    // G-83.
    anchor: 'gc-places',
    title: 'Where the work is',
    body: 'Each bar can have a place, like Roof or Inside. Tap Look at the places to keep the guesses or change them. The chart then flags a day with three trades or more in one place.',
    missingBody: 'It is on the Schedule tab of a job being built.',
    tab: 'schedule',
    stages: ['building'],
  },
  {
    // G-82 and G-141: only a job past its contract shows them, so the made-up job today says where.
    anchor: 'gc-days-back',
    title: 'A job running late',
    body: 'On a late job, Days back lists work that could run side by side or take a second crew. Tap Look at it to see that move before anything is saved. If the customer’s moves made it late, Ask for the days drafts a time extension for them.',
    missingBody: 'This job is on time, so neither shows today. They appear under Projected finish when the finish runs past the contract.',
    marks: [{ anchor: 'gc-ask-for-days', label: 'Ask for the days' }],
    tab: 'schedule',
    stages: ['building'],
  },
  {
    // G-145.
    anchor: 'gc-their-dates',
    title: 'Their dates to meet',
    body: 'The Milestones card holds the dates the job must meet. When the customer sends new dates, tap Bring in their dates… on this card. Only the dates you tick change, never a bar.',
    missingBody: 'It is on the Milestones card of a job being built.',
    tab: 'schedule',
    stages: ['building'],
  },
  {
    // G-44.
    anchor: 'gc-templates',
    title: 'Save the job as a template',
    body: 'A template keeps this job’s shape for the next job like it. Type a name and tap Save as a template. A new job can start from it, with each line’s days and waits but no dates.',
    missingBody: 'It is on the Schedule tab of a job being built.',
    tab: 'schedule',
    stages: ['building'],
  },
  {
    anchor: 'gc-ptab-log',
    title: 'Daily log',
    body: 'The superintendent writes one log each work day. It says the weather, which trades were on site and how many workers. It also says what got done and what held work up. A day with no log shows on the ring.',
  },
  {
    // G-118, with G-138's word at the gate.
    anchor: 'gc-morning-list',
    title: 'Who should be on site',
    body: 'Above the log, Who should be on site lists each company with work running today. Tap a day at its top to see another day. A company with no insurance says so there, before its crew starts.',
    missingBody: 'It is on the Daily log tab of a job being built.',
    tab: 'log',
    stages: ['building'],
  },
  {
    // G-60: only a week where the log and the chart disagree shows it, so the made-up job today says where.
    anchor: 'gc-log-vs-chart',
    title: 'The log against the chart',
    body: 'When the daily log and the chart disagree, a card says so with what to do. If a crew began before its bar, tap It started to record the day. The bar then shows the day it really started.',
    missingBody: 'They match this week, so no card shows. It shows here and under the chart when they do not.',
    tab: 'log',
    stages: ['building'],
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
  {
    // G-117 and G-142: both sit on the job's page in the portal, one press past Your jobs, so the stop lights that door.
    anchor: 'gc-portal-jobs',
    title: 'The trade’s own dates',
    body: 'In its portal, a trade opens a job to see its own schedule. It taps We will be late on a bar, or fills in People a day on site. The office sees both on the Schedule tab and in the morning list.',
    missingBody: 'Tap See what the trade sees. Pick a company and open its job.',
    stages: ['building'],
  },
]

/** The walk for a job at this stage: every stop that belongs to it, in order (the tour's round five). */
export function projectTourSteps(stage: GcStage): GcTourStep[] {
  return GC_PROJECT_TOUR_STEPS.filter((s) => !s.stages || s.stages.includes(stage))
}
