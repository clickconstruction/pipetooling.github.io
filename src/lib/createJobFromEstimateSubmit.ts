import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { resolveCustomerIdForJobPayload, type JobPayloadCustomerRow } from './jobLedgerCustomer'
import { resolveEffectiveJobMasterUserId } from './resolveEffectiveJobMasterUserId'

/** Fields required to call `create_job_from_estimate` with the same rules as Estimate detail. */
export type EstimateForCreateJob = Pick<
  Tables<'estimates'>,
  'id' | 'status' | 'project_id' | 'customer_id' | 'job_ledger_id' | 'title' | 'for_address' | 'total_cents'
>

export type CreateJobFromEstimateFormValues = {
  hcp: string
  jobName: string
  jobAddress: string
  revenue: string
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

  let revenueOverride: number | undefined
  const rtrim = form.revenue.trim()
  if (rtrim !== '') {
    const n = Number(rtrim)
    if (Number.isNaN(n)) {
      return { ok: false, error: 'Revenue must be a number.' }
    }
    revenueOverride = n
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

    const rpcArgs = {
      p_estimate_id: estimate.id,
      p_hcp_number: hcp,
      p_job_name: form.jobName.trim() || undefined,
      p_job_address: form.jobAddress.trim() || undefined,
      ...(revenueOverride !== undefined ? { p_revenue: revenueOverride } : {}),
      ...(resolvedCustomerId ? { p_customer_id: resolvedCustomerId } : {}),
    }

    const jobId = await withSupabaseRetry(
      async () => {
        // #region agent log
        fetch('http://127.0.0.1:7692/ingest/99b8dd03-6772-47ea-b15c-a5ccda00f274', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fae955' },
          body: JSON.stringify({
            sessionId: 'fae955',
            hypothesisId: 'H4',
            location: 'createJobFromEstimateSubmit.ts:preRpc',
            message: 'create_job_from_estimate context',
            data: {
              estimateIdSuffix: estimate.id.slice(-8),
              estimateStatus: estimate.status,
              hasProjectId: estimate.project_id != null,
              hasEstimateCustomerId: estimate.customer_id != null,
              customerIdForPayloadSet: customerIdForPayload != null,
              customersArrayLen: customers.length,
              resolvedCustomerIdSet: resolvedCustomerId != null,
              effectiveMasterSuffix: effectiveMaster.slice(-8),
              hcpLen: hcp.length,
              rpcKeys: Object.keys(rpcArgs),
            },
            timestamp: Date.now(),
            runId: 'post-migration-verify',
          }),
        }).catch(() => {})
        // #endregion
        const result = await supabase.rpc('create_job_from_estimate', rpcArgs)
        const err = result.error as { message?: string; code?: string; details?: string; hint?: string } | null
        // #region agent log
        fetch('http://127.0.0.1:7692/ingest/99b8dd03-6772-47ea-b15c-a5ccda00f274', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fae955' },
          body: JSON.stringify({
            sessionId: 'fae955',
            hypothesisId: 'H1-H3',
            location: 'createJobFromEstimateSubmit.ts:postRpc',
            message: 'create_job_from_estimate raw',
            data: {
              hasData: result.data != null,
              errMessage: err?.message ?? null,
              errCode: err?.code ?? null,
              errDetails: err?.details ?? null,
              errHint: err?.hint ?? null,
            },
            timestamp: Date.now(),
            runId: 'post-migration-verify',
          }),
        }).catch(() => {})
        // #endregion
        return result
      },
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
