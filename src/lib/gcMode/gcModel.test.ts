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
