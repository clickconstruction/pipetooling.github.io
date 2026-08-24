/**
 * People → HR (v2.2221): freshness of a person's curated summary relative to
 * their append-only raw log. Drives the roster dots (green/amber/grey) and the
 * "summary is N days behind" banner. An entry "covered" by the summary is one
 * created at or before the summary's last rewrite — the "covers N of M
 * entries" figure the tab shows.
 */

export type PersonFileFreshnessState = 'empty' | 'current' | 'stale'

export type PersonFileFreshness = {
  state: PersonFileFreshnessState
  /** Days since the OLDEST entry the summary hasn't covered; 0 unless stale. */
  staleDays: number
  entryCount: number
  /** Entries created at or before the summary's last update. */
  coveredCount: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export function derivePersonFileFreshness(args: {
  /** person_files.updated_at for kind='summary', or null when no summary row. */
  summaryUpdatedAt: string | null
  /** person_file_entries.created_at values for this person. */
  entryCreatedAts: string[]
  nowIso: string
}): PersonFileFreshness {
  const entryTimes = args.entryCreatedAts
    .map((iso) => Date.parse(iso))
    .filter((t) => Number.isFinite(t))
  const entryCount = entryTimes.length
  const summaryTime = args.summaryUpdatedAt === null ? null : Date.parse(args.summaryUpdatedAt)
  const hasSummary = summaryTime !== null && Number.isFinite(summaryTime)

  if (!hasSummary && entryCount === 0) {
    return { state: 'empty', staleDays: 0, entryCount: 0, coveredCount: 0 }
  }

  const uncovered = hasSummary ? entryTimes.filter((t) => t > summaryTime) : entryTimes
  const coveredCount = entryCount - uncovered.length
  if (uncovered.length === 0) {
    // A summary with no entries behind it counts as current — nothing to fold in.
    return { state: 'current', staleDays: 0, entryCount, coveredCount }
  }

  const now = Date.parse(args.nowIso)
  const oldestUncovered = Math.min(...uncovered)
  const staleDays = Number.isFinite(now)
    ? Math.max(0, Math.floor((now - oldestUncovered) / DAY_MS))
    : 0
  return { state: 'stale', staleDays, entryCount, coveredCount }
}
