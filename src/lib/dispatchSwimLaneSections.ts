import type { DispatchSwimLanesData } from './dispatchSwimLanes'

/** Roster person as the Dispatch People grid knows it. */
export type SwimLanePerson = { userId: string; displayName: string }

export type SwimLaneDisplaySection = {
  /** null for the automatic "Everyone else" tail. */
  laneId: string | null
  label: string
  people: SwimLanePerson[]
}

export const SWIM_LANE_EVERYONE_ELSE_LABEL = 'Everyone else'

/**
 * Build the lane sections for the People grid: lanes in their configured order,
 * members in lane member order (people missing from the visible roster — e.g.
 * filtered out or archived — are simply omitted), then an "Everyone else" tail
 * with every visible person not in any lane (roster order). Lanes with no
 * visible members are skipped; the tail is skipped when empty.
 */
export function buildSwimLaneDisplaySections(
  lanesData: DispatchSwimLanesData,
  visiblePeople: SwimLanePerson[],
): SwimLaneDisplaySection[] {
  const byId = new Map(visiblePeople.map((p) => [p.userId, p]))
  const out: SwimLaneDisplaySection[] = []
  const seen = new Set<string>()
  for (const lane of lanesData.lanes) {
    const memberIds = lanesData.memberIdsByLaneId.get(lane.id) ?? []
    const people: SwimLanePerson[] = []
    for (const id of memberIds) {
      const p = byId.get(id)
      if (p) {
        people.push(p)
        seen.add(id)
      }
    }
    if (people.length > 0) out.push({ laneId: lane.id, label: lane.name, people })
  }
  const rest = visiblePeople.filter((p) => !seen.has(p.userId))
  if (rest.length > 0) out.push({ laneId: null, label: SWIM_LANE_EVERYONE_ELSE_LABEL, people: rest })
  return out
}

/** True when `query` (already lowercased/trimmed) matches the person's lane name. */
export function personMatchesLaneQuery(
  userId: string,
  lowerQuery: string,
  lanesData: DispatchSwimLanesData,
): boolean {
  if (!lowerQuery) return false
  const laneId = lanesData.laneIdByUserId.get(userId)
  if (!laneId) return false
  const lane = lanesData.lanes.find((l) => l.id === laneId)
  return lane != null && lane.name.toLowerCase().includes(lowerQuery)
}

export type SwimLaneManpowerRow = {
  /** null for the "Everyone else" tail. */
  laneId: string | null
  label: string
  personHours: number
  distinctPeople: number
}

/**
 * Lane-scoped Expected Manpower breakdown: one row per lane that has scheduled
 * person-hours (lane order), plus an "Everyone else" tail for hours from people
 * outside every lane. Returns [] when there are no lanes configured — the
 * caller hides the breakdown entirely then.
 */
export function summarizeExpectedManpowerByLane(
  rows: Array<{ assigneeUserId: string; personHours: number }>,
  lanesData: DispatchSwimLanesData,
): SwimLaneManpowerRow[] {
  if (lanesData.lanes.length === 0) return []
  const hoursByLane = new Map<string | null, number>()
  const peopleByLane = new Map<string | null, Set<string>>()
  for (const r of rows) {
    const laneId = lanesData.laneIdByUserId.get(r.assigneeUserId) ?? null
    hoursByLane.set(laneId, (hoursByLane.get(laneId) ?? 0) + r.personHours)
    let set = peopleByLane.get(laneId)
    if (!set) {
      set = new Set()
      peopleByLane.set(laneId, set)
    }
    set.add(r.assigneeUserId)
  }
  const out: SwimLaneManpowerRow[] = []
  for (const lane of lanesData.lanes) {
    const people = peopleByLane.get(lane.id)
    if (!people || people.size === 0) continue
    out.push({
      laneId: lane.id,
      label: lane.name,
      personHours: hoursByLane.get(lane.id) ?? 0,
      distinctPeople: people.size,
    })
  }
  const restPeople = peopleByLane.get(null)
  if (restPeople && restPeople.size > 0) {
    out.push({
      laneId: null,
      label: SWIM_LANE_EVERYONE_ELSE_LABEL,
      personHours: hoursByLane.get(null) ?? 0,
      distinctPeople: restPeople.size,
    })
  }
  return out
}
