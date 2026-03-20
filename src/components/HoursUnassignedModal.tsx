import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import {
  type UnifiedAssignment,
  mergeToUnified,
  splitFromUnified,
  formatAssignmentLabel,
  type JobDetails,
  type BidDetails,
} from '../utils/crewAssignments'
import { getBidServiceTypeTag } from '../utils/unifiedJobBidSearch'

type CrewRow = { crew_lead_person_name: string | null; unifiedAssignments: UnifiedAssignment[] }
type HoursRow = { person_name: string; work_date: string; hours: number }
type PayConfigRow = { person_name: string; is_salary: boolean; show_in_cost_matrix: boolean; record_hours_but_salary: boolean }

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

type Props = {
  personName: string
  hoursDateStart: string
  hoursDateEnd: string
  onClose: () => void
  onSaved: () => void
  canEditCrewJobs?: boolean
}

export function HoursUnassignedModal({
  personName,
  hoursDateStart,
  hoursDateEnd,
  onClose,
  onSaved,
  canEditCrewJobs = true,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState('')
  const [draft, setDraft] = useState<CrewRow | null>(null)
  const [jobSearchOpen, setJobSearchOpen] = useState(false)
  const [jobSearchText, setJobSearchText] = useState('')
  const [jobSearchResults, setJobSearchResults] = useState<
    Array<
      | { type: 'job'; id: string; hcp_number: string; job_name: string; job_address: string }
      | { type: 'bid'; id: string; bid_number: string; project_name: string; address: string; service_type_name?: string }
    >
  >([])
  const [commonJobs, setCommonJobs] = useState<Array<{ id: string; job_id: string; hcp_number: string; job_name: string; job_address: string }>>([])
  const [commonJobsError, setCommonJobsError] = useState<string | null>(null)
  const [commonJobsEditMode, setCommonJobsEditMode] = useState(false)
  const [commonJobsSearchOpen, setCommonJobsSearchOpen] = useState(false)
  const [commonJobsSearchText, setCommonJobsSearchText] = useState('')
  const [commonJobsSearchResults, setCommonJobsSearchResults] = useState<Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>>([])
  const [officeJob, setOfficeJob] = useState<{ id: string; hcp_number: string; job_name: string; job_address: string } | null>(null)
  const [crewJobDetailsMap, setCrewJobDetailsMap] = useState<Record<string, JobDetails>>({})
  const [crewBidDetailsMap, setCrewBidDetailsMap] = useState<Record<string, BidDetails>>({})
  const [crewJobsByDatePerson, setCrewJobsByDatePerson] = useState<Record<string, CrewRow>>({})
  const [hoursDaysCorrect, setHoursDaysCorrect] = useState<Set<string>>(new Set())
  const [showPeople, setShowPeople] = useState<string[]>([])
  const [peopleHours, setPeopleHours] = useState<HoursRow[]>([])
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})

  const hoursDays = useMemo(() => getDaysInRange(hoursDateStart, hoursDateEnd), [hoursDateStart, hoursDateEnd])

  function getEffectiveHours(pName: string, workDate: string): number {
    const cfg = payConfig[pName]
    if (cfg?.is_salary && (cfg?.record_hours_but_salary ?? false)) {
      const row = peopleHours.find((h) => h.person_name === pName && h.work_date === workDate)
      return row?.hours ?? 0
    }
    if (cfg?.is_salary) {
      const day = new Date(workDate + 'T12:00:00').getDay()
      if (day === 0 || day === 6) return 0
      return 8
    }
    const row = peopleHours.find((h) => h.person_name === pName && h.work_date === workDate)
    return row?.hours ?? 0
  }

  function getEffectiveAssignmentsForDate(pName: string, workDate: string): UnifiedAssignment[] {
    const key = `${workDate}:${pName}`
    const row = crewJobsByDatePerson[key]
    if (!row) return []
    if (row.crew_lead_person_name) {
      const leadKey = `${workDate}:${row.crew_lead_person_name}`
      const leadRow = crewJobsByDatePerson[leadKey]
      return leadRow?.unifiedAssignments ?? []
    }
    return row.unifiedAssignments ?? []
  }

  function hasAssignmentsForDate(pName: string, workDate: string): boolean {
    const key = `${workDate}:${pName}`
    const row = crewJobsByDatePerson[key]
    if (!row) return false
    return !!(row.crew_lead_person_name || (row.unifiedAssignments?.length ?? 0) > 0)
  }

  function getAssignmentKey(a: UnifiedAssignment): string {
    return `${a.type}:${a.id}`
  }

  const unassignedDays = useMemo(
    () =>
      hoursDays.filter((d) => {
        if (!hoursDaysCorrect.has(d)) return false
        if (getEffectiveHours(personName, d) <= 0) return false
        return !hasAssignmentsForDate(personName, d)
      }),
    [hoursDays, hoursDaysCorrect, personName, crewJobsByDatePerson, peopleHours, payConfig]
  )

  const effectiveSelectedDay = (selectedDay && unassignedDays.includes(selectedDay) ? selectedDay : unassignedDays[0]) ?? ''
  const key = `${effectiveSelectedDay}:${personName}`
  const row = crewJobsByDatePerson[key] ?? { crew_lead_person_name: null, unifiedAssignments: [] }
  const draftRow = draft ?? row
  const hasCrewLead = !!draftRow.crew_lead_person_name
  const availableCrewLeads = showPeople.filter((p) => {
    if (p === personName) return false
    const assignments = getEffectiveAssignmentsForDate(p, effectiveSelectedDay)
    if (officeJob && assignments.some((a) => a.type === 'job' && a.id === officeJob.id)) return false
    return true
  })
  const jobsEditable = !hasCrewLead
  const crewEditable = !showPeople.some((p) => {
    const r = crewJobsByDatePerson[`${effectiveSelectedDay}:${p}`]
    return r?.crew_lead_person_name === personName
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [correctRes, hoursRes, configRes, jobsRes, bidsRes, officeRes] = await Promise.all([
        supabase.from('hours_days_correct').select('work_date').gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.from('people_hours').select('person_name, work_date, hours').eq('person_name', personName).gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.from('people_pay_config').select('person_name, is_salary, show_in_cost_matrix, record_hours_but_salary'),
        supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.from('people_crew_bids').select('work_date, person_name, crew_lead_person_name, bid_assignments').gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.rpc('get_jobs_ledger_office'),
      ])
      const correctDays = new Set((correctRes.data ?? []).map((r: { work_date: string }) => r.work_date))
      setHoursDaysCorrect(correctDays)
      setPeopleHours((hoursRes.data ?? []) as HoursRow[])
      const configRows = (configRes.data ?? []) as PayConfigRow[]
      const configMap: Record<string, PayConfigRow> = {}
      const showList: string[] = []
      for (const c of configRows) {
        configMap[c.person_name] = c
        if (c.person_name && (c.show_in_cost_matrix ?? false)) showList.push(c.person_name)
      }
      setPayConfig(configMap)
      setShowPeople(showList.sort())
      const jobsRows = (jobsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        crew_lead_person_name: string | null
        job_assignments: Array<{ job_id: string; pct: number }>
      }>
      const bidsRows = (bidsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        crew_lead_person_name: string | null
        bid_assignments: Array<{ bid_id: string; pct: number }>
      }>
      const jobsByKey: Record<string, { crew_lead: string | null; jobs: Array<{ job_id: string; pct: number }> }> = {}
      for (const r of jobsRows) {
        const k = `${r.work_date}:${r.person_name}`
        jobsByKey[k] = {
          crew_lead: r.crew_lead_person_name ?? null,
          jobs: Array.isArray(r.job_assignments) ? r.job_assignments : [],
        }
      }
      const bidsByKey: Record<string, { crew_lead: string | null; bids: Array<{ bid_id: string; pct: number }> }> = {}
      for (const r of bidsRows) {
        const k = `${r.work_date}:${r.person_name}`
        bidsByKey[k] = {
          crew_lead: r.crew_lead_person_name ?? null,
          bids: Array.isArray(r.bid_assignments) ? r.bid_assignments : [],
        }
      }
      const allKeys = new Set([...Object.keys(jobsByKey), ...Object.keys(bidsByKey)])
      const crewMap: Record<string, CrewRow> = {}
      const jobIds = new Set<string>()
      const bidIds = new Set<string>()
      for (const k of allKeys) {
        const j = jobsByKey[k]
        const b = bidsByKey[k]
        const jobs = j?.jobs ?? []
        const bids = b?.bids ?? []
        const unified = mergeToUnified(jobs, bids)
        const crewLead = j?.crew_lead ?? b?.crew_lead ?? null
        crewMap[k] = { crew_lead_person_name: crewLead, unifiedAssignments: unified }
        for (const a of unified) {
          if (a.type === 'job') jobIds.add(a.id)
          else bidIds.add(a.id)
        }
      }
      setCrewJobsByDatePerson(crewMap)
      if (jobIds.size > 0) {
        const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: [...jobIds] })
        const jobMap: Record<string, JobDetails> = {}
        for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
          jobMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
        }
        setCrewJobDetailsMap((prev) => ({ ...prev, ...jobMap }))
      }
      if (bidIds.size > 0) {
        const { data: bidsData } = await supabase.rpc('get_bids_by_ids', { p_bid_ids: [...bidIds] })
        const bidMap: Record<string, BidDetails> = {}
        for (const b of (bidsData ?? []) as { id: string; bid_number: string; project_name: string; address: string }[]) {
          bidMap[b.id] = { bid_number: b.bid_number ?? '', project_name: b.project_name ?? '', address: b.address ?? '' }
        }
        setCrewBidDetailsMap((prev) => ({ ...prev, ...bidMap }))
      }
      const office = (officeRes.data as { id: string; hcp_number: string; job_name: string; job_address: string }[] | null)?.[0] ?? null
      setOfficeJob(office)
      const commonRows = (await withSupabaseRetry(
        async () => {
          const r = await supabase.from('common_jobs').select('id, job_id, sequence_order').order('sequence_order')
          return r as { data: Array<{ id: string; job_id: string; sequence_order: number }> | null; error: { message: string } | null }
        },
        'fetch common jobs'
      )) ?? []
      if (commonRows.length > 0) {
        const ids = commonRows.map((r) => r.job_id)
        const jobsData = (await withSupabaseRetry(
          async () => {
            const r = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: ids })
            return r as { data: Array<{ id: string; hcp_number: string; job_name: string; job_address: string }> | null; error: { message: string } | null }
          },
          'fetch common job details'
        )) ?? []
        const jobsMap = new Map((jobsData ?? []).map((j: { id: string; hcp_number: string; job_name: string; job_address: string }) => [j.id, j]))
        const ordered = commonRows
          .filter((r) => jobsMap.has(r.job_id))
          .map((r) => {
            const j = jobsMap.get(r.job_id)!
            return { id: r.id, job_id: j.id, hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
          })
        setCommonJobs(ordered)
      } else {
        setCommonJobs([])
      }
      setLoading(false)
    }
    load()
  }, [personName, hoursDateStart, hoursDateEnd])

  useEffect(() => {
    if (effectiveSelectedDay) {
      const r = crewJobsByDatePerson[key] ?? { crew_lead_person_name: null, unifiedAssignments: [] }
      setDraft({ ...r, unifiedAssignments: [...(r.unifiedAssignments || [])] })
    } else {
      setDraft(null)
    }
  }, [effectiveSelectedDay, personName, crewJobsByDatePerson])

  useEffect(() => {
    if (!effectiveSelectedDay) return
    setSelectedDay(effectiveSelectedDay)
  }, [effectiveSelectedDay])

  useEffect(() => {
    const t = setTimeout(() => {
      if (jobSearchOpen && jobSearchText !== undefined) {
        const q = jobSearchText.trim()
        Promise.all([
          supabase.rpc('search_jobs_ledger', { search_text: q }),
          supabase.rpc('search_bids_for_clock', { p_search_text: q }),
        ]).then(([jobsRes, bidsRes]) => {
          const jobs = (jobsRes.data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>
          const bidsRaw = (bidsRes.data ?? []) as Array<{ id: string; bid_number?: string; project_name: string; address: string; service_type_name?: string }>
          const bids = bidsRaw.map((b) => ({ type: 'bid' as const, ...b, bid_number: b.bid_number ?? '' }))
          const merged = [
            ...jobs.map((j) => ({ type: 'job' as const, ...j })),
            ...bids,
          ]
          setJobSearchResults(merged)
        })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [jobSearchOpen, jobSearchText])

  useEffect(() => {
    const t = setTimeout(() => {
      if (commonJobsSearchOpen && commonJobsSearchText !== undefined) {
        supabase.rpc('search_jobs_ledger', { search_text: commonJobsSearchText }).then(({ data }) => {
          setCommonJobsSearchResults((data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>)
        })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [commonJobsSearchOpen, commonJobsSearchText])

  async function handleSave() {
    const toSave = draft ?? row
    const { jobAssignments, bidAssignments } = splitFromUnified(toSave.unifiedAssignments)
    try {
      await withSupabaseRetry(
        async () => {
          const r = await supabase.from('people_crew_jobs').upsert(
            {
              work_date: effectiveSelectedDay,
              person_name: personName,
              crew_lead_person_name: toSave.crew_lead_person_name || null,
              job_assignments: jobAssignments,
            },
            { onConflict: 'work_date,person_name' }
          )
          return r as { data: unknown; error: { message: string } | null }
        },
        'save people_crew_jobs'
      )
      await withSupabaseRetry(
        async () => {
          const r = await supabase.from('people_crew_bids').upsert(
            {
              work_date: effectiveSelectedDay,
              person_name: personName,
              crew_lead_person_name: toSave.crew_lead_person_name || null,
              bid_assignments: bidAssignments,
            },
            { onConflict: 'work_date,person_name' }
          )
          return r as { data: unknown; error: { message: string } | null }
        },
        'save people_crew_bids'
      )
    } catch {
      return
    }
    setCrewJobsByDatePerson((prev) => ({ ...prev, [key]: toSave }))
    setDraft(null)
    onSaved()
    const remaining = unassignedDays.filter((d) => d !== effectiveSelectedDay)
    if (remaining.length === 0) {
      onClose()
    } else {
      setSelectedDay(remaining[0] ?? '')
    }
  }

  function addAssignmentToDraft(
    item:
      | { type: 'job'; id: string; hcp_number: string; job_name: string; job_address: string }
      | { type: 'bid'; id: string; bid_number: string; project_name: string; address: string }
  ) {
    const current = draft ?? row
    if (current.unifiedAssignments.some((a) => a.type === item.type && a.id === item.id)) return
    const n = current.unifiedAssignments.length + 1
    const pct = Math.round((100 / n) * 10) / 10
    const newAssignments = current.unifiedAssignments.map((a) => ({ ...a, pct }))
    newAssignments.push({
      type: item.type,
      id: item.id,
      pct: Math.round((100 - newAssignments.reduce((s, a) => s + a.pct, 0)) * 10) / 10,
    })
    if (item.type === 'job') {
      setCrewJobDetailsMap((prev) => ({
        ...prev,
        [item.id]: { hcp_number: item.hcp_number, job_name: item.job_name, job_address: item.job_address },
      }))
    } else {
      setCrewBidDetailsMap((prev) => ({
        ...prev,
        [item.id]: { bid_number: item.bid_number, project_name: item.project_name, address: item.address },
      }))
    }
    setDraft({ crew_lead_person_name: null, unifiedAssignments: newAssignments })
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400 }}>
          <p style={{ color: '#6b7280' }}>Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Assign {personName} to jobs or bids</h3>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          {personName} has hours on Correct days but no assignments. Assign a crew lead or add jobs/bids for each day.
        </p>
        {unassignedDays.length === 0 ? (
          <p style={{ color: '#22c55e' }}>All days are now assigned.</p>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}>Day to assign</label>
              <select
                value={effectiveSelectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', minWidth: 180, border: '1px solid #d1d5db', borderRadius: 4 }}
              >
                {unassignedDays.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
            {effectiveSelectedDay && (
              <>
                {crewEditable && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}>Crew lead (inherit jobs from)</label>
                    <select
                      value={draftRow.crew_lead_person_name ?? ''}
                      onChange={(e) => {
                        const v = e.target.value || null
                        setDraft({ ...draftRow, crew_lead_person_name: v, unifiedAssignments: [] })
                      }}
                      style={{ padding: '0.5rem 0.75rem', minWidth: 180, border: '1px solid #d1d5db', borderRadius: 4 }}
                    >
                      <option value="">—</option>
                      {availableCrewLeads.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                )}
                {jobsEditable && (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.875rem' }}>Common Jobs</label>
                        {canEditCrewJobs && !commonJobsEditMode && (
                          <button type="button" onClick={() => setCommonJobsEditMode(true)} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#6b7280' }}>Edit</button>
                        )}
                        {canEditCrewJobs && commonJobsEditMode && (
                          <button type="button" onClick={() => setCommonJobsEditMode(false)} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#6b7280' }}>Done</button>
                        )}
                      </div>
                      {!commonJobsEditMode ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {commonJobs.length === 0 ? (
                            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>No common jobs</span>
                          ) : (
                            commonJobs.map((j) => {
                              const disabled = draftRow.unifiedAssignments.some((a) => a.type === 'job' && a.id === j.job_id)
                              return (
                                <button
                                  key={j.id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => addAssignmentToDraft({ type: 'job', id: j.job_id, hcp_number: j.hcp_number, job_name: j.job_name, job_address: j.job_address })}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: disabled ? '#f9fafb' : '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
                                >
                                  J{(j.hcp_number || '').trim() || '—'} · {j.job_name || '—'}
                                </button>
                              )
                            })
                          )}
                        </div>
                      ) : (
                        <div style={{ marginBottom: '0.5rem' }}>
                          {commonJobs.length === 0 ? (
                            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Add jobs to get started</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                              {commonJobs.map((j) => (
                                <span key={j.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.4rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.8125rem' }}>
                                  <span>J{(j.hcp_number || '').trim() || '—'} · {j.job_name || '—'}</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await withSupabaseRetry(
                                        async () => {
                                          const r = await supabase.from('common_jobs').delete().eq('id', j.id)
                                          return r as { data: null; error: { message: string } | null }
                                        },
                                        'remove job from common jobs'
                                      )
                                      setCommonJobs((prev) => prev.filter((x) => x.id !== j.id))
                                    }}
                                    style={{ padding: '0.1rem 0.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1 }}
                                    title="Remove from common jobs"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          {commonJobsError && (
                            <div style={{ fontSize: '0.8125rem', color: '#dc2626', marginBottom: '0.5rem' }}>{commonJobsError}</div>
                          )}
                          {!commonJobsSearchOpen ? (
                            <button
                              type="button"
                              onClick={() => { setCommonJobsSearchOpen(true); setCommonJobsSearchText(''); setCommonJobsSearchResults([]); setCommonJobsError(null) }}
                              style={{ padding: '0.2rem 0.5rem', border: '1px dashed #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
                            >
                              Add job
                            </button>
                          ) : (
                            <div style={{ width: '100%', marginTop: '0.5rem' }}>
                              <input
                                type="search"
                                placeholder="Search HCP, job name, address…"
                                value={commonJobsSearchText}
                                onChange={(e) => setCommonJobsSearchText(e.target.value)}
                                autoFocus
                                style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                              />
                              <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: '0.5rem' }}>
                                {commonJobsSearchResults.map((j) => (
                                  <button
                                    key={j.id}
                                    type="button"
                                    onClick={async () => {
                                      const nextOrder = commonJobs.length
                                      let inserted: { id: string } | null = null
                                      try {
                                        inserted = await withSupabaseRetry(
                                          async () => {
                                            const r = await supabase.from('common_jobs').insert({ job_id: j.id, sequence_order: nextOrder }).select('id').single()
                                            return r as { data: { id: string } | null; error: { message: string } | null }
                                          },
                                          'add job to common jobs'
                                        )
                                      } catch (insertErr) {
                                        setCommonJobsError(formatErrorMessage(insertErr, 'Failed to add job to Common Jobs'))
                                        return
                                      }
                                      if (inserted) {
                                        setCommonJobs((prev) => [...prev, { id: inserted.id, job_id: j.id, hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }])
                                        setCommonJobsError(null)
                                      }
                                      setCommonJobsSearchOpen(false)
                                      setCommonJobsSearchText('')
                                      setCommonJobsSearchResults([])
                                    }}
                                    style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'left', border: 'none', borderBottom: '1px solid #e5e7eb', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                                  >
                                    <div style={{ fontWeight: 500 }}>J{(j.hcp_number || '').trim() || '—'} · {j.job_name || '—'}</div>
                                    {j.job_address && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{j.job_address}</div>}
                                  </button>
                                ))}
                              </div>
                              <button type="button" onClick={() => { setCommonJobsSearchOpen(false); setCommonJobsSearchText(''); setCommonJobsSearchResults([]) }} style={{ marginTop: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.875rem' }}>Assignments</label>
                        {officeJob && !draftRow.unifiedAssignments.some((a) => a.type === 'job' && a.id === officeJob.id) && (
                          <button
                            type="button"
                            onClick={() => addAssignmentToDraft({ type: 'job', id: officeJob.id, hcp_number: officeJob.hcp_number, job_name: officeJob.job_name, job_address: officeJob.job_address })}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          >
                            J000 · Office
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                        {draftRow.unifiedAssignments.map((a, idx) => {
                          const details = a.type === 'job' ? crewJobDetailsMap[a.id] : crewBidDetailsMap[a.id]
                          const label = formatAssignmentLabel(a.type, details) || a.id.slice(0, 8)
                          return (
                            <span key={getAssignmentKey(a)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.4rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.8125rem' }}>
                              <span>{label}</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={a.pct}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || 0
                                  const rest = draftRow.unifiedAssignments.filter((_, i) => i !== idx)
                                  const restSum = rest.reduce((s, x) => s + x.pct, 0)
                                  const scale = restSum > 0 ? (100 - v) / restSum : 1
                                  let newAssignments = draftRow.unifiedAssignments.map((x, i) =>
                                    i === idx ? { ...x, pct: v } : { ...x, pct: Math.round(x.pct * scale * 10) / 10 }
                                  )
                                  const sum = newAssignments.reduce((s, x) => s + x.pct, 0)
                                  if (Math.abs(sum - 100) > 0.01 && newAssignments.length > 0) {
                                    const lastIdx = newAssignments.length - 1
                                    newAssignments = newAssignments.map((x, i) =>
                                      i === lastIdx ? { ...x, pct: Math.round((x.pct + (100 - sum)) * 10) / 10 } : x
                                    )
                                  }
                                  setDraft({ ...draftRow, unifiedAssignments: newAssignments })
                                }}
                                style={{ width: 44, padding: '0.15rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                              />
                              %
                              <button
                                type="button"
                                onClick={() => {
                                  const rest = draftRow.unifiedAssignments.filter((_, i) => i !== idx)
                                  if (rest.length === 0) {
                                    setDraft({ ...draftRow, unifiedAssignments: [] })
                                    return
                                  }
                                  const n = rest.length
                                  const pctEach = Math.round((100 / n) * 10) / 10
                                  const newAssignments = rest.map((x, i) => ({
                                    ...x,
                                    pct: i === n - 1 ? Math.round((100 - (n - 1) * pctEach) * 10) / 10 : pctEach,
                                  }))
                                  setDraft({ ...draftRow, unifiedAssignments: newAssignments })
                                }}
                                style={{ padding: '0.1rem 0.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1 }}
                                title="Remove"
                              >
                                ×
                              </button>
                            </span>
                          )
                        })}
                        {!jobSearchOpen ? (
                          <button
                            type="button"
                            onClick={() => { setJobSearchOpen(true); setJobSearchText(''); setJobSearchResults([]) }}
                            style={{ padding: '0.2rem 0.5rem', border: '1px dashed #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
                          >
                            +
                          </button>
                        ) : (
                          <div style={{ width: '100%', marginTop: '0.5rem' }}>
                            <input
                              type="search"
                              placeholder="Search HCP, bid #, job name, project, address…"
                              value={jobSearchText}
                              onChange={(e) => setJobSearchText(e.target.value)}
                              autoFocus
                              style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                            />
                            <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: '0.5rem' }}>
                              {jobSearchResults.map((item) => (
                                <button
                                  key={`${item.type}:${item.id}`}
                                  type="button"
                                  onClick={() => {
                                    addAssignmentToDraft(
                                      item.type === 'job'
                                        ? { type: 'job', id: item.id, hcp_number: item.hcp_number, job_name: item.job_name, job_address: item.job_address }
                                        : { type: 'bid', id: item.id, bid_number: item.bid_number, project_name: item.project_name, address: item.address }
                                    )
                                    setJobSearchOpen(false)
                                    setJobSearchText('')
                                    setJobSearchResults([])
                                  }}
                                  style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'left', border: 'none', borderBottom: '1px solid #e5e7eb', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                                >
                                  <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    {item.type === 'bid' && (() => {
                                      const t = getBidServiceTypeTag(item.service_type_name)
                                      return t ? (
                                        <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                                          [{t.tag}]
                                        </span>
                                      ) : null
                                    })()}
                                    {item.type === 'job'
                                      ? `J${(item.hcp_number || '').trim() || '—'} · ${item.job_name || '—'}`
                                      : `B${(item.bid_number || '').trim() || '—'} · ${item.project_name || '—'}`}
                                  </div>
                                  {(item.type === 'job' ? item.job_address : item.address) && (
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                                      {item.type === 'job' ? item.job_address : item.address}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setJobSearchOpen(false); setJobSearchText(''); setJobSearchResults([]) }} style={{ fontSize: '0.8125rem' }}>
                              Cancel search
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
          {unassignedDays.length > 0 && effectiveSelectedDay && (
            <button
              type="button"
              onClick={handleSave}
              style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Accept
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setJobSearchOpen(false)
              setJobSearchText('')
              setJobSearchResults([])
              setCommonJobsEditMode(false)
              setCommonJobsSearchOpen(false)
              setCommonJobsSearchText('')
              setCommonJobsSearchResults([])
              onClose()
            }}
            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
