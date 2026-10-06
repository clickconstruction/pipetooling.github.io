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
  insuranceRenewals,
  partnersToVet,
  tradePromisesOf,
  tradePromiseWords,
  vettingWords,
  planRecipients,
  proposalTotals,
  stageProgress,
  startChecklist,
  tradeBenches,
  tradeLineup,
  payReminderSentWords,
  payReminderStep,
  type GcAction,
  type GcState,
} from './gcModel'

type Step = { label: string; action: GcAction }

/** What Cedar & Pine types on its pay applications in the walk. */
const CEDAR_TYPED = { periodTo: '2026-10-02', address: '77 Main St, Fredericksburg, TX 78624', license: '', signedBy: 'Owen Blake', signedTitle: 'Owner' }

/** The company the walk adds as new to us: the fixture's partners, then Pecos Steel, then this one. */
const STRANGER = `new-${initialGcState().partners.length + 2}`

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
  // Start waits on the schedule (the Board lane's Get started step), so it is drawn first (owner, 2026-10-03).
  { label: 'Draw Helotes’s schedule from Oct 12', action: { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12' } },
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
  // The schedule, drawn (Building lane): an activity moved on Helotes, milestones. Its first draft is drawn before Start.
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
  // Helotes: the architect certifies our pay application before the owner pays.
  { label: 'Send Dr. Raman pay application 2', action: { type: 'sendOwnerPayApp', projectId: 'helotes' } },
  { label: 'Studio Ocotillo certifies pay application 2 for $2,000 less', action: { type: 'architectCertify', projectId: 'helotes', number: 2, amount: 54_302, note: 'Two operatory cabinets are not set yet' } },
  { label: 'Dr. Raman pays pay application 2', action: { type: 'ownerPaid', projectId: 'helotes', number: 2 } },
  // An inspection is the job's own activity (Building lane): our superintendent records the pass.
  { label: 'Fair Oaks D: the rough-in inspection passes', action: { type: 'passInspection', projectId: 'fairoaksd', lineId: 'fairoaksd-insp-roughin' } },
  // Questions about the plans on Pad B: Lonestar asks, the architect answers, a set carries it.
  {
    label: 'Pad B: Lonestar asks whether the drive-through lane is concrete',
    action: { type: 'tradeAskQuestion', projectId: 'padb', packageId: 'bsite', partnerId: 'lonestar', text: 'Is the drive-through lane concrete or asphalt?', sheets: ['C-101'] },
  },
  { label: 'Pad B: send the question to the architect', action: { type: 'sendQuestionToArchitect', projectId: 'padb', questionId: 'padb-q-1' } },
  {
    label: 'Pad B: the architect answers, sent to the sitework bidders',
    action: { type: 'answerQuestion', projectId: 'padb', questionId: 'padb-q-1', answer: 'Concrete, per detail 3 on C-101.', recipients: ['lonestar'] },
  },
  {
    label: 'Pad B: Addendum 1 carries the answer',
    action: {
      type: 'issuePlanSet',
      projectId: 'padb',
      label: 'Addendum 1',
      note: 'C-101, Sitework: Is the drive-through lane concrete or asphalt? Answer: Concrete, per detail 3 on C-101.',
      sheets: [],
      addedSheets: [],
      touches: [],
      recipients: ['lonestar', 'alamo'],
      newTrades: [],
      questionIds: ['padb-q-1'],
    },
  },
  // A bid we lost (Board lane, 2026-10-03): Pad B leaves Bidding for the Lost section, then comes back.
  {
    label: 'Pad B: we lost it, on price, to Hill Country Builders',
    action: { type: 'markLost', projectId: 'padb', why: 'price', wonBy: 'Hill Country Builders', note: 'They came in about 6% under us.' },
  },
  { label: 'Pad B: the owner comes back to us', action: { type: 'reopenLost', projectId: 'padb' } },
  // Fair Oaks D: Cibolo missed the day it gave, gives a new one, and pays part.
  { label: 'Cibolo says checks go out Oct 9', action: { type: 'ownerPromisePay', projectId: 'fairoaksd', number: 3, by: '2026-10-09', note: 'Their controller, on a call', who: 'office' } },
  { label: 'Cibolo pays $150,000 of pay application 3', action: { type: 'ownerPayPart', projectId: 'fairoaksd', number: 3, amount: 150_000 } },
  // The punch list (Building lane): Fair Oaks D's concrete, walked Sep 28, to accepted.
  {
    label: 'Fair Oaks D: one more punch item on the concrete',
    action: { type: 'addPunchItem', projectId: 'fairoaksd', packageId: 'fconc', text: 'Grind the trip edge at the sidewalk joint', where: 'East entry' },
  },
  { label: 'Guadalupe fixes the spalled footing corner', action: { type: 'tradeFixPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-1' } },
  {
    label: 'Superintendent: the stockroom joints are not all sealed',
    action: { type: 'checkPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-2', fixed: false, note: 'Two joints in the back corner are still open.' },
  },
  { label: 'Guadalupe seals the last two joints', action: { type: 'tradeFixPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-2' } },
  { label: 'Guadalupe grinds the trip edge', action: { type: 'tradeFixPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-4' } },
  { label: 'Superintendent checks the footing corner', action: { type: 'checkPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-1', fixed: true } },
  { label: 'Superintendent checks the stockroom joints', action: { type: 'checkPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-2', fixed: true } },
  { label: 'Superintendent checks the trip edge', action: { type: 'checkPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-4', fixed: true } },
  { label: 'Accept the concrete work on Fair Oaks D', action: { type: 'acceptWork', projectId: 'fairoaksd', packageId: 'fconc' } },
  // The project manual (New Project lane, 2026-10-03): a set revises a section and adds a line that reads it.
  {
    label: 'Leon Springs: Addendum 1 revises the roofing section',
    action: {
      type: 'issuePlanSet',
      projectId: 'leon-springs-urgent-care',
      label: 'Addendum 1',
      note: 'Section 07 54 23: the membrane goes from 60 to 80 mil, with walk pads to each rooftop unit.',
      sheets: [],
      addedSheets: [],
      touches: ['leon-springs-urgent-care-roofing'],
      recipients: [],
      newTrades: [],
      newLines: [{ packageId: 'leon-springs-urgent-care-roofing', label: 'Walk pads', sheets: [], specs: ['07 54 23'] }],
      specs: ['07 54 23'],
      addedSpecs: [{ id: '07 54 23', title: 'Thermoplastic polyolefin roofing' }],
    },
  },
  // A failed inspection (Building lane): the service re-inspection fails again, on the electrician's work.
  {
    label: 'Fair Oaks D: the service re-inspection fails again',
    action: {
      type: 'failInspection',
      projectId: 'fairoaksd',
      lineId: 'fairoaksd-insp-service',
      note: 'The jumper is in. The service disconnect label is still missing.',
      packageIds: ['felec'],
      reinspectOn: '2026-10-06',
    },
  },
  // A whole new set (New Project lane, 2026-10-03): a sheet goes, one comes, one is renamed, and the line left behind is tied to the new one.
  {
    label: 'Leon Springs: the permit set takes E-101 out, adds E-102 and renames A-501',
    action: {
      type: 'issuePlanSet',
      projectId: 'leon-springs-urgent-care',
      label: 'Permit set',
      note: 'The lighting plan is folded into a new lighting and power plan. The roof plan now shows the walk pads.',
      sheets: ['A-501', 'E-101', 'E-102'],
      addedSheets: [{ id: 'E-102', title: 'Lighting and power plan' }],
      touches: ['leon-springs-urgent-care-roofing', 'leon-springs-urgent-care-electrical'],
      recipients: [],
      newTrades: [],
      removedSheets: ['E-101'],
      retitledSheets: [{ id: 'A-501', title: 'Roof plan, details and walk pads' }],
      retiedLines: [{ packageId: 'leon-springs-urgent-care-electrical', scopeId: 'leon-springs-urgent-care-electrical-2', sheets: ['E-102'] }],
      checkedBy: 'Dana Whitaker',
    },
  },
  // Question 14 (the Board lane's call, 2026-10-04): an alternate moves our number only when taken.
  {
    label: "Pad B: take Lonestar's asphalt alternate",
    action: { type: 'takeAlternate', projectId: 'padb', packageId: 'bsite', inviteId: 'bsite-lonestar', label: 'Asphalt paving in place of concrete', taken: true },
  },
  // The daily log (Building lane): today's on Fair Oaks D, then Wednesday's caught up.
  {
    label: "Fair Oaks D: the superintendent writes today's log",
    action: {
      type: 'saveDailyLog',
      projectId: 'fairoaksd',
      log: {
        date: '2026-10-02',
        sky: 'clear',
        high: 86,
        low: 68,
        weatherStop: false,
        crews: [
          { packageId: 'fsteel', workers: 3 },
          { packageId: 'froof', workers: 5 },
          { packageId: 'felec', workers: 3 },
          { packageId: 'fplumb', workers: 3 },
          { packageId: 'fhvac', workers: 3 },
        ],
        done: 'West half membrane down. Bonding jumper in at the service panel.',
        delays: [],
        visitors: '',
      },
    },
  },
  {
    label: "Fair Oaks D: catch up Wednesday's log",
    action: {
      type: 'saveDailyLog',
      projectId: 'fairoaksd',
      log: {
        date: '2026-09-30',
        sky: 'clear',
        high: 88,
        low: 69,
        weatherStop: false,
        crews: [
          { packageId: 'fsteel', workers: 4 },
          { packageId: 'froof', workers: 5 },
          { packageId: 'felec', workers: 2 },
          { packageId: 'fplumb', workers: 3 },
          { packageId: 'fhvac', workers: 3 },
        ],
        done: 'Membrane on the west half. Erection on the canopy.',
        delays: [{ packageId: 'fsteel', reason: 'crew', note: 'Iron Horse short two again.' }],
        visitors: '',
      },
    },
  },
  // Question 3 (the owner, 2026-10-04): a company new to us quotes, and is approved before any award.
  {
    label: 'Add a glass company we do not know',
    action: { type: 'addPartner', company: 'Brazos Glass', contact: 'Lupe Garza', trade: 'Storefront and glass', base: 'New Braunfels', maxMiles: 60, known: false },
  },
  {
    label: 'Brazos Glass sends its company form',
    action: {
      type: 'tradeVettingForm',
      partnerId: STRANGER,
      form: {
        license: 'TX glazing contractor 48213',
        insurance: 'Texas Mutual, $1M per claim, $2M total',
        yearsInBusiness: 9,
        references: 'Rosa Lin, Alamo Builders, (210) 555-0190. Tom Beck, Hill Country GC, (830) 555-0144.',
        pastJobs: 'Storefronts at Bulverde Crossing and the Gruene dental office.',
      },
    },
  },
  { label: 'Dana approves Brazos Glass up to $150,000', action: { type: 'vetPartner', partnerId: STRANGER, status: 'approved', limit: 150_000, by: 'Dana Whitaker' } },
  // Question 8 (the owner, 2026-10-04): promises other than a quote date, insurance first.
  { label: 'Voltage Brothers promise the renewed insurance by Tue Oct 6', action: { type: 'recordPromise', partnerId: 'voltage', kind: 'insurance', by: '2026-10-06', from: 'office' } },
  { label: 'Voltage Brothers move it to Fri Oct 9', action: { type: 'recordPromise', partnerId: 'voltage', kind: 'insurance', by: '2026-10-09', from: 'trade' } },
  { label: 'Voltage Brothers send the new certificate, which keeps the promise', action: { type: 'tradeUploadCoi', partnerId: 'voltage', expires: '2027-09-15' } },
  { label: 'Tejas Power promises a signed W-9 by Mon Oct 5', action: { type: 'recordPromise', partnerId: 'tejas', kind: 'w9', by: '2026-10-05', from: 'trade' } },
  { label: "The office marks Tejas's W-9 kept", action: { type: 'keepPromise', id: 'tp-2' } },
  // Submittals (Building lane): Summit's flashing drawings, a revise round, approved; a new one asked; the controls sent.
  { label: "Fair Oaks D: send Summit's flashing drawings to the architect", action: { type: 'sendSubmittalToArchitect', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-6' } },
  {
    label: 'The architect sends the flashing drawings back to revise',
    action: { type: 'answerSubmittal', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-6', answer: 'revise', note: 'Show the cleat spacing at the coping.' },
  },
  {
    label: 'Summit sends the flashing drawings again',
    action: { type: 'tradeSendSubmittal', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-6', file: 'Summit-flashing-r1.pdf', note: 'Cleat spacing added.' },
  },
  { label: 'Send the flashing drawings to the architect again', action: { type: 'sendSubmittalToArchitect', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-6' } },
  {
    label: 'The architect approves the flashing drawings as noted',
    action: { type: 'answerSubmittal', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-6', answer: 'approved as noted', note: 'Use 24 gauge at the corners.' },
  },
  {
    label: 'Fair Oaks D: ask Pecan Valley for the site lighting fixtures',
    action: { type: 'addSubmittal', projectId: 'fairoaksd', packageId: 'felec', title: 'Site lighting fixtures', kind: 'product data', specSection: '26 56 00', lineIds: ['felec-5'], leadDays: 21 },
  },
  {
    label: 'Cool Breeze sends the controls drawings',
    action: { type: 'tradeSendSubmittal', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-4', file: 'CBM-controls.pdf', note: 'Sequence of operations included.' },
  },
  // Question 7 (the owner, 2026-10-04): any estimator awards and the bid tab names them; Start anyway.
  { label: 'We won Pad B', action: { type: 'markWon', projectId: 'padb' } },
  { label: 'Pad B: Rosa awards Sitework to Lonestar', action: { type: 'award', projectId: 'padb', packageId: 'bsite', inviteId: 'bsite-lonestar', by: 'Rosa Treviño' } },
  {
    label: 'Pad B: start anyway, before everything is in',
    action: { type: 'startProject', projectId: 'padb', anyway: { reason: 'The owner needs the pad graded before the rains.', by: 'Dana Whitaker' } },
  },
  // Materials stored on site (Building lane, question 12): the rooftop units are on site, not set.
  {
    label: 'Cool Breeze asks for pay application 2, the rooftop units stored on site',
    action: {
      type: 'tradeSendPayApp',
      projectId: 'fairoaksd',
      packageId: 'fhvac',
      toPct: { 'fhvac-2': 100 },
      stored: { 'fhvac-1': 36_000 },
      periodTo: '2026-10-02',
      address: '1188 Culebra Rd, San Antonio, TX 78201',
      license: '',
      signedBy: 'Marco Ruiz',
      signedTitle: 'Owner',
    },
  },
  { label: 'Fair Oaks D: retainage drops to 5% on the work after half done', action: { type: 'setOwnerRetainageStep', projectId: 'fairoaksd', step: { atPct: 50, toPct: 5, way: 'after' } } },
  // Interest on late bills (the owner, 2026-10-04): ours to choose per job, on a bill of its own.
  { label: 'Fair Oaks D: Cibolo pays 1.5% a month on a late bill', action: { type: 'setOwnerLateInterest', projectId: 'fairoaksd', pctPerMonth: 1.5 } },
  { label: 'Bill Cibolo the interest on pay application 3', action: { type: 'sendOwnerInterestBill', projectId: 'fairoaksd' } },
  { label: 'Cibolo pays the interest bill', action: { type: 'ownerPaidInterest', projectId: 'fairoaksd', number: 1 } },
  // Question 4 (the owner, 2026-10-04): a trade's own schedule of values, beside ours.
  {
    label: 'Fair Oaks D: Cool Breeze sends its schedule of values',
    action: {
      type: 'tradeSendSov',
      projectId: 'fairoaksd',
      packageId: 'fhvac',
      sov: [
        { label: 'Rough-in: ductwork', amount: 70_000 },
        { label: 'Set the units', amount: 60_000 },
        { label: 'Trim and start-up', amount: 28_000 },
      ],
    },
  },
  // Building's promises (question 8): each kept by the trade's own move; a delivery the office marks.
  {
    label: 'Pecan Valley promises the site lighting submittal by Tue Oct 6',
    action: { type: 'recordPromise', partnerId: 'pecanvalley', kind: 'submittals', projectId: 'fairoaksd', packageId: 'felec', by: '2026-10-06', from: 'office' },
  },
  {
    label: 'Pecan Valley sends the site lighting fixtures, which keeps it',
    action: { type: 'tradeSendSubmittal', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-7', file: 'PVE-site-lighting.pdf', note: '' },
  },
  {
    label: 'Pecan Valley promises the unconditional waiver on draw 1 by Wed Oct 7',
    action: { type: 'recordPromise', partnerId: 'pecanvalley', kind: 'closeout', projectId: 'fairoaksd', packageId: 'felec', by: '2026-10-07', from: 'office', what: 'the unconditional waiver on draw 1' },
  },
  { label: 'Pecan Valley signs it, which keeps it', action: { type: 'tradeSignUnconditional', projectId: 'fairoaksd', packageId: 'felec', drawId: 'felec-draw-1' } },
  {
    label: 'Summit promises the coping metal by Thu Oct 8',
    action: { type: 'recordPromise', partnerId: 'summit', kind: 'delivery', projectId: 'fairoaksd', packageId: 'froof', by: '2026-10-08', from: 'office', what: 'the coping metal' },
  },
  { label: 'The coping metal comes and the office marks it kept', action: { type: 'keepPromise', id: 'tp-5' } },
  // Finishing late (the owner, 2026-10-04): the owner contract's late fee, ours to enter.
  { label: 'Fair Oaks D: the contract charges $500 a day for finishing late', action: { type: 'setOwnerLateFinish', projectId: 'fairoaksd', perDay: 500 } },
  // The pre-bid meeting (New Project lane, the owner 2026-10-04): set, a question raised there, who came, the minutes in a set.
  { label: 'Leon Springs: ask Lonestar for Sitework', action: { type: 'invite', projectId: 'leon-springs-urgent-care', packageId: 'leon-springs-urgent-care-sitework', partnerId: 'lonestar' } },
  {
    label: 'Leon Springs: the architect\'s pre-bid meeting, Thu Oct 8 at 10 AM, coming required',
    action: { type: 'schedulePreBid', projectId: 'leon-springs-urgent-care', on: '2026-10-08', at: '10:00', place: 'the site, 24165 IH-10 W, San Antonio', host: 'architect', mandatory: true },
  },
  {
    label: 'Leon Springs: Lonestar asks at the meeting where the storm line ties in',
    action: {
      type: 'tradeAskQuestion',
      projectId: 'leon-springs-urgent-care',
      packageId: 'leon-springs-urgent-care-sitework',
      partnerId: 'lonestar',
      text: 'Where does the storm line tie in, the street or the pond?',
      sheets: ['C-101'],
      atPreBid: true,
    },
  },
  { label: 'Leon Springs: Lonestar came to the meeting', action: { type: 'recordPreBidAttendance', projectId: 'leon-springs-urgent-care', partnerIds: ['lonestar'] } },
  {
    label: 'Leon Springs: Addendum 2 carries the pre-bid meeting\'s minutes',
    action: {
      type: 'issuePlanSet',
      projectId: 'leon-springs-urgent-care',
      label: 'Addendum 2',
      note: 'Pre-bid meeting minutes, Thu Oct 8 at 10 AM, the site, 24165 IH-10 W, San Antonio: Lonestar Earthworks came.',
      sheets: [],
      addedSheets: [],
      touches: [],
      recipients: ['lonestar'],
      newTrades: [],
      checkedBy: 'Dana Whitaker',
      preBidMinutes: true,
    },
  },
  // Why a company is out, kept with the job and the company (the owner, 2026-10-04).
  {
    label: 'Bluebonnet will not do Roofing on Boerne: too busy',
    action: { type: 'officeDecline', projectId: 'boerne', packageId: 'roof', inviteId: 'roof-bluebonnet', why: 'wont', reason: 'busy', note: 'Wes says both crews are on a school job through November' },
  },
  // The scope book (the owner, 2026-10-04): a line saved by hand, a line changed, two lines folded, a set saved.
  { label: 'The scope book: save "Dumpster enclosure gates" under Sitework', action: { type: 'saveToScopeBook', trade: 'Sitework', words: 'Dumpster enclosure gates', spec: '32 31 13' } },
  {
    label: 'The scope book: Paving reads Asphalt paving, with its section',
    action: { type: 'editScopeBookLine', trade: 'Sitework', words: 'Paving', to: { words: 'Asphalt paving', spec: '32 12 16' } },
  },
  {
    label: 'The scope book: fold "Site clearing and grading" into "Clearing and grading"',
    action: { type: 'mergeScopeBookLines', trade: 'Sitework', from: 'Site clearing and grading', into: 'Clearing and grading' },
  },
  {
    label: 'The scope book: save Leon Springs\'s Sitework as a set',
    action: {
      type: 'saveScopeSet',
      trade: 'Sitework',
      name: 'Sitework for a clinic pad',
      lines: ['Clearing and grading', 'Utilities to 5 ft of the building', 'Asphalt paving', 'Detention pond'],
      fromProjectId: 'leon-springs-urgent-care',
    },
  },
  // The plans live in Google Drive (the owner, 2026-10-04): a link only some people can open is a warning on the set until Check again finds it open.
  {
    label: 'Leon Springs: Addendum 3 goes out by a Drive link only some people can open',
    action: {
      type: 'issuePlanSet',
      projectId: 'leon-springs-urgent-care',
      label: 'Addendum 3',
      note: 'C-101: the detention pond moves 20 ft west.',
      sheets: ['C-101'],
      addedSheets: [],
      touches: [],
      recipients: [],
      newTrades: [],
      checkedBy: 'Dana Whitaker',
      drive: { url: 'https://drive.google.com/file/d/1HcPlansOnlySomePeople/view', access: 'restricted', checkedOn: '2026-10-02' },
    },
  },
  { label: 'Leon Springs: Check again finds Addendum 3\'s link open', action: { type: 'checkPlanSetDrive', projectId: 'leon-springs-urgent-care', rev: 4, access: 'anyone' } },
  // Each company's exclusions (the owner, 2026-10-04): recorded from the quote, covered, tracked.
  {
    label: 'Hillside quotes Sitework on Boerne, leaving out permits and dewatering',
    action: {
      type: 'tradeSubmitBid',
      projectId: 'boerne',
      packageId: 'site',
      inviteId: 'site-hillside',
      amount: 186_500,
      includes: { 'site-1': 'yes', 'site-2': 'yes', 'site-3': 'yes', 'site-4': 'yes' },
      note: '',
      exclusions: [{ name: 'permits' }, { name: 'Dewatering' }],
      exclusionsAnswered: ['Permits and fees', 'Dewatering', 'Rock excavation', 'Sales tax'],
    },
  },
  { label: "Cover Hillside's permits at $4,200", action: { type: 'setExclusionCover', projectId: 'boerne', packageId: 'site', inviteId: 'site-hillside', name: 'Permits and fees', amount: 4_200 } },
  {
    label: "Lonestar's emailed quote leaves out rock, at $38 per cy if found",
    action: { type: 'setQuoteExclusion', projectId: 'boerne', packageId: 'site', inviteId: 'site-lonestar', name: 'rock', excluded: true, said: 'Rock excavation if encountered', unitPrice: { amount: 38, unit: 'cy' } },
  },
  { label: 'Hillside now includes dewatering', action: { type: 'setQuoteExclusion', projectId: 'boerne', packageId: 'site', inviteId: 'site-hillside', name: 'Dewatering', excluded: false } },
  // The company window (the owner, 2026-10-04): a call with the company itself, on its Activity tab.
  { label: 'A call with Pecan Valley about the waiver', action: { type: 'logPartnerContact', partnerId: 'pecanvalley', note: 'Said the draw 1 unconditional waiver goes out Monday.' } },
  { label: "Turn on Dr. Raman's portal", action: { type: 'setCustomerPortal', customerId: 'raman', on: true } },
  // Send a paper from the company window (the owner, 2026-10-04): remind Bluebonnet to sign the master agreement.
  { label: 'Remind Bluebonnet to sign the master agreement', action: { type: 'sendPaper', partnerId: 'bluebonnet', paper: 'msa', by: '2026-10-09', note: '' } },
  // Remind a customer from its window (the owner, 2026-10-04): a change order waiting on their signature.
  {
    label: 'Stone Oak: a change order for two counter outlets',
    action: { type: 'draftChangeOrder', projectId: 'stoneoak', description: 'Add two outlets at the front counter', reason: 'owner', schedule: 'none', packageId: 'selec', cost: 900, price: 990 },
  },
  { label: 'Send Stone Oak change order 1 to Hollis', action: { type: 'sendChangeOrder', projectId: 'stoneoak', changeOrderId: 'co-1' } },
  { label: 'Remind Hollis to sign change order 1', action: { type: 'remindCustomer', customerId: 'hollis', projectId: 'stoneoak', changeOrderId: 'co-1', by: '2026-10-09', note: '' } },
  // They sign it in their portal (the owner, 2026-10-04): our contract goes from Cibolo's window, they sign it in their portal.
  { label: "Send Boerne's contract to Cibolo to sign", action: { type: 'sendOwnerContract', projectId: 'boerne', by: '2026-10-09', note: '' } },
  { label: "Cibolo signs Boerne's contract in their portal", action: { type: 'ownerSignContract', projectId: 'boerne' } },
  // The weekly report to the customer (Building lane, 2026-10-05): Fair Oaks D's week, from me.
  {
    label: "Send Elena Fair Oaks D's weekly report",
    action: {
      type: 'sendWeeklyReport',
      projectId: 'fairoaksd',
      weekOf: '2026-09-28',
      from: 'me',
      by: 'Robert Douglas',
      copyArchitect: false,
      subject: 'Fair Oaks Shops, Building D · week of Sep 28',
      body: "Hi Elena,\n\nHere's where Fair Oaks Shops, Building D stands this week.\n\nThanks,\nRobert Douglas\nClick Construction",
    },
  },
  // Questions about the plans while we build, RFIs (the owner, 2026-10-05: yes to all four).
  { label: 'Fair Oaks D: send RFI-004, the roof curb size, to Marsh & Vale', action: { type: 'sendRfiToArchitect', projectId: 'fairoaksd', rfiId: 'fairoaksd-rfi-4' } },
  {
    label: 'Fair Oaks D: Marsh & Vale answers RFI-004, the bigger curb, $1,400 and a day',
    action: { type: 'answerRfi', projectId: 'fairoaksd', rfiId: 'fairoaksd-rfi-4', text: 'Set the 54 by 72 curb. A bulletin follows.', by: 'architect', impact: 'cost', cost: 1_400, days: 1 },
  },
  { label: 'Fair Oaks D: RFI-004 starts a change order', action: { type: 'draftChangeOrderFromRfi', projectId: 'fairoaksd', rfiId: 'fairoaksd-rfi-4' } },
  // Fair Oaks D is closed by now in the walk, so the new questions are on Helotes, being built.
  {
    label: 'Helotes: Brightline asks about the panel location from its portal',
    action: { type: 'tradeAskRfi', projectId: 'helotes', packageId: 'delec', partnerId: 'brightline', question: 'E-101 puts panel B behind the reception desk. Can it move to the back hall?', sheets: ['E-101'] },
  },
  {
    label: 'Helotes: our superintendent asks which way the operatory 2 door swings',
    action: { type: 'addRfi', projectId: 'helotes', question: 'Which way does the operatory 2 door swing? A-101 and A-601 differ.', sheets: ['A-101', 'A-601'], packageId: null, partnerId: null, holds: [], neededDays: 3 },
  },
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
    // Each to-do's trade only drives the trade headings (gcBench.test.ts holds it), so it stays out of the walk.
    assistantRules: assistantRules(state).map((r) => ({
      ...r,
      items: r.items.map((item) => {
        const { trade, ...rest } = item
        void trade
        return rest
      }),
    })),
    // Question 3 and question 8 (the owner, 2026-10-04): who waits on vetting, whose insurance to chase,
    // and every promise other than a quote date with where it stands.
    toVet: partnersToVet(state).map((p) => ({ id: p.id, words: vettingWords(p) })),
    insuranceRenewals: insuranceRenewals(state).map((r) => ({ id: r.partner.id, days: r.days, promise: r.promise?.id ?? null })),
    tradePromises: tradePromisesOf(state).map((p) => ({ id: p.id, words: tradePromiseWords(p, state.today) })),
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
    used.add('remindCustomerToPay') // played in its own test below: the walk's late bill gets a promise first
    used.add('undoScheduleMove') // played in gcScheduleMoves.test.ts: it needs a move saved with its explanation first
    used.add('recordScheduleWalk') // played in gcScheduleWalk.test.ts: the weekly walk, which ends a sitting of moves
    used.add('tellTradesMoves') // played in gcTellTrades.test.ts: it needs a move saved with its explanation first
    used.add('tradeAnswerDates') // played in gcTellTrades.test.ts: it needs a move the company was told of
    used.add('addScheduleWait') // played in gcScheduleWaits.test.ts: what the work waits on, from outside the trades
    used.add('setScheduleWaitStep') // played in gcScheduleWaits.test.ts
    used.add('removeScheduleWait') // played in gcScheduleWaits.test.ts
    used.add('addScheduleActivity') // played in gcAddedActivity.test.ts: an activity that is no trade's line
    used.add('setAddedActivityDone') // played in gcAddedActivity.test.ts
    used.add('removeScheduleActivity') // played in gcAddedActivity.test.ts
    used.add('setActualDates') // played in gcActualDates.test.ts
    used.add('setScheduleBaseline') // played in gcBaseline.test.ts: it needs a signed change order's days on the schedule first
    used.add('redoScheduleMove') // played in gcScheduleMoves.test.ts: it needs a move undone first
    used.add('sendCustomerSchedule') // played in gcCustomerScheduleSend.test.ts
    used.add('tradeSayLate') // played in gcLateNotices.test.ts: a trade says it will be late (G-117)
    used.add('pushBackLateNotice') // played in gcLateNotices.test.ts: it needs a notice sent first
    used.add('tradeKeepDay') // played in gcLateNotices.test.ts: it needs a notice pushed back first
    used.add('pullScheduleEarlier') // played in gcPullEarlier.test.ts: it needs work that finished early first
    used.add('setRough') // played in gcRoughSchedule.test.ts: a rough schedule while we bid (G-45), on a job the walk does not bid
    used.add('recoverScheduleDays') // played in gcRecovery.test.ts: it needs a job past its contract first
    used.add('startWhatIf') // played in gcWhatIf.test.ts: a what-if copy of the schedule (G-81)
    used.add('inWhatIf') // played in gcWhatIf.test.ts: it needs a copy open
    used.add('keepWhatIf') // played in gcWhatIf.test.ts: it needs moves tried in a copy
    used.add('throwAwayWhatIf') // played in gcWhatIf.test.ts: it needs a copy open
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
      'architectCertify',
      'ownerPayPart', 'ownerPromisePay',
      'sendDrawBack',
      'closeJob', 'approveDrawLess', 'selfReportStage',
      'draftSchedule', 'setScheduleActivity', 'setScheduleMilestone', 'removeScheduleMilestone',
      'verifyLookAhead', 'crewMarkLookAhead',
      'sendTradeChange', 'tradeSignChange',
      'passInspection',
      'addPunchItem', 'tradeFixPunchItem', 'checkPunchItem',
      'failInspection',
      'saveDailyLog',
      'addSubmittal', 'tradeSendSubmittal', 'sendSubmittalToArchitect', 'answerSubmittal', 'sendWeeklyReport',
      'tradeOpenPortal',
      'tradeAnswerLines',
      'priceOwnBid',
      'tradeAskQuestion', 'sendQuestionToArchitect', 'answerQuestion',
      'tradeMarkLookAhead',
      'tradeSetLanguage',
      'setPartnerLanguage',
      'markLost', 'reopenLost',
      'takeAlternate',
      'vetPartner', 'tradeVettingForm', 'recordPromise', 'keepPromise',
      'setOwnerRetainageStep',
      'setOwnerLateInterest', 'sendOwnerInterestBill', 'ownerPaidInterest',
      'setOwnerLateFinish',
      'schedulePreBid', 'recordPreBidAttendance',
      'saveToScopeBook', 'editScopeBookLine', 'mergeScopeBookLines', 'saveScopeSet',
      'checkPlanSetDrive',
      'tradeSendSov',
      'setQuoteExclusion', 'setExclusionCover', 'logPartnerContact', 'setCustomerPortal', 'sendPaper', 'remindCustomer', 'sendOwnerContract', 'ownerSignContract',
      'remindCustomerToPay',
      'undoScheduleMove', 'recordScheduleWalk', 'tellTradesMoves', 'tradeAnswerDates',
      'addRfi', 'tradeAskRfi', 'sendRfiToArchitect', 'answerRfi', 'draftChangeOrderFromRfi',
      'addScheduleWait', 'setScheduleWaitStep', 'removeScheduleWait',
      'addScheduleActivity', 'setAddedActivityDone', 'removeScheduleActivity',
      'setActualDates', 'setScheduleBaseline', 'redoScheduleMove',
      'sendCustomerSchedule',
      'tradeSayLate', 'pushBackLateNotice', 'tradeKeepDay',
      'pullScheduleEarlier',
      'setRough',
      'recoverScheduleDays',
      'startWhatIf', 'inWhatIf', 'keepWhatIf', 'throwAwayWhatIf',
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

  // A payment reminder (Owner Billing, the owner 2026-10-04) needs a bill past its day. The walk's
  // one late bill, Cibolo's pay application 3, gets a promise before the end, so the reminder is
  // played from the start here instead of mid-walk (which would renumber every step).
  it("a payment reminder on Cibolo's late pay application 3, from the start", () => {
    const before = stateAt(0)
    const after = gcReducer(before, { type: 'remindCustomerToPay', projectId: 'fairoaksd', number: 3, by: '2026-10-07', note: 'Call me with any question.' })
    expect(after).not.toBe(before)
    const project = after.projects.find((p) => p.id === 'fairoaksd')
    const bill = project?.ownerBilling?.payApps?.find((a) => a.number === 3)
    expect({
      readings: moved(before, after),
      reminders: bill?.reminders,
      sentWords: project ? payReminderSentWords(after, project, 3) : null,
      nextStep: project ? payReminderStep(after, project, 3) : null,
    }).toMatchSnapshot()
  })
})
