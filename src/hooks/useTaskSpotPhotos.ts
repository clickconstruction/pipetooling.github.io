/**
 * The giver's photos of the spot for the tasks on a screen (punch list #328, PR 6): one read of the
 * paths, one signing, and `urlFor(taskId)`. Re-reads when a task is saved. A photo that cannot be
 * read or signed is no photo, and the card is the card it was.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadTaskSpotPhotoPathsForItems, taskSpotPhotoUrls } from '../lib/tasks/taskSpotPhotoIo'

export type TaskSpotPhotosHost = { urlFor: (itemId: string | null | undefined) => string | null }

async function read(itemIds: ReadonlyArray<string>): Promise<Map<string, string>> {
  const paths = await loadTaskSpotPhotoPathsForItems(itemIds)
  if (paths.size === 0) return new Map()
  const urls = await taskSpotPhotoUrls([...paths.values()])
  const out = new Map<string, string>()
  for (const [itemId, path] of paths) {
    const url = urls.get(path)
    if (url) out.set(itemId, url)
  }
  return out
}

export function useTaskSpotPhotos(itemIds: ReadonlyArray<string>): TaskSpotPhotosHost {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const idsRef = useRef(itemIds)
  idsRef.current = itemIds
  const key = useMemo(() => [...new Set(itemIds)].sort().join(','), [itemIds])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void read(idsRef.current).then((next) => {
        if (!cancelled) setUrls(next)
      })
    }
    load()
    window.addEventListener('checklist-item-saved', load)
    return () => {
      cancelled = true
      window.removeEventListener('checklist-item-saved', load)
    }
  }, [key])

  const urlFor = useCallback((itemId: string | null | undefined) => (itemId ? urls.get(itemId) ?? null : null), [urls])
  return useMemo(() => ({ urlFor }), [urlFor])
}
