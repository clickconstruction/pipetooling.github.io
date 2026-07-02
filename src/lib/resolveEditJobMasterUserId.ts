/**
 * Master owner for an EDITED job. Project-linked jobs follow the project owner
 * (enforced by jobs_ledger_project_master_match); otherwise the job keeps its
 * existing owner. Never consults job_owner_override — that is for NEW jobs only;
 * re-deriving it on edit silently re-owns the job and breaks the
 * customer↔master invariant (jobs_ledger_customer_master_match).
 */
export function resolveEditJobMasterUserId(params: {
  projectId: string | null
  projectMasterUserId: string | null // proj?.master_user_id when the project is in the loaded list
  existingJobMasterUserId: string
}): string {
  const { projectId, projectMasterUserId, existingJobMasterUserId } = params
  if (projectId && projectMasterUserId) return projectMasterUserId
  return existingJobMasterUserId
}
