import type { JobWithDetails } from '../../types/jobWithDetails'
import type { ScheduleDispatchHubJobRow } from '../scheduleDispatchHub'

/**
 * Maps a Pipeline board row to the job shape QuickAssignSheet expects
 * (`ScheduleDispatchHubJobRow`), so the Pipeline's schedule quick action can
 * open the dispatch "Assign work" sheet with the job pre-picked — skipping the
 * job-picker stage. Every field is already on the loaded `JobWithDetails`;
 * `service_type.name` may be null on rows loaded without the service-type
 * embed, which just hides the sheet header's trade pill.
 */
export function jobWithDetailsToQuickAssignHubRow(job: JobWithDetails): ScheduleDispatchHubJobRow {
  const serviceTypeName = job.serviceType?.name?.trim() || null
  return {
    id: job.id,
    hcp_number: job.hcp_number ?? null,
    click_number: job.click_number ?? null,
    job_name: job.job_name ?? null,
    project_id: job.project_id ?? null,
    created_at: job.created_at ?? null,
    job_address: job.job_address ?? null,
    customer_name: job.customer_name ?? null,
    status: job.status ?? null,
    service_type: serviceTypeName != null ? { name: serviceTypeName } : null,
  }
}
