import { useEffect, useMemo, useState } from 'react'
import { SITE_BOX_COUNT_KEY, keepSiteBoxCount, keptSiteBoxCount, siteBoxCountIsStale } from '../lib/materials/siteBoxCount'
import { fetchSiteBoxCount } from '../lib/materials/siteBoxCountIo'

function readKept(jobId: string): { n: number; at: number } | null {
  try {
    return keptSiteBoxCount(window.localStorage.getItem(SITE_BOX_COUNT_KEY), jobId)
  } catch {
    return null
  }
}

function writeKept(jobId: string, n: number, at: number): void {
  try {
    window.localStorage.setItem(SITE_BOX_COUNT_KEY, keepSiteBoxCount(window.localStorage.getItem(SITE_BOX_COUNT_KEY), jobId, n, at))
  } catch {
    // A phone that keeps nothing still reads the count each time.
  }
}

/**
 * How many live cages and boxes stand on a job's site, for the Job Mode card's Materials on site press. The count the
 * phone kept draws at once, so the press carries its number with no signal. One read when the card names the job, and
 * another when the page comes back to the front with a count five minutes old. A read that fails keeps the last count
 * and says nothing: the press works the same without its number. Null until a count is known.
 */
export function useSiteBoxCount(jobId: string | null | undefined, read: (jobId: string) => Promise<number> = fetchSiteBoxCount): number | null {
  const id = jobId || null
  // The kept count is read while drawing, so a job's number is on its first frame.
  const kept = useMemo(() => (id ? readKept(id) : null), [id])
  const [fresh, setFresh] = useState<{ forJob: string; n: number } | null>(null)

  useEffect(() => {
    if (!id) return
    let live = true
    let lastAt = readKept(id)?.at ?? null
    let reading = false
    const ask = () => {
      if (reading) return
      reading = true
      read(id)
        .then((n) => {
          lastAt = Date.now()
          writeKept(id, n, lastAt)
          if (live) setFresh({ forJob: id, n })
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
  return fresh?.forJob === id ? fresh.n : (kept?.n ?? null)
}
