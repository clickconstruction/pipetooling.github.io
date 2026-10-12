/**
 * The prototype's demo people as the boards read them, for the flows kernels' tests: where each stands
 * at the prototype's clock, Fri Oct 2 2026 (`FLOWS`, `FLOW_STATE`, `GHOSTS`, `jobs` in
 * `to-dos/gc-mode/messages/prototype.html` on spike/gc-mode, v1.178). Demo names only, never a live row.
 * The flows are flows/seed.ts's. The places are written by hand, in flows/state.ts's StepPlace, so the
 * tests exercise the boards and not the reading behind them.
 */
import { daysUntil } from '../gc/words'
import type { BoardCompany, BoardContext } from './board'
import { SEED_FLOWS } from './seed'
import { flat, type FlowDef, type StepPlace } from './state'

export const TODAY = '2026-10-02'

export const TRADE_FLOW: FlowDef = SEED_FLOWS.trade
export const CUSTOMER_FLOW: FlowDef = SEED_FLOWS.customer
export const ARCH_FLOW: FlowDef = SEED_FLOWS.arch

/** The seed's usual per step, standing in for flows/going.ts's read. */
export const USUAL: Record<string, number> = Object.fromEntries([TRADE_FLOW, CUSTOMER_FLOW, ARCH_FLOW].flatMap(flat).map((s) => [s.id, s.usual]))

export const JOBS: Record<string, { name: string }> = {
  boerne: { name: 'Boerne Retail Shell' },
  padb: { name: 'Boerne Retail Pad B' },
  stoneoak: { name: 'Stone Oak Pharmacy' },
  helotes: { name: 'Helotes Dental Office' },
  fairoaks: { name: 'Fair Oaks Shops, Building D' },
  bell: { name: 'Bell Family Dental' },
  oakhills: { name: 'Oak Hills Veterinary' },
  leonvalley: { name: 'Leon Valley Bakery' },
}

export const FIRST_NAMES: Record<string, string> = { greg: 'Greg', bill: 'Bill', tom: 'Tom', elena: 'Elena', priya: 'Priya', jonah: 'Jonah', marcus: 'Marcus' }

const place = (stepId: string, jobId: string | null, p: Partial<StepPlace> = {}): StepPlace => {
  const due = p.due ?? null
  return { stepId, jobId, state: 'now', since: null, due, lateDays: due ? -daysUntil(due, TODAY) : null, waitingOn: null, lapsedPaper: null, ...p }
}

const company = (c: Pick<BoardCompany, 'contactId' | 'name'> & Partial<BoardCompany>): BoardCompany => ({
  personName: null,
  firstName: null,
  trades: [],
  jobIds: [],
  defaultJobId: c.jobIds?.[0] ?? null,
  off: null,
  places: [],
  onceDone: [],
  jobsDone: [],
  ...c,
})

const ALL_ONCE = ['invited', 'portal', 'papers', 'msa']

/**
 * The trade partners, the prototype's contacts then its companies with no thread (g1 to g7).
 * Tejas Power's "Electrical, low voltage" is two trades here, as gc_companies.trades is a list.
 */
export const TRADES: BoardCompany[] = [
  company({
    contactId: 'greg', name: 'Hillside Excavation', personName: 'Greg Paulk', firstName: 'Greg', trades: ['Sitework'], jobIds: ['boerne', 'padb', 'stoneoak'], onceDone: ALL_ONCE,
    places: [
      place('papers', null, { state: 'lapsed', since: '2026-09-30', lapsedPaper: 'coi' }),
      place('ask', 'boerne', { since: '2026-09-22', due: '2026-09-30' }),
      place('ask', 'padb', { since: '2026-09-22', due: '2026-10-22' }),
      place('draws', 'stoneoak'),
    ],
  }),
  company({ contactId: 'bill', name: 'Tejas Power', personName: 'Bill Sorrell', firstName: 'Bill', trades: ['Electrical', 'Low voltage'], jobIds: ['boerne', 'stoneoak'], onceDone: ALL_ONCE, places: [place('compare', 'boerne', { since: '2026-09-29' })] }),
  company({ contactId: 'tom', name: 'Bexar Steel Erectors', personName: 'Tom Riddle', firstName: 'Tom', trades: ['Structural steel'], jobIds: ['boerne'], onceDone: ['invited', 'portal'], places: [place('papers', null, { since: '2026-09-28' })] }),
  company({ contactId: 'g1', name: 'Alamo Steel', trades: ['Structural steel'], jobIds: ['stoneoak'], onceDone: ALL_ONCE, places: [place('sow', 'stoneoak', { since: '2026-09-27' })] }),
  company({ contactId: 'g2', name: 'Rio Paving', trades: ['Paving'], jobIds: ['stoneoak'], onceDone: ALL_ONCE, places: [place('sow', 'stoneoak', { since: '2026-10-01' })] }),
  company({
    contactId: 'g3', name: 'Lone Star Mechanical', trades: ['Mechanical'], jobIds: ['boerne'], onceDone: ['invited', 'portal'],
    places: [place('papers', null, { since: '2026-09-30' }), place('ask', 'boerne', { since: '2026-09-24', due: '2026-10-08' })],
  }),
  company({
    contactId: 'g4', name: 'Cibolo Fence', trades: ['Fencing'], jobIds: ['padb'], onceDone: ['invited', 'portal'],
    places: [place('papers', null, { since: '2026-09-26' }), place('ask', 'padb', { since: '2026-09-29', due: '2026-10-22' })],
  }),
  company({
    contactId: 'g5', name: 'Kerr Electric', trades: ['Electrical'], jobIds: ['boerne', 'stoneoak'], onceDone: ['invited', 'portal', 'papers'],
    places: [place('msa', null, { since: '2026-09-29' }), place('ask', 'boerne', { since: '2026-09-24', due: '2026-10-08' }), place('draws', 'stoneoak', { since: '2026-09-29' })],
  }),
  company({ contactId: 'g6', name: 'Hill Country Paving', trades: ['Paving'], onceDone: ALL_ONCE, off: { since: '2026-08-14', why: 'Do not use: walked off Stone Oak twice.' } }),
  company({ contactId: 'g7', name: 'Medina Drywall', trades: ['Drywall'], onceDone: ['invited'], off: { since: '2026-09-02', why: 'Closed the business.' } }),
]

/**
 * The customers. Elena's pay application stands on Stone Oak Pharmacy, the job being built, where the
 * prototype drew it on her default job, a bid. Oak Hills Veterinary and Leon Valley Bakery each get a
 * job named for them, so the board's rule for a job that carries the customer's own name is tested.
 */
export const CUSTOMERS: BoardCompany[] = [
  company({
    contactId: 'elena', name: 'Cibolo Creek Partners', personName: 'Elena Marchetti', firstName: 'Elena', jobIds: ['boerne', 'padb', 'fairoaks', 'stoneoak'], onceDone: ['agreement'],
    places: [place('payapp', 'stoneoak', { since: '2026-09-28', due: '2026-10-30', waitingOn: { contactId: 'jonah', stepId: 'certify', since: '2026-09-28' } })],
  }),
  company({
    contactId: 'priya', name: 'Helotes Dental Office', personName: 'Dr. Priya Raman', firstName: 'Priya', jobIds: ['helotes'],
    places: [place('start', 'helotes', { since: '2026-09-19' }), place('co', 'helotes', { since: '2026-09-30' })],
  }),
  company({ contactId: 'marcus', name: 'Bell Family Dental', personName: 'Marcus Bell', firstName: 'Marcus', jobIds: ['bell'], off: { since: '2026-09-29', why: 'Declined our bid, went with another plumber.' } }),
  company({ contactId: 'g8', name: 'Oak Hills Veterinary', jobIds: ['oakhills'], places: [place('bid', 'oakhills', { since: '2026-09-28' })] }),
  company({ contactId: 'g9', name: 'Leon Valley Bakery', jobIds: ['leonvalley'], places: [place('yes', 'leonvalley', { since: '2026-09-24' })] }),
  company({ contactId: 'g10', name: 'Castle Hills HOA', off: { since: '2026-09-18', why: 'Declined: price.' } }),
]

/** The architect: the Pond question, Addendum 2 filed today, and Elena's pay application 4 waiting on his certificate. */
export const ARCHITECTS: BoardCompany[] = [
  company({
    contactId: 'jonah', name: 'Marsh & Vale Architects', personName: 'Jonah Vale', firstName: 'Jonah', jobIds: ['boerne', 'padb', 'stoneoak'],
    places: [place('questions', 'boerne', { since: '2026-10-02', due: '2026-10-05' }), place('addenda', 'boerne', { since: '2026-10-02' }), place('certify', 'stoneoak', { since: '2026-09-28' })],
  }),
]

export const contextFor = (flow: FlowDef): BoardContext => ({ flow, jobs: JOBS, usual: USUAL, firstNames: FIRST_NAMES, today: TODAY })
