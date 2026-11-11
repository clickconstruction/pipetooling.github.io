/**
 * A saved price sheet, sorted into what is ready and what needs a person (punch list #308, PR 4).
 *
 * Every row gets its card (`rowCard`) and lands in one bucket. The window opens on the rows that
 * need her, folds the ready ones by fixture, and says the counts in one line. Pure.
 */
import { matchRow, type BookIndex, type BookPart, type HouseCode, type PartMatch } from '../partMatch'
import type { PricingUnit } from './pastedRow'
import { rowCard, type OnFilePrice, type RowCard } from './rowCard'

export type SheetLine = {
  id: string
  lineNo: number
  groupNo: number | null
  kind: 'part' | 'charge' | 'component'
  houseCode: string
  description: string
  qty: number | null
  unitPrice: number | null
  pricingUnit: PricingUnit
  partId: string | null
  filedAt: string | null
  filedPrice: number | null
  heldWhy: string
  page?: number | null
}

export type SheetGroup = {
  id: string
  groupNo: number
  tag: string
  label: string
  eachPrice: number | null
  placedAt: string | null
  heldWhy: string
  /** What a placement left behind (PR 6): the assembly used, the bid's rows, the takeoff lines, and the bundle price set and replaced. */
  templateId?: string | null
  countRowIds?: string[]
  placedLineIds?: string[]
  bundlePrice?: number | null
  replacedBundlePrice?: number | null
  replacedBundleEffectiveDate?: string | null
}

/** Where a row stands. */
export type RowBucket =
  /** Filed already. */
  | 'filed'
  /** The house's own number, nothing to ask: goes with the one press. */
  | 'ready'
  /** The model number, the name or the words on one part: confirmed together after one look. */
  | 'confirm'
  /** A question only a person answers. */
  | 'needs_you'
  /** A charge, or the house's catch-all number: it stays inside its fixture's bundle price. */
  | 'charge'
  /** A person left it out. */
  | 'left_out'

export type PlannedRow<T extends BookPart = BookPart> = {
  line: SheetLine
  match: PartMatch<T>
  /** A person picked the part for this row. */
  picked: boolean
  card: RowCard
  bucket: RowBucket
}

export type PlannedGroup<T extends BookPart = BookPart> = {
  group: SheetGroup
  rows: PlannedRow<T>[]
  /** The priced rows' sum against the printed subtotal: true, false, or null when rows carry no price to add. */
  addsUp: boolean | null
  /** The sum of the priced rows, each times its quantity, when every row carries a price. */
  rowsSum: number | null
  /** Every row is filed, ready, a charge or left out: the fixture can be placed. */
  ready: boolean
}

export type SheetPlan<T extends BookPart = BookPart> = {
  rows: PlannedRow<T>[]
  groups: PlannedGroup<T>[]
  /** Rows under no fixture heading. */
  loose: PlannedRow<T>[]
  counts: Record<RowBucket, number> & { rows: number; fixtures: number; fixturesReady: number; notAddingUp: number }
}

const CHARGE_WORDS = /^(?:misc(?:\.|ellaneous)?\s+charge|freight|shipping|delivery(?:\s+charge)?|fuel\s+surcharge|handling|restock(?:ing)?\s+fee)\b/i

/** A row that is money and no part: a charge line, or words that say so. */
export function isChargeRow(line: Pick<SheetLine, 'kind' | 'description'>): boolean {
  return line.kind === 'charge' || CHARGE_WORDS.test(line.description.trim())
}

export type SheetPlanContext<T extends BookPart = BookPart> = {
  supplyHouseId: string | null
  houseName: string | null
  book: BookIndex<T>
  codes: Map<string, HouseCode>
  /** What the book holds at this house, by part id. */
  onFile: Map<string, OnFilePrice>
  /** The sheet's day, YYYY-MM-DD. */
  datedOn: string
  /** Parts a person picked for a row, by line id. */
  picks?: Record<string, T | undefined>
}

function bucketOf(line: SheetLine, card: RowCard): RowBucket {
  if (line.filedAt) return 'filed'
  if (line.heldWhy === 'left_out') return 'left_out'
  if (card.status === 'not_a_part' || isChargeRow(line)) return 'charge'
  if (card.status === 'ready') return 'ready'
  if (card.status === 'offer') return 'confirm'
  // A kit row carries no price: the house's own number makes it ready, another key is confirmed with the rest.
  if (card.status === 'no_price') return card.chip.tone === 'green' ? 'ready' : 'confirm'
  return 'needs_you'
}

export function planSheet<T extends BookPart>(lines: SheetLine[], groups: SheetGroup[], ctx: SheetPlanContext<T>): SheetPlan<T> {
  const rows: PlannedRow<T>[] = [...lines]
    .sort((a, b) => a.lineNo - b.lineNo)
    .map((line) => {
      const pick = ctx.picks?.[line.id]
      const onBook = !pick && line.partId ? ctx.book.byId.get(line.partId) : undefined
      const chosen = pick ?? onBook
      const match: PartMatch<T> = chosen
        ? { how: 'same_name', part: chosen, rivals: [chosen], model: null }
        : matchRow({ supplyHouseId: ctx.supplyHouseId, houseCode: line.houseCode, description: line.description }, ctx.book, ctx.codes)
      const card = rowCard({
        row: { houseCode: line.houseCode, description: line.description, unitPrice: line.unitPrice, pricingUnit: line.pricingUnit, lines: 1 },
        houseName: ctx.houseName,
        match,
        onFile: match.part ? (ctx.onFile.get(match.part.id) ?? null) : null,
        datedOn: ctx.datedOn,
      })
      // A part kept on a row that is not filed yet is a person's pick, made in this window or an earlier one.
      return { line, match, picked: Boolean(pick) || (onBook != null && !line.filedAt), card, bucket: bucketOf(line, card) }
    })

  const planned: PlannedGroup<T>[] = [...groups]
    .sort((a, b) => a.groupNo - b.groupNo)
    .map((group) => {
      const mine = rows.filter((r) => r.line.groupNo === group.groupNo)
      const priced = mine.filter((r) => r.line.unitPrice != null)
      const allPriced = mine.length > 0 && priced.length === mine.length
      const rowsSum = allPriced ? Math.round(mine.reduce((sum, r) => sum + (r.line.qty ?? 1) * (r.card.each ?? r.line.unitPrice ?? 0), 0) * 100) / 100 : null
      const addsUp = rowsSum != null && group.eachPrice != null ? Math.abs(rowsSum - group.eachPrice) <= 0.02 * Math.max(1, mine.length) : null
      const ready = mine.length > 0 && addsUp !== false && mine.every((r) => r.bucket === 'filed' || r.bucket === 'ready' || r.bucket === 'charge' || r.bucket === 'left_out')
      return { group, rows: mine, addsUp, rowsSum, ready }
    })

  const counts = { rows: rows.length, fixtures: planned.length, fixturesReady: planned.filter((g) => g.ready).length, notAddingUp: planned.filter((g) => g.addsUp === false).length, filed: 0, ready: 0, confirm: 0, needs_you: 0, charge: 0, left_out: 0 }
  for (const r of rows) counts[r.bucket] += 1
  const grouped = new Set(planned.map((g) => g.group.groupNo))
  return { rows, groups: planned, loose: rows.filter((r) => r.line.groupNo == null || !grouped.has(r.line.groupNo)), counts }
}

/** The one line at the head of the window: what was read and where it stands. */
export function sheetVerdict(plan: SheetPlan, pages: number | null): { head: string; chips: { tone: 'green' | 'blue' | 'amber' | 'gray'; label: string }[]; foot: string | null } {
  const c = plan.counts
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  const head = [pages ? n(pages, 'page', 'pages') : null, c.fixtures ? n(c.fixtures, 'fixture', 'fixtures') : null, n(c.rows, 'row', 'rows')].filter(Boolean).join(' · ')
  const chips: { tone: 'green' | 'blue' | 'amber' | 'gray'; label: string }[] = []
  if (c.filed) chips.push({ tone: 'gray', label: `${c.filed} filed` })
  if (c.ready) chips.push({ tone: 'green', label: `${c.ready} ready` })
  if (c.confirm) chips.push({ tone: 'blue', label: `${c.confirm} to confirm together` })
  if (c.needs_you) chips.push({ tone: 'amber', label: c.needs_you === 1 ? '1 needs you' : `${c.needs_you} need you` })
  if (c.charge) chips.push({ tone: 'gray', label: c.charge === 1 ? '1 charge stays in its bundle' : `${c.charge} charges stay in their bundles` })
  if (c.left_out) chips.push({ tone: 'gray', label: `${c.left_out} left out` })
  const off = plan.groups.filter((g) => g.addsUp === false).map((g) => g.group.tag || `fixture ${g.group.groupNo}`)
  const foot = off.length ? `${off.join(', ')} ${off.length === 1 ? 'does' : 'do'} not add up to ${off.length === 1 ? 'its' : 'their'} subtotal.` : null
  return { head: `${head}.`, chips, foot }
}

/** How many rows of a sheet still wait on a person or a press: the chip's count. */
export function waitingCount(plan: SheetPlan): number {
  return plan.counts.ready + plan.counts.confirm + plan.counts.needs_you
}
