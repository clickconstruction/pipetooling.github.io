import { useEffect, useState } from 'react'
import { fetchJobMaterialsCostSnapshot, type JobMaterialsCostSnapshot } from '../lib/fetchJobMaterialsCostSnapshot'

/**
 * @param refreshKey Increment (e.g. after job save) to refetch snapshot for the same jobId.
 */
export function useJobMaterialsCostSnapshot(jobId: string | null, enabled: boolean, refreshKey = 0) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<JobMaterialsCostSnapshot | null>(null)

  useEffect(() => {
    if (!enabled || !jobId) {
      setLoading(false)
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchJobMaterialsCostSnapshot(jobId)
      .then((snap) => {
        if (!cancelled) {
          setData(snap)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [jobId, enabled, refreshKey])

  return { loading, data }
}
