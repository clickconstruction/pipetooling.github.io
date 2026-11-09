import { useMemo } from 'react'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { LienCalendarJob } from '../lib/jobs/lienCalendar'
import { useBilledLienClocks } from './useBilledLienClocks'
import { useBilledMoneyData } from './useBilledMoneyData'
import { buildJobsStagesBoardLists } from '../lib/jobsStagesBoard'
import { paceContextFor } from '../lib/jobs/payPace'
import { canSeeBilledExpectedPay, isStagesOfficeRole } from '../lib/jobs/stagesRoleGates'
import { billedLienClockJobsOf, buildLienCalendarRows, lienRunwayForJob, paceContextPayerIds } from '../lib/jobs/lienCalendarRows'

/**
 * The Lien desk's Deadlines rows for a host that is not the Pipeline (punch list #182: the desk's own page).
 * The Pipeline builds the same rows from the reads it already holds for its Billed rows; this hook makes those
 * reads for the page alone — the lien clocks of the billed jobs, the payer paces and promised dates behind each
 * bill's expected-pay date, the pace rule's facts — and shapes the rows through `lienCalendarRows.ts`. Null until
 * the billed jobs are in and their clocks are read: an unread board is not an empty one.
 */
export function useLienCalendarRows(
  jobs: ReadonlyArray<JobWithDetails>,
  opts: { role: string | null; billedLoaded: boolean; todayYmd: string; refreshKey?: number },
): { rows: LienCalendarJob[] | null; reloadPromises: () => void } {
  const clockJobs = useMemo(() => billedLienClockJobsOf(jobs), [jobs])
  const clocks = useBilledLienClocks(clockJobs, opts.refreshKey ?? 0)
  const { billedPaySpeeds, promisedPayDates, loadPromisedPayDates, loadPromiseRecords, paceFacts } = useBilledMoneyData({
    canSeeBilledExpectedPay: canSeeBilledExpectedPay(opts.role),
    canMarkPromisedPay: isStagesOfficeRole(opts.role),
  })
  const lists = useMemo(() => buildJobsStagesBoardLists([...jobs], ''), [jobs])
  const paceContext = useMemo(
    () => paceContextFor({ facts: paceFacts, paySpeeds: billedPaySpeeds, payerIds: paceContextPayerIds([...lists.billedActiveRows, ...lists.collectionsRows]) }),
    [paceFacts, billedPaySpeeds, lists],
  )
  const rows = useMemo(() => {
    if (!opts.billedLoaded || !clocks) return null
    return buildLienCalendarRows(jobs, (job, inv) => lienRunwayForJob(job, inv, { clocks, paySpeeds: billedPaySpeeds, promisedPayDates, paceContext, todayYmd: opts.todayYmd }))
  }, [opts.billedLoaded, opts.todayYmd, clocks, jobs, billedPaySpeeds, promisedPayDates, paceContext])
  const reloadPromises = () => {
    void loadPromisedPayDates()
    void loadPromiseRecords()
  }
  return { rows, reloadPromises }
}
