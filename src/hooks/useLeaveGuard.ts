/**
 * One way out of a window that holds typing (2026-10-03). `requestClose`: with nothing changed it
 * closes at once; with something changed it raises `asking`, and the window draws its question
 * (`LeaveQuestion` in `components/bids/SubmittalLeaveGuard.tsx`). Esc asks the same way, and
 * answers the question with Keep editing.
 */
import { useCallback, useEffect, useState } from 'react'

export type LeaveGuard = {
  /** The question is showing. */
  asking: boolean
  /** Every way out of the window: the backdrop, Cancel, ×, Esc. */
  requestClose: () => void
  /** Keep editing: the question goes away, the window stays. */
  keep: () => void
}

export function useLeaveGuard({ dirty, onClose, busy = false, paused = false }: { /** something in the window differs from what it opened with */ dirty: boolean; onClose: () => void; /** a save is running: the window holds */ busy?: boolean; /** another window is open over this one and owns Esc */ paused?: boolean }): LeaveGuard {
  const [asking, setAsking] = useState(false)
  const requestClose = useCallback(() => {
    if (busy) return
    if (dirty) setAsking(true)
    else onClose()
  }, [busy, dirty, onClose])
  useEffect(() => {
    if (paused) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      if (asking) setAsking(false)
      else requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [asking, paused, requestClose])
  return { asking: asking && dirty, requestClose, keep: () => setAsking(false) }
}
