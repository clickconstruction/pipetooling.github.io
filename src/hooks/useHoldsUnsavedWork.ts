import { useEffect } from 'react'
import { holdUnsavedWork } from '../lib/unsavedWork'

/**
 * Say "this component holds unsaved work" while `active` (v2.3741). The auto-reload gate
 * (src/lib/autoReload.ts) refuses to reload while any hold is open. Tag inline editors —
 * modals are already covered by the open-dialog guard — with `dirty || saving`.
 */
export function useHoldsUnsavedWork(active: boolean, label: string): void {
  useEffect(() => {
    if (!active) return
    return holdUnsavedWork(label)
  }, [active, label])
}
