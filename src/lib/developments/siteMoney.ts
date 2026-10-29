/**
 * The Money look (punch list #208, design spike; the owner's pick A1 with S1 of
 * `site-progress-ac-mockup.html` and `site-money-sort-mockup.html`): the Pipeline's progress and
 * pay cell at the scale of a whole development. The band is the site's sum (the percent done
 * weighted by value, the bar of paid · billed · done-not-billed · left, the jobs by stage); under it
 * the live jobs in stage sections, each row the cell laid across (progress, money, dates, next),
 * sorted inside its section, the paid jobs one folded section. Pure: the component draws, the
 * device remembers folds and settings (`devicePrefs.ts`).
 */
import { billedExpectedPayModel, type ExpectedPayModel, type PaySpeedData } from '../jobs/billedExpectedPay'
import { daysBetweenYmd, lienByForJob } from '../jobs/lienPayRunway'
import { jobsLedgerStatusDotColor, normalizeJobsLedgerStatus } from '../jobsLedgerStatusPipeline'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { bidMoney, bidUndecided, type MemberJob, type Members } from './overview'

export type MoneySortMode = 'tightest' | 'progress' | 'left' | 'number'

export const MONEY_SORT_MODES: MoneySortMode[] = ['tightest', 'progress', 'left', 'number']

/** The chip's words beside *Sorted:* and the phone's Order row. */
export const MONEY_SORT_LABELS: Record<MoneySortMode, string> = {
  tightest: 'tightest first',
  progress: '% complete',
  left: 'most left',
  number: 'job number',
}

/** The column head that sets each order. */
export const MONEY_SORT_COLUMN: Record<MoneySortMode, 'job' | 'progress' | 'money' | 'dates'> = { tightest: 'dates', progress: 'progress', left: 'money', number: 'job' }

/** As the Pipeline does it: an order that is a setting is kept on the device; a look is forgotten on leaving. */
export const MONEY_SORT_IS_SETTING: ReadonlySet<MoneySortMode> = new Set<MoneySortMode>(['tightest', 'number'])

export type MoneyDates = {
  billedYmd: string | null
  billedAgoDays: number | null
  expected: ExpectedPayModel | null
  lien: { ymd: string; daysLeft: number | null; kindAssumed: boolean } | null
}

export type MoneyRow = {
  key: string
  jobId: string
  number: string
  name: string
  stageKey: string
  stageWord: string
  stageColor: string
  crew: string | null
  lastWorkYmd: string | null
  /** 0–100, the paid ones at 100, null when nothing is on record. */
  pct: number | null
  value: number
  paid: number
  /** Billed and not yet paid (the open remainder on a billed job). */
  billed: number
  /** Work done past what is paid or billed, by the percent, on a job not yet billed. */
  doneNotBilled: number
  /** The Pipeline's *Left on Job*: the value less what was paid. */
  left: number
  dates: MoneyDates | null
  next: { askForDate: boolean; notice: boolean; words: string | null }
}

export type MoneySection = {
  key: string
  label: string
  color: string
  rows: MoneyRow[]
  sums: { count: number; left: number; pastDue: number; doneNotBilled: number; paid: number }
  /** Paid starts folded; the device may change it. */
  defaultFolded: boolean
}

export type MoneyBand = {
  /** Each job's percent weighted by its value, the paid at 100; null while a live job with a value has no percent on record, as the cell's own box reads *—*. */
  pct: number | null
  /** Live jobs with a value and no percent on record: the reason the band's percent is missing. */
  pctMissing: number
  value: number
  paid: number
  billed: number
  doneNotBilled: number
  left: number
  jobs: number
  pastDue: number
  stages: Array<{ key: string; label: string; count: number; color: string }>
  bidUndecidedUsd: number
  bidUndecidedCount: number
}

export type SiteMoneyModel = { band: MoneyBand; sections: MoneySection[] }

export type SiteMoneyInputs = {
  members: Members
  invoices: ReadonlyArray<{ id: string; job_id: string; amount: number; status: string; billed_at: string | null; sent_to_customer_at: string | null }>
  names: ReadonlyMap<string, string>
  teamMembers: ReadonlyArray<{ job_id: string; user_id: string }>
  jobLabel: (j: MemberJob) => string
  paySpeed: PaySpeedData | null
  todayYmd: string
}

const SECTION_ORDER = ['billed', 'ready_to_bill', 'working', 'waiting', 'other', 'paid']
const SECTION_LABEL: Record<string, string> = { billed: 'Billed', ready_to_bill: 'Ready to bill', working: 'Working', waiting: 'Waiting', other: 'Other', paid: 'Paid' }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function crewWords(job: MemberJob, inp: SiteMoneyInputs): string | null {
  const names: string[] = []
  for (const tm of inp.teamMembers) {
    if (tm.job_id !== job.id) continue
    const n = inp.names.get(tm.user_id)
    if (n && !names.includes(n)) names.push(n)
  }
  if (names.length === 0) return null
  return `${names[0]}${names.length > 1 ? `, +${names.length - 1}` : ''}`
}

function datesFor(job: MemberJob, inp: SiteMoneyInputs): MoneyDates {
  const bills = inp.invoices.filter((i) => i.job_id === job.id && (i.status ?? '').toLowerCase() !== 'void' && i.billed_at).sort((a, b) => (b.billed_at ?? '').localeCompare(a.billed_at ?? ''))
  const newest = bills[0] ?? null
  const billedYmd = newest?.billed_at ? calendarYmdInAppTzFromIso(newest.billed_at) : job.last_bill_date ? job.last_bill_date.slice(0, 10) : null
  const billedAgoDays = billedYmd ? daysBetweenYmd(billedYmd, inp.todayYmd) : null
  const expected = billedExpectedPayModel(
    { billedAtIso: newest?.billed_at ?? null, estBillYmd: job.last_bill_date ? job.last_bill_date.slice(0, 10) : null, customerId: job.gc_customer_id ?? job.customer_id, payerName: job.customer_name },
    inp.paySpeed,
    inp.todayYmd,
  )
  const lienBy = lienByForJob(job.last_work_date, '')
  const lien = lienBy.ymd ? { ymd: lienBy.ymd, daysLeft: daysBetweenYmd(inp.todayYmd, lienBy.ymd), kindAssumed: lienBy.kindAssumed } : null
  return { billedYmd, billedAgoDays, expected, lien }
}

function rowFor(job: MemberJob, inp: SiteMoneyInputs): MoneyRow {
  const stageKey = normalizeJobsLedgerStatus(job.status) ?? 'other'
  const value = Math.max(0, job.revenue ?? 0)
  const paidRaw = Math.max(0, job.payments_made ?? 0)
  const isPaid = stageKey === 'paid'
  const isBilled = stageKey === 'billed'
  const paid = isPaid ? Math.max(paidRaw, value) : Math.min(paidRaw, value)
  const billed = isBilled ? Math.max(0, value - paid) : 0
  const pct = isPaid ? 100 : job.pct_complete != null ? clamp(Math.round(job.pct_complete), 0, 100) : null
  const doneNotBilled = !isPaid && !isBilled && pct != null ? Math.max(0, (pct / 100) * value - paid) : 0
  const left = Math.max(0, value - paid)
  const dates = isBilled ? datesFor(job, inp) : null
  const askForDate = !!dates?.expected && dates.expected.state === 'late'
  const notice = !!dates?.lien
  let words: string | null = null
  if (!isBilled && !isPaid) {
    const crew = crewWords(job, inp)
    if (stageKey === 'waiting' && !crew) words = 'not scheduled'
  }
  return {
    key: `job:${job.id}`,
    jobId: job.id,
    number: inp.jobLabel(job),
    name: (job.job_name ?? '').trim(),
    stageKey,
    stageWord: SECTION_LABEL[stageKey] ?? 'Other',
    stageColor: jobsLedgerStatusDotColor(job.status),
    crew: crewWords(job, inp),
    lastWorkYmd: job.last_work_date ? job.last_work_date.slice(0, 10) : null,
    pct,
    value,
    paid,
    billed,
    doneNotBilled,
    left,
    dates,
    next: { askForDate, notice, words },
  }
}

function numberKey(label: string): number {
  const m = /(\d+)/.exec(label)
  return m ? Number(m[1]) : 0
}

/**
 * The order inside a section. *tightest first* is the default and means what needs you first: in
 * Billed the shortest lien runway, then the longest past the expected day; elsewhere the last work,
 * newest first; in Paid the number. The other three are the column heads' orders, the same in every section.
 */
export function sortMoneyRows(rows: readonly MoneyRow[], mode: MoneySortMode, sectionKey: string): MoneyRow[] {
  const out = [...rows]
  const byNumberDesc = (a: MoneyRow, b: MoneyRow) => numberKey(b.number) - numberKey(a.number)
  switch (mode) {
    case 'progress':
      out.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || byNumberDesc(a, b))
      break
    case 'left':
      out.sort((a, b) => b.left - a.left || byNumberDesc(a, b))
      break
    case 'number':
      out.sort(byNumberDesc)
      break
    default:
      if (sectionKey === 'billed') {
        out.sort((a, b) => {
          const la = a.dates?.lien?.daysLeft ?? 100_000
          const lb = b.dates?.lien?.daysLeft ?? 100_000
          if (la !== lb) return la - lb
          const ea = a.dates?.expected?.daysLate ?? -1
          const eb = b.dates?.expected?.daysLate ?? -1
          if (ea !== eb) return eb - ea
          return byNumberDesc(a, b)
        })
      } else if (sectionKey === 'paid') {
        out.sort(byNumberDesc)
      } else {
        out.sort((a, b) => (b.lastWorkYmd ?? '').localeCompare(a.lastWorkYmd ?? '') || byNumberDesc(a, b))
      }
  }
  return out
}

export function buildSiteMoney(inp: SiteMoneyInputs): SiteMoneyModel {
  const rows = inp.members.jobs.map((j) => rowFor(j, inp))
  const byStage = new Map<string, MoneyRow[]>()
  for (const r of rows) {
    const list = byStage.get(r.stageKey) ?? []
    list.push(r)
    byStage.set(r.stageKey, list)
  }
  const keys = [...byStage.keys()].sort((a, b) => (SECTION_ORDER.indexOf(a) === -1 ? 4 : SECTION_ORDER.indexOf(a)) - (SECTION_ORDER.indexOf(b) === -1 ? 4 : SECTION_ORDER.indexOf(b)))
  const sections: MoneySection[] = keys.map((key) => {
    const list = byStage.get(key) ?? []
    return {
      key,
      label: SECTION_LABEL[key] ?? 'Other',
      color: list[0]?.stageColor ?? 'var(--text-faint)',
      rows: list,
      sums: {
        count: list.length,
        left: list.reduce((s, r) => s + r.left, 0),
        pastDue: list.filter((r) => r.next.askForDate).length,
        doneNotBilled: list.reduce((s, r) => s + r.doneNotBilled, 0),
        paid: list.reduce((s, r) => s + r.paid, 0),
      },
      defaultFolded: key === 'paid',
    }
  })
  const value = rows.reduce((s, r) => s + r.value, 0)
  const pctMissing = rows.filter((r) => r.pct == null && r.value > 0).length
  const weighted = rows.reduce((s, r) => s + (r.pct ?? 0) * r.value, 0)
  const undecided = inp.members.bids.filter(bidUndecided)
  const band: MoneyBand = {
    pct: value > 0 && pctMissing === 0 ? Math.round(weighted / value) : null,
    pctMissing,
    value,
    paid: rows.reduce((s, r) => s + r.paid, 0),
    billed: rows.reduce((s, r) => s + r.billed, 0),
    doneNotBilled: rows.reduce((s, r) => s + r.doneNotBilled, 0),
    left: rows.reduce((s, r) => s + r.left, 0),
    jobs: rows.length,
    pastDue: rows.filter((r) => r.next.askForDate).length,
    stages: sections.map((s) => ({ key: s.key, label: s.label, count: s.rows.length, color: s.color })),
    bidUndecidedUsd: undecided.reduce((s, b) => s + (bidMoney(b) ?? 0), 0),
    bidUndecidedCount: undecided.length,
  }
  return { band, sections }
}

/** The strip's words for the Money look: the plain count and, in amber, the bills past due. */
export function moneyLookWords(model: SiteMoneyModel, money: (n: number) => string): { count: string; need: string | null } {
  const b = model.band
  if (b.jobs === 0) return { count: 'no job yet', need: null }
  return { count: `${money(b.left)} left`, need: b.pastDue > 0 ? `${b.pastDue} ${b.pastDue === 1 ? 'bill' : 'bills'} past due` : null }
}
