import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, Tables } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { resolveCustomerIdForJobPayload, type JobPayloadCustomerRow } from './jobLedgerCustomer'
import { resolveEffectiveJobMasterUserId } from './resolveEffectiveJobMasterUserId'
import {
  normalizeEstimateLineItemsFromJson,
  type EstimateLineItemNormalized,
} from './estimateLineItemNormalize'
import { isChangeOrderDocKind } from './estimateChangeOrder'

/** Fields required to call `create_job_from_estimate` with the same rules as Estimate detail. */
export type EstimateForCreateJob = Pick<
  Tables<'estimates'>,
  | 'id'
  | 'status'
  | 'project_id'
  | 'customer_id'
  | 'job_ledger_id'
  | 'title'
  | 'for_address'
  | 'total_cents'
  | 'line_items_snapshot'
  // CO money train PR 4: the modal speaks change-order (title, apply-to-job lead path).
  | 'doc_kind'
  | 'estimate_number'
  // v2.2741: a signed bid-room proposal carries its bid; the job inherits it (DB trigger) and the modal says so.
  | 'bid_id'
>

export type CreateJobFixtureRpcRow = {
  name: string
  count: number
  line_unit_price: number | null
  line_description: string | null
  sequence_order: number
}

/** Maps normalized estimate lines to RPC `p_fixtures` rows (Specific Work). */
export function fixturesPayloadForCreateJobFromEstimate(
  lines: EstimateLineItemNormalized[],
): CreateJobFixtureRpcRow[] {
  const out: CreateJobFixtureRpcRow[] = []
  lines.forEach((row, idx) => {
    const li = (row.line_item ?? '').trim()
    const desc = (row.description ?? '').trim()
    const name = li || desc || (row.amount_cents > 0 ? 'Item' : '')
    if (!name) return

    const line_description = li !== '' ? (desc || null) : null
    const unitDollars = row.unit_price_cents / 100
    const line_unit_price =
      Number.isFinite(unitDollars) ? Math.round(unitDollars * 100) / 100 : null

    out.push({
      name,
      count: row.quantity,
      line_unit_price,
      line_description,
      sequence_order: idx,
    })
  })
  return out
}

export function computeCreateJobBidDisplayDollars(
  lines: EstimateLineItemNormalized[],
  estimateTotalCents: number | null,
): number {
  const fixtures = fixturesPayloadForCreateJobFromEstimate(lines)
  if (fixtures.length === 0) {
    return (estimateTotalCents ?? 0) / 100
  }
  let s = 0
  for (const f of fixtures) {
    s += f.count * (f.line_unit_price ?? 0)
  }
  return Math.round(s * 100) / 100
}

export type CreateJobFromEstimateFormValues = {
  hcp: string
  jobName: string
  jobAddress: string
}

export type CreateJobFromEstimateSubmitResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string }

/**
 * Persisted customer link for the estimate (`row.customer_id`), or detail-only `customerId` state while editing.
 */
export async function submitCreateJobFromEstimate(
  supabase: SupabaseClient<Database>,
  userId: string,
  estimate: EstimateForCreateJob,
  customerIdForPayload: string | null,
  customers: JobPayloadCustomerRow[],
  form: CreateJobFromEstimateFormValues,
): Promise<CreateJobFromEstimateSubmitResult> {
  if (estimate.status !== 'customer_accepted') {
    return { ok: false, error: 'Only accepted estimates can create a job.' }
  }
  if (estimate.job_ledger_id) {
    return { ok: false, error: 'This estimate is already linked to a job.' }
  }

  const hcp = form.hcp.trim()
  if (!hcp) {
    return { ok: false, error: 'HCP # is required.' }
  }

  try {
    const effectiveMaster = await resolveEffectiveJobMasterUserId(supabase, userId, estimate.project_id)
    const cust = customerIdForPayload ? customers.find((c) => c.id === customerIdForPayload) : null
    const nameForResolve = (cust?.name ?? '').trim()
    const resolvedCustomerId = resolveCustomerIdForJobPayload(
      customerIdForPayload,
      effectiveMaster,
      nameForResolve,
      customers,
    )

    // CO credit lines are negative-price by design (v2.1829) — don't clamp them.
    const normalized = normalizeEstimateLineItemsFromJson(estimate.line_items_snapshot, {
      allowNegative: isChangeOrderDocKind(estimate.doc_kind),
    })
    const fixtures = fixturesPayloadForCreateJobFromEstimate(normalized)

    const rpcArgs = {
      p_estimate_id: estimate.id,
      p_hcp_number: hcp,
      p_job_name: form.jobName.trim() || undefined,
      p_job_address: form.jobAddress.trim() || undefined,
      p_fixtures: fixtures as unknown as Json,
      ...(resolvedCustomerId ? { p_customer_id: resolvedCustomerId } : {}),
    }

    const jobId = await withSupabaseRetry(
      async () => await supabase.rpc('create_job_from_estimate', rpcArgs),
      'create job from estimate',
    )

    if (!jobId) {
      return { ok: false, error: 'Job was not created.' }
    }
    return { ok: true, jobId }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Could not create job') }
  }
}
