/**
 * Quickfill → Unpriced fixtures (punch list #184 sweep B). The station is a count, *N jobs with
 * unpriced fixtures*, with a door to Jobs → Parts. It now carries the age of the OLDEST unpriced
 * fixture on the `UNPRICED_PART_AGE` scale, so a fixture tallied a month ago no longer reads like
 * one from this morning. Pure: the read is `unpricedFixturesIo.ts`.
 *
 * `list_tally_parts_with_po()` has no LIMIT, but it orders newest first and an un-ranged read
 * stops at PostgREST's 1,000 rows, so the oldest fixtures were the ones a big tally dropped. The
 * read asks for the unpriced fixtures only, oldest first, paged. No migration.
 */
import { describeAge, UNPRICED_PART_AGE, type AgeDescription } from '../ageState'

export type UnpricedFixtureRow = {
  job_id: string
  part_id: string | null
  fixture_cost: number | null
  created_at: string | null
}

/** A tallied fixture with no part from the price book and no cost of its own: nothing prices it. */
export function isUnpricedFixture(r: Pick<UnpricedFixtureRow, 'part_id' | 'fixture_cost'>): boolean {
  return r.part_id == null && (r.fixture_cost == null || Number(r.fixture_cost) === 0)
}

export type UnpricedFixturesSummary = {
  /** Jobs with at least one unpriced fixture: the station's count. */
  jobCount: number
  /** When the oldest unpriced fixture was tallied; null when none is stamped. */
  oldestCreatedAt: string | null
  /** The banner's chip; null when nothing is unpriced or nothing is stamped. */
  oldestAge: AgeDescription | null
}

/** Counts the jobs and ages the oldest unpriced fixture. Priced rows are ignored, so any slice of the tally works. */
export function summarizeUnpricedFixtures(rows: ReadonlyArray<UnpricedFixtureRow>, now?: Date | number): UnpricedFixturesSummary {
  const jobs = new Set<string>()
  let oldest: string | null = null
  for (const r of rows) {
    if (!isUnpricedFixture(r)) continue
    jobs.add(r.job_id)
    const t = r.created_at && !Number.isNaN(Date.parse(r.created_at)) ? r.created_at : null
    if (t && (oldest == null || Date.parse(t) < Date.parse(oldest))) oldest = t
  }
  return { jobCount: jobs.size, oldestCreatedAt: oldest, oldestAge: describeAge(oldest, now, UNPRICED_PART_AGE) }
}

/** The banner chip's words: *oldest 12 days waiting*, or *tallied today* when even the oldest is from today. */
export function unpricedFixturesChipLabel(age: AgeDescription): string {
  return age.days <= 0 ? 'tallied today' : `oldest ${age.label}`
}
