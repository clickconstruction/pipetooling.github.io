import { useEffect, useState } from 'react'
import { loadRecordsStart } from '../lib/research/permitResearchIo'

/**
 * The day a city's permit records start (punch list #307), for the counts on Prospects → Permits.
 * Null while it reads and when the read fails: the lines then say "we can see" and claim no span,
 * which is still true, so the failure needs no words of its own. `refreshKey` reads it again
 * after a read back as history has moved the day.
 */
export function usePermitRecordsStart(city: string, refreshKey: number = 0): string | null {
  const [start, setStart] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadRecordsStart(city)
      .then((ymd) => {
        if (live) setStart(ymd)
      })
      .catch(() => {
        if (live) setStart(null)
      })
    return () => {
      live = false
    }
  }, [city, refreshKey])
  return start
}
