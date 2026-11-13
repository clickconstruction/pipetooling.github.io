import type { CSSProperties } from 'react'
import type { TaskFormValue } from './TaskFormRows'

/** The box for the task's words, as both task windows draw it. The window passes its own handlers and ref. */
export const TASK_WORDS_BOX_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  minHeight: '4.25rem',
  padding: '0.65rem 0.75rem',
  boxSizing: 'border-box',
  font: 'inherit',
  fontSize: '1.0625rem',
  lineHeight: 1.35,
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
  resize: 'none',
  border: '1.5px solid var(--border-strong)',
  borderRadius: 12,
}

/** True when the people search box is on screen, and focused now. A task window's Tab cycle calls it. */
export function focusPeopleSearchIfOpen(searchId: string): boolean {
  const box = document.getElementById(searchId)
  if (!box || box.closest('[hidden]')) return false
  box.focus()
  return true
}

/** The rows' fields at rest, for a window that keeps only some of them: a roadmap task has people and nothing else here. */
export function restingTaskFormValue(assigneeIds: string[], todayStr: string): TaskFormValue {
  return {
    links: [],
    assigned_to_user_ids: assigneeIds,
    repeat_days_of_week: [],
    repeat_days_after: 1,
    repeat_end_date: '',
    start_date: todayStr,
    due_date: '',
    show_until_completed: true,
    notify_on_complete_user_id: '',
    reminder_time: '',
    reminder_daily: true,
    remind_day_before: false,
    escalate_enabled: false,
    escalate_days: 3,
  }
}
