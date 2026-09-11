import type { OverheadSessionDetailLine } from './overheadDailyLabor'
import type { OverheadPeoplePartsInput, OverheadPeopleTable } from './overheadPeopleTable'
import { OVERHEAD_PEOPLE_NO_PERSON_LABEL, overheadPeopleDisplayName } from './overheadPeopleTable'

/**
 * "Behind the cell" (v2.3264): the lines that add up to one cell of People →
 * Overhead's "Who makes up overhead" table — a person (or the Pool row) × a
 * column × the table's window. Sessions carry the punch, the wage used and
 * the approval state; purchases carry source, description, section and card.
 * Grouped by Sun–Sat week for a person, by person for the Pool row; the sum
 * must tie to the cell and the model says whether it does. Pure.
 */
export type OverheadPeopleCellColumn = 'officeLaborUsd' | 'bidLaborUsd' | 'officePartsUsd' | 'totalUsd'
export type OverheadCellOrder = 'newest' | 'largest'

export const OVERHEAD_PEOPLE_CELL_COLUMNS: ReadonlyArray<{ key: OverheadPeopleCellColumn; label: string }> = [
  { key: 'officeLaborUsd', label: 'Office labor' },
  { key: 'bidLaborUsd', label: 'Bid labor' },
  { key: 'officePartsUsd', label: 'Office parts' },
  { key: 'totalUsd', label: 'Total' },
]

/** A session that reads long enough to be a forgotten clock-out. */
export const OVERHEAD_LONG_SESSION_HOURS = 10
/** A punch short enough to be a stray tap (clock in, clock straight back out). */
export const OVERHEAD_STRAY_PUNCH_HOURS = 0.25

export type OverheadCellSessionLine = {
  kind: 'session'
  id: string
  ymd: string
  person: string
  bucket: 'office' | 'bid'
  hours: number
  usd: number
  wageUsdPerHour: number | null
  approved: boolean
  missingWage: boolean
  long: boolean
  /** Under a quarter hour — a stray tap, most likely. */
  stray: boolean
  weekend: boolean
  clockedInAt: string | null
  clockedOutAt: string | null
  bidId: string | null
  notes: string | null
}

export type OverheadCellPurchaseLine = {
  kind: 'purchase'
  id: string
  ymd: string
  /** Card nickname (last four stripped) or null for supply / ACH / tally lines. */
  person: string | null
  usd: number
  label: string
  source: 'mercury' | 'supply' | 'tally' | 'unknown'
  cardLabel: string | null
  bucket: string | null
}

export type OverheadCellLine = OverheadCellSessionLine | OverheadCellPurchaseLine

/** One calendar day of one person's sessions inside a group — the row the modal shows; its punches sit inside. */
export type OverheadCellDay = {
  ymd: string
  person: string
  punches: OverheadCellSessionLine[]
  usd: number
  hours: number
  flagged: number
  /** Any punch awaiting approval / with no wage / long / stray. */
  pending: boolean
  missingWage: boolean
  long: boolean
  stray: number
  weekend: boolean
}

export type OverheadCellGroup = {
  key: string
  title: string
  /** Every line (flat) — the CSV and the counts read these. */
  lines: OverheadCellLine[]
  /** Session sections only: the lines rolled up per person-day, in the requested order. */
  days?: OverheadCellDay[]
  usd: number
  hours: number
  /** Lines a human should look at: awaiting approval, no wage, or long. */
  flagged: number
}

export type OverheadCellSectionKind = 'office' | 'bid' | 'parts'

export type OverheadCellSection = {
  kind: OverheadCellSectionKind
  label: string
  /** Every line of the section (before the filter). */
  lineCount: number
  usd: number
  hours: number
  /** Groups after the filter and order. */
  groups: OverheadCellGroup[]
}

export type OverheadPeopleCellModel = {
  /** Display name, or null for the Pool row. */
  person: string | null
  unattributed: boolean
  column: OverheadPeopleCellColumn
  startYmd: string
  endYmd: string
  days: number
  /** The table's figure for this cell. */
  cellUsd: number
  /** Σ of every line (before the filter). */
  sumUsd: number
  ties: boolean
  hours: number
  /** sumUsd ÷ hours over the labor lines, null without hours. */
  avgRateUsd: number | null
  sections: OverheadCellSection[]
  counts: { lines: number; pending: number; noWage: number; long: number; stray: number; noPerson: number; shown: number }
  /** Bid ids on the lines (for a label lookup). */
  bidIds: string[]
}

const DAY_MS = 86_400_000
const dayNumber = (ymd: string): number => Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / DAY_MS)
const dayYmd = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10)
/** Sunday of the ymd's week — the tab's Sun–Sat week. */
export function overheadCellWeekStart(ymd: string): string {
  const n = dayNumber(ymd)
  const dow = new Date(n * DAY_MS).getUTCDay()
  return dayYmd(n - dow)
}
const isWeekend = (ymd: string): boolean => {
  const dow = new Date(dayNumber(ymd) * DAY_MS).getUTCDay()
  return dow === 0 || dow === 6
}

const personKey = (name: string): string => overheadPeopleDisplayName(name).toLowerCase()

function sessionLine(l: OverheadSessionDetailLine): OverheadCellSessionLine {
  return {
    kind: 'session',
    id: l.sessionId,
    ymd: l.workDate,
    person: overheadPeopleDisplayName(l.userName),
    bucket: l.bucket,
    hours: l.hours,
    usd: l.laborUsd,
    wageUsdPerHour: l.wageUsdPerHour ?? (l.missingWage || !(l.hours > 0) ? null : l.laborUsd / l.hours),
    approved: l.approved ?? true,
    missingWage: l.missingWage,
    long: l.hours > OVERHEAD_LONG_SESSION_HOURS,
    stray: l.hours > 0 && l.hours < OVERHEAD_STRAY_PUNCH_HOURS,
    weekend: isWeekend(l.workDate),
    clockedInAt: l.clockedInAt ?? null,
    clockedOutAt: l.clockedOutAt ?? null,
    bidId: l.bidId,
    notes: l.notes,
  }
}

function purchaseLine(p: OverheadPeoplePartsInput, idx: number): OverheadCellPurchaseLine {
  const person = p.person?.trim() ? overheadPeopleDisplayName(p.person) : null
  return {
    kind: 'purchase',
    id: p.line?.mercuryTransactionId ? `tx:${p.line.mercuryTransactionId}` : `p:${p.workDate}:${idx}`,
    ymd: p.workDate,
    person,
    usd: p.amountUsd,
    label: p.line?.label?.trim() || (p.line?.source === 'supply' ? 'Supply-house invoice' : p.line?.source === 'tally' ? 'Tally line' : 'Purchase'),
    source: p.line?.source ?? 'unknown',
    cardLabel: p.cardLabel?.trim() || null,
    bucket: p.bucket ?? null,
  }
}

const lineHours = (l: OverheadCellLine): number => (l.kind === 'session' ? l.hours : 0)
const isFlagged = (l: OverheadCellLine): boolean => l.kind === 'session' && (!l.approved || l.missingWage || l.long)

export function overheadCellLineMatches(l: OverheadCellLine, filter: string, bidLabelById?: ReadonlyMap<string, string>): boolean {
  const f = filter.trim().toLowerCase()
  if (!f) return true
  const hay: Array<string | null | undefined> =
    l.kind === 'session'
      ? [l.person, l.notes, l.bidId ? bidLabelById?.get(l.bidId) : null, l.bidId, l.bucket, l.ymd]
      : [l.person, l.label, l.bucket, l.cardLabel, l.source, l.ymd]
  return hay.some((v) => v != null && v.toLowerCase().includes(f))
}

function buildGroups(lines: OverheadCellLine[], byPerson: boolean, order: OverheadCellOrder): OverheadCellGroup[] {
  const groups = new Map<string, OverheadCellGroup>()
  for (const l of lines) {
    const key = byPerson ? (l.person ?? '~none') : overheadCellWeekStart(l.ymd)
    let g = groups.get(key)
    if (!g) {
      g = { key, title: byPerson ? (l.person ?? OVERHEAD_PEOPLE_NO_PERSON_LABEL) : `Week of ${key}`, lines: [], usd: 0, hours: 0, flagged: 0 }
      groups.set(key, g)
    }
    g.lines.push(l)
    g.usd += l.usd
    g.hours += lineHours(l)
    if (isFlagged(l)) g.flagged += 1
  }
  const byDate = (a: OverheadCellLine, b: OverheadCellLine) => b.ymd.localeCompare(a.ymd) || a.id.localeCompare(b.id)
  const byAmount = (a: OverheadCellLine, b: OverheadCellLine) => b.usd - a.usd || byDate(a, b)
  const out = [...groups.values()]
  for (const g of out) {
    g.lines.sort(order === 'largest' ? byAmount : byDate)
    if (g.lines.some((l) => l.kind === 'session')) g.days = rollDays(g.lines.filter((l): l is OverheadCellSessionLine => l.kind === 'session'), order)
  }
  out.sort((a, b) => {
    if (byPerson) {
      if ((a.key === '~none') !== (b.key === '~none')) return a.key === '~none' ? 1 : -1
      return b.usd - a.usd || a.title.localeCompare(b.title)
    }
    return order === 'largest' ? b.usd - a.usd || b.key.localeCompare(a.key) : b.key.localeCompare(a.key)
  })
  return out
}

/** Roll session lines into person-days; punches inside keep clock order (earliest first). */
function rollDays(lines: readonly OverheadCellSessionLine[], order: OverheadCellOrder): OverheadCellDay[] {
  const byKey = new Map<string, OverheadCellDay>()
  for (const l of lines) {
    const key = `${l.ymd}|${l.person}`
    let d = byKey.get(key)
    if (!d) {
      d = { ymd: l.ymd, person: l.person, punches: [], usd: 0, hours: 0, flagged: 0, pending: false, missingWage: false, long: false, stray: 0, weekend: l.weekend }
      byKey.set(key, d)
    }
    d.punches.push(l)
    d.usd += l.usd
    d.hours += l.hours
    if (!l.approved || l.missingWage || l.long) d.flagged += 1
    d.pending = d.pending || !l.approved
    d.missingWage = d.missingWage || l.missingWage
    d.long = d.long || l.long
    if (l.stray) d.stray += 1
  }
  const days = [...byKey.values()]
  for (const d of days) d.punches.sort((a, b) => (a.clockedInAt ?? '').localeCompare(b.clockedInAt ?? '') || a.id.localeCompare(b.id))
  days.sort((a, b) => (order === 'largest' ? b.usd - a.usd || b.ymd.localeCompare(a.ymd) : b.ymd.localeCompare(a.ymd) || a.person.localeCompare(b.person)))
  return days
}

export function buildOverheadPeopleCellModel(args: {
  table: OverheadPeopleTable
  /** Display name of the row, or null for the Pool row. */
  person: string | null
  /** The synthetic "no person" row. */
  unattributed?: boolean
  column: OverheadPeopleCellColumn
  labor: ReadonlyArray<OverheadSessionDetailLine>
  parts: ReadonlyArray<OverheadPeoplePartsInput>
  order?: OverheadCellOrder
  filter?: string
  bidLabelById?: ReadonlyMap<string, string>
}): OverheadPeopleCellModel {
  const { table, person, column } = args
  const unattributed = args.unattributed === true
  const order = args.order ?? 'newest'
  const filter = args.filter ?? ''
  const pool = person == null
  const inWindow = (ymd: string) => ymd >= table.startYmd && ymd <= table.endYmd
  const pk = person ? personKey(person) : null

  const wantOffice = column === 'officeLaborUsd' || column === 'totalUsd'
  const wantBid = column === 'bidLaborUsd' || column === 'totalUsd'
  const wantParts = column === 'officePartsUsd' || column === 'totalUsd'

  const office: OverheadCellLine[] = []
  const bid: OverheadCellLine[] = []
  const parts: OverheadCellLine[] = []
  if (!unattributed && (wantOffice || wantBid)) {
    for (const l of args.labor) {
      if (!inWindow(l.workDate)) continue
      if (!pool && personKey(l.userName) !== pk) continue
      if (l.bucket === 'office' && wantOffice) office.push(sessionLine(l))
      else if (l.bucket === 'bid' && wantBid) bid.push(sessionLine(l))
    }
  }
  if (wantParts) {
    args.parts.forEach((p, idx) => {
      if (!inWindow(p.workDate)) return
      if (p.amountUsd === 0) return
      const hasPerson = !!p.person?.trim()
      if (!pool) {
        if (unattributed ? hasPerson : !hasPerson || personKey(p.person!) !== pk) return
      }
      parts.push(purchaseLine(p, idx))
    })
  }

  const row = pool ? table.totals : table.rows.find((r) => (unattributed ? r.unattributed : !r.unattributed && personKey(r.name) === pk))
  const cellUsd = row ? row[column] : 0
  const all = [...office, ...bid, ...parts]
  const sumUsd = all.reduce((s, l) => s + l.usd, 0)
  const hours = all.reduce((s, l) => s + lineHours(l), 0)
  const laborUsd = [...office, ...bid].reduce((s, l) => s + l.usd, 0)

  const mkSection = (kind: OverheadCellSectionKind, label: string, lines: OverheadCellLine[]): OverheadCellSection => ({
    kind,
    label,
    lineCount: lines.length,
    usd: lines.reduce((s, l) => s + l.usd, 0),
    hours: lines.reduce((s, l) => s + lineHours(l), 0),
    groups: buildGroups(
      lines.filter((l) => overheadCellLineMatches(l, filter, args.bidLabelById)),
      pool,
      order,
    ),
  })
  const sections: OverheadCellSection[] = []
  if (wantOffice && !unattributed) sections.push(mkSection('office', 'Office labor', office))
  if (wantBid && !unattributed) sections.push(mkSection('bid', 'Bid labor', bid))
  if (wantParts) sections.push(mkSection('parts', 'Office parts', parts))

  const bidIds = [...new Set(bid.map((l) => (l.kind === 'session' ? l.bidId : null)).filter((v): v is string => !!v))]
  return {
    person,
    unattributed,
    column,
    startYmd: table.startYmd,
    endYmd: table.endYmd,
    days: table.days,
    cellUsd,
    sumUsd,
    ties: Math.abs(sumUsd - cellUsd) < 0.005,
    hours,
    avgRateUsd: hours > 0 ? laborUsd / hours : null,
    sections,
    counts: {
      lines: all.length,
      pending: all.filter((l) => l.kind === 'session' && !l.approved).length,
      noWage: all.filter((l) => l.kind === 'session' && l.missingWage).length,
      long: all.filter((l) => l.kind === 'session' && l.long).length,
      stray: all.filter((l) => l.kind === 'session' && l.stray).length,
      noPerson: parts.filter((l) => l.kind === 'purchase' && l.person == null).length,
      shown: sections.reduce((s, sec) => s + sec.groups.reduce((t, g) => t + g.lines.length, 0), 0),
    },
    bidIds,
  }
}

/** The same lines as CSV (every line, filter ignored): one row per session or purchase. */
export function overheadPeopleCellCsv(model: OverheadPeopleCellModel, bidLabelById?: ReadonlyMap<string, string>): string {
  const esc = (v: string | number | null | undefined): string => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows: string[][] = [['date', 'person', 'kind', 'description', 'hours', 'rate', 'amount', 'status', 'section', 'source']]
  for (const sec of model.sections) {
    for (const g of sec.groups) {
      for (const l of g.lines) {
        if (l.kind === 'session') {
          rows.push([
            l.ymd,
            l.person,
            l.bucket === 'office' ? 'office labor' : 'bid labor',
            l.bucket === 'bid' ? (l.bidId ? bidLabelById?.get(l.bidId) ?? l.bidId : '') : l.notes ?? '',
            l.hours.toFixed(2),
            l.wageUsdPerHour == null ? '' : l.wageUsdPerHour.toFixed(2),
            l.usd.toFixed(2),
            [l.approved ? 'approved' : 'awaiting approval', l.missingWage ? 'no wage' : '', l.long ? 'long' : ''].filter(Boolean).join('; '),
            '',
            '',
          ])
        } else {
          rows.push([l.ymd, l.person ?? '', 'office parts', l.label, '', '', l.usd.toFixed(2), '', l.bucket ?? '', l.cardLabel ? `card ${l.cardLabel}` : l.source])
        }
      }
    }
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}
