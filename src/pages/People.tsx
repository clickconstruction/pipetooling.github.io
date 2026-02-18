import { useEffect, useRef, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Database } from '../types/database'

type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type ServiceType = { id: string; name: string; description: string | null; color: string | null; sequence_order: number; created_at: string; updated_at: string }
type LaborBookVersion = Database['public']['Tables']['labor_book_versions']['Row']
type LaborBookEntry = Database['public']['Tables']['labor_book_entries']['Row']
type LaborBookEntryWithFixture = LaborBookEntry & { fixture_types?: { name: string } | null }
type UserRow = { id: string; email: string | null; name: string; role: string }
type PersonKind = 'assistant' | 'master_technician' | 'sub' | 'estimator'

const KINDS: PersonKind[] = ['assistant', 'master_technician', 'sub', 'estimator']
const KIND_LABELS: Record<PersonKind, string> = { assistant: 'Assistants', master_technician: 'Master Technicians', sub: 'Subcontractors', estimator: 'Estimators' }

const KIND_TO_USER_ROLE: Record<PersonKind, string> = { assistant: 'assistant', master_technician: 'master_technician', sub: 'subcontractor', estimator: 'estimator' }

const tabStyle = (active: boolean) => ({
  padding: '0.75rem 1.5rem',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
})

type PeopleTab = 'users' | 'labor' | 'ledger' | 'pay' | 'hours'

export default function People() {
  const { user: authUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [kind, setKind] = useState<PersonKind>('assistant')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteConfirm, setInviteConfirm] = useState<Person | null>(null)
  const [personProjects, setPersonProjects] = useState<Record<string, string[]>>({})
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<PeopleTab>('labor')

  // Service type and labor book state (for Labor tab)
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

  // Labor tab state
  type LaborFixtureRow = { id: string; fixture: string; count: number; hrs_per_unit: number; is_fixed: boolean }
  const [laborAssignedTo, setLaborAssignedTo] = useState('')
  const [laborAddress, setLaborAddress] = useState('')
  const [laborJobNumber, setLaborJobNumber] = useState('')
  const [laborRate, setLaborRate] = useState('')
  const [laborDate, setLaborDate] = useState('')
  const [laborFixtureRows, setLaborFixtureRows] = useState<LaborFixtureRow[]>([{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
  const [laborSaving, setLaborSaving] = useState(false)

  // Ledger tab state
  type LaborJob = { id: string; assigned_to_name: string; address: string; job_number: string | null; labor_rate: number | null; job_date: string | null; created_at: string | null; items?: Array<{ fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean }> }
  const [laborJobs, setLaborJobs] = useState<LaborJob[]>([])
  const [laborJobsLoading, setLaborJobsLoading] = useState(false)
  const [laborJobDeletingId, setLaborJobDeletingId] = useState<string | null>(null)
  const [editingLaborJob, setEditingLaborJob] = useState<LaborJob | null>(null)
  const [editAssignedTo, setEditAssignedTo] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editJobNumber, setEditJobNumber] = useState('')
  const [editJobDate, setEditJobDate] = useState('')
  const [editLaborRate, setEditLaborRate] = useState('')
  const [editFixtureRows, setEditFixtureRows] = useState<LaborFixtureRow[]>([])
  const [editLaborSaving, setEditLaborSaving] = useState(false)

  // Pay/Hours tab state
  const [payTabLoading, setPayTabLoading] = useState(false)
  const [hoursTabLoading, setHoursTabLoading] = useState(false)
  const [canAccessPay, setCanAccessPay] = useState(false)
  const [canAccessHours, setCanAccessHours] = useState(false)
  const [canViewCostMatrixShared, setCanViewCostMatrixShared] = useState(false)
  const [isDev, setIsDev] = useState(false)
  const [canSeePushStatus, setCanSeePushStatus] = useState(false)
  const [pushEnabledUserIds, setPushEnabledUserIds] = useState<Set<string>>(new Set())
  type PayConfigRow = { person_name: string; hourly_wage: number | null; is_salary: boolean; show_in_hours: boolean; show_in_cost_matrix: boolean }
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  const [payConfigSaving, setPayConfigSaving] = useState(false)
  const [payConfigSectionOpen, setPayConfigSectionOpen] = useState(true)
  const [costMatrixShareSectionOpen, setCostMatrixShareSectionOpen] = useState(false)
  const [costMatrixShareCandidates, setCostMatrixShareCandidates] = useState<Array<{ id: string; name: string; email: string | null; role: string }>>([])
  const [costMatrixSharedUserIds, setCostMatrixSharedUserIds] = useState<Set<string>>(new Set())
  const [costMatrixShareSaving, setCostMatrixShareSaving] = useState(false)
  const [costMatrixShareError, setCostMatrixShareError] = useState<string | null>(null)
  type HoursRow = { person_name: string; work_date: string; hours: number }
  const [peopleHours, setPeopleHours] = useState<HoursRow[]>([])
  const [matrixStartDate, setMatrixStartDate] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toISOString().slice(0, 10)
  })
  const [matrixEndDate, setMatrixEndDate] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toISOString().slice(0, 10)
  })
  type PeopleTeam = { id: string; name: string; members: string[] }
  const [teams, setTeams] = useState<PeopleTeam[]>([])
  const [hoursDisplayOrder, setHoursDisplayOrder] = useState<Record<string, number>>({})
  const [teamPeriodStart, setTeamPeriodStart] = useState(() => {
    const d = new Date()
    const start = new Date(d)
    start.setDate(d.getDate() - 6)
    return start.toISOString().slice(0, 10)
  })
  const [teamPeriodEnd, setTeamPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [showMaxHours, setShowMaxHours] = useState(false)
  const [showMaxHoursTeams, setShowMaxHoursTeams] = useState(false)
  const [hoursDateStart, setHoursDateStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toISOString().slice(0, 10)
  })
  const [hoursDateEnd, setHoursDateEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toISOString().slice(0, 10)
  })
  const [editingHoursCell, setEditingHoursCell] = useState<{ personName: string; workDate: string } | null>(null)
  const [editingHoursValue, setEditingHoursValue] = useState('')

  const loadPeopleHoursRef = useRef<() => void>()
  loadPeopleHoursRef.current = () => {
    if (activeTab === 'pay' && (canAccessPay || canViewCostMatrixShared))
      loadPeopleHours(matrixStartDate, matrixEndDate)
    else if (activeTab === 'hours' && canAccessHours)
      loadPeopleHours(hoursDateStart, hoursDateEnd)
  }

  async function loadPeople() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    setError(null)
    const [peopleRes, usersRes, meRes] = await Promise.all([
      supabase.from('people').select('id, master_user_id, kind, name, email, phone, notes').order('kind').order('name'),
      supabase.from('users').select('id, email, name, role').in('role', ['assistant', 'master_technician', 'subcontractor', 'estimator']),
      supabase.from('users').select('role').eq('id', authUser.id).single(),
    ])
    if (peopleRes.error) setError(peopleRes.error.message)
    else setPeople((peopleRes.data as Person[]) ?? [])
    let usersList = (usersRes.data as UserRow[]) ?? []
    const myRole = (meRes.data as { role?: string } | null)?.role
    if (myRole === 'dev') {
      const { data: devUsers } = await supabase.from('users').select('id, email, name, role').eq('role', 'dev')
      if (devUsers && devUsers.length > 0) {
        const existingIds = new Set(usersList.map((u) => u.id))
        const newDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
        usersList = [...usersList, ...newDevs]
      }
    }
    if (usersRes.error) setError(usersRes.error.message)
    setUsers(usersList)
    
    // Load creator names for shared people (created by others)
    const peopleData = (peopleRes.data as Person[]) ?? []
    const creatorIds = [...new Set(peopleData.filter((p) => p.master_user_id !== authUser.id).map((p) => p.master_user_id))]
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase.from('users').select('id, name, email').in('id', creatorIds)
      const map: Record<string, string> = {}
      for (const c of (creators as Array<{ id: string; name: string | null; email: string | null }>) ?? []) {
        map[c.id] = c.name ?? c.email ?? 'Unknown'
      }
      setCreatorNames(map)
    } else {
      setCreatorNames({})
    }
    
    // Load active projects for all people
    await loadPersonProjects()
    
    setLoading(false)
  }

  async function loadPersonProjects() {
    // Get all steps with assigned people
    const { data: steps, error: stepsErr } = await supabase
      .from('project_workflow_steps')
      .select('workflow_id, assigned_to_name')
      .not('assigned_to_name', 'is', null)
    if (stepsErr) {
      console.error('Error loading steps:', stepsErr)
      return
    }
    if (!steps || steps.length === 0) {
      setPersonProjects({})
      return
    }
    
    // Get unique workflow IDs
    const workflowIds = [...new Set((steps as Array<{ workflow_id: string }>).map((s) => s.workflow_id))]
    
    // Get workflows with project_id
    const { data: workflows, error: workflowsErr } = await supabase
      .from('project_workflows')
      .select('id, project_id')
      .in('id', workflowIds)
    if (workflowsErr) {
      console.error('Error loading workflows:', workflowsErr)
      return
    }
    
    // Get unique project IDs
    const projectIds = [...new Set((workflows as Array<{ project_id: string }>).map((w) => w.project_id))]
    
    // Get active projects
    const { data: projects, error: projectsErr } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds)
      .eq('status', 'active')
    if (projectsErr) {
      console.error('Error loading projects:', projectsErr)
      return
    }
    
    // Build map: workflow_id -> project_name
    const workflowToProject = new Map<string, string>()
    if (workflows && projects) {
      for (const wf of workflows as Array<{ id: string; project_id: string }>) {
        const proj = (projects as Array<{ id: string; name: string }>).find((p) => p.id === wf.project_id)
        if (proj) workflowToProject.set(wf.id, proj.name)
      }
    }
    
    // Group by person name
    const projectsByPerson: Record<string, string[]> = {}
    if (steps) {
      for (const step of steps as Array<{ workflow_id: string; assigned_to_name: string }>) {
        const personName = step.assigned_to_name?.trim()
        if (!personName) continue
        const projectName = workflowToProject.get(step.workflow_id)
        if (!projectName) continue
        if (!projectsByPerson[personName]) projectsByPerson[personName] = []
        if (!projectsByPerson[personName].includes(projectName)) {
          projectsByPerson[personName].push(projectName)
        }
      }
    }
    setPersonProjects(projectsByPerson)
  }

  useEffect(() => {
    loadPeople()
  }, [authUser?.id])

  useEffect(() => {
    async function loadPayAccess() {
      if (!authUser?.id) return
      const [meRes, approvedRes, sharesRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', authUser.id).single(),
        supabase.from('pay_approved_masters').select('master_id'),
        supabase.from('cost_matrix_teams_shares').select('shared_with_user_id').eq('shared_with_user_id', authUser.id).maybeSingle(),
      ])
      const role = (meRes.data as { role?: string } | null)?.role ?? null
      const approvedIds = new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id))
      const hasCostMatrixShare = !!sharesRes.data
      setCanViewCostMatrixShared(hasCostMatrixShare)
      if (role === 'dev') {
        setCanAccessPay(true)
        setCanAccessHours(true)
        setIsDev(true)
        setCanSeePushStatus(true)
        return
      }
      if (role === 'assistant') {
        setCanAccessHours(true)
        setCanSeePushStatus(true)
        return
      }
      if (role === 'master_technician') {
        setCanSeePushStatus(true)
        if (approvedIds.has(authUser.id)) {
          setCanAccessPay(true)
          setCanAccessHours(true)
        }
      }
    }
    loadPayAccess()
  }, [authUser?.id])

  useEffect(() => {
    if (!canSeePushStatus) return
    supabase
      .from('push_subscriptions')
      .select('user_id')
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((r: { user_id: string }) => r.user_id))
        setPushEnabledUserIds(ids)
      })
  }, [canSeePushStatus])

  async function loadServiceTypes() {
    const { data, error } = await supabase
      .from('service_types' as any)
      .select('*')
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load service types: ${error.message}`)
      return
    }
    const types = (data as unknown as ServiceType[]) ?? []
    setServiceTypes(types)
    const firstId = types[0]?.id
    if (firstId) {
      setSelectedServiceTypeId((prev) => {
        if (!prev || !types.some((st) => st.id === prev)) return firstId
        return prev
      })
    }
  }

  async function loadFixtureTypes() {
    if (!selectedServiceTypeId) return
    const { data, error } = await supabase
      .from('fixture_types')
      .select('id, name')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (!error && data) setFixtureTypes(data)
  }

  async function loadLaborBookVersions() {
    if (!selectedServiceTypeId) return
    const { data, error } = await supabase
      .from('labor_book_versions')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
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

  useEffect(() => {
    loadServiceTypes()
  }, [authUser?.id])

  useEffect(() => {
    if (selectedServiceTypeId && authUser?.id) {
      setLaborBookEntriesVersionId(null)
      loadFixtureTypes()
      loadLaborBookVersions()
    }
  }, [selectedServiceTypeId, authUser?.id])

  useEffect(() => {
    if (laborBookEntriesVersionId) loadLaborBookEntries(laborBookEntriesVersionId)
    else setLaborBookEntries([])
  }, [laborBookEntriesVersionId])

  function openAdd(k: PersonKind) {
    setEditing(null)
    setKind(k)
    setName('')
    setEmail('')
    setPhone('')
    setNotes('')
    setFormOpen(true)
    setError(null)
  }

  function openEdit(p: Person) {
    setEditing(p)
    setKind(p.kind as PersonKind)
    setName(p.name)
    setEmail(p.email ?? '')
    setPhone(p.phone ?? '')
    setNotes(p.notes ?? '')
    setFormOpen(true)
    setError(null)
  }

  function closeForm() {
    setFormOpen(false)
  }

  async function checkDuplicateName(nameToCheck: string, excludeId?: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false
    
    // Check in people table (excluding current person if editing)
    const peopleQuery = supabase
      .from('people')
      .select('id, name')
    if (excludeId) {
      peopleQuery.neq('id', excludeId)
    }
    const { data: peopleData } = await peopleQuery
    
    // Check in users table
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
    
    // Case-insensitive comparison
    const hasDuplicateInPeople = peopleData?.some(p => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersData?.some(u => u.name?.toLowerCase() === trimmedName) ?? false
    
    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    setSaving(true)
    setError(null)
    
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
      setSaving(false)
      return
    }
    
    // Check for duplicate names (case-insensitive)
    const isDuplicate = await checkDuplicateName(trimmedName, editing?.id)
    if (isDuplicate) {
      setError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
      setSaving(false)
      return
    }
    
    const payload = {
      kind,
      name: trimmedName,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    }
    if (editing) {
      const { error: err } = await supabase.from('people').update(payload).eq('id', editing.id)
      if (err) setError(err.message)
      else {
        setPeople((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)))
        closeForm()
      }
    } else {
      const { data, error: err } = await supabase.from('people').insert({ master_user_id: authUser.id, ...payload }).select('id, master_user_id, kind, name, email, phone, notes').single()
      if (err) setError(err.message)
      else if (data) {
        setPeople((prev) => [...prev, data as Person].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)))
        closeForm()
      }
    }
    setSaving(false)
  }

  async function deletePerson(id: string) {
    if (!confirm('Remove this person from the list?')) return
    setDeletingId(id)
    setError(null)
    const { error: err } = await supabase.from('people').delete().eq('id', id)
    if (err) setError(err.message)
    else setPeople((prev) => prev.filter((p) => p.id !== id))
    setDeletingId(null)
  }

  function isAlreadyUser(email: string | null): boolean {
    if (!email?.trim()) return false
    const e = email.trim().toLowerCase()
    return users.some((u) => u.email && u.email.toLowerCase() === e)
  }

  async function inviteAsUser(p: Person) {
    if (!p.email?.trim()) {
      setError('Add an email in Edit to invite as user.')
      return
    }
    if (isAlreadyUser(p.email)) {
      setError('This email already has an account.')
      return
    }
    setInvitingId(p.id)
    setError(null)
    const role = KIND_TO_USER_ROLE[p.kind as PersonKind]
    const { data, error: eFn } = await supabase.functions.invoke('invite-user', {
      body: { email: p.email.trim(), role, name: p.name || undefined },
    })
    setInvitingId(null)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setError(err)
      return
    }
    await loadPeople()
  }

  function confirmAndInvite() {
    if (!inviteConfirm) return
    const p = inviteConfirm
    setInviteConfirm(null)
    inviteAsUser(p)
  }

  function byKind(k: PersonKind): ({ source: 'user'; id: string; name: string; email: string | null } | ({ source: 'people' } & Person))[] {
    const userRole = KIND_TO_USER_ROLE[k]
    const fromUsers = users.filter((u) => u.role === userRole).map((u) => ({ source: 'user' as const, id: u.id, name: u.name, email: u.email }))
    const fromPeople = people
      .filter((p) => p.kind === k && !isAlreadyUser(p.email))
      .map((p) => ({ source: 'people' as const, ...p }))
    return [...fromUsers, ...fromPeople].sort((a, b) => a.name.localeCompare(b.name))
  }

  function allRosterNames(): string[] {
    const names = new Set<string>()
    for (const k of KINDS) {
      for (const item of byKind(k)) {
        if (item.name?.trim()) names.add(item.name.trim())
      }
    }
    return Array.from(names).sort()
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
    } else if (jobs && jobs.length > 0) {
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
        (jobs as LaborJob[]).map((j) => ({
          ...j,
          items: itemsByJob.get(j.id) ?? [],
        }))
      )
    } else {
      setLaborJobs([])
    }
    setLaborJobsLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'ledger' && authUser?.id) loadLaborJobs()
  }, [activeTab, authUser?.id])

  async function loadPayConfig() {
    if (!canAccessPay && !canAccessHours && !canViewCostMatrixShared) return
    const { data, error } = await supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix')
    if (error) {
      setError(error.message)
      return
    }
    // Temporary: log for assistants when RLS may be blocking
    if (!canAccessPay && !canViewCostMatrixShared && (data ?? []).length === 0) {
      console.warn('loadPayConfig: assistant got empty data', { error, rowCount: (data ?? []).length })
    }
    const map: Record<string, PayConfigRow> = {}
    for (const r of (data ?? []) as PayConfigRow[]) {
      map[r.person_name] = r
    }
    setPayConfig(map)
  }

  async function loadPeopleHours(start: string, end: string) {
    if (!canAccessHours && !canAccessPay && !canViewCostMatrixShared) return
    const { data, error } = await supabase
      .from('people_hours')
      .select('person_name, work_date, hours')
      .gte('work_date', start)
      .lte('work_date', end)
    if (error) {
      setError(error.message)
      return
    }
    setPeopleHours((data ?? []) as HoursRow[])
  }

  async function loadTeams() {
    if (!canAccessPay && !canViewCostMatrixShared) return
    const [teamsRes, membersRes] = await Promise.all([
      supabase.from('people_teams').select('id, name, sequence_order').order('sequence_order', { ascending: true }),
      supabase.from('people_team_members').select('team_id, person_name'),
    ])
    if (teamsRes.error) return
    const teamList = (teamsRes.data ?? []) as Array<{ id: string; name: string; sequence_order: number }>
    const membersByTeam = new Map<string, string[]>()
    for (const m of (membersRes.data ?? []) as Array<{ team_id: string; person_name: string }>) {
      if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, [])
      membersByTeam.get(m.team_id)!.push(m.person_name)
    }
    setTeams(teamList.map((t) => ({ id: t.id, name: t.name, members: membersByTeam.get(t.id) ?? [] })))
  }

  async function loadCostMatrixShares() {
    if (!isDev) return
    const [candidatesRes, sharesRes] = await Promise.all([
      supabase.from('users').select('id, name, email, role').in('role', ['master_technician', 'assistant']).order('name'),
      supabase.from('cost_matrix_teams_shares').select('shared_with_user_id'),
    ])
    if (candidatesRes.data) setCostMatrixShareCandidates(candidatesRes.data as Array<{ id: string; name: string; email: string | null; role: string }>)
    if (sharesRes.data) setCostMatrixSharedUserIds(new Set((sharesRes.data as { shared_with_user_id: string }[]).map((r) => r.shared_with_user_id)))
  }

  async function toggleCostMatrixShare(userId: string, isShared: boolean) {
    if (!isDev) return
    setCostMatrixShareSaving(true)
    setCostMatrixShareError(null)
    if (isShared) {
      const { error } = await supabase.from('cost_matrix_teams_shares').insert({ shared_with_user_id: userId })
      if (error) setCostMatrixShareError(error.message)
      else setCostMatrixSharedUserIds((prev) => new Set(prev).add(userId))
    } else {
      const { error } = await supabase.from('cost_matrix_teams_shares').delete().eq('shared_with_user_id', userId)
      if (error) setCostMatrixShareError(error.message)
      else setCostMatrixSharedUserIds((prev) => { const next = new Set(prev); next.delete(userId); return next })
    }
    setCostMatrixShareSaving(false)
  }

  useEffect(() => {
    if (activeTab === 'pay' && (canAccessPay || canViewCostMatrixShared)) {
      setPayTabLoading(true)
      Promise.all([
        loadPayConfig(),
        loadPeopleHours(matrixStartDate, matrixEndDate),
        loadTeams(),
      ]).finally(() => setPayTabLoading(false))
    }
  }, [activeTab, canAccessPay, canViewCostMatrixShared, matrixStartDate, matrixEndDate])

  useEffect(() => {
    if (activeTab === 'pay' && isDev) loadCostMatrixShares()
  }, [activeTab, isDev])

  async function loadHoursDisplayOrder() {
    if (!canAccessHours && !canAccessPay) return
    const { data } = await supabase.from('people_hours_display_order').select('person_name, sequence_order')
    const map: Record<string, number> = {}
    for (const r of (data ?? []) as { person_name: string; sequence_order: number }[]) {
      map[r.person_name] = r.sequence_order
    }
    setHoursDisplayOrder(map)
  }

  async function moveHoursRow(personName: string, direction: 'up' | 'down') {
    const idx = showPeopleForHours.indexOf(personName)
    if (idx < 0) return
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1
    if (otherIdx < 0 || otherIdx >= showPeopleForHours.length) return
    const otherName = showPeopleForHours[otherIdx]
    if (!otherName) return
    const newOrderA = otherIdx
    const newOrderB = idx
    setHoursDisplayOrder((prev) => ({
      ...prev,
      [personName]: newOrderA,
      [otherName]: newOrderB,
    }))
    await Promise.all([
      supabase.from('people_hours_display_order').upsert({ person_name: personName, sequence_order: newOrderA }, { onConflict: 'person_name' }),
      supabase.from('people_hours_display_order').upsert({ person_name: otherName, sequence_order: newOrderB }, { onConflict: 'person_name' }),
    ])
  }

  useEffect(() => {
    if (activeTab === 'hours' && canAccessHours) {
      setHoursTabLoading(true)
      Promise.all([
        loadPayConfig(),
        loadPeopleHours(hoursDateStart, hoursDateEnd),
        loadHoursDisplayOrder(),
      ]).finally(() => setHoursTabLoading(false))
    }
  }, [activeTab, canAccessHours, hoursDateStart, hoursDateEnd])

  useEffect(() => {
    const hasAccess = canAccessHours || canAccessPay || canViewCostMatrixShared
    const isRelevantTab = activeTab === 'pay' || activeTab === 'hours'
    if (!hasAccess || !isRelevantTab) return
    const channel = supabase
      .channel('people-hours-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people_hours' }, () => {
        loadPeopleHoursRef.current?.()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeTab, canAccessHours, canAccessPay, canViewCostMatrixShared])

  async function upsertPayConfig(personName: string, row: Partial<PayConfigRow>) {
    if (!canAccessPay) return
    setPayConfigSaving(true)
    const cur = payConfig[personName] ?? { person_name: personName, hourly_wage: null, is_salary: false, show_in_hours: false, show_in_cost_matrix: false }
    const full = { person_name: personName, hourly_wage: row.hourly_wage ?? cur.hourly_wage, is_salary: row.is_salary ?? cur.is_salary, show_in_hours: row.show_in_hours ?? cur.show_in_hours, show_in_cost_matrix: row.show_in_cost_matrix ?? cur.show_in_cost_matrix }
    const { error } = await supabase.from('people_pay_config').upsert(full, { onConflict: 'person_name' })
    if (error) setError(error.message)
    else setPayConfig((prev) => ({ ...prev, [personName]: full }))
    setPayConfigSaving(false)
  }

  async function saveHours(personName: string, workDate: string, hours: number) {
    if (!canAccessHours && !canAccessPay) return
    // Optimistic update: show new value immediately
    setPeopleHours((prev) => {
      const rest = prev.filter((h) => !(h.person_name === personName && h.work_date === workDate))
      return [...rest, { person_name: personName, work_date: workDate, hours }]
    })
    const { error } = await supabase.from('people_hours').upsert(
      { person_name: personName, work_date: workDate, hours, entered_by: authUser?.id ?? null },
      { onConflict: 'person_name,work_date' }
    )
    if (error) setError(error.message)
  }

  async function addTeam() {
    if (!canAccessPay) return
    const { data, error } = await supabase.from('people_teams').insert({ name: 'New Team', sequence_order: teams.length }).select('id').single()
    if (error) setError(error.message)
    else if (data) setTeams((prev) => [...prev, { id: (data as { id: string }).id, name: 'New Team', members: [] }])
  }

  async function updateTeamName(teamId: string, name: string) {
    if (!canAccessPay) return
    const { error } = await supabase.from('people_teams').update({ name }).eq('id', teamId)
    if (error) setError(error.message)
    else setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name } : t)))
  }

  async function addTeamMember(teamId: string, personName: string) {
    if (!canAccessPay) return
    const { error } = await supabase.from('people_team_members').insert({ team_id: teamId, person_name: personName })
    if (error) setError(error.message)
    else setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, members: [...t.members, personName] } : t)))
  }

  async function removeTeamMember(teamId: string, personName: string) {
    if (!canAccessPay) return
    const { error } = await supabase.from('people_team_members').delete().eq('team_id', teamId).eq('person_name', personName)
    if (error) setError(error.message)
    else setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, members: t.members.filter((m) => m !== personName) } : t)))
  }

  function getHoursForPersonDate(personName: string, workDate: string): number {
    const row = peopleHours.find((h) => h.person_name === personName && h.work_date === workDate)
    return row?.hours ?? 0
  }

  function getEffectiveHours(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    if (cfg?.is_salary) {
      const day = new Date(workDate + 'T12:00:00').getDay()
      if (day === 0 || day === 6) return 0
      return 8
    }
    return getHoursForPersonDate(personName, workDate)
  }

  function getCostForPersonDate(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const hrs = getEffectiveHours(personName, workDate)
    return wage * hrs
  }

  function getCostForPersonDateMatrix(personName: string, workDate: string): number {
    if (!showMaxHours) return getCostForPersonDate(personName, workDate)
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const day = new Date(workDate + 'T12:00:00').getDay()
    if (day >= 1 && day <= 5) return wage * 8
    return getCostForPersonDate(personName, workDate)
  }

  function getCostForPersonDateTeams(personName: string, workDate: string): number {
    if (!showMaxHoursTeams) return getCostForPersonDate(personName, workDate)
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const day = new Date(workDate + 'T12:00:00').getDay()
    if (day >= 1 && day <= 5) return wage * 8
    return getCostForPersonDate(personName, workDate)
  }

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

  function decimalToHms(decimal: number): string {
    if (!decimal || decimal <= 0) return ''
    const h = Math.floor(decimal)
    const m = Math.floor((decimal - h) * 60)
    const s = Math.round(((decimal - h) * 60 - m) * 60)
    if (s > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${h}:${String(m).padStart(2, '0')}:00`
  }

  function hmsToDecimal(str: string): number {
    const trimmed = str.trim()
    if (!trimmed) return 0
    const normalized = trimmed.replace(/\./g, ':').replace(/\s+/g, ':')
    const parts = normalized.split(':').map((p) => parseInt(p, 10) || 0)
    const [h = 0, m = 0, s = 0] = parts
    return h + m / 60 + s / 3600
  }

  const showPeopleForHours = Object.keys(payConfig)
    .filter((n) => payConfig[n]?.show_in_hours ?? false)
    .sort((a, b) => {
      const orderA = hoursDisplayOrder[a] ?? 999999
      const orderB = hoursDisplayOrder[b] ?? 999999
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
    })
  const showPeopleForMatrix = Object.keys(payConfig)
    .filter((n) => payConfig[n]?.show_in_cost_matrix ?? false)
    .sort((a, b) => a.localeCompare(b))

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
    const assigned = laborAssignedTo.trim()
    const address = laborAddress.trim()
    if (!assigned) {
      setError('Select a user.')
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
    setLaborAssignedTo('')
    setLaborAddress('')
    setLaborJobNumber('')
    setLaborRate('')
    setLaborDate('')
    setLaborFixtureRows([{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
    setLaborSaving(false)
    setActiveTab('ledger')
    await loadLaborJobs()
  }

  async function deleteLaborJob(id: string) {
    if (!confirm('Delete this job from the ledger?')) return
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
    setEditAssignedTo(job.assigned_to_name)
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
    setEditAssignedTo('')
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
    const assigned = editAssignedTo.trim()
    const address = editAddress.trim()
    if (!assigned) {
      setError('Select a user.')
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

  function formatCurrency(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function printLaborSubSheet() {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateStr = new Date().toLocaleDateString()
    const title = escapeHtml(laborAssignedTo || 'Labor') + ' — ' + escapeHtml(laborAddress || 'Job') + ' — ' + dateStr
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

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <button type="button" onClick={() => setActiveTab('labor')} style={tabStyle(activeTab === 'labor')}>
          Labor
        </button>
        <button type="button" onClick={() => setActiveTab('ledger')} style={tabStyle(activeTab === 'ledger')}>
          Ledger
        </button>
        <button type="button" onClick={() => setActiveTab('users')} style={tabStyle(activeTab === 'users')}>
          Users
        </button>
        {(canAccessPay || canViewCostMatrixShared) && (
          <button type="button" onClick={() => setActiveTab('pay')} style={tabStyle(activeTab === 'pay')}>
            Pay
          </button>
        )}
        {(canAccessPay || canAccessHours) && (
          <button type="button" onClick={() => setActiveTab('hours')} style={tabStyle(activeTab === 'hours')}>
            Hours
          </button>
        )}
      </div>
      {activeTab === 'users' && (
        <>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Roster of Assistants, Masters, and Subcontractors. You can add people who have not signed up. Use these when assigning workflow steps.
          </p>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {isDev && (
            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Devs</h2>
              {users.filter((u) => u.role === 'dev').length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {users
                    .filter((u) => u.role === 'dev')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((u) => (
                      <li
                        key={u.id}
                        style={{
                          padding: '0.5rem 0',
                          borderBottom: '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div>
                            {pushEnabledUserIds.has(u.id) && (
                              <span
                                title="Push notifications enabled"
                                style={{
                                  display: 'inline-block',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: '#22c55e',
                                  marginRight: '0.35rem',
                                  verticalAlign: 'middle',
                                }}
                              />
                            )}
                            <span style={{ fontWeight: 500 }}>{u.name}</span>
                            <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>(account)</span>
                            {u.email && (
                              <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                                <a href={`mailto:${u.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                  {u.email}
                                </a>
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}
          {KINDS.map((k) => (
        <section key={k} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{KIND_LABELS[k]}</h2>
            <button type="button" onClick={() => openAdd(k)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
              Add
            </button>
          </div>
          {byKind(k).length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {byKind(k).map((item) => (
                <li
                  key={item.source === 'user' ? `user-${item.id}` : `people-${item.id}`}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div>
                      {item.source === 'user' && canSeePushStatus && pushEnabledUserIds.has(item.id) && (
                        <span
                          title="Push notifications enabled"
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#22c55e',
                            marginRight: '0.35rem',
                            verticalAlign: 'middle',
                          }}
                        />
                      )}
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                      {item.source === 'user' && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>(account)</span>
                      )}
                      {(item.source === 'user' ? item.email : (item.email || item.phone)) && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                          {item.source === 'user' ? (
                            item.email ? (
                              <a href={`mailto:${item.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                {item.email}
                              </a>
                            ) : null
                          ) : (
                            <>
                              {item.email && (
                                <>
                                  <a href={`mailto:${item.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                    {item.email}
                                  </a>
                                  {item.phone && ' \u00B7 '}
                                </>
                              )}
                              {item.phone && (
                                <a href={`tel:${item.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                  {item.phone}
                                </a>
                              )}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const projects = personProjects[item.name.trim()]
                      return projects && projects.length > 0 ? (
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          Active projects: {projects.sort().join(', ')}
                        </div>
                      ) : null
                    })()}
                  </div>
                  {item.source === 'people' && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {!isAlreadyUser(item.email) && (
                        <button
                          type="button"
                          onClick={() => setInviteConfirm(item as Person)}
                          disabled={!item.email?.trim() || invitingId === item.id}
                          title={!item.email?.trim() ? 'Add email in Edit to invite' : undefined}
                          style={{ padding: '2px 6px', fontSize: '0.8125rem' }}
                        >
                          {invitingId === item.id ? 'Sending…' : 'Invite as user'}
                        </button>
                      )}
                      <button type="button" onClick={() => openEdit(item)} style={{ padding: '2px 6px', fontSize: '0.8125rem' }}>
                        Edit
                      </button>
                      {item.master_user_id === authUser?.id ? (
                        <button
                          type="button"
                          onClick={() => deletePerson(item.id)}
                          disabled={deletingId === item.id}
                          style={{ padding: '2px 6px', fontSize: '0.8125rem', color: '#b91c1c' }}
                        >
                          {deletingId === item.id ? '...' : 'Remove'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                          Created by {creatorNames[item.master_user_id] ?? 'Unknown'}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
        </>
      )}
      {activeTab === 'labor' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 720 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>User</label>
              <select
                value={laborAssignedTo}
                onChange={(e) => setLaborAssignedTo(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              >
                <option value="">Select a person…</option>
                {allRosterNames().map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
              <div style={{ flex: '0 0 120px' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Job #</label>
                <input
                  type="text"
                  value={laborJobNumber}
                  onChange={(e) => setLaborJobNumber(e.target.value)}
                  maxLength={10}
                  placeholder="Optional"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
            <div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
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
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={saveLaborJob}
                disabled={laborSaving || !laborAssignedTo.trim() || !laborAddress.trim() || laborFixtureRows.every((r) => {
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
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Print for sub
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
      {activeTab === 'ledger' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {laborJobsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading ledger…</p>
          ) : laborJobs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No jobs yet. Add one in the Labor tab.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>User</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job #</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Labor rate</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total hrs</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Print for sub</th>
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
                          <button type="button" onClick={() => printJobSubSheet(job)} style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                            Print for sub
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
                        <td style={{ padding: '0.75rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
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

      {activeTab === 'pay' && (canAccessPay || canViewCostMatrixShared) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {payTabLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
          <>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {canAccessPay && (
          <section>
            <button
              type="button"
              onClick={() => setPayConfigSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                marginBottom: payConfigSectionOpen ? '0.75rem' : 0,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.125rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{payConfigSectionOpen ? '▼' : '▶'}</span>
              People pay config
            </button>
            {payConfigSectionOpen && (
              <>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                  Set hourly wage, Salary (8 hrs/day), Show in Hours (include in Hours tab), and Show in Cost Matrix (include in cost matrix and teams).
                </p>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto', maxHeight: 320 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Hourly wage ($)</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Salary</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Show in Hours</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Show in Cost Matrix</th>
                  </tr>
                </thead>
                <tbody>
                  {allRosterNames().map((n) => {
                    const c = payConfig[n] ?? { person_name: n, hourly_wage: null, is_salary: false, show_in_hours: false, show_in_cost_matrix: false }
                    return (
                      <tr key={n} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{n}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={c.hourly_wage ?? ''}
                            onChange={(e) => {
                              const v = e.target.value === '' ? null : parseFloat(e.target.value) || null
                              setPayConfig((prev) => ({ ...prev, [n]: { person_name: n, hourly_wage: v, is_salary: (prev[n] ?? c).is_salary, show_in_hours: (prev[n] ?? c).show_in_hours, show_in_cost_matrix: (prev[n] ?? c).show_in_cost_matrix } }))
                            }}
                            onBlur={(e) => {
                              const v = e.target.value === '' ? null : parseFloat(e.target.value) || null
                              upsertPayConfig(n, { ...(payConfig[n] ?? c), hourly_wage: v })
                            }}
                            disabled={payConfigSaving}
                            style={{ width: 80, padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={c.is_salary}
                            onChange={(e) => upsertPayConfig(n, { ...c, is_salary: e.target.checked })}
                            disabled={payConfigSaving}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={c.show_in_hours}
                            onChange={(e) => upsertPayConfig(n, { ...c, show_in_hours: e.target.checked })}
                            disabled={payConfigSaving || !isDev}
                            title={!isDev ? 'Only dev can change this' : undefined}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={c.show_in_cost_matrix}
                            onChange={(e) => upsertPayConfig(n, { ...c, show_in_cost_matrix: e.target.checked })}
                            disabled={payConfigSaving}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
              </>
            )}
          </section>
          )}
          {isDev && (
          <section>
            <button
              type="button"
              onClick={() => setCostMatrixShareSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                marginBottom: costMatrixShareSectionOpen ? '0.75rem' : 0,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.125rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{costMatrixShareSectionOpen ? '▼' : '▶'}</span>
              Share Cost Matrix and Teams
            </button>
            {costMatrixShareSectionOpen && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Select Masters or assistants to grant view-only access to Cost matrix and Teams.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                  {costMatrixShareCandidates.map((u) => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={costMatrixSharedUserIds.has(u.id)}
                        onChange={(e) => toggleCostMatrixShare(u.id, e.target.checked)}
                        disabled={costMatrixShareSaving}
                      />
                      {u.name || u.email || 'Unknown'} ({u.role === 'master_technician' ? 'Master' : 'Assistant'})
                    </label>
                  ))}
                </div>
                {costMatrixShareError && <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem' }}>{costMatrixShareError}</p>}
              </div>
            )}
          </section>
          )}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Cost matrix</h2>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showMaxHours}
                  onChange={(e) => setShowMaxHours(e.target.checked)}
                />
                show max hours
              </label>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                <input type="date" value={matrixStartDate} onChange={(e) => setMatrixStartDate(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </label>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                <input type="date" value={matrixEndDate} onChange={(e) => setMatrixEndDate(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </label>
              <button
                type="button"
                onClick={() => {
                  const s = new Date(matrixStartDate + 'T12:00:00')
                  const e = new Date(matrixEndDate + 'T12:00:00')
                  s.setDate(s.getDate() - 7)
                  e.setDate(e.getDate() - 7)
                  setMatrixStartDate(s.toISOString().slice(0, 10))
                  setMatrixEndDate(e.toISOString().slice(0, 10))
                }}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                ← last week
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = new Date(matrixStartDate + 'T12:00:00')
                  const e = new Date(matrixEndDate + 'T12:00:00')
                  s.setDate(s.getDate() + 7)
                  e.setDate(e.getDate() + 7)
                  setMatrixStartDate(s.toISOString().slice(0, 10))
                  setMatrixEndDate(e.toISOString().slice(0, 10))
                }}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                next week →
              </button>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb' }}>Person</th>
                    {getDaysInRange(matrixStartDate, matrixEndDate).map((d) => (
                      <th key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', minWidth: 70 }}>
                        {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {showPeopleForMatrix.map((personName) => {
                    const cfg = payConfig[personName]
                    const wage = cfg?.hourly_wage ?? 0
                    const periodTotal = getDaysInRange(matrixStartDate, matrixEndDate).reduce((s, d) => s + getCostForPersonDateMatrix(personName, d), 0)
                    return (
                      <tr key={personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem 0.75rem', position: 'sticky', left: 0, background: 'white' }}>
                          {personName} | {wage > 0 ? `$${Math.round(periodTotal)}` : '—'}
                        </td>
                        {getDaysInRange(matrixStartDate, matrixEndDate).map((d) => {
                          const cost = getCostForPersonDateMatrix(personName, d)
                          return (
                            <td key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>
                              {wage > 0 ? `$${Math.round(cost)}` : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                    <td style={{ padding: '0.5rem 0.75rem', position: 'sticky', left: 0, background: '#f9fafb' }}>
                      Total | ${Math.round(
                        getDaysInRange(matrixStartDate, matrixEndDate).reduce(
                          (daySum, d) => daySum + showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0),
                          0
                        )
                      )}
                    </td>
                    {getDaysInRange(matrixStartDate, matrixEndDate).map((d) => {
                      const dayTotal = showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0)
                      return (
                        <td key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>
                          ${Math.round(dayTotal)}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>Teams</h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
              {canViewCostMatrixShared && !canAccessPay ? 'Teams and combined cost for a date range.' : 'Add people to teams to see combined cost for a date range (default: last 7 days).'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                <input type="date" value={teamPeriodStart} onChange={(e) => setTeamPeriodStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </label>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                <input type="date" value={teamPeriodEnd} onChange={(e) => setTeamPeriodEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </label>
              {canAccessPay && (
              <button type="button" onClick={addTeam} style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>
                Add team
              </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {teams.map((team) => {
                const teamsReadOnly = canViewCostMatrixShared && !canAccessPay
                const costForRange = (start: string, end: string) =>
                  team.members.reduce((sum, p) => sum + getDaysInRange(start, end).reduce((s, d) => s + getCostForPersonDateTeams(p, d), 0), 0)
                const today = new Date().toISOString().slice(0, 10)
                const yesterday = (() => {
                  const d = new Date()
                  d.setDate(d.getDate() - 1)
                  return d.toISOString().slice(0, 10)
                })()
                const last7Start = (() => {
                  const d = new Date()
                  d.setDate(d.getDate() - 6)
                  return d.toISOString().slice(0, 10)
                })()
                const last3Start = (() => {
                  const d = new Date()
                  d.setDate(d.getDate() - 2)
                  return d.toISOString().slice(0, 10)
                })()
                const periodCost = costForRange(teamPeriodStart, teamPeriodEnd)
                const last7Cost = costForRange(last7Start, today)
                const last3Cost = costForRange(last3Start, today)
                const yesterdayCost = costForRange(yesterday, yesterday)
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                const daysInRange = getDaysInRange(teamPeriodStart, teamPeriodEnd)
                const memberCostByWeekday = team.members.map((m) => {
                  const byDay = dayNames.map((_, dayOfWeek) => {
                    const matchingDays = daysInRange.filter((d) => new Date(d + 'T12:00:00').getDay() === dayOfWeek)
                    return matchingDays.reduce((sum, d) => sum + getCostForPersonDateTeams(m, d), 0)
                  })
                  const total = byDay.reduce((s, v) => s + v, 0)
                  return { member: m, byDay, total }
                })
                const costByWeekday = dayNames.map((_, dayOfWeek) =>
                  memberCostByWeekday.reduce((s, r) => s + (r.byDay[dayOfWeek] ?? 0), 0)
                )
                const periodTotal = costByWeekday.reduce((s, v) => s + v, 0)
                return (
                  <div key={team.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.75rem', background: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      {teamsReadOnly ? (
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{team.name}</span>
                      ) : (
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t)))}
                          onBlur={(e) => updateTeamName(team.id, e.target.value.trim() || 'New Team')}
                          style={{ padding: '0.2rem 0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontWeight: 600, minWidth: 100, fontSize: '0.875rem' }}
                        />
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
                        <span style={{ fontWeight: 600 }}>Period: ${Math.round(periodCost)}</span>
                        <span style={{ color: '#6b7280' }}>7d: ${Math.round(last7Cost)}</span>
                        <span style={{ color: '#6b7280' }}>3d: ${Math.round(last3Cost)}</span>
                        <span style={{ color: '#6b7280' }}>Yesterday: ${Math.round(yesterdayCost)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {team.members.map((m) => (
                        <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.35rem', background: '#e5e7eb', borderRadius: 4, fontSize: '0.75rem' }}>
                          {m}
                          {!teamsReadOnly && (
                            <button type="button" onClick={() => removeTeamMember(team.id, m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}>×</button>
                          )}
                        </span>
                      ))}
                      {!teamsReadOnly && (
                      <select
                        value=""
                        onChange={(e) => {
                          const v = e.target.value
                          if (v) { addTeamMember(team.id, v); e.target.value = '' }
                        }}
                        style={{ padding: '0.15rem 0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem' }}
                      >
                        <option value="">+ Add person</option>
                        {showPeopleForMatrix.filter((p) => !team.members.includes(p)).map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      )}
                    </div>
                    <table style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Person</th>
                          {dayNames.map((name) => (
                            <th key={name} style={{ padding: '0.25rem 0.35rem', textAlign: 'right', minWidth: 50 }}>{name}</th>
                          ))}
                          <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberCostByWeekday.map(({ member, byDay, total }) => (
                          <tr key={member} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.2rem 0.5rem' }}>{member}</td>
                            {byDay.map((val, i) => (
                              <td key={dayNames[i]} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>${Math.round(val)}</td>
                            ))}
                            <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${Math.round(total)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                          <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                          {costByWeekday.map((val, i) => (
                            <td key={dayNames[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>${Math.round(val)}</td>
                          ))}
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${Math.round(periodTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showMaxHoursTeams}
                onChange={(e) => setShowMaxHoursTeams(e.target.checked)}
              />
              show max hours
            </label>
          </section>
          </>
          )}
        </div>
      )}

      {activeTab === 'hours' && canAccessHours && (
        <div>
          {hoursTabLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
          <>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <label>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
              <input type="date" value={hoursDateStart} onChange={(e) => setHoursDateStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            </label>
            <label>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
              <input type="date" value={hoursDateEnd} onChange={(e) => setHoursDateEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            </label>
            <button
              type="button"
              onClick={() => {
                const s = new Date(hoursDateStart + 'T12:00:00')
                const e = new Date(hoursDateEnd + 'T12:00:00')
                s.setDate(s.getDate() - 7)
                e.setDate(e.getDate() - 7)
                setHoursDateStart(s.toISOString().slice(0, 10))
                setHoursDateEnd(e.toISOString().slice(0, 10))
              }}
              style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              ← last week
            </button>
            <button
              type="button"
              onClick={() => {
                const s = new Date(hoursDateStart + 'T12:00:00')
                const e = new Date(hoursDateEnd + 'T12:00:00')
                s.setDate(s.getDate() + 7)
                e.setDate(e.getDate() + 7)
                setHoursDateStart(s.toISOString().slice(0, 10))
                setHoursDateEnd(e.toISOString().slice(0, 10))
              }}
              style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              next week →
            </button>
          </div>
          {showPeopleForHours.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No people with Show in Hours selected. Go to Pay tab and check Show in Hours for people to track.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 200 }} />
                  {getDaysInRange(hoursDateStart, hoursDateEnd).map((d) => (
                    <col key={d} style={{ width: 72 }} />
                  ))}
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                    {getDaysInRange(hoursDateStart, hoursDateEnd).map((d) => (
                      <th key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                        {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                      </th>
                    ))}
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>HH:MM:SS</th>
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Decimal</th>
                  </tr>
                </thead>
                <tbody>
                  {showPeopleForHours.map((personName, idx) => {
                    const cfg = payConfig[personName]
                    const isSalary = cfg?.is_salary ?? false
                    return (
                      <tr key={personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ display: 'flex', flexDirection: 'row', gap: 0, marginRight: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => moveHoursRow(personName, 'up')}
                              disabled={idx === 0}
                              title="Move up"
                              style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveHoursRow(personName, 'down')}
                              disabled={idx === showPeopleForHours.length - 1}
                              title="Move down"
                              style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === showPeopleForHours.length - 1 ? 'not-allowed' : 'pointer', color: idx === showPeopleForHours.length - 1 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                            >
                              ▼
                            </button>
                          </span>
                          {personName}{isSalary && <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.35rem' }}>(salary)</span>}
                        </td>
                        {getDaysInRange(hoursDateStart, hoursDateEnd).map((d) => (
                          <td key={d} style={{ padding: '0.35rem 0.5rem', textAlign: isSalary ? 'center' : 'right' }}>
                            {isSalary ? (
                              <span style={{ color: '#6b7280' }}>{decimalToHms(getEffectiveHours(personName, d)) || '-'}</span>
                            ) : (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editingHoursCell?.personName === personName && editingHoursCell?.workDate === d ? editingHoursValue : decimalToHms(getHoursForPersonDate(personName, d))}
                                placeholder="-"
                                onFocus={(e) => {
                                  setEditingHoursCell({ personName, workDate: d })
                                  setEditingHoursValue(decimalToHms(getHoursForPersonDate(personName, d)) || '')
                                  e.target.select()
                                }}
                                onChange={(e) => setEditingHoursValue(e.target.value)}
                                onBlur={() => {
                                  const v = hmsToDecimal(editingHoursValue)
                                  saveHours(personName, d, v)
                                  setEditingHoursCell(null)
                                }}
                                style={{ width: 72, padding: '0.25rem 0.35rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
                              />
                            )}
                          </td>
                        ))}
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {decimalToHms(getDaysInRange(hoursDateStart, hoursDateEnd).reduce((s, d) => s + getEffectiveHours(personName, d), 0)) || '-'}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {(
                            getDaysInRange(hoursDateStart, hoursDateEnd).reduce((s, d) => s + getEffectiveHours(personName, d), 0)
                          ).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot style={{ background: '#f9fafb', fontWeight: 600 }}>
                  {(() => {
                    const grandTotal = showPeopleForHours.reduce((s, p) => s + getDaysInRange(hoursDateStart, hoursDateEnd).reduce((ds, d) => ds + getEffectiveHours(p, d), 0), 0)
                    return (
                      <>
                        <tr>
                          <td style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb' }}>Total (HH:MM:SS):</td>
                          {getDaysInRange(hoursDateStart, hoursDateEnd).map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getEffectiveHours(p, d), 0)
                            return (
                              <td key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                                {decimalToHms(daySum) || '-'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                            {decimalToHms(grandTotal) || '-'}
                          </td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>-</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb' }}>Total (Decimal):</td>
                          {getDaysInRange(hoursDateStart, hoursDateEnd).map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getEffectiveHours(p, d), 0)
                            return (
                              <td key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                                {daySum.toFixed(2)}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>-</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                            {grandTotal.toFixed(2)}
                          </td>
                        </tr>
                      </>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {editingLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>Edit job</h2>
            <form onSubmit={saveEditedLaborJob}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>User</label>
                <input
                  type="text"
                  value={editAssignedTo}
                  onChange={(e) => setEditAssignedTo(e.target.value)}
                  list="edit-roster-names"
                  placeholder="Person name"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
                <datalist id="edit-roster-names">
                  {allRosterNames().map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ flex: '0 0 100px' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Job #</label>
                  <input
                    type="text"
                    value={editJobNumber}
                    onChange={(e) => setEditJobNumber(e.target.value)}
                    maxLength={10}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
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
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
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

      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editing ? 'Edit person' : `Add ${KIND_LABELS[kind].slice(0, -1)}`}</h2>
            <form onSubmit={handleSave}>
              {!editing && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>List</label>
                  <select value={kind} onChange={(e) => setKind(e.target.value as PersonKind)} disabled={saving} style={{ width: '100%', padding: '0.5rem' }}>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>{KIND_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="p-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
                <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={saving} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="p-email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="p-phone" style={{ display: 'block', marginBottom: 4 }}>Phone</label>
                <input id="p-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="p-notes" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} rows={2} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={closeForm} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {inviteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <p style={{ marginBottom: '1rem' }}>They&apos;ll get an email to set their own password.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={confirmAndInvite} style={{ padding: '0.5rem 1rem' }}>Send invite</button>
              <button type="button" onClick={() => setInviteConfirm(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {laborVersionFormOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={closeLaborVersionForm}
        >
          <div
            style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
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
                      onClick={async () => {
                        if (!confirm(`Delete labor book "${editingLaborVersion.name}"? This will delete all entries in this version.`)) return
                        await deleteLaborVersion(editingLaborVersion)
                        closeLaborVersionForm()
                      }}
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={closeLaborEntryForm}
        >
          <div
            style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem' }}>{editingLaborEntry ? 'Edit entry' : 'New entry'}</h3>
            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            <form onSubmit={saveLaborEntry}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in *</label>
              <input
                type="text"
                list="people-labor-fixture-types"
                value={laborEntryFixtureName}
                onChange={(e) => setLaborEntryFixtureName(e.target.value)}
                required
                placeholder="Type or select fixture type..."
                autoComplete="off"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
              />
              <datalist id="people-labor-fixture-types">
                {fixtureTypes.map((ft) => (
                  <option key={ft.id} value={ft.name} />
                ))}
              </datalist>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Additional names (optional)</label>
              <input
                type="text"
                value={laborEntryAliasNames}
                onChange={(e) => setLaborEntryAliasNames(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.25rem', boxSizing: 'border-box' }}
                placeholder="e.g. WC, Commode"
              />
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>If any of these match a count row&apos;s Fixture or Tie-in, this labor rate is applied.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Rough In (hrs)</label>
                  <input type="number" min={0} step={0.01} value={laborEntryRoughIn} onChange={(e) => setLaborEntryRoughIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Top Out (hrs)</label>
                  <input type="number" min={0} step={0.01} value={laborEntryTopOut} onChange={(e) => setLaborEntryTopOut(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Trim Set (hrs)</label>
                  <input type="number" min={0} step={0.01} value={laborEntryTrimSet} onChange={(e) => setLaborEntryTrimSet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingLaborEntry && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete "${editingLaborEntry.fixture_types?.name ?? ''}" from this labor book?`)) return
                        await deleteLaborEntry(editingLaborEntry)
                        closeLaborEntryForm()
                      }}
                      style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={closeLaborEntryForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingLaborEntry} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborEntry ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
