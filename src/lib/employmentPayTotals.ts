/**
 * Per-person pay totals for the Employment tab header:
 * - paidTotal — every payment installment recorded against the person's stubs (all time)
 * - dueTotal — Σ max(0, stub net pay − payments against it) over generated stubs
 * Upcoming (worked but not yet on a stub) comes from `buildUpcomingPayrollSummary`, not here.
 * Mirrors `useDashboardFinancials`'s payroll math so the two surfaces always agree.
 */

import { stubNetPay } from './payStubDeductions'
import { payWeekStartYmd } from './upcomingPayrollSummary'

export type EmploymentStubTotalsInput = {
  stubs: Array<{ id: string; gross_pay: number | null; period_start: string }>
  payments: Array<{ pay_stub_id: string; amount: number | null }>
  deductions: Array<{ pay_stub_id: string; amount: number | null }>
  additionalLines: Array<{ pay_stub_id: string; line_total: number | null }>
}

export type EmploymentStubTotals = {
  paidTotal: number
  dueTotal: number
  /** Distinct pay-period weeks with at least one payment (multiple stubs in one week count once). */
  paidWeekCount: number
  /** paidTotal ÷ paidWeekCount; null when no week has been paid yet. */
  avgPaidPerWeek: number | null
}

function sumByStub<T extends { pay_stub_id: string }>(rows: T[], value: (r: T) => number): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.pay_stub_id, (m.get(r.pay_stub_id) ?? 0) + value(r))
  return m
}

const roundCents = (n: number): number => Math.round(n * 100) / 100

export function computeEmploymentStubTotals(input: EmploymentStubTotalsInput): EmploymentStubTotals {
  const paidByStub = sumByStub(input.payments, (r) => Number(r.amount ?? 0))
  const lessByStub = sumByStub(input.deductions, (r) => Number(r.amount ?? 0))
  const addByStub = sumByStub(input.additionalLines, (r) => Number(r.line_total ?? 0))

  let paidTotal = 0
  let dueTotal = 0
  const paidWeeks = new Set<string>()
  for (const s of input.stubs) {
    const paid = paidByStub.get(s.id) ?? 0
    const net = stubNetPay(Number(s.gross_pay ?? 0), lessByStub.get(s.id) ?? 0, addByStub.get(s.id) ?? 0)
    paidTotal += paid
    dueTotal += Math.max(0, net - paid)
    if (paid > 0) paidWeeks.add(payWeekStartYmd(s.period_start))
  }
  const paidTotalRounded = roundCents(paidTotal)
  return {
    paidTotal: paidTotalRounded,
    dueTotal: roundCents(dueTotal),
    paidWeekCount: paidWeeks.size,
    avgPaidPerWeek: paidWeeks.size > 0 ? roundCents(paidTotalRounded / paidWeeks.size) : null,
  }
}
