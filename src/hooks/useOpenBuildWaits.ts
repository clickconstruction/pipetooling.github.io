/**
 * The Build waits that are not lifted, by job (punch list #192, write A, v2.8723), for the chip on a job's Stages
 * card. One small read when the board mounts, under the reader's own rights: whoever reads a job reads its wait. It
 * reads again when a wait is marked or lifted anywhere on the page (`BUILD_WAITS_CHANGED_EVENT`). A read the database
 * refuses leaves the map empty, so the board draws as it did before.
 */
import { useEffect, useState } from 'react'
import type { BuildWait } from '../lib/bridge/build/buildWaits'
import { BUILD_WAITS_CHANGED_EVENT, buildWaitsIo, type BuildWaitsIo } from '../lib/bridge/build/buildWaitsIo'

const NONE: ReadonlyMap<string, BuildWait> = new Map()

export function useOpenBuildWaits(enabled: boolean, io: Pick<BuildWaitsIo, 'loadOpen'> = buildWaitsIo): ReadonlyMap<string, BuildWait> {
  const [byJobId, setByJobId] = useState<ReadonlyMap<string, BuildWait>>(NONE)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const read = () => {
      void io.loadOpen().then((waits) => {
        if (!cancelled) setByJobId(waits && waits.length > 0 ? new Map(waits.map((w) => [w.jobId, w])) : NONE)
      })
    }
    read()
    window.addEventListener(BUILD_WAITS_CHANGED_EVENT, read)
    return () => {
      cancelled = true
      window.removeEventListener(BUILD_WAITS_CHANGED_EVENT, read)
    }
  }, [enabled, io])
  return enabled ? byJobId : NONE
}
