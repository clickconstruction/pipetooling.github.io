import type {
  CrewBidAssignment,
  CrewBidRow,
  CrewJobAssignment,
  CrewJobRow,
} from '../utils/teamLabor'

export type PayReportAssignmentDayBreakdown = { date: string; hours: number; jobsText: string }

/**
 * Per-day crew job/bid allocation lines for pay reports (same math as pay stub HTML).
 */
export function computePayReportAssignmentsBreakdown(
  personName: string,
  dayRows: Array<{ work_date: string; hours: number }>,
  crewByDatePerson: Record<string, CrewJobRow>,
  crewBidsByDatePerson: Record<string, CrewBidRow>,
  jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }>,
  bidsMap: Record<string, { bid_number: string; project_name: string; address: string }>,
): PayReportAssignmentDayBreakdown[] {
  function getEffectiveJobAssignments(pn: string, workDate: string): CrewJobAssignment[] {
    const key = `${workDate}:${pn}`
    const row = crewByDatePerson[key]
    if (!row) return []
    if (row.crew_lead_person_name) {
      const leadKey = `${workDate}:${row.crew_lead_person_name}`
      const leadRow = crewByDatePerson[leadKey]
      return leadRow?.job_assignments ?? []
    }
    return row.job_assignments
  }
  function getEffectiveBidAssignments(pn: string, workDate: string): CrewBidAssignment[] {
    const key = `${workDate}:${pn}`
    const row = crewBidsByDatePerson[key]
    if (!row) return []
    if (row.crew_lead_person_name) {
      const leadKey = `${workDate}:${row.crew_lead_person_name}`
      const leadRow = crewBidsByDatePerson[leadKey]
      return leadRow?.bid_assignments ?? []
    }
    return row.bid_assignments
  }
  function jobLabel(jobId: string): string {
    const d = jobsMap[jobId]
    if (!d) return jobId.slice(0, 8)
    const jobNum = (d.hcp_number ?? '').trim()
    const jobName = (d.job_name ?? '').trim()
    if (jobNum && jobName) return `Job ${jobNum} (${jobName})`
    return jobNum || jobName || (d.job_address ?? '').trim() || jobId.slice(0, 8)
  }
  function bidLabel(bidId: string): string {
    const d = bidsMap[bidId]
    if (!d) return bidId.slice(0, 8)
    const bidNum = (d.bid_number ?? '').trim()
    const projectName = (d.project_name ?? '').trim()
    if (bidNum && projectName) return `Bid ${bidNum} (${projectName})`
    return bidNum || projectName || (d.address ?? '').trim() || bidId.slice(0, 8)
  }
  return dayRows.map((r) => {
    const jobAssignments = getEffectiveJobAssignments(personName, r.work_date)
    const bidAssignments = getEffectiveBidAssignments(personName, r.work_date)
    const jobParts = jobAssignments.map((a) => {
      const hrs = r.hours * (a.pct / 100)
      return `${jobLabel(a.job_id)} ${hrs.toFixed(2)} hrs`
    })
    const bidParts = bidAssignments.map((a) => {
      const hrs = r.hours * (a.pct / 100)
      return `${bidLabel(a.bid_id)} ${hrs.toFixed(2)} hrs`
    })
    const parts = [...jobParts, ...bidParts]
    if (parts.length === 0) return { date: r.work_date, hours: r.hours, jobsText: '—' }
    return { date: r.work_date, hours: r.hours, jobsText: parts.join(', ') }
  })
}
