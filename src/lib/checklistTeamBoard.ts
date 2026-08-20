/**
 * Pure helpers for the Review tab's team board (office view): per-person
 * outstanding cards with an oldest-age signal, summary tiles, and the
 * segmented range filter's labels. Companion to checklistHistoryLedger.ts
 * (field view) — same date-string conventions, timezone-inert.
 */

export function initialsFor(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0]?.[0] ?? ''
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''
  return (first + second).toUpperCase() || '?'
}

/** Age in whole days of the OLDEST instance (by scheduled_date); 0 when empty. */
export function oldestAgeDays(instances: Array<{ scheduled_date: string }>, todayStr: string): number {
  const t = new Date(todayStr + 'T00:00:00')
  if (isNaN(t.getTime())) return 0
  let oldest = 0
  for (const inst of instances) {
    const d = new Date(inst.scheduled_date + 'T00:00:00')
    if (isNaN(d.getTime())) continue
    const days = Math.round((t.getTime() - d.getTime()) / 86_400_000)
    if (days > oldest) oldest = days
  }
  return oldest
}

/** "20d" chip text; empty for not-yet-due. */
export function ageChipLabel(dateStr: string, todayStr: string): string {
  const t = new Date(todayStr + 'T00:00:00')
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(t.getTime()) || isNaN(d.getTime())) return ''
  const days = Math.round((t.getTime() - d.getTime()) / 86_400_000)
  if (days <= 0) return ''
  return `${days}d`
}

export type BoardRange = 'next_day' | 'next_week' | 'non_repeating' | 'missed'

/** Honest, human labels — 'non_repeating' has always meant one-off tasks. */
export const BOARD_RANGE_LABELS: Record<BoardRange, string> = {
  non_repeating: 'One-offs',
  missed: 'Missed',
  next_day: 'Next day',
  next_week: 'Next week',
}

export const BOARD_RANGE_ORDER: BoardRange[] = ['non_repeating', 'missed', 'next_day', 'next_week']
