import { useEffect, useRef, useState } from 'react'
import { fetchClockSessionsForJobLedger, type JobDetailClockSessionRow } from '../lib/fetchClockSessionsForJobLedger'
import {
  fetchJobScheduleBlocksForJob,
  type JobScheduleBlockWithAssigneeName,
} from '../lib/jobScheduleBlocks'

const DISPLAY_CAP = 100

export function useJobDetailScheduleAndSessions(
  open: boolean,
  jobId: string | null | undefined,
  enabled: boolean,
): {
  loading: boolean
  error: string | null
  scheduleBlocks: JobScheduleBlockWithAssigneeName[]
  clockSessions: JobDetailClockSessionRow[]
  scheduleTruncated: boolean
  sessionsTruncated: boolean
} {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scheduleBlocks, setScheduleBlocks] = useState<JobScheduleBlockWithAssigneeName[]>([])
  const [clockSessions, setClockSessions] = useState<JobDetailClockSessionRow[]>([])
  const [scheduleTruncated, setScheduleTruncated] = useState(false)
  const [sessionsTruncated, setSessionsTruncated] = useState(false)
  const fetchGenRef = useRef(0)

  useEffect(() => {
    if (!open || !jobId || !enabled) {
      fetchGenRef.current += 1
      setLoading(false)
      setError(null)
      setScheduleBlocks([])
      setClockSessions([])
      setScheduleTruncated(false)
      setSessionsTruncated(false)
      return
    }

    const gen = ++fetchGenRef.current
    setLoading(true)
    setError(null)

    void (async () => {
      const [bRes, sRes] = await Promise.all([
        fetchJobScheduleBlocksForJob(jobId),
        fetchClockSessionsForJobLedger(jobId),
      ])
      if (gen !== fetchGenRef.current) return

      const errParts = [bRes.error, sRes.error].filter(Boolean) as string[]
      setError(errParts.length > 0 ? errParts.join(' ') : null)

      const bRaw = bRes.data
      setScheduleTruncated(bRaw.length > DISPLAY_CAP)
      setScheduleBlocks(bRaw.slice(0, DISPLAY_CAP))

      const sRaw = sRes.data
      setSessionsTruncated(sRaw.length > DISPLAY_CAP)
      setClockSessions(sRaw.slice(0, DISPLAY_CAP))

      setLoading(false)
    })()
  }, [open, jobId, enabled])

  return {
    loading,
    error,
    scheduleBlocks,
    clockSessions,
    scheduleTruncated,
    sessionsTruncated,
  }
}
