/**
 * GC mode, the real build, the Building lane's U7c: where the weekly report window talks to the database and the email.
 * A report is kept as a `gc_weekly_reports` row first (a plain insert under RLS, append only); one from the company then
 * goes through Owner Billing's `gc-customer-email`, kind `weekly` (U7b), which sends the row's own words, copies the
 * architect when the row says so, and writes the row's `email_send_log_id`. A test copy goes the same way with `test`.
 * The plan: to-dos/gc-mode/mockups/building-u7.md on branch spike/gc-mode.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { gcWeeklyReportLines } from '../../../supabase/functions/_shared/gcCustomerEmails'
import type { CustomerEmailAnswer } from './customerEmail'
import { sendGcCustomerEmail } from './customerEmailIo'
import { WEEKLY_REPORT_COLUMNS, weeklyReportInsert, type WeeklyReportRow, type WeeklyReportSend } from './weeklyReportRows'

/** The weekly reports kept on these jobs, every send. */
export async function loadGcWeeklyReports(projectIds: string[]): Promise<WeeklyReportRow[]> {
  if (projectIds.length === 0) return []
  const result = await supabase.from('gc_weekly_reports').select(WEEKLY_REPORT_COLUMNS).in('project_id', projectIds)
  checkSupabaseError(result, 'load the weekly reports')
  return result.data ?? []
}

/** Keep a report as sent, from me, or ready to go from the company. Returns its row's id. */
export async function recordWeeklyReport(s: WeeklyReportSend, today: string): Promise<string> {
  const result = await supabase.from('gc_weekly_reports').insert(weeklyReportInsert(s, today)).select('id').single()
  checkSupabaseError(result, 'keep the weekly report')
  return result.data!.id
}

/** Email a kept report from the company, or a test copy of it to the sender only. A refusal comes back in the answer. */
export async function sendWeeklyReport(s: Pick<WeeklyReportSend, 'projectId' | 'subject' | 'body'>, rowId: string, test = false): Promise<CustomerEmailAnswer> {
  return sendGcCustomerEmail({
    projectId: s.projectId,
    kind: 'weekly',
    sourceId: rowId,
    subject: s.subject.trim(),
    lines: gcWeeklyReportLines(s.body),
    pdf: null,
    ...(test ? { test: true } : {}),
  })
}
