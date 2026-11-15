/**
 * Reads the painted map a task carries, once, for the card that shows it (punch list #345, "A map
 * on a task"). It reads again when a painted map changes, since Open the map lets the reader add a
 * place or a stroke. A map that is gone, or one this person may not open, is `gone`, and the card
 * draws nothing for it. A read that fails keeps what the card already shows.
 */
import { useEffect, useState } from 'react'
import { onPaintedMapsChanged } from '../lib/paintedMap/paintedMapDoor'
import { loadPaintedMap, type Landed, type PaintedMapWhole } from '../lib/paintedMap/paintedMapIo'

/** A task's painted map as its card holds it: not asked for, being read, read, or gone. */
export type TaskMapRead = { kind: 'none' } | { kind: 'reading' } | { kind: 'read'; whole: PaintedMapWhole } | { kind: 'gone' }

export function useTaskMapWhole(mapId: string | null | undefined, load: (mapId: string) => Promise<Landed<PaintedMapWhole | null>> = loadPaintedMap): TaskMapRead {
  const [read, setRead] = useState<{ mapId: string; whole: PaintedMapWhole | null } | null>(null)
  const [turn, setTurn] = useState(0)
  const id = mapId || null

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const failed = () => {
      if (!cancelled) setRead((was) => (was && was.mapId === id ? was : { mapId: id, whole: null }))
    }
    void load(id).then((res) => {
      if (cancelled) return
      if (res.ok) setRead({ mapId: id, whole: res.value })
      else failed()
    }, failed)
    return () => {
      cancelled = true
    }
  }, [id, load, turn])

  useEffect(() => {
    if (!id) return
    return onPaintedMapsChanged(() => setTurn((n) => n + 1))
  }, [id])

  if (!id) return { kind: 'none' }
  if (!read || read.mapId !== id) return { kind: 'reading' }
  return read.whole ? { kind: 'read', whole: read.whole } : { kind: 'gone' }
}
