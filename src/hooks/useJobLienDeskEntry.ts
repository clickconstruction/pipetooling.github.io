import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { useLienDeskData } from './useLienDeskData'
import { isStagesOfficeRole } from '../lib/jobs/stagesRoleGates'
import { lienWindowDeskEntryFor, type LienWindowDeskEntry } from '../lib/jobs/lienWindowDeskEntry'
import { readLienLeaderName } from '../lib/jobs/lienLeaderNameIo'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'

/**
 * One job's place on the Lien desk, for an opener of the Lien window that holds no desk (punch list #335, Also
 * seen): the job window's Documents tab. The desk is read only while the window is open, in the light form the
 * Pipeline reads, and only for the office roles that may read it. Everyone else, and a closed window, read
 * nothing and get nulls, so the header reads as it did. The leader's name is the one the desk's rows print.
 */
export function useJobLienDeskEntry(job: { id: string; master_user_id?: string | null } | null | undefined, open: boolean): LienWindowDeskEntry & { deskLeader: string; refetch: () => void } {
  const { role } = useAuth()
  const reads = open && job != null && isStagesOfficeRole(role)
  const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
  const { data, refetch } = useLienDeskData(reads, todayYmd, { light: true })
  const jobId = job?.id ?? null
  const entry = useMemo(() => lienWindowDeskEntryFor(reads ? data : null, jobId), [reads, data, jobId])

  const leaderId = reads ? (job?.master_user_id ?? null) : null
  const [leader, setLeader] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    if (!leaderId) return
    let cancelled = false
    void readLienLeaderName(leaderId).then((name) => {
      if (!cancelled) setLeader({ id: leaderId, name })
    })
    return () => {
      cancelled = true
    }
  }, [leaderId])

  return { ...entry, deskLeader: leaderId && leader?.id === leaderId ? leader.name : '', refetch }
}
