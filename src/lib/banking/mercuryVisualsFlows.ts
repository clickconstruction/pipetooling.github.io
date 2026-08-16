/**
 * Pure data kernels for the Banking → Mercury → Visuals tab (v2.1712): turn
 * transaction/label/allocation rows into `SankeyInput`s for the three views.
 *
 * A — buildMoneyFlowSankey:   income → expense families → accounting labels
 * B — buildTransferSankey:    account → account internal-transfer routing
 * C — buildCardsJobsSankey:   card spend by person → job splits
 *
 * Books rules match the rest of Banking: rows marked as duplicates are
 * excluded everywhere, and Internal Transfers are excluded from the money
 * flow (A) but ARE the subject of B.
 */

import type { SankeyInput, SankeyNodeInput, SankeyTone } from './mercurySankeyLayout'

export type VisualsPeriod = 'month' | 'quarter' | 'ytd' | 'all'

export type VisualsTxRow = {
  id: string
  amount: number
  kind: string
  /** Wall date in APP_CALENDAR_TZ ('' when posted_at is missing/invalid). */
  postedYmd: string
  accountId: string
  isDuplicate: boolean
}

/** First day of the period containing `todayYmd`, or null for no lower bound. */
export function visualsPeriodStartYmd(period: VisualsPeriod, todayYmd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayYmd)
  if (!m || period === 'all') return null
  const year = m[1]
  const month = Number(m[2])
  if (period === 'month') return `${year}-${String(month).padStart(2, '0')}-01`
  if (period === 'quarter') {
    const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1
    return `${year}-${String(qStartMonth).padStart(2, '0')}-01`
  }
  return `${year}-01-01`
}

/** Drop duplicates always; apply the period lower bound when there is one. */
export function filterVisualsTxs(txs: VisualsTxRow[], period: VisualsPeriod, todayYmd: string): VisualsTxRow[] {
  return filterVisualsTxsByWindow(txs, { startYmd: visualsPeriodStartYmd(period, todayYmd), endYmd: null })
}

// ————————————————————————————————— Period zoom (v2.1716) —————————————————————————————————

export type VisualsZoom = { year: number; quarter: 1 | 2 | 3 | 4 | null }
export type VisualsSelection = { kind: 'preset'; preset: VisualsPeriod } | { kind: 'zoom'; zoom: VisualsZoom }
/** Inclusive YMD bounds; null = unbounded on that side. */
export type VisualsWindow = { startYmd: string | null; endYmd: string | null }

const QUARTER_BOUNDS = [
  { start: '01-01', end: '03-31', range: 'Jan 1 – Mar 31' },
  { start: '04-01', end: '06-30', range: 'Apr 1 – Jun 30' },
  { start: '07-01', end: '09-30', range: 'Jul 1 – Sep 30' },
  { start: '10-01', end: '12-31', range: 'Oct 1 – Dec 31' },
] as const

/** Absolute window + display labels for a year / quarter zoom. */
export function visualsZoomWindow(zoom: VisualsZoom): {
  startYmd: string
  endYmd: string
  label: string
  rangeLabel: string
} {
  if (zoom.quarter == null) {
    return {
      startYmd: `${zoom.year}-01-01`,
      endYmd: `${zoom.year}-12-31`,
      label: String(zoom.year),
      rangeLabel: `Jan 1 – Dec 31, ${zoom.year}`,
    }
  }
  const q = QUARTER_BOUNDS[zoom.quarter - 1]!
  return {
    startYmd: `${zoom.year}-${q.start}`,
    endYmd: `${zoom.year}-${q.end}`,
    label: `Q${zoom.quarter} ${zoom.year}`,
    rangeLabel: `${q.range}, ${zoom.year}`,
  }
}

/** Resolve either selection kind to one window. */
export function visualsSelectionWindow(sel: VisualsSelection, todayYmd: string): VisualsWindow {
  if (sel.kind === 'zoom') {
    const w = visualsZoomWindow(sel.zoom)
    return { startYmd: w.startYmd, endYmd: w.endYmd }
  }
  return { startYmd: visualsPeriodStartYmd(sel.preset, todayYmd), endYmd: null }
}

/** Drop duplicates always; bounded windows also drop rows with unknown dates. */
export function filterVisualsTxsByWindow<T extends VisualsTxRow>(txs: T[], window: VisualsWindow): T[] {
  return txs.filter((t) => {
    if (t.isDuplicate) return false
    if (window.startYmd === null && window.endYmd === null) return true
    if (t.postedYmd === '') return false
    if (window.startYmd !== null && t.postedYmd < window.startYmd) return false
    if (window.endYmd !== null && t.postedYmd > window.endYmd) return false
    return true
  })
}

/** `?period=` URL forms: preset names, `2025` (year), `2025q2` (quarter). */
export function parseVisualsPeriodParam(raw: string | null): VisualsSelection | null {
  if (raw == null) return null
  if (raw === 'month' || raw === 'quarter' || raw === 'ytd' || raw === 'all') {
    return { kind: 'preset', preset: raw }
  }
  const m = /^(\d{4})(?:q([1-4]))?$/.exec(raw)
  if (!m) return null
  return {
    kind: 'zoom',
    zoom: { year: Number(m[1]), quarter: m[2] ? (Number(m[2]) as 1 | 2 | 3 | 4) : null },
  }
}

export function serializeVisualsSelection(sel: VisualsSelection): string {
  if (sel.kind === 'preset') return sel.preset
  return sel.zoom.quarter == null ? String(sel.zoom.year) : `${sel.zoom.year}q${sel.zoom.quarter}`
}

/** Distinct calendar years with (non-duplicate) activity, ascending. */
export function visualsYearsPresent(txs: VisualsTxRow[]): number[] {
  const years = new Set<number>()
  for (const t of txs) {
    if (t.isDuplicate || t.postedYmd === '') continue
    years.add(Number(t.postedYmd.slice(0, 4)))
  }
  return [...years].sort((a, b) => a - b)
}

// ————————————————————————————————— A · Where the money goes —————————————————————————————————

export const INCOME_LABEL_NAME = 'Income'
export const INTERNAL_TRANSFERS_LABEL_NAME = 'Internal Transfers'

/**
 * Label name → expense family. Unknown labels fall into 'Other' so org-added
 * labels never break the view; families carry fixed tones (color follows the
 * entity, not its rank).
 */
export const FAMILY_BY_LABEL_NAME: Record<string, string> = {
  'Contract Labor': 'People',
  Wages: 'People',
  'Employee Benefits': 'People',
  'Cost of Goods Sold': 'Job costs',
  'Job Materials & Parts': 'Job costs',
  Supplies: 'Job costs',
  'Tools & Small Equipment': 'Job costs',
  Consumables: 'Job costs',
  'Shop Supplies': 'Job costs',
  'Fuel / Gas': 'Vehicles',
  'Vehicle Maintenance & Repairs': 'Vehicles',
  'Car and Truck Expenses': 'Vehicles',
  Advertising: 'Overhead',
  'Commissions and Fees': 'Overhead',
  Insurance: 'Overhead',
  'Legal and Professional Services': 'Overhead',
  'Office Expense': 'Overhead',
  'Equipment Lease': 'Overhead',
  'Property Lease': 'Overhead',
  'Repairs and Maintenance': 'Overhead',
  'Taxes and Licenses': 'Overhead',
  Travel: 'Overhead',
  Meals: 'Overhead',
  Utilities: 'Overhead',
  'Bad Debts': 'Overhead',
  'Other Expenses': 'Overhead',
  'Owners Equity': 'Owner draws',
}

const FAMILY_ORDER = ['People', 'Job costs', 'Vehicles', 'Overhead', 'Owner draws', 'Unlabeled', 'Other'] as const
export const FAMILY_TONES: Record<string, SankeyTone> = {
  People: 'series1',
  'Job costs': 'series2',
  Vehicles: 'series3',
  Overhead: 'series4',
  'Owner draws': 'neutral',
  Unlabeled: 'neutral',
  Other: 'neutral',
}
/** Per family, labels beyond the top N fold into "Other <family>". */
const MONEY_FLOW_TOP_LABELS_PER_FAMILY = 4

export type MoneyFlowResult = {
  input: SankeyInput
  totalIn: number
  totalOut: number
  /** > 0 when spend is not covered by money in (the "From reserves" band). */
  fromReserves: number
  /** > 0 when money in exceeds spend (the "Still in the bank" band). */
  kept: number
  unlabeledOut: number
}

export function buildMoneyFlowSankey(args: {
  txs: VisualsTxRow[]
  labelNameByTxId: Map<string, string>
}): MoneyFlowResult {
  const { txs, labelNameByTxId } = args

  let income = 0
  let otherIn = 0
  const outByLabel = new Map<string, number>()
  const outTxIdsByLabel = new Map<string, string[]>()
  for (const t of txs) {
    const label = labelNameByTxId.get(t.id)
    if (label === INTERNAL_TRANSFERS_LABEL_NAME) continue
    if (t.amount > 0) {
      if (label === INCOME_LABEL_NAME) income += t.amount
      else otherIn += t.amount
    } else if (t.amount < 0 && label !== INCOME_LABEL_NAME) {
      const key = label ?? 'Unlabeled'
      outByLabel.set(key, (outByLabel.get(key) ?? 0) + Math.abs(t.amount))
      const ids = outTxIdsByLabel.get(key) ?? []
      ids.push(t.id)
      outTxIdsByLabel.set(key, ids)
    }
  }

  const outByFamily = new Map<string, Map<string, number>>()
  for (const [label, value] of outByLabel) {
    const family = label === 'Unlabeled' ? 'Unlabeled' : (FAMILY_BY_LABEL_NAME[label] ?? 'Other')
    const inner = outByFamily.get(family) ?? new Map<string, number>()
    inner.set(label, value)
    outByFamily.set(family, inner)
  }

  const totalOut = [...outByLabel.values()].reduce((s, v) => s + v, 0)
  const totalIn = income + otherIn
  const fromReserves = Math.max(0, totalOut - totalIn)
  const kept = Math.max(0, totalIn - totalOut)

  const nodes: SankeyNodeInput[] = []
  const links: SankeyInput['links'] = []

  if (income > 0) nodes.push({ id: 'in:income', col: 0, label: 'Income', sublabel: 'gross receipts', value: income, tone: 'ink' })
  if (otherIn > 0) nodes.push({ id: 'in:other', col: 0, label: 'Other money in', value: otherIn, tone: 'neutral' })
  if (fromReserves > 0) nodes.push({ id: 'in:reserves', col: 0, label: 'From reserves', value: fromReserves, tone: 'neutral' })

  const families = FAMILY_ORDER.filter((f) => (outByFamily.get(f)?.size ?? 0) > 0)
  for (const family of families) {
    const inner = outByFamily.get(family)!
    const familyTotal = [...inner.values()].reduce((s, v) => s + v, 0)
    const tone = FAMILY_TONES[family] ?? 'neutral'
    nodes.push({ id: `fam:${family}`, col: 1, label: family, value: familyTotal, tone, focusable: true })

    const ranked = [...inner.entries()].sort((a, b) => b[1] - a[1])
    const top = ranked.slice(0, MONEY_FLOW_TOP_LABELS_PER_FAMILY)
    const rest = ranked.slice(MONEY_FLOW_TOP_LABELS_PER_FAMILY)
    for (const [label, value] of top) {
      nodes.push({ id: `label:${label}`, col: 2, label, value, tone, focusable: true })
      links.push({ source: `fam:${family}`, target: `label:${label}`, value, txIds: outTxIdsByLabel.get(label) ?? [] })
    }
    const restTotal = rest.reduce((s, [, v]) => s + v, 0)
    if (restTotal > 0) {
      nodes.push({ id: `label:other-${family}`, col: 2, label: `Other ${family.toLowerCase()}`, value: restTotal, tone })
      links.push({
        source: `fam:${family}`,
        target: `label:other-${family}`,
        value: restTotal,
        txIds: rest.flatMap(([label]) => outTxIdsByLabel.get(label) ?? []),
      })
    }
  }

  if (kept > 0) {
    nodes.push({ id: 'fam:kept', col: 1, label: 'Kept', value: kept, tone: 'ink' })
    nodes.push({ id: 'label:kept', col: 2, label: 'Still in the bank', value: kept, tone: 'ink' })
    links.push({ source: 'fam:kept', target: 'label:kept', value: kept })
  }

  // Fill families from Income first, then Other money in, then reserves —
  // each family band drains the sources in order, waterfall style.
  const sources: { id: string; left: number }[] = [
    { id: 'in:income', left: income },
    { id: 'in:other', left: otherIn },
    { id: 'in:reserves', left: fromReserves },
  ]
  const familySinks = families.map((f) => ({
    id: `fam:${f}`,
    tone: FAMILY_TONES[f] ?? ('neutral' as SankeyTone),
    left: [...outByFamily.get(f)!.values()].reduce((s, v) => s + v, 0),
    txIds: [...outByFamily.get(f)!.keys()].flatMap((label) => outTxIdsByLabel.get(label) ?? []),
  }))
  if (kept > 0) familySinks.push({ id: 'fam:kept', tone: 'ink', left: kept, txIds: [] })
  let si = 0
  for (const sink of familySinks) {
    while (sink.left > 0.005 && si < sources.length) {
      const src = sources[si]!
      if (src.left <= 0.005) {
        si += 1
        continue
      }
      const v = Math.min(src.left, sink.left)
      links.push({ source: src.id, target: sink.id, value: v, tone: sink.tone, txIds: sink.txIds })
      src.left -= v
      sink.left -= v
    }
  }

  return {
    input: { nodes, links },
    totalIn,
    totalOut,
    fromReserves,
    kept,
    unlabeledOut: [...(outByFamily.get('Unlabeled')?.values() ?? [])].reduce((s, v) => s + v, 0),
  }
}

// ————————————————————————————— A½ · Focus mode: a label's payees (v2.1717) —————————————————————————————

/** The family a label belongs to (null label = the Unlabeled pseudo-family). */
export function visualsFamilyForLabel(labelName: string | null): string {
  if (labelName == null || labelName === 'Unlabeled') return 'Unlabeled'
  return FAMILY_BY_LABEL_NAME[labelName] ?? 'Other'
}

export type VisualsFocus = { type: 'label' | 'family'; name: string }

/** `?focus=` URL forms: `label:Contract Labor`, `family:People`. */
export function parseVisualsFocusParam(raw: string | null): VisualsFocus | null {
  if (raw == null) return null
  const m = /^(label|family):(.+)$/.exec(raw)
  if (!m) return null
  return { type: m[1] as 'label' | 'family', name: m[2]! }
}

export function serializeVisualsFocus(focus: VisualsFocus): string {
  return `${focus.type}:${focus.name}`
}

/**
 * The expense transactions a focus target covers, within the already-filtered
 * window set. Income and Internal Transfers stay excluded, matching view A.
 */
export function visualsFocusTxs<T extends VisualsTxRow>(
  txs: T[],
  labelNameByTxId: Map<string, string>,
  focus: VisualsFocus,
): T[] {
  return txs.filter((t) => {
    if (t.amount >= 0) return false
    const label = labelNameByTxId.get(t.id) ?? null
    if (label === INCOME_LABEL_NAME || label === INTERNAL_TRANSFERS_LABEL_NAME) return false
    if (focus.type === 'label') {
      return focus.name === 'Unlabeled' ? label == null : label === focus.name
    }
    return visualsFamilyForLabel(label) === focus.name
  })
}

const CASH_APP_MEMO_RE = /CASH APP\s*\*\s*(.+)/i

function titleCaseWords(raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w[0] ?? '').toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Display payee for a transaction. Cash App is a platform, not a person — the
 * real name rides in the bank memo or (more often) the raw bank description
 * ("CASH APP*JESSICA WHITE"), so when the counterparty is Cash App we split by
 * that name instead.
 */
export function resolveVisualsPayee(
  counterpartyName: string | null,
  externalMemo: string | null,
  bankDescription?: string | null,
): { name: string; viaMemo: boolean } {
  const cp = counterpartyName?.trim() ?? ''
  if (/^cash app$/i.test(cp)) {
    for (const source of [externalMemo, bankDescription]) {
      const m = CASH_APP_MEMO_RE.exec(source ?? '')
      const memoName = m?.[1]?.trim()
      if (memoName) return { name: titleCaseWords(memoName), viaMemo: true }
    }
  }
  return { name: cp || 'Unknown payee', viaMemo: false }
}

export type VisualsPayeeTxRow = VisualsTxRow & {
  counterpartyName: string | null
  externalMemo: string | null
  bankDescription: string | null
}

const FOCUS_TOP_PAYEES = 12

export type LabelFocusResult = {
  input: SankeyInput
  total: number
  txCount: number
  payeeCount: number
  /** Cash App payments shown under the person from the bank memo. */
  memoSplitCount: number
}

/** Focus-mode Sankey: one root node fanning out to its top payees. */
export function buildLabelFocusSankey(args: {
  title: string
  tone: SankeyTone
  txs: VisualsPayeeTxRow[]
}): LabelFocusResult {
  const { title, tone, txs } = args
  const byPayee = new Map<string, { value: number; txIds: string[] }>()
  let memoSplitCount = 0
  for (const t of txs) {
    const payee = resolveVisualsPayee(t.counterpartyName, t.externalMemo, t.bankDescription)
    if (payee.viaMemo) memoSplitCount += 1
    const cell = byPayee.get(payee.name) ?? { value: 0, txIds: [] }
    cell.value += Math.abs(t.amount)
    cell.txIds.push(t.id)
    byPayee.set(payee.name, cell)
  }
  const ranked = [...byPayee.entries()].sort((a, b) => b[1].value - a[1].value)
  const top = ranked.slice(0, FOCUS_TOP_PAYEES)
  const rest = ranked.slice(FOCUS_TOP_PAYEES)
  const total = ranked.reduce((s, [, c]) => s + c.value, 0)

  const nodes: SankeyInput['nodes'] = [{ id: 'focus:root', col: 0, label: title, value: total, tone }]
  const links: SankeyInput['links'] = []
  for (const [name, cell] of top) {
    nodes.push({ id: `payee:${name}`, col: 1, label: name, value: cell.value, tone: 'ink' })
    links.push({ source: 'focus:root', target: `payee:${name}`, value: cell.value, tone, txIds: cell.txIds })
  }
  if (rest.length > 0) {
    const restValue = rest.reduce((s, [, c]) => s + c.value, 0)
    const restTxIds = rest.flatMap(([, c]) => c.txIds)
    nodes.push({ id: 'payee:other', col: 1, label: `Other payees (${rest.length})`, value: restValue, tone: 'neutral' })
    links.push({ source: 'focus:root', target: 'payee:other', value: restValue, tone, txIds: restTxIds })
  }

  return { input: { nodes, links }, total, txCount: txs.length, payeeCount: ranked.length, memoSplitCount }
}

// ————————————————————————————————— B · Between the accounts —————————————————————————————————

export const INTERNAL_TRANSFER_KIND = 'internalTransfer'
/** Max calendar-day gap between the two legs of one transfer. */
export const TRANSFER_PAIR_MAX_DAY_GAP = 3

export type TransferPair = { fromAccountId: string; toAccountId: string; amount: number; txIds: [string, string] }
export type TransferPairing = {
  pairs: TransferPair[]
  /** Outgoing legs with no matching incoming leg (and vice versa). */
  unpairedOut: { accountId: string; amount: number; txId: string }[]
  unpairedIn: { accountId: string; amount: number; txId: string }[]
}

function dayNumber(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return Number.NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000
}

/**
 * Pair internal-transfer legs (each transfer syncs as two rows, one per
 * account) into account→account edges: same cent amount, opposite signs,
 * different accounts, posted within TRANSFER_PAIR_MAX_DAY_GAP days. Greedy
 * nearest-date matching within each amount bucket; leftovers are reported,
 * never guessed.
 */
export function pairInternalTransfers(txs: VisualsTxRow[]): TransferPairing {
  const transfers = txs.filter((t) => t.kind === INTERNAL_TRANSFER_KIND && t.amount !== 0)
  const byCents = new Map<number, { outs: VisualsTxRow[]; ins: VisualsTxRow[] }>()
  for (const t of transfers) {
    const cents = Math.round(Math.abs(t.amount) * 100)
    const bucket = byCents.get(cents) ?? { outs: [], ins: [] }
    if (t.amount < 0) bucket.outs.push(t)
    else bucket.ins.push(t)
    byCents.set(cents, bucket)
  }

  const pairs: TransferPair[] = []
  const unpairedOut: { accountId: string; amount: number; txId: string }[] = []
  const unpairedIn: { accountId: string; amount: number; txId: string }[] = []
  for (const bucket of byCents.values()) {
    const ins = [...bucket.ins].sort((a, b) => a.postedYmd.localeCompare(b.postedYmd))
    const usedIn = new Set<number>()
    for (const out of [...bucket.outs].sort((a, b) => a.postedYmd.localeCompare(b.postedYmd))) {
      const outDay = dayNumber(out.postedYmd)
      let best = -1
      let bestGap = Number.POSITIVE_INFINITY
      for (let i = 0; i < ins.length; i++) {
        if (usedIn.has(i)) continue
        const inn = ins[i]!
        if (inn.accountId === out.accountId) continue
        const gap = Math.abs(dayNumber(inn.postedYmd) - outDay)
        if (Number.isNaN(gap) || gap > TRANSFER_PAIR_MAX_DAY_GAP) continue
        if (gap < bestGap) {
          bestGap = gap
          best = i
        }
      }
      if (best >= 0) {
        usedIn.add(best)
        pairs.push({
          fromAccountId: out.accountId,
          toAccountId: ins[best]!.accountId,
          amount: Math.abs(out.amount),
          txIds: [out.id, ins[best]!.id],
        })
      } else {
        unpairedOut.push({ accountId: out.accountId, amount: Math.abs(out.amount), txId: out.id })
      }
    }
    ins.forEach((inn, i) => {
      if (!usedIn.has(i)) unpairedIn.push({ accountId: inn.accountId, amount: inn.amount, txId: inn.id })
    })
  }
  return { pairs, unpairedOut, unpairedIn }
}

/** Friendly grouping of external (non-internal-transfer) kinds, per direction. */
export function externalKindGroup(kind: string, direction: 'in' | 'out'): string {
  if (direction === 'in') {
    if (kind === 'checkDeposit') return 'Check deposits'
    if (kind === 'incomingDomesticWire') return 'Wires in'
    if (kind === DEBIT_CARD_KIND) return 'Card refunds'
    if (kind === 'externalTransfer') return 'External transfers in'
    return 'Other money in'
  }
  if (kind === DEBIT_CARD_KIND) return 'Card spend'
  if (kind === 'outgoingPayment') return 'Payments out'
  if (kind === 'externalTransfer') return 'External transfers out'
  return 'Other out'
}

export type TransferSankeyResult = {
  input: SankeyInput
  pairedTotal: number
  unpairedTotal: number
  externalInTotal: number
  externalOutTotal: number
}

/**
 * Between-accounts flow, flanked by external money (v2.1714): four columns —
 * external sources → account in-sides → account out-sides → external uses.
 * Transfers run between the two account columns; a same-account "passthrough"
 * ribbon carries external money that leaves the same account it landed in.
 *
 * Money that crosses the period boundary (or funds chained transfers) shows
 * up explicitly as gray "From balances" / "Kept in accounts" bands — each
 * account's two sides always balance, nothing is hidden.
 */
export function buildTransferSankey(args: {
  txs: VisualsTxRow[]
  pairing: TransferPairing
  accountLabelById: (id: string) => string
  /** Nicknamed accounts claim series colors first; unnamed ids go neutral-last. */
  accountIsNamed?: (id: string) => boolean
}): TransferSankeyResult {
  const { txs, pairing, accountLabelById, accountIsNamed = () => true } = args

  const edgeTotals = new Map<string, { from: string; to: string; value: number; txIds: string[] }>()
  for (const p of pairing.pairs) {
    const key = `${p.fromAccountId}→${p.toAccountId}`
    const edge = edgeTotals.get(key) ?? { from: p.fromAccountId, to: p.toAccountId, value: 0, txIds: [] }
    edge.value += p.amount
    // Drill-down carries only the OUT leg: its row already names the destination
    // (the counterparty text is the receiving account), and listing both legs
    // would make the modal total read double the ribbon's value.
    edge.txIds.push(p.txIds[0])
    edgeTotals.set(key, edge)
  }

  // External flows per account per kind group. Unpaired transfer legs act as
  // external-ish flows on the side they touch (their other half is outside
  // the period), kept in their own group so they stay visible.
  type Flow = { value: number; txIds: string[] }
  const addFlow = (m: Map<string, Map<string, Flow>>, accountId: string, group: string, value: number, txId: string): void => {
    const inner = m.get(accountId) ?? new Map<string, Flow>()
    const f = inner.get(group) ?? { value: 0, txIds: [] }
    f.value += value
    f.txIds.push(txId)
    inner.set(group, f)
    m.set(accountId, inner)
  }
  const extInByAccount = new Map<string, Map<string, Flow>>()
  const extOutByAccount = new Map<string, Map<string, Flow>>()
  for (const t of txs) {
    if (t.kind === INTERNAL_TRANSFER_KIND || t.amount === 0) continue
    if (t.amount > 0) addFlow(extInByAccount, t.accountId, externalKindGroup(t.kind, 'in'), t.amount, t.id)
    else addFlow(extOutByAccount, t.accountId, externalKindGroup(t.kind, 'out'), Math.abs(t.amount), t.id)
  }
  const UNMATCHED_GROUP = 'Unmatched transfer legs'
  for (const u of pairing.unpairedIn) addFlow(extInByAccount, u.accountId, UNMATCHED_GROUP, u.amount, u.txId)
  for (const u of pairing.unpairedOut) addFlow(extOutByAccount, u.accountId, UNMATCHED_GROUP, u.amount, u.txId)

  // Stable tone per account: alphabetical by display label, so a period
  // change never repaints an account (color follows the entity).
  const accountIds = new Set<string>([...extInByAccount.keys(), ...extOutByAccount.keys()])
  for (const e of edgeTotals.values()) {
    accountIds.add(e.from)
    accountIds.add(e.to)
  }
  const SERIES: SankeyTone[] = ['series1', 'series2', 'series3', 'series4', 'series5', 'series6']
  const toneByAccount = new Map<string, SankeyTone>()
  const sortedIds = [...accountIds].sort((a, b) => {
    const namedDiff = Number(accountIsNamed(b)) - Number(accountIsNamed(a))
    if (namedDiff !== 0) return namedDiff
    return accountLabelById(a).localeCompare(accountLabelById(b))
  })
  sortedIds.forEach((id, i) => toneByAccount.set(id, SERIES[i] ?? 'neutral'))
  const tone = (id: string): SankeyTone => toneByAccount.get(id) ?? 'neutral'

  const sum = (m: Map<string, Flow> | undefined): number => [...(m?.values() ?? [])].reduce((s, f) => s + f.value, 0)
  const tOut = new Map<string, number>()
  const tIn = new Map<string, number>()
  for (const e of edgeTotals.values()) {
    tOut.set(e.from, (tOut.get(e.from) ?? 0) + e.value)
    tIn.set(e.to, (tIn.get(e.to) ?? 0) + e.value)
  }

  // Per-account balancing: passthrough feeds the out-side with whatever the
  // in-side has beyond transfers out AND whatever external spend exceeds
  // transfers in; "From balances" / "Kept in accounts" absorb the rest.
  const perAccount = [...accountIds].map((id) => {
    const inExt = sum(extInByAccount.get(id))
    const outExt = sum(extOutByAccount.get(id))
    const out = tOut.get(id) ?? 0
    const inn = tIn.get(id) ?? 0
    const pass = Math.max(0, Math.max(outExt - inn, inExt - out))
    const fromBal = Math.max(0, out + pass - inExt)
    const kept = inn + pass - outExt
    return { id, inExt, outExt, pass, fromBal, kept, inSideValue: inExt + fromBal, outSideValue: inn + pass }
  })

  const nodes: SankeyNodeInput[] = []
  const links: SankeyInput['links'] = []

  // Col 0 — external sources (by group, value desc; From balances last).
  const sourceTotals = new Map<string, Flow>()
  for (const inner of extInByAccount.values()) {
    for (const [group, f] of inner) {
      const agg = sourceTotals.get(group) ?? { value: 0, txIds: [] }
      agg.value += f.value
      agg.txIds.push(...f.txIds)
      sourceTotals.set(group, agg)
    }
  }
  for (const [group, f] of [...sourceTotals.entries()].sort((a, b) => b[1].value - a[1].value)) {
    nodes.push({ id: `in:${group}`, col: 0, label: group, value: f.value, tone: group === UNMATCHED_GROUP ? 'neutral' : 'ink' })
  }
  const fromBalTotal = perAccount.reduce((s, a) => s + a.fromBal, 0)
  if (fromBalTotal > 0) nodes.push({ id: 'in:balance', col: 0, label: 'From balances', value: fromBalTotal, tone: 'neutral' })

  // Cols 1 & 2 — account instances (value desc per column).
  for (const a of [...perAccount].sort((x, y) => y.inSideValue - x.inSideValue)) {
    if (a.inSideValue > 0) nodes.push({ id: `acct-in:${a.id}`, col: 1, label: accountLabelById(a.id), value: a.inSideValue, tone: tone(a.id) })
  }
  for (const a of [...perAccount].sort((x, y) => y.outSideValue - x.outSideValue)) {
    if (a.outSideValue > 0) nodes.push({ id: `acct-out:${a.id}`, col: 2, label: accountLabelById(a.id), value: a.outSideValue, tone: tone(a.id) })
  }

  // Col 3 — external uses (by group, value desc; Kept last).
  const useTotals = new Map<string, Flow>()
  for (const inner of extOutByAccount.values()) {
    for (const [group, f] of inner) {
      const agg = useTotals.get(group) ?? { value: 0, txIds: [] }
      agg.value += f.value
      agg.txIds.push(...f.txIds)
      useTotals.set(group, agg)
    }
  }
  for (const [group, f] of [...useTotals.entries()].sort((a, b) => b[1].value - a[1].value)) {
    nodes.push({ id: `out:${group}`, col: 3, label: group, value: f.value, tone: group === UNMATCHED_GROUP ? 'neutral' : 'ink' })
  }
  const keptTotal = perAccount.reduce((s, a) => s + a.kept, 0)
  if (keptTotal > 0) nodes.push({ id: 'out:kept', col: 3, label: 'Kept in accounts', value: keptTotal, tone: 'neutral' })

  // Links: sources → in-sides, colored by the account (the entity).
  for (const [accountId, inner] of extInByAccount) {
    for (const [group, f] of inner) {
      links.push({ source: `in:${group}`, target: `acct-in:${accountId}`, value: f.value, tone: tone(accountId), txIds: f.txIds })
    }
  }
  for (const a of perAccount) {
    if (a.fromBal > 0) links.push({ source: 'in:balance', target: `acct-in:${a.id}`, value: a.fromBal, tone: 'neutral' })
  }
  // Transfers between the account columns.
  for (const e of [...edgeTotals.values()].sort((a, b) => b.value - a.value)) {
    links.push({ source: `acct-in:${e.from}`, target: `acct-out:${e.to}`, value: e.value, tone: tone(e.from), txIds: e.txIds })
  }
  // Same-account passthrough: external money that leaves where it landed.
  for (const a of perAccount) {
    if (a.pass > 0) links.push({ source: `acct-in:${a.id}`, target: `acct-out:${a.id}`, value: a.pass, tone: tone(a.id) })
  }
  // Out-sides → uses, colored by the account.
  for (const [accountId, inner] of extOutByAccount) {
    for (const [group, f] of inner) {
      links.push({ source: `acct-out:${accountId}`, target: `out:${group}`, value: f.value, tone: tone(accountId), txIds: f.txIds })
    }
  }
  for (const a of perAccount) {
    if (a.kept > 0) links.push({ source: `acct-out:${a.id}`, target: 'out:kept', value: a.kept, tone: 'neutral' })
  }

  const pairedTotal = [...edgeTotals.values()].reduce((s, e) => s + e.value, 0)
  const unpairedTotal =
    pairing.unpairedOut.reduce((s, u) => s + u.amount, 0) + pairing.unpairedIn.reduce((s, u) => s + u.amount, 0)
  const externalInTotal = [...sourceTotals.entries()].reduce((s, [g, f]) => (g === UNMATCHED_GROUP ? s : s + f.value), 0)
  const externalOutTotal = [...useTotals.entries()].reduce((s, [g, f]) => (g === UNMATCHED_GROUP ? s : s + f.value), 0)
  return { input: { nodes, links }, pairedTotal, unpairedTotal, externalInTotal, externalOutTotal }
}

// ————————————————————————————————— C · Cards → people → jobs —————————————————————————————————

export const DEBIT_CARD_KIND = 'debitCardTransaction'
const CARDS_TOP_PEOPLE = 6
const CARDS_TOP_JOBS = 5
export const NO_JOB_LABEL = '⚠ No job yet'

export type CardsJobsResult = {
  input: SankeyInput
  spendTotal: number
  noJobTotal: number
  txCount: number
}

export function buildCardsJobsSankey(args: {
  txs: VisualsTxRow[]
  personLabelByTxId: Map<string, string | null>
  allocationsByTxId: Map<string, { jobId: string; amount: number }[]>
  jobLabelById: (id: string) => string
}): CardsJobsResult {
  const { txs, personLabelByTxId, allocationsByTxId, jobLabelById } = args

  type Cell = { v: number; txIds: string[] }
  const addCell = (m: Map<string, Cell>, key: string, v: number, txId: string): void => {
    const cell = m.get(key) ?? { v: 0, txIds: [] }
    cell.v += v
    if (cell.txIds[cell.txIds.length - 1] !== txId) cell.txIds.push(txId)
    m.set(key, cell)
  }
  const spendByPersonJob = new Map<string, Map<string, Cell>>()
  let spendTotal = 0
  let txCount = 0
  const NO_JOB = 'job:none'
  for (const t of txs) {
    if (t.kind !== DEBIT_CARD_KIND || t.amount >= 0) continue
    txCount += 1
    const person = personLabelByTxId.get(t.id)?.trim() || 'No person'
    let remaining = Math.abs(t.amount)
    spendTotal += remaining
    const perJob = spendByPersonJob.get(person) ?? new Map<string, Cell>()
    for (const alloc of allocationsByTxId.get(t.id) ?? []) {
      if (remaining <= 0) break
      const v = Math.min(Math.abs(alloc.amount), remaining)
      if (v <= 0) continue
      addCell(perJob, `job:${alloc.jobId}`, v, t.id)
      remaining -= v
    }
    if (remaining > 0.005) addCell(perJob, NO_JOB, remaining, t.id)
    spendByPersonJob.set(person, perJob)
  }

  const personTotals = [...spendByPersonJob.entries()]
    .map(([person, perJob]) => ({ person, total: [...perJob.values()].reduce((s, c) => s + c.v, 0) }))
    .sort((a, b) => b.total - a.total)
  const topPeople = personTotals.slice(0, CARDS_TOP_PEOPLE).map((p) => p.person)
  const personKey = (person: string): string => (topPeople.includes(person) ? person : 'Other people')

  // Stable person tones: alphabetical among the shown people.
  const SERIES: SankeyTone[] = ['series1', 'series2', 'series3', 'series4', 'series5', 'series6']
  const toneByPerson = new Map<string, SankeyTone>()
  ;[...topPeople].sort((a, b) => a.localeCompare(b)).forEach((p, i) => toneByPerson.set(p, SERIES[i] ?? 'neutral'))
  toneByPerson.set('Other people', 'neutral')
  toneByPerson.set('No person', 'neutral')

  const jobTotals = new Map<string, number>()
  const folded = new Map<string, Map<string, Cell>>()
  for (const [person, perJob] of spendByPersonJob) {
    const pk = personKey(person)
    const target = folded.get(pk) ?? new Map<string, Cell>()
    for (const [jobKey, cell] of perJob) {
      const merged = target.get(jobKey) ?? { v: 0, txIds: [] }
      merged.v += cell.v
      merged.txIds.push(...cell.txIds)
      target.set(jobKey, merged)
      if (jobKey !== NO_JOB) jobTotals.set(jobKey, (jobTotals.get(jobKey) ?? 0) + cell.v)
    }
    folded.set(pk, target)
  }
  const rankedJobs = [...jobTotals.entries()].sort((a, b) => b[1] - a[1])
  const topJobs = new Set(rankedJobs.slice(0, CARDS_TOP_JOBS).map(([k]) => k))
  const foldedJobCount = Math.max(0, rankedJobs.length - topJobs.size)
  const jobKeyOf = (key: string): string => (key === NO_JOB ? NO_JOB : topJobs.has(key) ? key : 'job:other')

  const nodes: SankeyNodeInput[] = []
  const links: SankeyInput['links'] = []
  const personOrder = [...new Set(personTotals.map((p) => personKey(p.person)))]
  for (const pk of personOrder) {
    const total = [...(folded.get(pk)?.values() ?? [])].reduce((s, c) => s + c.v, 0)
    nodes.push({ id: `person:${pk}`, col: 0, label: pk, value: total, tone: toneByPerson.get(pk) ?? 'neutral' })
  }

  const jobNodeTotals = new Map<string, number>()
  for (const perJob of folded.values()) {
    for (const [jobKey, cell] of perJob)
      jobNodeTotals.set(jobKeyOf(jobKey), (jobNodeTotals.get(jobKeyOf(jobKey)) ?? 0) + cell.v)
  }
  const jobNodeOrder = [...jobNodeTotals.entries()]
    .sort((a, b) => {
      // No job yet pins last; Other jobs second-to-last; rest by value.
      const rank = (k: string) => (k === NO_JOB ? 2 : k === 'job:other' ? 1 : 0)
      return rank(a[0]) - rank(b[0]) || b[1] - a[1]
    })
  for (const [key, value] of jobNodeOrder) {
    const label = key === NO_JOB ? NO_JOB_LABEL : key === 'job:other' ? `Other jobs (${foldedJobCount})` : jobLabelById(key.slice(4))
    const tone: SankeyTone = key === NO_JOB ? 'warn' : key === 'job:other' ? 'neutral' : 'ink'
    nodes.push({ id: key, col: 1, label, value, tone })
  }

  for (const pk of personOrder) {
    const merged = new Map<string, Cell>()
    for (const [jobKey, cell] of folded.get(pk) ?? []) {
      const m = merged.get(jobKeyOf(jobKey)) ?? { v: 0, txIds: [] }
      m.v += cell.v
      m.txIds.push(...cell.txIds)
      merged.set(jobKeyOf(jobKey), m)
    }
    for (const [jobKey, cell] of merged) {
      links.push({
        source: `person:${pk}`,
        target: jobKey,
        value: cell.v,
        tone: toneByPerson.get(pk) ?? 'neutral',
        txIds: [...new Set(cell.txIds)],
      })
    }
  }

  const noJobTotal = jobNodeTotals.get(NO_JOB) ?? 0
  return { input: { nodes, links }, spendTotal, noJobTotal, txCount }
}
