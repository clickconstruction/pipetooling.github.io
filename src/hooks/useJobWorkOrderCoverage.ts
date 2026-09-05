/**
 * Single-job work-order coverage (Work Orders tab, PR 1 — v2.2814): the job
 * window's fact row and the View bill strip read one job through the same
 * kernel the board batches. A job's orders are the rows anchored to it
 * directly (job_id) plus the rows on its Sub Labor sheets (matched by job
 * number). Fail-soft; refreshes on the `work-order-changed` event.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { buildJobWorkOrderCoverage, type JobWorkOrderCoverage, type WorkOrderRowLike } from '../lib/subWorkOrders/workOrderCoverage'

export const WORK_ORDER_CHANGED_EVENT = 'work-order-changed'

const SELECT = 'id, status, amount, display_name, job_id, labor_job_id, step_id, record_id, offered_at, offer_expires_at, signed_at, accepted_at, declined_at, decline_reason, created_at'

export function useJobWorkOrderCoverage(job: { id: string; hcp_number: string } | null): {
  coverage: JobWorkOrderCoverage | null
  rows: WorkOrderRowLike[]
  reload: () => Promise<void>
} {
  const [coverage, setCoverage] = useState<JobWorkOrderCoverage | null>(null)
  const [rows, setRows] = useState<WorkOrderRowLike[]>([])
  const jobId = job?.id ?? null
  const jobNumber = (job?.hcp_number ?? '').trim()

  const reload = useCallback(async () => {
    if (!jobId) {
      setCoverage(null)
      setRows([])
      return
    }
    try {
      const { data: sheets } = jobNumber
        ? await supabase.from('people_labor_jobs').select('id').ilike('job_number', jobNumber)
        : { data: [] as Array<{ id: string }> }
      const sheetIds = ((sheets ?? []) as Array<{ id: string }>).map((s) => s.id)
      const filter = sheetIds.length > 0 ? `job_id.eq.${jobId},labor_job_id.in.(${sheetIds.join(',')})` : `job_id.eq.${jobId}`
      const { data, error } = await supabase.from('step_commitments').select(SELECT).or(filter).neq('status', 'cancelled')
      if (error) throw error
      const list = (data ?? []) as WorkOrderRowLike[]
      setRows(list)
      setCoverage(buildJobWorkOrderCoverage(list, todayYmdInAppTz()))
    } catch {
      setCoverage({ kind: 'none' })
      setRows([])
    }
  }, [jobId, jobNumber])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onChanged = () => void reload()
    window.addEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
  }, [reload])

  return { coverage, rows, reload }
}

/** Tell every mounted coverage reader that a work order changed. */
export function emitWorkOrderChanged(): void {
  window.dispatchEvent(new Event(WORK_ORDER_CHANGED_EVENT))
}
