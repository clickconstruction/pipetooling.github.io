/**
 * TypeScript types for database RPC functions
 * 
 * These types correspond to the database functions created in migrations.
 * Use these with Supabase RPC calls for type-safe database operations.
 */

/**
 * Parameters for update_bids_count_rows_order function (Counts drag reorder)
 */
export interface UpdateBidsCountRowsOrderParams {
  p_bid_id: string
  p_ordered_ids: string[]
}

/**
 * Parameters for create_project_with_template function
 */
export interface CreateProjectWithTemplateParams {
  p_name: string
  p_customer_id: string
  p_address: string
  p_master_user_id: string
  p_template_id?: string | null
  p_notes?: string | null
}

/**
 * Return type for create_project_with_template function
 */
export interface CreateProjectWithTemplateResult {
  project_id: string
  workflow_id: string | null
  success: boolean
}

/**
 * Parameters for duplicate_bid_to_service_type (new bid, different trade)
 */
export interface DuplicateBidToServiceTypeParams {
  p_source_bid_id: string
  p_target_service_type_id: string
}

/**
 * Parameters for duplicate_purchase_order function
 */
export interface DuplicatePurchaseOrderParams {
  p_source_po_id: string
  p_created_by: string
}

/**
 * Return type for duplicate_purchase_order function
 */
export interface DuplicatePurchaseOrderResult {
  new_po_id: string
  items_copied: number
  success: boolean
}

/**
 * Parameters for copy_workflow_step function
 */
export interface CopyWorkflowStepParams {
  p_step_id: string
  p_insert_after_sequence: number
}

/**
 * Return type for copy_workflow_step function
 */
export interface CopyWorkflowStepResult {
  new_step_id: string
  new_sequence: number
  success: boolean
}

/**
 * Parameters for create_takeoff_entry_with_items function
 */
export interface CreateTakeoffEntryWithItemsParams {
  p_bid_id: string
  p_page: string
  p_entry_data: {
    item_type?: string
    item_size?: string
    fitting_type?: string
  }
  p_items: Array<{
    quantity: number
    location?: string
    notes?: string
  }>
}

/**
 * Return type for create_takeoff_entry_with_items function
 */
export interface CreateTakeoffEntryWithItemsResult {
  entry_id: string
  items_created: number
  success: boolean
}

/** Parameters for `update_contract_book_entry` (Contract Book save + optional rename cascade). */
export interface UpdateContractBookEntryParams {
  p_contract_template_document_id: string
  p_document_name: string
  p_book_body_html: string | null
  p_book_body_format: string
  p_tags: string[]
  /** Trimmed; empty clears canonical in DB (RPC uses NULLIF). */
  p_canonical_document_url: string
}

/** Parameters for `remove_jobs_ledger_payment_and_reconcile` (Edit Job payment unlink). */
export interface RemoveJobsLedgerPaymentAndReconcileParams {
  p_payment_id: string
}

/** JSON payload from `remove_jobs_ledger_payment_and_reconcile`. */
export interface RemoveJobsLedgerPaymentAndReconcileResult {
  ok?: boolean
  error?: string
  warning?: string
  payments_made?: number
}

/**
 * Helper type to extend Supabase client with RPC function types
 * 
 * Usage:
 * ```ts
 * import { supabase } from './supabaseClient'
 * import type { DatabaseFunctions } from './types/database-functions'
 * 
 * // Type-safe RPC call
 * const result = await supabase.rpc<DatabaseFunctions, 'create_project_with_template'>(
 *   'create_project_with_template',
 *   params
 * )
 * ```
 */
export interface DatabaseFunctions {
  create_project_with_template: {
    Args: CreateProjectWithTemplateParams
    Returns: CreateProjectWithTemplateResult
  }
  duplicate_purchase_order: {
    Args: DuplicatePurchaseOrderParams
    Returns: DuplicatePurchaseOrderResult
  }
  copy_workflow_step: {
    Args: CopyWorkflowStepParams
    Returns: CopyWorkflowStepResult
  }
  create_takeoff_entry_with_items: {
    Args: CreateTakeoffEntryWithItemsParams
    Returns: CreateTakeoffEntryWithItemsResult
  }
  update_contract_book_entry: {
    Args: UpdateContractBookEntryParams
    Returns: null
  }
  remove_jobs_ledger_payment_and_reconcile: {
    Args: RemoveJobsLedgerPaymentAndReconcileParams
    Returns: RemoveJobsLedgerPaymentAndReconcileResult
  }
}

/**
 * Row returned by bid_pricing_history (Workbench win/loss calibration strip):
 * decided bids of a service type with asked price + estimated cost from the
 * stored cost-estimate inputs (no clocked team labor — margins are estimates).
 */
export interface BidPricingHistoryRow {
  bid_id: string
  project_name: string | null
  outcome: 'won' | 'lost'
  loss_reason: string | null
  /** Structured six-bucket loss reason (since 20260822003000); optional so an un-migrated RPC still parses. */
  loss_category?: string | null
  bid_value: number
  est_cost: number
  /** Recorded bid-tab low (since 20260822143810) — feeds the strip's match-the-low markers; optional pre-migration. */
  bid_tab_low?: number | null
  /** The bid's GC (since 20260822143810) — lets the tab verdict go GC-specific; optional pre-migration. */
  customer_id?: string | null
}

/**
 * Result shape of get_billed_customer_pay_speeds (jsonb; null when the caller
 * is outside the dev/master/assistant-like/primary gate). Parse with
 * `parsePaySpeedsRpc` in `src/lib/jobs/billedExpectedPay.ts` — the Billed
 * Awaiting Payment expected-payment chips.
 */
export interface BilledCustomerPaySpeedsResult {
  company: { medianDays: number; samples: number } | null
  customers: Record<string, { medianDays: number; samples: number }>
  /** v2: residential/commercial medians over the same samples. */
  segments: {
    residential: { medianDays: number; samples: number } | null
    commercial: { medianDays: number; samples: number } | null
  }
  /** v2: every typed customer's classification. */
  customerTypes: Record<string, 'residential' | 'commercial'>
  /** v3: customer id → measurable payments (newest paid first, max 12). */
  receipts: Record<string, { billedYmd: string; paidYmd: string; gapDays: number }[]>
}

/**
 * Params for set_job_promised_pay_date (NULL p_date clears the promise).
 * Dev/master/assistant-like only; stamps marked_by = auth.uid().
 */
export interface SetJobPromisedPayDateParams {
  p_job_id: string
  p_date: string | null
}

/**
 * Result shape of list_job_promised_pay_dates (jsonb keyed by job id; null
 * when the caller is outside the dev/master/assistant-like/primary gate).
 * Parse with `parsePromisedPayDatesRpc` in `src/lib/jobs/billedExpectedPay.ts`.
 */
export type JobPromisedPayDatesResult = Record<
  string,
  { promisedYmd: string; markedByName: string; markedAt: string }
>

/**
 * Params for create_billed_shell_invoice — materialize the missing billed
 * line (full open remainder, backdated) for a Billed no-bill-line shell.
 * Dev/master/assistant-like only. Returns { invoiceId, amount }.
 */
export interface CreateBilledShellInvoiceParams {
  p_job_id: string
  p_billed_on: string
}

/**
 * Result of mint_customer_portal_link (portal train PR 1): the RAW portal
 * token, returned exactly once — only its sha256 is stored. `exists` +
 * `activeSince` come back instead when an active link exists and
 * p_rotate=false (the globe modal then offers Rotate).
 */
export interface MintCustomerPortalLinkResult {
  token?: string
  audience?: 'customer' | 'gc' | 'all'
  exists?: boolean
  activeSince?: string
  error?: string
}

/**
 * Result of mint_sub_portal_link (sub-portal train — the customer mint's
 * person-keyed twin; no audiences).
 */
export interface MintSubPortalLinkResult {
  token?: string
  activeSince?: string
  error?: string
}

/**
 * Result of set_sub_portal_slug / mark_sub_portal_slug_shared (sub-portal
 * train). Uniqueness spans customer_portal_slugs too — one printed namespace.
 */
export interface SetSubPortalSlugResult {
  slug?: string
  unchanged?: boolean
  locked?: boolean
  error?: string
}

/**
 * Result shape shared by set_sub_sheet_portal_fields and
 * set_sub_payment_visibility (sub-portal train office writers).
 */
export interface SubPortalOfficeWriteResult {
  ok?: boolean
  error?: string
}

/**
 * Result of set_customer_portal_slug (portal custom-links train): the saved
 * address, or a friendly error string ("That address is taken — try
 * another." / format guidance). `unchanged` when the slug already matched.
 */
export interface SetCustomerPortalSlugResult {
  slug?: string
  unchanged?: boolean
  error?: string
}

/** Result of mark_customer_portal_slug_shared: locked=true on the first-share transition. */
export interface MarkCustomerPortalSlugSharedResult {
  locked?: boolean
  slug?: string
  error?: string
}
