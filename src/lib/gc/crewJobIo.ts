/**
 * GC mode, the real build, the Building lane's U8: our own crew's Pipeline job, read and linked
 * (to-dos/gc-mode/mockups/building-u8.md on branch spike/gc-mode). The reads are the Pipeline's own: the job's
 * row, its crew report (`list_latest_report_completion_pct`) and its stages (`list_job_stage_progress`), which
 * the money team reads as a dev does. The link is `gc_link_crew_job` (migration 20261010063000), a dev's while
 * Building is built, and the column's guard refuses any other write.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { currentReportDateByJobId, currentReportPctByJobId } from '../jobSummaryPercentComplete'
import { jobNumberLabel } from '../jobs/jobSummaryCycle'
import { isoToPlainDateInAppTz } from '../personContractAppliedDate'
import type { CrewJobRead, CrewStageRow } from './crewJobRows'

/** The rows of a read, or the read's problem thrown in plain words. */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

/** A trade our own crew does and the Pipeline job it names. */
export interface CrewJobLink {
  packageId: string
  jobId: string
}

/** A Pipeline job the picker offers. */
export interface CrewJobHit {
  id: string
  /** Its number as the Pipeline shows it. */
  label: string
  name: string
  address: string
}

/** What each linked trade's Pipeline job says: its number, its stages, its crew report and its own percent. */
export async function loadCrewJobs(links: readonly CrewJobLink[]): Promise<CrewJobRead[]> {
  if (links.length === 0) return []
  const ids = [...new Set(links.map((l) => l.jobId))]
  const [jobs, reports, ...stages] = await Promise.all([
    supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, pct_complete').in('id', ids),
    supabase.rpc('list_latest_report_completion_pct', { p_job_ids: ids }),
    ...ids.map((id) => supabase.rpc('list_job_stage_progress', { p_job_id: id })),
  ])
  const jobRows = taken(jobs, 'read our crew’s Pipeline jobs')
  const reportRows = taken(reports, 'read our crew’s reports')
  const pctByJob = currentReportPctByJobId(reportRows)
  const dayByJob = currentReportDateByJobId(reportRows)
  const stagesByJob = new Map(ids.map((id, i) => [id, taken(stages[i]!, 'read our crew’s stages') as CrewStageRow[]]))
  return links.flatMap((link) => {
    const job = jobRows.find((j) => j.id === link.jobId)
    if (!job) return []
    return [
      {
        packageId: link.packageId,
        jobId: job.id,
        label: jobNumberLabel(job),
        name: job.job_name,
        stages: stagesByJob.get(job.id) ?? [],
        reportPct: pctByJob.get(job.id) ?? null,
        reportedOn: isoToPlainDateInAppTz(dayByJob.get(job.id)),
        pctComplete: job.pct_complete,
      },
    ]
  })
}

/** Our crew's trade names its Pipeline job, or lets go of it (null). */
export async function linkCrewJob(packageId: string, jobId: string | null): Promise<void> {
  // Null lets go; the generated type cannot say an argument may be null.
  taken(await supabase.rpc('gc_link_crew_job', { p_package_id: packageId, p_job_ledger_id: jobId as unknown as string }), 'link our crew’s Pipeline job')
}

const hitOf = (j: { id: string; hcp_number: string; click_number: string; job_name: string; job_address: string }): CrewJobHit => ({
  id: j.id,
  label: jobNumberLabel(j),
  name: j.job_name,
  address: j.job_address,
})

/** The Pipeline jobs a search finds, billing-only jobs left out (`search_jobs_ledger`'s default). */
export async function searchCrewJobs(text: string): Promise<CrewJobHit[]> {
  const q = text.trim()
  if (!q) return []
  return taken(await supabase.rpc('search_jobs_ledger', { search_text: q }), 'search the Pipeline jobs').map(hitOf)
}

/** The Pipeline jobs on this GC job, or from our own bid for the trade: the picker offers them first. */
export async function suggestCrewJobs(projectId: string, ownBidId: string | null): Promise<CrewJobHit[]> {
  const on = ownBidId ? `project_id.eq.${projectId},bid_id.eq.${ownBidId}` : `project_id.eq.${projectId}`
  return taken(
    await supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address').or(on).eq('billing_only', false).limit(8),
    'read the Pipeline jobs on this job',
  ).map(hitOf)
}
