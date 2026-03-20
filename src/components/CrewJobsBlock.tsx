import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateWithRelativeLabel } from '../lib/format'
import { useAuth } from '../hooks/useAuth'
import { loadTeamLaborData, type TeamLaborRow } from '../utils/teamLabor'
import {
  type UnifiedAssignment,
  mergeToUnified,
  splitFromUnified,
  formatAssignmentLabel,
  type JobDetails,
  type BidDetails,
} from '../utils/crewAssignments'

type PayConfigRow = {
  person_name: string
  hourly_wage: number | null
  is_salary: boolean
  show_in_hours: boolean
  show_in_cost_matrix: boolean
}

type CrewRow = { crew_lead_person_name: string | null; unifiedAssignments: UnifiedAssignment[] }

interface CrewJobsBlockProps {
  people?: string[]
  crewHoursByPerson?: Record<string, number>
  onCrewJobsChange?: () => void
  canEdit?: boolean
  showTitle?: boolean
  showCrewJobsSection?: boolean
  showTeamLabor?: boolean
  jobIdsFilter?: string[]
  collapsibleCrewJobs?: boolean
  hideJobCostColumn?: boolean
}

export function CrewJobsBlock({
  people: peopleProp,
  crewHoursByPerson: crewHoursByPersonProp,
  onCrewJobsChange,
  canEdit: canEditProp,
  showTitle = false,
  showCrewJobsSection = true,
  showTeamLabor = true,
  jobIdsFilter,
  collapsibleCrewJobs = false,
  hideJobCostColumn = false,
}: CrewJobsBlockProps) {
  const { user: authUser } = useAuth()

  const [canAccess, setCanAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  const [hoursDisplayOrder, setHoursDisplayOrder] = useState<Record<string, number>>({})
  const [crewJobsDate, setCrewJobsDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toLocaleDateString('en-CA')
  })
  const [crewJobsData, setCrewJobsData] = useState<Record<string, CrewRow>>({})
  const [crewJobsLoading, setCrewJobsLoading] = useState(false)
  const [crewJobSearchModal, setCrewJobSearchModal] = useState<{ personName: string } | null>(null)
  const [crewJobSearchText, setCrewJobSearchText] = useState('')
  const [crewJobSearchResults, setCrewJobSearchResults] = useState<
    Array<
      | { type: 'job'; id: string; hcp_number: string; job_name: string; job_address: string }
      | { type: 'bid'; id: string; bid_number: string; project_name: string; address: string }
    >
  >([])
  const [teamLaborSearch, setTeamLaborSearch] = useState('')
  const [breakdownModal, setBreakdownModal] = useState<{
    jobId: string
    jobName: string
    type: 'hours' | 'cost'
  } | null>(null)
  const [teamLaborOpen, setTeamLaborOpen] = useState(true)
  const [crewJobDetailsMap, setCrewJobDetailsMap] = useState<Record<string, JobDetails>>({})
  const [crewBidDetailsMap, setCrewBidDetailsMap] = useState<Record<string, BidDetails>>({})
  const [teamLaborData, setTeamLaborData] = useState<TeamLaborRow[]>([])
  const [teamLaborLoading, setTeamLaborLoading] = useState(false)
  const [hideZeroHours, setHideZeroHours] = useState(true)
  const [crewDateHours, setCrewDateHours] = useState<Record<string, number>>({})
  const [crewJobsSectionOpen, setCrewJobsSectionOpen] = useState(true)

  const canEdit = canEditProp ?? canAccess

  const showPeopleForMatrix = useMemo(() => {
    if (peopleProp && peopleProp.length > 0) return peopleProp
    return Object.keys(payConfig)
      .filter((n) => payConfig[n]?.show_in_cost_matrix ?? false)
      .sort((a, b) => {
        const orderA = hoursDisplayOrder[a] ?? 999999
        const orderB = hoursDisplayOrder[b] ?? 999999
        return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
      })
  }, [peopleProp, payConfig, hoursDisplayOrder])

  const effectiveCrewHours = useMemo(() => {
    if (crewHoursByPersonProp) return crewHoursByPersonProp
    return crewDateHours
  }, [crewHoursByPersonProp, crewDateHours])

  const visiblePeopleForCrew = useMemo(() => {
    const day = new Date(crewJobsDate + 'T12:00:00').getDay()
    function getEffectiveHours(personName: string): number {
      const cfg = payConfig[personName]
      return cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (effectiveCrewHours[personName] ?? 0)
    }
    return showPeopleForMatrix.filter((p) => !hideZeroHours || getEffectiveHours(p) > 0)
  }, [showPeopleForMatrix, hideZeroHours, crewJobsDate, effectiveCrewHours, payConfig])

  const filteredTeamLaborData = useMemo(() => {
    if (!jobIdsFilter || jobIdsFilter.length === 0) return teamLaborData
    const set = new Set(jobIdsFilter)
    return teamLaborData.filter((r) => set.has(r.jobId))
  }, [teamLaborData, jobIdsFilter])

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
    const { data, error: err } = await supabase
      .from('people_pay_config')
      .select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix')
    if (err) {
      setError(err.message)
      return
    }
    const map: Record<string, PayConfigRow> = {}
    for (const r of (data ?? []) as PayConfigRow[]) map[r.person_name] = r
    setPayConfig(map)
  }

  async function loadHoursDisplayOrder() {
    const { data } = await supabase.from('people_hours_display_order').select('person_name, sequence_order')
    const map: Record<string, number> = {}
    for (const r of (data ?? []) as { person_name: string; sequence_order: number }[]) {
      map[r.person_name] = r.sequence_order
    }
    setHoursDisplayOrder(map)
  }

  async function loadCrewJobs(date: string) {
    setCrewJobsLoading(true)
    const [jobsRes, bidsRes, hoursRes] = await Promise.all([
      supabase.from('people_crew_jobs').select('person_name, crew_lead_person_name, job_assignments').eq('work_date', date),
      supabase.from('people_crew_bids').select('person_name, crew_lead_person_name, bid_assignments').eq('work_date', date),
      supabase.from('people_hours').select('person_name, hours').eq('work_date', date),
    ])
    setCrewJobsLoading(false)
    const { data: jobsData, error: jobsErr } = jobsRes
    const { data: bidsData, error: bidsErr } = bidsRes
    if (jobsErr || bidsErr) {
      setError(jobsErr?.message ?? bidsErr?.message ?? 'Failed to load crew data')
      return
    }
    const jobsRows = (jobsData ?? []) as Array<{
      person_name: string
      crew_lead_person_name: string | null
      job_assignments: Array<{ job_id: string; pct: number }>
    }>
    const bidsRows = (bidsData ?? []) as Array<{
      person_name: string
      crew_lead_person_name: string | null
      bid_assignments: Array<{ bid_id: string; pct: number }>
    }>
    const jobsByPerson: Record<string, { crew_lead: string | null; jobs: Array<{ job_id: string; pct: number }> }> = {}
    for (const r of jobsRows) {
      jobsByPerson[r.person_name] = {
        crew_lead: r.crew_lead_person_name ?? null,
        jobs: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const bidsByPerson: Record<string, { crew_lead: string | null; bids: Array<{ bid_id: string; pct: number }> }> = {}
    for (const r of bidsRows) {
      bidsByPerson[r.person_name] = {
        crew_lead: r.crew_lead_person_name ?? null,
        bids: Array.isArray(r.bid_assignments) ? r.bid_assignments : [],
      }
    }
    const allPersonNames = new Set([...Object.keys(jobsByPerson), ...Object.keys(bidsByPerson)])
    const map: Record<string, CrewRow> = {}
    for (const personName of allPersonNames) {
      const j = jobsByPerson[personName]
      const b = bidsByPerson[personName]
      const jobs = j?.jobs ?? []
      const bids = b?.bids ?? []
      const unified = mergeToUnified(jobs, bids)
      const crewLead = j?.crew_lead ?? b?.crew_lead ?? null
      map[personName] = {
        crew_lead_person_name: crewLead,
        unifiedAssignments: unified,
      }
    }
    setCrewJobsData(map)
    if (!crewHoursByPersonProp) {
      const hoursRows = (hoursRes.data ?? []) as Array<{ person_name: string; hours: number }>
      const hoursMap: Record<string, number> = {}
      for (const h of hoursRows) hoursMap[h.person_name] = h.hours
      setCrewDateHours(hoursMap)
    }
  }

  function getAssignmentKey(a: UnifiedAssignment): string {
    return `${a.type}:${a.id}`
  }

  async function doLoadTeamLaborData() {
    setTeamLaborLoading(true)
    const rows = await loadTeamLaborData(supabase)
    setTeamLaborData(rows)
    setTeamLaborLoading(false)
  }

  async function saveCrewRow(personName: string, row: CrewRow) {
    if (!canEdit) return
    setCrewJobsData((prev) => ({ ...prev, [personName]: row }))
    const { jobAssignments, bidAssignments } = splitFromUnified(row.unifiedAssignments)
    const [jobsErr, bidsErr] = await Promise.all([
      supabase
        .from('people_crew_jobs')
        .upsert(
          {
            work_date: crewJobsDate,
            person_name: personName,
            crew_lead_person_name: row.crew_lead_person_name || null,
            job_assignments: jobAssignments,
          },
          { onConflict: 'work_date,person_name' }
        )
        .then((r) => r.error),
      supabase
        .from('people_crew_bids')
        .upsert(
          {
            work_date: crewJobsDate,
            person_name: personName,
            crew_lead_person_name: row.crew_lead_person_name || null,
            bid_assignments: bidAssignments,
          },
          { onConflict: 'work_date,person_name' }
        )
        .then((r) => r.error),
    ])
    if (jobsErr || bidsErr) setError(jobsErr?.message ?? bidsErr?.message ?? 'Failed to save')
    else {
      await doLoadTeamLaborData()
      onCrewJobsChange?.()
    }
  }

  async function copyCrewFromYesterday() {
    if (!canEdit) return
    const d = new Date(crewJobsDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const yesterday = d.toLocaleDateString('en-CA')
    const [jobsRes, bidsRes] = await Promise.all([
      supabase.from('people_crew_jobs').select('person_name, crew_lead_person_name, job_assignments').eq('work_date', yesterday),
      supabase.from('people_crew_bids').select('person_name, crew_lead_person_name, bid_assignments').eq('work_date', yesterday),
    ])
    if (jobsRes.error || bidsRes.error) {
      setError(jobsRes.error?.message ?? bidsRes.error?.message ?? 'Failed to load yesterday')
      return
    }
    const jobsRows = (jobsRes.data ?? []) as Array<{
      person_name: string
      crew_lead_person_name: string | null
      job_assignments: Array<{ job_id: string; pct: number }>
    }>
    const bidsRows = (bidsRes.data ?? []) as Array<{
      person_name: string
      crew_lead_person_name: string | null
      bid_assignments: Array<{ bid_id: string; pct: number }>
    }>
    const bidsByPerson: Record<string, Array<{ bid_id: string; pct: number }>> = {}
    for (const r of bidsRows) {
      bidsByPerson[r.person_name] = Array.isArray(r.bid_assignments) ? r.bid_assignments : []
    }
    const allPersonNames = new Set([...jobsRows.map((r) => r.person_name), ...bidsRows.map((r) => r.person_name)])
    const toCopy = [...allPersonNames].filter((personName) => {
      const j = jobsRows.find((r) => r.person_name === personName)
      const b = bidsRows.find((r) => r.person_name === personName)
      const jobs = Array.isArray(j?.job_assignments) ? j.job_assignments : []
      const bids = bidsByPerson[personName] ?? []
      const crewLead = j?.crew_lead_person_name ?? b?.crew_lead_person_name
      const hasData = !!(crewLead || jobs.length > 0 || bids.length > 0)
      return hasData && showPeopleForMatrix.includes(personName)
    })
    if (toCopy.length === 0) {
      setError('No crew assignments for yesterday')
      return
    }
    setError(null)
    for (const personName of toCopy) {
      const j = jobsRows.find((r) => r.person_name === personName)
      const b = bidsRows.find((r) => r.person_name === personName)
      const jobs = Array.isArray(j?.job_assignments) ? j!.job_assignments : []
      const bids = bidsByPerson[personName] ?? []
      const unified = mergeToUnified(jobs, bids)
      const crewLead = j?.crew_lead_person_name ?? b?.crew_lead_person_name ?? null
      const row: CrewRow = {
        crew_lead_person_name: crewLead,
        unifiedAssignments: unified,
      }
      await saveCrewRow(personName, row)
    }
    await doLoadTeamLaborData()
    onCrewJobsChange?.()
  }

  function addAssignmentToPerson(
    personName: string,
    item:
      | { type: 'job'; id: string; hcp_number: string; job_name: string; job_address: string }
      | { type: 'bid'; id: string; bid_number: string; project_name: string; address: string }
  ) {
    const row = crewJobsData[personName] ?? { crew_lead_person_name: null, unifiedAssignments: [] }
    if (row.unifiedAssignments.some((a) => a.type === item.type && a.id === item.id)) return
    const n = row.unifiedAssignments.length + 1
    const pct = Math.round((100 / n) * 10) / 10
    const newAssignments = row.unifiedAssignments.map((a) => ({ ...a, pct }))
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
    saveCrewRow(personName, { ...row, unifiedAssignments: newAssignments })
    setCrewJobSearchModal(null)
    setCrewJobSearchText('')
    setCrewJobSearchResults([])
  }

  useEffect(() => {
    loadAccess()
  }, [authUser?.id])

  useEffect(() => {
    if (!canAccess && canEditProp === undefined) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([loadPayConfig(), loadHoursDisplayOrder()]).finally(() => setLoading(false))
  }, [canAccess, canEditProp])

  useEffect(() => {
    if (canAccess || canEditProp) loadCrewJobs(crewJobsDate)
  }, [canAccess, canEditProp, crewJobsDate])

  useEffect(() => {
    if (canAccess || canEditProp) doLoadTeamLaborData()
  }, [canAccess, canEditProp])

  useEffect(() => {
    const jobIds = new Set<string>()
    const bidIds = new Set<string>()
    for (const row of Object.values(crewJobsData)) {
      for (const a of row.unifiedAssignments) {
        if (a.type === 'job') jobIds.add(a.id)
        else bidIds.add(a.id)
      }
    }
    const missingJobs = [...jobIds].filter((id) => !crewJobDetailsMap[id])
    const missingBids = [...bidIds].filter((id) => !crewBidDetailsMap[id])
    if (missingJobs.length > 0) {
      supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: missingJobs }).then(({ data }) => {
        const map: Record<string, JobDetails> = {}
        for (const r of (data ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
          map[r.id] = { hcp_number: r.hcp_number ?? '', job_name: r.job_name ?? '', job_address: r.job_address ?? '' }
        }
        setCrewJobDetailsMap((prev) => ({ ...prev, ...map }))
      })
    }
    if (missingBids.length > 0) {
      supabase.rpc('get_bids_by_ids', { p_bid_ids: missingBids }).then(({ data }) => {
        const map: Record<string, BidDetails> = {}
        for (const r of (data ?? []) as { id: string; bid_number: string; project_name: string; address: string }[]) {
          map[r.id] = { bid_number: r.bid_number ?? '', project_name: r.project_name ?? '', address: r.address ?? '' }
        }
        setCrewBidDetailsMap((prev) => ({ ...prev, ...map }))
      })
    }
  }, [crewJobsData])

  useEffect(() => {
    const t = setTimeout(() => {
      if (crewJobSearchModal && crewJobSearchText !== undefined) {
        const q = crewJobSearchText.trim()
        Promise.all([
          supabase.rpc('search_jobs_ledger', { search_text: q }),
          supabase.rpc('search_bids_for_clock', { p_search_text: q }),
        ]).then(([jobsRes, bidsRes]) => {
          const jobs = (jobsRes.data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>
          const bidsRaw = (bidsRes.data ?? []) as Array<{ id: string; bid_number?: string; project_name: string; address: string }>
          const bids = bidsRaw.map((b) => ({ ...b, bid_number: b.bid_number ?? '' }))
          const merged = [
            ...jobs.map((j) => ({ type: 'job' as const, ...j })),
            ...bids.map((b) => ({ type: 'bid' as const, ...b })),
          ]
          setCrewJobSearchResults(merged)
        })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [crewJobSearchModal, crewJobSearchText])

  if (!canAccess && canEditProp === undefined) return null

  const hasAnyCrewToday = showPeopleForMatrix.some((p) => {
    const r = crewJobsData[p] ?? { crew_lead_person_name: null, unifiedAssignments: [] }
    return !!(r.crew_lead_person_name || (r.unifiedAssignments?.length ?? 0) > 0)
  })

  function getEffectiveAssignments(personName: string): UnifiedAssignment[] {
    const row = crewJobsData[personName] ?? { crew_lead_person_name: null, unifiedAssignments: [] }
    if (row.crew_lead_person_name) {
      const leadRow = crewJobsData[row.crew_lead_person_name]
      return leadRow?.unifiedAssignments ?? []
    }
    return row.unifiedAssignments ?? []
  }

  const crewJobsContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              const d = new Date(crewJobsDate + 'T12:00:00')
              d.setDate(d.getDate() - 1)
              setCrewJobsDate(d.toLocaleDateString('en-CA'))
            }}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
          >
            ←
          </button>
          <input
            type="date"
            value={crewJobsDate}
            onChange={(e) => setCrewJobsDate(e.target.value)}
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.9375rem', fontWeight: 500, border: '1px solid #d1d5db', borderRadius: 4, minWidth: 140 }}
          />
          {(() => {
            const { formatted, isTodayOrTomorrow } = formatDateWithRelativeLabel(crewJobsDate)
            return (
              <span
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  color: isTodayOrTomorrow ? '#b91c1c' : '#374151',
                }}
              >
                {formatted}
              </span>
            )
          })()}
          <button
            type="button"
            onClick={() => {
              const d = new Date(crewJobsDate + 'T12:00:00')
              d.setDate(d.getDate() + 1)
              setCrewJobsDate(d.toLocaleDateString('en-CA'))
            }}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
          >
            →
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideZeroHours} onChange={(e) => setHideZeroHours(e.target.checked)} />
            Hide users with zero hours
          </label>
        </div>
        {!crewJobsLoading && !hasAnyCrewToday && canEdit && (
          <button
            type="button"
            onClick={copyCrewFromYesterday}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Same team as yesterday
          </button>
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
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Hours</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Crew</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assignments</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeopleForCrew.map((personName) => {
                const row = crewJobsData[personName] ?? { crew_lead_person_name: null, unifiedAssignments: [] }
                const isCrewLeadByOthers = visiblePeopleForCrew.some((p) => crewJobsData[p]?.crew_lead_person_name === personName)
                const availableCrewLeads = visiblePeopleForCrew.filter((p) => p !== personName)
                const hasCrewLead = !!row.crew_lead_person_name
                const assignmentsEditable = canEdit && !hasCrewLead
                const crewEditable = canEdit && !isCrewLeadByOthers
                const day = new Date(crewJobsDate + 'T12:00:00').getDay()
                const cfg = payConfig[personName]
                const effectiveHours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (effectiveCrewHours[personName] ?? 0)
                const assignments = assignmentsEditable ? row.unifiedAssignments : getEffectiveAssignments(personName)
                return (
                  <tr key={personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem' }}>{personName}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>
                      {effectiveHours > 0 ? effectiveHours.toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', background: !crewEditable ? '#f3f4f6' : undefined }}>
                      {crewEditable ? (
                        <select
                          value={row.crew_lead_person_name ?? ''}
                          onChange={(e) => saveCrewRow(personName, { ...row, crew_lead_person_name: e.target.value || null })}
                          style={{ padding: '0.35rem 0.5rem', minWidth: 140, border: '1px solid #d1d5db', borderRadius: 4 }}
                        >
                          <option value="">—</option>
                          {availableCrewLeads.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ color: '#6b7280' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', background: !assignmentsEditable ? '#f3f4f6' : undefined }}>
                      {assignmentsEditable ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
                          {row.unifiedAssignments.map((a, idx) => {
                            const details = a.type === 'job' ? crewJobDetailsMap[a.id] : crewBidDetailsMap[a.id]
                            const label = formatAssignmentLabel(a.type, details) || a.id.slice(0, 8)
                            const titleAttr = a.type === 'job' ? (details as JobDetails)?.job_address : (details as BidDetails)?.address
                            return (
                              <span
                                key={getAssignmentKey(a)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.2rem 0.4rem',
                                  background: '#f3f4f6',
                                  borderRadius: 4,
                                  fontSize: '0.8125rem',
                                }}
                              >
                                <span title={titleAttr}>{label}</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={a.pct}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value) || 0
                                    const rest = row.unifiedAssignments.filter((_, i) => i !== idx)
                                    const restSum = rest.reduce((s, x) => s + x.pct, 0)
                                    const scale = restSum > 0 ? (100 - v) / restSum : 1
                                    let newAssignments = row.unifiedAssignments.map((x, i) =>
                                      i === idx ? { ...x, pct: v } : { ...x, pct: Math.round(x.pct * scale * 10) / 10 }
                                    )
                                    const sum = newAssignments.reduce((s, x) => s + x.pct, 0)
                                    if (Math.abs(sum - 100) > 0.01 && newAssignments.length > 0) {
                                      const lastIdx = newAssignments.length - 1
                                      newAssignments = newAssignments.map((x, i) =>
                                        i === lastIdx ? { ...x, pct: Math.round((x.pct + (100 - sum)) * 10) / 10 } : x
                                      )
                                    }
                                    saveCrewRow(personName, { ...row, unifiedAssignments: newAssignments })
                                  }}
                                  style={{ width: 44, padding: '0.15rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                />
                                %
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rest = row.unifiedAssignments.filter((_, i) => i !== idx)
                                    if (rest.length === 0) {
                                      saveCrewRow(personName, { ...row, unifiedAssignments: [] })
                                      return
                                    }
                                    const n = rest.length
                                    const pctEach = Math.round((100 / n) * 10) / 10
                                    const newAssignments = rest.map((x, i) => ({
                                      ...x,
                                      pct: i === n - 1 ? Math.round((100 - (n - 1) * pctEach) * 10) / 10 : pctEach,
                                    }))
                                    saveCrewRow(personName, { ...row, unifiedAssignments: newAssignments })
                                  }}
                                  style={{
                                    padding: '0.1rem 0.25rem',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    fontSize: '0.875rem',
                                    lineHeight: 1,
                                  }}
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              setCrewJobSearchModal({ personName })
                              setCrewJobSearchText('')
                              setCrewJobSearchResults([])
                            }}
                            style={{
                              padding: '0.2rem 0.5rem',
                              border: '1px dashed #d1d5db',
                              borderRadius: 4,
                              background: '#fff',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                          {assignments.length > 0
                            ? assignments
                                .map((a) => {
                                  const details = a.type === 'job' ? crewJobDetailsMap[a.id] : crewBidDetailsMap[a.id]
                                  return formatAssignmentLabel(a.type, details)
                                })
                                .join(', ')
                            : 'Inherits from crew lead'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )

  const teamLaborTable = (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="Search HCP, job name, address…"
          value={teamLaborSearch}
          onChange={(e) => setTeamLaborSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 400, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
        />
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
                {!hideJobCostColumn && <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Job Cost</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTeamLaborData
                .filter((r) => {
                  const q = teamLaborSearch.trim().toLowerCase()
                  if (!q) return true
                  return (
                    (r.hcpNumber ?? '').toLowerCase().includes(q) ||
                    (r.jobName ?? '').toLowerCase().includes(q) ||
                    (r.jobAddress ?? '').toLowerCase().includes(q)
                  )
                })
                .map((r) => (
                  <tr key={r.jobId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem' }}>{r.hcpNumber || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div>{r.jobName || '—'}</div>
                      {r.jobAddress && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{r.jobAddress}</div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{r.people.join(', ') || '—'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setBreakdownModal({ jobId: r.jobId, jobName: r.jobName, type: 'hours' })}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: '#2563eb',
                          textDecoration: 'underline',
                          fontSize: 'inherit',
                        }}
                      >
                        {r.manHours.toFixed(2)}
                      </button>
                    </td>
                    {!hideJobCostColumn && (
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setBreakdownModal({ jobId: r.jobId, jobName: r.jobName, type: 'cost' })}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: '#2563eb',
                            textDecoration: 'underline',
                            fontSize: 'inherit',
                          }}
                        >
                          ${formatCurrency(r.jobCost)}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
          {filteredTeamLaborData.length === 0 && (
            <p style={{ padding: '1rem', color: '#6b7280', margin: 0 }}>
              No team labor data yet. Add jobs or bids in Crew Jobs / Bids above.
            </p>
          )}
        </div>
      )}
    </>
  )

  return (
    <section style={{ marginBottom: '2rem' }}>
      {showTitle && (
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', textAlign: 'center' }}>Crew Jobs / Bids</h2>
      )}
      {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : (
        <>
          {showCrewJobsSection &&
            (collapsibleCrewJobs ? (
              <div style={{ marginBottom: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setCrewJobsSectionOpen((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    margin: 0,
                    padding: '1rem',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '0.75rem' }}>{crewJobsSectionOpen ? '▼' : '▶'}</span>
                  Crew Jobs / Bids
                </button>
                {crewJobsSectionOpen && <div style={{ padding: '0 1rem 1rem 1rem' }}>{crewJobsContent}</div>}
              </div>
            ) : (
              crewJobsContent
            ))}
          {showTeamLabor &&
            (collapsibleCrewJobs ? (
              <div style={{ marginTop: '1rem' }}>
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Team Job Labor</h2>
                {teamLaborTable}
              </div>
            ) : (
              <div style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setTeamLaborOpen((prev) => !prev)}
                  aria-expanded={teamLaborOpen}
                  style={{
                    margin: 0,
                    width: '100%',
                    fontSize: '1rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  <span aria-hidden>{teamLaborOpen ? '\u25BC' : '\u25B6'}</span>
                  Team Job Labor
                </button>
                {teamLaborOpen && <div style={{ marginTop: '0.75rem' }}>{teamLaborTable}</div>}
              </div>
            ))}
        </>
      )}

      {crewJobSearchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
        >
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Add job or bid for {crewJobSearchModal.personName}</h3>
            <input
              type="search"
              placeholder="Search HCP, bid #, job name, project, address…"
              value={crewJobSearchText}
              onChange={(e) => setCrewJobSearchText(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {crewJobSearchResults.map((item) => (
                <button
                  key={`${item.type}:${item.id}`}
                  type="button"
                  onClick={() =>
                    addAssignmentToPerson(
                      crewJobSearchModal!.personName,
                      item.type === 'job'
                        ? { type: 'job', id: item.id, hcp_number: item.hcp_number, job_name: item.job_name, job_address: item.job_address }
                        : { type: 'bid', id: item.id, bid_number: item.bid_number, project_name: item.project_name, address: item.address }
                    )
                  }
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid #e5e7eb',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
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
            <button
              type="button"
              onClick={() => {
                setCrewJobSearchModal(null)
                setCrewJobSearchText('')
                setCrewJobSearchResults([])
              }}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {breakdownModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
        >
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
              Crew {breakdownModal.type === 'hours' ? 'Man Hours' : 'Job Cost'} Breakdown for Job {breakdownModal.jobName}
            </h3>
            {(() => {
              const row = teamLaborData.find((r) => r.jobId === breakdownModal.jobId)
              if (!row) return <p style={{ color: '#6b7280' }}>No data</p>
              const items =
                breakdownModal.type === 'hours'
                  ? row.breakdown.map((b) => ({ ...b, value: b.hours }))
                  : row.breakdown.map((b) => ({ ...b, value: b.cost }))
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Person</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>{breakdownModal.type === 'hours' ? 'Hours' : 'Cost'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((b) => (
                      <tr key={b.personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem' }}>{b.personName}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          {breakdownModal.type === 'hours' ? b.value.toFixed(2) : `$${formatCurrency(b.value)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })()}
            <button type="button" onClick={() => setBreakdownModal(null)} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
