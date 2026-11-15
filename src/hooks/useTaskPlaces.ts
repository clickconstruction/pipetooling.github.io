/**
 * The places of the tasks on a screen (punch list #328, PR 3): one read for every task shown, and
 * `placeFor(taskId)`. Re-reads when a task is saved, since the Edit window can set or move a place.
 * A read that fails leaves every card as it was before places existed.
 *
 * The same read brings the painted map of a task that has a map and no place (punch list #345):
 * `mapFor(taskId)`. A task with a place keeps its map on the place, as the way in.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadTaskWheresForItems, type TaskWheres } from '../lib/tasks/taskPlaceIo'
import type { TaskPlace } from '../lib/tasks/taskPlace'

export type TaskPlacesHost = {
  placeFor: (itemId: string | null | undefined) => TaskPlace | null
  /** The painted map of a task that has a map and no place: its id, or null. */
  mapFor: (itemId: string | null | undefined) => string | null
  /** How many of the asked tasks have a place. */
  count: number
  /** Read the places again: a place was just added from where someone stands (PR 8). */
  reload: () => Promise<void>
}

export function useTaskPlaces(itemIds: ReadonlyArray<string>): TaskPlacesHost {
  const [wheres, setWheres] = useState<TaskWheres>(() => ({ places: new Map(), maps: new Map() }))
  const { places, maps } = wheres
  const idsRef = useRef(itemIds)
  idsRef.current = itemIds
  const key = useMemo(() => [...new Set(itemIds)].sort().join(','), [itemIds])

  const reload = useCallback(async () => {
    setWheres(await loadTaskWheresForItems(idsRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    let cancelled = false
    void loadTaskWheresForItems(idsRef.current).then((next) => {
      if (!cancelled) setWheres(next)
    })
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    const on = () => void reload()
    window.addEventListener('checklist-item-saved', on)
    return () => window.removeEventListener('checklist-item-saved', on)
  }, [reload])

  const placeFor = useCallback((itemId: string | null | undefined) => (itemId ? places.get(itemId) ?? null : null), [places])
  const mapFor = useCallback((itemId: string | null | undefined) => (itemId ? maps.get(itemId) ?? null : null), [maps])
  return useMemo(() => ({ placeFor, mapFor, count: places.size, reload }), [placeFor, mapFor, places, reload])
}
