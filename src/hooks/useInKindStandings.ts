import { useEffect, useState } from 'react'
import type { InKindStanding } from '../lib/inKind/inKindChip'
import { IN_KIND_CHANGED_EVENT } from '../lib/inKind/inKindCreditsDue'
import { dropInKindStandings, loadInKindStandings } from '../lib/inKind/inKindStandingIo'

const NONE: ReadonlyMap<string, InKindStanding> = new Map()

/**
 * Each customer with an open in kind deal, by customer id (punch list #301, mock-up 2). The deals are the office's to
 * read, so anyone else gets nothing and no read is made. A failed read gives nothing too: the chip is a reminder, and
 * a screen never waits on it. It reads again when a deal changes.
 */
export function useInKindStandings(enabled: boolean): ReadonlyMap<string, InKindStanding> {
  const [standings, setStandings] = useState<ReadonlyMap<string, InKindStanding>>(NONE)
  useEffect(() => {
    if (!enabled) {
      setStandings(NONE)
      return
    }
    let live = true
    const read = () => {
      loadInKindStandings()
        .then((m) => {
          if (live) setStandings(m)
        })
        .catch(() => {
          if (live) setStandings(NONE)
        })
    }
    const onChanged = () => {
      dropInKindStandings()
      read()
    }
    read()
    window.addEventListener(IN_KIND_CHANGED_EVENT, onChanged)
    return () => {
      live = false
      window.removeEventListener(IN_KIND_CHANGED_EVENT, onChanged)
    }
  }, [enabled])
  return standings
}
