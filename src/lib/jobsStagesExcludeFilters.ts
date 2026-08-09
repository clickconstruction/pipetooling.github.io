/**
 * Pipeline "hide groups" exclusions (v2.1476): hide any set of GCs,
 * Developments, or Account Men from the Stages board. The inverse of the
 * include-filters in jobsStagesBoard.ts — those zoom the board TO one value,
 * these subtract values, and the two compose (exclusions apply first, then
 * the include filter, then search).
 *
 * Values are ids (gc customer id / development id / account-man user id),
 * plus the STAGES_EXCLUDE_NONE pseudo-value meaning "jobs with no value in
 * this dimension" — so the untagged worklist can be hidden (or be all that's
 * left). Persisted per device via localStorage, like the neighboring
 * 'jobs-stages-follow-moves' toggle: the board stays personal to the device
 * without affecting anyone else's.
 */
import type { JobWithDetails } from '../types/jobWithDetails'

/** Order = the "Hide groups…" modal's section order (user-chosen, v2.1478): Account Man first. */
export const STAGES_EXCLUDE_DIMENSIONS = ['accountMan', 'development', 'gc'] as const
export type StagesExcludeDimension = (typeof STAGES_EXCLUDE_DIMENSIONS)[number]

/** Pseudo-value: jobs with NO value in the dimension ("No GC", "No development", "No Account Man"). */
export const STAGES_EXCLUDE_NONE = 'none'

export type StagesExcludeFilters = Record<StagesExcludeDimension, string[]>

export const EMPTY_STAGES_EXCLUDE_FILTERS: StagesExcludeFilters = { gc: [], development: [], accountMan: [] }

export const STAGES_EXCLUDE_DIMENSION_LABELS: Record<StagesExcludeDimension, string> = {
  gc: 'GC / Builder',
  development: 'Development',
  accountMan: 'Account Man',
}

export const STAGES_EXCLUDE_NONE_LABELS: Record<StagesExcludeDimension, string> = {
  gc: 'No GC set',
  development: 'No development set',
  accountMan: 'No Account Man',
}

function dimensionValue(job: JobWithDetails, dim: StagesExcludeDimension): { id: string; name: string } | null {
  if (dim === 'gc') {
    return job.gcCustomer?.id ? { id: job.gcCustomer.id, name: (job.gcCustomer.name ?? '').trim() || '—' } : null
  }
  if (dim === 'development') {
    return job.development?.id ? { id: job.development.id, name: (job.development.name ?? '').trim() || '—' } : null
  }
  return job.account_manager_user_id
    ? { id: job.account_manager_user_id, name: (job.account_manager?.name ?? '').trim() || '—' }
    : null
}

export type StagesExcludeOption = {
  /** Value id, or STAGES_EXCLUDE_NONE for the "no value" pseudo-row. */
  id: string
  name: string
  count: number
}

/**
 * Per-dimension hide options among the loaded jobs: every distinct value with
 * its job count (name-sorted), plus the "none" pseudo-row LAST whenever any
 * job lacks a value. Ids already excluded but no longer present among jobs
 * (e.g. the last job of a hidden GC got deleted) are appended so they stay
 * visible and un-hideable rather than becoming invisible stuck filters.
 */
export function stagesExcludeOptionsFromJobs(
  jobs: JobWithDetails[],
  filters: StagesExcludeFilters,
): Record<StagesExcludeDimension, StagesExcludeOption[]> {
  const out = {} as Record<StagesExcludeDimension, StagesExcludeOption[]>
  for (const dim of STAGES_EXCLUDE_DIMENSIONS) {
    const byId = new Map<string, { name: string; count: number }>()
    let noneCount = 0
    for (const job of jobs) {
      const v = dimensionValue(job, dim)
      if (!v) {
        noneCount++
        continue
      }
      const existing = byId.get(v.id)
      if (existing) existing.count++
      else byId.set(v.id, { name: v.name, count: 1 })
    }
    const options = [...byId.entries()]
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    for (const id of filters[dim]) {
      if (id !== STAGES_EXCLUDE_NONE && !byId.has(id)) {
        options.push({ id, name: '(no longer on the board)', count: 0 })
      }
    }
    if (noneCount > 0 || filters[dim].includes(STAGES_EXCLUDE_NONE)) {
      options.push({ id: STAGES_EXCLUDE_NONE, name: STAGES_EXCLUDE_NONE_LABELS[dim], count: noneCount })
    }
    out[dim] = options
  }
  return out
}

/** Drop every job whose GC / development / Account Man (or lack of one) is excluded. */
export function filterJobsByExclusions(jobs: JobWithDetails[], filters: StagesExcludeFilters): JobWithDetails[] {
  if (countStagesExclusions(filters) === 0) return jobs
  const sets = {} as Record<StagesExcludeDimension, Set<string>>
  for (const dim of STAGES_EXCLUDE_DIMENSIONS) sets[dim] = new Set(filters[dim])
  return jobs.filter((job) =>
    STAGES_EXCLUDE_DIMENSIONS.every((dim) => {
      const set = sets[dim]
      if (set.size === 0) return true
      const v = dimensionValue(job, dim)
      return !set.has(v ? v.id : STAGES_EXCLUDE_NONE)
    }),
  )
}

export function countStagesExclusions(filters: StagesExcludeFilters): number {
  return STAGES_EXCLUDE_DIMENSIONS.reduce((sum, dim) => sum + filters[dim].length, 0)
}

/** Pure toggle — returns a new filters object with the value added/removed. */
export function toggleStagesExclusion(
  filters: StagesExcludeFilters,
  dim: StagesExcludeDimension,
  id: string,
): StagesExcludeFilters {
  const has = filters[dim].includes(id)
  return { ...filters, [dim]: has ? filters[dim].filter((x) => x !== id) : [...filters[dim], id] }
}

const STORAGE_KEY = 'jobs-stages-exclude-filters'

/** Per-device persistence. Anything malformed degrades to no exclusions — never break the board. */
export function loadStagesExcludeFilters(): StagesExcludeFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STAGES_EXCLUDE_FILTERS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_STAGES_EXCLUDE_FILTERS
    const rec = parsed as Record<string, unknown>
    const out = { ...EMPTY_STAGES_EXCLUDE_FILTERS }
    for (const dim of STAGES_EXCLUDE_DIMENSIONS) {
      const v = rec[dim]
      out[dim] = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : []
    }
    return out
  } catch {
    return EMPTY_STAGES_EXCLUDE_FILTERS
  }
}

export function saveStagesExcludeFilters(filters: StagesExcludeFilters): void {
  try {
    if (countStagesExclusions(filters) === 0) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {
    /* quota/private mode: hides become session-only — never break the board */
  }
}
