/**
 * Filing a field report (punch list #410): the one call both presses make, the queue's **File to the record** on
 * People, HR and the same press on a person's Timeline line. A write-up sent from the Dashboard's sheet is filed with
 * its facts ahead of the writer's words (`reportEntryBody`), so the entry reads the same whichever press filed it. A
 * report from before the sheet has no facts, and `file_person_report` writes its own preamble as it always did.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { reportEntryBody, type PendingReportFacts } from './hrPendingReports'

const db = supabase as unknown as SupabaseClient

/** The columns a pending report's card and its filing words read. */
export const PENDING_REPORT_COLUMNS =
  'id, subject_person_id, author_user_id, author_name, occurred_date, content, created_at, kind, job_label, occurred_time, author_role, author_saw_it, author_on_job, seen_by, talked_to_person, adds_to, pressed_at'

/**
 * Files one waiting report. `known` is the row when the caller already holds its facts; without it the row is read
 * first. A read that fails files the report anyway, with the function's own preamble: the words are never lost.
 */
export async function filePersonReport(reportId: string, subjectName: string, known?: PendingReportFacts): Promise<{ error: unknown | null }> {
  let facts: PendingReportFacts | null = known ?? null
  if (!facts) {
    const { data } = await db.from('person_reports').select(PENDING_REPORT_COLUMNS).eq('id', reportId).maybeSingle()
    facts = (data as PendingReportFacts | null) ?? null
  }
  const body = facts ? reportEntryBody(facts, subjectName) : null
  const { error } = await db.rpc('file_person_report', body ? { p_report_id: reportId, p_content: body } : { p_report_id: reportId })
  return { error: error ?? null }
}
