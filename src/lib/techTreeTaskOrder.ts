import { arrayMove } from '@dnd-kit/sortable'

/** Prefix for useDroppable id when a group has no tasks. */
export const techTreeEmptyGroupDropId = (groupId: string) => `__empty__${groupId}`

export const isTechTreeEmptyGroupDropId = (id: string) => id.startsWith('__empty__')

export const techTreeGroupIdFromEmptyDropId = (id: string) => id.slice('__empty__'.length)

export type TechTreeTaskIdRow = { id: string; group_id: string; sort_index: number }

/**
 * Build ordered task id lists per group (by sort_index, then id).
 */
export function orderedTaskIdsByGroup(
  tasks: ReadonlyArray<TechTreeTaskIdRow>,
  groupOrder: ReadonlyArray<string>,
): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const gid of groupOrder) m.set(gid, [])
  const byG = new Map<string, TechTreeTaskIdRow[]>()
  for (const t of tasks) {
    const list = byG.get(t.group_id) ?? []
    list.push(t)
    byG.set(t.group_id, list)
  }
  for (const [gid, list] of byG) {
    if (!m.has(gid)) continue
    const sorted = [...list].sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id))
    m.set(
      gid,
      sorted.map((t) => t.id),
    )
  }
  return m
}

/**
 * Returns update rows to persist after a drag, or null if nothing to do.
 */
export function computeTaskReorderUpdates(args: {
  activeId: string
  overId: string
  taskById: ReadonlyMap<string, TechTreeTaskIdRow>
  orderedIdsByGroup: ReadonlyMap<string, string[]>
  allGroupIds: string[]
}): { id: string; group_id: string; sort_index: number }[] | null {
  const { activeId, overId, taskById, orderedIdsByGroup, allGroupIds } = args
  if (activeId === overId) return null
  if (isTechTreeEmptyGroupDropId(overId)) {
    const targetG = techTreeGroupIdFromEmptyDropId(overId)
    const t = taskById.get(activeId)
    if (!t) return null
    const newMap = new Map(orderedIdsByGroup)
    const fromList = [...(newMap.get(t.group_id) ?? [])]
    const fromIdx = fromList.indexOf(activeId)
    if (fromIdx < 0) return null
    fromList.splice(fromIdx, 1)
    newMap.set(t.group_id, fromList)
    const toList = [...(newMap.get(targetG) ?? [])]
    toList.push(activeId)
    newMap.set(targetG, toList)
    return toUpdateRowsFromMaps(taskById, newMap, allGroupIds)
  }

  const a = taskById.get(activeId)
  const b = taskById.get(overId)
  if (!a || !b) return null

  if (a.group_id === b.group_id) {
    const g = a.group_id
    const ids = [...(orderedIdsByGroup.get(g) ?? [])]
    const oldIndex = ids.indexOf(activeId)
    const newIndex = ids.indexOf(overId)
    if (oldIndex < 0 || newIndex < 0) return null
    if (oldIndex === newIndex) return null
    const newIds = arrayMove(ids, oldIndex, newIndex)
    const newMap = new Map(orderedIdsByGroup)
    newMap.set(g, newIds)
    return toUpdateRowsFromMaps(taskById, newMap, allGroupIds)
  }

  const fromG = a.group_id
  const toG = b.group_id
  const newMap = new Map(orderedIdsByGroup)
  const fromList = [...(newMap.get(fromG) ?? [])]
  const toList = [...(newMap.get(toG) ?? [])]
  const fromIdx = fromList.indexOf(activeId)
  const toIdx = toList.indexOf(overId)
  if (fromIdx < 0 || toIdx < 0) return null
  fromList.splice(fromIdx, 1)
  toList.splice(toIdx, 0, activeId)
  newMap.set(fromG, fromList)
  newMap.set(toG, toList)
  return toUpdateRowsFromMaps(taskById, newMap, allGroupIds)
}

function toUpdateRowsFromMaps(
  taskById: ReadonlyMap<string, TechTreeTaskIdRow>,
  newMap: ReadonlyMap<string, string[]>,
  allGroupIds: string[],
): { id: string; group_id: string; sort_index: number }[] {
  const updates: { id: string; group_id: string; sort_index: number }[] = []
  for (const groupId of allGroupIds) {
    const ids = newMap.get(groupId) ?? []
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!
      const t = taskById.get(id)
      if (!t) continue
      const sort_index = i + 1
      if (t.group_id !== groupId || t.sort_index !== sort_index) {
        updates.push({ id, group_id: groupId, sort_index })
      }
    }
  }
  return updates
}
