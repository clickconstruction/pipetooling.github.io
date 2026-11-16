/**
 * What makes up what we owe each sub (punch list #346, PR 1): one person's open money as jobs, the sheets on each
 * job, and under a sheet its lines, payments and back-charges, with sums that are checked in sight.
 *
 * People → Subs showed one figure per sub. This turns the sheets the page already reads into the figure's parts,
 * and the same sheets the other way round for a job's window (`buildJobOwedBlock`): the job, then each person,
 * then each sheet. One kernel, so the row on People → Subs, the phone's sheet and the job's block cannot disagree.
 *
 * A sheet's money is `subLaborJobBalance`, as on every other screen. Whose a sheet is comes in already resolved
 * (`sheetParties`), and who is OWED is `sheetOwedTo` under the rule handed in (`teamSheetRule.ts`), so this kernel
 * counts nothing a different way by itself.
 *
 * Pure: no React, no Supabase.
 */
import type { LaborJob } from '../../types/laborJob'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lineLaborCost } from '../peopleLaborJobItemLineCost'
import { subLaborJobBalance } from '../subLaborOutstanding'
import { escapeCsvField } from '../domTableToCsv'
import type { SheetParties } from '../subWorkOrders/sheetParties'
import type { SheetPayWhen } from '../subWorkOrders/subLaborPayRun'
import { ledgerDayWords, paymentDay } from '../subWorkOrders/subPaymentsLedger'
import { subPayMethodWords, SUB_PAY_FROM_CREDIT } from '../subWorkOrders/subPaymentWindow'
import { sheetOwedTo, TEAM_SHEET_RULE, type SheetOwedToKind, type TeamSheetRule } from '../subWorkOrders/teamSheetRule'

const cents = (n: number): number => Math.round(n * 100) / 100
export const owedMoney = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

export type OwedSheetInput = {
  sheet: Pick<LaborJob, 'id' | 'assigned_to_name' | 'job_number' | 'job_ledger_id' | 'address' | 'labor_rate' | 'job_date' | 'created_at' | 'items' | 'payments'>
  parties: SheetParties
  /** Where the sheet's money stands, in the Pay view's own words; null when the page did not read it. */
  payWhen: Pick<SheetPayWhen, 'kind' | 'label' | 'detail' | 'tone'> | null
  /** The Pipeline job the sheet is on, and its name; null and '' for a sheet that is on none. */
  jobId: string | null
  jobName: string
}

export type OwedTotals = { agreed: number; paid: number; backcharged: number; open: number }

export type OwedLine = { label: string; amount: number }

export type OwedMoneyLine = {
  id: string
  kind: 'payment' | 'backcharge'
  /** `YYYY-MM-DD`: the Date sent, else the day it was recorded; '' when it has neither. */
  ymd: string
  recorded: boolean
  /** Always above zero: what the line takes off the sheet. */
  amount: number
  /** `Paid Oct 31 · Check 1182`, `Back-charge Nov 2 · cleanup`. */
  words: string
}

export type OwedSheet = OwedTotals & {
  id: string
  /** The day the sheet is dated: its job date, else the day it was made. */
  day: string
  /** `Sheet of Oct 28`. */
  title: string
  owedKind: SheetOwedToKind
  /** Teammates named on a sub's sheet. */
  withNames: string[]
  payWhen: OwedSheetInput['payWhen']
  /** Paid past its total by this much; zero otherwise. An over-paid sheet is open by nothing. */
  over: number
  /** Nothing is open on it. */
  settled: boolean
  lines: OwedLine[]
  money: OwedMoneyLine[]
  /** True when the sheet has no priced line and its total was read back from the money moved. */
  reconstructed: boolean
  /** The job it sits under. */
  jobKey: string
}

export type OwedJob = OwedTotals & {
  key: string
  /** The Pipeline job's id, for the job's window; null for a sheet tied to no job. */
  jobId: string | null
  number: string
  name: string
  address: string
  sheets: OwedSheet[]
}

export type OwedPerson = {
  key: string
  personId: string | null
  name: string
  kind: 'sub' | 'team'
  /** Every sheet that is this person's, open and settled. */
  sheets: OwedSheet[]
  jobsByKey: Map<string, Pick<OwedJob, 'key' | 'jobId' | 'number' | 'name' | 'address'>>
}

export type OwedView = OwedTotals & {
  show: 'open' | 'paid'
  jobs: OwedJob[]
  sheetCount: number
  jobCount: number
  /** Open money on sheets the Pay view calls ready. */
  ready: number
  readySheets: number
}

export type SubOwedBreakdown = {
  people: Map<string, OwedPerson>
  /** Sheets counted once, on nobody's row: two subs, or several teammates and no sub under `owed`. */
  shared: OwedSheet[]
  /** Sheets with no sub, under `payroll`: owed to nobody. */
  payroll: OwedSheet[]
  rule: TeamSheetRule
}

function jobKeyOf(i: OwedSheetInput): string {
  if (i.jobId) return `job:${i.jobId}`
  const n = (i.sheet.job_number ?? '').trim().toLowerCase()
  if (n) return `no:${n}`
  return `addr:${(i.sheet.address ?? '').trim().toLowerCase()}`
}

function sheetDay(s: OwedSheetInput['sheet']): string {
  const d = (s.job_date ?? '').slice(0, 10)
  if (d) return d
  return s.created_at ? calendarYmdInAppTzFromIso(s.created_at).slice(0, 10) : ''
}

/** One sheet as the block draws it. */
export function owedSheet(i: OwedSheetInput, rule: TeamSheetRule = TEAM_SHEET_RULE): OwedSheet {
  const bal = subLaborJobBalance(i.sheet)
  const rate = i.sheet.labor_rate ?? 0
  const lines: OwedLine[] = (i.sheet.items ?? []).map((it) => ({ label: (it.fixture ?? '').trim() || 'A line', amount: cents(lineLaborCost(it, rate)) }))
  const pricedTotal = lines.reduce((n, l) => n + l.amount, 0)
  const reconstructed = pricedTotal === 0 && bal.totalCost > 0
  const money: OwedMoneyLine[] = (i.sheet.payments ?? [])
    .map((p) => ({ p, amount: Number(p.amount), day: paymentDay(p) }))
    .filter((x) => Number.isFinite(x.amount) && x.amount !== 0)
    .sort((a, b) => (a.day?.ymd ?? '9999').localeCompare(b.day?.ymd ?? '9999') || (a.p.created_at ?? '').localeCompare(b.p.created_at ?? ''))
    .map(({ p, amount, day }) => {
      const back = amount < 0
      const dayWords = day ? `${day.recorded ? 'recorded ' : ''}${ledgerDayWords(day.ymd)}` : 'no date'
      const how = back ? '' : p.method === SUB_PAY_FROM_CREDIT ? 'from their credit' : subPayMethodWords(p)
      const memo = (p.memo ?? '').trim()
      const tail = [how, back ? memo : how ? '' : memo].filter(Boolean).join(' · ')
      return { id: p.id, kind: back ? ('backcharge' as const) : ('payment' as const), ymd: day?.ymd ?? '', recorded: day ? day.recorded : false, amount: cents(Math.abs(amount)), words: `${back ? 'Back-charge' : 'Paid'} ${dayWords}${tail ? ` · ${tail}` : ''}` }
    })
  const day = sheetDay(i.sheet)
  const open = cents(Math.max(0, bal.balance))
  return {
    id: i.sheet.id,
    day,
    title: day ? `Sheet of ${ledgerDayWords(day)}` : 'Sheet with no date',
    owedKind: sheetOwedTo(i.parties, rule).kind,
    withNames: i.parties.teammates.map((t) => t.name).filter(Boolean),
    payWhen: i.payWhen,
    agreed: cents(bal.totalCost),
    paid: cents(bal.paid),
    backcharged: cents(bal.backcharges),
    open,
    over: cents(Math.max(0, -bal.balance)),
    settled: open <= 0,
    lines,
    money,
    reconstructed,
    jobKey: jobKeyOf(i),
  }
}

/** Every sheet sorted onto the person it is owed to, or into the shared and payroll lists. */
export function buildSubOwedBreakdown(inputs: readonly OwedSheetInput[], opts: { rule?: TeamSheetRule } = {}): SubOwedBreakdown {
  const rule = opts.rule ?? TEAM_SHEET_RULE
  const people = new Map<string, OwedPerson>()
  const shared: OwedSheet[] = []
  const payroll: OwedSheet[] = []
  for (const i of inputs) {
    const to = sheetOwedTo(i.parties, rule)
    const sheet = owedSheet(i, rule)
    if (to.kind === 'shared') {
      shared.push(sheet)
      continue
    }
    if (to.kind === 'payroll' || to.kind === 'nobody' || !to.person) {
      if (to.kind === 'payroll') payroll.push(sheet)
      else shared.push(sheet)
      continue
    }
    let person = people.get(to.key)
    if (!person) {
      person = { key: to.key, personId: to.person.id, name: to.person.name, kind: to.kind === 'team' ? 'team' : 'sub', sheets: [], jobsByKey: new Map() }
      people.set(to.key, person)
    }
    person.sheets.push(sheet)
    if (!person.jobsByKey.has(sheet.jobKey)) {
      person.jobsByKey.set(sheet.jobKey, { key: sheet.jobKey, jobId: i.jobId, number: (i.sheet.job_number ?? '').trim(), name: i.jobName.trim(), address: (i.sheet.address ?? '').trim() })
    }
  }
  return { people, shared, payroll, rule }
}

/** The person behind a roster row. */
export function owedPersonById(b: SubOwedBreakdown, personId: string): OwedPerson | null {
  return b.people.get(`id:${personId}`) ?? null
}

function sumTotals(sheets: readonly OwedSheet[]): OwedTotals {
  return {
    agreed: cents(sheets.reduce((n, s) => n + s.agreed, 0)),
    paid: cents(sheets.reduce((n, s) => n + s.paid, 0)),
    backcharged: cents(sheets.reduce((n, s) => n + s.backcharged, 0)),
    open: cents(sheets.reduce((n, s) => n + s.open, 0)),
  }
}

/** One person's sheets as jobs: the open ones (the Balance due), or the settled ones (the history). */
export function owedView(person: OwedPerson | null, show: 'open' | 'paid'): OwedView {
  const sheets = (person?.sheets ?? []).filter((s) => (show === 'open' ? !s.settled : s.settled))
  const byJob = new Map<string, OwedSheet[]>()
  for (const s of sheets) byJob.set(s.jobKey, [...(byJob.get(s.jobKey) ?? []), s])
  const jobs: OwedJob[] = [...byJob.entries()].map(([key, list]) => {
    const meta = person?.jobsByKey.get(key) ?? { key, jobId: null, number: '', name: '', address: '' }
    // Oldest sheet first: the order the work was done in.
    const ordered = [...list].sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999') || a.id.localeCompare(b.id))
    return { ...meta, ...sumTotals(ordered), sheets: ordered }
  })
  // Most open first; history newest first.
  jobs.sort((a, b) => (show === 'open' ? b.open - a.open : (b.sheets[b.sheets.length - 1]?.day ?? '').localeCompare(a.sheets[a.sheets.length - 1]?.day ?? '')) || a.name.localeCompare(b.name))
  const ready = sheets.filter((s) => s.payWhen?.kind === 'ready')
  return { show, jobs, ...sumTotals(sheets), sheetCount: sheets.length, jobCount: jobs.length, ready: cents(ready.reduce((n, s) => n + s.open, 0)), readySheets: ready.length }
}

/** `3 sheets · 2 jobs`, the line under the figure in the column. '' when nothing is open. */
export function owedCountWords(v: Pick<OwedView, 'sheetCount' | 'jobCount'>): string {
  return v.sheetCount > 0 ? `${plural(v.sheetCount, 'sheet', 'sheets')} · ${plural(v.jobCount, 'job', 'jobs')}` : ''
}

/** The line under the figure in the roster's column, for one person. */
export function owedUnderFigure(person: OwedPerson | null): string {
  return owedCountWords(owedView(person, 'open'))
}

export type OwedCheck = {
  /** Agreed, less paid, less back-charged, is the open figure. */
  stripAddsUp: boolean
  /** The jobs' sums are the open figure. */
  jobsAddUp: boolean
  /** The open figure is the roster's Balance due; null when no figure was handed in to hold it against. */
  matchesColumn: boolean | null
  /** `3 sheets · $3,800.00 + $2,500.00 = $6,300.00`. */
  sumWords: string
  /** Why the check mark is not drawn; '' when everything agrees. */
  problem: string
}

/**
 * The sums a person can check in sight. The mark is drawn only when all of them hold: a figure that does not add
 * up must say so, never draw a tick beside a number that is off.
 */
export function owedCheck(v: OwedView, balanceDue: number | null | undefined): OwedCheck {
  const stripAddsUp = Math.abs(cents(v.agreed - v.paid - v.backcharged) - v.open) < 0.005
  const jobsSum = cents(v.jobs.reduce((n, j) => n + j.open, 0))
  const jobsAddUp = Math.abs(jobsSum - v.open) < 0.005
  const matchesColumn = balanceDue == null ? null : Math.abs(cents(balanceDue) - v.open) < 0.005
  const parts = v.jobs.map((j) => owedMoney(j.open))
  const sumWords = v.jobs.length === 0 ? 'No sheets' : `${plural(v.sheetCount, 'sheet', 'sheets')} · ${parts.length > 1 ? `${parts.join(' + ')} = ` : ''}${owedMoney(v.open)}`
  const problem = !stripAddsUp
    ? `Agreed less paid less back-charged is ${owedMoney(cents(v.agreed - v.paid - v.backcharged))}, and the sheets say ${owedMoney(v.open)}.`
    : !jobsAddUp
      ? `The jobs sum to ${owedMoney(jobsSum)}, and the sheets say ${owedMoney(v.open)}.`
      : matchesColumn === false
        ? `These sheets sum to ${owedMoney(v.open)}, and the column says ${owedMoney(cents(balanceDue ?? 0))}.`
        : ''
  return { stripAddsUp, jobsAddUp, matchesColumn, sumWords, problem }
}

/** What to say for a sheet that is not open: `paid in full`, or `over by $50.00`. */
export function owedSettledWords(s: Pick<OwedSheet, 'over' | 'agreed'>): string {
  if (s.over > 0) return `over by ${owedMoney(s.over)}`
  return s.agreed > 0 ? 'paid in full' : 'no priced lines'
}

/** `Agreed $4,200.00 · paid $1,500.00 · back-charged $100.00`, the phone card's second line. */
export function owedSheetMoneyWords(s: OwedTotals): string {
  const bits = [`Agreed ${owedMoney(s.agreed)}`, s.paid > 0 ? `paid ${owedMoney(s.paid)}` : 'nothing paid']
  if (s.backcharged > 0) bits.push(`back-charged ${owedMoney(s.backcharged)}`)
  return bits.join(' · ')
}

// ── From a job (PR 4) ─────────────────────────────────────────────────────────────────────────────────────────

export type JobOwedPerson = OwedTotals & { key: string; personId: string | null; name: string; kind: 'sub' | 'team'; sheets: OwedSheet[] }

export type JobOwedSameLine = { label: string; amount: number; sheetIds: string[]; words: string }

export type JobOwedBlock = OwedTotals & {
  people: JobOwedPerson[]
  shared: OwedSheet[]
  /** Sheets with no sub under `payroll`, with the names on each. */
  payroll: Array<{ names: string; sheet: OwedSheet }>
  sheetCount: number
  /** A line with the same words and the same amount on two sheets of the job: one piece of work may be on both. */
  sameLines: JobOwedSameLine[]
  sumWords: string
  addsUp: boolean
}

/** One job's sheets: who is owed what on it. `inputs` are that job's sheets and no others. */
export function buildJobOwedBlock(inputs: readonly OwedSheetInput[], opts: { rule?: TeamSheetRule } = {}): JobOwedBlock {
  const rule = opts.rule ?? TEAM_SHEET_RULE
  const byKey = new Map<string, JobOwedPerson>()
  const shared: OwedSheet[] = []
  const payroll: JobOwedBlock['payroll'] = []
  const counted: OwedSheet[] = []
  const lineSeen = new Map<string, { label: string; amount: number; sheetIds: string[] }>()
  for (const i of inputs) {
    const to = sheetOwedTo(i.parties, rule)
    const sheet = owedSheet(i, rule)
    for (const l of sheet.lines) {
      if (l.amount <= 0) continue
      const k = `${l.label.trim().toLowerCase()}\u0000${l.amount.toFixed(2)}`
      const hit = lineSeen.get(k) ?? { label: l.label, amount: l.amount, sheetIds: [] }
      if (!hit.sheetIds.includes(sheet.id)) hit.sheetIds.push(sheet.id)
      lineSeen.set(k, hit)
    }
    if (to.kind === 'payroll') {
      payroll.push({ names: to.label, sheet })
      continue
    }
    counted.push(sheet)
    if (!to.person || to.kind === 'shared' || to.kind === 'nobody') {
      shared.push(sheet)
      continue
    }
    const p = byKey.get(to.key) ?? { key: to.key, personId: to.person.id, name: to.person.name, kind: to.kind === 'team' ? ('team' as const) : ('sub' as const), sheets: [], agreed: 0, paid: 0, backcharged: 0, open: 0 }
    p.sheets.push(sheet)
    byKey.set(to.key, p)
  }
  const people = [...byKey.values()].map((p) => ({ ...p, sheets: [...p.sheets].sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999')), ...sumTotals(p.sheets) })).sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))
  const totals = sumTotals(counted)
  const sharedOpen = cents(shared.reduce((n, s) => n + s.open, 0))
  const parts = [...people.filter((p) => p.open > 0).map((p) => owedMoney(p.open)), ...(sharedOpen > 0 ? [`${owedMoney(sharedOpen)} shared`] : [])]
  const partsSum = cents(people.reduce((n, p) => n + p.open, 0) + sharedOpen)
  const sameLines: JobOwedSameLine[] = [...lineSeen.values()]
    .filter((l) => l.sheetIds.length > 1)
    .map((l) => ({ ...l, words: `${plural(l.sheetIds.length, 'sheet', 'sheets')} on this job carry the line ${l.label} · ${owedMoney(l.amount)}. Check that one piece of work is not on more than one.` }))
  return {
    ...totals,
    people,
    shared,
    payroll,
    sheetCount: counted.length,
    sameLines,
    sumWords: `${plural(people.length, 'person', 'people')} · ${plural(counted.length, 'sheet', 'sheets')}${parts.length > 0 ? ` · ${parts.length > 1 ? `${parts.join(' + ')} = ` : ''}${owedMoney(totals.open)}` : ''}`,
    addsUp: Math.abs(partsSum - totals.open) < 0.005 && Math.abs(cents(totals.agreed - totals.paid - totals.backcharged) - cents(totals.open - counted.reduce((n, s) => n + s.over, 0))) < 0.005,
  }
}

// ── Reach (PR 5): tiles, search, sort, export ────────────────────────────────────────────────────────────────

export type OwedTiles = {
  /** Every open dollar: the people's rows and the shared sheets. */
  owed: number
  owedPeople: number
  owedSheets: number
  ready: number
  readySheets: number
  /** Open money on nobody's row. */
  shared: number
  sharedSheets: number
  /** Open money on sheets with no sub, under `payroll`: in no figure above. */
  payrollOpen: number
  payrollSheets: number
  /** Open money owed to teammates as sub labor, under `owed`: inside `owed`. */
  teamOpen: number
  rows: number
  /** Rows plus shared is the total. */
  addsUp: boolean
}

export function owedTiles(b: SubOwedBreakdown): OwedTiles {
  let rows = 0
  let ready = 0
  let readySheets = 0
  let owedPeople = 0
  let owedSheets = 0
  let teamOpen = 0
  for (const p of b.people.values()) {
    const v = owedView(p, 'open')
    rows = cents(rows + v.open)
    ready = cents(ready + v.ready)
    readySheets += v.readySheets
    owedSheets += v.sheetCount
    if (v.open > 0) owedPeople += 1
    if (p.kind === 'team') teamOpen = cents(teamOpen + v.open)
  }
  const sharedOpenSheets = b.shared.filter((s) => !s.settled)
  const shared = cents(sharedOpenSheets.reduce((n, s) => n + s.open, 0))
  const payrollOpenSheets = b.payroll.filter((s) => !s.settled)
  const owed = cents(rows + shared)
  return {
    owed,
    owedPeople,
    owedSheets: owedSheets + sharedOpenSheets.length,
    ready,
    readySheets,
    shared,
    sharedSheets: sharedOpenSheets.length,
    payrollOpen: cents(payrollOpenSheets.reduce((n, s) => n + s.open, 0)),
    payrollSheets: payrollOpenSheets.length,
    teamOpen,
    rows,
    addsUp: Math.abs(cents(rows + shared) - owed) < 0.005,
  }
}

/** Does a person match the search box: their name, or a job they have a sheet on (its number, name or address). */
export function owedPersonMatches(name: string, person: OwedPerson | null, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (name.toLowerCase().includes(q)) return true
  for (const j of person?.jobsByKey.values() ?? []) {
    if (j.number.toLowerCase().includes(q) || j.name.toLowerCase().includes(q) || j.address.toLowerCase().includes(q)) return true
  }
  return false
}

export const OWED_SORTS = ['owed', 'name', 'ready', 'worked'] as const
export type OwedSort = (typeof OWED_SORTS)[number]
export const OWED_SORT_LABEL: Record<OwedSort, string> = { owed: 'Most owed', name: 'Name', ready: 'Ready to pay', worked: 'Last worked' }

export const OWED_CSV_HEAD: ReadonlyArray<string> = ['Paid to', 'Kind', 'Job number', 'Job', 'Address', 'Sheet dated', 'Where it stands', 'Agreed', 'Paid', 'Back-charged', 'Still open']

/** What is on screen, one row per open sheet. The Still open column sums to the tile. */
export function owedCsv(people: readonly OwedPerson[]): string {
  const rows: string[][] = [[...OWED_CSV_HEAD]]
  for (const p of people) {
    for (const j of owedView(p, 'open').jobs) {
      for (const s of j.sheets) {
        rows.push([p.name, p.kind === 'team' ? 'Team, sub labor' : 'Sub', j.number, j.name, j.address, s.day, s.payWhen?.label ?? '', s.agreed.toFixed(2), s.paid.toFixed(2), s.backcharged.toFixed(2), s.open.toFixed(2)])
      }
    }
  }
  return rows.map((r) => r.map((c) => escapeCsvField(c)).join(',')).join('\n')
}

export function owedCsvFileName(todayYmd: string): string {
  return `what-we-owe-subs-${todayYmd}.csv`
}
