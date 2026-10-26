/**
 * Who covers what, counts only (punch list #144, PR 4): what of the firms' territories the
 * legal portal may show every firm. Counsel has not yet answered what one firm may see of
 * another's cases, so until that answer widens it the page holds to counts — each active
 * firm's name and counties, how many open matters each firm holds, and how many open
 * matters stand in each county. No case names, no dollars, no detail of another firm's
 * matters leaves here.
 *
 * Lives in `_shared` so `legal-portal` shapes with the same code the client's tests hold;
 * `src/lib/legal/legalFirmCoverage.ts` is the client's door. A matter's county is its
 * first job's property-record county (the venue rule's first leg); a matter whose records
 * name no county counts for its firm but for no county.
 */

export type FirmCoverageFirm = {
  id: string
  name: string
  /** `legal_firms.created_at`, for the hue order the picker and the lens use (`firmHues`). */
  createdAt: string | null
  /** The counties the firm covers today, sorted. */
  counties: string[]
  /** Open matters with the firm (the portal's with-firm stages, not closed). */
  matterCount: number
}

export type FirmCoverage = {
  /** The active firms, oldest first (the hue order). */
  firms: FirmCoverageFirm[]
  /** Open matters per county, over every firm — counts, never names. */
  countyCounts: Record<string, number>
}

type ShapeFirmCoverageInput = {
  firms: ReadonlyArray<Record<string, unknown>>
  /** `legal_firm_counties` rows; only live ones (`until` null) count. */
  countyRows: ReadonlyArray<Record<string, unknown>>
  /** The open with-firm matters, every firm's. */
  matters: ReadonlyArray<Record<string, unknown>>
  /** matter id → its county, or null when no record names one. */
  countyOfMatter: ReadonlyMap<string, string | null>
}

/** The coverage the portal sends, from the raw rows. */
export function shapeFirmCoverage(input: ShapeFirmCoverageInput): FirmCoverage {
  const active = input.firms
    .filter((f) => f.active === true && typeof f.id === 'string' && typeof f.name === 'string')
    .map((f) => ({ id: f.id as string, name: f.name as string, createdAt: typeof f.created_at === 'string' ? f.created_at : null }))
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
  const activeIds = new Set(active.map((f) => f.id))
  const counties = new Map<string, string[]>(active.map((f) => [f.id, []]))
  for (const r of input.countyRows) {
    if (r.until != null || typeof r.firm_id !== 'string' || typeof r.county !== 'string' || !r.county.trim()) continue
    counties.get(r.firm_id)?.push(r.county.trim())
  }
  const matterCount = new Map<string, number>()
  const countyCounts: Record<string, number> = {}
  for (const m of input.matters) {
    if (typeof m.firm_id === 'string' && activeIds.has(m.firm_id)) matterCount.set(m.firm_id, (matterCount.get(m.firm_id) ?? 0) + 1)
    const county = typeof m.id === 'string' ? input.countyOfMatter.get(m.id) ?? null : null
    if (county) countyCounts[county] = (countyCounts[county] ?? 0) + 1
  }
  return {
    firms: active.map((f) => ({ ...f, counties: (counties.get(f.id) ?? []).sort((a, b) => a.localeCompare(b)), matterCount: matterCount.get(f.id) ?? 0 })),
    countyCounts,
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** Defensive parse of the function's `coverage` — null from an older function or a shape this page does not know. */
export function parseFirmCoverage(raw: unknown): FirmCoverage | null {
  if (!isRecord(raw) || !Array.isArray(raw.firms)) return null
  const firms: FirmCoverageFirm[] = []
  for (const f of raw.firms) {
    if (!isRecord(f) || typeof f.id !== 'string' || typeof f.name !== 'string') continue
    firms.push({
      id: f.id,
      name: f.name,
      createdAt: typeof f.createdAt === 'string' ? f.createdAt : null,
      counties: Array.isArray(f.counties) ? f.counties.filter((c): c is string => typeof c === 'string' && c.trim().length > 0) : [],
      matterCount: typeof f.matterCount === 'number' && Number.isFinite(f.matterCount) && f.matterCount > 0 ? Math.floor(f.matterCount) : 0,
    })
  }
  const countyCounts: Record<string, number> = {}
  if (isRecord(raw.countyCounts)) {
    for (const [county, n] of Object.entries(raw.countyCounts)) {
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) countyCounts[county] = Math.floor(n)
    }
  }
  return { firms, countyCounts }
}

/** `3 matters with the firm`, `1 matter with the firm`, `No matters yet`. */
export function coverageMatterWords(n: number): string {
  return n === 0 ? 'No matters yet' : `${n} ${n === 1 ? 'matter' : 'matters'} with the firm`
}

/** The county card's count line: `3 cases`, `1 case`, `No cases today`. */
export function coverageCountWords(n: number): string {
  return n === 0 ? 'No cases today' : `${n} ${n === 1 ? 'case' : 'cases'}`
}
