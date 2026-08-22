/**
 * Checklist reminder-section kernels (v2.2096): preset chips, the plain-words
 * option mapping (one checkbox instead of the today_only/today_and_overdue
 * dropdown), and the green one-line summary that restates the whole reminder
 * plan. Server behavior lives in supabase/functions/send-scheduled-reminders.
 */

export const REMINDER_PRESETS = [
  { label: 'Morning 7:00', time: '07:00' },
  { label: 'Midday 12:00', time: '12:00' },
  { label: 'End of day 4:00', time: '16:00' },
] as const

export type ReminderScope = 'today_only' | 'today_and_overdue'

/** The "Keep reminding every day until it's done" checkbox → stored scope. */
export function scopeFromDaily(dailyUntilDone: boolean): ReminderScope {
  return dailyUntilDone ? 'today_and_overdue' : 'today_only'
}

/** Stored scope → checkbox; legacy null/empty reads as daily (the safer nag). */
export function dailyFromScope(scope: string | null | undefined): boolean {
  return scope !== 'today_only'
}

/** '07:00' → '7:00 AM', '16:00' → '4:00 PM' (bad input echoes back). */
export function reminderTimeLabel(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return hhmm
  const h24 = Number(m[1])
  if (!Number.isFinite(h24) || h24 > 23) return hhmm
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${m[2]} ${h24 < 12 ? 'AM' : 'PM'}`
}

/** "Michael A", "Michael A & Bryan", "Michael A, Bryan & Wendi", "4 people". */
export function assigneeListLabel(names: ReadonlyArray<string>): string {
  const clean = names.map((n) => n.trim()).filter(Boolean)
  if (clean.length === 0) return 'the assignees'
  if (clean.length === 1) return clean[0]!
  if (clean.length <= 3) return `${clean.slice(0, -1).join(', ')} & ${clean[clean.length - 1]}`
  return `${clean.length} people`
}

export type ReminderPlan = {
  /** 'HH:MM'; empty = no reminder (summary is null). */
  time: string
  dailyUntilDone: boolean
  dayBefore: boolean
  /** null = never escalate. */
  escalateAfterDays: number | null
}

/**
 * The one-line restatement, e.g. "Reminds Michael A & Bryan every day at
 * 7:00 AM until it's done — and you after 3 days." Null when no time is set.
 */
export function reminderSummary(plan: ReminderPlan, assigneeNames: ReadonlyArray<string>): string | null {
  if (!plan.time) return null
  const who = assigneeListLabel(assigneeNames)
  const at = reminderTimeLabel(plan.time)
  const cadence = plan.dailyUntilDone ? `every day at ${at} until it's done` : `on the due date at ${at}`
  const dayBefore = plan.dayBefore ? ', starting the day before' : ''
  const escalate = plan.escalateAfterDays != null ? ` — and you after ${plan.escalateAfterDays} day${plan.escalateAfterDays === 1 ? '' : 's'}` : ''
  return `Reminds ${who} ${cadence}${dayBefore}${escalate}.`
}

/**
 * "Also remind the day before" only makes sense when some occurrence is due
 * later than today: any repeating task qualifies; a dated one only when the
 * date is ahead; a plain today-task never does.
 */
export function dayBeforeApplicable(when: 'today' | 'date' | 'repeat', startDateYmd: string, todayYmd: string): boolean {
  if (when === 'repeat') return true
  if (when === 'date') return startDateYmd > todayYmd
  return false
}
