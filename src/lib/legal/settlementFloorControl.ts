/**
 * The settlement floor's control (v2.5759): one slider, a % box and a $ box that move together. Whole numbers while
 * sliding (the % by 1, the $ as whole dollars); a typed amount keeps its cents. The box typed in last decides what
 * is saved — a share of the balance, which moves as payments land, or a fixed dollar amount. Pure; the desk's
 * `SettlementFloorEditor` holds this as its state.
 */
import { settlementFloorDollars, type LegalSettlementFloor } from '../../../supabase/functions/_shared/legalSettlement'

export type FloorControl = { unit: 'pct' | 'usd'; pct: number; pctText: string; usdText: string }

export const clampPct = (n: number): number => Math.min(100, Math.max(0, Math.round(n)))
/** Dollars with commas and no forced cents: `12,000` and `1,480.5`. */
export const plainMoney = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const parseUsd = (text: string): number => Number(text.replace(/[$,]/g, ''))

/** The closed line's chip: *any amount*, *80% or more*, *$12,000.00 or more*. */
export function floorChipWords(floor: LegalSettlementFloor | null, money: (n: number) => string): string {
  if (!floor || (floor.amount == null && floor.pct == null)) return 'any amount'
  return floor.amount != null ? `${money(floor.amount)} or more` : `${floor.pct}% or more`
}

/** The muted words after the chip: what the floor is in dollars today, or that the firm never has to ask. */
export function floorTodayWords(floor: LegalSettlementFloor | null, balance: number, money: (n: number) => string): string {
  const today = settlementFloorDollars(floor, balance)
  return today != null ? `That is ${money(today)} today. Below that, the firm asks us.` : 'The firm settles without asking us.'
}

const dollarsAt = (p: number, balance: number): string => (p > 0 ? Math.round(settlementFloorDollars({ amount: null, pct: p }, balance) ?? 0).toLocaleString('en-US') : '')

export function floorControlFromPct(p: number, balance: number): FloorControl {
  const pct = clampPct(p)
  return { unit: 'pct', pct, pctText: pct > 0 ? String(pct) : '', usdText: dollarsAt(pct, balance) }
}

/** The control as the panel opens: the saved floor, read back as both a share and dollars. */
export function floorControlStart(floor: LegalSettlementFloor | null, balance: number): FloorControl {
  if (floor?.amount != null) {
    const pct = balance > 0 ? clampPct((floor.amount / balance) * 100) : 0
    return { unit: 'usd', pct, pctText: String(pct), usdText: plainMoney(floor.amount) }
  }
  return floorControlFromPct(floor?.pct ?? 0, balance)
}

/** Typing in the % box: digits only; out of range keeps the text and changes nothing else. */
export function floorControlTypePct(prev: FloorControl, raw: string, balance: number): FloorControl {
  const text = raw.replace(/[^0-9]/g, '')
  if (text === '') return { unit: 'pct', pct: 0, pctText: '', usdText: '' }
  const n = Number(text)
  if (n > 100) return { ...prev, pctText: text }
  return { unit: 'pct', pct: n, pctText: text, usdText: dollarsAt(n, balance) }
}

/** Typing in the $ box: `$` and commas allowed; a number moves the % and the slider with it. */
export function floorControlTypeUsd(prev: FloorControl, text: string, balance: number): FloorControl {
  if (text.trim() === '') return { unit: 'pct', pct: 0, pctText: '', usdText: '' }
  const n = parseUsd(text)
  if (!Number.isFinite(n) || n <= 0) return { ...prev, usdText: text }
  const pct = balance > 0 ? clampPct((n / balance) * 100) : 0
  return { unit: 'usd', pct, pctText: String(pct), usdText: text }
}

export function floorControlValid(c: FloorControl): boolean {
  if (c.unit === 'usd') { const n = parseUsd(c.usdText); return Number.isFinite(n) && n > 0 }
  const n = Number(c.pctText)
  return c.pctText.trim() === '' || (Number.isFinite(n) && n >= 0 && n <= 100)
}

/** What Save writes: a dollar floor, a share, or no floor at all. */
export function floorControlSave(c: FloorControl): { amount: number | null; pct: number | null } {
  if (c.unit === 'usd') return { amount: parseUsd(c.usdText), pct: null }
  return { amount: null, pct: c.pct > 0 ? c.pct : null }
}

/** The line beside Save: exactly what it will do. */
export function floorControlSavesWords(c: FloorControl, money: (n: number) => string): string {
  const plan = floorControlSave(c)
  if (plan.amount != null) return `Saves as ${money(plan.amount)}, whatever the balance becomes.`
  if (plan.pct == null) return 'Saves as no floor. The firm never has to ask.'
  return `Saves as ${plan.pct}% of the balance, so it moves as payments land.`
}
