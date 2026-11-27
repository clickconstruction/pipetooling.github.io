/**
 * Who is drawn the Reports and Billing chips over a job's activity (2026-11-20, the owner's phone walk: a field
 * hand was shown two chips that could never hold a line for them).
 *
 * No role list of its own. Each answer is the database's, read one of three ways:
 *   - *yes*: the office (`isOfficeRole`, the mirror of `is_office_staff()`). The office passes the money half of
 *     `can_read_job_activity(job, true)` and the first leg of `list_reports_for_job_ledger` on every job.
 *   - *ask*: the two roles whose answer turns on the job. A primary reads a job's money when they are one of its
 *     people, and its reports when they are its account manager or its listed superintendent. A superintendent
 *     reads the reports of a job on their project or their crew. Each is asked of the gate itself, by name.
 *   - *no*: everyone else. A helper or a subcontractor reads their own reports only, an estimator none, and none of
 *     them the money half. A line the database does hand them still draws its chip, by the count
 *     (`visibleActivityFilters`).
 *
 * The server stays the authority: these decide which chips are drawn, never which lines are read.
 * Pure: no React, no supabase. The read is `hooks/useJobActivityFilterAccess.ts`.
 */
import type { UserRole } from '../../types/userRole'
import { isOfficeRole } from '../doorRoles'
import type { ActivityFilterAccess } from '../jobActivityFilter'

type Role = UserRole | string | null | undefined

/** One question for the database: a gate that already decides the read, called with the job. */
export type ActivityChipQuestion = {
  chip: 'billing' | 'reports'
  rpc: 'can_read_job_activity' | 'primary_can_read_job_reports' | 'superintendent_report_job_anchor_allowed'
  args: Record<string, unknown>
}

/** What the role alone settles: both chips for the office, neither for anyone else until the job is asked. */
export function activityFilterAccessForRole(role: Role): ActivityFilterAccess {
  const office = isOfficeRole(role)
  return { canSeeBilling: office, canSeeReports: office }
}

/** The questions this role's chips wait on for this job. None for the office or for the field roles. */
export function activityChipQuestions(role: Role, jobId: string): ActivityChipQuestion[] {
  if (role === 'primary') {
    return [
      { chip: 'billing', rpc: 'can_read_job_activity', args: { p_job_id: jobId, p_financial: true } },
      { chip: 'reports', rpc: 'primary_can_read_job_reports', args: { p_job_id: jobId } },
    ]
  }
  if (role === 'superintendent') {
    return [{ chip: 'reports', rpc: 'superintendent_report_job_anchor_allowed', args: { p_job_ledger_id: jobId } }]
  }
  return []
}

/**
 * The role's answer with the database's laid over it. Only a plain `true` opens a chip: a question that failed or
 * is still out leaves the chip to the count.
 */
export function settleActivityFilterAccess(
  role: Role,
  answers: Partial<Record<ActivityChipQuestion['chip'], boolean | null | undefined>>,
): ActivityFilterAccess {
  const base = activityFilterAccessForRole(role)
  return {
    canSeeBilling: base.canSeeBilling || answers.billing === true,
    canSeeReports: base.canSeeReports || answers.reports === true,
  }
}
