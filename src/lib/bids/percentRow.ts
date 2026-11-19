/**
 * The Percent row (Bids → Pricing): a row priced as a percent of other rows, such as
 * Connections at 40% of what the pipe rows sell for.
 *
 * The rule lives on the count row (`bids_count_rows.percent_rule`, migration 20261118220000,
 * per bid version like the row; a copied version carries it). The row's price stays an
 * ordinary saved price, so every reader of a bid's prices is unchanged; the Workbench re-writes
 * that price from the rule while the bid is unsent (`percentRowDrift`, `usePercentRows`).
 *
 * A rule reads rows by their kind or by a tag, never by row id, so a copy needs no re-keying.
 * It never reads itself or another row that carries a rule, so rules cannot chain or loop.
 * Pure.
 */
import { formatCurrency } from '../format'
import { COMPOSITION_LABELS } from './pricingComposition'
import { ROW_KINDS, cleanTag, type RowKind } from './rowKinds'

export type PercentBasis = 'revenue' | 'cost'
export type PercentSource = { kind: RowKind } | { tag: string }
export type PercentRule = { pct: number; basis: PercentBasis; source: PercentSource }

/** The table's own ceiling (`bids_count_rows_percent_rule_shape`). */
export const PERCENT_MAX = 1000

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** A percent as typed: above 0 and at most 1,000, else null. */
export function parsePercent(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[%,\s]/g, ''))
  if (!Number.isFinite(n) || n <= 0 || n > PERCENT_MAX) return null
  return Math.round(n * 1000) / 1000
}

/** The column's value → a rule, or null for none and for anything this build cannot read. */
export function parsePercentRule(raw: unknown): PercentRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const pct = typeof o.pct === 'number' ? parsePercent(o.pct) : null
  const basis = o.basis === 'revenue' || o.basis === 'cost' ? o.basis : null
  const src = o.source && typeof o.source === 'object' && !Array.isArray(o.source) ? (o.source as Record<string, unknown>) : null
  if (pct == null || !basis || !src) return null
  if (typeof src.kind === 'string' && (ROW_KINDS as string[]).includes(src.kind)) return { pct, basis, source: { kind: src.kind as RowKind } }
  if (typeof src.tag === 'string' && cleanTag(src.tag) !== '') return { pct, basis, source: { tag: cleanTag(src.tag) } }
  return null
}

/** A rule → the column's value. */
export function percentRuleToDb(rule: PercentRule): { pct: number; basis: PercentBasis; source: { kind: string } | { tag: string } } {
  return { pct: rule.pct, basis: rule.basis, source: 'kind' in rule.source ? { kind: rule.source.kind } : { tag: rule.source.tag } }
}

/** One key per source, for a select and for a remembered rule: `kind:pipe`, `tag:water`. */
export function percentSourceKey(source: PercentSource): string {
  return 'kind' in source ? `kind:${source.kind}` : `tag:${source.tag}`
}

export function percentSourceFromKey(key: string): PercentSource | null {
  if (key.startsWith('kind:') && (ROW_KINDS as string[]).includes(key.slice(5))) return { kind: key.slice(5) as RowKind }
  if (key.startsWith('tag:') && cleanTag(key.slice(4)) !== '') return { tag: cleanTag(key.slice(4)) }
  return null
}

/** The rows a rule reads, as the Kind breakdown names them: Pipe, Fixtures, or the tag's own word. */
export function percentSourceWords(source: PercentSource): string {
  return 'kind' in source ? COMPOSITION_LABELS[source.kind].name : source.tag
}

/** 40, 37.5, 12.125: a percent with no trailing zeros. */
export function percentWords(pct: number): string {
  return String(Math.round(pct * 1000) / 1000)
}

/** The rule in words, as the row's chip says it: "40% of Pipe revenue". */
export function percentRuleWords(rule: PercentRule): string {
  return `${percentWords(rule.pct)}% of ${percentSourceWords(rule.source)} ${rule.basis}`
}

/** A grid row as the rule reads it: saved prices only, never a draft or a solver preview. */
export type PercentGridRow = {
  id: string
  name: string
  kind: RowKind
  tags: ReadonlyArray<string>
  count: number
  /** The row's saved revenue. */
  revenue: number
  /** The row's cost (labor, material and tax); 0 with none. */
  cost: number
  /** The saved price per unit; read only when `priced`. */
  unitPrice: number
  priced: boolean
  isFixedPrice: boolean
  rule: PercentRule | null
}

const matches = (r: PercentGridRow, source: PercentSource): boolean => ('kind' in source ? r.kind === source.kind : r.tags.includes(source.tag))

/** The rows a rule reads: of its kind or carrying its tag; never the row itself, never a row with a rule of its own. */
export function percentSourceRows(rows: ReadonlyArray<PercentGridRow>, source: PercentSource, selfId: string | null): PercentGridRow[] {
  return rows.filter((r) => r.id !== selfId && r.rule == null && matches(r, source))
}

export type PercentAnswer = {
  /** How many rows the rule read. */
  sourceCount: number
  /** Their revenue or their cost, added up. */
  base: number
  /** What the row sells for: the percent of the base, to the cent. */
  revenue: number
  /** The price per unit that gives that revenue on this row's count. */
  unitPrice: number
}

/** What a rule comes to on a row. A row counted more than once spreads the revenue over its count. */
export function percentRowAnswer(rows: ReadonlyArray<PercentGridRow>, rule: PercentRule, self: { id: string | null; count: number; isFixedPrice: boolean }): PercentAnswer {
  const src = percentSourceRows(rows, rule.source, self.id)
  const base = round2(src.reduce((s, r) => s + (rule.basis === 'revenue' ? r.revenue : r.cost), 0))
  const revenue = round2((base * rule.pct) / 100)
  const unitPrice = self.isFixedPrice || !(self.count > 0) ? revenue : round2(revenue / self.count)
  return { sourceCount: src.length, base, revenue, unitPrice }
}

/** The row's chip: "40% of Pipe revenue · $6,200.00". */
export function percentRuleChip(rule: PercentRule, base: number): string {
  return `${percentRuleWords(rule)} · $${formatCurrency(base)}`
}

export type PercentDrift = { rowId: string; name: string; unitPrice: number; saved: number | null; answer: PercentAnswer }

/** The rule rows whose saved price is not what their rule comes to: what the Workbench writes so each follows. */
export function percentRowDrift(rows: ReadonlyArray<PercentGridRow>): PercentDrift[] {
  const out: PercentDrift[] = []
  for (const r of rows) {
    if (!r.rule) continue
    const answer = percentRowAnswer(rows, r.rule, r)
    const saved = r.priced ? r.unitPrice : null
    if (saved != null && Math.abs(saved - answer.unitPrice) < 0.005) continue
    out.push({ rowId: r.id, name: r.name, unitPrice: answer.unitPrice, saved, answer })
  }
  return out
}

export type PercentSourceOption = { key: string; source: PercentSource; label: string; rows: number; revenue: number; cost: number }

/** What a rule on `selfId` may read: each kind with rows, in the breakdown's order, then each tag. */
export function percentSourceOptions(rows: ReadonlyArray<PercentGridRow>, selfId: string | null): PercentSourceOption[] {
  const option = (source: PercentSource): PercentSourceOption | null => {
    const src = percentSourceRows(rows, source, selfId)
    if (src.length === 0) return null
    const words = percentSourceWords(source)
    return {
      key: percentSourceKey(source),
      source,
      label: `${'tag' in source ? `tagged ${words}` : words} · ${src.length} ${src.length === 1 ? 'row' : 'rows'}`,
      rows: src.length,
      revenue: round2(src.reduce((s, r) => s + r.revenue, 0)),
      cost: round2(src.reduce((s, r) => s + r.cost, 0)),
    }
  }
  const kinds = ROW_KINDS.map((kind) => option({ kind }))
  const tags = [...new Set(rows.filter((r) => r.id !== selfId && r.rule == null).flatMap((r) => r.tags))].sort().map((tag) => option({ tag }))
  return [...kinds, ...tags].filter((o): o is PercentSourceOption => o != null)
}

/** What the window holds while it is open. */
export type PercentWindowValue = {
  name: string
  kind: RowKind
  /** The percent as typed. */
  pct: string
  basis: PercentBasis
  /** A `percentSourceKey`, or '' with none picked. */
  sourceKey: string
  /** Keep following the rows; off = the number alone, a plain typed price. */
  follow: boolean
  /** The row picked from the list when the window puts a number on a row already here (the calculator's Put on a row…). */
  rowId?: string | null
}

export type PercentWindowPreview = {
  rule: PercentRule | null
  /** The rule to save: null when Keep following is off. */
  ruleToSave: PercentRule | null
  answer: PercentAnswer | null
  /** The chip as the grid will draw it; null with no rule to save. */
  chip: string | null
  bidRevenueBefore: number
  bidRevenueAfter: number
  /** The row the press writes: the row the window was opened on, else a row already on the bid under the typed name; null for a new row. */
  target: PercentGridRow | null
  /** Why the press is dead; null when it is live. */
  hold: string | null
  /** The press, naming what it will do. */
  label: string
}

/**
 * The window's live reading: the new row as the grid will show it, the bid's revenue before and
 * after, and the press. `self` is the row being changed; null for a new row, counted as 1. A name
 * typed for a new row that is already a row on the bid sets that row: her bids already carry a
 * Connections row, and a second one under the same name would be a duplicate.
 * `fixedRevenue` is a number sent from the calculator: the price when Keep following is off, or
 * when no rule can be read from what is picked.
 */
export function percentWindowPreview(args: {
  rows: ReadonlyArray<PercentGridRow>
  self: PercentGridRow | null
  value: PercentWindowValue
  fixedRevenue?: number | null
  /** The window puts a number on a row already here: a row must be picked, and no name is typed. */
  pickRow?: boolean
}): PercentWindowPreview {
  const { rows, value } = args
  const name = value.name.trim()
  const picked = value.rowId ? (rows.find((r) => r.id === value.rowId) ?? null) : null
  const self = args.self ?? picked ?? (name === '' ? null : (rows.find((r) => r.name.trim().toLowerCase() === name.toLowerCase()) ?? null))
  const pct = parsePercent(value.pct)
  const source = percentSourceFromKey(value.sourceKey)
  const rule = pct != null && source ? { pct, basis: value.basis, source } : null
  const selfShape = { id: self?.id ?? null, count: self ? self.count : 1, isFixedPrice: self?.isFixedPrice ?? false }
  const fromRule = rule ? percentRowAnswer(rows, rule, selfShape) : null
  const fixed = args.fixedRevenue != null && Number.isFinite(args.fixedRevenue) && args.fixedRevenue >= 0 ? round2(args.fixedRevenue) : null
  // Off Keep following, a number from the calculator stands as it is; with none, the rule's answer is typed once.
  const answer: PercentAnswer | null =
    !value.follow && fixed != null
      ? { sourceCount: fromRule?.sourceCount ?? 0, base: fromRule?.base ?? 0, revenue: fixed, unitPrice: selfShape.isFixedPrice || !(selfShape.count > 0) ? fixed : round2(fixed / selfShape.count) }
      : fromRule
  const ruleToSave = value.follow ? rule : null
  const bidRevenueBefore = round2(rows.reduce((s, r) => s + r.revenue, 0))
  // Until there is an answer nothing would change: a row already on the bid keeps its price in the bid's total.
  const bidRevenueAfter = answer ? round2(bidRevenueBefore - (self?.revenue ?? 0) + answer.revenue) : bidRevenueBefore
  const hold =
    args.pickRow && !self
      ? 'Pick the row first.'
      : name === '' && !self
        ? 'Name the row first.'
        : answer == null
          ? pct == null
            ? 'Type a percent above 0.'
            : 'Pick the rows it is a percent of.'
          : null
  const money = answer ? `$${formatCurrency(answer.revenue)}` : ''
  const shown = self ? self.name : name
  const label = answer == null ? (self ? `Set ${shown || 'the row'}` : `Add ${shown || 'the row'}`) : self ? `Set ${shown} to ${money}` : `Add ${shown} at ${money}`
  return { rule, ruleToSave, answer, chip: ruleToSave && fromRule ? percentRuleChip(ruleToSave, fromRule.base) : null, bidRevenueBefore, bidRevenueAfter, target: self, hold, label }
}

/** What this device keeps of the last rule made, so the window opens filled with it. */
export type PercentRowLast = { name: string; kind: RowKind; pct: string; basis: PercentBasis; sourceKey: string }

export const PERCENT_ROW_LAST_KEY = 'pipetooling_percent_row_last_v1'

export function readPercentRowLast(storage: Pick<Storage, 'getItem'> | null): PercentRowLast | null {
  try {
    const o = JSON.parse(storage?.getItem(PERCENT_ROW_LAST_KEY) ?? 'null') as Partial<PercentRowLast> | null
    if (!o || typeof o.name !== 'string' || parsePercent(o.pct ?? '') == null || percentSourceFromKey(String(o.sourceKey ?? '')) == null) return null
    return {
      name: o.name,
      kind: (ROW_KINDS as string[]).includes(String(o.kind)) ? (o.kind as RowKind) : 'fitting',
      pct: String(o.pct),
      basis: o.basis === 'cost' ? 'cost' : 'revenue',
      sourceKey: String(o.sourceKey),
    }
  } catch {
    return null
  }
}

export function writePercentRowLast(storage: Pick<Storage, 'setItem'> | null, last: PercentRowLast): void {
  try {
    storage?.setItem(PERCENT_ROW_LAST_KEY, JSON.stringify(last))
  } catch {
    // A browser that refuses storage opens the window on its first-time picks next time.
  }
}

/**
 * What the window opens on. A row with a rule opens on it. A new row opens on this device's last
 * rule when its rows are on this bid, else on Pipe and Revenue with the percent left empty: the
 * app suggests no percent of its own. `from` is a calculator answer the window was sent.
 */
export function percentWindowStart(args: {
  rows: ReadonlyArray<PercentGridRow>
  self: PercentGridRow | null
  last: PercentRowLast | null
  from?: { pct: number | null; basis: PercentBasis | null; sourceKey: string | null } | null
  /** The window opens to put a number on a row already here: no name, no row picked yet. */
  pickRow?: boolean
}): PercentWindowValue {
  const { rows, self, last, from } = args
  const options = percentSourceOptions(rows, self?.id ?? null)
  const has = (key: string | null | undefined): key is string => !!key && options.some((o) => o.key === key)
  const firstKey = options.find((o) => o.key === 'kind:pipe')?.key ?? options[0]?.key ?? ''
  if (self?.rule) {
    const key = percentSourceKey(self.rule.source)
    return { name: self.name, kind: self.kind, pct: percentWords(self.rule.pct), basis: self.rule.basis, sourceKey: has(key) ? key : firstKey, follow: true }
  }
  if (from) {
    return {
      name: self?.name ?? (args.pickRow ? '' : (last?.name ?? 'Connections')),
      kind: self?.kind ?? last?.kind ?? 'fitting',
      pct: from.pct != null ? percentWords(from.pct) : '',
      basis: from.basis ?? 'revenue',
      sourceKey: has(from.sourceKey) ? from.sourceKey : firstKey,
      // A number with no rule behind it can only be typed once.
      follow: from.pct != null && has(from.sourceKey),
      rowId: null,
    }
  }
  if (self) return { name: self.name, kind: self.kind, pct: last && has(last.sourceKey) ? last.pct : '', basis: last?.basis ?? 'revenue', sourceKey: has(last?.sourceKey) ? last!.sourceKey : firstKey, follow: true }
  if (last && has(last.sourceKey)) return { name: last.name, kind: last.kind, pct: last.pct, basis: last.basis, sourceKey: last.sourceKey, follow: true }
  return { name: 'Connections', kind: 'fitting', pct: '', basis: 'revenue', sourceKey: firstKey, follow: true }
}
