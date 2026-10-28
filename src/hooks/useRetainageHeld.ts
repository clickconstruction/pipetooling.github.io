import { useCallback, useEffect, useRef, useState } from 'react'
import { buildRetainageHeldSection, type RetainageHeldSection } from '../lib/ar/retainageHeld'
import { loadRetainageHeldRows } from '../lib/ar/retainageHeldIo'
import { assembleRetainageHeld, type RetainageJobFacts } from '../lib/ar/retainageHeldRows'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { formatErrorMessage } from '../utils/errorHandling'

/**
 * AR's Retainage held section (punch list #165, PR 2): the kernel's section over the three
 * reads, built when the window opens and again when `refreshKey` changes (the window's billed
 * rows, which the page refetches after a deposit is applied, so a paid release clears its line).
 */
export function useRetainageHeld(open: boolean, refreshKey: unknown): {
  section: RetainageHeldSection | null
  facts: Map<string, RetainageJobFacts>
  loading: boolean
  /** Why the read failed, in the office's words; null while it has not. */
  error: string | null
  reload: () => void
} {
  const [section, setSection] = useState<RetainageHeldSection | null>(null)
  const [facts, setFacts] = useState<Map<string, RetainageJobFacts>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!open) return
    const seq = ++seqRef.current
    setLoading(true)
    void (async () => {
      try {
        const rows = await loadRetainageHeldRows()
        if (seq !== seqRef.current) return
        const { inputs, facts: nextFacts } = assembleRetainageHeld(rows.jobs, rows.applications, rows.invoices)
        setSection(buildRetainageHeldSection(inputs, todayYmdInAppTz()))
        setFacts(nextFacts)
        setError(null)
      } catch (e) {
        if (seq !== seqRef.current) return
        setError(formatErrorMessage(e, 'The retainage held could not be read.'))
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    })()
  }, [open, refreshKey, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { section, facts, loading, error, reload }
}
