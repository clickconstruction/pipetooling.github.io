import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type PayConfigRow = { person_name: string; hourly_wage: number | null; is_salary: boolean; show_in_hours: boolean; show_in_cost_matrix: boolean }
type CrewJobAssignment = { job_id: string; pct: number }
type CrewJobRow = { crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }
type TeamLaborRow = { jobId: string; hcpNumber: string; jobName: string; jobAddress: string; people: string[]; manHours: number; jobCost: number; breakdown: Array<{ personName: string; hours: number; cost: number }> }

export function CrewJobsSection() {
  const { user: authUser } = useAuth()
  const [canAccess, setCanAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  const [hoursDisplayOrder, setHoursDisplayOrder] = useState<Record<string, number>>({})
  const [crewJobsDate, setCrewJobsDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [crewJobsData, setCrewJobsData] = useState<Record<string, CrewJobRow>>({})
  const [crewJobsLoading, setCrewJobsLoading] = useState(false)
  const [crewJobSearchModal, setCrewJobSearchModal] = useState<{ personName: string } | null>(null)
  const [crewJobSearchText, setCrewJobSearchText] = useState('')
  const [crewJobSearchResults, setCrewJobSearchResults] = useState<Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>>([])
  const [teamLaborSearch, setTeamLaborSearch] = useState('')
  const [breakdownModal, setBreakdownModal] = useState<{ jobId: string; jobName: string; type: 'hours' | 'cost' } | null>(null)
  const [crewJobDetailsMap, setCrewJobDetailsMap] = useState<Record<string, { hcp_number: string; job_name: string; job_address: string }>>({})
  const [teamLaborData, setTeamLaborData] = useState<TeamLaborRow[]>([])
  const [teamLaborLoading, setTeamLaborLoading] = useState(false)

  async function loadAccess() {
    if (!authUser?.id) return
    const [meRes, approvedRes, sharesRes] = await Promise.all([
      supabase.from('users').select('role').eq('id', authUser.id).single(),
      supabase.from('pay_approved_masters').select('master_id'),
      supabase.from('cost_matrix_teams_shares').select('shared_with_user_id').eq('shared_with_user_id', authUser.id).maybeSingle(),
    ])
    const role = (meRes.data as { role?: string } | null)?.role ?? null
    const approvedIds = new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id))
    const hasCostMatrixShare = !!sharesRes.data
    const canViewCostMatrixShared = hasCostMatrixShare
    let canAccessPay = false
    if (role === 'dev') canAccessPay = true
    else if (role === 'master_technician' && approvedIds.has(authUser.id)) canAccessPay = true
    else if (role === 'assistant') canAccessPay = true
    setCanAccess(canAccessPay || canViewCostMatrixShared)
  }

  async function loadPayConfig() {
    const { data, error: err } = await supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix')
    if (err) { setError(err.message); return }
    const map: Record<string, PayConfigRow> = {}
    for (const r of (data ?? []) as PayConfigRow[]) map[r.person_name] = r
    setPayConfig(map)
  }

  async function loadHoursDisplayOrder() {
    const { data } = await supabase.from('people_hours_display_order').select('person_name, sequence_order')
    const map: Record<string, number> = {}
    for (const r of (data ?? []) as { person_name: string; sequence_order: number }[]) map[r.person_name] = r.sequence_order
    setHoursDisplayOrder(map)
  }

  async function loadCrewJobs(date: string) {
    setCrewJobsLoading(true)
    const { data, error: err } = await supabase
      .from('people_crew_jobs')
      .select('person_name, crew_lead_person_name, job_assignments')
      .eq('work_date', date)
    setCrewJobsLoading(false)
    if (err) { setError(err.message); return }
    const map: Record<string, CrewJobRow> = {}
    for (const r of (data ?? []) as { person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }[]) {
      map[r.person_name] = {
        crew_lead_person_name: r.crew_lead_person_name ?? null,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    setCrewJobsData(map)
  }

  async function saveCrewJobRow(personName: string, row: CrewJobRow) {
    if (!canAccess) return
    setCrewJobsData((prev) => ({ ...prev, [personName]: row }))
    const { error: err } = await supabase.from('people_crew_jobs').upsert(
      { work_date: crewJobsDate, person_name: personName, crew_lead_person_name: row.crew_lead_person_name || null, job_assignments: row.job_assignments },
      { onConflict: 'work_date,person_name' }
    )
    if (err) setError(err.message)
    else loadTeamLaborData()
  }

  async function copyCrewFromYesterday() {
    if (!canAccess) return
    const d = new Date(crewJobsDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const yesterday = d.toISOString().slice(0, 10)
    const { data, error: err } = await supabase.from('people_crew_jobs').select('person_name, crew_lead_person_name, job_assignments').eq('work_date', yesterday)
    if (err) { setError(err.message); return }
    const rows = (data ?? []) as Array<{ person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const toCopy = rows.filter((r) => {
      const hasData = !!(r.crew_lead_person_name || (Array.isArray(r.job_assignments) && r.job_assignments.length > 0))
      return hasData && showPeopleForMatrix.includes(r.person_name)
    })
    if (toCopy.length === 0) { setError('No crew assignments for yesterday'); return }
    setError(null)
    for (const r of toCopy) {
      const row: CrewJobRow = { crew_lead_person_name: r.crew_lead_person_name ?? null, job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
      await saveCrewJobRow(r.person_name, row)
    }
    loadTeamLaborData()
  }

  function addJobToPerson(personName: string, job: { id: string; hcp_number: string; job_name: string; job_address: string }) {
    const row = crewJobsData[personName] ?? { crew_lead_person_name: null, job_assignments: [] }
    if (row.job_assignments.some((a) => a.job_id === job.id)) return
    const n = row.job_assignments.length + 1
    const pct = Math.round((100 / n) * 10) / 10
    const newAssignments = row.job_assignments.map((a) => ({ ...a, pct }))
    newAssignments.push({ job_id: job.id, pct: 100 - newAssignments.reduce((s, a) => s + a.pct, 0) })
    setCrewJobDetailsMap((prev) => ({ ...prev, [job.id]: { hcp_number: job.hcp_number, job_name: job.job_name, job_address: job.job_address } }))
    saveCrewJobRow(personName, { ...row, job_assignments: newAssignments })
    setCrewJobSearchModal(null)
    setCrewJobSearchText('')
    setCrewJobSearchResults([])
  }

  async function loadTeamLaborData() {
    setTeamLaborLoading(true)
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const startDate = twoYearsAgo.toISOString().slice(0, 10)
    const [crewRes, hoursRes, configRes] = await Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments'),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', startDate),
      supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary'),
    ])
    setTeamLaborLoading(false)
    const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const hoursRows = (hoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const configRows = (configRes.data ?? []) as Array<{ person_name: string; hourly_wage: number | null; is_salary: boolean }>
    const configMap: Record<string, { hourly_wage: number; is_salary: boolean }> = {}
    for (const c of configRows) configMap[c.person_name] = { hourly_wage: c.hourly_wage ?? 0, is_salary: c.is_salary ?? false }
    const hoursMap: Record<string, number> = {}
    for (const h of hoursRows) hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = { crew_lead_person_name: r.crew_lead_person_name, job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
    }
    function getEffectiveAssignments(personName: string, workDate: string): CrewJobAssignment[] {
      const key = `${workDate}:${personName}`
      const row = crewByDatePerson[key]
      if (!row) return []
      if (row.crew_lead_person_name) {
        const leadRow = crewByDatePerson[`${workDate}:${row.crew_lead_person_name}`]
        return leadRow?.job_assignments ?? []
      }
      return row.job_assignments
    }
    const jobAgg: Record<string, { people: Set<string>; hoursByPerson: Record<string, number>; costByPerson: Record<string, number> }> = {}
    for (const r of crewRows) {
      const assignments = getEffectiveAssignments(r.person_name, r.work_date)
      const hours = hoursMap[`${r.person_name}:${r.work_date}`] ?? (configMap[r.person_name]?.is_salary ? 8 : 0)
      const rate = configMap[r.person_name]?.hourly_wage ?? 0
      for (const a of assignments) {
        if (!jobAgg[a.job_id]) jobAgg[a.job_id] = { people: new Set(), hoursByPerson: {}, costByPerson: {} }
        const agg = jobAgg[a.job_id]!
        agg.people.add(r.person_name)
        const pctHrs = hours * (a.pct / 100)
        agg.hoursByPerson[r.person_name] = (agg.hoursByPerson[r.person_name] ?? 0) + pctHrs
        agg.costByPerson[r.person_name] = (agg.costByPerson[r.person_name] ?? 0) + pctHrs * rate
      }
    }
    const jobIds = Object.keys(jobAgg)
    if (jobIds.length === 0) { setTeamLaborData([]); return }
    const { data: jobsData } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address').in('id', jobIds)
    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
    for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
    }
    const rows: TeamLaborRow[] = jobIds.map((jobId) => {
      const agg = jobAgg[jobId]!
      const info = jobsMap[jobId] ?? { hcp_number: '', job_name: '', job_address: '' }
      const people = [...agg.people]
      const manHours = Object.values(agg.hoursByPerson).reduce((s, h) => s + h, 0)
      const jobCost = Object.values(agg.costByPerson).reduce((s, c) => s + c, 0)
      const breakdown = people.map((p) => ({ personName: p, hours: agg.hoursByPerson[p] ?? 0, cost: agg.costByPerson[p] ?? 0 }))
      return { jobId, hcpNumber: info.hcp_number, jobName: info.job_name, jobAddress: info.job_address, people, manHours, jobCost, breakdown }
    })
    setTeamLaborData(rows)
  }

  const showPeopleForMatrix = Object.keys(payConfig)
    .filter((n) => payConfig[n]?.show_in_cost_matrix ?? false)
    .sort((a, b) => {
      const orderA = hoursDisplayOrder[a] ?? 999999
      const orderB = hoursDisplayOrder[b] ?? 999999
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
    })

  useEffect(() => { loadAccess() }, [authUser?.id])

  useEffect(() => {
    if (!canAccess) { setLoading(false); return }
    setLoading(true)
    Promise.all([loadPayConfig(), loadHoursDisplayOrder()]).finally(() => setLoading(false))
  }, [canAccess])

  useEffect(() => {
    if (canAccess) loadCrewJobs(crewJobsDate)
  }, [canAccess, crewJobsDate])

  useEffect(() => {
    if (canAccess) loadTeamLaborData()
  }, [canAccess])

  useEffect(() => {
    const jobIds = new Set<string>()
    for (const row of Object.values(crewJobsData)) {
      for (const a of row.job_assignments) jobIds.add(a.job_id)
    }
    const missing = [...jobIds].filter((id) => !crewJobDetailsMap[id])
    if (missing.length === 0) return
    supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address').in('id', missing).then(({ data }) => {
      const map: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
      for (const r of (data ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
        map[r.id] = { hcp_number: r.hcp_number ?? '', job_name: r.job_name ?? '', job_address: r.job_address ?? '' }
      }
      setCrewJobDetailsMap((prev) => ({ ...prev, ...map }))
    })
  }, [crewJobsData])

  useEffect(() => {
    const t = setTimeout(() => {
      if (crewJobSearchModal && crewJobSearchText !== undefined) {
        supabase.rpc('search_jobs_ledger', { search_text: crewJobSearchText }).then(({ data }) => {
          setCrewJobSearchResults((data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>)
        })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [crewJobSearchModal, crewJobSearchText])

  if (!canAccess) return null

  const hasAnyCrewToday = showPeopleForMatrix.some((p) => {
    const r = crewJobsData[p] ?? { crew_lead_person_name: null, job_assignments: [] }
    return !!(r.crew_lead_person_name || (r.job_assignments?.length ?? 0) > 0)
  })

  const canEdit = canAccess

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', textAlign: 'center' }}>Crew Jobs</h2>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', textAlign: 'center' }}>
        <Link to="/people?tab=team_costs" style={{ color: '#2563eb', textDecoration: 'underline' }}>Full Team Costs</Link> in People
      </p>
      {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button type="button" onClick={() => { const d = new Date(crewJobsDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setCrewJobsDate(d.toISOString().slice(0, 10)) }} style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>←</button>
              <input type="date" value={crewJobsDate} onChange={(e) => setCrewJobsDate(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.9375rem', fontWeight: 500, border: '1px solid #d1d5db', borderRadius: 4, minWidth: 140 }} />
              <button type="button" onClick={() => { const d = new Date(crewJobsDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setCrewJobsDate(d.toISOString().slice(0, 10)) }} style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>→</button>
            </div>
            {!crewJobsLoading && !hasAnyCrewToday && canEdit && (
              <button type="button" onClick={copyCrewFromYesterday} style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>Same team as yesterday</button>
            )}
          </div>
          {crewJobsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : showPeopleForMatrix.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No people in Cost Matrix. Go to People → Pay and check Show in Cost Matrix.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Crew</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {showPeopleForMatrix.map((personName) => {
                    const row = crewJobsData[personName] ?? { crew_lead_person_name: null, job_assignments: [] }
                    const isCrewLeadByOthers = showPeopleForMatrix.some((p) => crewJobsData[p]?.crew_lead_person_name === personName)
                    const availableCrewLeads = showPeopleForMatrix.filter((p) => p !== personName)
                    const hasCrewLead = !!row.crew_lead_person_name
                    const jobsEditable = canEdit && !hasCrewLead
                    const crewEditable = canEdit && !isCrewLeadByOthers
                    return (
                      <tr key={personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{personName}</td>
                        <td style={{ padding: '0.75rem', background: !crewEditable ? '#f3f4f6' : undefined }}>
                          {crewEditable ? (
                            <select value={row.crew_lead_person_name ?? ''} onChange={(e) => saveCrewJobRow(personName, { ...row, crew_lead_person_name: e.target.value || null })} style={{ padding: '0.35rem 0.5rem', minWidth: 140, border: '1px solid #d1d5db', borderRadius: 4 }}>
                              <option value="">—</option>
                              {availableCrewLeads.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          ) : (
                            <span style={{ color: '#6b7280' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', background: !jobsEditable ? '#f3f4f6' : undefined }}>
                          {jobsEditable ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
                              {row.job_assignments.map((a, idx) => {
                                const details = crewJobDetailsMap[a.job_id]
                                const label = details ? `${details.hcp_number || '—'} · ${details.job_name || '—'}` : a.job_id.slice(0, 8)
                                return (
                                  <span key={a.job_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.4rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.8125rem' }}>
                                    <span title={details?.job_address}>{label}</span>
                                    <input type="number" min={0} max={100} value={a.pct} onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 0
                                      const rest = row.job_assignments.filter((_, i) => i !== idx)
                                      const restSum = rest.reduce((s, x) => s + x.pct, 0)
                                      const scale = restSum > 0 ? (100 - v) / restSum : 1
                                      let newAssignments = row.job_assignments.map((x, i) => i === idx ? { ...x, pct: v } : { ...x, pct: Math.round(x.pct * scale * 10) / 10 })
                                      const sum = newAssignments.reduce((s, x) => s + x.pct, 0)
                                      if (Math.abs(sum - 100) > 0.01 && newAssignments.length > 0) {
                                        const lastIdx = newAssignments.length - 1
                                        newAssignments = newAssignments.map((x, i) => i === lastIdx ? { ...x, pct: Math.round((x.pct + (100 - sum)) * 10) / 10 } : x)
                                      }
                                      saveCrewJobRow(personName, { ...row, job_assignments: newAssignments })
                                    }} style={{ width: 44, padding: '0.15rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                                    %
                                    <button type="button" onClick={() => {
                                      const rest = row.job_assignments.filter((_, i) => i !== idx)
                                      if (rest.length === 0) { saveCrewJobRow(personName, { ...row, job_assignments: [] }); return }
                                      const n = rest.length
                                      const pctEach = Math.round((100 / n) * 10) / 10
                                      const newAssignments = rest.map((x, i) => ({ ...x, pct: i === n - 1 ? Math.round((100 - (n - 1) * pctEach) * 10) / 10 : pctEach }))
                                      saveCrewJobRow(personName, { ...row, job_assignments: newAssignments })
                                    }} style={{ padding: '0.1rem 0.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1 }} title="Remove job">×</button>
                                  </span>
                                )
                              })}
                              <button type="button" onClick={() => { setCrewJobSearchModal({ personName }); setCrewJobSearchText(''); setCrewJobSearchResults([]) }} style={{ padding: '0.2rem 0.5rem', border: '1px dashed #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>+</button>
                            </div>
                          ) : (
                            <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>Inherits from crew lead</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Team Job Labor</h3>
          <div style={{ marginBottom: '0.75rem' }}>
            <input type="search" placeholder="Search HCP, job name, address…" value={teamLaborSearch} onChange={(e) => setTeamLaborSearch(e.target.value)} style={{ width: '100%', maxWidth: 400, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }} />
          </div>
          {teamLaborLoading ? (
            <p style={{ color: '#6b7280' }}>Loading Team Job Labor…</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>People</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Man Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {teamLaborData.filter((r) => {
                    const q = teamLaborSearch.trim().toLowerCase()
                    if (!q) return true
                    return (r.hcpNumber ?? '').toLowerCase().includes(q) || (r.jobName ?? '').toLowerCase().includes(q) || (r.jobAddress ?? '').toLowerCase().includes(q)
                  }).map((r) => (
                    <tr key={r.jobId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>{r.hcpNumber || '—'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>{r.jobName || '—'}</div>
                        {r.jobAddress && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{r.jobAddress}</div>}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{r.people.join(', ') || '—'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button type="button" onClick={() => setBreakdownModal({ jobId: r.jobId, jobName: r.jobName, type: 'hours' })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2563eb', textDecoration: 'underline', fontSize: 'inherit' }}>{r.manHours.toFixed(2)}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teamLaborData.length === 0 && <p style={{ padding: '1rem', color: '#6b7280', margin: 0 }}>No job labor data yet. Add jobs in Crew Jobs above.</p>}
            </div>
          )}
        </>
      )}

      {crewJobSearchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Add job for {crewJobSearchModal.personName}</h3>
            <input type="search" placeholder="Search HCP, job name, address…" value={crewJobSearchText} onChange={(e) => setCrewJobSearchText(e.target.value)} autoFocus style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {crewJobSearchResults.map((j) => (
                <button key={j.id} type="button" onClick={() => addJobToPerson(crewJobSearchModal!.personName, j)} style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'left', border: 'none', borderBottom: '1px solid #e5e7eb', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 500 }}>{j.hcp_number || '—'} · {j.job_name || '—'}</div>
                  {j.job_address && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{j.job_address}</div>}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setCrewJobSearchModal(null); setCrewJobSearchText(''); setCrewJobSearchResults([]) }} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Cancel</button>
          </div>
        </div>
      )}

      {breakdownModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Crew {breakdownModal.type === 'hours' ? 'Man Hours' : 'Job Cost'} Breakdown for Job {breakdownModal.jobName}</h3>
            {(() => {
              const row = teamLaborData.find((r) => r.jobId === breakdownModal.jobId)
              if (!row) return <p style={{ color: '#6b7280' }}>No data</p>
              const items = breakdownModal.type === 'hours' ? row.breakdown.map((b) => ({ ...b, value: b.hours })) : row.breakdown.map((b) => ({ ...b, value: b.cost }))
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead><tr style={{ borderBottom: '1px solid #e5e7eb' }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Person</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>{breakdownModal.type === 'hours' ? 'Hours' : 'Cost'}</th></tr></thead>
                  <tbody>
                    {items.map((b) => (
                      <tr key={b.personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem' }}>{b.personName}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{breakdownModal.type === 'hours' ? b.value.toFixed(2) : `$${b.value.toFixed(2)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })()}
            <button type="button" onClick={() => setBreakdownModal(null)} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Close</button>
          </div>
        </div>
      )}
    </section>
  )
}
