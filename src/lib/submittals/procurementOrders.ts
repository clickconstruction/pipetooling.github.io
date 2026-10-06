/**
 * The To order lens as orders (the procurement log redraw, PR 2; its card was PR #4527): the log's lines in five sections, each
 * line under the order it belongs to. What can be ordered is grouped by its order-by date, what
 * is ordered and what landed by PO, what waits on the GC by fixture; a part sent back stands
 * alone. Pure: the panel draws these.
 */
import { isCarrier } from './itemParts'
import { describeLeadTime } from './leadTime'
import { approveBy, daysAgoWords, daysBetween, PROCUREMENT_STAGE_LABELS, shortDate, type ProcurementRow } from './procurementLog'

export type OrderTone = 'go' | 'soon' | 'past' | 'late' | 'done' | 'back' | 'quiet'
export type OrderGroupKind = 'to_place' | 'placed' | 'fixture' | 'on_site'

export type OrderGroup = {
  key: string
  kind: OrderGroupKind
  /** "Order by 11/03" · "PO 4502" · "No PO" · the fixture's tag. */
  title: string
  /** How near an order-by date is ("tomorrow"), said only when it presses; else ''. */
  soon: string
  tone: OrderTone
  count: number
  /** What the group's parts share, said once: "EWC-1 · Trim Set, needed 12/08 · 5 wk lead". */
  note: string
  /** The right-hand words: "Arrives 11/03" · "Arrives 10/29, 9 d late" · "answer by 11/10" · "✓ On site 10/15". */
  right: string
  rightTone: OrderTone
  /** A fixture's parts the GC sees first, then the order-only ones. */
  rows: ProcurementRow[]
  /** Where the order-only parts start under a fixture; null when it has none or only those. */
  orderOnlyFrom: number | null
  /** The parts come from more than one fixture, so each line names its tag. */
  showTag: boolean
  /** The parts differ in stage or lead time, so each line says its own. */
  showFacts: boolean
  /** Every part changed since the last update. */
  isNew: boolean
  /** A fixture listing two carriers. */
  warn: string
  /** A fixture with no product yet: there is nothing to order or to answer. */
  noProduct: boolean
  /** The row whose *Their answer* window the fixture's door opens; null for no door. */
  answerItemId: string | null
  openByDefault: boolean
}

export type OrderSectionKind = 'now' | 'on_order' | 'sent_back' | 'waiting' | 'not_sent' | 'on_site'
export type OrderSection = {
  key: string
  kind: OrderSectionKind
  title: string
  count: number
  note: string
  tone: OrderTone
  groups: OrderGroup[]
  /** *Sent back* has no groups: a line per part. */
  rows: ProcurementRow[]
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const shared = <T,>(list: ReadonlyArray<ProcurementRow>, of: (r: ProcurementRow) => T): T | undefined => (list.length > 0 && list.every((r) => of(r) === of(list[0]!)) ? of(list[0]!) : undefined)
const nameOf = (r: ProcurementRow) => r.tag ?? (r.product || 'Item')

/** "EWC-1" · "WHA-200, WHA-300, WHA-500" · "FCO, FD, HB-3 +2" */
export function tagsOf(list: ReadonlyArray<ProcurementRow>): string {
  const tags = [...new Set(list.map(nameOf))]
  return tags.length > 3 ? `${tags.slice(0, 3).join(', ')} +${tags.length - 3}` : tags.join(', ')
}

/** What a group's parts share, and whether a line must say its own stage and lead time. */
function facts(list: ReadonlyArray<ProcurementRow>): { bits: string[]; mixed: boolean } {
  const bits = [tagsOf(list)]
  const stage = shared(list, (r) => r.stage)
  const needed = shared(list, (r) => r.requiredOn)
  const lead = shared(list, (r) => r.leadTimeDays)
  if (list.every((r) => r.orderOnly)) bits.push('order only')
  if (stage) bits.push(`${PROCUREMENT_STAGE_LABELS[stage]}${needed ? `, needed ${shortDate(needed)}` : ''}`)
  if (lead != null) bits.push(`${describeLeadTime(lead)} lead`)
  return { bits, mixed: list.length > 1 && (stage === undefined || lead === undefined) }
}

/** "today" · "tomorrow" · "in 3 days" · "2 days ago" · '' beyond three days out. */
export function orderBySoon(orderBy: string, asOf: string): { words: string; tone: OrderTone } {
  const n = daysBetween(asOf, orderBy)
  if (n == null || n > 3) return { words: '', tone: 'go' }
  if (n < 0) return { words: `${plural(-n, 'day')} ago`, tone: 'past' }
  return { words: n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`, tone: 'soon' }
}

function groupBy(list: ReadonlyArray<ProcurementRow>, keyOf: (r: ProcurementRow) => string): Array<[string, ProcurementRow[]]> {
  const out = new Map<string, ProcurementRow[]>()
  for (const r of list) out.set(keyOf(r), [...(out.get(keyOf(r)) ?? []), r])
  return [...out.entries()]
}

const earliest = (dates: ReadonlyArray<string | null>): string | null => dates.filter((d): d is string => !!d).sort()[0] ?? null
const latest = (dates: ReadonlyArray<string | null>): string | null => dates.filter((d): d is string => !!d).sort().pop() ?? null

/**
 * The To order lens: *Order now* (one section per house, a group per order-by date, soonest
 * first) · *On order* (a group per PO, late first) · *Sent back by the GC* (a line per part) ·
 * *Waiting on their answer* (a group per fixture, in the log's order) · *Not sent to the GC yet*
 * (v2.4663 · the fixtures of a draft nobody has shared: the same groups, with no door and no
 * right-hand words, since nothing is waited for) · *On site* (a group per PO). A section with no
 * lines is left out. `changed` holds the keys changed since the last update; pass none before the
 * first one. `draftRev` is the newest revision's number while it is an unshared draft, null once
 * shared: with it, every line not on the submittal (but a hand line) is not sent yet.
 */
export function orderSections(rows: ReadonlyArray<ProcurementRow>, asOf: string, changed: ReadonlySet<string> = new Set(), draftRev: number | null = null): OrderSection[] {
  const isNew = (list: ReadonlyArray<ProcurementRow>) => changed.size > 0 && list.every((r) => changed.has(r.key))
  const base = (kind: OrderGroupKind, key: string, list: ProcurementRow[]): OrderGroup => {
    const f = facts(list)
    return { key, kind, title: '', soon: '', tone: 'quiet', count: list.length, note: f.bits.join(' · '), right: '', rightTone: 'quiet', rows: list, orderOnlyFrom: null, showTag: shared(list, nameOf) === undefined, showFacts: f.mixed, isNew: isNew(list), warn: '', noProduct: false, answerItemId: null, openByDefault: false }
  }
  const out: OrderSection[] = []

  // Order now: one section a house, the house whose first order is soonest first; no house last.
  const ready = rows.filter((r) => r.status === 'released')
  const byDate = (a: string, b: string) => (a || '9999').localeCompare(b || '9999')
  const houses = groupBy(ready, (r) => r.supplyHouse ?? '').sort(([a, la], [b, lb]) => (a === '' ? 1 : b === '' ? -1 : byDate(earliest(la.map((r) => r.orderBy)) ?? '', earliest(lb.map((r) => r.orderBy)) ?? '') || a.localeCompare(b)))
  for (const [house, list] of houses) {
    const groups = groupBy(list, (r) => r.orderBy ?? '').sort(([a], [b]) => byDate(a, b)).map(([orderBy, parts], i): OrderGroup => {
      const g = base('to_place', `now:${house}:${orderBy}`, parts)
      const soon = orderBy ? orderBySoon(orderBy, asOf) : { words: '', tone: 'quiet' as OrderTone }
      return { ...g, title: orderBy ? `Order by ${shortDate(orderBy)}` : 'No order-by date yet', soon: soon.words, tone: soon.tone, openByDefault: i === 0 }
    })
    out.push({ key: `now:${house}`, kind: 'now', title: house ? `Order now · ${house}` : 'Order now · no house yet', count: list.length, note: `${plural(groups.length, 'order')} to place, by date${house ? '' : ' · set a house to order'}`, tone: 'go', groups, rows: [] })
  }

  // On order: a group per PO, the late ones first, then the soonest to arrive.
  const ordered = rows.filter((r) => r.status === 'ordered')
  if (ordered.length > 0) {
    const worst = (list: ReadonlyArray<ProcurementRow>) => list.filter((r) => r.late).sort((a, b) => (a.floatDays ?? 0) - (b.floatDays ?? 0))[0] ?? null
    const groups = groupBy(ordered, (r) => r.poRef.trim()).map(([po, parts]): OrderGroup => {
      const g = base('placed', `po:${po}`, parts)
      const late = worst(parts)
      const on = shared(parts, (r) => r.orderedOn)
      const arrives = latest(parts.map((r) => r.expectedOn))
      return {
        ...g,
        title: po ? `PO ${po}` : 'No PO',
        note: `${g.note}${on ? ` · ordered ${shortDate(on)}` : ''}`,
        right: late ? `Arrives ${shortDate(late.expectedOn)}, ${Math.abs(late.floatDays ?? 0)} d late` : arrives ? `Arrives ${shortDate(arrives)}` : '',
        rightTone: late ? 'late' : 'quiet',
      }
    })
    groups.sort((a, b) => Number(b.rightTone === 'late') - Number(a.rightTone === 'late') || byDate(earliest(a.rows.map((r) => r.expectedOn)) ?? '', earliest(b.rows.map((r) => r.expectedOn)) ?? ''))
    const late = ordered.filter((r) => r.late).length
    out.push({ key: 'on_order', kind: 'on_order', title: 'On order', count: ordered.length, note: late > 0 ? `${late} late` : '', tone: late > 0 ? 'late' : 'quiet', groups, rows: [] })
  }

  // Sent back: no groups, a line per part.
  const back = rows.filter((r) => r.status === 'sent_back')
  if (back.length > 0) out.push({ key: 'sent_back', kind: 'sent_back', title: 'Sent back by the GC', count: back.length, note: 'pick another product, then resubmit on step 7', tone: 'back', groups: [], rows: back })

  // Waiting: a group per fixture in the log's order; a line added by hand stands as its own.
  // The lines of a draft nobody has shared make the same groups under their own heading (v2.4663).
  const fixtureGroups = (list: ReadonlyArray<ProcurementRow>, sent: boolean) =>
    groupBy(list, (r) => (r.isHand ? r.key : `tag:${r.tag ?? ''}`)).map(([k, parts]): OrderGroup => {
      const gc = parts.filter((r) => !r.orderOnly)
      const orderOnly = parts.filter((r) => r.orderOnly)
      const list = [...gc, ...orderOnly]
      const g = base('fixture', `fx:${k}`, list)
      const first = list[0]!
      const noProduct = list.length === 1 && !first.partKey && (!!first.noProduct || first.product === '(no product)')
      const fixture = list.find((r) => r.fixture)
      const ask = earliest(list.map((r) => approveBy(r)))
      const door = gc.find((r) => r.itemId && !r.noProduct)
      return {
        ...g,
        title: first.isHand ? first.product || 'Item' : first.tag ?? '',
        note: noProduct
          ? ''
          : first.isHand
            ? 'added by hand'
            : list.length === 1
              ? first.product
              : [fixture?.fixture ? `${fixture.fixture}${fixture.fixtureCount != null ? ` × ${fixture.fixtureCount}` : ''}` : '', gc.length > 0 ? plural(gc.length, 'part') : '', orderOnly.length > 0 ? `${orderOnly.length} order only` : ''].filter(Boolean).join(' · '),
        right: sent && ask ? `answer by ${shortDate(ask)}` : '',
        orderOnlyFrom: gc.length > 0 && orderOnly.length > 0 ? gc.length : null,
        showTag: false,
        showFacts: list.length > 1,
        warn: gc.filter((r) => r.partKey && isCarrier(r.product)).length > 1 ? 'Two carriers' : '',
        noProduct,
        answerItemId: sent ? door?.itemId ?? null : null,
      }
    })
  const unsent = (r: ProcurementRow) => draftRev != null && r.status === 'not_submitted' && !r.isHand
  const waiting = rows.filter((r) => (r.status === 'awaiting' || r.status === 'not_submitted') && !unsent(r))
  if (waiting.length > 0) {
    const groups = fixtureGroups(waiting, true)
    const firstAsk = earliest(waiting.map((r) => approveBy(r)))
    out.push({ key: 'waiting', kind: 'waiting', title: 'Waiting on their answer', count: waiting.length, note: `${plural(groups.length, 'fixture')} · ${firstAsk ? `the first needs an answer by ${shortDate(firstAsk)}` : 'not ordered until they approve'}`, tone: 'quiet', groups, rows: [] })
  }
  const notSent = rows.filter(unsent)
  if (notSent.length > 0) {
    const groups = fixtureGroups(notSent, false)
    out.push({ key: 'not_sent', kind: 'not_sent', title: 'Not sent to the GC yet', count: notSent.length, note: `${plural(groups.length, 'fixture')} · share Rev ${draftRev} to get an answer`, tone: 'quiet', groups, rows: [] })
  }

  // On site: a group per PO.
  const site = rows.filter((r) => r.status === 'delivered')
  if (site.length > 0) {
    const groups = groupBy(site, (r) => r.poRef.trim()).map(([po, parts]): OrderGroup => {
      const g = base('on_site', `site:${po}`, parts)
      const on = shared(parts, (r) => r.orderedOn)
      return { ...g, title: po ? `PO ${po}` : 'No PO', note: `${tagsOf(parts)}${on ? ` · ordered ${shortDate(on)}` : ''}`, right: `✓ On site ${shortDate(latest(parts.map((r) => r.deliveredOn)))}`, rightTone: 'done', showFacts: false }
    })
    out.push({ key: 'on_site', kind: 'on_site', title: 'On site', count: site.length, note: '', tone: 'done', groups, rows: [] })
  }
  return out
}

/** "Mark 6 parts ordered": the ticked parts of the group when any are ticked, else the whole group. */
export function rowsToMark(group: Pick<OrderGroup, 'rows'>, ticked: ReadonlySet<string>): ProcurementRow[] {
  const picked = group.rows.filter((r) => ticked.has(r.key))
  return picked.length > 0 ? picked : [...group.rows]
}

/** `They wrote "TEL145"` · `No note from them` */
export function theyWrote(r: Pick<ProcurementRow, 'reviewNote'>): string {
  const note = (r.reviewNote ?? '').trim()
  return note ? `They wrote “${note}”` : 'No note from them'
}

/**
 * An order's date in words, for a card with no calendar (PR 4). An order to place says how far
 * off its order-by date is, to follow the date in its name: *in 8 days* · *tomorrow* · *2 days
 * ago*. The others say the whole of it: *arrives 10/29, 9 days late* · *answer by 11/10* ·
 * *✓ On site 10/15*. '' when it has none.
 */
export function groupDateWords(g: Pick<OrderGroup, 'kind' | 'rows' | 'right' | 'rightTone' | 'tone'>, asOf: string): { words: string; tone: OrderTone } {
  if (g.kind === 'to_place') {
    const orderBy = g.rows.map((r) => r.orderBy).filter((d): d is string => !!d).sort()[0]
    if (!orderBy) return { words: '', tone: 'quiet' }
    return { words: daysBetween(asOf, orderBy) === 1 ? 'tomorrow' : daysAgoWords(orderBy, asOf), tone: g.tone === 'go' ? 'quiet' : g.tone }
  }
  if (g.kind === 'placed') return { words: g.right.replace(/^Arrives/, 'arrives').replace(/(\d+) d late$/, (_, d: string) => `${d} day${d === '1' ? '' : 's'} late`), tone: g.rightTone }
  return { words: g.right, tone: g.kind === 'on_site' ? 'done' : 'quiet' }
}
