import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }

type JobWithDetails = JobsLedgerRow & {
  materials: JobsLedgerMaterial[]
  fixtures: JobsLedgerFixture[]
  team_members: (JobsLedgerTeamMember & { users: { name: string } | null })[]
}

type JobsTab = 'labor' | 'sub_sheet_ledger' | 'ledger' | 'teams-summary'

// Roster (for Labor / Sub Sheet Ledger)
type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type PersonKind = 'assistant' | 'master_technician' | 'sub' | 'estimator'
const KIND_TO_USER_ROLE: Record<PersonKind, string> = { assistant: 'assistant', master_technician: 'master_technician', sub: 'subcontractor', estimator: 'estimator' }

// Labor / Sub Sheet Ledger types
type ServiceType = { id: string; name: string; description: string | null; color: string | null; sequence_order: number; created_at: string; updated_at: string }
type LaborBookVersion = Database['public']['Tables']['labor_book_versions']['Row']
type LaborBookEntry = Database['public']['Tables']['labor_book_entries']['Row']
type LaborBookEntryWithFixture = LaborBookEntry & { fixture_types?: { name: string } | null }
type LaborFixtureRow = { id: string; fixture: string; count: number; hrs_per_unit: number; is_fixed: boolean }
type LaborJob = { id: string; assigned_to_name: string; address: string; job_number: string | null; labor_rate: number | null; job_date: string | null; created_at: string | null; items?: Array<{ fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean }> }

const tabStyle = (active: boolean) => ({
  padding: '0.75rem 1.5rem',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
})

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type MaterialRow = { id: string; description: string; amount: number }
type FixtureRow = { id: string; name: string; count: number }

const JOBS_TABS: JobsTab[] = ['ledger', 'labor', 'sub_sheet_ledger', 'teams-summary']

const LABOR_ASSIGNED_DELIMITER = ' | '

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: authUser } = useAuth()
  const [activeTab, setActiveTab] = useState<JobsTab>('ledger')
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<JobWithDetails | null>(null)
  const [hcpNumber, setHcpNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [revenue, setRevenue] = useState('')
  const [materials, setMaterials] = useState<MaterialRow[]>([{ id: crypto.randomUUID(), description: '', amount: 0 }])
  const [fixtures, setFixtures] = useState<FixtureRow[]>([{ id: crypto.randomUUID(), name: '', count: 1 }])
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Labor tab state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('')
  const [fixtureTypes, setFixtureTypes] = useState<Array<{ id: string; name: string }>>([])
  const [laborBookVersions, setLaborBookVersions] = useState<LaborBookVersion[]>([])
  const [selectedLaborBookVersionId, setSelectedLaborBookVersionId] = useState<string | null>(null)
  const [laborBookSectionOpen, setLaborBookSectionOpen] = useState(false)
  const [laborBookEntriesVersionId, setLaborBookEntriesVersionId] = useState<string | null>(null)
  const [laborBookEntries, setLaborBookEntries] = useState<LaborBookEntryWithFixture[]>([])
  const [applyingLaborBookHours, setApplyingLaborBookHours] = useState(false)
  const [laborBookApplyMessage, setLaborBookApplyMessage] = useState<string | null>(null)
  const [laborVersionFormOpen, setLaborVersionFormOpen] = useState(false)
  const [editingLaborVersion, setEditingLaborVersion] = useState<LaborBookVersion | null>(null)
  const [laborVersionNameInput, setLaborVersionNameInput] = useState('')
  const [savingLaborVersion, setSavingLaborVersion] = useState(false)
  const [laborEntryFormOpen, setLaborEntryFormOpen] = useState(false)
  const [editingLaborEntry, setEditingLaborEntry] = useState<LaborBookEntryWithFixture | null>(null)
  const [laborEntryFixtureName, setLaborEntryFixtureName] = useState('')
  const [laborEntryAliasNames, setLaborEntryAliasNames] = useState('')
  const [laborEntryRoughIn, setLaborEntryRoughIn] = useState('')
  const [laborEntryTopOut, setLaborEntryTopOut] = useState('')
  const [laborEntryTrimSet, setLaborEntryTrimSet] = useState('')
  const [savingLaborEntry, setSavingLaborEntry] = useState(false)
  const [laborAssignedTo, setLaborAssignedTo] = useState<string[]>([])
  const [laborAddress, setLaborAddress] = useState('')
  const [laborJobNumber, setLaborJobNumber] = useState('')
  const [laborRate, setLaborRate] = useState('')
  const [laborDate, setLaborDate] = useState('')
  const [laborFixtureRows, setLaborFixtureRows] = useState<LaborFixtureRow[]>([{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
  const [laborSaving, setLaborSaving] = useState(false)
  // Sub Sheet Ledger state
  const [laborJobs, setLaborJobs] = useState<LaborJob[]>([])
  const [laborJobsLoading, setLaborJobsLoading] = useState(false)
  const [laborJobDeletingId, setLaborJobDeletingId] = useState<string | null>(null)
  const [editingLaborJob, setEditingLaborJob] = useState<LaborJob | null>(null)
  const [editAssignedTo, setEditAssignedTo] = useState<string[]>([])
  const [editAddress, setEditAddress] = useState('')
  const [editJobNumber, setEditJobNumber] = useState('')
  const [editJobDate, setEditJobDate] = useState('')
  const [editLaborRate, setEditLaborRate] = useState('')
  const [editFixtureRows, setEditFixtureRows] = useState<LaborFixtureRow[]>([])
  const [editLaborSaving, setEditLaborSaving] = useState(false)

  async function loadJobs() {
    if (!authUser?.id) return
    setLoading(true)
    setError(null)
    const { data: jobsData, error: jobsErr } = await supabase
      .from('jobs_ledger')
      .select('*')
      .order('hcp_number', { ascending: false })
    if (jobsErr) {
      setError(jobsErr.message)
      setLoading(false)
      return
    }
    const jobList = (jobsData ?? []) as JobsLedgerRow[]
    if (jobList.length === 0) {
      setJobs([])
      setLoading(false)
      return
    }
    const jobIds = jobList.map((j) => j.id)
    const [matsRes, fixturesRes, teamRes] = await Promise.all([
      supabase.from('jobs_ledger_materials').select('*').in('job_id', jobIds).order('sequence_order'),
      supabase.from('jobs_ledger_fixtures').select('*').in('job_id', jobIds).order('sequence_order'),
      supabase
        .from('jobs_ledger_team_members')
        .select('*, users(name)')
        .in('job_id', jobIds),
    ])
    const materialsList = (matsRes.data ?? []) as JobsLedgerMaterial[]
    const fixturesList = (fixturesRes.data ?? []) as JobsLedgerFixture[]
    const teamList = (teamRes.data ?? []) as (JobsLedgerTeamMember & { users: { name: string } | null })[]
    const materialsByJob = new Map<string, JobsLedgerMaterial[]>()
    for (const m of materialsList) {
      const arr = materialsByJob.get(m.job_id) ?? []
      arr.push(m)
      materialsByJob.set(m.job_id, arr)
    }
    const fixturesByJob = new Map<string, JobsLedgerFixture[]>()
    for (const f of fixturesList) {
      const arr = fixturesByJob.get(f.job_id) ?? []
      arr.push(f)
      fixturesByJob.set(f.job_id, arr)
    }
    const teamByJob = new Map<string, (JobsLedgerTeamMember & { users: { name: string } | null })[]>()
    for (const t of teamList) {
      const arr = teamByJob.get(t.job_id) ?? []
      arr.push(t)
      teamByJob.set(t.job_id, arr)
    }
    const jobsWithDetails: JobWithDetails[] = jobList.map((j) => ({
      ...j,
      materials: (materialsByJob.get(j.id) ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      fixtures: (fixturesByJob.get(j.id) ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      team_members: teamByJob.get(j.id) ?? [],
    }))
    setJobs(jobsWithDetails)
    setLoading(false)
  }

  async function loadUsers() {
    if (!authUser?.id) return
    const [usersRes, meRes] = await Promise.all([
      supabase.from('users').select('id, name, email, role').in('role', ['assistant', 'master_technician', 'subcontractor', 'estimator']).order('name'),
      supabase.from('users').select('role').eq('id', authUser.id).single(),
    ])
    let usersList = (usersRes.data as UserRow[]) ?? []
    const myRole = (meRes.data as { role?: string } | null)?.role
    if (myRole === 'dev') {
      const { data: devUsers } = await supabase.from('users').select('id, name, email, role').eq('role', 'dev')
      if (devUsers?.length) {
        const existingIds = new Set(usersList.map((u) => u.id))
        const newDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
        usersList = [...usersList, ...newDevs]
      }
    }
    setUsers(usersList)
  }

  async function loadRoster() {
    if (!authUser?.id) return
    const { data: peopleData } = await supabase.from('people').select('id, master_user_id, kind, name, email, phone, notes').order('kind').order('name')
    setPeople((peopleData as Person[]) ?? [])
    await loadUsers()
  }

  function isAlreadyUser(email: string | null): boolean {
    if (!email?.trim()) return false
    const e = email.trim().toLowerCase()
    return users.some((u) => u.email && u.email.toLowerCase() === e)
  }

  function byKind(k: PersonKind): ({ source: 'user'; id: string; name: string; email: string | null } | ({ source: 'people' } & Person))[] {
    const userRole = KIND_TO_USER_ROLE[k]
    const fromUsers = users.filter((u) => u.role === userRole).map((u) => ({ source: 'user' as const, id: u.id, name: u.name, email: u.email }))
    const fromPeople = people.filter((p) => p.kind === k && !isAlreadyUser(p.email)).map((p) => ({ source: 'people' as const, ...p }))
    return [...fromUsers, ...fromPeople].sort((a, b) => a.name.localeCompare(b.name))
  }

  function rosterNamesSubcontractors(): string[] {
    return byKind('sub')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
      .sort((a, b) => a.localeCompare(b))
  }

  function rosterNamesEveryoneElse(): string[] {
    const result: string[] = []
    const seen = new Set<string>()
    const kindsExceptSub: PersonKind[] = ['master_technician', 'assistant', 'estimator']
    for (const k of kindsExceptSub) {
      const names = byKind(k)
        .map((item) => item.name?.trim())
        .filter((n): n is string => !!n && !seen.has(n))
      names.forEach((n) => seen.add(n))
      result.push(...names.sort((a, b) => a.localeCompare(b)))
    }
    const devNames = users
      .filter((u) => u.role === 'dev')
      .map((u) => u.name?.trim())
      .filter((n): n is string => !!n && !seen.has(n))
    devNames.forEach((n) => seen.add(n))
    result.push(...devNames.sort((a, b) => a.localeCompare(b)))
    return result
  }

  async function loadServiceTypes() {
    const { data, error } = await supabase.from('service_types' as any).select('*').order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load service types: ${error.message}`)
      return
    }
    const types = (data as unknown as ServiceType[]) ?? []
    setServiceTypes(types)
    const firstId = types[0]?.id
    if (firstId) setSelectedServiceTypeId((prev) => (prev && types.some((st) => st.id === prev) ? prev : firstId))
  }

  async function loadFixtureTypes() {
    if (!selectedServiceTypeId) return
    const { data } = await supabase.from('fixture_types').select('id, name').eq('service_type_id', selectedServiceTypeId).order('name', { ascending: true })
    if (data) setFixtureTypes(data)
  }

  async function loadLaborBookVersions() {
    if (!selectedServiceTypeId) return
    const { data, error } = await supabase.from('labor_book_versions').select('*').eq('service_type_id', selectedServiceTypeId).order('name', { ascending: true })
    if (error) {
      setError(`Failed to load labor book versions: ${error.message}`)
      return
    }
    const versions = (data as LaborBookVersion[]) ?? []
    setLaborBookVersions(versions)
    const defaultVersion = versions.find((v) => v.name === 'Default') ?? versions[0]
    if (defaultVersion) setSelectedLaborBookVersionId(defaultVersion.id)
  }

  async function loadLaborBookEntries(versionId: string | null) {
    if (!versionId) {
      setLaborBookEntries([])
      return
    }
    const { data, error } = await supabase
      .from('labor_book_entries')
      .select('*, fixture_types(name)')
      .eq('version_id', versionId)
      .order('sequence_order', { ascending: true })
      .order('fixture_types(name)', { ascending: true })
    if (error) {
      setError(`Failed to load labor book entries: ${error.message}`)
      setLaborBookEntries([])
      return
    }
    setLaborBookEntries((data as LaborBookEntryWithFixture[]) ?? [])
  }

  async function loadLaborJobs() {
    if (!authUser?.id) return
    setLaborJobsLoading(true)
    setError(null)
    const { data: jobs, error: jobsErr } = await supabase
      .from('people_labor_jobs')
      .select('id, assigned_to_name, address, job_number, labor_rate, job_date, created_at')
      .order('created_at', { ascending: false })
    if (jobsErr) {
      setError(jobsErr.message)
      setLaborJobs([])
    } else if (jobs?.length) {
      const jobIds = jobs.map((j) => j.id)
      const { data: items } = await supabase
        .from('people_labor_job_items')
        .select('job_id, fixture, count, hrs_per_unit, is_fixed')
        .in('job_id', jobIds)
        .order('sequence_order', { ascending: true })
      const itemsByJob = new Map<string, Array<{ fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean }>>()
      for (const it of (items ?? []) as Array<{ job_id: string; fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean }>) {
        if (!itemsByJob.has(it.job_id)) itemsByJob.set(it.job_id, [])
        itemsByJob.get(it.job_id)!.push({ fixture: it.fixture, count: it.count, hrs_per_unit: it.hrs_per_unit, is_fixed: it.is_fixed })
      }
      setLaborJobs(
        (jobs as LaborJob[]).map((j) => ({ ...j, items: itemsByJob.get(j.id) ?? [] }))
      )
    } else {
      setLaborJobs([])
    }
    setLaborJobsLoading(false)
  }

  function getFixtureTypeIdByName(name: string): string | null {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return null
    const match = fixtureTypes.find((ft) => ft.name.toLowerCase() === normalized)
    return match?.id ?? null
  }

  async function getOrCreateFixtureTypeId(name: string): Promise<string | null> {
    const trimmedName = name.trim()
    if (!trimmedName) return null
    if (!selectedServiceTypeId) return null
    const existingId = getFixtureTypeIdByName(trimmedName)
    if (existingId) return existingId
    const maxSeqResult = await supabase
      .from('fixture_types')
      .select('sequence_order')
      .eq('service_type_id', selectedServiceTypeId)
      .order('sequence_order', { ascending: false })
      .limit(1)
      .single()
    const nextSeq = (maxSeqResult.data?.sequence_order ?? 0) + 1
    const { data, error } = await supabase
      .from('fixture_types')
      .insert({
        service_type_id: selectedServiceTypeId,
        name: trimmedName,
        category: 'Other',
        sequence_order: nextSeq,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.error('Failed to create fixture type:', error)
      return null
    }
    await loadFixtureTypes()
    return data.id
  }

  async function applyLaborBookHoursToPeople() {
    if (!selectedLaborBookVersionId || laborFixtureRows.length === 0) return
    setLaborBookApplyMessage(null)
    setApplyingLaborBookHours(true)
    setError(null)
    try {
      const { data: entries, error: fetchErr } = await supabase
        .from('labor_book_entries')
        .select('fixture_type_id, alias_names, rough_in_hrs, top_out_hrs, trim_set_hrs, fixture_types(name)')
        .eq('version_id', selectedLaborBookVersionId)
        .order('sequence_order', { ascending: true })
      if (fetchErr) {
        setError(`Failed to load labor book entries: ${fetchErr.message}`)
        setApplyingLaborBookHours(false)
        return
      }
      const entriesByFixtureName = new Map<string, number>()
      for (const e of (entries as LaborBookEntryWithFixture[]) ?? []) {
        const total = Number(e.rough_in_hrs) + Number(e.top_out_hrs) + Number(e.trim_set_hrs)
        const primary = (e.fixture_types?.name ?? '').trim().toLowerCase()
        if (primary && !entriesByFixtureName.has(primary)) entriesByFixtureName.set(primary, total)
        for (const alias of e.alias_names ?? []) {
          const key = alias.trim().toLowerCase()
          if (key && !entriesByFixtureName.has(key)) entriesByFixtureName.set(key, total)
        }
      }
      setLaborFixtureRows((prev) =>
        prev.map((row) => {
          const fixtureName = (row.fixture ?? '').trim()
          if (!fixtureName) return row
          const matchedTotal = entriesByFixtureName.get(fixtureName.toLowerCase())
          if (matchedTotal != null) return { ...row, hrs_per_unit: matchedTotal }
          return row
        })
      )
      setLaborBookApplyMessage('Labor book hours applied.')
      setTimeout(() => setLaborBookApplyMessage(null), 3000)
    } finally {
      setApplyingLaborBookHours(false)
    }
  }

  function openEditLaborVersion(v: LaborBookVersion) {
    setEditingLaborVersion(v)
    setLaborVersionNameInput(v.name)
    setLaborVersionFormOpen(true)
  }

  function closeLaborVersionForm() {
    setLaborVersionFormOpen(false)
    setEditingLaborVersion(null)
    setLaborVersionNameInput('')
  }

  async function saveLaborVersion(e: React.FormEvent) {
    e.preventDefault()
    const name = laborVersionNameInput.trim()
    if (!name) return
    setSavingLaborVersion(true)
    setError(null)
    if (editingLaborVersion) {
      const { error: err } = await supabase.from('labor_book_versions').update({ name }).eq('id', editingLaborVersion.id)
      if (err) setError(err.message)
      else {
        await loadLaborBookVersions()
        closeLaborVersionForm()
      }
    } else {
      const { error: err } = await supabase.from('labor_book_versions').insert({ name, service_type_id: selectedServiceTypeId })
      if (err) setError(err.message)
      else {
        await loadLaborBookVersions()
        closeLaborVersionForm()
      }
    }
    setSavingLaborVersion(false)
  }

  async function deleteLaborVersion(v: LaborBookVersion) {
    if (!confirm(`Delete labor book "${v.name}"? This will delete all entries in this version.`)) return
    const { error: err } = await supabase.from('labor_book_versions').delete().eq('id', v.id)
    if (err) setError(err.message)
    else {
      await loadLaborBookVersions()
      if (laborBookEntriesVersionId === v.id) {
        setLaborBookEntriesVersionId(null)
        setLaborBookEntries([])
      }
      if (selectedLaborBookVersionId === v.id) setSelectedLaborBookVersionId(null)
    }
  }

  function openNewLaborVersion() {
    setEditingLaborVersion(null)
    setLaborVersionNameInput('')
    setLaborVersionFormOpen(true)
  }

  function openNewLaborEntry() {
    setEditingLaborEntry(null)
    setLaborEntryFixtureName('')
    setLaborEntryAliasNames('')
    setLaborEntryRoughIn('')
    setLaborEntryTopOut('')
    setLaborEntryTrimSet('')
    setError(null)
    setLaborEntryFormOpen(true)
  }

  function openEditLaborEntry(entry: LaborBookEntryWithFixture) {
    setEditingLaborEntry(entry)
    setLaborEntryFixtureName(entry.fixture_types?.name ?? '')
    setLaborEntryAliasNames((entry.alias_names ?? []).join(', '))
    setLaborEntryRoughIn(String(entry.rough_in_hrs))
    setLaborEntryTopOut(String(entry.top_out_hrs))
    setLaborEntryTrimSet(String(entry.trim_set_hrs))
    setError(null)
    setLaborEntryFormOpen(true)
  }

  function closeLaborEntryForm() {
    setLaborEntryFormOpen(false)
    setEditingLaborEntry(null)
    setLaborEntryFixtureName('')
    setLaborEntryAliasNames('')
    setLaborEntryRoughIn('')
    setLaborEntryTopOut('')
    setLaborEntryTrimSet('')
    setError(null)
  }

  async function saveLaborEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!laborBookEntriesVersionId) {
      setError('No labor book version selected')
      return
    }
    const fixtureName = laborEntryFixtureName.trim()
    if (!fixtureName) {
      setError('Please enter a fixture type')
      return
    }
    setSavingLaborEntry(true)
    setError(null)
    const fixtureTypeId = await getOrCreateFixtureTypeId(fixtureName)
    if (!fixtureTypeId) {
      setError(`Failed to create or find fixture type "${fixtureName}"`)
      setSavingLaborEntry(false)
      return
    }
    const aliasNames = laborEntryAliasNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const rough = parseFloat(laborEntryRoughIn) || 0
    const top = parseFloat(laborEntryTopOut) || 0
    const trim = parseFloat(laborEntryTrimSet) || 0
    if (editingLaborEntry) {
      const { error: err } = await supabase
        .from('labor_book_entries')
        .update({ fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim })
        .eq('id', editingLaborEntry.id)
      if (err) setError(err.message)
      else {
        await loadLaborBookEntries(laborBookEntriesVersionId)
        closeLaborEntryForm()
      }
    } else {
      const maxSeq = laborBookEntries.length === 0 ? 0 : Math.max(...laborBookEntries.map((e) => e.sequence_order))
      const { error: err } = await supabase
        .from('labor_book_entries')
        .insert({ version_id: laborBookEntriesVersionId, fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim, sequence_order: maxSeq + 1 })
      if (err) setError(err.message)
      else {
        await loadLaborBookEntries(laborBookEntriesVersionId)
        closeLaborEntryForm()
      }
    }
    setSavingLaborEntry(false)
  }

  async function deleteLaborEntry(entry: LaborBookEntryWithFixture) {
    if (!confirm(`Delete "${entry.fixture_types?.name ?? ''}" from this labor book?`)) return
    const { error: err } = await supabase.from('labor_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (laborBookEntriesVersionId) await loadLaborBookEntries(laborBookEntriesVersionId)
  }

  function addLaborFixtureRow() {
    setLaborFixtureRows((prev) => [...prev, { id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
  }

  function removeLaborFixtureRow(id: string) {
    setLaborFixtureRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  }

  function updateLaborFixtureRow(id: string, updates: Partial<LaborFixtureRow>) {
    setLaborFixtureRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  async function saveLaborJob() {
    if (!authUser?.id) return
    const assignedNames = laborAssignedTo.map((n) => n.trim()).filter(Boolean)
    const assigned = assignedNames.join(LABOR_ASSIGNED_DELIMITER)
    const address = laborAddress.trim()
    if (assignedNames.length === 0) {
      setError('Select at least one user.')
      return
    }
    if (!address) {
      setError('Address is required.')
      return
    }
    const validRows = laborFixtureRows.filter((r) => {
      const hasFixture = (r.fixture ?? '').trim()
      const isFixed = r.is_fixed ?? false
      return hasFixture && (isFixed ? Number(r.hrs_per_unit) >= 0 : Number(r.count) > 0)
    })
    if (validRows.length === 0) {
      setError('Add at least one fixture or tie-in with count > 0.')
      return
    }
    setLaborSaving(true)
    setError(null)
    const laborRateNum = laborRate.trim() === '' ? null : parseFloat(laborRate) || null
    const { data: job, error: jobErr } = await supabase
      .from('people_labor_jobs')
      .insert({
        master_user_id: authUser.id,
        assigned_to_name: assigned,
        address,
        job_number: laborJobNumber.trim().slice(0, 10) || null,
        labor_rate: laborRateNum,
        job_date: laborDate.trim() ? laborDate.trim() : null,
      })
      .select('id')
      .single()
    if (jobErr) {
      setError(jobErr.message)
      setLaborSaving(false)
      return
    }
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i]!
      const { error: itemErr } = await supabase.from('people_labor_job_items').insert({
        job_id: job.id,
        fixture: r.fixture.trim(),
        count: Number(r.count) || 1,
        hrs_per_unit: Number(r.hrs_per_unit) || 0,
        is_fixed: r.is_fixed ?? false,
        sequence_order: i + 1,
      })
      if (itemErr) {
        setError(itemErr.message)
        setLaborSaving(false)
        return
      }
    }
    setLaborAssignedTo([])
    setLaborAddress('')
    setLaborJobNumber('')
    setLaborRate('')
    setLaborDate('')
    setLaborFixtureRows([{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
    setLaborSaving(false)
    setActiveTab('sub_sheet_ledger')
    await loadLaborJobs()
  }

  async function deleteLaborJob(id: string) {
    if (!confirm('Delete this job from the sub sheet ledger?')) return
    setLaborJobDeletingId(id)
    setError(null)
    const { error: err } = await supabase.from('people_labor_jobs').delete().eq('id', id)
    if (err) setError(err.message)
    else await loadLaborJobs()
    setLaborJobDeletingId(null)
  }

  async function updateLaborJobDate(jobId: string, jobDate: string | null) {
    setError(null)
    const { error: err } = await supabase.from('people_labor_jobs').update({ job_date: jobDate || null }).eq('id', jobId)
    if (err) setError(err.message)
    else {
      setLaborJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, job_date: jobDate } : j)))
    }
  }

  function openEditLaborJob(job: LaborJob) {
    setEditingLaborJob(job)
    const names = job.assigned_to_name
      ? job.assigned_to_name.split(LABOR_ASSIGNED_DELIMITER).map((s) => s.trim()).filter(Boolean)
      : []
    setEditAssignedTo(names)
    setEditAddress(job.address)
    setEditJobNumber(job.job_number ?? '')
    setEditJobDate(job.job_date ?? '')
    setEditLaborRate(job.labor_rate != null ? String(job.labor_rate) : '')
    const rows = (job.items ?? []).map((i) => ({
      id: crypto.randomUUID(),
      fixture: i.fixture ?? '',
      count: Number(i.count) || 1,
      hrs_per_unit: Number(i.hrs_per_unit) || 0,
      is_fixed: i.is_fixed ?? false,
    }))
    setEditFixtureRows(rows.length > 0 ? rows : [{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
    setError(null)
  }

  function closeEditLaborJob() {
    setEditingLaborJob(null)
    setEditAssignedTo([])
    setEditAddress('')
    setEditJobNumber('')
    setEditJobDate('')
    setEditLaborRate('')
    setEditFixtureRows([])
  }

  function addEditFixtureRow() {
    setEditFixtureRows((prev) => [...prev, { id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
  }

  function removeEditFixtureRow(id: string) {
    setEditFixtureRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  }

  function updateEditFixtureRow(id: string, updates: Partial<LaborFixtureRow>) {
    setEditFixtureRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  async function saveEditedLaborJob(e: React.FormEvent) {
    e.preventDefault()
    if (!editingLaborJob) return
    const assignedNames = editAssignedTo.map((n) => n.trim()).filter(Boolean)
    const assigned = assignedNames.join(LABOR_ASSIGNED_DELIMITER)
    const address = editAddress.trim()
    if (assignedNames.length === 0) {
      setError('Select at least one user.')
      return
    }
    if (!address) {
      setError('Address is required.')
      return
    }
    const validRows = editFixtureRows.filter((r) => {
      const hasFixture = (r.fixture ?? '').trim()
      const isFixed = r.is_fixed ?? false
      return hasFixture && (isFixed ? Number(r.hrs_per_unit) >= 0 : Number(r.count) > 0)
    })
    if (validRows.length === 0) {
      setError('Add at least one fixture or tie-in with count > 0.')
      return
    }
    setEditLaborSaving(true)
    setError(null)
    const laborRateNum = editLaborRate.trim() === '' ? null : parseFloat(editLaborRate) || null
    const { error: jobErr } = await supabase
      .from('people_labor_jobs')
      .update({
        assigned_to_name: assigned,
        address,
        job_number: editJobNumber.trim().slice(0, 10) || null,
        labor_rate: laborRateNum,
        job_date: editJobDate.trim() ? editJobDate.trim() : null,
      })
      .eq('id', editingLaborJob.id)
    if (jobErr) {
      setError(jobErr.message)
      setEditLaborSaving(false)
      return
    }
    const { error: delErr } = await supabase.from('people_labor_job_items').delete().eq('job_id', editingLaborJob.id)
    if (delErr) {
      setError(delErr.message)
      setEditLaborSaving(false)
      return
    }
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i]!
      const { error: itemErr } = await supabase.from('people_labor_job_items').insert({
        job_id: editingLaborJob.id,
        fixture: r.fixture.trim(),
        count: Number(r.count) || 1,
        hrs_per_unit: Number(r.hrs_per_unit) || 0,
        is_fixed: r.is_fixed ?? false,
        sequence_order: i + 1,
      })
      if (itemErr) {
        setError(itemErr.message)
        setEditLaborSaving(false)
        return
      }
    }
    setEditLaborSaving(false)
    closeEditLaborJob()
    await loadLaborJobs()
  }

  function printLaborSubSheet() {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateStr = new Date().toLocaleDateString()
    const assignedLabel = laborAssignedTo.length > 0 ? laborAssignedTo.join(', ') : 'Labor'
    const title = escapeHtml(assignedLabel) + ' — ' + escapeHtml(laborAddress || 'Job') + ' — ' + dateStr
    const rate = laborRate.trim() === '' ? 0 : parseFloat(laborRate) || 0

    const validRows = laborFixtureRows.filter((r) => (r.fixture ?? '').trim())
    const laborRowsHtml =
      validRows.length === 0
        ? '<tr><td colspan="4" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : validRows
            .map((row) => {
              const hrs = Number(row.hrs_per_unit) || 0
              const laborHrs = (row.is_fixed ?? false) ? hrs : (Number(row.count) || 0) * hrs
              const totalCost = rate * laborHrs
              return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${Number(row.count)}</td><td style="text-align:right">${laborHrs.toFixed(2)}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            })
            .join('')

    let totalCost = 0
    if (validRows.length > 0) {
      totalCost = validRows.reduce((sum, row) => {
        const hrs = Number(row.hrs_per_unit) || 0
        const laborHrs = (row.is_fixed ?? false) ? hrs : (Number(row.count) || 0) * hrs
        return sum + rate * laborHrs
      }, 0)
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th style="text-align:right">Labor Hours</th><th style="text-align:right">Rate</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="3" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
  </table>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printJobSubSheet(job: LaborJob) {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateStr = job.job_date ? new Date(job.job_date + 'T12:00:00').toLocaleDateString() : (job.created_at ? new Date(job.created_at).toLocaleDateString() : new Date().toLocaleDateString())
    const jobNumPart = job.job_number ? escapeHtml(job.job_number) + ' — ' : ''
    const title = escapeHtml(job.assigned_to_name) + ' — ' + jobNumPart + escapeHtml(job.address) + ' — ' + dateStr
    const rate = job.labor_rate ?? 0

    const items = job.items ?? []
    const laborRowsHtml =
      items.length === 0
        ? '<tr><td colspan="4" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : items
            .map((i) => {
              const hrs = Number(i.hrs_per_unit) || 0
              const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
              const totalCost = rate * laborHrs
              return `<tr><td>${escapeHtml(i.fixture ?? '')}</td><td style="text-align:center">${Number(i.count)}</td><td style="text-align:right">${laborHrs.toFixed(2)}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            })
            .join('')

    let totalCost = 0
    if (items.length > 0) {
      totalCost = items.reduce((sum, i) => {
        const hrs = Number(i.hrs_per_unit) || 0
        const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
        return sum + rate * laborHrs
      }, 0)
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th style="text-align:right">Labor Hours</th><th style="text-align:right">Rate</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="3" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
  </table>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  useEffect(() => {
    loadJobs()
    loadUsers()
  }, [authUser?.id])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && JOBS_TABS.includes(tab as JobsTab)) {
      setActiveTab(tab as JobsTab)
    } else if (!tab) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'labor')
        return next
      }, { replace: true })
    }
  }, [searchParams])

  useEffect(() => {
    if (activeTab === 'labor' || activeTab === 'sub_sheet_ledger') loadRoster()
  }, [authUser?.id, activeTab])

  useEffect(() => {
    if (activeTab === 'labor') loadServiceTypes()
  }, [authUser?.id, activeTab])

  useEffect(() => {
    if (selectedServiceTypeId && authUser?.id && activeTab === 'labor') {
      setLaborBookEntriesVersionId(null)
      loadFixtureTypes()
      loadLaborBookVersions()
    }
  }, [selectedServiceTypeId, authUser?.id, activeTab])

  useEffect(() => {
    if (laborBookEntriesVersionId) loadLaborBookEntries(laborBookEntriesVersionId)
    else setLaborBookEntries([])
  }, [laborBookEntriesVersionId])

  useEffect(() => {
    if (activeTab === 'sub_sheet_ledger' && authUser?.id) loadLaborJobs()
  }, [activeTab, authUser?.id])

  const filteredJobs = jobs.filter((j) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (j.hcp_number ?? '').toLowerCase().includes(q) ||
      (j.job_name ?? '').toLowerCase().includes(q) ||
      (j.job_address ?? '').toLowerCase().includes(q)
    )
  })

  function openNew() {
    setEditing(null)
    setHcpNumber('')
    setJobName('')
    setJobAddress('')
    setRevenue('')
    setMaterials([{ id: crypto.randomUUID(), description: '', amount: 0 }])
    setFixtures([{ id: crypto.randomUUID(), name: '', count: 1 }])
    setTeamMemberIds([])
    setFormOpen(true)
  }

  function openEdit(job: JobWithDetails) {
    setEditing(job)
    setHcpNumber(job.hcp_number ?? '')
    setJobName(job.job_name ?? '')
    setJobAddress(job.job_address ?? '')
    setRevenue(job.revenue != null ? String(job.revenue) : '')
    setMaterials(
      job.materials.length > 0
        ? job.materials.map((m) => ({ id: m.id, description: m.description, amount: Number(m.amount) }))
        : [{ id: crypto.randomUUID(), description: '', amount: 0 }]
    )
    setFixtures(
      job.fixtures.length > 0
        ? job.fixtures.map((f) => ({ id: f.id, name: f.name, count: Number(f.count) || 1 }))
        : [{ id: crypto.randomUUID(), name: '', count: 1 }]
    )
    setTeamMemberIds(job.team_members.map((t) => t.user_id))
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  function addMaterialRow() {
    setMaterials((prev) => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }])
  }

  function updateMaterialRow(id: string, updates: Partial<MaterialRow>) {
    setMaterials((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  function removeMaterialRow(id: string) {
    setMaterials((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }

  function addFixtureRow() {
    setFixtures((prev) => [...prev, { id: crypto.randomUUID(), name: '', count: 1 }])
  }

  function updateFixtureRow(id: string, updates: Partial<FixtureRow>) {
    setFixtures((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  function removeFixtureRow(id: string) {
    setFixtures((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }

  function fillLaborFromBilling() {
    const hcp = laborJobNumber.trim()
    if (!hcp) return
    const match = jobs.find((j) => (j.hcp_number ?? '').trim().toLowerCase() === hcp.toLowerCase())
    if (!match) return
    setLaborAddress(match.job_address ?? '')
    const rosterNames = [...rosterNamesSubcontractors(), ...rosterNamesEveryoneElse()]
    const teamNames = (match.team_members ?? [])
      .map((t) => t.users?.name?.trim())
      .filter((n): n is string => !!n && rosterNames.includes(n))
    setLaborAssignedTo(teamNames)
  }

  async function saveJob() {
    if (!authUser?.id) return
    setSaving(true)
    setError(null)
    const revNum = revenue.trim() === '' ? null : parseFloat(revenue)
    const validMaterials = materials.filter((m) => (m.description ?? '').trim() !== '' || Number(m.amount) !== 0)
    try {
      if (editing) {
        await supabase
          .from('jobs_ledger')
          .update({ hcp_number: hcpNumber.trim(), job_name: jobName.trim(), job_address: jobAddress.trim(), revenue: revNum })
          .eq('id', editing.id)
        await supabase.from('jobs_ledger_materials').delete().eq('job_id', editing.id)
        for (const [i, m] of validMaterials.entries()) {
          await supabase.from('jobs_ledger_materials').insert({
            job_id: editing.id,
            description: m.description.trim(),
            amount: m.amount,
            sequence_order: i,
          })
        }
        await supabase.from('jobs_ledger_fixtures').delete().eq('job_id', editing.id)
        const validFixtures = fixtures.filter((f) => (f.name ?? '').trim())
        for (const [i, f] of validFixtures.entries()) {
          await supabase.from('jobs_ledger_fixtures').insert({
            job_id: editing.id,
            name: f.name.trim(),
            count: f.count,
            sequence_order: i,
          })
        }
        const { data: existingTeam } = await supabase.from('jobs_ledger_team_members').select('user_id').eq('job_id', editing.id)
        const existingTeamIds = new Set((existingTeam ?? []).map((t: { user_id: string }) => t.user_id))
        const toAdd = teamMemberIds.filter((id) => !existingTeamIds.has(id))
        const toRemove = [...existingTeamIds].filter((id) => !teamMemberIds.includes(id))
        for (const uid of toAdd) {
          await supabase.from('jobs_ledger_team_members').insert({ job_id: editing.id, user_id: uid })
        }
        for (const uid of toRemove) {
          await supabase.from('jobs_ledger_team_members').delete().eq('job_id', editing.id).eq('user_id', uid)
        }
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('jobs_ledger')
          .insert({
            master_user_id: authUser.id,
            hcp_number: hcpNumber.trim(),
            job_name: jobName.trim(),
            job_address: jobAddress.trim(),
            revenue: revNum,
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        const jobId = inserted?.id
        if (jobId) {
          for (const [i, m] of validMaterials.entries()) {
            await supabase.from('jobs_ledger_materials').insert({
              job_id: jobId,
              description: m.description.trim(),
              amount: m.amount,
              sequence_order: i,
            })
          }
          const validFixtures = fixtures.filter((f) => (f.name ?? '').trim())
          for (const [i, f] of validFixtures.entries()) {
            await supabase.from('jobs_ledger_fixtures').insert({
              job_id: jobId,
              name: f.name.trim(),
              count: f.count,
              sequence_order: i,
            })
          }
          for (const uid of teamMemberIds) {
            await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
          }
        }
      }
      closeForm()
      await loadJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deleteJob(id: string) {
    setDeletingId(id)
    const { error: err } = await supabase.from('jobs_ledger').delete().eq('id', id)
    if (err) setError(err.message)
    else await loadJobs()
    setDeletingId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('ledger')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'ledger')
              return next
            })
          }}
          style={tabStyle(activeTab === 'ledger')}
        >
          Billing
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('labor')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'labor')
              return next
            })
          }}
          style={tabStyle(activeTab === 'labor')}
        >
          Labor
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('sub_sheet_ledger')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'sub_sheet_ledger')
              return next
            })
          }}
          style={tabStyle(activeTab === 'sub_sheet_ledger')}
        >
          Labor Ledger
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('teams-summary')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'teams-summary')
              return next
            })
          }}
          style={tabStyle(activeTab === 'teams-summary')}
        >
          Teams Summary
        </button>
      </div>

      {activeTab === 'labor' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 720 }}>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, marginBottom: '0.25rem' }}>calculate, save, and match the labor rate for a job</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 120px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                  <label style={{ fontWeight: 500, margin: 0 }}>HCP</label>
                  <button
                    type="button"
                    onClick={fillLaborFromBilling}
                    disabled={!laborJobNumber.trim()}
                    title="Fill Contractors and Address from Billing if HCP matches"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: laborJobNumber.trim() ? 'pointer' : 'default',
                      fontSize: '0.8125rem',
                      color: laborJobNumber.trim() ? '#2563eb' : '#9ca3af',
                    }}
                  >
                    fill
                  </button>
                </div>
                <input
                  type="text"
                  value={laborJobNumber}
                  onChange={(e) => setLaborJobNumber(e.target.value)}
                  maxLength={10}
                  placeholder="Optional"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Address</label>
                <input
                  type="text"
                  value={laborAddress}
                  onChange={(e) => setLaborAddress(e.target.value)}
                  placeholder="Job address"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Subcontractors</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 100, overflowY: 'auto' }}>
                    {rosterNamesSubcontractors().map((n) => (
                      <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={laborAssignedTo.includes(n)}
                          onChange={() => setLaborAssignedTo((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
                          style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                        />
                        <span>{n}</span>
                      </label>
                    ))}
                    {rosterNamesSubcontractors().length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>None</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Everyone else</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 100, overflowY: 'auto' }}>
                    {rosterNamesEveryoneElse().map((n) => (
                      <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={laborAssignedTo.includes(n)}
                          onChange={() => setLaborAssignedTo((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
                          style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                        />
                        <span>{n}</span>
                      </label>
                    ))}
                    {rosterNamesEveryoneElse().length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>None</span>}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture /Tie-ins (Line Items)</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>hrs/unit</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>_</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Labor Hours</th>
                      <th style={{ padding: '0.5rem 0.75rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {laborFixtureRows.map((row) => {
                      const hrsPerUnit = Number(row.hrs_per_unit) || 0
                      const laborHrs = (row.is_fixed ?? false) ? hrsPerUnit : (Number(row.count) || 0) * hrsPerUnit
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input
                              type="text"
                              value={row.fixture}
                              onChange={(e) => updateLaborFixtureRow(row.id, { fixture: e.target.value })}
                              placeholder="e.g. Toilet, Sink"
                              style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={row.count || ''}
                              onChange={(e) => updateLaborFixtureRow(row.id, { count: parseFloat(e.target.value) || 0 })}
                              style={{ width: '4rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="number"
                              min={0}
                              step={0.25}
                              value={row.hrs_per_unit || ''}
                              onChange={(e) => updateLaborFixtureRow(row.id, { hrs_per_unit: parseFloat(e.target.value) || 0 })}
                              style={{ width: '4rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                type="checkbox"
                                checked={!!row.is_fixed}
                                onChange={(e) => updateLaborFixtureRow(row.id, { is_fixed: e.target.checked })}
                                style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                              />
                              <span style={{ color: '#6b7280' }}>fixed</span>
                            </label>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 500 }}>{laborHrs.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <button type="button" onClick={() => removeLaborFixtureRow(row.id)} disabled={laborFixtureRows.length <= 1} style={{ padding: '0.25rem', background: '#fee2e2', color: '#991b1c', border: 'none', borderRadius: 4, cursor: laborFixtureRows.length <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>Totals</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }} />
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }} />
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }} />
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                        {laborFixtureRows.reduce((s, r) => {
                          const hrs = Number(r.hrs_per_unit) || 0
                          return s + ((r.is_fixed ?? false) ? hrs : (Number(r.count) || 0) * hrs)
                        }, 0).toFixed(2)} hrs
                      </td>
                      <td style={{ padding: '0.5rem' }} />
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={addLaborFixtureRow} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                  Add additional fixture or tie-in
                </button>
              </div>
              {laborRate.trim() !== '' && !isNaN(parseFloat(laborRate)) && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Total labor cost: ${formatCurrency(
                    laborFixtureRows.reduce((s, r) => {
                      const hrs = Number(r.hrs_per_unit) || 0
                      return s + ((r.is_fixed ?? false) ? hrs : (Number(r.count) || 0) * hrs)
                    }, 0) * (parseFloat(laborRate) || 0)
                  )}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {serviceTypes.length > 1 && (
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Service type</label>
                  <select
                    value={selectedServiceTypeId}
                    onChange={(e) => setSelectedServiceTypeId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Labor rate ($/hr)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={laborRate}
                  onChange={(e) => setLaborRate(e.target.value)}
                  placeholder="Optional"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date</label>
                <input
                  type="date"
                  value={laborDate}
                  onChange={(e) => setLaborDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={saveLaborJob}
                disabled={laborSaving || laborAssignedTo.length === 0 || !laborAddress.trim() || laborFixtureRows.every((r) => {
                  const hasFixture = (r.fixture ?? '').trim()
                  const isFixed = r.is_fixed ?? false
                  return !hasFixture || (!isFixed && Number(r.count) <= 0)
                })}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: laborSaving ? 'not-allowed' : 'pointer' }}
              >
                {laborSaving ? 'Saving…' : 'Save Job'}
              </button>
              <button
                type="button"
                onClick={printLaborSubSheet}
                style={{ padding: '0.5rem 1rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Print
              </button>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setLaborBookSectionOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  margin: 0,
                  marginBottom: laborBookSectionOpen ? '0.75rem' : 0,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '0.75rem' }}>{laborBookSectionOpen ? '▼' : '▶'}</span>
                Labor book
              </button>
              {laborBookSectionOpen && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.875rem', marginRight: '0.5rem' }}>Version</label>
                      <select
                        value={selectedLaborBookVersionId ?? ''}
                        onChange={(e) => setSelectedLaborBookVersionId(e.target.value || null)}
                        style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '12rem' }}
                      >
                        {laborBookVersions.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    {laborFixtureRows.some((r) => (r.fixture ?? '').trim()) && selectedLaborBookVersionId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={applyLaborBookHoursToPeople}
                          disabled={applyingLaborBookHours}
                          style={{
                            padding: '0.35rem 0.75rem',
                            background: applyingLaborBookHours ? '#9ca3af' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: applyingLaborBookHours ? 'wait' : 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          {applyingLaborBookHours ? 'Applying…' : 'Apply matching Labor Hours'}
                        </button>
                        {laborBookApplyMessage && (
                          <span style={{ color: '#059669', fontSize: '0.875rem' }}>{laborBookApplyMessage}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {laborBookVersions.map((v) => (
                      <span
                        key={v.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.35rem 0.5rem',
                          background: laborBookEntriesVersionId === v.id ? '#dbeafe' : '#f3f4f6',
                          border: laborBookEntriesVersionId === v.id ? '1px solid #3b82f6' : '1px solid #d1d5db',
                          borderRadius: 4,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => { setLaborBookEntriesVersionId(v.id); loadLaborBookEntries(v.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: laborBookEntriesVersionId === v.id ? 600 : 400, padding: 0 }}
                        >
                          {v.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditLaborVersion(v)}
                          style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                          title="Edit version name"
                        >
                          ✎
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={openNewLaborVersion}
                      style={{ padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Add version
                    </button>
                  </div>
                  {laborBookEntriesVersionId && (
                    <>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries (hrs per stage)</h4>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ background: '#f9fafb' }}>
                            <tr>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rough In (hrs)</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Top Out (hrs)</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Trim Set (hrs)</th>
                              <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                            </tr>
                          </thead>
                          <tbody>
                            {laborBookEntries.map((entry) => (
                              <tr key={entry.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.5rem' }}>
                                  {entry.fixture_types?.name ?? ''}
                                  {entry.alias_names?.length ? (
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
                                  ) : null}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.rough_in_hrs)}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.top_out_hrs)}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.trim_set_hrs)}</td>
                                <td style={{ padding: '0.5rem' }}>
                                  <button type="button" onClick={() => openEditLaborEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        type="button"
                        onClick={openNewLaborEntry}
                        style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                      >
                        Add entry
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sub_sheet_ledger' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {laborJobsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading sub sheet ledger…</p>
          ) : laborJobs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No jobs yet. Add one in the Labor tab.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>User</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Labor rate</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total hrs</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Sub Sheet</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                    <th style={{ padding: '0.75rem', width: 80, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {laborJobs.map((job) => {
                    const totalHrs = (job.items ?? []).reduce((s, i) => {
                      const hrs = Number(i.hrs_per_unit) || 0
                      return s + ((i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs)
                    }, 0)
                    const rate = job.labor_rate ?? 0
                    const totalCost = totalHrs * rate
                    const dateInputValue = job.job_date ?? (job.created_at ? job.created_at.slice(0, 10) : '')
                    return (
                      <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{job.assigned_to_name}</td>
                        <td style={{ padding: '0.75rem' }}>{job.job_number ?? '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{job.address}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{job.labor_rate != null ? `$${formatCurrency(job.labor_rate)}/hr` : '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalHrs.toFixed(2)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{rate > 0 ? `$${formatCurrency(totalCost)}` : '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button type="button" onClick={() => printJobSubSheet(job)} style={{ padding: '0.25rem 0.5rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                            Print
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <input
                            type="date"
                            value={dateInputValue}
                            onChange={(e) => updateLaborJobDate(job.id, e.target.value || null)}
                            style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', display: 'flex', gap: '0.35rem' }}>
                          <button type="button" onClick={() => openEditLaborJob(job)} style={{ padding: '0.25rem 0.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteLaborJob(job.id)} disabled={laborJobDeletingId === job.id} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#991b1c', border: 'none', borderRadius: 4, cursor: laborJobDeletingId === job.id ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>
                            {laborJobDeletingId === job.id ? '…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ledger' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={openNew}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              New Job
            </button>
            <input
              type="search"
              placeholder="Search jobs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: '1 1 200px',
                minWidth: 200,
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: '0.875rem',
              }}
            />
          </div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : filteredJobs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No HCP jobs yet. Click New Job to add one.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture /Tie-ins</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Materials</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contractors</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Bill</th>
                    <th style={{ padding: '0.75rem', width: 100, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>{job.hcp_number || '—'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>{job.job_name || '—'}</div>
                        {(job.job_address ?? '').trim() && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{job.job_address}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', whiteSpace: 'pre-wrap', maxWidth: 180 }}>
                        {job.fixtures.length === 0
                          ? '—'
                          : job.fixtures
                              .filter((f) => (f.name ?? '').trim())
                              .map((f) => (f.count > 1 ? `${f.name} × ${f.count}` : f.name))
                              .join('\n')}
                      </td>
                      <td style={{ padding: '0.75rem', whiteSpace: 'pre-wrap', maxWidth: 200 }}>
                        {job.materials.length === 0
                          ? '—'
                          : job.materials
                              .filter((m) => (m.description ?? '').trim() || Number(m.amount) !== 0)
                              .map((m) => `${(m.description || '').trim() || 'Item'}: $${formatCurrency(Number(m.amount))}`)
                              .join('\n')}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {job.team_members.length === 0
                          ? '—'
                          : job.team_members.map((t) => t.users?.name ?? 'Unknown').join(', ')}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {job.revenue != null ? `$${formatCurrency(Number(job.revenue))}` : '—'}
                      </td>
                      <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openEdit(job)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#e5e7eb',
                            color: '#374151',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteJob(job.id)}
                          disabled={deletingId === job.id}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#fee2e2',
                            color: '#991b1c',
                            border: 'none',
                            borderRadius: 4,
                            cursor: deletingId === job.id ? 'not-allowed' : 'pointer',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {deletingId === job.id ? '…' : 'Delete'}
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'teams-summary' && <p style={{ color: '#6b7280' }}>Teams Summary content coming soon.</p>}

      {editingLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>Edit job</h2>
            <form onSubmit={saveEditedLaborJob}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: '0 0 100px' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>HCP</label>
                  <input
                    type="text"
                    value={editJobNumber}
                    onChange={(e) => setEditJobNumber(e.target.value)}
                    maxLength={10}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.2rem' }}>Subcontractors</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 80, overflowY: 'auto' }}>
                      {rosterNamesSubcontractors().map((n) => (
                        <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={editAssignedTo.includes(n)}
                            onChange={() => setEditAssignedTo((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
                            style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                          />
                          <span>{n}</span>
                        </label>
                      ))}
                      {rosterNamesSubcontractors().length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>None</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.2rem' }}>Everyone else</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 80, overflowY: 'auto' }}>
                      {rosterNamesEveryoneElse().map((n) => (
                        <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={editAssignedTo.includes(n)}
                            onChange={() => setEditAssignedTo((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
                            style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                          />
                          <span>{n}</span>
                        </label>
                      ))}
                      {rosterNamesEveryoneElse().length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>None</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Labor rate ($/hr)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editLaborRate}
                    onChange={(e) => setEditLaborRate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date</label>
                  <input
                    type="date"
                    value={editJobDate}
                    onChange={(e) => setEditJobDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture /Tie-ins (Line Items)</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>hrs/unit</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>fixed</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {editFixtureRows.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input
                              type="text"
                              value={row.fixture}
                              onChange={(e) => updateEditFixtureRow(row.id, { fixture: e.target.value })}
                              style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={row.count || ''}
                              onChange={(e) => updateEditFixtureRow(row.id, { count: parseFloat(e.target.value) || 0 })}
                              style={{ width: '4rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="number"
                              min={0}
                              step={0.25}
                              value={row.hrs_per_unit || ''}
                              onChange={(e) => updateEditFixtureRow(row.id, { hrs_per_unit: parseFloat(e.target.value) || 0 })}
                              style={{ width: '4rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!row.is_fixed}
                              onChange={(e) => updateEditFixtureRow(row.id, { is_fixed: e.target.checked })}
                              style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <button type="button" onClick={() => removeEditFixtureRow(row.id)} disabled={editFixtureRows.length <= 1} style={{ padding: '0.25rem', background: '#fee2e2', color: '#991b1c', border: 'none', borderRadius: 4, cursor: editFixtureRows.length <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addEditFixtureRow} style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                  Add fixture or tie-in
                </button>
              </div>
              {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" disabled={editLaborSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: editLaborSaving ? 'not-allowed' : 'pointer' }}>
                  {editLaborSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={closeEditLaborJob} disabled={editLaborSaving} style={{ padding: '0.5rem 1rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {laborVersionFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={closeLaborVersionForm}>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>{editingLaborVersion ? 'Edit version' : 'New version'}</h3>
            <form onSubmit={saveLaborVersion}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
              <input
                type="text"
                value={laborVersionNameInput}
                onChange={(e) => setLaborVersionNameInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g. Default"
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingLaborVersion && editingLaborVersion.name !== 'Default' && (
                    <button
                      type="button"
                      onClick={() => deleteLaborVersion(editingLaborVersion)}
                      style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete version
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={closeLaborVersionForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingLaborVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborVersion ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {laborEntryFormOpen && laborBookEntriesVersionId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={closeLaborEntryForm}>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>{editingLaborEntry ? 'Edit entry' : 'New entry'}</h3>
            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>{error}</div>
            )}
            <form onSubmit={saveLaborEntry}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in *</label>
              <input
                type="text"
                list="jobs-labor-fixture-types"
                value={laborEntryFixtureName}
                onChange={(e) => setLaborEntryFixtureName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g. Toilet"
              />
              <datalist id="jobs-labor-fixture-types">
                {fixtureTypes.map((ft) => (
                  <option key={ft.id} value={ft.name} />
                ))}
              </datalist>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Alias names (comma-separated)</label>
              <input
                type="text"
                value={laborEntryAliasNames}
                onChange={(e) => setLaborEntryAliasNames(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g. WC, toilet"
              />
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Rough In (hrs)</label>
                  <input type="number" min={0} step={0.25} value={laborEntryRoughIn} onChange={(e) => setLaborEntryRoughIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Top Out (hrs)</label>
                  <input type="number" min={0} step={0.25} value={laborEntryTopOut} onChange={(e) => setLaborEntryTopOut(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Trim Set (hrs)</label>
                  <input type="number" min={0} step={0.25} value={laborEntryTrimSet} onChange={(e) => setLaborEntryTrimSet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                {editingLaborEntry && (
                  <button
                    type="button"
                    onClick={() => editingLaborEntry && deleteLaborEntry(editingLaborEntry)}
                    style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', marginRight: 'auto' }}
                  >
                    Delete entry
                  </button>
                )}
                <button type="button" onClick={closeLaborEntryForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingLaborEntry} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborEntry ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {formOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          onClick={(e) => e.target === e.currentTarget && closeForm()}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 560,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>{editing ? 'Edit Job' : 'New Job'}</h2>
            {error && <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>HCP</label>
                <input
                  type="text"
                  value={hcpNumber}
                  onChange={(e) => setHcpNumber(e.target.value)}
                  placeholder="HCP number"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Name</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="Job name"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Address</label>
                <input
                  type="text"
                  value={jobAddress}
                  onChange={(e) => setJobAddress(e.target.value)}
                  placeholder="Address"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Materials (Line Items)</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount ($)</th>
                        <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => updateMaterialRow(row.id, { description: e.target.value })}
                              placeholder="Item description"
                              style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={row.amount || ''}
                              onChange={(e) => updateMaterialRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                              placeholder="0"
                              style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => removeMaterialRow(row.id)}
                              disabled={materials.length <= 1}
                              style={{
                                padding: '0.25rem',
                                background: materials.length <= 1 ? '#f3f4f6' : '#fee2e2',
                                color: materials.length <= 1 ? '#9ca3af' : '#991b1c',
                                border: 'none',
                                borderRadius: 4,
                                cursor: materials.length <= 1 ? 'not-allowed' : 'pointer',
                                fontSize: '0.8125rem',
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addMaterialRow} style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                  Add Material
                </button>
              </div>
              <div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture /Tie-ins (Line Items)</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: 80 }}>Count</th>
                        <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {fixtures.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => updateFixtureRow(row.id, { name: e.target.value })}
                              placeholder="Fixture or tie-in name"
                              style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="number"
                              min={1}
                              value={row.count}
                              onChange={(e) => updateFixtureRow(row.id, { count: Math.max(1, Number(e.target.value) || 1) })}
                              style={{ width: '4rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => removeFixtureRow(row.id)}
                              disabled={fixtures.length <= 1}
                              style={{
                                padding: '0.25rem',
                                background: fixtures.length <= 1 ? '#f3f4f6' : '#fee2e2',
                                color: fixtures.length <= 1 ? '#9ca3af' : '#991b1c',
                                border: 'none',
                                borderRadius: 4,
                                cursor: fixtures.length <= 1 ? 'not-allowed' : 'pointer',
                                fontSize: '0.8125rem',
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addFixtureRow} style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                  Add Fixture /Tie-in
                </button>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Contractors</label>
                <select
                  multiple
                  value={teamMemberIds}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions, (o) => o.value)
                    setTeamMemberIds(opts)
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                    minHeight: 100,
                  }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Hold Ctrl/Cmd to select multiple.</p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Total Bill ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                  placeholder="Optional"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={saveJob}
                disabled={saving || !jobName.trim() || !jobAddress.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={closeForm} style={{ padding: '0.5rem 1rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
