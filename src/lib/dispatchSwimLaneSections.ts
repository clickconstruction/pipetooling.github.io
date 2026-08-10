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

/**
 * Team identity accents — saturated, so they read in both themes. Blue and
 * amber are deliberately absent: blue means "selected" and amber means
 * "time conflict" wherever these sections render.
 */
const LANE_ACCENT_COLORS = ['#7c3aed', '#0d9488', '#db2777', '#16a34a']

/**
 * Stable accent color for a lane: hashed from the lane id, so a team keeps its
 * color across days, reorders, and surfaces. null for the "Everyone else"
 * tail — it stays neutral.
 */
export function swimLaneAccentColor(laneId: string | null): string | null {
  if (!laneId) return null
  let h = 0
  for (let i = 0; i < laneId.length; i++) h = (h * 31 + laneId.charCodeAt(i)) >>> 0
  return LANE_ACCENT_COLORS[h % LANE_ACCENT_COLORS.length] ?? null
}

/**
 * Filter lane sections for the Quick Assign people search: a query matching a
 * section's label keeps the whole team; otherwise the section narrows to the
 * people whose names match. Sections left with nobody are dropped. A blank
 * query returns the sections untouched.
 */
export function filterSwimLaneSectionsByQuery(
  sections: SwimLaneDisplaySection[],
  query: string,
): SwimLaneDisplaySection[] {
  const q = query.trim().toLowerCase()
  if (!q) return sections
  const out: SwimLaneDisplaySection[] = []
  for (const sec of sections) {
    if (sec.label.toLowerCase().includes(q)) {
      out.push(sec)
      continue
    }
    const people = sec.people.filter((p) => p.displayName.toLowerCase().includes(q))
    if (people.length > 0) out.push({ ...sec, people })
  }
  return out
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
