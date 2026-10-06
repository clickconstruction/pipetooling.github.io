import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchNoticeReleases } from '../lib/jobs/lienNoticeReleaseIo'
import type { NoticeRelease } from '../lib/jobs/lienNoticeRelease'

/**
 * The conditional releases the Lien desk's drafts point at (v2.4729), by row id: the pane's
 * preview page and the run's packet read them. A failed read answers an empty map — the desk
 * then draws no release page, never an error. `reload` re-reads after a tick.
 */
export function useNoticeReleases(ids: readonly string[], enabled = true): { byId: ReadonlyMap<string, NoticeRelease>; loaded: boolean; reload: () => void } {
  const idsKey = useMemo(() => [...new Set(ids.filter(Boolean))].sort().join(','), [ids])
  const [byId, setById] = useState<ReadonlyMap<string, NoticeRelease>>(() => new Map())
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled || !idsKey) {
      setById(new Map())
      setLoaded(enabled)
      return
    }
    let live = true
    setLoaded(false)
    fetchNoticeReleases(idsKey.split(','))
      .then((m) => {
        if (!live) return
        setById(m)
        setLoaded(true)
      })
      .catch(() => {
        if (!live) return
        setById(new Map())
        setLoaded(true)
      })
    return () => {
      live = false
    }
  }, [idsKey, enabled, tick])

  return { byId, loaded, reload }
}
