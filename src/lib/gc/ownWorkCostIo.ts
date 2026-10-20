/**
 * GC mode, Owner Billing's O11: our own work's Pipeline jobs, read the Costs tab's own way. Whether the reader sees pay
 * (`has_payroll_access()`: dev, the controller and a pay-approved leader), then each linked job's charge events through
 * `loadJobChargesTimelineInputs`, a few at a time as Bid vs actual reads them, turned into its spend
 * (`ownWorkJobCost`). Without pay access the jobs are not read: their labor would come back as $0 with no error.
 */
import { supabase } from '../supabase'
import { loadJobChargesTimelineInputs, type JobChargesTimelineJob } from '../../hooks/useJobChargesTimelineInputs'
import { BID_VS_ACTUAL_BURN_CONCURRENCY } from '../../hooks/useBidVsActualBurnInputs'
import { jobNumberLabel } from '../jobs/jobSummaryCycle'
import { ownWorkJobCost, type OwnWorkCosts } from './ownWorkCost'

type JobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  status: string | null
  revenue: number | null
  pct_complete: number | null
  invoices: Array<{ status: string | null; amount: number | null }> | null
  materials: Array<{ amount: number | null; created_at: string | null; description: string | null }> | null
}

/** Our own work's costs on these Pipeline jobs. A job whose read fails is 'error'; the others stand. */
export async function loadOwnWorkCosts(jobIds: ReadonlyArray<string>): Promise<OwnWorkCosts> {
  const { data: access } = await supabase.rpc('has_payroll_access')
  const payAccess = access === true
  const ids = [...new Set(jobIds)]
  if (!payAccess || ids.length === 0) return { payAccess, byJob: {} }
  const { data, error } = await supabase
    .from('jobs_ledger')
    .select('id, hcp_number, click_number, job_name, status, revenue, pct_complete, invoices:jobs_ledger_invoices(status, amount), materials:jobs_ledger_materials(amount, created_at, description)')
    .in('id', ids)
  const rows = (error ? [] : (data ?? [])) as JobRow[]
  const byJob: OwnWorkCosts['byJob'] = {}
  for (const id of ids) if (!rows.some((r) => r.id === id)) byJob[id] = 'error'
  let next = 0
  const worker = async () => {
    while (next < rows.length) {
      const r = rows[next++]!
      const job: JobChargesTimelineJob = { id: r.id, revenue: r.revenue, pct_complete: r.pct_complete, invoices: r.invoices ?? [], materials: r.materials ?? [], payments: [] }
      try {
        const inputs = await loadJobChargesTimelineInputs(job, true)
        byJob[r.id] = ownWorkJobCost({ id: r.id, label: jobNumberLabel(r), name: r.job_name ?? '', status: r.status }, inputs.chargeEvents)
      } catch {
        byJob[r.id] = 'error'
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(BID_VS_ACTUAL_BURN_CONCURRENCY, rows.length) }, worker))
  return { payAccess, byJob }
}
