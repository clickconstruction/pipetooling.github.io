/**
 * `/schedule-dispatch?week=…&day=<ymd>[&hubTab=day]` — which day the link means.
 *
 * `?day=` has always focused a column on the week grid. Until Tier-2 #17 the
 * Day tab ignored it (`dayTabWorkDateYmd` was only ever set on the Tomorrow
 * route), so a Day-view link rendered TODAY instead of the linked day (journey
 * map J18-F11). One resolver now feeds both the column focus and the Day tab's
 * work date, so they can never disagree.
 */
export function resolveScheduleDispatchLinkedDay(input: {
  /** The `/schedule-tomorrow` route: the day is fixed, the URL is ignored. */
  isTomorrow: boolean
  tomorrowYmd: string
  /** Raw `?day=` value (already trimmed or not — we trim). */
  dayParam: string | null | undefined
  /** The week's visible work_date keys (weekend-hidden aware). */
  visibleDayKeys: readonly string[]
}): string {
  if (input.isTomorrow) return input.tomorrowYmd
  const d = (input.dayParam ?? '').trim()
  if (!d) return ''
  return input.visibleDayKeys.includes(d) ? d : ''
}

/** What the Day tab opens on: the linked day when there is one, else the section's own default (today). */
export function scheduleDispatchDayTabWorkDate(linkedDay: string): string | undefined {
  return linkedDay === '' ? undefined : linkedDay
}

/**
 * The week grid's address for a job: `/schedule-dispatch?jobId=…&week=<sunday ymd>[&day=<ymd>]`.
 * Seven surfaces built this string by hand (the Pipeline row and cards, the job window, the
 * Dashboard's job-mode card, Quickfill); one builder now (Stage-A sweep II, v2.3864).
 */
export function scheduleDispatchWeekUrl(jobId: string, weekYmd: string, dayYmd?: string | null): string {
  const p = new URLSearchParams({ jobId, week: weekYmd })
  if (dayYmd) p.set('day', dayYmd)
  return `/schedule-dispatch?${p.toString()}`
}
