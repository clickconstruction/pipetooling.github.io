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
}
