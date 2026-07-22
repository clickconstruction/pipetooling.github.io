import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

/** Named, ordered, office-wide person groups ("crews") for Dispatch → People.
 * Strict lanes: the DB enforces at most one lane per person (unique index on
 * user_id), so assigning someone MOVES them. Read is universal (any signed-in
 * user); writes are limited to the schedule-dispatch edit cohort by RLS. */

export type DispatchSwimLane = {
  id: string
  name: string
  sort_order: number
}

export type DispatchSwimLanesData = {
  lanes: DispatchSwimLane[]
  /** lane id → member user ids (member sort order). */
  memberIdsByLaneId: Map<string, string[]>
  /** user id → lane id (strict lanes: at most one). */
  laneIdByUserId: Map<string, string>
}

export async function fetchDispatchSwimLanes(): Promise<{
  data: DispatchSwimLanesData
  error: string | null
}> {
  const empty: DispatchSwimLanesData = {
    lanes: [],
    memberIdsByLaneId: new Map(),
    laneIdByUserId: new Map(),
  }
  try {
    const [lanesRows, memberRows] = await Promise.all([
      withSupabaseRetry(
        async () =>
          await supabase
            .from('dispatch_swim_lanes' as never)
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true }),
        'fetchDispatchSwimLanes lanes',
      ),
      withSupabaseRetry(
        async () =>
          await supabase
            .from('dispatch_swim_lane_members' as never)
            .select('lane_id, user_id, sort_order')
            .order('sort_order', { ascending: true }),
        'fetchDispatchSwimLanes members',
      ),
    ])
    const lanes = ((lanesRows ?? []) as unknown as DispatchSwimLane[]).map((l) => ({
      id: l.id,
      name: l.name,
      sort_order: l.sort_order,
    }))
    const memberIdsByLaneId = new Map<string, string[]>()
    const laneIdByUserId = new Map<string, string>()
    for (const m of (memberRows ?? []) as unknown as Array<{ lane_id: string; user_id: string }>) {
      const arr = memberIdsByLaneId.get(m.lane_id) ?? []
      arr.push(m.user_id)
      memberIdsByLaneId.set(m.lane_id, arr)
      laneIdByUserId.set(m.user_id, m.lane_id)
    }
    return { data: { lanes, memberIdsByLaneId, laneIdByUserId }, error: null }
  } catch (e) {
    return { data: empty, error: formatErrorMessage(e) }
  }
}

export async function createDispatchSwimLane(
  name: string,
  sortOrder: number,
  createdBy: string,
): Promise<{ error: string | null }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Lane name is required.' }
  const { error } = await supabase
    .from('dispatch_swim_lanes' as never)
    .insert({ name: trimmed, sort_order: sortOrder, created_by: createdBy } as never)
  return { error: error?.message ?? null }
}

export async function renameDispatchSwimLane(
  laneId: string,
  name: string,
): Promise<{ error: string | null }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Lane name is required.' }
  const { error } = await supabase
    .from('dispatch_swim_lanes' as never)
    .update({ name: trimmed } as never)
    .eq('id', laneId)
  return { error: error?.message ?? null }
}

export async function deleteDispatchSwimLane(laneId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('dispatch_swim_lanes' as never).delete().eq('id', laneId)
  return { error: error?.message ?? null }
}

/** Persist a full ordering: sort_order = index in `orderedLaneIds`. */
export async function reorderDispatchSwimLanes(
  orderedLaneIds: string[],
): Promise<{ error: string | null }> {
  for (let i = 0; i < orderedLaneIds.length; i++) {
    const { error } = await supabase
      .from('dispatch_swim_lanes' as never)
      .update({ sort_order: i } as never)
      .eq('id', orderedLaneIds[i]!)
    if (error) return { error: error.message }
  }
  return { error: null }
}

/** Strict lanes: remove any existing membership first, then insert (a person
 * assigned to a new lane MOVES there). */
export async function assignUserToDispatchSwimLane(
  userId: string,
  laneId: string,
  sortOrder: number,
): Promise<{ error: string | null }> {
  const { error: delErr } = await supabase
    .from('dispatch_swim_lane_members' as never)
    .delete()
    .eq('user_id', userId)
  if (delErr) return { error: delErr.message }
  const { error } = await supabase
    .from('dispatch_swim_lane_members' as never)
    .insert({ lane_id: laneId, user_id: userId, sort_order: sortOrder } as never)
  return { error: error?.message ?? null }
}

export async function removeUserFromDispatchSwimLane(
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('dispatch_swim_lane_members' as never)
    .delete()
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}
