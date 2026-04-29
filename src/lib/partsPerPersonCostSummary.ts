import type { MercuryJobAllocationWithAttributionRow } from './fetchMercuryJobAllocationsWithAttributionForJob'

const JOB_LEVEL_LABEL = 'Job (no per-person split)'
/** Mercury lines with no person attribution; Person summary table merges into the Unassigned row. */
export const UNATTRIBUTED_CARD = 'Unattributed'

export type TallyLineForPersonRollup = {
  part_id: string | null
  quantity: number
  price_at_time: number | null
  fixture_cost: number | null
  created_by_user_id: string
  created_by_name: string | null
}

export type PartsPerPersonCostRow = {
  key: string
  displayName: string
  partsFromTally: number
  otherJobCharges: number
  invoicesFromSupply: number
  cardCharges: number
  rowKind: 'tally' | 'card' | 'job' | 'footer'
}

export function tallyLineTotal(p: TallyLineForPersonRollup): number {
  if (p.part_id == null) {
    return Number(p.fixture_cost ?? 0) * Number(p.quantity)
  }
  return Number(p.price_at_time ?? 0) * Number(p.quantity)
}

export function buildPartsPerPersonCostRows(args: {
  parts: TallyLineForPersonRollup[]
  billedMaterialsSum: number
  invoiceJobTotal: number
  mercuryRows: Pick<MercuryJobAllocationWithAttributionRow, 'amount' | 'attributionDisplayName'>[]
  /** When set, `footer.cardCharges` must also match the Jobs grid card column for this job. */
  parentCardTotal?: number
}): { rows: PartsPerPersonCostRow[]; footer: PartsPerPersonCostRow; sumsOk: boolean } {
  const { parts, billedMaterialsSum, invoiceJobTotal, mercuryRows, parentCardTotal } = args
  const map = new Map<
    string,
    { displayName: string; t: number; o: number; i: number; c: number; kind: 'tally' | 'card' | 'job' }
  >()

  const get = (key: string) => {
    const ex = map.get(key)
    if (ex) return ex
    const n: { displayName: string; t: number; o: number; i: number; c: number; kind: 'tally' | 'card' | 'job' } = {
      displayName: '',
      t: 0,
      o: 0,
      i: 0,
      c: 0,
      kind: 'tally',
    }
    map.set(key, n)
    return n
  }

  for (const p of parts) {
    const key = `t:${p.created_by_user_id}`
    const cell = get(key)
    cell.displayName = p.created_by_name?.trim() || 'Unknown'
    cell.kind = 'tally'
    cell.t += tallyLineTotal(p)
  }

  for (const m of mercuryRows) {
    const name = m.attributionDisplayName?.trim() || UNATTRIBUTED_CARD
    const key = `c:${name}`
    const cell = get(key)
    cell.displayName = name
    cell.kind = 'card'
    cell.c += Math.abs(Number(m.amount ?? 0))
  }

  if (billedMaterialsSum > 0 || invoiceJobTotal > 0) {
    const j = get('g:job')
    j.displayName = JOB_LEVEL_LABEL
    j.kind = 'job'
    j.o = billedMaterialsSum
    j.i = invoiceJobTotal
  }

  const uKey = `c:${UNATTRIBUTED_CARD}`
  const allPersonKeys = [...map.keys()].filter((k) => k !== 'g:job')
  const withUnatLast = (ks: string[]) => {
    const u = ks.filter((k) => k === uKey)
    const rest = ks.filter((k) => k !== uKey)
    rest.sort((a, b) =>
      map.get(a)!.displayName.localeCompare(map.get(b)!.displayName, undefined, { sensitivity: 'base' }),
    )
    return [...rest, ...u]
  }
  const keyOrder = withUnatLast(allPersonKeys)

  const out: PartsPerPersonCostRow[] = []
  for (const k of keyOrder) {
    const c = map.get(k)!
    out.push({
      key: k,
      displayName: c.displayName,
      partsFromTally: c.t,
      otherJobCharges: c.o,
      invoicesFromSupply: c.i,
      cardCharges: c.c,
      rowKind: c.kind,
    })
  }
  if (map.has('g:job')) {
    const c = map.get('g:job')!
    out.push({
      key: 'g:job',
      displayName: c.displayName,
      partsFromTally: 0,
      otherJobCharges: c.o,
      invoicesFromSupply: c.i,
      cardCharges: 0,
      rowKind: 'job',
    })
  }

  const sumT = (r: (typeof out)[0]) => r.partsFromTally
  const sumO = (r: (typeof out)[0]) => r.otherJobCharges
  const sumI = (r: (typeof out)[0]) => r.invoicesFromSupply
  const sumC = (r: (typeof out)[0]) => r.cardCharges

  const partsTotal = parts.reduce((s, p) => s + tallyLineTotal(p), 0)
  const mCard = mercuryRows.reduce((s, m) => s + Math.abs(Number(m.amount ?? 0)), 0)

  const footer: PartsPerPersonCostRow = {
    key: 'footer',
    displayName: 'Total',
    partsFromTally: out.reduce((s, r) => s + sumT(r), 0),
    otherJobCharges: out.reduce((s, r) => s + sumO(r), 0),
    invoicesFromSupply: out.reduce((s, r) => s + sumI(r), 0),
    cardCharges: out.reduce((s, r) => s + sumC(r), 0),
    rowKind: 'footer',
  }

  const ok =
    Math.abs(footer.partsFromTally - partsTotal) < 0.01 &&
    Math.abs(footer.otherJobCharges - billedMaterialsSum) < 0.01 &&
    Math.abs(footer.invoicesFromSupply - invoiceJobTotal) < 0.01 &&
    Math.abs(footer.cardCharges - mCard) < 0.01 &&
    (parentCardTotal == null || Math.abs(footer.cardCharges - parentCardTotal) < 0.01)

  // Job-level "no per-person split" row duplicates the same O/I numbers that roll into the Total row; keep out of the body.
  const displayRows = out.filter((r) => r.key !== 'g:job')

  return { rows: displayRows, footer, sumsOk: ok }
}
