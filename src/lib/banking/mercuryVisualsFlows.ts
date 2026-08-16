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
  const start = visualsPeriodStartYmd(period, todayYmd)
  return txs.filter((t) => {
    if (t.isDuplicate) return false
    if (start === null) return true
    return t.postedYmd !== '' && t.postedYmd >= start
  })
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
const FAMILY_TONES: Record<string, SankeyTone> = {
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
    nodes.push({ id: `fam:${family}`, col: 1, label: family, value: familyTotal, tone })

    const ranked = [...inner.entries()].sort((a, b) => b[1] - a[1])
    const top = ranked.slice(0, MONEY_FLOW_TOP_LABELS_PER_FAMILY)
    const rest = ranked.slice(MONEY_FLOW_TOP_LABELS_PER_FAMILY)
    for (const [label, value] of top) {
      nodes.push({ id: `label:${label}`, col: 2, label, value, tone })
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

export type TransferSankeyResult = {
  input: SankeyInput
  pairedTotal: number
  unpairedTotal: number
}

export function buildTransferSankey(args: {
  pairing: TransferPairing
  accountLabelById: (id: string) => string
}): TransferSankeyResult {
  const { pairing, accountLabelById } = args

  const edgeTotals = new Map<string, { from: string; to: string; value: number; txIds: string[] }>()
  for (const p of pairing.pairs) {
    const key = `${p.fromAccountId}→${p.toAccountId}`
    const edge = edgeTotals.get(key) ?? { from: p.fromAccountId, to: p.toAccountId, value: 0, txIds: [] }
    edge.value += p.amount
    edge.txIds.push(...p.txIds)
    edgeTotals.set(key, edge)
  }

  // Stable tone per account: alphabetical by display label, so a period
  // change never repaints an account (color follows the entity).
  const accountIds = new Set<string>()
  for (const e of edgeTotals.values()) {
    accountIds.add(e.from)
    accountIds.add(e.to)
  }
  for (const u of [...pairing.unpairedOut, ...pairing.unpairedIn]) accountIds.add(u.accountId)
  const SERIES: SankeyTone[] = ['series1', 'series2', 'series3', 'series4', 'series5', 'series6']
  const toneByAccount = new Map<string, SankeyTone>()
  const sortedIds = [...accountIds].sort((a, b) => accountLabelById(a).localeCompare(accountLabelById(b)))
  sortedIds.forEach((id, i) => toneByAccount.set(id, SERIES[i] ?? 'neutral'))

  const fromTotals = new Map<string, number>()
  const toTotals = new Map<string, number>()
  for (const e of edgeTotals.values()) {
    fromTotals.set(e.from, (fromTotals.get(e.from) ?? 0) + e.value)
    toTotals.set(e.to, (toTotals.get(e.to) ?? 0) + e.value)
  }
  const unpairedOutTotal = pairing.unpairedOut.reduce((s, u) => s + u.amount, 0)
  const unpairedInTotal = pairing.unpairedIn.reduce((s, u) => s + u.amount, 0)
  for (const u of pairing.unpairedOut) fromTotals.set(u.accountId, (fromTotals.get(u.accountId) ?? 0) + u.amount)
  for (const u of pairing.unpairedIn) toTotals.set(u.accountId, (toTotals.get(u.accountId) ?? 0) + u.amount)

  const nodes: SankeyNodeInput[] = []
  const links: SankeyInput['links'] = []
  const byValueDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])
  for (const [id, value] of byValueDesc(fromTotals)) {
    nodes.push({ id: `from:${id}`, col: 0, label: accountLabelById(id), value, tone: toneByAccount.get(id) ?? 'neutral' })
  }
  if (unpairedInTotal > 0) nodes.push({ id: 'from:unmatched', col: 0, label: 'Unmatched legs', value: unpairedInTotal, tone: 'neutral' })
  for (const [id, value] of byValueDesc(toTotals)) {
    nodes.push({ id: `to:${id}`, col: 1, label: accountLabelById(id), value, tone: toneByAccount.get(id) ?? 'neutral' })
  }
  if (unpairedOutTotal > 0) nodes.push({ id: 'to:unmatched', col: 1, label: 'Unmatched legs', value: unpairedOutTotal, tone: 'neutral' })

  for (const e of [...edgeTotals.values()].sort((a, b) => b.value - a.value)) {
    links.push({ source: `from:${e.from}`, target: `to:${e.to}`, value: e.value, txIds: e.txIds })
  }
  for (const u of pairing.unpairedOut)
    links.push({ source: `from:${u.accountId}`, target: 'to:unmatched', value: u.amount, txIds: [u.txId] })
  for (const u of pairing.unpairedIn)
    links.push({ source: 'from:unmatched', target: `to:${u.accountId}`, value: u.amount, tone: 'neutral', txIds: [u.txId] })

  const pairedTotal = [...edgeTotals.values()].reduce((s, e) => s + e.value, 0)
  return { input: { nodes, links }, pairedTotal, unpairedTotal: unpairedOutTotal + unpairedInTotal }
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
