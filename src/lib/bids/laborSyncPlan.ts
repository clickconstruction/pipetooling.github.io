/**
 * The Labor tab's load sync as a plan (bid history PR 0b, punch list #73).
 *
 * Labor rows are keyed by fixture NAME and belong to the bid, while count rows belong to a
 * version. Before this, the sync deleted every labor row whose name no count row carried, and
 * minted the book's hours for every counted name with no row. So typed hours were lost three
 * ways: a re-import that renamed a fixture ("[Break room] WC" became "WC" in v2.4188, or a case
 * change), a switch to a version without the fixture, and a fixture removed and counted again.
 *
 * Now a counted name with no row of its own looks, in this order, for:
 *   1. a parked row of exactly that name (the newest): taken back, hours and all;
 *   2. a live row whose name differs only in case, spacing or a `[Group] ` prefix: renamed in place;
 *   3. a parked row matched the same loose way: taken back;
 *   4. nothing: minted from the book, as before.
 * Exact beats loose, and a live row beats a parked one at the same strength. A loose match never
 * guesses: when two counted names, two live rows or two parked rows share a key, none of them is
 * matched by it. A live row no counted name claims is parked (`cost_estimate_labor_rows_unmatched`)
 * instead of deleted, and stays out of every total until it is taken back, used or removed.
 */

/** CountTooling's `[Group] ` name prefix (the same pattern as countRowUnit.ts). */
const GROUP_PREFIX_RE = /^\[[^\]]*\]\s*/

/** The loose key two names share when they differ only in case, spacing or a `[Group] ` prefix. Empty for no name. */
export function laborFixtureKey(name: string | null | undefined): string {
  return (name ?? '').trim().replace(GROUP_PREFIX_RE, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export type SyncCountRow = { fixture: string | null; count: number | string | null }
export type SyncLaborRow = { id: string; fixture: string | null; count: number | string | null }
export type SyncParkedRow = { id: string; fixture: string; parked_at: string }

export type LaborSyncPlan = {
  /** A live row whose counted name now differs only in case, spacing or a group prefix: it takes the new name and keeps its hours. */
  renames: { id: string; fixture: string; count: number }[]
  /** A parked row a counted name takes back. */
  takeBacks: { parkedId: string; fixture: string; count: number }[]
  /** A counted name with no row anywhere: minted from the book. */
  mints: { fixture: string; count: number }[]
  /** A live row still counted under its own name whose count moved. */
  countUpdates: { id: string; count: number }[]
  /** A live row no counted name claims: it moves to the unmatched table. */
  parks: { id: string }[]
}

function groupBy<T>(items: ReadonlyArray<T>, key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const t of items) {
    const k = key(t)
    const list = out.get(k)
    if (list) list.push(t)
    else out.set(k, [t])
  }
  return out
}

export function planLaborSync(input: {
  countRows: ReadonlyArray<SyncCountRow>
  laborRows: ReadonlyArray<SyncLaborRow>
  parkedRows: ReadonlyArray<SyncParkedRow>
}): LaborSyncPlan {
  const { countRows, laborRows, parkedRows } = input
  // Since v2.4188 one name may sit on two count rows (the base bid and an alternate group); their
  // counts sum onto the one labor row.
  const countByName = new Map<string, number>()
  for (const r of countRows) {
    const name = r.fixture ?? ''
    countByName.set(name, (countByName.get(name) ?? 0) + (Number(r.count) || 0))
  }
  const names = Array.from(countByName.keys())

  const liveByName = groupBy(laborRows, (r) => r.fixture ?? '')
  const namesByKey = groupBy(names, laborFixtureKey)
  const liveByKey = groupBy(laborRows, (r) => laborFixtureKey(r.fixture))
  const newestFirst = [...parkedRows].sort((a, b) => b.parked_at.localeCompare(a.parked_at))
  const parkedByName = groupBy(newestFirst, (p) => p.fixture)
  const parkedByKey = groupBy(newestFirst, (p) => laborFixtureKey(p.fixture))

  const plan: LaborSyncPlan = { renames: [], takeBacks: [], mints: [], countUpdates: [], parks: [] }
  const renamed = new Set<string>()
  const taken = new Set<string>()

  for (const name of names) {
    const count = countByName.get(name) ?? 0
    const own = liveByName.get(name)
    if (own) {
      // The first row of the name carries the count, as before; a duplicate stays as it is.
      if ((Number(own[0]!.count) || 0) !== count) plan.countUpdates.push({ id: own[0]!.id, count })
      continue
    }
    const exactParked = parkedByName.get(name)?.find((p) => !taken.has(p.id))
    if (exactParked) {
      taken.add(exactParked.id)
      plan.takeBacks.push({ parkedId: exactParked.id, fixture: name, count })
      continue
    }
    const key = laborFixtureKey(name)
    const keyIsOneName = key !== '' && namesByKey.get(key)?.length === 1
    const live = liveByKey.get(key)
    if (keyIsOneName && live?.length === 1 && !countByName.has(live[0]!.fixture ?? '') && !renamed.has(live[0]!.id)) {
      renamed.add(live[0]!.id)
      plan.renames.push({ id: live[0]!.id, fixture: name, count })
      continue
    }
    const parked = parkedByKey.get(key)
    if (keyIsOneName && !live?.length && parked?.length === 1 && !taken.has(parked[0]!.id)) {
      taken.add(parked[0]!.id)
      plan.takeBacks.push({ parkedId: parked[0]!.id, fixture: name, count })
      continue
    }
    plan.mints.push({ fixture: name, count })
  }

  for (const r of laborRows) {
    if (!countByName.has(r.fixture ?? '') && !renamed.has(r.id)) plan.parks.push({ id: r.id })
  }
  return plan
}

/** What a labor row says about its hours: the columns that travel with it when it is parked, taken back or used. */
export type LaborHours = {
  rough_in_hrs_per_unit: number
  top_out_hrs_per_unit: number
  trim_set_hrs_per_unit: number
  is_fixed: boolean
  kind: string
  unit: string
  source: string | null
  source_note: string | null
}

export function laborHoursOf(row: LaborHours): LaborHours {
  return {
    rough_in_hrs_per_unit: Number(row.rough_in_hrs_per_unit) || 0,
    top_out_hrs_per_unit: Number(row.top_out_hrs_per_unit) || 0,
    trim_set_hrs_per_unit: Number(row.trim_set_hrs_per_unit) || 0,
    is_fixed: !!row.is_fixed,
    kind: row.kind,
    unit: row.unit,
    source: row.source ?? null,
    source_note: row.source_note ?? null,
  }
}

const fmtHours = (n: number) => String(Math.round((Number(n) || 0) * 100) / 100)

/** One line for a parked row on the Labor tab's band: "Rough In 1.5 · Top Out 2 · Trim Set 1 hrs each". */
export function unmatchedHoursWords(row: LaborHours): string {
  const per = row.unit === 'per_100ft' ? 'hrs per 100 ft' : row.is_fixed || row.kind === 'task' ? 'hrs in all' : 'hrs each'
  return `Rough In ${fmtHours(row.rough_in_hrs_per_unit)} · Top Out ${fmtHours(row.top_out_hrs_per_unit)} · Trim Set ${fmtHours(row.trim_set_hrs_per_unit)} ${per}`
}
