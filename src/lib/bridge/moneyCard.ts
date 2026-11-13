import type { CashForecast } from './cashForecast'
import { shortK } from './headline'
import { firstDayUnderFloor, whenWords, type WeekTone } from './weekCall'

/**
 * The balances on the Bridge's first screen (punch list #334, PR 6): the cash balance and the accrual balance, each
 * with its runway, beside *Made last week* and *Slowest step*. They stand in for the red band *Under the floor
 * today* and the separate cash tile.
 *
 * The owner, of the band: it is "not super productive". Then: "show a cash balance next to an accrual balance. The
 * cash balance is our bank account and the accrual balance is our accounts receivable minus our accounts payable
 * minus payroll plus our bank balance."
 *
 * - **Cash balance**: cash on hand today, and one sentence against the floor. Red is kept for the number.
 * - **Accrual balance**: cash, plus what customers owe, less what the company owes. It is the page's own net
 *   position (`netPosition.ts`), so the first screen and the chart behind Money can never read two amounts. What the
 *   company owes is the supply bills, the payroll owed and the sub labor owed; what customers owe leaves collections
 *   out, as everywhere on the page.
 *
 * - **Runway**, beside each balance: how many days that balance would carry the company with nothing coming in. The
 *   owner: "next to both we should show runway in days if possible. runway is just counting payroll and overhead".
 *   So a day's burn is payroll for a week over seven, plus overhead for a day, the two figures the page's cash
 *   forecast already spends (`payrollWeeklyEstUsd`, `dailyDrainUsd`). Overhead here is the pool's spending that is
 *   not labor, so office pay is counted once, under payroll. Supply bills and sub labor are not in the burn.
 *
 * Kept apart from `weekCall.ts`, which is copied to the edge functions: the weekly email does not draw this card.
 *
 * Pure.
 */

export type MoneyLine = {
  id: 'cash' | 'accrual'
  label: string
  value: string
  /** One or two short sentences under the number. */
  sub: string
  tone: WeekTone
  /** On cash: the accounts left out of cash on hand, in one sentence. */
  note?: string
  /** "12 days of runway"; absent when the burn or the balance is not read. */
  runway?: string
}

/** Payroll and overhead for one calendar day, or null when neither reads. */
export function burnPerDay(input: { payrollPerWeekUsd: number | null; overheadPerDayUsd: number | null }): number | null {
  const { payrollPerWeekUsd, overheadPerDayUsd } = input
  if (payrollPerWeekUsd == null && overheadPerDayUsd == null) return null
  const usd = Math.max(0, payrollPerWeekUsd ?? 0) / 7 + Math.max(0, overheadPerDayUsd ?? 0)
  return usd > 0 ? usd : null
}

/** How many whole days a balance carries the burn. Null when there is no burn to divide by. */
export function runwayDays(balanceUsd: number, burnPerDayUsd: number | null): number | null {
  if (burnPerDayUsd == null || !(burnPerDayUsd > 0)) return null
  return balanceUsd <= 0 ? 0 : Math.floor(balanceUsd / burnPerDayUsd)
}

/** "12 days of runway", "1 day of runway", "Under a day of runway", "No runway". Empty when it cannot be read. */
export function runwayWords(balanceUsd: number, burnPerDayUsd: number | null): string {
  const days = runwayDays(balanceUsd, burnPerDayUsd)
  if (days == null) return ''
  if (balanceUsd <= 0) return 'No runway'
  if (days === 0) return 'Under a day of runway'
  return `${days.toLocaleString('en-US')} ${days === 1 ? 'day' : 'days'} of runway`
}

/** The one line under both balances that says what runway counts. Empty when there is no burn. */
export function runwayFoot(burnPerDayUsd: number | null): string {
  return burnPerDayUsd == null ? '' : `Runway counts payroll and overhead, ${shortK(burnPerDayUsd)} a day.`
}

const withRunway = (line: MoneyLine, balanceUsd: number, burnPerDayUsd: number | null | undefined): MoneyLine => {
  const runway = runwayWords(balanceUsd, burnPerDayUsd ?? null)
  return runway ? { ...line, runway } : line
}

export type MoneyCashInput = {
  forecast: Pick<CashForecast, 'days' | 'lowest' | 'floorUsd' | 'clearsFloor'> | null
  cashTodayUsd: number | null
  /** The accounts the owner switched off, in one sentence; empty when every account counts. */
  cashNote?: string | null
  todayYmd: string
  dayLabel: (ymd: string) => string
  /** Payroll and overhead for a day (`burnPerDay`); with it the balance says its runway. */
  burnPerDayUsd?: number | null
}

export const MONEY_CASH_LABEL = 'Cash balance'
export const MONEY_ACCRUAL_LABEL = 'Accrual balance'

/** Cash on hand today and where it stands against the floor. With no balance read, the forecast's low point stands in. */
export function cashLine(input: MoneyCashInput): MoneyLine {
  const f = input.forecast
  if (!f) return { id: 'cash', label: MONEY_CASH_LABEL, value: 'not read', sub: 'Cash on hand is not read yet.', tone: 'plain' }
  const floor = shortK(f.floorUsd)
  const note = input.cashNote ? { note: input.cashNote } : {}
  const today = input.cashTodayUsd
  const lowDay = input.dayLabel(f.lowest.ymd)
  if (today == null) {
    // No balance today: the low point is the one cash figure the page can stand behind.
    return { id: 'cash', label: 'Cash low point, 8 weeks', value: shortK(f.lowest.cashUsd), sub: f.clearsFloor ? `On ${lowDay}. The floor is ${floor}.` : `On ${lowDay}. Under the ${floor} floor.`, tone: f.clearsFloor ? 'green' : 'red', ...note }
  }
  const value = shortK(today)
  const run = (line: MoneyLine): MoneyLine => withRunway(line, today, input.burnPerDayUsd)
  if (f.clearsFloor) return run({ id: 'cash', label: MONEY_CASH_LABEL, value, sub: `Stays over the ${floor} floor. Low point ${shortK(f.lowest.cashUsd)} on ${lowDay}.`, tone: 'green', ...note })
  const first = firstDayUnderFloor(f, today, input.todayYmd)
  if (first && first.offset > 0) return run({ id: 'cash', label: MONEY_CASH_LABEL, value, sub: `Goes under the ${floor} floor ${whenWords(first.offset)}, on ${input.dayLabel(first.ymd)}.`, tone: 'amber', ...note })
  return run({ id: 'cash', label: MONEY_CASH_LABEL, value, sub: `Under the ${floor} floor.`, tone: 'red', ...note })
}

export type MoneyAccrualInput = {
  /** Cash on hand today, the same figure the cash balance shows. */
  cashUsd: number | null
  /** Owed to the company, collections left out. */
  owedToYouUsd: number | null
  /** Owed by the company: supply bills, payroll owed and sub labor owed. */
  owedByYouUsd: number | null
  /** Payroll and overhead for a day (`burnPerDay`); with it the balance says its runway. */
  burnPerDayUsd?: number | null
}

/** Cash, plus what is owed to the company, less what it owes. Not read until all three are. */
export function accrualLine(input: MoneyAccrualInput): MoneyLine {
  const { cashUsd, owedToYouUsd, owedByYouUsd } = input
  if (cashUsd == null || owedToYouUsd == null || owedByYouUsd == null) return { id: 'accrual', label: MONEY_ACCRUAL_LABEL, value: 'not read', sub: 'What is owed is not read yet.', tone: 'plain' }
  const usd = cashUsd + owedToYouUsd - owedByYouUsd
  return withRunway(
    {
      id: 'accrual',
      label: MONEY_ACCRUAL_LABEL,
      value: shortK(usd),
      // "You owe" is the supply bills, the payroll and the sub labor together.
      sub: `Adds ${shortK(owedToYouUsd)} owed to you. Takes off ${shortK(owedByYouUsd)} you owe, subs included.`,
      tone: usd < 0 ? 'red' : 'plain',
    },
    usd,
    input.burnPerDayUsd,
  )
}

/** What a screen reader hears on the accrual balance's press. */
export function accrualPressLabel(line: MoneyLine): string {
  return `${line.label} ${line.value}. ${line.runway ? `${line.runway}. ` : ''}${line.sub} Open Money owed.`
}
