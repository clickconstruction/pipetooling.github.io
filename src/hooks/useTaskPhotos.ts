/**
 * Task cards: the photos of the cards on a screen (punch list #273, PR 4b). One read for every card shown, the signed
 * thumbnails for the bucket copies, `photosFor(instance)`, and `add` so a shot just sent shows at once. Re-reads on
 * `task-photo-added`, the event the sheets dispatch after a send, so a card on another screen catches up.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadTaskPhotos, taskPhotoPreviewUrls, type TaskPhotoRow } from '../lib/photos/taskPhotosIo'
import { sortTaskPhotos } from '../lib/taskPhotos'

export type TaskPhotoView = TaskPhotoRow & { previewUrl: string | null }

export type TaskPhotosHost = {
  photosFor: (instanceId: string) => TaskPhotoView[]
  add: (row: TaskPhotoRow) => void
  reload: () => Promise<void>
}

export const TASK_PHOTO_ADDED_EVENT = 'task-photo-added'

export function useTaskPhotos(instanceIds: ReadonlyArray<string>): TaskPhotosHost {
  const [rows, setRows] = useState<TaskPhotoRow[]>([])
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const idsRef = useRef(instanceIds)
  idsRef.current = instanceIds
  const key = useMemo(() => [...instanceIds].sort().join(','), [instanceIds])

  const reload = useCallback(async () => {
    const ids = idsRef.current
    if (ids.length === 0) {
      setRows([])
      return
    }
    try {
      const next = await loadTaskPhotos(ids)
      setRows(next)
      setUrls(await taskPhotoPreviewUrls(next.map((r) => r.storage_path ?? '').filter(Boolean)))
    } catch {
      // The strip draws nothing it cannot read; the card stands.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const on = () => void reload()
    window.addEventListener(TASK_PHOTO_ADDED_EVENT, on)
    return () => window.removeEventListener(TASK_PHOTO_ADDED_EVENT, on)
  }, [reload])

  const add = useCallback((row: TaskPhotoRow) => {
    setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)])
    if (row.storage_path) {
      void taskPhotoPreviewUrls([row.storage_path]).then((m) => setUrls((prev) => new Map([...prev, ...m])))
    }
  }, [])

  const photosFor = useCallback(
    (instanceId: string): TaskPhotoView[] => sortTaskPhotos(rows.filter((r) => r.instance_id === instanceId)).map((r) => ({ ...r, previewUrl: (r.storage_path && urls.get(r.storage_path)) || null })),
    [rows, urls],
  )

  return { photosFor, add, reload }
}
