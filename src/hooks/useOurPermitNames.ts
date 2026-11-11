import { useEffect, useRef, useState } from 'react'
import { NO_OUR_KEYS, ourNameKeys, type OurNameKeys } from '../lib/research/ourNames'
import { loadOurNames, onOurNamesChanged } from '../lib/research/ourNamesIo'

/**
 * The names that are us on a plumbing permit (punch list #307), as the keys a bid's permit lines
 * compare on. Empty while it reads, when the read fails and when `enabled` is off: the lines
 * then read as they did before the list existed, which is still true, so the failure needs no
 * words of its own. A save on Settings → Company reads it again.
 */
export function useOurPermitNames(enabled: boolean = true): OurNameKeys {
  const [keys, setKeys] = useState<OurNameKeys>(NO_OUR_KEYS)
  const shown = useRef<OurNameKeys>(NO_OUR_KEYS)
  useEffect(() => {
    let live = true
    // An empty list is the one shared empty set, so a read that finds nothing draws nothing again.
    const show = (next: OurNameKeys) => {
      const value = next.size === 0 ? NO_OUR_KEYS : next
      if (!live || value === shown.current) return
      shown.current = value
      setKeys(value)
    }
    if (!enabled) {
      show(NO_OUR_KEYS)
      return
    }
    const read = () => {
      loadOurNames()
        .then((ours) => show(ourNameKeys(ours)))
        .catch(() => show(NO_OUR_KEYS))
    }
    read()
    const off = onOurNamesChanged(read)
    return () => {
      live = false
      off()
    }
  }, [enabled])
  return keys
}
