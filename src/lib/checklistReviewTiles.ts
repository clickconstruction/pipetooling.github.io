/**
 * Review-tab summary tiles (v2.2194): the three headline numbers as tappable,
 * centered tiles whose captions answer "who / how old" and whose taps jump to
 * the list that explains them. Pure caption/tone logic lives here.
 */

export type ReviewTileCaption = { text: string; ok: boolean }

/** To sign off: only a count is available — zero reads as done. */
export function signOffTileCaption(count: number | null): ReviewTileCaption {
  if (count == null) return { text: '…', ok: false }
  return count === 0 ? { text: '✓ nothing waiting', ok: true } : { text: 'tap to review & sign off', ok: false }
}

/** Outstanding: "one-offs · 5 people · oldest 118 days" (zero → all clear). */
export function outstandingTileCaption(rangeLabel: string, people: number, oldestDays: number | null): ReviewTileCaption {
  if (people === 0) return { text: '✓ all clear', ok: true }
  const parts = [rangeLabel.toLowerCase(), `${people} ${people === 1 ? 'person' : 'people'}`]
  if (oldestDays != null && oldestDays > 0) parts.push(`oldest ${oldestDays} ${oldestDays === 1 ? 'day' : 'days'}`)
  return { text: parts.join(' · '), ok: false }
}

const WEEKDAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Missed this week: the weekdays the misses fell on ("Tue, Thu"); zero → clean. */
export function missedTileCaption(missedDatesYmd: readonly string[]): ReviewTileCaption {
  if (missedDatesYmd.length === 0) return { text: '✓ clean so far', ok: true }
  const seen = new Set<string>()
  for (const ymd of missedDatesYmd) {
    const d = new Date(`${ymd}T12:00:00Z`)
    if (!Number.isNaN(d.getTime())) seen.add(WEEKDAY_ORDER[d.getUTCDay()]!)
  }
  const days = WEEKDAY_ORDER.filter((w) => seen.has(w))
  return { text: days.join(', ') || 'this week', ok: false }
}

/** Number tone: quiet when zero, colored when there's work. */
export function reviewTileTone(kind: 'signoff' | 'outstanding' | 'missed', count: number | null): 'zero' | 'blue' | 'red' | 'amber' {
  if (!count) return 'zero'
  return kind === 'signoff' ? 'blue' : kind === 'outstanding' ? 'red' : 'amber'
}
