import type { OverheadPartsDetailLine } from './fetchOverheadOfficePartsByDay'
import { bucketForOverheadPartsLine, type OverheadPartsAccountingBucketKey } from './overheadPartsAccountingBuckets'
import type { OverheadPeopleLaborInput } from './overheadPeopleTable'
import type { OverheadSessionDetailLine } from './overheadDailyLabor'

/** The snapshot's labor lines: the people table's shape, plus whatever session detail the builder attached (v2.3264). */
export type OverheadPoolLaborInput = OverheadPeopleLaborInput & Partial<Pick<OverheadSessionDetailLine, 'sessionId' | 'clockedInAt' | 'clockedOutAt' | 'approved' | 'missingWage' | 'bidId' | 'notes'>>

/**
 * The pool chart's day index (v2.3269): what is behind every bar and segment
 * of People → Overhead's 90-day pool chart, from the SAME per-line inputs the
 * people table already receives (`OverheadPoolSnapshot.peopleLines`), so a
 * click never fetches. Per day: the office sessions, the bid sessions and the
 * office-job purchases (internal transfers kept but marked not counted, the
 * pool's own rule). Across the window: a typical day (the median of days with
 * anything in them), how often each counterparty and person shows up, and the
 * biggest single lines — the discovery path for "what is that spike".
 *
 * Pure. Dollar sums here equal the trend kernel's on the same inputs (pinned
 * by test); the panel shows the index's figures so the two never disagree.
 */
export type OverheadPoolCategory = 'office' | 'bid' | 'parts'

/** The chart's series, in stack order — colors match the rest of the tab (purple office labor, blue bid labor, amber office parts). */
export const OVERHEAD_POOL_SERIES: Record<OverheadPoolCategory, { label: string; color: string }> = {
  office: { label: 'Office labor', color: '#8b5cf6' },
  bid: { label: 'Bid labor', color: 'var(--text-blue-500)' },
  parts: { label: 'Office parts', color: '#f59e0b' },
}

export type OverheadPoolLaborLine = {
  kind: 'labor'
  ymd: string
  bucket: 'office' | 'bid'
  userName: string
  hours: number
  laborUsd: number
  sessionId?: string
  clockedInAt?: string
  clockedOutAt?: string | null
  awaitingApproval?: boolean
  missingWage?: boolean
  bidId?: string | null
  notes?: string | null
}

export type OverheadPoolPartsLine = {
  kind: 'parts'
  ymd: string
  source: OverheadPartsDetailLine['source']
  label: string
  amountUsd: number
  mercuryDebitCardId?: string | null
  mercuryTransactionId?: string | null
  bucket: OverheadPartsAccountingBucketKey
  /** False for internal transfers: listed, struck, never summed. */
  counted: boolean
  /** The name the counterparty stats key on ("Ferguson", not "Ferguson · #4471"). */
  counterparty: string
}

export type OverheadPoolDayDetail = {
  ymd: string
  office: OverheadPoolLaborLine[]
  bid: OverheadPoolLaborLine[]
  parts: OverheadPoolPartsLine[]
  sums: { office: number; bid: number; parts: number; total: number }
  /** Internal-transfer dollars listed but not counted. */
  excludedPartsUsd: number
}

export type OverheadPoolCounterpartyStats = { count: number; totalUsd: number; maxUsd: number }
export type OverheadPoolPersonStats = { days: number; hours: number; maxHours: number }

export type OverheadPoolBiggestLine = {
  ymd: string
  category: OverheadPoolCategory
  amountUsd: number
  line: OverheadPoolLaborLine | OverheadPoolPartsLine
}

export type OverheadPoolDayIndex = {
  byYmd: Map<string, OverheadPoolDayDetail>
  /** Every window day in order (zero-filled), for prev/next. */
  ymds: string[]
  poolUsd: number
  /** Median total over days with anything in them; 0 when the window is empty. */
  typicalDayUsd: number
  typicalByCategory: Record<OverheadPoolCategory, number>
  counterparty: Map<string, OverheadPoolCounterpartyStats>
  person: Map<string, OverheadPoolPersonStats>
  biggest: OverheadPoolBiggestLine[]
}

const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? 0
}

/** "Ferguson · #4471" → "Ferguson"; a Mercury line's label is the counterparty already. */
export function overheadPartsCounterparty(line: Pick<OverheadPartsDetailLine, 'source' | 'label'>): string {
  const t = line.label.trim()
  if (line.source === 'supply') return t.split(' · #')[0]?.trim() || 'Supply invoice'
  if (line.source === 'tally') return t || 'Tally entry'
  return t || 'Card purchase'
}

const emptyDay = (ymd: string): OverheadPoolDayDetail => ({ ymd, office: [], bid: [], parts: [], sums: { office: 0, bid: 0, parts: 0, total: 0 }, excludedPartsUsd: 0 })

export function buildOverheadPoolDayIndex(args: {
  labor: readonly OverheadPoolLaborInput[]
  parts: ReadonlyArray<{ workDate: string; line: OverheadPartsDetailLine }>
  bucketByTxId: ReadonlyMap<string, OverheadPartsAccountingBucketKey>
  /** The window's days in order (the trend kernel's `days[].ymd`). */
  ymds: readonly string[]
  biggestCount?: number
}): OverheadPoolDayIndex {
  const byYmd = new Map<string, OverheadPoolDayDetail>()
  for (const ymd of args.ymds) byYmd.set(ymd, emptyDay(ymd))
  const day = (ymd: string): OverheadPoolDayDetail => {
    let d = byYmd.get(ymd)
    if (!d) {
      d = emptyDay(ymd)
      byYmd.set(ymd, d)
    }
    return d
  }
  const person = new Map<string, OverheadPoolPersonStats>()
  const personDays = new Map<string, Set<string>>()
  for (const l of args.labor) {
    if (!(l.hours > 0)) continue
    const line: OverheadPoolLaborLine = {
      kind: 'labor',
      ymd: l.workDate,
      bucket: l.bucket,
      userName: l.userName,
      hours: l.hours,
      laborUsd: l.laborUsd,
      sessionId: l.sessionId,
      clockedInAt: l.clockedInAt,
      clockedOutAt: l.clockedOutAt,
      awaitingApproval: l.approved === false,
      missingWage: l.missingWage,
      bidId: l.bidId,
      notes: l.notes,
    }
    const d = day(l.workDate)
    ;(l.bucket === 'office' ? d.office : d.bid).push(line)
    d.sums[l.bucket] += l.laborUsd
    const p = person.get(l.userName) ?? { days: 0, hours: 0, maxHours: 0 }
    p.hours += l.hours
    p.maxHours = Math.max(p.maxHours, l.hours)
    person.set(l.userName, p)
    const ds = personDays.get(l.userName) ?? new Set<string>()
    ds.add(l.workDate)
    personDays.set(l.userName, ds)
  }
  for (const [name, ds] of personDays) person.get(name)!.days = ds.size

  const counterparty = new Map<string, OverheadPoolCounterpartyStats>()
  for (const { workDate, line } of args.parts) {
    const bucket = bucketForOverheadPartsLine(line, args.bucketByTxId)
    const counted = bucket !== 'internal_transfer'
    const cp = overheadPartsCounterparty(line)
    const pl: OverheadPoolPartsLine = {
      kind: 'parts',
      ymd: workDate,
      source: line.source,
      label: line.label,
      amountUsd: line.amountUsd,
      mercuryDebitCardId: line.mercuryDebitCardId ?? null,
      mercuryTransactionId: line.mercuryTransactionId ?? null,
      bucket,
      counted,
      counterparty: cp,
    }
    const d = day(workDate)
    d.parts.push(pl)
    if (counted) {
      d.sums.parts += line.amountUsd
      const c = counterparty.get(cp) ?? { count: 0, totalUsd: 0, maxUsd: 0 }
      c.count += 1
      c.totalUsd += line.amountUsd
      c.maxUsd = Math.max(c.maxUsd, line.amountUsd)
      counterparty.set(cp, c)
    } else d.excludedPartsUsd += line.amountUsd
  }

  let poolUsd = 0
  const dayTotals: number[] = []
  const catTotals: Record<OverheadPoolCategory, number[]> = { office: [], bid: [], parts: [] }
  for (const d of byYmd.values()) {
    d.office.sort((a, b) => a.userName.localeCompare(b.userName) || (a.sessionId ?? '').localeCompare(b.sessionId ?? ''))
    d.bid.sort((a, b) => a.userName.localeCompare(b.userName) || (a.sessionId ?? '').localeCompare(b.sessionId ?? ''))
    d.parts.sort((a, b) => Number(b.counted) - Number(a.counted) || b.amountUsd - a.amountUsd || a.label.localeCompare(b.label))
    d.sums.total = d.sums.office + d.sums.bid + d.sums.parts
    poolUsd += d.sums.total
    if (d.sums.total > 0) dayTotals.push(d.sums.total)
    for (const k of ['office', 'bid', 'parts'] as const) if (d.sums[k] > 0) catTotals[k].push(d.sums[k])
  }
  const ymds = [...byYmd.keys()].sort()

  const candidates: OverheadPoolBiggestLine[] = []
  for (const d of byYmd.values()) {
    for (const l of d.office) candidates.push({ ymd: d.ymd, category: 'office', amountUsd: l.laborUsd, line: l })
    for (const l of d.bid) candidates.push({ ymd: d.ymd, category: 'bid', amountUsd: l.laborUsd, line: l })
    for (const l of d.parts) if (l.counted) candidates.push({ ymd: d.ymd, category: 'parts', amountUsd: l.amountUsd, line: l })
  }
  candidates.sort((a, b) => b.amountUsd - a.amountUsd || a.ymd.localeCompare(b.ymd))
  return {
    byYmd,
    ymds,
    poolUsd,
    typicalDayUsd: median(dayTotals),
    typicalByCategory: { office: median(catTotals.office), bid: median(catTotals.bid), parts: median(catTotals.parts) },
    counterparty,
    person,
    biggest: candidates.slice(0, Math.max(0, args.biggestCount ?? 5)),
  }
}

/** "3.4× a typical day" · "12× a typical day" · null when there is nothing to compare. */
export function overheadPoolTypicalLabel(valueUsd: number, typicalUsd: number, noun = 'a typical day'): string | null {
  if (!(valueUsd > 0) || !(typicalUsd > 0)) return null
  const r = valueUsd / typicalUsd
  const shown = r >= 10 ? String(Math.round(r)) : r.toFixed(1)
  return `${shown}× ${noun}`
}

/** "6× in 90 days · $2,940 total · the largest" · "only time in 90 days". */
export function overheadPoolCounterpartyNote(index: Pick<OverheadPoolDayIndex, 'counterparty'>, line: OverheadPoolPartsLine, money: (v: number) => string, windowNoun = '90 days'): string | null {
  const c = index.counterparty.get(line.counterparty)
  if (!c || !line.counted) return null
  if (c.count === 1) return `only time in ${windowNoun}`
  return `${c.count}× in ${windowNoun} · ${money(c.totalUsd)} total${line.amountUsd >= c.maxUsd ? ' · the largest' : ''}`
}

/** "41 days · 7.9 h typical · the longest". */
export function overheadPoolPersonNote(index: Pick<OverheadPoolDayIndex, 'person'>, line: OverheadPoolLaborLine): string | null {
  const p = index.person.get(line.userName)
  if (!p || p.days === 0) return null
  const typical = p.hours / p.days
  return `${p.days} ${p.days === 1 ? 'day' : 'days'} · ${typical.toFixed(1)} h typical${p.days > 1 && line.hours >= p.maxHours ? ' · the longest' : ''}`
}

/** The category with the most dollars that day — what a click on the bar's empty top opens. */
export function overheadPoolDominantCategory(d: OverheadPoolDayDetail): OverheadPoolCategory | null {
  const entries: Array<[OverheadPoolCategory, number]> = [
    ['office', d.sums.office],
    ['bid', d.sums.bid],
    ['parts', d.sums.parts],
  ]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0] && entries[0][1] > 0 ? entries[0][0] : null
}
