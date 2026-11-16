/**
 * SPIKE ONLY (2026-11-15, punch list #346 and #350): made-up subs, jobs and sheets, so every screenshot of the
 * prototypes shows no real name or amount. The real components are mounted over these on `/spike-sub-labor.html`.
 * Deleted at wrap-up.
 */
import type { LaborJob, LaborJobPayment } from '../types/laborJob'
import type { OwedSheetInput } from '../lib/people/subOwedBreakdown'
import type { NeedsWorkOrderRosterPerson } from '../lib/subWorkOrders/rosterSub'
import { buildSheetPartiesLookup, sheetParties } from '../lib/subWorkOrders/sheetParties'
import type { SheetPayWhen } from '../lib/subWorkOrders/subLaborPayRun'

export const SPIKE_TODAY = '2026-11-13'

export const SPIKE_ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'harlan', name: 'Harlan Mechanical', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'ridgeline', name: 'Ridgeline Coring LLC', kind: 'sub', accountRole: null },
  { id: 'marlow', name: 'Marlow Tile', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'dana', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
  { id: 'owen', name: 'Owen Farris', kind: 'helper', accountRole: 'helpers' },
]

const lookup = buildSheetPartiesLookup(SPIKE_ROSTER)

const PW = {
  ready: { kind: 'ready', label: 'Ready', detail: 'customer paid', tone: 'green', rank: 0 },
  wait: { kind: 'wait', label: 'Waiting on customer', detail: 'bill 1 of 2 open', tone: 'amber', rank: 2 },
  gap: { kind: 'gap', label: 'Not payable', detail: 'nothing signed', tone: 'red', rank: 6 },
  work: { kind: 'work', label: 'After inspection', detail: 'sub has not said "done"', tone: 'gray', rank: 5 },
  paid: { kind: 'paid', label: 'Paid', detail: 'balance is $0', tone: 'green', rank: 9 },
  crew: { kind: 'crew', label: 'Payroll', detail: 'crew sheet · no work order needed', tone: 'violet', rank: 7 },
  teamReady: { kind: 'ready', label: 'Ready', detail: 'sub labor to a teammate · nothing to wait on', tone: 'green', rank: 0 },
} satisfies Record<string, SheetPayWhen>

type Job = { id: string; number: string; name: string; address: string }
export const SPIKE_JOBS = {
  cedar: { id: 'job-cedar', number: '2041', name: 'Cedar Hollow Clinic', address: '418 Larkspur Ln' },
  ridge: { id: 'job-ridge', number: '2057', name: 'Ridgeway Builders, Lot 12', address: '77 Quarry Rd' },
  pine: { id: 'job-pine', number: '2063', name: 'Pine Street Duplex', address: '9 Pine St' },
  alder: { id: 'job-alder', number: '2033', name: 'Alder Court Remodel', address: '15 Alder Ct' },
  mill: { id: 'job-mill', number: '2049', name: 'Mill Street Bakery', address: '40 Mill St' },
} satisfies Record<string, Job>

type Pay = Partial<LaborJobPayment> & { id: string; amount: number }

function mk(id: string, job: Job, names: string[], day: string, lines: Array<[string, number]>, pays: Pay[] = []): LaborJob {
  return {
    id,
    assigned_to_name: names.map((n) => SPIKE_ROSTER.find((p) => p.id === n)?.name ?? n).join(' | '),
    address: job.address,
    job_number: job.number,
    job_ledger_id: job.id,
    labor_rate: null,
    job_date: day,
    created_at: `${day}T15:00:00Z`,
    stage: 'customer_pay',
    items: lines.map(([fixture, amount]) => ({ fixture, count: 1, hrs_per_unit: 0, direct_labor_amount: amount })),
    payments: pays.map((p) => ({ memo: null, created_at: `${p.payment_date ?? day}T16:00:00Z`, ...p })),
    payment_events: [],
  }
}

export type SpikeSheet = { sheet: LaborJob; job: Job; names: string[]; payWhen: SheetPayWhen; payWhenOwed?: SheetPayWhen }

const J = SPIKE_JOBS
export const SPIKE_SHEETS: SpikeSheet[] = [
  {
    job: J.cedar,
    names: ['harlan', 'dana'],
    payWhen: PW.wait,
    sheet: mk('s-cedar-1', J.cedar, ['harlan', 'dana'], '2026-10-28', [['Rough-in', 2400], ['Top-out', 1800]], [
      { id: 'p-1182', amount: 1500, payment_date: '2026-10-31', method: 'check', method_ref: '1182', sending_id: 'snd-226', sending_no: 226 },
      { id: 'p-231a', amount: 1000, payment_date: '2026-11-12', method: 'zelle', method_ref: '8841', sending_id: 'snd-231', sending_no: 231 },
      { id: 'b-1', amount: -100, payment_date: '2026-11-10', memo: 'cleanup after top-out' },
    ]),
  },
  { job: J.cedar, names: ['harlan'], payWhen: PW.paid, sheet: mk('s-cedar-2', J.cedar, ['harlan'], '2026-11-06', [['Trim', 1200]], [{ id: 'p-231b', amount: 1200, payment_date: '2026-11-12', method: 'zelle', method_ref: '8841', sending_id: 'snd-231', sending_no: 231 }]) },
  { job: J.ridge, names: ['harlan'], payWhen: PW.gap, sheet: mk('s-ridge-1', J.ridge, ['harlan'], '2026-11-03', [['Slab sleeves', 2500]]) },
  { job: J.alder, names: ['harlan'], payWhen: PW.paid, sheet: mk('s-alder-1', J.alder, ['harlan'], '2026-09-22', [['Repipe, two baths', 1800]], [{ id: 'p-1167', amount: 1800, payment_date: '2026-10-03', method: 'check', method_ref: '1167', sending_id: 'snd-212', sending_no: 212 }]) },
  { job: J.cedar, names: ['harlan'], payWhen: PW.ready, sheet: mk('s-cedar-3', J.cedar, ['harlan'], '2026-11-11', [['Set fixtures, exam rooms', 1200]]) },
  { job: J.mill, names: ['ridgeline'], payWhen: PW.work, sheet: mk('s-mill-1', J.mill, ['ridgeline'], '2026-10-30', [['Core four floor sinks', 2150]]) },
  { job: J.cedar, names: ['marlow'], payWhen: PW.wait, sheet: mk('s-cedar-4', J.cedar, ['marlow'], '2026-10-22', [['Top-out', 1800]], [{ id: 'p-900', amount: 900, payment_date: '2026-10-25', method: 'cashapp', method_ref: '$marlowtile' }]) },
  { job: J.pine, names: ['ridgeline', 'marlow'], payWhen: PW.wait, sheet: mk('s-pine-1', J.pine, ['ridgeline', 'marlow'], '2026-11-04', [['Core two slab openings', 500], ['Patch and tile the curb', 300]]) },
  // Sub labor paid to a teammate: flat amounts, no hours, as an incentive bonus is written today.
  { job: J.cedar, names: ['dana'], payWhen: PW.crew, payWhenOwed: PW.teamReady, sheet: mk('s-bonus-1', J.cedar, ['dana'], '2026-11-13', [['Finished the clinic rough a week early', 500]]) },
  { job: J.ridge, names: ['dana'], payWhen: PW.crew, payWhenOwed: PW.teamReady, sheet: mk('s-bonus-2', J.ridge, ['dana'], '2026-11-13', [['No call-backs in October', 200]]) },
  { job: J.mill, names: ['owen'], payWhen: PW.paid, sheet: mk('s-bonus-3', J.mill, ['owen'], '2026-10-20', [['Stayed for the night pour', 150]], [{ id: 'p-b3', amount: 150, payment_date: '2026-10-24', method: 'zelle' }]) },
]

/** The register's rows, as if migration `…_sub_papers.sql` were live. */
export const SPIKE_REGISTER = new Map([
  ['s-alder-1', { number: 'WS-2033-1', revision: 1 }],
  ['s-cedar-1', { number: 'WS-2041-1', revision: 2, replacesCopyOf: '2026-10-29', confirm: { revision: 1, amount: 4200, at: 'Nov 7, 2026 at 3:12 pm', from: 'their portal' } }],
  ['s-cedar-2', { number: 'WS-2041-2', revision: 1 }],
  ['s-ridge-1', { number: 'WS-2057-1', revision: 1 }],
  ['s-cedar-3', { number: 'WS-2041-3', revision: 1 }],
])

export const SPIKE_ASSIGNEES = new Map(SPIKE_SHEETS.map((s) => [s.sheet.id, s.names.map((n) => ({ personId: n, personName: SPIKE_ROSTER.find((p) => p.id === n)!.name }))]))
export const SPIKE_JOB_NAMES: Record<string, string> = Object.fromEntries(Object.values(SPIKE_JOBS).map((j) => [j.id, j.name]))

/** The sheets as `subOwedBreakdown` reads them, under the rule given. */
export function spikeOwedInputs(rule: 'payroll' | 'owed'): OwedSheetInput[] {
  return SPIKE_SHEETS.map((s) => ({
    sheet: s.sheet,
    parties: sheetParties(s.sheet, SPIKE_ASSIGNEES.get(s.sheet.id), lookup),
    payWhen: rule === 'owed' && s.payWhenOwed ? s.payWhenOwed : s.payWhen,
    jobId: s.job.id,
    jobName: s.job.name,
  }))
}

/** The roster's rows around the block, as the page draws them. */
export const SPIKE_ROWS: Array<{ personId: string; name: string; sub: string; status: string; worked: string; badges: Array<[string, 'ok' | 'missing']>; track: string }> = [
  { personId: 'harlan', name: 'Harlan Mechanical', sub: 'office@harlan-mechanical.example', status: 'Active', worked: 'last worked Nov 11', badges: [['Agreement signed', 'ok'], ['COI missing', 'missing']], track: '5 sheets · 2 settled · $100.00 backcharged' },
  { personId: 'ridgeline', name: 'Ridgeline Coring LLC', sub: 'roster only — no login', status: 'Active', worked: 'last worked Oct 30', badges: [['Agreement missing', 'missing']], track: '1 sheet · 0 settled' },
  { personId: 'marlow', name: 'Marlow Tile', sub: 'marlow@marlow-tile.example', status: 'Active', worked: 'last worked Oct 22', badges: [['W-9 ✓', 'ok'], ['COI missing', 'missing']], track: '1 sheet · 0 settled' },
  { personId: 'dana', name: 'Dana Whitlock', sub: 'signs in as a superintendent', status: 'Active', worked: 'last worked Nov 13', badges: [['W-9 missing', 'missing']], track: 'named on 1 sub sheet' },
]
