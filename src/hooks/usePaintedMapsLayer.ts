/**
 * The painted maps a layer draws (punch list #345, PR 6): one job's, or every map the reader can
 * open. Read when the layer is on, and again when a painted map is saved or thrown away. A failed
 * read is an empty layer and its reason: the map it sits on must never break on this.
 */
import { useCallback, useEffect, useState } from 'react'
import { onPaintedMapsChanged } from '../lib/paintedMap/paintedMapDoor'
import { loadPaintedMapsEvery, loadPaintedMapsFor } from '../lib/paintedMap/paintedMapIo'
import { paintedLayerMaps, type PaintedLayerMap } from '../lib/paintedMap/paintedMapLayer'

export function usePaintedMapsLayer(scope: { jobId: string } | 'every' | null, enabled: boolean): { maps: PaintedLayerMap[]; loaded: boolean; error: string | null } {
  const jobId = scope && scope !== 'every' ? scope.jobId : null
  const every = scope === 'every'
  const [state, setState] = useState<{ maps: PaintedLayerMap[]; loaded: boolean; error: string | null }>({ maps: [], loaded: false, error: null })

  const read = useCallback(async () => {
    if (!enabled || (!every && !jobId)) return
    const res = every ? await loadPaintedMapsEvery() : await loadPaintedMapsFor({ jobId })
    setState(res.ok ? { maps: paintedLayerMaps(res.value), loaded: true, error: null } : { maps: [], loaded: true, error: res.error })
  }, [enabled, every, jobId])

  useEffect(() => {
    if (!enabled) return
    void read()
    return onPaintedMapsChanged(() => void read())
  }, [enabled, read])

  return enabled ? state : { maps: [], loaded: false, error: null }
}
