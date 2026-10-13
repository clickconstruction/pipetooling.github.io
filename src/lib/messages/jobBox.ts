/**
 * Messages, residential R2 PR 2: the box in a job's window, **Note · Text · Email** (`RESIDENTIAL_BUILD_PLAN.md` → R2
 * on branch spike/gc-mode). Pure. A note stays the crew's note on the job, the panel's own composer. A text or an
 * email goes to the job's customer through cut 3's reply box (`ReplyBox`), tied to the job, in the customer's orange.
 * The office team writes to a customer, as everywhere in Messages; a tech's door is R5's.
 */
import type { UserRole } from '../../hooks/useAuth'
import { GC_OFFICE_TEAM } from '../gc/access'
import { jobKey } from './load'

export type JobBoxKind = 'note' | 'text' | 'email'

/** The job window's kinds row, in its order, each with its hover's words. */
export const JOB_BOX_KINDS: ReadonlyArray<{ kind: JobBoxKind; label: string; tip: string }> = [
  { kind: 'note', label: 'Note', tip: 'A note on the job for the crew and the office. The customer never sees it.' },
  { kind: 'text', label: 'Text', tip: 'A text to the job’s customer from the company number. It shows in their thread.' },
  { kind: 'email', label: 'Email', tip: 'An email to the job’s customer from the company. It shows in their thread.' },
]

/** Who sees Text and Email in a job's window: the office team, who read and write Messages. */
export function jobBoxOffered(role: UserRole | null | undefined): boolean {
  return role != null && GC_OFFICE_TEAM.includes(role)
}

/** What Text and Email say on a job with no customer on it. */
export const NO_CUSTOMER_WORDS = 'This job has no customer yet. Add one in Edit Job to text or email them.'

/** The job a reply from its window is tied to, as the thread keys it. */
export function jobBoxJobKey(jobId: string): string {
  return jobKey({ kind: 'pipeline', id: jobId })
}

/** The name *Tie to* shows for the job: its name, else its number, else *this job*. */
export function jobBoxJobName(job: { job_name?: string | null; hcp_number?: string | null }): string {
  return job.job_name?.trim() || (job.hcp_number?.trim() ? `Job ${job.hcp_number.trim()}` : 'this job')
}
