/** Sub Sheet Ledger ("Sub Labor") domain types, shared across Jobs tabs and the extracted JobsSubLaborTab. */

export type LaborJobPayment = { id: string; amount: number; memo: string | null; created_at: string }

export type LaborJob = {
  id: string
  assigned_to_name: string
  address: string
  job_number: string | null
  labor_rate: number | null
  job_date: string | null
  created_at: string | null
  distance_miles?: number | null
  paid_at?: string | null
  invoice_link?: string | null
  items?: Array<{
    fixture: string
    count: number
    hrs_per_unit: number
    is_fixed?: boolean
    labor_rate?: number | null
    direct_labor_amount?: number | null
  }>
  payments?: LaborJobPayment[]
}

/** Target seed for the parent-owned Make Payment modal. */
export type SubLaborPaymentTarget = {
  id: string
  contractor: string
  hcp: string
  totalCost: number
  paid: number
  outstanding: number
}

/** Target seed for the parent-owned Backcharge modal. */
export type SubLaborBackchargeTarget = {
  id: string
  contractor: string
  hcp: string
  totalCost: number
  paid: number
}
