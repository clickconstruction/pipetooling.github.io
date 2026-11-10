import { useEffect, useState } from 'react'
import type { InKindCostLine } from '../lib/inKind/inKindCost'
import { IN_KIND_CHANGED_EVENT } from '../lib/inKind/inKindCreditsDue'
import { loadInKindCostLinesForJob } from '../lib/inKind/inKindIo'

const NONE: InKindCostLine[] = []

/**
 * The in-kind lines the office put on a job (punch list #301, PR 4): a material cost no card and no supply house bill
 * carries. Empty while it reads, with no job, on a refused read and for anyone who is not the office. Reads again when
 * a line changes anywhere in the app.
 */
export function useJobInKindCost(jobId: string | null, load: (jobId: string) => Promise<InKindCostLine[]> = loadInKindCostLinesForJob): { lines: InKindCostLine[] } {
  const [lines, setLines] = useState<InKindCostLine[]>(NONE)

  useEffect(() => {
    if (!jobId) {
      setLines(NONE)
      return
    }
    let live = true
    const read = () => {
      load(jobId)
        .then((rows) => {
          if (live) setLines(rows)
        })
        .catch(() => {
          if (live) setLines(NONE)
        })
    }
    read()
    window.addEventListener(IN_KIND_CHANGED_EVENT, read)
    return () => {
      live = false
      window.removeEventListener(IN_KIND_CHANGED_EVENT, read)
    }
  }, [jobId, load])

  return { lines }
}
