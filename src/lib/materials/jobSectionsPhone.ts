/**
 * A job's Materials page on a phone (v2.8292): the rows under its **Missing**, **Used** and **Came in** tiles.
 *
 * v2.8282 drew the four figures as tiles and v2.8284 the boxes as rows, but three of the tiles still opened tables:
 * twelve columns of what each part did, eight of the counts that came up short, five of the deliveries and eight of
 * every press. A phone showed two or three of them.
 *
 * Here each table's row is laid out for a phone the way the search's finds are (v2.8291): the thing on top, its facts
 * under it in the table's own words, and the one number the table is about as a figure at the row's end. Nothing is
 * worked out here that the table does not already hold. Money, the price's chip and a stamp are drawn by the screen,
 * which has the pieces for them. Pure.
 */
import { flowFigure } from './flowRow'
import type { ComparisonRow } from './manifest'
import { REASON_WORDS, type CountDiff, type Movement } from './onSite'

/** A row's number over its words. The tone is what the number means: a gap, a refusal, a find, or nothing to act on. */
export type SectionFigure = { figure: string; words: string; tone: 'plain' | 'amber' | 'red' | 'green' | 'blue' }

/** `bought 100`, skipping a zero: the table leaves a zero blank in these columns. */
function said(words: string, n: number): string {
  return n ? `${words} ${flowFigure(n)}` : ''
}

// ── Missing · what each part did ──────────────────────────────────────────────────────────────────────────────────

export type ComparisonPhoneRow = {
  key: string
  title: string
  maker: string
  /** What nobody can account for: the column the table is read for. Amber above zero, green at zero as the table's chip is. */
  figure: SectionFigure
  /** `bought 100 · left 94`: the two columns the table draws in bold. Always both, zero or not. */
  held: string
  /** `added on site 4 · used 2 · returned 1 · taken or damaged 3 · can’t find 1`, or '' when nothing was reported. */
  reported: string
  /** Something walked away: the row is marked, as the table tints it. */
  marked: boolean
  /** What walked away, priced. Null when nothing did or the part has no price. */
  money: number | null
  /** Something walked away and no price turns it into money: the table says *no price*. */
  noPrice: boolean
  lastCountAt: string | null
}

export function comparisonPhoneRow(r: ComparisonRow): ComparisonPhoneRow {
  return {
    key: r.partKey,
    title: r.partName,
    maker: (r.manufacturer ?? '').trim(),
    figure: { figure: flowFigure(r.walkedAway), words: 'walked away', tone: r.walkedAway > 0 ? 'amber' : 'green' },
    held: `bought ${flowFigure(r.bought)} · left ${flowFigure(r.left)}`,
    reported: [said('added on site', r.addedOnSite), said('used', r.used), said('returned', r.returned), said('taken or damaged', r.takenOrDamaged), said('can’t find', r.cannotFind)].filter(Boolean).join(' · '),
    marked: r.walkedAway > 0,
    money: r.money,
    noPrice: r.money == null && r.walkedAway > 0,
    lastCountAt: r.lastCountAt,
  }
}

/**
 * The press that draws the parts nothing walked away from. On a phone the Missing section leads with the parts that
 * have a gap, and a job can hold a hundred that have none: they wait behind this press, with their count on it.
 */
export function quietPartsLabel(n: number): string {
  return n === 1 ? 'Show 1 part with nothing walked away' : `Show ${flowFigure(n)} parts with nothing walked away`
}

/** The comparison's rows for a phone: the parts with a gap first, in the table's order, then the rest. */
export function splitComparison<T extends Pick<ComparisonRow, 'walkedAway'>>(rows: ReadonlyArray<T>): { gap: T[]; quiet: T[] } {
  return { gap: rows.filter((r) => r.walkedAway > 0), quiet: rows.filter((r) => !(r.walkedAway > 0)) }
}

// ── Missing · what was reported ───────────────────────────────────────────────────────────────────────────────────

export type ReportedPhoneRow = {
  key: string
  title: string
  maker: string
  /** `short`: a count found fewer. `found`: a count found more. `cannot`: someone pressed Can't find. */
  kind: 'short' | 'found' | 'cannot'
  figure: SectionFigure
  /** The box, and for a count what was expected and what was counted: `G12 · expected 97 · counted 94`. */
  facts: string
  /** How many pieces the money is for, signed as `missingMoney` takes it: negative is missing. */
  moneyQty: number
  partKey: string
  boxId: string | null
  byName: string
  at: string
  note: string
}

/** A count that did not match what the ledger expected. */
export function countDiffPhoneRow(d: CountDiff, boxLabel: string): ReportedPhoneRow {
  const short = d.diff < 0
  return {
    key: d.movementId,
    title: d.partName,
    maker: (d.manufacturer ?? '').trim(),
    kind: short ? 'short' : 'found',
    figure: short ? { figure: flowFigure(-d.diff), words: 'missing', tone: 'amber' } : { figure: flowFigure(d.diff), words: 'found', tone: 'blue' },
    facts: [boxLabel, `expected ${flowFigure(d.expected)}`, `counted ${flowFigure(d.counted)}`].filter(Boolean).join(' · '),
    moneyQty: d.diff,
    partKey: d.partKey,
    boxId: d.containerId,
    byName: d.byName,
    at: d.at,
    note: '',
  }
}

/** A Can't find press: no count stands behind it, so it says only the box. `partKey` is the caller's, from the ledger's own rule. */
export function cannotFindPhoneRow(m: Movement, boxLabel: string, partKey: string): ReportedPhoneRow {
  return {
    key: m.id,
    title: m.partName,
    maker: (m.manufacturer ?? '').trim(),
    kind: 'cannot',
    figure: { figure: flowFigure(m.quantity), words: 'can’t find', tone: 'red' },
    facts: boxLabel,
    moneyQty: -m.quantity,
    partKey,
    boxId: m.fromContainerId,
    byName: m.byName,
    at: m.at,
    note: (m.note ?? '').trim(),
  }
}

// ── Came in · deliveries so far ───────────────────────────────────────────────────────────────────────────────────

export type DeliveryPhoneRow = { key: string; title: string; facts: string; figure: SectionFigure }

/** One invoice or PO that landed. `whenWords` is the day and time as the screen writes them. */
export function deliveryPhoneRow(d: { source: string; at: string; by: string; lines: number; qty: number }, whenWords: string): DeliveryPhoneRow {
  return {
    key: d.source,
    title: d.source,
    facts: [whenWords, d.by, d.lines === 1 ? '1 line' : `${flowFigure(d.lines)} lines`].filter(Boolean).join(' · '),
    figure: { figure: flowFigure(d.qty), words: d.qty === 1 ? 'piece' : 'pieces', tone: 'plain' },
  }
}

// ── Used · every press ────────────────────────────────────────────────────────────────────────────────────────────

/** A press's quantity as History signs it: a delivery adds, a count and a move are a plain number, the rest take away. */
export function movementSign(reason: Movement['reason']): '' | '+' | '−' {
  return reason === 'counted' || reason === 'moved' ? '' : reason === 'delivered' ? '+' : '−'
}

/** Where a press happened, as History's *Where* column says it. `labelOf` names a box. */
export function movementWhereWords(m: Pick<Movement, 'reason' | 'fromContainerId' | 'toContainerId' | 'source' | 'note'>, labelOf: (id: string | null) => string): string {
  if (m.reason === 'delivered') return `→ ${labelOf(m.toContainerId)}${m.source ? ` · ${m.source}` : ''}`
  if (m.reason === 'moved') return `${labelOf(m.fromContainerId)} → ${labelOf(m.toContainerId)}`
  if (m.reason === 'returned') return `${labelOf(m.fromContainerId)} → the supply house`
  if (m.reason === 'taken') return `${labelOf(m.fromContainerId)} → ${m.note || 'off site'}`
  return labelOf(m.fromContainerId)
}

export type HistoryPhoneRow = {
  key: string
  title: string
  /** `Count`, `Used`, `Returned`: History's *What*. */
  what: string
  /** A return is owed a credit: History draws a chip beside it. */
  creditDue: boolean
  where: string
  /** `+25`, `−3`, `94`. */
  figure: SectionFigure
  byName: string
  at: string
  /** The press's note. A take's note is where it went, which `where` already says. */
  note: string
}

export function historyPhoneRow(m: Movement, labelOf: (id: string | null) => string): HistoryPhoneRow {
  return {
    key: m.id,
    title: m.partName,
    what: REASON_WORDS[m.reason].past,
    creditDue: m.reason === 'returned',
    where: movementWhereWords(m, labelOf),
    figure: { figure: `${movementSign(m.reason)}${flowFigure(m.quantity)}`, words: '', tone: 'plain' },
    byName: m.byName,
    at: m.at,
    note: m.reason === 'taken' ? '' : (m.note ?? '').trim(),
  }
}

// ── A long list, a screen at a time ───────────────────────────────────────────────────────────────────────────────

/** How many rows a phone draws before it asks. A job can hold thousands of presses, and a phone should not draw them all. */
export const SECTION_PHONE_PAGE = 60

/**
 * The first `shown` rows, how many are left, and the press that draws more. The press says its own count: *Show 60
 * more* while more than a page is left, *Show the last 12* when the next press ends the list. Null when all are drawn.
 */
export function pagePhoneRows<T>(rows: ReadonlyArray<T>, shown: number, page: number = SECTION_PHONE_PAGE): { rows: T[]; left: number; moreLabel: string | null; next: number } {
  const take = Math.max(page, shown)
  const left = Math.max(0, rows.length - take)
  return {
    rows: rows.slice(0, take),
    left,
    moreLabel: left === 0 ? null : left > page ? `Show ${flowFigure(page)} more` : `Show the last ${flowFigure(left)}`,
    next: take + page,
  }
}
