/** Physical payment installments recorded against a pay stub (see pay_stub_payments). */

export type PayStubPaymentRow = {
  id: string
  pay_stub_id: string
  amount: number
  paid_at: string
  memo: string | null
  created_at: string | null
  created_by: string | null
}

export const PAY_STUB_PAY_FULLY_TOLERANCE = 0.01

export function sumPayStubPaymentAmounts(rows: PayStubPaymentRow[] | undefined): number {
  if (!rows?.length) return 0
  return Math.round(rows.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100
}

export function remainingPayStubBalance(grossPay: number, paidSum: number): number {
  return Math.max(0, Math.round((grossPay - paidSum) * 100) / 100)
}

export function isPayStubFullyPaid(grossPay: number, paidSum: number): boolean {
  return paidSum + PAY_STUB_PAY_FULLY_TOLERANCE >= grossPay
}
