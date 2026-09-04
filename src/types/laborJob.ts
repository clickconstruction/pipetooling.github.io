/** Sub Sheet Ledger ("Sub Labor") domain types, shared across Jobs tabs and the extracted JobsSubLaborTab. */

export type LaborJobPayment = { id: string; amount: number; memo: string | null; created_at: string; payment_date?: string | null }

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
  /** Optional project/step anchors (RUN_SUBS_PLAN PR 0.3); set by commitment settlement in Phase 2. */
  project_id?: string | null
  step_id?: string | null
  /** Sub sheet stage (v2.2767): working | walkthrough | customer_pay; paid is derived from the balance. */
  stage?: string | null
  stage_changed_at?: string | null
  stage_changed_by?: string | null
  stage_source?: string | null
  stage_note?: string | null
  /** Resolved display name of stage_changed_by (office moves only). */
  stage_changed_by_name?: string | null
  /** Project name resolved for anchored sheets (display only). */
  project_name?: string | null
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
