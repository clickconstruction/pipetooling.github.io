/**
 * "Where the money went" — the one table that replaces the Team / Sub Labor
 * lines and the four ledger accordion totals on the Costs tab (v2.3361). Pure:
 * six sources in, rows with a share of the direct total out, largest first,
 * zero rows kept (they carry the doors — "+ Add other charge" lives under
 * Other). Each row names the accordion it opens.
 */
import type { MaterialsAccordionKey } from '../../components/jobs/useJobCostSnapshot'

export type MoneyRowKey = 'supply' | 'team' | 'card' | 'sub' | 'tally' | 'other' | 'total'
export type MoneyRow = {
  key: MoneyRowKey
  label: string
  sub: string
  hours: number | null
  usd: number
  sharePct: number | null
  state: 'ok' | 'loading' | 'failed'
  accordion: MaterialsAccordionKey | null
}

export type MoneyInputs = {
  supplyUsd: number; supplyCount: number; supplyFailed: boolean
  teamUsd: number; teamHours: number; teamPeople: number; teamLoading: boolean; teamFailed: boolean
  cardUsd: number; cardCount: number; cardFailed: boolean
  subUsd: number; subCount: number; subLoading: boolean; subFailed: boolean
  tallyUsd: number; tallyCount: number; tallyFailed: boolean
  otherUsd: number; otherCount: number
}

const n = (v: number): number => (Number.isFinite(v) ? v : 0)
const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`

export function buildMoneyRows(i: MoneyInputs): MoneyRow[] {
  const rows: MoneyRow[] = [
    { key: 'supply', label: 'Supply house invoices', sub: plural(i.supplyCount, 'line'), hours: null, usd: n(i.supplyUsd), sharePct: null, state: i.supplyFailed ? 'failed' : 'ok', accordion: 'supply' },
    { key: 'team', label: 'Team labor', sub: plural(i.teamPeople, 'person', 'people'), hours: n(i.teamHours), usd: n(i.teamUsd), sharePct: null, state: i.teamLoading ? 'loading' : i.teamFailed ? 'failed' : 'ok', accordion: null },
    { key: 'card', label: 'Card charges', sub: plural(i.cardCount, 'charge'), hours: null, usd: n(i.cardUsd), sharePct: null, state: i.cardFailed ? 'failed' : 'ok', accordion: 'mercury' },
    { key: 'sub', label: 'Sub labor', sub: plural(i.subCount, 'sheet'), hours: null, usd: n(i.subUsd), sharePct: null, state: i.subLoading ? 'loading' : i.subFailed ? 'failed' : 'ok', accordion: null },
    { key: 'tally', label: 'Parts from tally', sub: plural(i.tallyCount, 'part'), hours: null, usd: n(i.tallyUsd), sharePct: null, state: i.tallyFailed ? 'failed' : 'ok', accordion: 'tally' },
    { key: 'other', label: 'Other job charges', sub: i.otherCount > 0 ? plural(i.otherCount, 'line') : '+ Add other charge below', hours: null, usd: n(i.otherUsd), sharePct: null, state: 'ok', accordion: 'billed' },
  ]
  const total = rows.reduce((s, r) => s + (r.state === 'ok' ? r.usd : 0), 0)
  for (const r of rows) r.sharePct = total > 0 && r.state === 'ok' && r.usd > 0 ? (r.usd / total) * 100 : null
  rows.sort((a, b) => b.usd - a.usd)
  rows.push({ key: 'total', label: 'Direct cost to date', sub: rows.some((r) => r.state !== 'ok') ? 'some sources did not load' : '', hours: n(i.teamHours), usd: total, sharePct: null, state: 'ok', accordion: null })
  return rows
}
