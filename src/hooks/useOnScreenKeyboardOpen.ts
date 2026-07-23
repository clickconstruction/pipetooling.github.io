import { useEffect, useState } from 'react'
import { isOnScreenKeyboardOccluding } from '../lib/onScreenKeyboardOcclusion'

/**
 * True while the mobile on-screen keyboard is occluding the page (see
 * `src/lib/onScreenKeyboardOcclusion.ts` for the detection rule). Always false
 * on browsers without `window.visualViewport`. Used to hide fixed bottom
 * chrome (Dispatch/Job Mode footer) while typing, native-app style.
 */
export function useOnScreenKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setOpen(isOnScreenKeyboardOccluding(window.innerHeight, vv.height, vv.scale))
    }
    update()
    vv.addEventListener('resize', update)
    window.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return open
}
