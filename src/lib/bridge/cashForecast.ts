import { ymdAddDays } from '../../utils/dateUtils'

/**
 * Cash forecast kernel (v2.2726) — the Bridge's purple line.
 *
 * Starts at cash today, then every bill on the day it is due and every
 * receipt on the day it is expected, plus a smooth daily drain for spend
 * that has no schedule (office parts and the like). The readout is a point
 * in time: the lowest cash day in the window and whether it clears the
 * floor. Nothing here is accrual — it is money in the bank, by date.
 *
 * Pure: no React, no Supabase.
 */

export type CashEvent = { ymd: string; usd: number; label: string; kind: 'bill' | 'receipt' }

export type CashForecastDay = { ymd: string; offset: number; cashUsd: number; billsUsd: number; receiptsUsd: number }

export type CashForecast = {
  days: CashForecastDay[]
  lowest: { ymd: string; offset: number; cashUsd: number }
  endUsd: number
  floorUsd: number
  clearsFloor: boolean
  /** Days in the window with cash under the floor. */
  daysUnderFloor: number
  totalBillsUsd: number
  totalReceiptsUsd: number
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function buildCashForecast(input: {
  todayYmd: string
  daysAhead: number
  cashTodayUsd: number
  floorUsd: number
  events: ReadonlyArray<CashEvent>
  /** Unscheduled spend per calendar day, subtracted every day. */
  dailyDrainUsd?: number
}): CashForecast {
  const drain = num(input.dailyDrainUsd)
  const byDay = new Map<string, { bills: number; receipts: number }>()
  const endYmd = ymdAddDays(input.todayYmd, input.daysAhead)
  for (const e of input.events) {
    // Events dated in the past (a bill already overdue, a promise already missed) land on the first forecast day.
    const ymd = e.ymd <= input.todayYmd ? ymdAddDays(input.todayYmd, 1) : e.ymd
    if (ymd > endYmd) continue
    const cur = byDay.get(ymd) ?? { bills: 0, receipts: 0 }
    if (e.kind === 'bill') cur.bills += Math.abs(num(e.usd))
    else cur.receipts += Math.abs(num(e.usd))
    byDay.set(ymd, cur)
  }
  const days: CashForecastDay[] = []
  let cash = input.cashTodayUsd
  let lowest = { ymd: input.todayYmd, offset: 0, cashUsd: cash }
  let daysUnderFloor = 0
  let totalBillsUsd = 0
  let totalReceiptsUsd = 0
  for (let o = 1; o <= input.daysAhead; o++) {
    const ymd = ymdAddDays(input.todayYmd, o)
    const ev = byDay.get(ymd) ?? { bills: 0, receipts: 0 }
    cash += ev.receipts - ev.bills - drain
    totalBillsUsd += ev.bills
    totalReceiptsUsd += ev.receipts
    if (cash < lowest.cashUsd) lowest = { ymd, offset: o, cashUsd: cash }
    if (cash < input.floorUsd) daysUnderFloor++
    days.push({ ymd, offset: o, cashUsd: cash, billsUsd: ev.bills, receiptsUsd: ev.receipts })
  }
  return {
    days,
    lowest,
    endUsd: cash,
    floorUsd: input.floorUsd,
    clearsFloor: lowest.cashUsd >= input.floorUsd,
    daysUnderFloor,
    totalBillsUsd,
    totalReceiptsUsd,
  }
}

export const LATE_RECEIPT_GRACE_DAYS = 14
export const DOUBTFUL_AFTER_DAYS = 60

/**
 * Where an expected receipt lands on the forecast. On time → its expected day.
 * Recently late (under `doubtfulAfterDays` past expected) → today + a grace
 * window, because "they'll pay any day now" is not the same as tomorrow.
 * Late beyond that → not counted at all (doubtful), listed beside collections.
 */
export function scheduleReceipt(
  expectedYmd: string,
  todayYmd: string,
  opts: { graceDays?: number; doubtfulAfterDays?: number } = {},
): { ymd: string; status: 'on-time' } | { ymd: string; status: 'late'; daysLate: number } | { ymd: null; status: 'doubtful'; daysLate: number } {
  const grace = opts.graceDays ?? LATE_RECEIPT_GRACE_DAYS
  const doubtfulAfter = opts.doubtfulAfterDays ?? DOUBTFUL_AFTER_DAYS
  if (expectedYmd > todayYmd) return { ymd: expectedYmd, status: 'on-time' }
  const daysLate = Math.round((Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${expectedYmd}T00:00:00Z`)) / 86_400_000)
  if (daysLate >= doubtfulAfter) return { ymd: null, status: 'doubtful', daysLate }
  return { ymd: ymdAddDays(todayYmd, grace), status: 'late', daysLate }
}

/** Next `count` Fridays after today (offset ≥ 1) — payroll days. */
export function upcomingFridays(todayYmd: string, daysAhead: number): string[] {
  const out: string[] = []
  for (let o = 1; o <= daysAhead; o++) {
    const ymd = ymdAddDays(todayYmd, o)
    if (new Date(`${ymd}T12:00:00Z`).getUTCDay() === 5) out.push(ymd)
  }
  return out
}
