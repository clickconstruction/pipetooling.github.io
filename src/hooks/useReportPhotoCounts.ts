import { useEffect, useRef, useState } from 'react'
import { idsToRead } from '../lib/photos/reportPhotoCounts'
import { loadReportPhotoCounts } from '../lib/photos/reportPhotosIo'

/**
 * The photo count of every report in a list (punch list #229, PR 3): one read for the ids the list does not hold
 * yet, never one a row. A list that grows (a page of reports, a thread that loads more) reads only its new ids; a
 * read that fails leaves those ids without a badge and never throws, since the words of a report matter more than
 * the count of its pictures. The map is keyed by report id; a report with no photos is absent.
 *
 * The list is keyed by its set of ids, not their order, and a read's answer is kept even when the list re-keys while
 * it is out: the counts are by id, so a stale read is still true (the live walk of 2026-11-01 found the Reports tab
 * re-keying under the first read, which left every row without its badge).
 */
export function useReportPhotoCounts(ids: ReadonlyArray<string>): ReadonlyMap<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map())
  const askedRef = useRef<Set<string>>(new Set())
  const key = Array.from(new Set(ids.filter(Boolean))).sort().join('\u0001')
  useEffect(() => {
    const fresh = idsToRead(ids, counts, askedRef.current)
    if (fresh.length === 0) return
    for (const id of fresh) askedRef.current.add(id)
    loadReportPhotoCounts(fresh).then(
      (found) => {
        if (found.size === 0) return
        setCounts((prev) => {
          const next = new Map(prev)
          for (const [id, n] of found) next.set(id, n)
          return next
        })
      },
      () => {
        // The badge is a courtesy: a read that fails draws none, and the ids are asked again on the next list.
        for (const id of fresh) askedRef.current.delete(id)
      },
    )
    // The ids are the message; their array's identity and order are not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return counts
}
