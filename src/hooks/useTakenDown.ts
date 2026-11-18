/**
 * Says whether the component has been taken off the screen.
 *
 * A read that outlives its component has nowhere to draw, and setting state then is not harmless
 * in a test run: once the test's page is gone React throws `window is not defined`, which fails a
 * whole build on a read that only landed late. A read asks this after each `await` and stops.
 *
 * The answer is one function that never changes, so it adds nothing to a dependency list. Where a
 * read belongs to one run of an effect, a `cancelled` flag in that effect is the simpler guard.
 * This is for a read more than one caller starts: the effect, a change heard elsewhere, a Retry.
 */
import { useCallback, useEffect, useRef } from 'react'

export function useTakenDown(): () => boolean {
  const gone = useRef(false)
  useEffect(() => {
    gone.current = false
    return () => {
      gone.current = true
    }
  }, [])
  return useCallback(() => gone.current, [])
}
