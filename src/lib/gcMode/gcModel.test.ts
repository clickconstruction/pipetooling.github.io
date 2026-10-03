/**
 * GC mode — design spike: the golden test. It plays a scripted walk through the prototype (the
 * "How to verify" walk in to-dos/gc-mode/README.md, stretched so every action type runs at least
 * once) and pins what the main calculations say after every step, then the whole state at the end.
 *
 * It exists so the model can be split and built on by several sessions at once: a refactor must
 * pass it without `-u`. A changed snapshot means behavior changed; that needs the owner's OK
 * ("Working in parallel" in the README).
 *
 * The readings are pinned in full before the first step. Each step then pins only what it moved:
 * every value (down to each number and word) that differs from the step before, by its path, and
 * every path that went away. Equal at every step means equal everywhere, at a fraction of the size.
 * Inside the readings, a project, trade, invite, company or customer that a calculation points at
 * is written as its id (`«partner lonestar»`); the full records are pinned once, at the end.
 */
import { describe, expect, it } from 'vitest'
import {
  architectSummary,
  assistantRules,
  bidTabRows,
  compareBids,
  customerSummary,
  followUps,
  gcReducer,
  initialGcState,
  planRecipients,
  proposalTotals,
  stageProgress,
  startChecklist,
  tradeBenches,
  tradeLineup,
  type GcAction,
  type GcState,
} from './gcModel'

type Step = { label: string; action: GcAction }

/** What Cedar & Pine types on its pay applications in the walk. */
const CEDAR_TYPED = { periodTo: '2026-10-02', address: '77 Main St, Fredericksburg, TX 78624', license: '', signedBy: 'Owen Blake', signedTitle: 'Owner' }

const STEPS: Step[] = [
  // Boerne Retail Shell, bidding: compare, chase, quote, carry.
  { label: 'Concrete: a cost to cover Alamo’s unclear rebar', action: { type: 'setPlug', projectId: 'boerne', packageId: 'conc', inviteId: 'conc-alamo', scopeId: 'conc-4', amount: 8_000 } },
  { label: 'Structural steel: Bexar cannot do it', action: { type: 'officeDecline', projectId: 'boerne', packageId: 'steel', inviteId: 'steel-bexar', why: 'cant' } },
  { label: 'Structural steel: ask Iron Horse', action: { type: 'invite', projectId: 'boerne', packageId: 'steel', partnerId: 'ironhorse' } },
  { label: 'Structural steel: nudge Iron Horse', action: { type: 'nudge', projectId: 'boerne', packageId: 'steel', inviteId: 'steel-ironhorse', about: 'Your steel quote for Boerne Retail Shell' } },
  { label: 'Sitework: Hillside promises a day on a call', action: { type: 'logContact', projectId: 'boerne', packageId: 'site', inviteId: 'site-hillside', how: 'call', note: 'Said they are finishing it.', promisedBy: '2026-10-05' } },
  { label: 'Sitework: a text with no promise', action: { type: 'logContact', projectId: 'boerne', packageId: 'site', inviteId: 'site-hillside', how: 'text', note: 'Sent the paving detail.', promisedBy: null } },
  { label: 'Roofing: Bluebonnet promises in the portal', action: { type: 'tradePromise', projectId: 'boerne', packageId: 'roof', inviteId: 'roof-bluebonnet', promisedBy: '2026-10-06' } },
  { label: 'Structural steel: Iron Horse opens the plans', action: { type: 'tradeOpenPlans', projectId: 'boerne', packageId: 'steel', inviteId: 'steel-ironhorse' } },
  { label: 'Structural steel: Iron Horse bids', action: { type: 'tradeSubmitBid', projectId: 'boerne', packageId: 'steel', inviteId: 'steel-ironhorse', amount: 158_000, includes: { 'steel-1': 'yes', 'steel-2': 'yes', 'steel-3': 'unclear' }, note: 'Erection by a sub of ours.' } },
  { label: 'Structural steel: Iron Horse revises', action: { type: 'tradeSubmitBid', projectId: 'boerne', packageId: 'steel', inviteId: 'steel-ironhorse', amount: 156_000, includes: { 'steel-1': 'yes', 'steel-2': 'yes', 'steel-3': 'yes' }, note: 'Erection included.' } },
  { label: 'Electrical: Tejas passes', action: { type: 'tradeDecline', projectId: 'boerne', packageId: 'elec', inviteId: 'elec-tejas' } },
  { label: 'Electrical: carry Voltage Brothers', action: { type: 'carry', projectId: 'boerne', packageId: 'elec', carried: 'elec-voltage' } },
  { label: 'Structural steel: carry our guess', action: { type: 'carry', projectId: 'boerne', packageId: 'steel', carried: 'plug' } },
  { label: 'Structural steel: carry Iron Horse', action: { type: 'carry', projectId: 'boerne', packageId: 'steel', carried: 'steel-ironhorse' } },
  { label: 'Fire sprinkler: carry our guess', action: { type: 'carry', projectId: 'boerne', packageId: 'fire', carried: 'plug' } },
  { label: 'Fire sprinkler: stop carrying', action: { type: 'carry', projectId: 'boerne', packageId: 'fire', carried: null } },
  { label: 'A new set of plans: three sheets', action: { type: 'issueAddendum', projectId: 'boerne', note: 'Revised service size, a new column line, a wider drive.', sheets: ['E-201', 'S-101', 'C-101'], touches: ['elec', 'steel', 'site'] } },
  { label: 'Concrete: Alamo’s number stands on the new plans', action: { type: 'tradeConfirmBid', projectId: 'boerne', packageId: 'conc', inviteId: 'conc-alamo' } },
  { label: 'Our number: fee to 8%', action: { type: 'setMarkup', projectId: 'boerne', field: 'feePct', value: 8 } },
  { label: 'Our number: general conditions to $60,000', action: { type: 'setMarkup', projectId: 'boerne', field: 'generalConditions', value: 60_000 } },
  { label: 'We sent our bid', action: { type: 'markBidSent', projectId: 'boerne' } },
  { label: 'Sitework bid tab, names hidden', action: { type: 'shareBidTab', projectId: 'boerne', packageId: 'site', showNames: false } },
  { label: 'Sitework bid tab, names shown', action: { type: 'shareBidTab', projectId: 'boerne', packageId: 'site', showNames: true } },
  { label: 'Lonestar opens the bid tab', action: { type: 'tradeSeeBidTab', projectId: 'boerne', packageId: 'site', partnerId: 'lonestar' } },
  { label: 'We won Boerne Retail Shell', action: { type: 'markWon', projectId: 'boerne' } },
  { label: 'Award Sitework to Lonestar', action: { type: 'award', projectId: 'boerne', packageId: 'site', inviteId: 'site-lonestar' } },
  // The trade partners.
  { label: 'Send Hillside the master agreement', action: { type: 'sendMsa', partnerId: 'hillside' } },
  { label: 'Hillside signs it', action: { type: 'tradeSignMsa', partnerId: 'hillside' } },
  { label: 'Hillside’s coverage', action: { type: 'setCoverage', partnerId: 'hillside', base: 'Boerne', maxMiles: 60 } },
  { label: 'Tejas’s coverage cleared', action: { type: 'setCoverage', partnerId: 'tejas', base: null, maxMiles: null } },
  { label: 'Add a steel company', action: { type: 'addPartner', company: 'Pecos Steel', contact: 'Ana Ruiz', trade: 'Structural steel', base: 'San Antonio', maxMiles: 80 } },
  // Helotes Dental Office, buyout: Get started, then Start.
  { label: 'Kendall signs the master agreement', action: { type: 'tradeSignMsa', partnerId: 'kendall' } },
  { label: 'Send the HVAC statement of work', action: { type: 'sendSow', projectId: 'helotes', packageId: 'dhvac' } },
  { label: 'Kendall signs it', action: { type: 'tradeSignSow', projectId: 'helotes', packageId: 'dhvac' } },
  { label: 'Brightline signs the Electrical statement of work', action: { type: 'tradeSignSow', projectId: 'helotes', packageId: 'delec' } },
  { label: 'Award Millwork to Cedar & Pine', action: { type: 'award', projectId: 'helotes', packageId: 'mill', inviteId: 'mill-cedar' } },
  { label: 'Send Cedar & Pine the master agreement', action: { type: 'sendMsa', partnerId: 'cedar' } },
  { label: 'Cedar & Pine signs it', action: { type: 'tradeSignMsa', partnerId: 'cedar' } },
  { label: 'Send the Millwork statement of work', action: { type: 'sendSow', projectId: 'helotes', packageId: 'mill' } },
  { label: 'Cedar & Pine signs it', action: { type: 'tradeSignSow', projectId: 'helotes', packageId: 'mill' } },
  { label: 'Owner contract signed', action: { type: 'setStartItem', projectId: 'helotes', item: 'ownerContract', done: true } },
  { label: 'Permit in hand', action: { type: 'setStartItem', projectId: 'helotes', item: 'permit', done: true } },
  { label: 'Permit taken back', action: { type: 'setStartItem', projectId: 'helotes', item: 'permit', done: false } },
  { label: 'Permit in hand again', action: { type: 'setStartItem', projectId: 'helotes', item: 'permit', done: true } },
  { label: 'Start date', action: { type: 'setStartDate', projectId: 'helotes', date: '2026-10-12' } },
  { label: 'Start', action: { type: 'startProject', projectId: 'helotes' } },
  // Helotes, building: report, draw, pay, waive.
  { label: 'Hill Country reports hang and tape done', action: { type: 'tradeReport', projectId: 'helotes', packageId: 'dry', sovId: 'dry-2', pct: 100 } },
  { label: 'Hill Country reports ceilings half done', action: { type: 'tradeReport', projectId: 'helotes', packageId: 'dry', sovId: 'dry-3', pct: 50 } },
  { label: 'Hill Country asks for draw 2', action: { type: 'tradeRequestDraw', projectId: 'helotes', packageId: 'dry' } },
  { label: 'Approve draw 2', action: { type: 'approveDraw', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-2' } },
  { label: 'Pay draw 2', action: { type: 'payDraw', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-2' } },
  { label: 'Hill Country signs the unconditional waiver', action: { type: 'tradeSignUnconditional', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-2' } },
  { label: 'A new set of plans after Start', action: { type: 'issueAddendum', projectId: 'helotes', note: 'A soffit added over reception.', sheets: ['A-201'], touches: ['dry'] } },
  // The owner, and the third project.
  { label: 'A call with Cibolo Creek Partners', action: { type: 'logCustomerContact', customerId: 'cibolo', note: 'Asked when the pad building bids are due.' } },
  { label: 'Pad B: ask Lonestar for Sitework', action: { type: 'invite', projectId: 'padb', packageId: 'bsite', partnerId: 'lonestar' } },
  { label: 'Pad B: ask Alamo for Concrete', action: { type: 'invite', projectId: 'padb', packageId: 'bconc', partnerId: 'alamo' } },
  // New Project: a project starts with its plans, split into trades, each with its scope.
  {
    label: 'A new project: Leon Springs Urgent Care',
    action: {
      type: 'createProject',
      draft: {
        name: 'Leon Springs Urgent Care',
        address: '24165 IH-10 W, San Antonio',
        town: 'San Antonio',
        customerId: null,
        ownerName: 'Leon Springs Health',
        architectId: 'marshvale',
        architectName: 'Marsh & Vale Architects',
        bidDue: '2026-10-16',
        sizeNote: '6,800 sq ft clinic, one story',
        setLabel: 'Bid set',
        issuedOn: '2026-10-02',
        setNote: '',
        sheets: [
          { id: 'C-101', title: 'Site plan' },
          { id: 'A-101', title: 'Floor plan' },
          { id: 'A-501', title: 'Roof plan and details' },
          { id: 'P-101', title: 'Plumbing plan' },
          { id: 'E-101', title: 'Lighting plan' },
        ],
        trades: [
          { trade: 'Sitework', budget: 90_000, ours: false, scope: ['Clearing and grading', 'Paving', 'Detention pond'] },
          { trade: 'Roofing', budget: 0, ours: false, scope: ['Roof membrane', 'Sheet metal and flashing'] },
          { trade: 'Plumbing', budget: 72_000, ours: true, scope: ['Underground', 'Rough in', 'Top out', 'Trim'] },
          { trade: 'Electrical', budget: 0, ours: false, scope: ['Service and gear', 'Lighting', 'Devices'] },
        ],
      },
    },
  },
  // Helotes, building: a draw asked for with its G702/G703.
  {
    label: 'Hill Country sends pay application 3 (ceilings done)',
    action: {
      type: 'tradeSendPayApp',
      projectId: 'helotes',
      packageId: 'dry',
      toPct: { 'dry-3': 100 },
      periodTo: '2026-10-02',
      address: '418 River Rd, Boerne, TX 78006',
      license: '',
      signedBy: 'Rosa Medina',
      signedTitle: 'Office manager',
    },
  },
  // The portal: a company does its own paperwork.
  { label: 'Hillside sends an insurance certificate', action: { type: 'tradeUploadCoi', partnerId: 'hillside', expires: '2027-10-02' } },
  { label: 'Hillside signs a W-9', action: { type: 'tradeSignW9', partnerId: 'hillside' } },
  // Helotes: our pay application to the owner, and the owner paying it.
  { label: 'Send Dr. Raman pay application 1', action: { type: 'sendOwnerPayApp', projectId: 'helotes' } },
  { label: 'Dr. Raman pays pay application 1', action: { type: 'ownerPaid', projectId: 'helotes', number: 1 } },
  // The sets that follow: a set named for what it is, a sheet it adds, a trade it brings.
  {
    label: 'Helotes: Bulletin 1 adds a storefront and its trade',
    action: {
      type: 'issuePlanSet',
      projectId: 'helotes',
      label: 'Bulletin 1',
      note: 'A new storefront at the entry. A-601 is new.',
      sheets: ['A-201', 'A-601'],
      addedSheets: [{ id: 'A-601', title: 'Storefront elevations' }],
      touches: ['dry'],
      recipients: ['hillcountry'],
      newTrades: [{ trade: 'Glass and storefront', budget: 18_000, ours: false, scope: ['Storefront', 'Glass'] }],
    },
  },
  // Helotes, closeout: the last of the work, then the retainage back with the final waivers.
  { label: 'Approve draw 3', action: { type: 'approveDraw', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-3' } },
  { label: 'Pay draw 3', action: { type: 'payDraw', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-3' } },
  { label: 'Hill Country signs the unconditional waiver on draw 3', action: { type: 'tradeSignUnconditional', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-3' } },
  { label: 'Accept the drywall work', action: { type: 'acceptWork', projectId: 'helotes', packageId: 'dry' } },
  { label: 'Hill Country sends the warranty letter', action: { type: 'tradeSendWarranty', projectId: 'helotes', packageId: 'dry' } },
  {
    label: 'Hill Country sends the final pay application',
    action: {
      type: 'tradeSendFinalPayApp',
      projectId: 'helotes',
      packageId: 'dry',
      periodTo: '2026-10-02',
      address: '418 River Rd, Boerne, TX 78006',
      license: '',
      signedBy: 'Rosa Medina',
      signedTitle: 'Office manager',
    },
  },
  { label: 'Approve the retainage release', action: { type: 'approveRetainage', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-4' } },
  { label: 'Pay the retainage', action: { type: 'payDraw', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-4' } },
  { label: 'Hill Country signs the unconditional waiver on final payment', action: { type: 'tradeSignUnconditional', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-4' } },
  // Helotes: our own crew reports plumbing on Bill the owner.
  { label: 'Our crew reports plumbing at 50%', action: { type: 'selfReport', projectId: 'helotes', packageId: 'dplumb', pct: 50 } },
  // Helotes, a draw sent back: Cedar & Pine asks for too much, we send it back, they fix it.
  {
    label: 'Cedar & Pine sends pay application 1',
    action: { type: 'tradeSendPayApp', projectId: 'helotes', packageId: 'mill', toPct: { 'mill-1': 100, 'mill-2': 50 }, ...CEDAR_TYPED },
  },
  {
    label: 'Send it back: we see the cabinets at 30%',
    action: {
      type: 'sendDrawBack',
      projectId: 'helotes',
      packageId: 'mill',
      drawId: 'mill-draw-1',
      note: 'Four of the twelve operatory cabinets are set, not half.',
      weSee: { 'mill-1': 100, 'mill-2': 30 },
    },
  },
  {
    label: 'Cedar & Pine sends pay application 1 again, fixed',
    action: { type: 'tradeSendPayApp', projectId: 'helotes', packageId: 'mill', toPct: { 'mill-1': 100, 'mill-2': 30 }, ...CEDAR_TYPED },
  },
  { label: 'Approve the fixed pay application 1', action: { type: 'approveDraw', projectId: 'helotes', packageId: 'mill', drawId: 'mill-draw-1' } },
  // The portal: a company's first visit.
  { label: 'AquaShield opens its portal for the first time', action: { type: 'tradeOpenPortal', partnerId: 'aquashield' } },
  // The portal's bid form: answer a line, and a bid with how long it holds, an alternate and the company's own quote.
  { label: 'Alamo answers: the rebar is in its number', action: { type: 'tradeAnswerLines', projectId: 'boerne', packageId: 'conc', inviteId: 'conc-alamo', answers: { 'conc-4': 'yes' } } },
  { label: 'Pad B: Lonestar opens the plans', action: { type: 'tradeOpenPlans', projectId: 'padb', packageId: 'bsite', inviteId: 'bsite-lonestar' } },
  {
    label: 'Pad B: Lonestar bids, good for 30 days, with an alternate and its own quote',
    action: {
      type: 'tradeSubmitBid',
      projectId: 'padb',
      packageId: 'bsite',
      inviteId: 'bsite-lonestar',
      amount: 92_500,
      includes: { 'bsite-1': 'yes', 'bsite-2': 'yes', 'bsite-3': 'yes' },
      note: '',
      goodForDays: 30,
      alternates: [{ label: 'Asphalt paving in place of concrete', amount: -6_000 }],
      quoteFile: 'lonestar-pad-b.pdf',
    },
  },
  // A new set that adds work to a trade already on the job.
  {
    label: 'Boerne: Bulletin 1 adds a detention pond to Sitework',
    action: {
      type: 'issuePlanSet',
      projectId: 'boerne',
      label: 'Bulletin 1',
      note: 'A detention pond at the north end. C-101 changed.',
      sheets: ['C-101'],
      addedSheets: [],
      touches: ['site'],
      recipients: ['lonestar'],
      newTrades: [],
      newLines: [{ packageId: 'site', label: 'Detention pond', sheets: ['C-101'] }],
    },
  },
  // Stone Oak Pharmacy, closeout with the owner: the last trade's final, the owner accepts, our final, paid.
  { label: 'Cool Breeze sends the warranty letter', action: { type: 'tradeSendWarranty', projectId: 'stoneoak', packageId: 'shvac' } },
  {
    label: 'Cool Breeze sends the final pay application',
    action: {
      type: 'tradeSendFinalPayApp',
      projectId: 'stoneoak',
      packageId: 'shvac',
      periodTo: '2026-10-02',
      address: '1188 Culebra Rd, San Antonio, TX 78201',
      license: '',
      signedBy: 'Andre Wallace',
      signedTitle: 'Owner',
    },
  },
  { label: 'Hollis accepts the work', action: { type: 'ownerAcceptsWork', projectId: 'stoneoak' } },
  { label: 'Send Hollis the final pay application', action: { type: 'sendOwnerFinalPayApp', projectId: 'stoneoak' } },
  { label: 'Hollis pays the final pay application', action: { type: 'ownerPaid', projectId: 'stoneoak', number: 4 } },
  // The owner's answers (2026-10-02): approve less than asked, our crew by stage, close a job.
  {
    label: 'Cedar & Pine sends pay application 2',
    action: { type: 'tradeSendPayApp', projectId: 'helotes', packageId: 'mill', toPct: { 'mill-2': 100, 'mill-3': 50 }, ...CEDAR_TYPED },
  },
  {
    label: 'Approve less: the cabinets at 80%',
    action: {
      type: 'approveDrawLess',
      projectId: 'helotes',
      packageId: 'mill',
      drawId: 'mill-draw-2',
      weApprove: { 'mill-2': 80 },
      note: 'Two operatory cabinets are still on order.',
    },
  },
  { label: 'Our crew reports underground done', action: { type: 'selfReportStage', projectId: 'helotes', packageId: 'dplumb', lineId: 'dplumb-1', pct: 100 } },
  { label: 'Close Fair Oaks D with work still open (the screen would not offer it)', action: { type: 'closeJob', projectId: 'fairoaksd' } },
  // Our own bid on a new project's trade: started unpriced, then priced.
  {
    label: 'Leon Springs: we price our own plumbing bid',
    action: { type: 'priceOwnBid', projectId: 'leon-springs-urgent-care', packageId: 'leon-springs-urgent-care-plumbing', value: 68_000 },
  },
  // The schedule, drawn (Building lane): a first draft on Helotes, an activity moved, milestones.
  { label: 'Draw Helotes’s schedule from Oct 12', action: { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12' } },
  {
    label: 'Framing waits on electrical: Nov 16 to 25',
    action: { type: 'setScheduleActivity', projectId: 'helotes', lineId: 'dry-1', start: '2026-11-16', finish: '2026-11-25', after: ['delec-1'] },
  },
  {
    label: 'A milestone: cabinets set',
    action: { type: 'setScheduleMilestone', projectId: 'helotes', milestone: { id: 'helotes-ms-cabinets', label: 'Cabinets set', planned: '2026-12-18', packageId: 'mill', metOn: null } },
  },
  { label: 'Take the rough-in inspection off', action: { type: 'removeScheduleMilestone', projectId: 'helotes', milestoneId: 'helotes-roughin' } },
  // The superintendent's verify list (Building lane): a mark confirmed, one corrected, our crew's own.
  { label: 'Superintendent: Iron Horse’s erection not done, right', action: { type: 'verifyLookAhead', projectId: 'fairoaksd', weekOf: '2026-09-28', lineId: 'fsteel-3', done: false } },
  {
    label: 'Superintendent: the membrane is not done (weather), not as Summit says',
    action: { type: 'verifyLookAhead', projectId: 'fairoaksd', weekOf: '2026-09-28', lineId: 'froof-1', done: false, reason: 'weather' },
  },
  {
    label: 'Our crew’s top out this week: not done after all (materials)',
    action: { type: 'crewMarkLookAhead', projectId: 'fairoaksd', weekOf: '2026-09-28', lineId: 'fplumb-3', done: false, reason: 'materials' },
  },
  // The portal's weekly look-ahead: the trade marks this week's activity.
  { label: 'Fair Oaks D: Pecan Valley marks Lighting not done this week (materials)', action: { type: 'tradeMarkLookAhead', projectId: 'fairoaksd', packageId: 'felec', lineId: 'felec-3', weekOf: '2026-09-28', done: false, reason: 'materials' } },
  // The portal: a company keeps its language on its record.
  { label: 'Hillside chooses Spanish for its portal and messages', action: { type: 'tradeSetLanguage', partnerId: 'hillside', lang: 'es' } },
  // Helotes: change orders to the owner. One added and signed, one credit declined.
  {
    label: 'Draft change order 1: sound batts at operatory 3',
    action: { type: 'draftChangeOrder', projectId: 'helotes', description: 'Add sound batts to the walls of operatory 3, per detail 4 on A-201', reason: 'owner', schedule: '+1 working day', packageId: 'dry', cost: 4_800, price: 5_280 },
  },
  { label: 'Send change order 1 to Dr. Raman', action: { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' } },
  { label: 'Dr. Raman signs change order 1', action: { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' } },
  { label: 'Change order 1 is done', action: { type: 'setChangeOrderPct', projectId: 'helotes', changeOrderId: 'co-1', pct: 100 } },
  {
    label: 'Draft change order 2: a credit, the break room sink comes out',
    action: { type: 'draftChangeOrder', projectId: 'helotes', description: 'Delete the break room sink', reason: 'plans', schedule: 'none', packageId: 'dplumb', cost: -1_200, price: -1_320 },
  },
  { label: 'Send change order 2 to Dr. Raman', action: { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-2' } },
  { label: 'Dr. Raman declines change order 2', action: { type: 'ownerDeclineChangeOrder', projectId: 'helotes', changeOrderId: 'co-2' } },
  // A set issued on a job with a schedule adds days to an activity; what waits on it moves out.
  {
    label: 'Helotes: Bulletin 2 adds data drops, five more days of low voltage rough',
    action: {
      type: 'issuePlanSet',
      projectId: 'helotes',
      label: 'Bulletin 2',
      note: 'Data drops added at each operatory. E-102 changed.',
      sheets: ['E-102'],
      addedSheets: [],
      touches: ['delec'],
      recipients: ['brightline'],
      newTrades: [],
      schedulePushes: { 'delec-4': 5 },
    },
  },
  { label: 'The office sets Comal Iron to Spanish', action: { type: 'setPartnerLanguage', partnerId: 'comal', lang: 'es' } },
  // Change orders, the trade's side (Building lane): the owner signs, the trade signs it into its statement of work.
  {
    label: 'Change order 3: a coffee bar cabinet in the break room',
    action: { type: 'draftChangeOrder', projectId: 'helotes', description: 'Add a coffee bar cabinet in the break room, per A-501', reason: 'owner', schedule: '+2 working days', packageId: 'mill', cost: 2_400, price: 0 },
  },
  { label: 'Send change order 3 to Dr. Raman', action: { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-3' } },
  { label: 'Dr. Raman signs change order 3', action: { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-3' } },
  { label: 'Send change order 3 to Cedar & Pine', action: { type: 'sendTradeChange', projectId: 'helotes', changeOrderId: 'co-3' } },
  { label: 'Cedar & Pine signs change order 3', action: { type: 'tradeSignChange', projectId: 'helotes', changeOrderId: 'co-3' } },
  { label: 'Cedar & Pine reports the coffee bar half done', action: { type: 'tradeReport', projectId: 'helotes', packageId: 'mill', sovId: 'mill-co3', pct: 50 } },
]

const CUSTOMER_IDS = ['cibolo', 'raman']
const ARCHITECT_IDS = ['marshvale', 'ocotillo']

/** Write a record a calculation points at as its id, so a step pins the decision and not the record. */
function shrink(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.map((v) => shrink(v, depth + 1))
  // A function is a new copy on every reading: pin a stable mark, never the reference.
  if (typeof value === 'function') return '«function»'
  if (value === null || typeof value !== 'object') return value
  const o = value as Record<string, unknown>
  // A progress group's doneWords: pin the words the hover card says for this group's done count.
  if (typeof o.doneWords === 'function' && Array.isArray(o.items)) {
    const done = (o.items as { done: boolean }[]).filter((i) => i.done).length
    const words = (o.doneWords as (n: number) => string)(done)
    return shrink({ ...o, doneWords: `«says» ${words}` }, depth)
  }
  if (depth > 0) {
    if ('planSets' in o && 'packages' in o) return `«project ${String(o.id)}»`
    if ('invites' in o && 'scope' in o) return `«package ${String(o.id)}»`
    if ('partnerId' in o && 'invitedOn' in o) return `«invite ${String(o.id)}»`
    if ('msa' in o && 'trades' in o) return `«partner ${String(o.id)}»`
    if ('howTheyBuy' in o && 'portalOn' in o) return `«customer ${String(o.id)}»`
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) out[k] = shrink(v, depth + 1)
  return out
}

/** What the main calculations say about the state: every project, every trade, the board-wide lists. */
function readings(state: GcState) {
  const projects: Record<string, unknown> = {}
  for (const project of state.projects) {
    const everyTrade = project.packages.map((p) => p.id)
    const trades: Record<string, unknown> = {}
    for (const pkg of project.packages) {
      trades[pkg.id] = {
        compareBids: compareBids(state, project, pkg),
        bidTabRows: bidTabRows(state, pkg),
        tradeLineup: tradeLineup(state, project, pkg),
      }
    }
    projects[project.id] = {
      stage: project.stage,
      proposalTotals: proposalTotals(project),
      stageProgress: stageProgress(state, project),
      startChecklist: startChecklist(state, project),
      planRecipients: {
        noneTouched: planRecipients(state, project, []),
        allTouched: planRecipients(state, project, everyTrade),
      },
      trades,
    }
  }
  const customers: Record<string, unknown> = {}
  for (const id of CUSTOMER_IDS) {
    const c = state.customers.find((x) => x.id === id)
    if (c) customers[id] = customerSummary(state, c)
  }
  for (const id of ARCHITECT_IDS) {
    const c = state.customers.find((x) => x.id === id)
    if (c) customers[id] = architectSummary(state, c)
  }
  return shrink({
    projects,
    customers,
    followUps: followUps(state),
    tradeBenches: tradeBenches(state),
    assistantRules: assistantRules(state),
    lastLog: state.log[0] ?? null,
  })
}

/** Every value in the readings by its path: `projects.boerne.proposalTotals.price` → 824733. */
function leaves(value: unknown, path = '', out = new Map<string, unknown>()): Map<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(path, '[]')
    value.forEach((v, i) => leaves(v, `${path}[${i}]`, out))
  } else if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) out.set(path, '{}')
    for (const [k, v] of entries) leaves(v, path ? `${path}.${k}` : k, out)
  } else {
    out.set(path, value === undefined ? '«undefined»' : value)
  }
  return out
}

/** What one step moved: the values that differ from the step before, and the paths that went away. */
function moved(before: GcState, after: GcState) {
  const was = leaves(readings(before))
  const now = leaves(readings(after))
  const changed: Record<string, unknown> = {}
  for (const [path, v] of now) if (!was.has(path) || was.get(path) !== v) changed[path] = v
  const removed = [...was.keys()].filter((path) => !now.has(path))
  return { changed, removed }
}

// Play the walk once; each step's test reads the state after it.
const states: GcState[] = [initialGcState()]
for (const step of STEPS) states.push(gcReducer(stateAt(states.length - 1), step.action))
const finalState = stateAt(states.length - 1)

/** The state after `i` steps (0: before any). */
function stateAt(i: number): GcState {
  const s = states[i]
  if (!s) throw new Error(`no state after step ${i}`)
  return s
}

describe('GC mode golden walk', () => {
  it('uses every action type at least once', () => {
    const used = new Set(STEPS.map((s) => s.action.type))
    used.add('reset') // played in its own test below
    const all: GcAction['type'][] = [
      'issueAddendum', 'tradeConfirmBid', 'setStartItem', 'setStartDate', 'startProject', 'invite', 'nudge',
      'logContact', 'tradePromise', 'tradeOpenPlans', 'tradeSubmitBid', 'tradeDecline', 'officeDecline', 'setPlug',
      'carry', 'markWon', 'markBidSent', 'shareBidTab', 'tradeSeeBidTab', 'award', 'sendMsa', 'tradeSignMsa',
      'sendSow', 'tradeSignSow', 'tradeReport', 'tradeRequestDraw', 'approveDraw', 'payDraw',
      'tradeSignUnconditional', 'setMarkup', 'logCustomerContact', 'addPartner', 'setCoverage', 'reset',
      'createProject',
      'tradeSendPayApp',
      'tradeUploadCoi', 'tradeSignW9',
      'sendOwnerPayApp', 'ownerPaid', 'issuePlanSet',
      'acceptWork', 'tradeSendWarranty', 'tradeSendFinalPayApp', 'approveRetainage',
      'selfReport',
      'ownerAcceptsWork', 'sendOwnerFinalPayApp',
      'draftChangeOrder', 'sendChangeOrder', 'ownerSignChangeOrder', 'ownerDeclineChangeOrder', 'setChangeOrderPct',
      'sendDrawBack',
      'closeJob', 'approveDrawLess', 'selfReportStage',
      'draftSchedule', 'setScheduleActivity', 'setScheduleMilestone', 'removeScheduleMilestone',
      'verifyLookAhead', 'crewMarkLookAhead',
      'sendTradeChange', 'tradeSignChange',
      'tradeOpenPortal',
      'tradeAnswerLines',
      'priceOwnBid',
      'tradeMarkLookAhead',
      'tradeSetLanguage',
      'setPartnerLanguage',
    ]
    expect(all.filter((t) => !used.has(t))).toEqual([])
  })

  it('every step changes the state (no step is a silent no-op)', () => {
    const still = STEPS.filter((_, i) => stateAt(i + 1) === stateAt(i)).map((s) => s.label)
    expect(still).toEqual([])
  })

  it('starts on 2026-10-02', () => {
    expect(stateAt(0).today).toBe('2026-10-02')
  })

  it('before any step', () => {
    expect(readings(stateAt(0))).toMatchSnapshot()
  })

  STEPS.forEach((step, i) => {
    it(`step ${String(i + 1).padStart(2, '0')}: ${step.label}`, () => {
      expect(moved(stateAt(i), stateAt(i + 1))).toMatchSnapshot()
    })
  })

  it('the whole state at the end', () => {
    expect(finalState).toMatchSnapshot()
  })

  it('Start over puts the made-up data back', () => {
    expect(gcReducer(finalState, { type: 'reset' })).toEqual(initialGcState())
  })
})
