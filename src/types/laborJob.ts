/** Sub Sheet Ledger ("Sub Labor") domain types, shared across Jobs tabs and the extracted JobsSubLaborTab. */

export type LaborJobPayment = {
  id: string
  amount: number
  memo: string | null
  created_at: string
  payment_date?: string | null
  /** How it was sent (v2.7176): one of `SUB_PAY_METHODS`, null on a row recorded before the chips. */
  method?: string | null
  /** The method's own number: a check number, a Cash App id, a confirmation. */
  method_ref?: string | null
  /** v2.7235: the sending this row is part of. Rows that share one were one check or one transfer. */
  sending_id?: string | null
  /** The sending's number, never reused. Resolved by the ledger hook. */
  sending_no?: number | null
  /** Credit kept with this row: what was sent past what the sheets needed. Resolved by the ledger hook. */
  credit_kept?: number | null
}

/** v2.7235: one sending to record. `lines` are the sheets it pays, `credit` what is kept past them. */
export type SubSendingInput = {
  personId: string | null
  lines: Array<{ jobId: string; amount: number }>
  credit: number
  paymentDate: string | null
  method: string | null
  methodRef: string | null
  memo: string | null
  hiddenFromSub: boolean
}

/** What a write that leans on the credit migration answers: done, not live yet, or refused with its reason. */
export type SubSendingResult = { ok: true } | { ok: false; missing: boolean; message: string }

/** What the Record payment and Edit Payment windows add to a payment beyond its amount, date and memo (v2.7176). */
export type SubPaymentExtras = { method?: string | null; method_ref?: string | null; hidden_from_sub?: boolean }

/** v2.3562: what happened to a payment — moved (from → to), removed (snapshot; restored_event_id once undone), restored. */
export type LaborJobPaymentEvent = {
  id: string
  kind: 'moved' | 'removed' | 'restored'
  payment_id: string | null
  from_job_id: string | null
  to_job_id: string | null
  amount: number
  memo: string | null
  payment_date: string | null
  reason: string | null
  actor_name: string | null
  restored_event_id: string | null
  created_at: string
}

export type LaborJob = {
  id: string
  assigned_to_name: string
  address: string
  job_number: string | null
  /** The job this sheet is on (v2.3055); job_number is display text. */
  job_ledger_id?: string | null
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
  /** Queued for the pay run (v2.2838) — the portal lights "You're paid" once this is set. */
  payable_after?: string | null
  /** Why the office is holding this sheet's pay (shown on the portal and the pay-run view). */
  pay_hold_reason?: string | null
  /** Resolved display name of stage_changed_by (office moves only). */
  stage_changed_by_name?: string | null
  /** The sub's own percent from the portal (v2.2931) — evidence for the derived stage (v2.3064). */
  progress_pct?: number | null
  progress_at?: string | null
  /** Display-only: why the effective stage differs from the stored one (v2.3064); never persisted. */
  stage_auto_reason?: 'percent' | 'window' | null
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
  /** v2.3562: the trace — every move in or out and every removal touching this sheet. */
  payment_events?: LaborJobPaymentEvent[]
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
