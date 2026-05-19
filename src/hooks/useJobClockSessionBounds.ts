import { useEffect, useRef, useState } from 'react'
import {
  fetchJobClockSessionBounds,
  type JobClockSessionBoundsRow,
} from '../lib/fetchJobClockSessionBounds'

const EMPTY_BOUNDS: JobClockSessionBoundsRow = {
  firstClockedInAt: null,
  firstUserName: null,
  lastClockedOutAt: null,
  lastUserName: null,
}

/**
 * Eagerly loads the earliest approved clock-in and latest approved closed clock-out
 * for a job. Used by Job Detail "Job Start" / "Last Work" rows.
 *
 * Refetches when `refreshKey` changes (e.g. after Edit Job save) so the rows stay
 * in sync with the cached `jobs_ledger.last_work_date` shown beside them.
 */
export function useJobClockSessionBounds(
  open: boolean,
  jobId: string | null | undefined,
  enabled: boolean,
  refreshKey: number = 0,
): {
  loading: boolean
  error: string | null
  bounds: JobClockSessionBoundsRow
} {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bounds, setBounds] = useState<JobClockSessionBoundsRow>(EMPTY_BOUNDS)
  const fetchGenRef = useRef(0)

  useEffect(() => {
    if (!open || !jobId || !enabled) {
      fetchGenRef.current += 1
      setLoading(false)
      setError(null)
      setBounds(EMPTY_BOUNDS)
      return
    }

    const gen = ++fetchGenRef.current
    setLoading(true)
    setError(null)

    void (async () => {
      const { data, error: fetchError } = await fetchJobClockSessionBounds(jobId)
      if (gen !== fetchGenRef.current) return
      setBounds(data)
      setError(fetchError)
      setLoading(false)
    })()
  }, [open, jobId, enabled, refreshKey])

  return { loading, error, bounds }
}
