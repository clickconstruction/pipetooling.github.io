/**
 * Field capacity under 60% three weeks running (Job Summary follow-up 3) — the
 * Needs You watch behind the Job Summary Capacity view. Loads ONLY the three
 * complete weeks before this one: the same day-ledger loader the Capacity
 * view reads (no overhead lead-in, so the field sessions of 21 days plus the
 * pool snapshot inputs) behind the same per-user sessionStorage cache, and
 * the field roster the view counts available hours from. Null while loading,
 * when the roster and the ledger cannot rate three weeks, or when any of the
 * three cleared the line; the hook reports null on error so the card stays
 * quiet. Refreshes when a clock session changes.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadJobDayLedger } from '../lib/jobs/loadJobDayLedger'
import { loadJobDayLedgerCached } from '../lib/jobs/jobDayLedgerSessionCache'
import { buildCapacitySeries, capacityNudgeWindow, capacityUnderStreak, type CapacityPerson, type CapacityUnderStreak } from '../lib/jobs/jobSummaryCapacity'
import { todayYmdInAppTz } from '../utils/dateUtils'

export function useCapacityUnderNudge(enabled: boolean, userId: string | null | undefined): { streak: CapacityUnderStreak | null } {
  const [streak, setStreak] = useState<CapacityUnderStreak | null>(null)
  const load = useCallback(async () => {
    if (!enabled || !userId) {
      setStreak(null)
      return
    }
    try {
      const { startYmd, endYmd } = capacityNudgeWindow(todayYmdInAppTz())
      const [ledger, roster] = await Promise.all([
        loadJobDayLedgerCached({ userId, startYmd, endYmd, load: () => loadJobDayLedger({ startYmd, endYmd, leadDays: 0 }) }),
        supabase
          .from('people')
          .select('id, kind, start_date, end_date, archived_at')
          .then(({ data, error }) => (error ? null : ((data ?? []) as CapacityPerson[]))),
      ])
      if (!ledger) {
        setStreak(null)
        return
      }
      setStreak(capacityUnderStreak(buildCapacitySeries({ ledger, people: roster })))
    } catch {
      setStreak(null)
    }
  }, [enabled, userId])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener('clock-session-changed', onChanged)
    return () => window.removeEventListener('clock-session-changed', onChanged)
  }, [load])
  return { streak }
}
