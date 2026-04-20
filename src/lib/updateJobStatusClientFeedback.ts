/**
 * User-facing copy and resync hints for `update_job_status` failures.
 * Strings should stay aligned with RPC `RETURN jsonb_build_object('error', ...)` in migrations.
 */

export type UpdateJobStatusToastVariant = 'error' | 'warning'

export function toastForUpdateJobStatusFailure(message: string): {
  text: string
  variant: UpdateJobStatusToastVariant
} {
  const m = message.trim()
  if (!m) {
    return { text: 'Could not update job status.', variant: 'error' }
  }
  if (m.includes('Job must be in') || m.includes('Invalid status')) {
    return {
      text: "Couldn’t update job status—the list was refreshed.",
      variant: 'warning',
    }
  }
  if (m.includes('Job not found')) {
    return {
      text: "That job isn’t available—the list was refreshed.",
      variant: 'warning',
    }
  }
  if (m.includes('Not authorized to update job status') || m.includes('Not authorized')) {
    return { text: 'You’re not allowed to change this job’s status.', variant: 'error' }
  }
  if (m.includes('Not authenticated')) {
    return { text: 'Sign in to update job status.', variant: 'error' }
  }
  const truncated = m.length > 220 ? `${m.slice(0, 217)}…` : m
  return { text: truncated, variant: 'error' }
}

/** Whether to run a full jobs list resync after a failed `update_job_status` call. */
export function shouldResyncJobsAfterUpdateJobStatusFailure(message: string): boolean {
  return message.trim().length > 0
}
