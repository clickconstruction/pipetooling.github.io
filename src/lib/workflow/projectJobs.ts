/**
 * The Workflow page's Jobs strip: what a job's chip is called, and where
 * "+ Create Job" goes.
 */

export type ProjectJobChip = { id: string; hcp_number: string; job_name: string; status: string }

/** The job number, else the job's name, else "Job". */
export function projectJobChipLabel(job: Pick<ProjectJobChip, 'hcp_number' | 'job_name'>): string {
  return job.hcp_number || job.job_name || 'Job'
}

/** The Jobs page's new-job form, opened on the Stages tab with this project filled in. */
export function createJobForProjectHref(projectId: string | undefined): string {
  return `/jobs?newJob=true&project=${projectId}&tab=stages`
}
