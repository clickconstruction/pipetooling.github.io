import { useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * The Lien desk's one press at a time (its own file since v2.7590, out of `LienDesk.tsx` as it stood). `run` takes a
 * press's name and its work: it refuses while another press is in flight, says the `done` words and has the desk
 * re-read when the work lands, and says `<name>: <reason>` when it throws. It answers whether the work landed, so
 * a window can close on a yes. `busy` deadens the desk's presses meanwhile; `busyRef` is the same fact for a timer
 * that fires between renders (the draft's autosave). `beforeRun` runs first, before the work.
 */
export function useLienDeskRunner({ onChanged, beforeRun }: { onChanged: () => void; beforeRun?: () => void }) {
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const run = async (label: string, fn: () => Promise<void>, done?: string): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    busyRef.current = true
    beforeRun?.()
    try {
      await fn()
      if (done) showToast(done, 'success')
      onChanged()
      return true
    } catch (e) {
      showToast(e instanceof Error && e.message ? `${label}: ${e.message}` : `${label} failed.`, 'error')
      return false
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }
  return { busy, busyRef, run }
}
