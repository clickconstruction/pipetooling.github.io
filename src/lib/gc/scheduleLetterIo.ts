/**
 * GC mode, the real build, the schedule's PR 15a: the customer's schedule sent on its own (G-94). The letter is kept as a
 * `gc_schedule_sends` row first (a plain insert under RLS, append only), or a row kept the same day and not emailed is sent
 * again; then Owner Billing's `gc-customer-email`, kind `schedule`, sends the row's own words, writes its log and files
 * the copy. A test copy goes the same way with `test`. The plan: to-dos/gc-mode/mockups/schedule-pr15.md on branch
 * spike/gc-mode.
 */
import type { CustomerEmailAnswer } from './customerEmail'
import { sendGcCustomerEmail } from './customerEmailIo'
import { scheduleSendRetryRow, type ScheduleLetter } from './schedule/customerScheduleSend'
import { recordScheduleSend } from './scheduleIo'
import type { GcState } from './types'

/** Keep the letter, or find the one kept and not emailed, then email it or a test copy of it. A refusal comes back in the answer. */
export async function sendScheduleLetter(state: GcState, projectId: string, letter: ScheduleLetter, test = false): Promise<CustomerEmailAnswer> {
  const project = state.projects.find((p) => p.id === projectId)
  const rowId = (project ? scheduleSendRetryRow(project, letter, state.today)?.id : null) ?? (await recordScheduleSend(projectId, letter, state.today))
  return sendGcCustomerEmail({ projectId, kind: 'schedule', sourceId: rowId, subject: letter.subject, lines: letter.lines, pdf: null, ...(test ? { test: true } : {}) })
}
