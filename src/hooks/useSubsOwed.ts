/**
 * The sheets a page holds, read as what we owe (punch list #346): each sheet with whose it is, the Pipeline job it
 * is on and the Pay view's words for when it pays. People → Subs and the job's window both hand their sheets in and
 * get `OwedSheetInput[]` back for `subOwedBreakdown`.
 *
 * It reads three small things the Pay view also reads: the roster with each login's role, the live work orders, and
 * the sheets' jobs with the status of their bills. Read only.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { subLaborJobBalance, type SubLaborSheetAssignee } from '../lib/subLaborOutstanding'
import type { OwedSheetInput } from '../lib/people/subOwedBreakdown'
import { buildSheetStandingContext, sheetStanding, type StandingJob } from '../lib/subWorkOrders/sheetStanding'
import type { TeamSheetRule } from '../lib/subWorkOrders/teamSheetRule'
import type { WorkOrderRowLike } from '../lib/subWorkOrders/workOrderCoverage'
import type { NeedsWorkOrderRosterPerson } from '../lib/subWorkOrders/rosterSub'
import type { LaborJob } from '../types/laborJob'
import { useRosterSubKinds } from './useRosterSubKinds'
import { WORK_ORDER_CHANGED_EVENT } from './useJobWorkOrderCoverage'

export type SubsOwed = { inputs: OwedSheetInput[]; roster: NeedsWorkOrderRosterPerson[]; ready: boolean }

export function useSubsOwed(laborJobs: readonly LaborJob[], assigneesByJobId: ReadonlyMap<string, readonly SubLaborSheetAssignee[]>, rule: TeamSheetRule, enabled = true): SubsOwed {
  const { roster, loaded: rosterLoaded } = useRosterSubKinds(enabled)
  const [orders, setOrders] = useState<WorkOrderRowLike[]>([])
  const [jobs, setJobs] = useState<StandingJob[]>([])
  const [jobsFor, setJobsFor] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const load = async () => {
      // A read that fails leaves the work orders as they were: a sheet then reads by its stage alone.
      try {
        const { data, error } = await supabase
          .from('step_commitments')
          .select('id, status, amount, display_name, job_id, labor_job_id, step_id, record_id, offered_at, offer_expires_at, signed_at, accepted_at, declined_at, decline_reason, created_at, person_id, picked_end, proposed_end')
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1000)
        if (!cancelled && !error) setOrders((data ?? []) as WorkOrderRowLike[])
      } catch {
        // Nothing to draw differently.
      }
    }
    void load()
    const onChanged = () => void load()
    window.addEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
    return () => {
      cancelled = true
      window.removeEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
    }
  }, [enabled])

  // The sheets' jobs: by the sheet's link, and by number only for a sheet that never got a link (the Pay view's order).
  const linkedIds = useMemo(() => [...new Set(laborJobs.map((j) => j.job_ledger_id ?? '').filter(Boolean))].sort(), [laborJobs])
  const looseNumbers = useMemo(() => [...new Set(laborJobs.filter((j) => !j.job_ledger_id).map((j) => (j.job_number ?? '').trim()).filter(Boolean))].sort(), [laborJobs])
  const jobsKey = `${linkedIds.join(',')}|${looseNumbers.join(',')}`
  useEffect(() => {
    if (!enabled) return
    if (linkedIds.length === 0 && looseNumbers.length === 0) {
      setJobs([])
      setJobsFor(jobsKey)
      return
    }
    let cancelled = false
    void (async () => {
      const cols = 'id, hcp_number, job_name, job_address'
      const [byId, byNumber] = await Promise.all([
        linkedIds.length > 0 ? supabase.from('jobs_ledger').select(cols).in('id', linkedIds) : Promise.resolve({ data: [] as unknown[] }),
        looseNumbers.length > 0 ? supabase.from('jobs_ledger').select(cols).in('hcp_number', looseNumbers) : Promise.resolve({ data: [] as unknown[] }),
      ])
      const rows = new Map<string, { id: string; hcp_number: string | null; job_name: string | null; job_address: string | null }>()
      for (const r of [...((byId.data ?? []) as never[]), ...((byNumber.data ?? []) as never[])] as Array<{ id: string; hcp_number: string | null; job_name: string | null; job_address: string | null }>) rows.set(r.id, r)
      const ids = [...rows.keys()]
      const inv = ids.length > 0 ? await supabase.from('jobs_ledger_invoices').select('job_id, status').in('job_id', ids) : { data: [] as unknown[] }
      const invByJob = new Map<string, Array<{ status: string | null }>>()
      for (const r of (inv.data ?? []) as Array<{ job_id: string; status: string | null }>) invByJob.set(r.job_id, [...(invByJob.get(r.job_id) ?? []), { status: r.status }])
      if (cancelled) return
      setJobs([...rows.values()].map((r) => ({ id: r.id, hcp_number: r.hcp_number ?? '', job_name: r.job_name ?? '', job_address: r.job_address ?? '', invoices: invByJob.get(r.id) ?? [] })))
      setJobsFor(jobsKey)
    })()
    return () => {
      cancelled = true
    }
    // `jobsKey` is the two id lists as text: the lists themselves are new arrays on every load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, jobsKey])

  const today = todayYmdInAppTz()
  const inputs = useMemo<OwedSheetInput[]>(() => {
    const ctx = buildSheetStandingContext({ roster, jobs, orders, assigneesByJobId, todayYmd: today, rule })
    return laborJobs.map((sheet) => {
      const st = sheetStanding(sheet, subLaborJobBalance(sheet), ctx)
      return { sheet, parties: st.parties, payWhen: st.payWhen, jobId: st.job?.id ?? null, jobName: st.job?.job_name ?? '' }
    })
  }, [laborJobs, roster, jobs, orders, assigneesByJobId, today, rule])

  return { inputs, roster, ready: rosterLoaded && jobsFor === jobsKey }
}
