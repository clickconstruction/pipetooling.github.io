/**
 * GC mode, the real build, the Building lane's U7c: the weekly reports as their rows hold them (`gc_weekly_reports`, U1's
 * table, append only), read back into each project's `weeklyReports`, so the kernels in ./buildingWeekly.ts read them
 * unchanged. A report from me went from the sender's own mail and counts as sent when its row is kept. One from the
 * company counts only once its email went (`email_send_log_id`, written by `gc-customer-email` after the send): a row whose
 * send was refused or failed is no sent report, and the next press goes again on it. The plan:
 * to-dos/gc-mode/mockups/building-u7.md on branch spike/gc-mode.
 */
import type { Database } from '../../types/database'
import { gcCustomerEmailRefusal, type CustomerEmailAnswer } from './customerEmail'
import type { GcState, WeeklyReportSent } from './types'

type WeeklyReportTableRow = Database['public']['Tables']['gc_weekly_reports']['Row']

/** The columns `loadGcWeeklyReports` reads. */
export type WeeklyReportRow = Pick<
  WeeklyReportTableRow,
  'id' | 'project_id' | 'week_of' | 'sent_on' | 'sent_from' | 'by_name' | 'to_words' | 'copied_architect' | 'subject' | 'body' | 'email_send_log_id' | 'created_at'
>

export const WEEKLY_REPORT_COLUMNS = 'id, project_id, week_of, sent_on, sent_from, by_name, to_words, copied_architect, subject, body, email_send_log_id, created_at'

/** Did this row's report go: one from me always, one from the company once its email went. */
export function weeklyReportWent(row: Pick<WeeklyReportRow, 'sent_from' | 'email_send_log_id'>): boolean {
  return row.sent_from === 'me' || row.email_send_log_id !== null
}

/** One report as the kernels read it. */
export function weeklyReportSentOf(row: WeeklyReportRow): WeeklyReportSent {
  return {
    weekOf: row.week_of,
    sentOn: row.sent_on,
    from: row.sent_from === 'company' ? 'company' : 'me',
    by: row.by_name,
    to: row.to_words,
    copiedArchitect: row.copied_architect,
    subject: row.subject,
    body: row.body,
  }
}

/** Each project's sent reports laid over the board's, oldest first, so the newest of a week is the last. */
export function withWeeklyReports(state: GcState, rows: WeeklyReportRow[]): GcState {
  const went = rows.filter(weeklyReportWent)
  if (went.length === 0) return state
  const byProject = new Map<string, WeeklyReportRow[]>()
  for (const r of went) byProject.set(r.project_id, [...(byProject.get(r.project_id) ?? []), r])
  return {
    ...state,
    projects: state.projects.map((p) => {
      const mine = byProject.get(p.id)
      if (!mine) return p
      const weeklyReports = [...mine].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(weeklyReportSentOf)
      return { ...p, weeklyReports }
    }),
  }
}

/** A report as the window sends it. */
export interface WeeklyReportSend {
  projectId: string
  weekOf: string
  from: 'me' | 'company'
  /** Who sends it, as their name reads today. */
  by: string
  /** Who it goes to: the customer's contact and company. */
  to: string
  copyArchitect: boolean
  subject: string
  body: string
}

/** The row `gc_weekly_reports` takes for a send, on the company's day. */
export function weeklyReportInsert(s: WeeklyReportSend, today: string): Database['public']['Tables']['gc_weekly_reports']['Insert'] {
  return {
    project_id: s.projectId,
    week_of: s.weekOf,
    sent_on: today,
    sent_from: s.from,
    by_name: s.by.trim() || 'Click Construction',
    to_words: s.to.trim(),
    copied_architect: s.from === 'company' && s.copyArchitect,
    subject: s.subject.trim(),
    body: s.body.trim(),
  }
}

/**
 * A company row not sent yet that this send can go again on: the newest one for the same week with the same words and
 * copy, so a refused or failed send, or a test, never leaves a second row behind for one email.
 */
export function weeklyReportRetryRow(rows: WeeklyReportRow[], s: WeeklyReportSend): WeeklyReportRow | null {
  const same = rows.filter(
    (r) =>
      r.project_id === s.projectId &&
      r.week_of === s.weekOf &&
      r.sent_from === 'company' &&
      r.email_send_log_id === null &&
      r.subject === s.subject.trim() &&
      r.body === s.body.trim() &&
      r.copied_architect === s.copyArchitect,
  )
  return same.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
}

/** A refusal in the report window's words: a report that went already says so as a report. */
export function weeklyReportRefusal(answer: Extract<CustomerEmailAnswer, { ok: false }>): string {
  return answer.key === 'alreadySent' ? 'This report went already. Press Send again to send a new one.' : gcCustomerEmailRefusal(answer.key)
}
