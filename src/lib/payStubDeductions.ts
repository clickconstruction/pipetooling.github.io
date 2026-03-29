/** Deduction lines (Less) on a pay stub — see pay_stub_deductions. */

export type PayStubDeductionRow = {
  id: string
  pay_stub_id: string
  amount: number
  source: 'manual' | 'offset'
  person_offset_id: string | null
  description: string
  created_at: string | null
  created_by: string | null
}

/** Additional lines — see pay_stub_additional_lines (line_total = round(qty × rate, 2)). */
export type PayStubAdditionalLineRow = {
  id: string
  pay_stub_id: string
  description: string
  quantity: number
  rate: number
  line_total: number
  created_at: string | null
  created_by: string | null
}

export function sumPayStubDeductionAmounts(rows: PayStubDeductionRow[] | undefined): number {
  if (!rows?.length) return 0
  return Math.round(rows.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100
}

export function sumPayStubAdditionalAmounts(rows: PayStubAdditionalLineRow[] | undefined): number {
  if (!rows?.length) return 0
  return Math.round(rows.reduce((s, r) => s + Number(r.line_total), 0) * 100) / 100
}

/** Net Pay = gross − Less + Additional (never negative). */
export function stubNetPay(grossPay: number, deductionsSum: number, additionalSum = 0): number {
  return Math.max(0, Math.round((grossPay - deductionsSum + additionalSum) * 100) / 100)
}
