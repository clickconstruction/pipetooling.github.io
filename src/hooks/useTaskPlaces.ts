/**
 * The places of the tasks on a screen (punch list #328, PR 3): one read for every task shown, and
 * `placeFor(taskId)`. Re-reads when a task is saved, since the Edit window can set or move a place.
 * A read that fails leaves every card as it was before places existed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadTaskPlacesForItems } from '../lib/tasks/taskPlaceIo'
import type { TaskPlace } from '../lib/tasks/taskPlace'

export type TaskPlacesHost = {
  placeFor: (itemId: string | null | undefined) => TaskPlace | null
  /** How many of the asked tasks have a place. */
  count: number
  /** Read the places again: a place was just added from where someone stands (PR 8). */
  reload: () => Promise<void>
}

export function useTaskPlaces(itemIds: ReadonlyArray<string>): TaskPlacesHost {
  const [places, setPlaces] = useState<Map<string, TaskPlace>>(new Map())
  const idsRef = useRef(itemIds)
  idsRef.current = itemIds
  const key = useMemo(() => [...new Set(itemIds)].sort().join(','), [itemIds])

  const reload = useCallback(async () => {
    setPlaces(await loadTaskPlacesForItems(idsRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    let cancelled = false
    void loadTaskPlacesForItems(idsRef.current).then((next) => {
      if (!cancelled) setPlaces(next)
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
  return useMemo(() => ({ placeFor, count: places.size, reload }), [placeFor, places, reload])
}
