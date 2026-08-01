/**
 * "Subs on this project" roster for the Workflow header (RUN_SUBS_PLAN
 * Phase 1, PR 1.3) — the first reader of `assigned_person_id`.
 *
 * Pure: takes the page's steps plus the sub-identity sets (roster people of
 * kind 'sub' by id, subcontractor names as a legacy fallback) and returns one
 * entry per distinct sub with step counts. Identity groups person-id first;
 * unresolved assignments fall back to the trimmed lowercase name, per the
 * PERSON_IDENTITY_PLAN invariant.
 */

export type SubRosterStepInput = {
  name: string
  status: string
  sequence_order: number
  assigned_to_name: string | null
  assigned_person_id?: string | null
}

export type SubRosterEntry = {
  /** Grouping key: person id when resolved, else `name:<lower>`. */
  key: string
  name: string
  personId: string | null
  /** Steps not yet finished (pending / in_progress / rejected). */
  activeStepCount: number
  totalStepCount: number
  /** First unfinished step by sequence, if any. */
  currentStepName: string | null
}

const ACTIVE_STATUSES = new Set(['pending', 'in_progress', 'rejected'])

export function buildProjectSubRoster(
  steps: SubRosterStepInput[],
  subPersonIds: ReadonlySet<string>,
  subNamesLower: ReadonlySet<string>,
): SubRosterEntry[] {
  const sorted = [...steps].sort((a, b) => a.sequence_order - b.sequence_order)
  const entries = new Map<string, SubRosterEntry>()
  for (const step of sorted) {
    const name = (step.assigned_to_name ?? '').trim()
    if (!name) continue
    const personId = step.assigned_person_id ?? null
    const isSub = (personId && subPersonIds.has(personId)) || subNamesLower.has(name.toLowerCase())
    if (!isSub) continue
    const key = personId ?? `name:${name.toLowerCase()}`
    const existing = entries.get(key)
    const isActive = ACTIVE_STATUSES.has(step.status)
    if (existing) {
      existing.totalStepCount += 1
      if (isActive) {
        existing.activeStepCount += 1
        if (!existing.currentStepName) existing.currentStepName = step.name
      }
    } else {
      entries.set(key, {
        key,
        name,
        personId,
        activeStepCount: isActive ? 1 : 0,
        totalStepCount: 1,
        currentStepName: isActive ? step.name : null,
      })
    }
  }
  return [...entries.values()]
}
