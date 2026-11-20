import { useEffect, useMemo, useState } from 'react'
import { SITE_BOX_COUNT_KEY, keepSiteDoorFacts, keptSiteDoorFacts, siteBoxCountIsStale, type SiteDoorFacts } from '../lib/materials/siteBoxCount'
import { fetchSiteDoorFacts } from '../lib/materials/siteBoxCountIo'

function readKept(jobId: string): { facts: SiteDoorFacts; at: number } | null {
  try {
    return keptSiteDoorFacts(window.localStorage.getItem(SITE_BOX_COUNT_KEY), jobId)
  } catch {
    return null
  }
}

function writeKept(jobId: string, facts: SiteDoorFacts, at: number): void {
  try {
    window.localStorage.setItem(SITE_BOX_COUNT_KEY, keepSiteDoorFacts(window.localStorage.getItem(SITE_BOX_COUNT_KEY), jobId, facts, at))
  } catch {
    // A phone that keeps nothing still reads the facts each time.
  }
}

/**
 * What stands on a job's site, for the Job Mode card's Materials on site press: the live cages and boxes, the ones due
 * a count and the printed stickers waiting for a box. The facts the phone kept draw at once, so the press carries its
 * number with no signal. One read when the card names the job, and another when the page comes back to the front with
 * facts five minutes old. A read that fails keeps the last facts and says nothing: the press works the same without
 * them. Null until facts are known.
 */
export function useSiteDoorFacts(jobId: string | null | undefined, read: (jobId: string) => Promise<SiteDoorFacts> = fetchSiteDoorFacts): SiteDoorFacts | null {
  const id = jobId || null
  // The kept facts are read while drawing, so a job's number is on its first frame.
  const kept = useMemo(() => (id ? readKept(id) : null), [id])
  const [fresh, setFresh] = useState<{ forJob: string; facts: SiteDoorFacts } | null>(null)

  useEffect(() => {
    if (!id) return
    let live = true
    let lastAt = readKept(id)?.at ?? null
    let reading = false
    const ask = () => {
      if (reading) return
      reading = true
      read(id)
        .then((facts) => {
          lastAt = Date.now()
          writeKept(id, facts, lastAt)
          if (live) setFresh({ forJob: id, facts })
        })
        .catch(() => {})
        .finally(() => {
          reading = false
        })
    }
    ask()
    const onFront = () => {
      if (document.visibilityState === 'visible' && siteBoxCountIsStale(lastAt, Date.now())) ask()
    }
    document.addEventListener('visibilitychange', onFront)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onFront)
    }
  }, [id, read])

  if (!id) return null
  return fresh?.forJob === id ? fresh.facts : (kept?.facts ?? null)
}
