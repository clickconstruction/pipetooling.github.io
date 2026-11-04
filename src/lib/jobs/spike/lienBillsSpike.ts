import type { JobWithDetails } from '../../../types/jobWithDetails'
import { lienClaimBills, type LienClaimBill } from '../lienClaimBills'
import { lienAddressKey, type LienCalendarAxis, type LienCalendarJob } from '../lienCalendar'
import { lienSameProperty, type LienCalendarRow } from '../lienCalendarBuckets'
import type { LienPayRunway, LienRunwayNoticeMonth } from '../lienPayRunway'
import { formatUsdNoCents } from '../jobFormatting'

/**
 * SPIKE (2026-11-04, `to-dos/lien-deadlines-bills-spike/SPIKE.md`): the bills behind the Deadlines
 * board's job rows, grouped under each GC by customer-and-property. Kernels only; the board draws
 * them behind a dev-only toggle (shape A: a nested table under the property; shape B: marks on the
 * job's own row). Nothing here is read by the shipped desk. Built on the desk's own rules:
 * `lienClaimBills` for each bill's billed / paid / owed (the one payment rule), `lienSameProperty`
 * for which jobs share a property, the runway's `noticeMonths` for which notice names a bill's month.
 */

export type SpikeBillShape = 'off' | 'A' | 'B'
export const SPIKE_BILLS_STORAGE_KEY = 'lienSpikeBills'

export function readSpikeBillShape(storage: Pick<Storage, 'getItem'> | null | undefined): SpikeBillShape {
  try {
    const v = storage?.getItem(SPIKE_BILLS_STORAGE_KEY)
    return v === 'A' || v === 'B' ? v : 'off'
  } catch {
    return 'off'
  }
}

/** One sent bill as the spike reads it: the Months card's bill plus the job it is on and the month on its face. */
export type SpikeBill = LienClaimBill & {
  jobId: string
  /** 'YYYY-MM' of the billed day; '' when the bill carries no day. */
  monthKey: string
  /** A bill marked paid, or billed and paid down to nothing. */
  settled: boolean
}

/** Every sent bill on every job the board could list, keyed by job id — from the rows the Pipeline already holds. */
export function spikeBillsByJob(jobs: ReadonlyArray<JobWithDetails>): Map<string, SpikeBill[]> {
  const out = new Map<string, SpikeBill[]>()
  for (const job of jobs) {
    if (job.status !== 'billed') continue
    let bills: LienClaimBill[] = []
    try {
      bills = lienClaimBills(job)
    } catch {
      bills = []
    }
    if (bills.length === 0) continue
    out.set(
      job.id,
      bills.map((b) => ({ ...b, jobId: job.id, monthKey: b.sentYmd ? b.sentYmd.slice(0, 7) : '', settled: b.owed <= 0 })),
    )
  }
  return out
}

/** Which § 53.056 notice names a bill: the runway's month whose key is the bill's month, else none. */
export type SpikeBillNotice = { state: LienRunwayNoticeMonth['state'] | 'none' | 'no_month'; monthKey: string | null; ymd: string | null }

export function spikeNoticeFor(bill: Pick<SpikeBill, 'monthKey'>, runway: Pick<LienPayRunway, 'noticeMonths'> | null | undefined): SpikeBillNotice {
  if (!bill.monthKey) return { state: 'no_month', monthKey: null, ymd: null }
  const m = runway?.noticeMonths.find((n) => n.key === bill.monthKey)
  return m ? { state: m.state, monthKey: m.key, ymd: m.ymd } : { state: 'none', monthKey: bill.monthKey, ymd: null }
}

/** The notice's words on a bill row: "Aug notice on file", "Aug notice in the mail", "Aug notice owed", "Aug window closed", "no notice names it". */
export function spikeNoticeWords(n: SpikeBillNotice, settled = false): { text: string; tone: 'green' | 'amber' | 'red' | 'grey' } {
  // A paid bill is out of the claim: no notice needs to name it.
  if (settled) return { text: 'paid', tone: 'grey' }
  const mon = n.monthKey ? monthShort(n.monthKey) : ''
  switch (n.state) {
    case 'sent':
      return { text: `${mon} notice on file`, tone: 'green' }
    case 'mailed':
      return { text: `${mon} notice in the mail`, tone: 'amber' }
    case 'owed':
      return { text: `${mon} notice owed`, tone: 'amber' }
    case 'closed':
      return { text: `${mon} window closed`, tone: 'red' }
    case 'no_month':
      return { text: 'no billed day', tone: 'grey' }
    default:
      return { text: `no notice names ${mon}`, tone: 'grey' }
  }
}

export function monthShort(key: string): string {
  return new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

/** A bill row as the board draws it: the bill, the job it is on, and the notice that names its month. */
export type SpikeBillRow = { bill: SpikeBill; job: LienCalendarJob; closed: boolean; notice: SpikeBillNotice }

export type SpikePropertyGroup = {
  key: string
  /** The address as a heading: street and city, nothing from the state on. */
  label: string
  /** The customer (the owner the job is for); several joined with " · " when the property has more than one. */
  customer: string
  rows: Array<{ job: LienCalendarJob; closed: boolean }>
  bills: SpikeBillRow[]
  totals: {
    /** The sum of the listed jobs' open balances — the column the job rows already add to. */
    open: number
    /** What the sent bills still owe (the claim), and what they were paid. */
    billsOpen: number
    billsPaid: number
    bills: number
    settled: number
    jobsWithoutBills: number
  }
}

function propertyLabel(job: Pick<LienCalendarJob, 'address'>): string {
  return job.address.replace(/[,\s]+(TX|Texas)\b.*$/i, '').trim() || 'No address on the job'
}

/**
 * A GC group's rows folded into properties: jobs that share a property record, a typed address or one
 * address cut short of the other (`lienSameProperty`) sit under one heading, in the order the board
 * lists them. A job with no address stands alone.
 */
export function spikePropertyGroups(rows: ReadonlyArray<LienCalendarRow>, billsByJob: ReadonlyMap<string, ReadonlyArray<SpikeBill>> | null | undefined): SpikePropertyGroup[] {
  const jobs = rows.filter((r): r is Extract<LienCalendarRow, { kind: 'job' }> => r.kind === 'job')
  const groups: Array<{ keyJob: LienCalendarJob; rows: Array<{ job: LienCalendarJob; closed: boolean }> }> = []
  for (const r of jobs) {
    const home = groups.find((g) => sameProperty(g.keyJob, r.job) || g.rows.some((x) => sameProperty(x.job, r.job)))
    if (home) home.rows.push({ job: r.job, closed: r.closed })
    else groups.push({ keyJob: r.job, rows: [{ job: r.job, closed: r.closed }] })
  }
  return groups.map((g) => {
    const bills: SpikeBillRow[] = []
    let jobsWithoutBills = 0
    for (const { job, closed } of g.rows) {
      const list = billsByJob?.get(job.jobId) ?? []
      if (list.length === 0) jobsWithoutBills += 1
      for (const bill of list) bills.push({ bill, job, closed, notice: spikeNoticeFor(bill, job.runway) })
    }
    // Oldest billed day first; a bill with no day walks last.
    bills.sort((a, b) => (a.bill.sentYmd || '9999').localeCompare(b.bill.sentYmd || '9999') || a.job.number.localeCompare(b.job.number))
    const customers = [...new Set(g.rows.map((r) => r.job.customer.trim()).filter(Boolean))]
    const key = g.keyJob.addressId ? `a:${g.keyJob.addressId}` : `t:${lienAddressKey(g.keyJob.address) || g.keyJob.jobId}`
    return {
      key,
      label: propertyLabel(g.keyJob),
      customer: customers.join(' · '),
      rows: g.rows,
      bills,
      totals: {
        open: round2(g.rows.reduce((s, r) => s + r.job.openBalance, 0)),
        billsOpen: round2(bills.reduce((s, b) => s + b.bill.owed, 0)),
        billsPaid: round2(bills.reduce((s, b) => s + b.bill.paid, 0)),
        bills: bills.length,
        settled: bills.filter((b) => b.bill.settled).length,
        jobsWithoutBills,
      },
    }
  })
}

function sameProperty(a: LienCalendarJob, b: LienCalendarJob): boolean {
  if (lienSameProperty(a, b)) return true
  const x = lienAddressKey(a.address)
  const y = lienAddressKey(b.address)
  return Boolean(x) && x === y
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** The grey line under a property heading: "Rizvi Syed Zulfiqar & … · 8 jobs · 9 bills · 2 paid". */
export function spikePropertySub(g: Pick<SpikePropertyGroup, 'customer' | 'rows' | 'totals'>): string {
  const bits = [g.customer, `${g.rows.length} ${g.rows.length === 1 ? 'job' : 'jobs'}`]
  if (g.totals.bills === 0) bits.push('nothing billed')
  else {
    bits.push(`${g.totals.bills} ${g.totals.bills === 1 ? 'bill' : 'bills'}`)
    if (g.totals.settled) bits.push(`${g.totals.settled} paid`)
  }
  if (g.totals.jobsWithoutBills && g.totals.bills) bits.push(`${g.totals.jobsWithoutBills} with no bill`)
  return bits.filter(Boolean).join(' · ')
}

/**
 * The property heading's money words under its open total: "9 bills · $14,220 paid"; when the bills owe
 * less than the jobs' balances (work not billed yet) it says what the bills owe, since that is the claim.
 */
export function spikePropertyMoneyWords(g: Pick<SpikePropertyGroup, 'totals'>): string {
  if (g.totals.bills === 0) return 'nothing billed'
  const parts = [`${g.totals.bills} ${g.totals.bills === 1 ? 'bill' : 'bills'}`]
  if (Math.abs(g.totals.billsOpen - g.totals.open) >= 1) parts.push(`${formatUsdNoCents(g.totals.billsOpen)} on the bills`)
  if (g.totals.billsPaid > 0) parts.push(`${formatUsdNoCents(g.totals.billsPaid)} paid`)
  return parts.join(' · ')
}

/** Shape B: where a job's bills sit on the shared axis. A bill billed before the axis's left edge sits at the edge. */
export type SpikeBillMark = { bill: SpikeBill; pct: number; offAxis: boolean; notice: SpikeBillNotice }

export function spikeBillMarks(job: Pick<LienCalendarJob, 'runway'>, bills: ReadonlyArray<SpikeBill> | undefined, axis: Pick<LienCalendarAxis, 'pct' | 'startYmd'>): SpikeBillMark[] {
  if (!bills) return []
  return bills
    .filter((b) => Boolean(b.sentYmd))
    .map((b) => ({ bill: b, pct: b.sentYmd < axis.startYmd ? 0 : axis.pct(b.sentYmd), offAxis: b.sentYmd < axis.startYmd, notice: spikeNoticeFor(b, job.runway) }))
}

/** Shape B's line under a job's money: "2 bills · 1 paid · $9,800 open" / "1 bill · Aug 20" / "no bill sent". */
export function spikeJobBillsWords(bills: ReadonlyArray<SpikeBill> | undefined): string {
  if (!bills || bills.length === 0) return 'no bill sent'
  const owing = bills.filter((b) => !b.settled)
  const settled = bills.length - owing.length
  if (bills.length === 1) {
    const b = bills[0]!
    return `${b.number}${b.sentYmd ? ` · ${formatBilledDay(b.sentYmd)}` : ''}${b.settled ? ' · paid' : ''}`
  }
  return `${bills.length} bills${settled ? ` · ${settled} paid` : ''}${owing.length ? ` · ${formatUsdNoCents(owing.reduce((s, b) => s + b.owed, 0))} open` : ''}`
}

export function formatBilledDay(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** A bill mark's hover: "#2 · $9,800 · billed Aug 20 · Aug notice on file". */
export function spikeBillTitle(m: Pick<SpikeBillMark, 'bill' | 'notice'>): string {
  const b = m.bill
  const money = b.settled ? `${formatUsdNoCents(b.billed)} paid` : b.paid > 0 ? `${formatUsdNoCents(b.owed)} open of ${formatUsdNoCents(b.billed)}` : formatUsdNoCents(b.owed)
  return `${b.number} · ${money}${b.sentYmd ? ` · billed ${formatBilledDay(b.sentYmd)}` : ''}${b.settled ? '' : ` · ${spikeNoticeWords(m.notice).text}`}`
}
