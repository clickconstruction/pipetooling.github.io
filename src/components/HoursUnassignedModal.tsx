import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

type CrewJobAssignment = { job_id: string; pct: number }
type CrewJobRow = { crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }
type HoursRow = { person_name: string; work_date: string; hours: number }
type PayConfigRow = { person_name: string; is_salary: boolean; show_in_cost_matrix: boolean; record_hours_but_salary: boolean }
type JobDetails = { hcp_number: string; job_name: string; job_address: string }

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    days.push(d.toISOString().slice(0, 10))
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
  const [draft, setDraft] = useState<CrewJobRow | null>(null)
  const [jobSearchOpen, setJobSearchOpen] = useState(false)
  const [jobSearchText, setJobSearchText] = useState('')
  const [jobSearchResults, setJobSearchResults] = useState<Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>>([])
  const [commonJobs, setCommonJobs] = useState<Array<{ id: string; job_id: string; hcp_number: string; job_name: string; job_address: string }>>([])
  const [commonJobsError, setCommonJobsError] = useState<string | null>(null)
  const [commonJobsEditMode, setCommonJobsEditMode] = useState(false)
  const [commonJobsSearchOpen, setCommonJobsSearchOpen] = useState(false)
  const [commonJobsSearchText, setCommonJobsSearchText] = useState('')
  const [commonJobsSearchResults, setCommonJobsSearchResults] = useState<Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>>([])
  const [officeJob, setOfficeJob] = useState<{ id: string; hcp_number: string; job_name: string; job_address: string } | null>(null)
  const [crewJobDetailsMap, setCrewJobDetailsMap] = useState<Record<string, JobDetails>>({})
  const [crewJobsByDatePerson, setCrewJobsByDatePerson] = useState<Record<string, CrewJobRow>>({})
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

  function getEffectiveAssignmentsForDate(pName: string, workDate: string): CrewJobAssignment[] {
    const key = `${workDate}:${pName}`
    const row = crewJobsByDatePerson[key]
    if (!row) return []
    if (row.crew_lead_person_name) {
      const leadKey = `${workDate}:${row.crew_lead_person_name}`
      const leadRow = crewJobsByDatePerson[leadKey]
      return leadRow?.job_assignments ?? []
    }
    return row.job_assignments ?? []
  }

  function hasAssignmentsForDate(pName: string, workDate: string): boolean {
    const key = `${workDate}:${pName}`
    const row = crewJobsByDatePerson[key]
    if (!row) return false
    return !!(row.crew_lead_person_name || (row.job_assignments?.length ?? 0) > 0)
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
  const row = crewJobsByDatePerson[key] ?? { crew_lead_person_name: null, job_assignments: [] }
  const draftRow = draft ?? row
  const hasCrewLead = !!draftRow.crew_lead_person_name
  const availableCrewLeads = showPeople.filter((p) => {
    if (p === personName) return false
    const assignments = getEffectiveAssignmentsForDate(p, effectiveSelectedDay)
    if (officeJob && assignments.some((a) => a.job_id === officeJob.id)) return false
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
      const [correctRes, hoursRes, configRes, crewRes, officeRes] = await Promise.all([
        supabase.from('hours_days_correct').select('work_date').gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.from('people_hours').select('person_name, work_date, hours').eq('person_name', personName).gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.from('people_pay_config').select('person_name, is_salary, show_in_cost_matrix, record_hours_but_salary'),
        supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address').eq('hcp_number', '000').limit(1).maybeSingle(),
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
      const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
      const crewMap: Record<string, CrewJobRow> = {}
      const jobIds = new Set<string>()
      for (const r of crewRows) {
        const k = `${r.work_date}:${r.person_name}`
        crewMap[k] = { crew_lead_person_name: r.crew_lead_person_name ?? null, job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
        for (const a of crewMap[k].job_assignments) jobIds.add(a.job_id)
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
      let office = (officeRes.data as { id: string; hcp_number: string; job_name: string; job_address: string } | null) ?? null
      if (!office) {
        const { data: officeData } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address').ilike('job_name', '%Office%').limit(1).maybeSingle()
        office = (officeData as { id: string; hcp_number: string; job_name: string; job_address: string } | null) ?? null
      }
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
      const r = crewJobsByDatePerson[key] ?? { crew_lead_person_name: null, job_assignments: [] }
      setDraft({ ...r, job_assignments: [...(r.job_assignments || [])] })
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
        supabase.rpc('search_jobs_ledger', { search_text: jobSearchText }).then(({ data }) => {
          setJobSearchResults((data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>)
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
    try {
      await withSupabaseRetry(
        async () => {
          const r = await supabase.from('people_crew_jobs').upsert(
            {
              work_date: effectiveSelectedDay,
              person_name: personName,
              crew_lead_person_name: toSave.crew_lead_person_name || null,
              job_assignments: toSave.job_assignments,
            },
            { onConflict: 'work_date,person_name' }
          )
          return r as { data: unknown; error: { message: string } | null }
        },
        'save people_crew_jobs'
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

  function addJobToDraft(job: { id: string; hcp_number: string; job_name: string; job_address: string }) {
    const current = draft ?? row
    if (current.job_assignments.some((a) => a.job_id === job.id)) return
    const n = current.job_assignments.length + 1
    const pct = Math.round((100 / n) * 10) / 10
    const newAssignments = current.job_assignments.map((a) => ({ ...a, pct }))
    newAssignments.push({ job_id: job.id, pct: 100 - newAssignments.reduce((s, a) => s + a.pct, 0) })
    setCrewJobDetailsMap((prev) => ({ ...prev, [job.id]: { hcp_number: job.hcp_number, job_name: job.job_name, job_address: job.job_address } }))
    setDraft({ crew_lead_person_name: null, job_assignments: newAssignments })
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
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Assign {personName} to jobs</h3>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          {personName} has hours on Correct days but no job assignments. Assign a crew lead or add jobs for each day.
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
                        setDraft({ ...draftRow, crew_lead_person_name: v, job_assignments: [] })
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
                              const disabled = draftRow.job_assignments.some((a) => a.job_id === j.job_id)
                              return (
                                <button
                                  key={j.id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => addJobToDraft({ id: j.job_id, hcp_number: j.hcp_number, job_name: j.job_name, job_address: j.job_address })}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: disabled ? '#f9fafb' : '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
                                >
                                  Job {j.hcp_number || '—'} ({j.job_name || '—'})
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
                                  <span>Job {j.hcp_number || '—'} ({j.job_name || '—'})</span>
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
                                    <div style={{ fontWeight: 500 }}>{j.hcp_number || '—'} · {j.job_name || '—'}</div>
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
                        <label style={{ fontSize: '0.875rem' }}>Jobs</label>
                        {officeJob && !draftRow.job_assignments.some((a) => a.job_id === officeJob.id) && (
                          <button
                            type="button"
                            onClick={() => addJobToDraft(officeJob)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Office (Job 000)
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                        {draftRow.job_assignments.map((a, idx) => {
                          const details = crewJobDetailsMap[a.job_id]
                          const label = details ? `Job ${details.hcp_number || '—'} (${details.job_name || '—'})` : a.job_id.slice(0, 8)
                          return (
                            <span key={a.job_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.4rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.8125rem' }}>
                              <span>{label}</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={a.pct}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || 0
                                  const rest = draftRow.job_assignments.filter((_, i) => i !== idx)
                                  const restSum = rest.reduce((s, x) => s + x.pct, 0)
                                  const scale = restSum > 0 ? (100 - v) / restSum : 1
                                  let newAssignments = draftRow.job_assignments.map((x, i) =>
                                    i === idx ? { ...x, pct: v } : { ...x, pct: Math.round(x.pct * scale * 10) / 10 }
                                  )
                                  const sum = newAssignments.reduce((s, x) => s + x.pct, 0)
                                  if (Math.abs(sum - 100) > 0.01 && newAssignments.length > 0) {
                                    const lastIdx = newAssignments.length - 1
                                    newAssignments = newAssignments.map((x, i) =>
                                      i === lastIdx ? { ...x, pct: Math.round((x.pct + (100 - sum)) * 10) / 10 } : x
                                    )
                                  }
                                  setDraft({ ...draftRow, job_assignments: newAssignments })
                                }}
                                style={{ width: 44, padding: '0.15rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                              />
                              %
                              <button
                                type="button"
                                onClick={() => {
                                  const rest = draftRow.job_assignments.filter((_, i) => i !== idx)
                                  if (rest.length === 0) {
                                    setDraft({ ...draftRow, job_assignments: [] })
                                    return
                                  }
                                  const n = rest.length
                                  const pctEach = Math.round((100 / n) * 10) / 10
                                  const newAssignments = rest.map((x, i) => ({
                                    ...x,
                                    pct: i === n - 1 ? Math.round((100 - (n - 1) * pctEach) * 10) / 10 : pctEach,
                                  }))
                                  setDraft({ ...draftRow, job_assignments: newAssignments })
                                }}
                                style={{ padding: '0.1rem 0.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1 }}
                                title="Remove job"
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
                              placeholder="Search HCP, job name, address…"
                              value={jobSearchText}
                              onChange={(e) => setJobSearchText(e.target.value)}
                              autoFocus
                              style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                            />
                            <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: '0.5rem' }}>
                              {jobSearchResults.map((j) => (
                                <button
                                  key={j.id}
                                  type="button"
                                  onClick={() => {
                                    addJobToDraft(j)
                                    setJobSearchOpen(false)
                                    setJobSearchText('')
                                    setJobSearchResults([])
                                  }}
                                  style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'left', border: 'none', borderBottom: '1px solid #e5e7eb', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                                >
                                  <div style={{ fontWeight: 500 }}>{j.hcp_number || '—'} · {j.job_name || '—'}</div>
                                  {j.job_address && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{j.job_address}</div>}
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
