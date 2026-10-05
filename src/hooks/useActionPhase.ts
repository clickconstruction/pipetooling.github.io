import { useCallback, useEffect, useRef, useState } from 'react'
import { DOWNLOADED_HOLD_MS, remainingHoldMs, type DownloadPhase } from '../lib/jobs/downloadFeedback'

/**
 * A button that says what it is doing (v2.4584): `run(work)` holds `busy` for
 * at least the minimum from the press, then `done` for two seconds, then
 * `idle`. `work` resolves true when the thing happened; false or a throw goes
 * straight back to `idle` (the caller shows why). `flashDone` is for work whose
 * busy state is drawn somewhere else: it shows `done`, then `idle`.
 */
export function useActionPhase(): { phase: DownloadPhase; run: (work: () => Promise<boolean>) => Promise<void>; flashDone: () => void } {
  const [phase, setPhase] = useState<DownloadPhase>('idle')
  const phaseRef = useRef<DownloadPhase>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const set = useCallback((p: DownloadPhase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const flashDone = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    set('done')
    timer.current = setTimeout(() => set('idle'), DOWNLOADED_HOLD_MS)
  }, [set])
  const run = useCallback(
    async (work: () => Promise<boolean>) => {
      if (phaseRef.current !== 'idle') return
      set('busy')
      const startedAt = Date.now()
      let ok = false
      try {
        ok = await work()
      } catch {
        ok = false
      }
      if (!ok) {
        set('idle')
        return
      }
      // The work is done; the button keeps saying so long enough to be read.
      timer.current = setTimeout(flashDone, remainingHoldMs(startedAt, Date.now()))
    },
    [flashDone, set],
  )
  return { phase, run, flashDone }
}
