import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildCrewMapFromJobsAndBidRows, type MergedCrewMapRow } from '../utils/crewAssignments'
import type { CrewJobAssignment, CrewBidAssignment } from '../utils/teamLabor'

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    days.push(d.toLocaleDateString('en-CA'))
    d.setDate(d.getDate() + 1)
  }
  return days
}

/**
 * Owns the crew-job map data layer for the People page Hours/Draft-Payroll views:
 * the `${work_date}:${person_name}` -> MergedCrewMapRow state plus the two loaders
 * that populate it. The parent keeps the orchestration effects (tab/pay gating) and
 * calls the returned loaders. `loadCrewJobsRef` mirrors the Hours-range loader for the
 * modal save callbacks, and `draftPayrollCrewMergeFetchIdRef` is returned so the parent's
 * draft-payroll cleanup can invalidate an in-flight merge.
 */
export function useCrewJobMap(hoursDateStart: string, hoursDateEnd: string) {
  const [crewJobsByDatePerson, setCrewJobsByDatePerson] = useState<Record<string, MergedCrewMapRow>>({})
  const loadCrewJobsRef = useRef<() => void>()
  const draftPayrollCrewMergeFetchIdRef = useRef(0)

  function loadCrewJobsForHoursRange() {
    const days = getDaysInRange(hoursDateStart, hoursDateEnd)
    if (days.length === 0) return
    void Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').in('work_date', days),
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').in('work_date', days),
    ]).then(([jobsRes, bidsRes]) => {
      const jobsRows = (jobsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        job_assignments: CrewJobAssignment[]
      }>
      const bidsRows = (bidsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        bid_assignments: CrewBidAssignment[]
      }>
      setCrewJobsByDatePerson(buildCrewMapFromJobsAndBidRows(jobsRows, bidsRows))
    })
  }

  /** Merges crew rows for Draft Payroll review; Hours tab loader still replaces its range only. */
  function mergeCrewJobsForDateRange(periodStart: string, periodEnd: string) {
    if (periodStart > periodEnd) return
    const days = getDaysInRange(periodStart, periodEnd)
    if (days.length === 0) return
    const fetchId = ++draftPayrollCrewMergeFetchIdRef.current
    void Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').in('work_date', days),
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').in('work_date', days),
    ]).then(([jobsRes, bidsRes]) => {
      if (fetchId !== draftPayrollCrewMergeFetchIdRef.current) return
      const jobsRows = (jobsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        job_assignments: CrewJobAssignment[]
      }>
      const bidsRows = (bidsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        bid_assignments: CrewBidAssignment[]
      }>
      const partial = buildCrewMapFromJobsAndBidRows(jobsRows, bidsRows)
      setCrewJobsByDatePerson((prev) => ({ ...prev, ...partial }))
    })
  }
  loadCrewJobsRef.current = loadCrewJobsForHoursRange

  return {
    crewJobsByDatePerson,
    loadCrewJobsForHoursRange,
    mergeCrewJobsForDateRange,
    loadCrewJobsRef,
    draftPayrollCrewMergeFetchIdRef,
  }
}
