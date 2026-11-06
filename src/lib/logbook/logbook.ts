/**
 * The teammate’s logbook (punch list #255): what a person holds, what they are working
 * toward in each trade, and the week-by-week record of approved hours a licensing board asks for.
 *
 * Every license counts for each trade (the owner, 2026-11-03): an hour counts toward the license of
 * the trade its job was in, read off the job's service type. Plumbing and electrical count hours;
 * HVAC counts months. Office and estimating time stay in the log, on a line that does not count,
 * so the totals still match payroll.
 *
 * Pure. The rows are `list_user_license_hours_log`'s (approved, clocked out, not rejected or revoked).
 */
import type { LicenseHoursLogRow } from '../licenseHoursLog'
import { companyWeekStartSundayContaining, ymdAddDays } from '../../utils/dateUtils'
import { LICENSE_LEVELS } from './licenseText'

export type Trade = 'plumbing' | 'electrical' | 'hvac'
export const TRADES: readonly Trade[] = ['plumbing', 'electrical', 'hvac']
export const TRADE_LABEL: Record<Trade, string> = { plumbing: 'Plumbing', electrical: 'Electrical', hvac: 'HVAC' }

export type LicenseClass = 'apprentice' | 'tradesman' | 'registered_tech' | 'certified_tech' | 'journeyman' | 'master' | 'contractor'

/** Lowest to highest within a trade. */
const CLASS_RANK: Record<LicenseClass, number> = {
  apprentice: 0,
  registered_tech: 0,
  tradesman: 1,
  certified_tech: 1,
  journeyman: 2,
  master: 3,
  contractor: 4,
}

export type ParsedLicense = {
  raw: string
  trade: Trade | null
  cls: LicenseClass | null
  number: string | null
  /** The license's name without its number: "Plumber Apprentice". */
  name: string
  expiryYmd: string | null
}

/**
 * Reads the free text the Licenses tab holds today ("Plumber Apprentice #141860",
 * "AC Contractor TACLA39079E", "Notary #135545090"). A license that names no trade
 * (a notary) comes back with a null trade and is listed as held, never as a ladder.
 */
export function parseLicenseType(raw: string, expiryYmd: string | null = null): ParsedLicense {
  const text = raw.trim()
  const hash = /#\s*([A-Za-z0-9-]+)\s*$/.exec(text)
  const tail = hash ? null : /\s([A-Z]*\d[A-Z0-9-]{3,})\s*$/.exec(text)
  const number = hash?.[1] ?? tail?.[1] ?? null
  const name = (hash ? text.slice(0, hash.index) : tail ? text.slice(0, tail.index) : text).trim()
  const lower = name.toLowerCase()
  const trade: Trade | null = /plumb/.test(lower)
    ? 'plumbing'
    : /electric/.test(lower)
      ? 'electrical'
      : /\b(ac|a\/c|hvac|acr|air|refrigeration)\b/.test(lower)
        ? 'hvac'
        : null
  let cls: LicenseClass | null = null
  if (trade) {
    if (/apprentice/.test(lower)) cls = 'apprentice'
    else if (/tradesman/.test(lower)) cls = 'tradesman'
    else if (/journeyman/.test(lower)) cls = 'journeyman'
    else if (/master/.test(lower)) cls = 'master'
    else if (/contractor/.test(lower)) cls = 'contractor'
    else if (/certified/.test(lower)) cls = 'certified_tech'
    else if (trade === 'hvac' && /\btech/.test(lower)) cls = 'registered_tech'
  }
  return { raw: text, trade, cls, number, name, expiryYmd }
}

export type Requirement = {
  trade: Trade
  from: LicenseClass
  to: LicenseClass
  /** "Journeyman plumber" */
  toName: string
  unit: 'hours' | 'months'
  need: number
  /** Months only: the months must fall inside the last N months. */
  windowMonths?: number
  /** The class the supervisor of record holds in this trade. */
  supervisorClass: LicenseClass
  board: string
  /** The board's own form the printout goes behind. */
  proofForm: string
  /** What is not settled about the board's rule, said once. */
  caveat?: string
}

/** Seeded from the boards' own pages (2026-11-03); the office edits these when a board changes its rule. */
export const REQUIREMENTS: readonly Requirement[] = [
  { trade: 'plumbing', from: 'apprentice', to: 'journeyman', toName: 'Journeyman plumber', unit: 'hours', need: 8000, supervisorClass: 'master', board: 'TSBPE', proofForm: 'Employer Certification Form' },
  { trade: 'electrical', from: 'apprentice', to: 'journeyman', toName: 'Journeyman electrician', unit: 'hours', need: 8000, supervisorClass: 'master', board: 'TDLR', proofForm: 'Experience Verification Form', caveat: 'TDLR’s web page says 7,000 hours. Its application form says 8,000.' },
  { trade: 'hvac', from: 'registered_tech', to: 'certified_tech', toName: 'Certified technician', unit: 'months', need: 24, supervisorClass: 'contractor', board: 'TDLR', proofForm: 'Experience Verification Form' },
  { trade: 'hvac', from: 'certified_tech', to: 'contractor', toName: 'AC contractor', unit: 'months', need: 48, windowMonths: 72, supervisorClass: 'contractor', board: 'TDLR', proofForm: 'Experience Verification Form' },
]

/** A month of HVAC work counts when it holds at least this many approved HVAC hours. An owner call. */
export const MONTH_MIN_HOURS = 80

export function tradeOfServiceType(name: string | null | undefined): Trade | null {
  const n = (name ?? '').trim().toLowerCase()
  if (n === 'plumbing') return 'plumbing'
  if (n === 'electrical') return 'electrical'
  if (n === 'hvac') return 'hvac'
  return null
}

export type NotCountedReason = 'estimating' | 'office' | 'no_trade'
export const NOT_COUNTED_LABEL: Record<NotCountedReason, string> = {
  estimating: 'Estimating',
  office: 'Office',
  no_trade: 'A job with no trade',
}

/**
 * The company's office job (People → Overhead, `overhead_office_job_ledger_id_v1`) carries a trade on
 * its service type like any job, but time there is office time. Its rows read as office, not trade.
 */
export function withOfficeJob<R extends LicenseHoursLogRow>(rows: readonly R[], officeJobId: string | null): R[] {
  if (!officeJobId) return [...rows]
  return rows.map((r) => (r.job_ledger_id === officeJobId ? { ...r, job_ledger_id: null, bid_id: null } : r))
}

export type RowCounts = { trade: Trade } | { trade: null; reason: NotCountedReason }

export function rowCounts(row: Pick<LicenseHoursLogRow, 'job_ledger_id' | 'bid_id' | 'service_type_name'>): RowCounts {
  if (!row.job_ledger_id) return { trade: null, reason: row.bid_id ? 'estimating' : 'office' }
  const trade = tradeOfServiceType(row.service_type_name)
  return trade ? { trade } : { trade: null, reason: 'no_trade' }
}

export type Supervisor = { personName: string; licenseName: string; number: string | null }

/** Who signs for a trade: everyone else holding the supervisor class in it, by name, so the default is stable. */
export function supervisorCandidates(
  trade: Trade,
  supervisorClass: LicenseClass,
  licensesByPerson: ReadonlyArray<{ personName: string; license: ParsedLicense }>,
  exceptPersonName: string,
): Supervisor[] {
  return licensesByPerson
    .filter((l) => l.personName !== exceptPersonName && l.license.trade === trade && l.license.cls === supervisorClass)
    .map((l) => ({ personName: l.personName, licenseName: l.license.name, number: l.license.number }))
    .sort((x, y) => x.personName.localeCompare(y.personName))
}

export type OpeningBalance = {
  trade: Trade
  amount: number
  unit: 'hours' | 'months'
  /** "Hours at Rio Plumbing, 2023 to 2025, their signed form on file" */
  source: string
}

export type Goal = {
  requirement: Requirement
  /** The license held now in the trade, the rung the goal climbs from. */
  holds: ParsedLicense
}

/** A license held whose trade has a rung above it, but no requirement seeded from it yet. */
export type NoRuleYet = {
  holds: ParsedLicense
  /** The rung above, as the Licenses tab names it: "Master Electrician". */
  next: { level: LicenseClass; name: string }
}

/**
 * For each trade, the highest rung held and the next one a requirement names. A rung is the top of
 * its ladder only when the trade offers nothing above it; a rung with a level above it and no
 * requirement seeded from it (a journeyman electrician, whose master rule is not in) is `noRuleYet`,
 * never `topOfLadder`.
 */
export function goalsFor(held: readonly ParsedLicense[]): { goals: Goal[]; topOfLadder: ParsedLicense[]; noRuleYet: NoRuleYet[] } {
  const goals: Goal[] = []
  const topOfLadder: ParsedLicense[] = []
  const noRuleYet: NoRuleYet[] = []
  for (const trade of TRADES) {
    const inTrade = held.filter((l) => l.trade === trade && l.cls)
    if (inTrade.length === 0) continue
    const top = inTrade.reduce((a, b) => (CLASS_RANK[b.cls!] > CLASS_RANK[a.cls!] ? b : a))
    const req = REQUIREMENTS.find((r) => r.trade === trade && r.from === top.cls)
    if (req) {
      goals.push({ requirement: req, holds: top })
      continue
    }
    const above = LICENSE_LEVELS[trade].filter((l) => CLASS_RANK[l.level] > CLASS_RANK[top.cls!])
    const next = above[0]
    if (next) noRuleYet.push({ holds: top, next: { level: next.level, name: next.name } })
    else topOfLadder.push(top)
  }
  return { goals, topOfLadder, noRuleYet }
}

export type Progress = {
  unit: 'hours' | 'months'
  need: number
  /** Approved from the clock, plus the opening balance. */
  done: number
  fromClock: number
  opening: number
  pct: number
  /** Hours only: the next 500-hour mark and how far it is. */
  nextMark: { at: number; away: number } | null
  /** Months only: the months that counted, newest first ("2026-10"). */
  monthsCounted: string[]
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function monthsOfTrade(rows: readonly LicenseHoursLogRow[], trade: Trade, todayYmd: string, windowMonths?: number): string[] {
  const byMonth = new Map<string, number>()
  for (const r of rows) {
    const c = rowCounts(r)
    if (c.trade !== trade) continue
    const m = r.work_date.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? 0) + Number(r.hours))
  }
  const floor = windowMonths ? monthsBack(todayYmd.slice(0, 7), windowMonths - 1) : null
  return [...byMonth.entries()]
    .filter(([m, h]) => h >= MONTH_MIN_HOURS && (!floor || m >= floor))
    .map(([m]) => m)
    .sort()
    .reverse()
}

function monthsBack(ym: string, n: number): string {
  const [y = 1970, m = 1] = ym.split('-').map(Number)
  const total = y * 12 + (m - 1) - n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function progressFor(goal: Goal, rows: readonly LicenseHoursLogRow[], openings: readonly OpeningBalance[], todayYmd: string): Progress {
  const req = goal.requirement
  const opening = openings.filter((o) => o.trade === req.trade && o.unit === req.unit).reduce((s, o) => s + o.amount, 0)
  if (req.unit === 'months') {
    const monthsCounted = monthsOfTrade(rows, req.trade, todayYmd, req.windowMonths)
    const done = monthsCounted.length + opening
    return { unit: 'months', need: req.need, done, fromClock: monthsCounted.length, opening, pct: Math.min(1, done / req.need), nextMark: null, monthsCounted }
  }
  const fromClock = round1(rows.reduce((s, r) => (rowCounts(r).trade === req.trade ? s + Number(r.hours) : s), 0))
  const done = round1(fromClock + opening)
  const at = Math.min(req.need, (Math.floor(done / 500) + 1) * 500)
  return {
    unit: 'hours',
    need: req.need,
    done,
    fromClock,
    opening,
    pct: Math.min(1, done / req.need),
    nextMark: done >= req.need ? null : { at, away: round1(at - done) },
    monthsCounted: [],
  }
}

export type LogLine = {
  weekStartYmd: string
  weekEndYmd: string
  jobKey: string
  jobNumber: string
  jobName: string
  jobAddress: string
  counts: RowCounts
  sessions: number
  hours: number
}

export type LogWeek = { weekStartYmd: string; weekEndYmd: string; lines: LogLine[]; byTrade: Partial<Record<Trade, number>>; notCounted: number }

/** Week by week, newest first; inside a week, counted lines by trade, then the lines that do not count. */
export function logWeeks(rows: readonly LicenseHoursLogRow[]): LogWeek[] {
  const weeks = new Map<string, Map<string, LogLine>>()
  for (const r of rows) {
    const ws = companyWeekStartSundayContaining(r.work_date) ?? r.work_date
    const counts = rowCounts(r)
    const key = r.job_ledger_id ?? (r.bid_id ? 'bid' : 'office')
    let week = weeks.get(ws)
    if (!week) weeks.set(ws, (week = new Map()))
    let line = week.get(key)
    if (!line) {
      line = {
        weekStartYmd: ws,
        weekEndYmd: ymdAddDays(ws, 6),
        jobKey: key,
        jobNumber: r.job_ledger_id ? r.job_number : '',
        jobName: r.job_ledger_id ? r.job_name : counts.trade === null ? NOT_COUNTED_LABEL[counts.reason] : '',
        jobAddress: r.job_ledger_id ? r.job_address : '',
        counts,
        sessions: 0,
        hours: 0,
      }
      week.set(key, line)
    }
    line.sessions += 1
    line.hours = round1(line.hours + Number(r.hours))
  }
  const order = (l: LogLine) => (l.counts.trade ? TRADES.indexOf(l.counts.trade) : 9)
  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([ws, lines]) => {
      const list = [...lines.values()].sort((a, b) => order(a) - order(b) || a.jobNumber.localeCompare(b.jobNumber))
      const byTrade: Partial<Record<Trade, number>> = {}
      let notCounted = 0
      for (const l of list) {
        if (l.counts.trade) byTrade[l.counts.trade] = round1((byTrade[l.counts.trade] ?? 0) + l.hours)
        else notCounted = round1(notCounted + l.hours)
      }
      return { weekStartYmd: ws, weekEndYmd: ymdAddDays(ws, 6), lines: list, byTrade, notCounted }
    })
}

export type Totals = {
  byTrade: Record<Trade, number>
  notCounted: Record<NotCountedReason, number>
  all: number
  /** Year → trade → hours, for the summary sheet. */
  byYear: Array<{ year: string; byTrade: Record<Trade, number> }>
  firstYmd: string | null
  lastYmd: string | null
}

export function totalsOf(rows: readonly LicenseHoursLogRow[]): Totals {
  const byTrade: Record<Trade, number> = { plumbing: 0, electrical: 0, hvac: 0 }
  const notCounted: Record<NotCountedReason, number> = { estimating: 0, office: 0, no_trade: 0 }
  const years = new Map<string, Record<Trade, number>>()
  let all = 0
  let firstYmd: string | null = null
  let lastYmd: string | null = null
  for (const r of rows) {
    const h = Number(r.hours)
    all += h
    if (!firstYmd || r.work_date < firstYmd) firstYmd = r.work_date
    if (!lastYmd || r.work_date > lastYmd) lastYmd = r.work_date
    const c = rowCounts(r)
    if (c.trade) {
      byTrade[c.trade] += h
      const y = r.work_date.slice(0, 4)
      const yr = years.get(y) ?? { plumbing: 0, electrical: 0, hvac: 0 }
      yr[c.trade] += h
      years.set(y, yr)
    } else notCounted[c.reason] += h
  }
  for (const t of TRADES) byTrade[t] = round1(byTrade[t])
  for (const k of Object.keys(notCounted) as NotCountedReason[]) notCounted[k] = round1(notCounted[k])
  return {
    byTrade,
    notCounted,
    all: round1(all),
    byYear: [...years.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([year, t]) => ({ year, byTrade: { plumbing: round1(t.plumbing), electrical: round1(t.electrical), hvac: round1(t.hvac) } })),
    firstYmd,
    lastYmd,
  }
}

/** "3,412" */
export function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}
