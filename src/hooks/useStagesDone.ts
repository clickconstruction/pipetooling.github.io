import { useEffect, useState } from 'react'
import { stagesDone, type StagesDone } from '../lib/needsYou/stagesDone'
import { stagesDoneIo, type StagesDoneIo } from '../lib/needsYou/stagesDoneIo'

/**
 * The stages that read 100% and sit on no bill (punch list #397, PR 7), for the office's Needs you
 * line. Null while it reads and on a refused read, so the card stays quiet.
 */
export function useStagesDone(enabled: boolean, io: StagesDoneIo = stagesDoneIo): { done: StagesDone | null } {
  const [done, setDone] = useState<StagesDone | null>(null)
  useEffect(() => {
    if (!enabled) {
      setDone(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { jobs, lines } = await io.fetchSources()
        if (!cancelled) setDone(stagesDone(jobs, lines))
      } catch {
        if (!cancelled) setDone(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, io])
  return { done }
}
