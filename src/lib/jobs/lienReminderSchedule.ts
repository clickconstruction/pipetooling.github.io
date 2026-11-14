import { COURTESY_AFFIDAVIT_MARGIN_DAYS, COURTESY_AGAIN_DAYS, COURTESY_FROM_DAY } from './lienCourtesyNotice'
import { LETTER_TWO_BY_DAY, LETTER_TWO_FROM_DAY } from './lienLetterTwo'
import { LIEN_MONTH_RULE } from './lienMonthRhythm'

/**
 * Our schedule after a notice (v2.6574, Grace's ask of 2026-11-06: "it is not inherent for someone
 * to know something is overdue from day ten — where do we present that schedule?"). Until now the
 * days lived in the clocks' constants and in sentences on a notice's footer; § Rules held the law's
 * dates alone. This is the one home for the path from the packet to the affidavit's day, drawn as a
 * strip at the top of a pressed rung's step brief on To do and under *Our schedule after a notice*
 * in § Rules. Every day here is read from the clock that enforces it, so the strip follows a rule
 * when it changes. Pure; nothing here reads or writes.
 */

/** Whose rule a point is: the owner chose it, counsel set it, it is our own margin, or it is the law's. */
export type LienScheduleSource = 'owner' | 'counsel' | 'ours' | 'law'

export type LienSchedulePoint = { day: number; label: string; source: LienScheduleSource }

/** The points on the day axis, from the packet. */
export const LIEN_REMINDER_SCHEDULE: readonly LienSchedulePoint[] = [
  { day: 0, label: 'the packet goes', source: 'law' },
  { day: COURTESY_FROM_DAY, label: 'a courtesy notice may go', source: 'owner' },
  { day: LETTER_TWO_FROM_DAY, label: 'the attorney’s letter is due', source: 'counsel' },
  { day: LETTER_TWO_BY_DAY, label: 'the attorney’s letter is overdue', source: 'counsel' },
]

/** The tail past the axis, set by the affidavit's day, which is each job's own. */
export const LIEN_SCHEDULE_TAIL: readonly { label: string; source: LienScheduleSource }[] = [
  { label: `${COURTESY_AFFIDAVIT_MARGIN_DAYS} days before the affidavit’s day, file it instead of reminding`, source: 'ours' },
  { label: 'the affidavit’s day, § 53.052', source: 'law' },
]

export const LIEN_SCHEDULE_SOURCE_WORDS: Record<LienScheduleSource, string> = {
  owner: 'the owner’s choice',
  counsel: 'counsel’s rule',
  ours: 'our margin',
  law: 'the law',
}

/** The axis runs four weeks; a notice past it marks at the end with a plus. */
export const LIEN_SCHEDULE_AXIS_DAYS = 28

export function lienSchedulePct(day: number, max = LIEN_SCHEDULE_AXIS_DAYS): number {
  if (!Number.isFinite(day) || day <= 0) return 0
  return Math.min(100, Math.round((day / max) * 1000) / 10)
}

export type LienScheduleMark = { day: number; pct: number; past: boolean; n: number }

/** The notices' own days on the axis, one mark per day with its count; days past the axis gather at its end. */
export function lienScheduleMarks(days: ReadonlyArray<number | null | undefined>, max = LIEN_SCHEDULE_AXIS_DAYS): LienScheduleMark[] {
  const by = new Map<number, number>()
  for (const d of days) {
    if (d == null || !Number.isFinite(d)) continue
    const day = Math.max(0, Math.round(d))
    by.set(day, (by.get(day) ?? 0) + 1)
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([day, n]) => ({ day, pct: lienSchedulePct(day, max), past: day > max, n }))
}

/** The schedule in one sentence, for a title or a screen reader. */
export function lienScheduleWords(): string {
  const points = LIEN_REMINDER_SCHEDULE.map((p) => `day ${p.day} ${p.label}`)
  return `${points.join(' · ')} · ${LIEN_SCHEDULE_TAIL.map((t) => t.label).join(' · ')}.`
}

/** Whose rule each day is, one line each, for § Rules. */
export function lienScheduleSourceLines(): string[] {
  return [
    `Day ${COURTESY_FROM_DAY} is the owner’s choice, and so is reminders week: the one courtesy notice goes on days ${LIEN_MONTH_RULE.reminders.from} to ${LIEN_MONTH_RULE.reminders.to} of the lien’s month, never before day ${COURTESY_FROM_DAY}, never a second; after ${COURTESY_AGAIN_DAYS} days of silence the attorney’s letter leads.`,
    `Day ${LETTER_TWO_FROM_DAY} and day ${LETTER_TWO_BY_DAY} are counsel’s rule for the second letter.`,
    `The ${COURTESY_AFFIDAVIT_MARGIN_DAYS} days before the affidavit’s day are our margin, so a reminder never names a lien day the law would not allow.`,
    'The affidavit’s day is the law’s, § 53.052, and each job has its own.',
  ]
}
