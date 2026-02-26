import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { useAuth } from '../hooks/useAuth'
import NewReportModal from '../components/NewReportModal'
import JobReportsModal from '../components/JobReportsModal'
import { ErrorBoundary } from '../components/ErrorBoundary'
import type { Database } from '../types/database'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']
type JobsReceivableRow = Database['public']['Tables']['jobs_receivables']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }

type JobWithDetails = JobsLedgerRow & {
  materials: JobsLedgerMaterial[]
  fixtures: JobsLedgerFixture[]
  team_members: (JobsLedgerTeamMember & { users: { name: string } | null })[]
  report_count?: number
}

type TallyPartRow = {
  id: string
  job_id: string
  fixture_name: string
  part_id: string | null
  quantity: number
  created_by_user_id: string
  created_at: string
  price_at_time: number | null
  fixture_cost: number | null
  purchase_order_id: string | null
  purchase_order_name: string | null
  purchase_order_status: string | null
  hcp_number: string | null
  job_name: string | null
  job_address: string | null
  part_name: string | null
  part_manufacturer: string | null
  created_by_name: string | null
}

type JobsTab = 'receivables' | 'reports' | 'stages' | 'ledger' | 'sub_sheet_ledger' | 'teams-summary' | 'parts' | 'job-summary'

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
type LaborJob = { id: string; assigned_to_name: string; address: string; job_number: string | null; labor_rate: number | null; job_date: string | null; created_at: string | null; distance_miles?: number | null; items?: Array<{ fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean }> }

const tabStyle = (active: boolean) => ({
  padding: '0.75rem 1.5rem',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
  flexShrink: 0,
})

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTimeSince(iso: string | null): string {
  if (!iso) return '—'
  const now = new Date()
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffMs / 604800000)
  const diffMonths = Math.floor(diffMs / 2592000000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`
  return `${Math.floor(diffMonths / 12)} year${Math.floor(diffMonths / 12) !== 1 ? 's' : ''}`
}

type MaterialRow = { id: string; description: string; amount: number }
type FixtureRow = { id: string; name: string; count: number }

const JOBS_TABS: JobsTab[] = ['receivables', 'reports', 'stages', 'ledger', 'sub_sheet_ledger', 'teams-summary', 'parts', 'job-summary']

const LABOR_ASSIGNED_DELIMITER = ' | '

export default function Jobs() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: authUser, role: authRole } = useAuth()
  const [activeTab, setActiveTab] = useState<JobsTab>('ledger')
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [billingSortAsc, setBillingSortAsc] = useState(true) // true = lowest HCP first (asc)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<JobWithDetails | null>(null)
  const [hcpNumber, setHcpNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [googleDriveLink, setGoogleDriveLink] = useState('')
  const [jobPlansLink, setJobPlansLink] = useState('')
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
  const [laborDistance, setLaborDistance] = useState('0')
  const [laborJobNumber, setLaborJobNumber] = useState('')
  const [laborRate, setLaborRate] = useState('')
  const [laborDate, setLaborDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [laborFixtureRows, setLaborFixtureRows] = useState<LaborFixtureRow[]>([{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
  const [laborSaving, setLaborSaving] = useState(false)
  // Sub Sheet Ledger state
  const [laborJobs, setLaborJobs] = useState<LaborJob[]>([])
  const [laborJobsLoading, setLaborJobsLoading] = useState(false)
  const [laborJobDeletingId, setLaborJobDeletingId] = useState<string | null>(null)
  const [editingLaborJob, setEditingLaborJob] = useState<LaborJob | null>(null)
  const [laborModalOpen, setLaborModalOpen] = useState(false)
  const [driveSettingsOpen, setDriveSettingsOpen] = useState(false)
  const [driveMileageCost, setDriveMileageCost] = useState<number | null>(null)
  const [driveTimePerMile, setDriveTimePerMile] = useState<number | null>(null)
  const [driveSettingsSaving, setDriveSettingsSaving] = useState(false)
  const [defaultLaborRateModalOpen, setDefaultLaborRateModalOpen] = useState(false)
  const [defaultLaborRateValue, setDefaultLaborRateValue] = useState('')
  const [defaultLaborRateSaving, setDefaultLaborRateSaving] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)

  // Receivables tab state
  const [receivables, setReceivables] = useState<JobsReceivableRow[]>([])
  const [receivablesLoading, setReceivablesLoading] = useState(false)
  const [receivablesFormOpen, setReceivablesFormOpen] = useState(false)
  const [editingReceivable, setEditingReceivable] = useState<JobsReceivableRow | null>(null)
  const [receivablesPayer, setReceivablesPayer] = useState('')
  const [receivablesPointOfContact, setReceivablesPointOfContact] = useState('')
  const [receivablesAccountRepName, setReceivablesAccountRepName] = useState('')
  const [receivablesAmount, setReceivablesAmount] = useState('')
  const [receivablesSaving, setReceivablesSaving] = useState(false)
  const [receivablesDeletingId, setReceivablesDeletingId] = useState<string | null>(null)

  // Reports tab state
  type ReportWithJob = {
    id: string
    template_id: string
    template_name: string
    created_by_user_id: string
    created_by_name: string
    created_at: string
    updated_at: string
    field_values: Record<string, string>
    job_ledger_id: string | null
    project_id: string | null
    job_display_name: string
    job_hcp_number: string
  }
  const [reportsList, setReportsList] = useState<ReportWithJob[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsSearch, setReportsSearch] = useState('')
  const [reportsViewMode, setReportsViewMode] = useState<'job' | 'person'>('job')
  const [reportsExpandedJobs, setReportsExpandedJobs] = useState<Set<string>>(new Set())
  const [reportsExpandedPersons, setReportsExpandedPersons] = useState<Set<string>>(new Set())
  const [newReportModalOpen, setNewReportModalOpen] = useState(false)
  const [reportsDeletingId, setReportsDeletingId] = useState<string | null>(null)
  const [tallyParts, setTallyParts] = useState<TallyPartRow[]>([])
  const [tallyPartsLoading, setTallyPartsLoading] = useState(false)
  const [tallyPartsSearch, setTallyPartsSearch] = useState('')
  const [showMyJobsOnly, setShowMyJobsOnly] = useState(false)
  const [myJobIds, setMyJobIds] = useState<Set<string> | null>(null)
  const [deletingTallyPartId, setDeletingTallyPartId] = useState<string | null>(null)
  const [updatingFixtureCostId, setUpdatingFixtureCostId] = useState<string | null>(null)
  const [expandedPartsJobIds, setExpandedPartsJobIds] = useState<Set<string>>(new Set())
  const [pendingScrollToPartsJobId, setPendingScrollToPartsJobId] = useState<string | null>(null)
  const [reportTemplatesModalOpen, setReportTemplatesModalOpen] = useState(false)
  const [reportTemplatesList, setReportTemplatesList] = useState<Array<{ id: string; name: string; sequence_order: number }>>([])
  const [reportTemplatesLoading, setReportTemplatesLoading] = useState(false)
  const [templateFormOpen, setTemplateFormOpen] = useState(false)
  const [editingReportTemplateId, setEditingReportTemplateId] = useState<string | null>(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateFields, setNewTemplateFields] = useState<string[]>([''])
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateDeletingId, setTemplateDeletingId] = useState<string | null>(null)
  const [stagesSectionOpen, setStagesSectionOpen] = useState({ working: true, readyToBill: true, billed: true, paid: true })
  const [stagesSearchQuery, setStagesSearchQuery] = useState('')
  const [stagesStatusUpdatingId, setStagesStatusUpdatingId] = useState<string | null>(null)
  const [viewReportsJob, setViewReportsJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [readyForBillingJob, setReadyForBillingJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [readyForBillingChecked1, setReadyForBillingChecked1] = useState(false)
  const [readyForBillingChecked2, setReadyForBillingChecked2] = useState(false)
  const [sendBackJob, setSendBackJob] = useState<{ id: string; hcpNumber: string; jobName: string; toStatus: 'working' | 'ready_to_bill' } | null>(null)
  const [sendBackChecked, setSendBackChecked] = useState(false)
  const [sendBackSentBy, setSendBackSentBy] = useState<string | null>(null)
  const [sendBackConfirmJob, setSendBackConfirmJob] = useState<{ id: string; toStatus: 'ready_to_bill' | 'billed' } | null>(null)
  const [confirmJobStatusJob, setConfirmJobStatusJob] = useState<{ id: string; toStatus: 'billed' | 'paid'; message: string } | null>(null)
  const [stagesHamMode, setStagesHamMode] = useState(() => {
    try {
      return localStorage.getItem('jobs-stages-ham-mode') === 'true'
    } catch {
      return false
    }
  })
  const [assignedEditJobId, setAssignedEditJobId] = useState<string | null>(null)
  const [assignedEditSelectedIds, setAssignedEditSelectedIds] = useState<string[]>([])
  const [assignedEditSavingId, setAssignedEditSavingId] = useState<string | null>(null)
  const assignedEditDropdownRef = useRef<HTMLDivElement | null>(null)
  const jobNameInputRef = useRef<HTMLInputElement | null>(null)
  const jobAddressInputRef = useRef<HTMLInputElement | null>(null)

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
    const [matsRes, fixturesRes, teamRes, reportsRes] = await Promise.all([
      supabase.from('jobs_ledger_materials').select('*').in('job_id', jobIds).order('sequence_order'),
      supabase.from('jobs_ledger_fixtures').select('*').in('job_id', jobIds).order('sequence_order'),
      supabase
        .from('jobs_ledger_team_members')
        .select('*, users(name)')
        .in('job_id', jobIds),
      supabase.from('reports').select('job_ledger_id').in('job_ledger_id', jobIds),
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
    const reportsList = (reportsRes.data ?? []) as Array<{ job_ledger_id: string | null }>
    const reportCountByJob = new Map<string, number>()
    for (const r of reportsList) {
      if (r.job_ledger_id) {
        reportCountByJob.set(r.job_ledger_id, (reportCountByJob.get(r.job_ledger_id) ?? 0) + 1)
      }
    }
    const jobsWithDetails: JobWithDetails[] = jobList.map((j) => ({
      ...j,
      materials: (materialsByJob.get(j.id) ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      fixtures: (fixturesByJob.get(j.id) ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      team_members: teamByJob.get(j.id) ?? [],
      report_count: reportCountByJob.get(j.id) ?? 0,
    }))
    setJobs(jobsWithDetails)
    setLoading(false)
  }

  function toggleStagesHamMode() {
    setStagesHamMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem('jobs-stages-ham-mode', String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  async function updateJobStatus(jobId: string, toStatus: 'working' | 'ready_to_bill' | 'billed' | 'paid') {
    setStagesStatusUpdatingId(jobId)
    setError(null)
    const { data, error: err } = await supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: toStatus })
    setStagesStatusUpdatingId(null)
    if (err) {
      setError(err.message)
      return
    }
    const result = data as { error?: string } | null
    if (result?.error) {
      setError(result.error)
      return
    }
    await loadJobs()
  }

  useEffect(() => {
    if (!sendBackJob) {
      setSendBackSentBy(null)
      return
    }
    const toStatusForEvent = sendBackJob.toStatus === 'working' ? 'ready_to_bill' : 'billed'
    supabase
      .from('job_status_events')
      .select('users(name)')
      .eq('job_id', sendBackJob.id)
      .eq('to_status', toStatusForEvent)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { users: { name: string } | null } | null
        setSendBackSentBy(row?.users?.name ?? null)
      })
  }, [sendBackJob])

  useEffect(() => {
    if (!assignedEditJobId) return
    function handleClickOutside(e: MouseEvent) {
      if (assignedEditDropdownRef.current && !assignedEditDropdownRef.current.contains(e.target as Node)) {
        setAssignedEditJobId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [assignedEditJobId])

  async function loadUsers() {
    if (!authUser?.id) return
    const [usersRes, meRes] = await Promise.all([
      supabase.from('users').select('id, name, email, role').in('role', ['assistant', 'master_technician', 'subcontractor', 'estimator', 'primary']).order('name'),
      supabase.from('users').select('role').eq('id', authUser.id).single(),
    ])
    let usersList = (usersRes.data as UserRow[]) ?? []
    const role = (meRes.data as { role?: string } | null)?.role
    // #region agent log
    fetch('http://127.0.0.1:7507/ingest/676b7b9a-6887-4048-ac57-4002ec253a57',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0419eb'},body:JSON.stringify({sessionId:'0419eb',location:'Jobs.tsx:loadUsers',message:'loadUsers set role',data:{role,roleType:typeof role,rawMeRes:meRes.data},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{})
    // #endregion
    setMyRole(role ?? null)
    if (role === 'dev') {
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

  async function loadReceivables() {
    if (!authUser?.id) return
    setReceivablesLoading(true)
    setError(null)
    const { data, error: err } = await supabase.from('jobs_receivables').select('*').order('created_at', { ascending: false })
    if (err) {
      setError(`Failed to load receivables: ${err.message}`)
    } else {
      setReceivables((data as JobsReceivableRow[]) ?? [])
    }
    setReceivablesLoading(false)
  }

  async function loadReports() {
    if (!authUser?.id) return
    setReportsLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('list_reports_with_job_info')
    if (err) {
      setError(`Failed to load reports: ${err.message}`)
    } else {
      setReportsList((Array.isArray(data) ? data : []) as ReportWithJob[])
    }
    setReportsLoading(false)
  }

  async function loadReportTemplates() {
    setReportTemplatesLoading(true)
    const { data, error: err } = await supabase.from('report_templates').select('id, name, sequence_order').order('sequence_order')
    if (err) {
      setError(`Failed to load templates: ${err.message}`)
    } else {
      setReportTemplatesList((data as Array<{ id: string; name: string; sequence_order: number }>) ?? [])
    }
    setReportTemplatesLoading(false)
  }

  async function deleteReport(id: string) {
    if (!confirm('Delete this report?')) return
    setReportsDeletingId(id)
    const { error: err } = await supabase.from('reports').delete().eq('id', id)
    if (err) setError(`Failed to delete report: ${err.message}`)
    else await loadReports()
    setReportsDeletingId(null)
  }

  const canManageTemplates = myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant'

  function openReportTemplatesModal() {
    setReportTemplatesModalOpen(true)
    setTemplateFormOpen(false)
    setEditingReportTemplateId(null)
    loadReportTemplates()
  }

  function openAddTemplate() {
    setEditingReportTemplateId(null)
    setNewTemplateName('')
    setNewTemplateFields([''])
    setTemplateFormOpen(true)
  }

  async function openEditReportTemplate(template: { id: string; name: string; sequence_order: number }) {
    setEditingReportTemplateId(template.id)
    setNewTemplateName(template.name)
    const { data: fields } = await supabase
      .from('report_template_fields')
      .select('label')
      .eq('template_id', template.id)
      .order('sequence_order')
    const labels = (fields as Array<{ label: string }> | null)?.map((f) => f.label) ?? []
    setNewTemplateFields(labels.length > 0 ? labels : [''])
    setTemplateFormOpen(true)
  }

  function closeTemplateForm() {
    setTemplateFormOpen(false)
    setEditingReportTemplateId(null)
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTemplateName.trim()) return
    setTemplateSaving(true)
    setError(null)
    const fields = newTemplateFields.map((l) => l.trim()).filter(Boolean)

    if (editingReportTemplateId) {
      const { error: tErr } = await supabase
        .from('report_templates')
        .update({ name: newTemplateName.trim() })
        .eq('id', editingReportTemplateId)
      if (tErr) {
        setError(tErr.message)
        setTemplateSaving(false)
        return
      }
      const { error: delErr } = await supabase.from('report_template_fields').delete().eq('template_id', editingReportTemplateId)
      if (delErr) {
        setError(delErr.message)
        setTemplateSaving(false)
        return
      }
      if (fields.length > 0) {
        const { error: fErr } = await supabase.from('report_template_fields').insert(
          fields.map((label, i) => ({ template_id: editingReportTemplateId, label, sequence_order: i }))
        )
        if (fErr) {
          setError(fErr.message)
          setTemplateSaving(false)
          return
        }
      }
    } else {
      const { data: t, error: tErr } = await supabase
        .from('report_templates')
        .insert({ name: newTemplateName.trim(), sequence_order: 999 })
        .select('id')
        .single()
      if (tErr) {
        setError(tErr.message)
        setTemplateSaving(false)
        return
      }
      const templateId = (t as { id: string }).id
      if (fields.length > 0) {
        const { error: fErr } = await supabase.from('report_template_fields').insert(
          fields.map((label, i) => ({ template_id: templateId, label, sequence_order: i }))
        )
        if (fErr) {
          setError(fErr.message)
          setTemplateSaving(false)
          return
        }
      }
    }

    closeTemplateForm()
    setTemplateSaving(false)
    loadReportTemplates()
    loadReports()
  }

  async function deleteReportTemplate(id: string) {
    const { count } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('template_id', id)
    if ((count ?? 0) > 0) {
      setError('Cannot delete: this template has reports.')
      return
    }
    if (!confirm('Delete this template?')) return
    setTemplateDeletingId(id)
    const { error: err } = await supabase.from('report_templates').delete().eq('id', id)
    setTemplateDeletingId(null)
    if (err) setError(err.message)
    else {
      closeTemplateForm()
      loadReportTemplates()
    }
  }

  async function getEffectiveMasterId(): Promise<string | null> {
    if (!authUser?.id) return null
    const { data: me } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    const role = (me as { role?: string } | null)?.role
    if (role === 'dev' || role === 'master_technician') return authUser.id
    if (role === 'assistant') {
      const { data: adoptions } = await supabase.from('master_assistants').select('master_id').eq('assistant_id', authUser.id)
      const masterId = (adoptions as { master_id: string }[] | null)?.[0]?.master_id
      return masterId ?? authUser.id
    }
    return authUser.id
  }

  function openAddReceivable() {
    setEditingReceivable(null)
    setReceivablesPayer('')
    setReceivablesPointOfContact('')
    setReceivablesAccountRepName('')
    setReceivablesAmount('')
    setReceivablesFormOpen(true)
  }

  function openEditReceivable(r: JobsReceivableRow) {
    setEditingReceivable(r)
    setReceivablesPayer(r.payer ?? '')
    setReceivablesPointOfContact(r.point_of_contact ?? '')
    setReceivablesAccountRepName(r.account_rep_name ?? '')
    setReceivablesAmount(r.amount != null ? String(r.amount) : '')
    setReceivablesFormOpen(true)
  }

  function closeReceivablesForm() {
    setReceivablesFormOpen(false)
    setEditingReceivable(null)
  }

  async function saveReceivable(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    const masterId = await getEffectiveMasterId()
    if (!masterId) {
      setError('Could not determine master for this receivable.')
      return
    }
    setReceivablesSaving(true)
    setError(null)
    const amountNum = parseFloat(receivablesAmount) || 0
    if (editingReceivable) {
      const { error: err } = await supabase
        .from('jobs_receivables')
        .update({
          payer: receivablesPayer.trim(),
          point_of_contact: receivablesPointOfContact.trim(),
          account_rep_name: receivablesAccountRepName.trim() || null,
          amount: amountNum,
        })
        .eq('id', editingReceivable.id)
      if (err) setError(err.message)
      else {
        await loadReceivables()
        closeReceivablesForm()
      }
    } else {
      const { error: err } = await supabase.from('jobs_receivables').insert({
        master_user_id: masterId,
        payer: receivablesPayer.trim(),
        point_of_contact: receivablesPointOfContact.trim(),
        account_rep_name: receivablesAccountRepName.trim() || null,
        amount: amountNum,
      })
      if (err) setError(err.message)
      else {
        await loadReceivables()
        closeReceivablesForm()
      }
    }
    setReceivablesSaving(false)
  }

  async function deleteReceivable(id: string) {
    if (!confirm('Delete this receivable?')) return
    setReceivablesDeletingId(id)
    const { error: err } = await supabase.from('jobs_receivables').delete().eq('id', id)
    if (err) setError(err.message)
    else await loadReceivables()
    setReceivablesDeletingId(null)
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
    const fromSubs = byKind('sub')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
    const fromPrimaries = users
      .filter((u) => u.role === 'primary')
      .map((u) => u.name?.trim())
      .filter((n): n is string => !!n)
    return [...new Set([...fromSubs, ...fromPrimaries])].sort((a, b) => a.localeCompare(b))
  }

  function accountRepOptions(): string[] {
    const masters = byKind('master_technician').map((item) => item.name?.trim()).filter((n): n is string => !!n)
    const subs = byKind('sub').map((item) => item.name?.trim()).filter((n): n is string => !!n)
    const primaries = users.filter((u) => u.role === 'primary').map((u) => u.name?.trim()).filter((n): n is string => !!n)
    const seen = new Set<string>()
    const result: string[] = []
    for (const n of [...masters, ...subs, ...primaries].sort((a, b) => a.localeCompare(b))) {
      if (!seen.has(n)) {
        seen.add(n)
        result.push(n)
      }
    }
    return result
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
      .select('id, assigned_to_name, address, job_number, labor_rate, job_date, created_at, distance_miles')
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

  async function loadTallyParts() {
    if (!authUser?.id) return
    setTallyPartsLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('list_tally_parts_with_po')
    if (err) {
      setError(err.message)
      setTallyParts([])
    } else {
      setTallyParts((data ?? []) as TallyPartRow[])
    }
    setTallyPartsLoading(false)
  }

  async function deleteTallyPart(id: string) {
    if (!confirm('Remove this part from the tally?')) return
    setDeletingTallyPartId(id)
    setError(null)
    const { error: err } = await supabase.from('jobs_tally_parts').delete().eq('id', id)
    if (err) {
      setError(err.message)
    } else {
      setTallyParts((prev) => prev.filter((r) => r.id !== id))
    }
    setDeletingTallyPartId(null)
  }

  async function updateFixtureCost(id: string, cost: number) {
    setUpdatingFixtureCostId(id)
    setError(null)
    const { error: err } = await supabase.from('jobs_tally_parts').update({ fixture_cost: cost }).eq('id', id)
    if (err) {
      setError(err.message)
    } else {
      setTallyParts((prev) =>
        prev.map((r) => (r.id === id ? { ...r, fixture_cost: cost } : r))
      )
    }
    setUpdatingFixtureCostId(null)
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

    const errors: string[] = []
    if (assignedNames.length === 0) {
      errors.push('Select at least one subcontractor or team member.')
    }
    if (!address) {
      errors.push('Enter a job address.')
    }
    const distanceNum = laborDistance.trim() ? parseFloat(laborDistance) : NaN
    if (laborDistance.trim() === '' || isNaN(distanceNum) || distanceNum < 0) {
      errors.push('Enter distance (mi) as a number 0 or greater.')
    }
    const validRows = laborFixtureRows.filter((r) => {
      const hasFixture = (r.fixture ?? '').trim()
      const isFixed = r.is_fixed ?? false
      return hasFixture && (isFixed ? Number(r.hrs_per_unit) >= 0 : Number(r.count) > 0)
    })
    if (validRows.length === 0) {
      const hasAnyFixture = laborFixtureRows.some((r) => (r.fixture ?? '').trim())
      const hasInvalidCount = laborFixtureRows.some((r) => {
        const isFixed = r.is_fixed ?? false
        return (r.fixture ?? '').trim() && !isFixed && (Number(r.count) || 0) <= 0
      })
      const hasInvalidHrs = laborFixtureRows.some((r) => {
        const isFixed = r.is_fixed ?? false
        return (r.fixture ?? '').trim() && isFixed && Number(r.hrs_per_unit) < 0
      })
      if (!hasAnyFixture) {
        errors.push('Add at least one fixture or tie-in with a name.')
      } else if (hasInvalidCount) {
        errors.push('For each fixture (non-fixed), enter a count greater than 0.')
      } else if (hasInvalidHrs) {
        errors.push('For fixed fixtures, enter hours per unit of 0 or more.')
      } else {
        errors.push('Add at least one fixture or tie-in with a name and valid count or hours.')
      }
    }
    if (errors.length > 0) {
      setError(errors.length === 1 ? errors[0]! : `To save this job:\n• ${errors.join('\n• ')}`)
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
        distance_miles: parseFloat(laborDistance) || 0,
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
    setLaborDistance('0')
    setLaborJobNumber('')
    setLaborRate('')
    setLaborDate(new Date().toISOString().slice(0, 10))
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

  const [editingLaborJobDistanceId, setEditingLaborJobDistanceId] = useState<string | null>(null)
  const [editingLaborJobDistanceValue, setEditingLaborJobDistanceValue] = useState('')

  async function updateLaborJobDistance(jobId: string, value: string) {
    setError(null)
    const trimmed = value.trim()
    const num = trimmed === '' ? null : parseFloat(trimmed)
    if (num != null && (isNaN(num) || num < 0)) return
    const { error: err } = await supabase.from('people_labor_jobs').update({ distance_miles: num }).eq('id', jobId)
    if (err) setError(err.message)
    else {
      setLaborJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, distance_miles: num } : j)))
    }
    setEditingLaborJobDistanceId(null)
  }

  function resetLaborForm() {
    setLaborAssignedTo([])
    setLaborAddress('')
    setLaborDistance('0')
    setLaborJobNumber('')
    setLaborRate('')
    setLaborDate(new Date().toISOString().slice(0, 10))
    setLaborFixtureRows([{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
  }

  function closeLaborModal() {
    setEditingLaborJob(null)
    setLaborModalOpen(false)
    resetLaborForm()
  }

  function openEditLaborJob(job: LaborJob) {
    setEditingLaborJob(job)
    const names = job.assigned_to_name
      ? job.assigned_to_name.split(LABOR_ASSIGNED_DELIMITER).map((s) => s.trim()).filter(Boolean)
      : []
    setLaborAssignedTo(names)
    setLaborAddress(job.address)
    setLaborDistance(job.distance_miles != null ? String(job.distance_miles) : '0')
    setLaborJobNumber(job.job_number ?? '')
    setLaborDate(job.job_date ?? new Date().toISOString().slice(0, 10))
    setLaborRate(job.labor_rate != null ? String(job.labor_rate) : '')
    const rows = (job.items ?? []).map((i) => ({
      id: crypto.randomUUID(),
      fixture: i.fixture ?? '',
      count: Number(i.count) || 1,
      hrs_per_unit: Number(i.hrs_per_unit) || 0,
      is_fixed: i.is_fixed ?? false,
    }))
    setLaborFixtureRows(rows.length > 0 ? rows : [{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false }])
    setError(null)
  }

  function openNewLaborJob() {
    setEditingLaborJob(null)
    resetLaborForm()
    setLaborModalOpen(true)
    setError(null)
  }

  async function saveEditedLaborJob(e: React.FormEvent) {
    e.preventDefault()
    if (!editingLaborJob) return
    const assignedNames = laborAssignedTo.map((n) => n.trim()).filter(Boolean)
    const assigned = assignedNames.join(LABOR_ASSIGNED_DELIMITER)
    const address = laborAddress.trim()

    const errors: string[] = []
    if (assignedNames.length === 0) {
      errors.push('Select at least one subcontractor or team member.')
    }
    if (!address) {
      errors.push('Enter a job address.')
    }
    const distanceNum = laborDistance.trim() ? parseFloat(laborDistance) : NaN
    if (laborDistance.trim() === '' || isNaN(distanceNum) || distanceNum < 0) {
      errors.push('Enter distance (mi) as a number 0 or greater.')
    }
    const validRows = laborFixtureRows.filter((r) => {
      const hasFixture = (r.fixture ?? '').trim()
      const isFixed = r.is_fixed ?? false
      return hasFixture && (isFixed ? Number(r.hrs_per_unit) >= 0 : Number(r.count) > 0)
    })
    if (validRows.length === 0) {
      const hasAnyFixture = laborFixtureRows.some((r) => (r.fixture ?? '').trim())
      const hasInvalidCount = laborFixtureRows.some((r) => {
        const isFixed = r.is_fixed ?? false
        return (r.fixture ?? '').trim() && !isFixed && (Number(r.count) || 0) <= 0
      })
      const hasInvalidHrs = laborFixtureRows.some((r) => {
        const isFixed = r.is_fixed ?? false
        return (r.fixture ?? '').trim() && isFixed && Number(r.hrs_per_unit) < 0
      })
      if (!hasAnyFixture) {
        errors.push('Add at least one fixture or tie-in with a name.')
      } else if (hasInvalidCount) {
        errors.push('For each fixture (non-fixed), enter a count greater than 0.')
      } else if (hasInvalidHrs) {
        errors.push('For fixed fixtures, enter hours per unit of 0 or more.')
      } else {
        errors.push('Add at least one fixture or tie-in with a name and valid count or hours.')
      }
    }
    if (errors.length > 0) {
      setError(errors.length === 1 ? errors[0]! : `To save this job:\n• ${errors.join('\n• ')}`)
      return
    }
    setLaborSaving(true)
    setError(null)
    const laborRateNum = laborRate.trim() === '' ? null : parseFloat(laborRate) || null
    const { error: jobErr } = await supabase
      .from('people_labor_jobs')
      .update({
        assigned_to_name: assigned,
        address,
        job_number: laborJobNumber.trim().slice(0, 10) || null,
        labor_rate: laborRateNum,
        job_date: laborDate.trim() ? laborDate.trim() : null,
        distance_miles: parseFloat(laborDistance) || 0,
      })
      .eq('id', editingLaborJob.id)
    if (jobErr) {
      setError(jobErr.message)
      setLaborSaving(false)
      return
    }
    const { error: delErr } = await supabase.from('people_labor_job_items').delete().eq('job_id', editingLaborJob.id)
    if (delErr) {
      setError(delErr.message)
      setLaborSaving(false)
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
        setLaborSaving(false)
        return
      }
    }
    setLaborSaving(false)
    closeLaborModal()
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
    const editJobId = searchParams.get('edit')
    const editLaborHcp = searchParams.get('editLabor')
    const isPrimary = authRole === 'primary' || myRole === 'primary'
    // When edit=jobId is present, force Stages tab so jobs load
    if (editJobId) {
      setActiveTab('stages')
      if (tab !== 'stages') {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'stages')
          return next
        }, { replace: true })
      }
      return
    }
    // When editLabor=hcp is present, force Sub Sheet Ledger tab so labor jobs load
    if (editLaborHcp) {
      setActiveTab('sub_sheet_ledger')
      if (tab !== 'sub_sheet_ledger') {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'sub_sheet_ledger')
          return next
        }, { replace: true })
      }
      return
    }
    // When editParts=jobId is present, force Parts tab so tally parts load
    const editPartsJobId = searchParams.get('editParts')
    if (editPartsJobId) {
      setActiveTab('parts')
      if (tab !== 'parts') {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'parts')
          return next
        }, { replace: true })
      }
      return
    }
    // Only primaries default to Reports; everyone else defaults to Billing
    if (isPrimary) {
      const primaryTabs = ['reports', 'ledger']
      if (tab && primaryTabs.includes(tab)) {
        setActiveTab(tab as JobsTab)
      } else if (!tab || !primaryTabs.includes(tab)) {
        setActiveTab('reports')
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'reports')
          return next
        }, { replace: true })
      }
      return
    }
    if (tab === 'labor') {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'sub_sheet_ledger')
        return next
      }, { replace: true })
      setActiveTab('sub_sheet_ledger')
    } else if (tab && JOBS_TABS.includes(tab as JobsTab)) {
      setActiveTab(tab as JobsTab)
    } else if (!tab) {
      // Default to Billing
      setActiveTab('ledger')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'ledger')
        return next
      }, { replace: true })
    }
  }, [searchParams, myRole, authRole])

  useEffect(() => {
    const newJob = searchParams.get('newJob') === 'true'
    const tab = searchParams.get('tab')
    if (newJob && (tab === 'sub_sheet_ledger' || tab === 'labor')) {
      setActiveTab('sub_sheet_ledger')
      setLaborModalOpen(true)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('newJob')
        if (tab === 'labor') next.set('tab', 'sub_sheet_ledger')
        return next
      }, { replace: true })
    } else if (newJob && tab === 'ledger') {
      setActiveTab('ledger')
      setEditing(null)
      setHcpNumber('')
      setJobName('')
      setJobAddress('')
      setGoogleDriveLink('')
      setJobPlansLink('')
      setRevenue('')
      setMaterials([{ id: crypto.randomUUID(), description: '', amount: 0 }])
      setFixtures([{ id: crypto.randomUUID(), name: '', count: 1 }])
      setTeamMemberIds([])
      setFormOpen(true)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('newJob')
        return next
      }, { replace: true })
    }
  }, [searchParams])

  // When edit=jobId is in URL and jobs are loaded, open the edit modal
  const editJobId = searchParams.get('edit')
  useEffect(() => {
    if (!editJobId || jobs.length === 0 || loading) return
    const job = jobs.find((j) => j.id === editJobId)
    if (job) {
      openEdit(job)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('edit')
        return next
      }, { replace: true })
    }
  }, [editJobId, jobs, loading])

  // When editLabor=hcp is in URL and labor jobs are loaded, open edit or new labor modal
  const editLaborHcp = searchParams.get('editLabor')
  useEffect(() => {
    if (!editLaborHcp || laborJobsLoading) return
    const hcpLower = editLaborHcp.trim().toLowerCase()
    const laborJob = laborJobs.find((j) => (j.job_number ?? '').trim().toLowerCase() === hcpLower)
    if (laborJob) {
      openEditLaborJob(laborJob)
    } else {
      openNewLaborJob()
      setLaborJobNumber(editLaborHcp.trim())
    }
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('editLabor')
      return next
    }, { replace: true })
  }, [editLaborHcp, laborJobs, laborJobsLoading])

  // When editParts=jobId is in URL and tally parts are loaded, expand job and scroll to it
  const editPartsJobId = searchParams.get('editParts')
  useEffect(() => {
    if (!editPartsJobId || tallyPartsLoading) return
    setActiveTab('parts')
    setExpandedPartsJobIds((prev) => new Set(prev).add(editPartsJobId))
    setTallyPartsSearch('')
    setPendingScrollToPartsJobId(editPartsJobId)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('editParts')
      next.set('tab', 'parts') // Keep Parts tab when clearing editParts
      return next
    }, { replace: true })
  }, [editPartsJobId, tallyPartsLoading])

  // Scroll to job row when it has been expanded for editParts
  useEffect(() => {
    if (!pendingScrollToPartsJobId || !expandedPartsJobIds.has(pendingScrollToPartsJobId)) return
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-job-id="${pendingScrollToPartsJobId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendingScrollToPartsJobId(null)
    }, 100)
    return () => clearTimeout(timer)
  }, [pendingScrollToPartsJobId, expandedPartsJobIds])

  useEffect(() => {
    if (activeTab === 'sub_sheet_ledger' || activeTab === 'receivables') loadRoster()
  }, [authUser?.id, activeTab])

  useEffect(() => {
    if ((laborModalOpen || editingLaborJob) && authUser?.id) loadServiceTypes()
  }, [authUser?.id, laborModalOpen, editingLaborJob])

  useEffect(() => {
    if ((laborModalOpen || editingLaborJob) && selectedServiceTypeId && authUser?.id) {
      setLaborBookEntriesVersionId(null)
      loadFixtureTypes()
      loadLaborBookVersions()
    }
  }, [laborModalOpen, editingLaborJob, selectedServiceTypeId, authUser?.id])

  useEffect(() => {
    if (laborBookEntriesVersionId) loadLaborBookEntries(laborBookEntriesVersionId)
    else setLaborBookEntries([])
  }, [laborBookEntriesVersionId])

  useEffect(() => {
    if (activeTab === 'stages' && authUser?.id) loadJobs()
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if ((activeTab === 'ledger' || activeTab === 'sub_sheet_ledger' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) loadLaborJobs()
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if ((activeTab === 'parts' || activeTab === 'job-summary') && authUser?.id) loadTallyParts()
  }, [activeTab, authUser?.id])

  // Fetch job IDs where current user is a team member (for "show my jobs only" filter)
  useEffect(() => {
    if (activeTab === 'parts' && authUser?.id) {
      supabase
        .from('jobs_ledger_team_members')
        .select('job_id')
        .eq('user_id', authUser.id)
        .then(({ data }) => setMyJobIds(new Set((data ?? []).map((r) => r.job_id))))
    }
  }, [activeTab, authUser?.id])

  // Restore billing sort preference from localStorage (per user)
  useEffect(() => {
    if (authUser?.id && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`jobs_billing_sort_asc_${authUser.id}`)
        if (stored !== null) setBillingSortAsc(stored === 'true')
      } catch {
        /* ignore */
      }
    }
  }, [authUser?.id])

  async function loadDriveSettings() {
    if (!authUser?.id) return
    const { data: rows } = await supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile'])
    const byKey = new Map((rows ?? []).map((r) => [r.key, r.value_num]))
    setDriveMileageCost(byKey.get('drive_mileage_cost') ?? null)
    setDriveTimePerMile(byKey.get('drive_time_per_mile') ?? null)
  }

  useEffect(() => {
    if ((activeTab === 'sub_sheet_ledger' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) loadDriveSettings()
  }, [activeTab, authUser?.id])

  async function saveDriveSettings(e: React.FormEvent) {
    e.preventDefault()
    setDriveSettingsSaving(true)
    setError(null)
    const mileageCost = driveMileageCost ?? 0.70
    const timePerMile = driveTimePerMile ?? 0.02
    const { error: err } = await supabase.from('app_settings').upsert(
      [
        { key: 'drive_mileage_cost', value_num: mileageCost },
        { key: 'drive_time_per_mile', value_num: timePerMile },
      ],
      { onConflict: 'key' }
    )
    setDriveSettingsSaving(false)
    if (err) setError(err.message)
    else setDriveSettingsOpen(false)
  }

  async function loadDefaultLaborRate() {
    const { data } = await supabase.from('app_settings').select('value_num').eq('key', 'default_labor_rate').maybeSingle()
    const val = (data as { value_num: number | null } | null)?.value_num
    setDefaultLaborRateValue(val != null ? String(val) : '')
  }

  async function saveDefaultLaborRate(e: React.FormEvent) {
    e.preventDefault()
    if (myRole !== 'dev') {
      setError('Only devs can change the default labor rate.')
      return
    }
    setDefaultLaborRateSaving(true)
    setError(null)
    const val = defaultLaborRateValue.trim() === '' ? null : parseFloat(defaultLaborRateValue) || null
    const { error: err } = await supabase.from('app_settings').upsert({ key: 'default_labor_rate', value_num: val }, { onConflict: 'key' })
    setDefaultLaborRateSaving(false)
    if (err) setError(err.message)
    else setDefaultLaborRateModalOpen(false)
  }

  useEffect(() => {
    if (activeTab === 'receivables' && authUser?.id) loadReceivables()
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if (activeTab === 'reports' && authUser?.id) {
      loadReports()
      loadReportTemplates()
    }
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if ((laborModalOpen || editingLaborJob) && !editingLaborJob && authUser?.id && laborRate === '') {
      supabase.from('app_settings').select('value_num').eq('key', 'default_labor_rate').maybeSingle().then(({ data }) => {
        const val = (data as { value_num: number | null } | null)?.value_num
        if (val != null) setLaborRate(String(val))
      })
    }
  }, [laborModalOpen, editingLaborJob, authUser?.id, laborRate])

  const laborJobHcps = useMemo(
    () => new Set(laborJobs.map((j) => (j.job_number ?? '').trim().toLowerCase()).filter(Boolean)),
    [laborJobs]
  )

  const filteredJobs = jobs.filter((j) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (j.hcp_number ?? '').toLowerCase().includes(q) ||
      (j.job_name ?? '').toLowerCase().includes(q) ||
      (j.job_address ?? '').toLowerCase().includes(q)
    )
  })

  const sortedBillingJobs = useMemo(() => {
    const arr = [...filteredJobs]
    arr.sort((a, b) => {
      const ha = (a.hcp_number ?? '').trim()
      const hb = (b.hcp_number ?? '').trim()
      const cmp = ha.localeCompare(hb, undefined, { numeric: true })
      return billingSortAsc ? cmp : -cmp
    })
    return arr
  }, [filteredJobs, billingSortAsc])

  const teamsSummaryData = useMemo(() => {
    const laborCostByName = new Map<string, number>()
    const billingByName = new Map<string, number>()

    for (const job of jobs) {
      const rev = job.revenue != null ? Number(job.revenue) : 0
      if (rev <= 0 || job.team_members.length === 0) continue
      const share = rev / job.team_members.length
      for (const tm of job.team_members) {
        const name = tm.users?.name ?? 'Unknown'
        billingByName.set(name, (billingByName.get(name) ?? 0) + share)
      }
    }

    for (const job of laborJobs) {
      const totalHrs = (job.items ?? []).reduce((s, i) => {
        const hrs = Number(i.hrs_per_unit) || 0
        return s + ((i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs)
      }, 0)
      const rate = job.labor_rate ?? 0
      const miles = Number(job.distance_miles) || 0
      const mileageCost = driveMileageCost ?? 0.70
      const timePerMile = driveTimePerMile ?? 0.02
      const driveCost = miles > 0 && rate > 0
        ? miles * mileageCost + miles * timePerMile * rate
        : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      const names = (job.assigned_to_name ?? '')
        .split(LABOR_ASSIGNED_DELIMITER)
        .map((n) => n.trim())
        .filter(Boolean)
      if (names.length === 0 || laborCost <= 0) continue
      const share = laborCost / names.length
      for (const name of names) {
        laborCostByName.set(name, (laborCostByName.get(name) ?? 0) + share)
      }
    }

    const allNames = new Set<string>()
    for (const [name] of billingByName) allNames.add(name)
    for (const [name] of laborCostByName) allNames.add(name)
    const rows = [...allNames].sort((a, b) => a.localeCompare(b)).map((name) => ({
      name,
      laborCost: laborCostByName.get(name) ?? 0,
      billing: billingByName.get(name) ?? 0,
    }))

    const billingHcps = new Set(
      jobs.filter((j) => j.revenue != null && Number(j.revenue) > 0).map((j) => (j.hcp_number ?? '').trim().toLowerCase())
    )
    const laborHcps = new Set(
      laborJobs
        .filter((job) => {
          const totalHrs = (job.items ?? []).reduce((s, i) => {
            const hrs = Number(i.hrs_per_unit) || 0
            return s + ((i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs)
          }, 0)
          return totalHrs > 0 && (job.labor_rate ?? 0) > 0
        })
        .map((j) => (j.job_number ?? '').trim().toLowerCase())
    )
    const matchedHcps = new Set([...billingHcps].filter((h) => h && laborHcps.has(h)))

    let matchedLaborTotal = 0
    let matchedBillingTotal = 0
    const mileageCost = driveMileageCost ?? 0.70
    const timePerMile = driveTimePerMile ?? 0.02
    for (const job of laborJobs) {
      const hcp = (job.job_number ?? '').trim().toLowerCase()
      if (!hcp || !matchedHcps.has(hcp)) continue
      const totalHrs = (job.items ?? []).reduce((s, i) => {
        const hrs = Number(i.hrs_per_unit) || 0
        return s + ((i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs)
      }, 0)
      const rate = job.labor_rate ?? 0
      const miles = Number(job.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0
        ? miles * mileageCost + miles * timePerMile * rate
        : miles > 0 ? miles * mileageCost : 0
      matchedLaborTotal += totalHrs * rate + driveCost
    }
    for (const job of jobs) {
      const hcp = (job.hcp_number ?? '').trim().toLowerCase()
      if (!hcp || !matchedHcps.has(hcp) || job.revenue == null) continue
      matchedBillingTotal += Number(job.revenue)
    }

    return { rows, matchedLaborTotal, matchedBillingTotal }
  }, [jobs, laborJobs, driveMileageCost, driveTimePerMile])

  const jobSummaryData = useMemo(() => {
    const partsCostByJobId = new Map<string, number>()
    for (const r of tallyParts) {
      const cost = Number(r.price_at_time ?? 0) * Number(r.quantity)
      partsCostByJobId.set(r.job_id, (partsCostByJobId.get(r.job_id) ?? 0) + cost)
    }
    const laborCostByHcp = new Map<string, number>()
    const mileageCost = driveMileageCost ?? 0.70
    const timePerMile = driveTimePerMile ?? 0.02
    for (const job of laborJobs) {
      const hcp = (job.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const totalHrs = (job.items ?? []).reduce((s, i) => {
        const hrs = Number(i.hrs_per_unit) || 0
        return s + ((i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs)
      }, 0)
      const rate = job.labor_rate ?? 0
      const miles = Number(job.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0
        ? miles * mileageCost + miles * timePerMile * rate
        : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      laborCostByHcp.set(hcp, (laborCostByHcp.get(hcp) ?? 0) + laborCost)
    }
    return jobs.map((job) => {
      const hcp = (job.hcp_number ?? '').trim().toLowerCase()
      const laborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const partsCost = partsCostByJobId.get(job.id) ?? 0
      const totalBill = job.revenue != null ? Number(job.revenue) : 0
      const profit = totalBill - partsCost - laborCost
      return {
        job,
        laborCost,
        partsCost,
        totalBill,
        profit,
      }
    })
  }, [jobs, laborJobs, tallyParts, driveMileageCost, driveTimePerMile])

  function openNew() {
    setEditing(null)
    setHcpNumber('')
    setJobName('')
    setJobAddress('')
    setGoogleDriveLink('')
    setJobPlansLink('')
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
    setGoogleDriveLink(job.google_drive_link ?? '')
    setJobPlansLink(job.job_plans_link ?? '')
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

  function fillLaborFromBillingJobAndSwitch(job: JobWithDetails) {
    setActiveTab('sub_sheet_ledger')
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'sub_sheet_ledger')
      return next
    })
    resetLaborForm()
    setLaborJobNumber(job.hcp_number ?? '')
    setLaborAddress(job.job_address ?? '')
    const rosterNames = [...rosterNamesSubcontractors(), ...rosterNamesEveryoneElse()]
    const teamNames = (job.team_members ?? [])
      .map((t) => t.users?.name?.trim())
      .filter((n): n is string => !!n && rosterNames.includes(n))
    setLaborAssignedTo(teamNames)
    setLaborModalOpen(true)
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
          .update({ hcp_number: hcpNumber.trim(), job_name: jobName.trim(), job_address: jobAddress.trim(), google_drive_link: googleDriveLink.trim() || null, job_plans_link: jobPlansLink.trim() || null, revenue: revNum })
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
            google_drive_link: googleDriveLink.trim() || null,
            job_plans_link: jobPlansLink.trim() || null,
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

  async function deleteJob(id: string): Promise<boolean> {
    setDeletingId(id)
    const { error: err } = await supabase.from('jobs_ledger').delete().eq('id', id)
    if (err) {
      setError(err.message)
      setDeletingId(null)
      return false
    }
    await loadJobs()
    setDeletingId(null)
    return true
  }

  async function updateJobTeamMembers(jobId: string, userIds: string[]) {
    setAssignedEditSavingId(jobId)
    try {
      const { data: existingTeam } = await supabase.from('jobs_ledger_team_members').select('user_id').eq('job_id', jobId)
      const existingTeamIds = new Set((existingTeam ?? []).map((t: { user_id: string }) => t.user_id))
      const toAdd = userIds.filter((id) => !existingTeamIds.has(id))
      const toRemove = [...existingTeamIds].filter((id) => !userIds.includes(id))
      for (const uid of toRemove) {
        const { error: delErr } = await supabase.from('jobs_ledger_team_members').delete().eq('job_id', jobId).eq('user_id', uid)
        if (delErr) throw delErr
      }
      for (const uid of toAdd) {
        const { error: insErr } = await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
        if (insErr) throw insErr
      }
      await loadJobs()
      setAssignedEditJobId(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update assigned')
    } finally {
      setAssignedEditSavingId(null)
    }
  }

  // Hide primary-restricted tabs until role is known to prevent flash of wrong tabs
  const isPrimaryOrUnknown = (authRole === 'primary' || myRole === 'primary') || (authRole === null && myRole === null)
  const showPrimaryRestrictedTabs = !isPrimaryOrUnknown

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
        {showPrimaryRestrictedTabs && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('receivables')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'receivables')
                return next
              })
            }}
            style={tabStyle(activeTab === 'receivables')}
          >
            AR
          </button>
        )}
        {showPrimaryRestrictedTabs && (
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
            Teams
          </button>
        )}
        <button
            type="button"
            onClick={() => {
              setActiveTab('reports')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'reports')
                return next
              })
            }}
            style={tabStyle(activeTab === 'reports')}
          >
            Reports
          </button>
        {showPrimaryRestrictedTabs && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('stages')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'stages')
                return next
              })
            }}
            style={tabStyle(activeTab === 'stages')}
          >
            Stages
          </button>
        )}
        {showPrimaryRestrictedTabs && (
          <>
          <span style={{ color: '#9ca3af', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
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
            SubLabor
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('parts')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'parts')
                return next
              })
            }}
            style={tabStyle(activeTab === 'parts')}
          >
            Parts
          </button>
          </>
        )}
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
        {showPrimaryRestrictedTabs && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('job-summary')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'job-summary')
                return next
              })
            }}
            style={tabStyle(activeTab === 'job-summary')}
          >
            Job Summary
          </button>
        )}
          </div>
        </div>
        <h1 style={{ margin: 0, marginLeft: '1rem', flexShrink: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Jobs</h1>
      </div>

      {activeTab === 'receivables' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600, textAlign: 'center' }}>
            AR: ${formatCurrency(receivables.reduce((sum, r) => sum + Number(r.amount || 0), 0))}
          </div>
          {receivablesLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Payer</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Point Of Contact</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Account Rep</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Amount</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>No receivables yet. Click Add Payer to add one.</td></tr>
                  ) : (
                    receivables.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{r.payer || '—'}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{r.point_of_contact || '—'}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{r.account_rep_name || '—'}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 500 }}>${formatCurrency(Number(r.amount || 0))}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                            <button type="button" onClick={() => openEditReceivable(r)} title="Edit" aria-label="Edit" style={{ padding: '0.25rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={16} height={16} fill="currentColor" aria-hidden="true">
                                <path d="M362.7 19.3L314.3 67.7 444.3 197.7 492.7 149.3c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18.3 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
                              </svg>
                            </button>
                            <button type="button" onClick={() => deleteReceivable(r.id)} disabled={receivablesDeletingId === r.id} title="Delete" aria-label="Delete" style={{ padding: '0.25rem', cursor: receivablesDeletingId === r.id ? 'not-allowed' : 'pointer', background: 'none', border: 'none', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
                                <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={openAddReceivable}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Add Payer
            </button>
          </div>

          {receivablesFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%' }}>
                <h3 style={{ margin: '0 0 1rem 0' }}>{editingReceivable ? 'Edit Receivable' : 'Add Payer'}</h3>
                <form onSubmit={saveReceivable}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Payer *</label>
                    <input type="text" value={receivablesPayer} onChange={(e) => setReceivablesPayer(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Point Of Contact</label>
                    <input type="text" value={receivablesPointOfContact} onChange={(e) => setReceivablesPointOfContact(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Account Rep</label>
                    <select value={receivablesAccountRepName} onChange={(e) => setReceivablesAccountRepName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                      <option value="">—</option>
                      {accountRepOptions().map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Amount to Collect *</label>
                    <input type="number" step="0.01" min={0} value={receivablesAmount} onChange={(e) => setReceivablesAmount(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closeReceivablesForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={receivablesSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: receivablesSaving ? 'not-allowed' : 'pointer' }}>{receivablesSaving ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <ErrorBoundary>
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setNewReportModalOpen(true)}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              New report
            </button>
            {canManageTemplates && (
              <button
                type="button"
                onClick={openReportTemplatesModal}
                title="Manage templates"
                style={{ padding: '0.35rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor">
                  <path d="M192 112L304 112L304 200C304 239.8 336.2 272 376 272L464 272L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 128C176 119.2 183.2 112 192 112zM352 131.9L444.1 224L376 224C362.7 224 352 213.3 352 200L352 131.9zM192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 250.5C512 233.5 505.3 217.2 493.3 205.2L370.7 82.7C358.7 70.7 342.5 64 325.5 64L192 64zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
                </svg>
              </button>
            )}
            <input
              type="text"
              placeholder={reportsViewMode === 'person' ? 'Search by job, HCP, or person' : 'Search by job name, HCP, or address'}
              value={reportsSearch}
              onChange={(e) => setReportsSearch(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 200 }}
            />
            <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => setReportsViewMode('job')}
                style={{ padding: '0.5rem 0.75rem', background: reportsViewMode === 'job' ? '#3b82f6' : '#f9fafb', color: reportsViewMode === 'job' ? 'white' : '#374151', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                By Job
              </button>
              <button
                type="button"
                onClick={() => setReportsViewMode('person')}
                style={{ padding: '0.5rem 0.75rem', background: reportsViewMode === 'person' ? '#3b82f6' : '#f9fafb', color: reportsViewMode === 'person' ? 'white' : '#374151', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                By Person
              </button>
            </div>
          </div>
          {reportTemplatesModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                {templateFormOpen ? (
                  <>
                    <h3 style={{ margin: '0 0 1rem 0' }}>{editingReportTemplateId ? 'Edit template' : 'Add template'}</h3>
                    <form onSubmit={saveTemplate}>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Template name *</label>
                        <input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} required placeholder="e.g. Walk Report" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                      </div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Field labels</label>
                        {newTemplateFields.map((val, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input type="text" value={val} onChange={(e) => setNewTemplateFields((prev) => { const n = [...prev]; n[i] = e.target.value; return n })} placeholder="e.g. What is the status?" style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                            <button type="button" onClick={() => setNewTemplateFields((prev) => prev.filter((_, j) => j !== i))} style={{ padding: '0.5rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Remove</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setNewTemplateFields((prev) => [...prev, ''])} style={{ marginTop: '0.25rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Add field</button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" onClick={closeTemplateForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                          {editingReportTemplateId && (
                            <button type="button" onClick={() => editingReportTemplateId && deleteReportTemplate(editingReportTemplateId)} disabled={!!templateDeletingId} style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: templateDeletingId ? 'not-allowed' : 'pointer' }}>{templateDeletingId ? '…' : 'Delete'}</button>
                          )}
                        </div>
                        <button type="submit" disabled={templateSaving || !newTemplateName.trim()} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: templateSaving ? 'not-allowed' : 'pointer' }}>{templateSaving ? 'Saving…' : 'Save'}</button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}>Report Templates</h3>
                      <button type="button" onClick={() => setReportTemplatesModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }} aria-label="Close">×</button>
                    </div>
                    <button type="button" onClick={openAddTemplate} style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add template</button>
                    {reportTemplatesLoading ? (
                      <p style={{ color: '#6b7280' }}>Loading templates…</p>
                    ) : reportTemplatesList.length === 0 ? (
                      <p style={{ color: '#6b7280' }}>No templates yet.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {reportTemplatesList.map((t) => (
                          <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                            <span>{t.name}</span>
                            <button type="button" onClick={() => openEditReportTemplate(t)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          {reportsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading reports…</p>
          ) : (
            (() => {
              const q = reportsSearch.trim().toLowerCase()
              const filtered = q
                ? reportsList.filter(
                    (r) =>
                      (r.job_display_name ?? '').toLowerCase().includes(q) ||
                      (r.job_hcp_number ?? '').toLowerCase().includes(q) ||
                      (r.created_by_name ?? '').toLowerCase().includes(q)
                  )
                : reportsList
              if (reportsViewMode === 'person') {
                const byPersonKey = new Map<string, ReportWithJob[]>()
                for (const r of filtered) {
                  const key = r.created_by_user_id
                  const arr = byPersonKey.get(key) ?? []
                  arr.push(r)
                  byPersonKey.set(key, arr)
                }
                const personGroups = Array.from(byPersonKey.entries())
                  .map(([key, reps]) => ({ key, reps: reps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }))
                  .filter(({ reps }) => reps.length > 0)
                  .sort((a, b) => new Date(b.reps[0]!.created_at).getTime() - new Date(a.reps[0]!.created_at).getTime())
                if (personGroups.length === 0) {
                  return <p style={{ color: '#6b7280' }}>No reports yet. Click New report to add one.</p>
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {personGroups.map(({ key, reps }) => {
                      const person = reps[0]!
                      const displayName = person.created_by_name || 'Unknown'
                      const isExpanded = reportsExpandedPersons.has(key)
                      return (
                        <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={() =>
                              setReportsExpandedPersons((prev) => {
                                const next = new Set(prev)
                                if (next.has(key)) next.delete(key)
                                else next.add(key)
                                return next
                              })
                            }
                            style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.875rem' }}
                          >
                            <span>{displayName}</span>
                            <span style={{ color: '#6b7280' }}>{reps.length} report{reps.length !== 1 ? 's' : ''}</span>
                            <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                          </button>
                          {isExpanded && (
                            <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                              {reps.map((r) => (
                                <div key={r.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <div>
                                      <span style={{ fontWeight: 600 }}>{r.template_name}</span>
                                      <span style={{ fontSize: '0.8125rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                                        {new Date(r.created_at).toLocaleString()} · {r.job_display_name || 'Unknown job'}
                                        {r.job_hcp_number ? ` (HCP: ${r.job_hcp_number})` : ''}
                                      </span>
                                    </div>
                                    {myRole === 'dev' && (
                                      <button
                                        type="button"
                                        onClick={() => deleteReport(r.id)}
                                        disabled={reportsDeletingId === r.id}
                                        title="Delete"
                                        aria-label="Delete"
                                        style={{ padding: '0.25rem', cursor: reportsDeletingId === r.id ? 'not-allowed' : 'pointer', background: 'none', border: 'none', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                      >
                                        {reportsDeletingId === r.id ? '…' : 'Delete'}
                                      </button>
                                    )}
                                  </div>
                                  {r.field_values && Object.keys(r.field_values).length > 0 && (
                                    <div style={{ fontSize: '0.875rem' }}>
                                      {Object.entries(r.field_values).map(([label, val]) =>
                                        val ? (
                                          <div key={label} style={{ marginBottom: '0.25rem' }}>
                                            <span style={{ color: '#6b7280' }}>{label}:</span> {String(val)}
                                          </div>
                                        ) : null
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              }
              const byJobKey = new Map<string, ReportWithJob[]>()
              for (const r of filtered) {
                const key = `${r.job_ledger_id ?? ''}-${r.project_id ?? ''}`
                const arr = byJobKey.get(key) ?? []
                arr.push(r)
                byJobKey.set(key, arr)
              }
              const jobGroups = Array.from(byJobKey.entries())
                .map(([key, reps]) => ({ key, reps: reps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }))
                .filter(({ reps }) => reps.length > 0)
                .sort((a, b) => new Date(b.reps[0]!.created_at).getTime() - new Date(a.reps[0]!.created_at).getTime())
              if (jobGroups.length === 0) {
                return <p style={{ color: '#6b7280' }}>No reports yet. Click New report to add one.</p>
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {jobGroups.map(({ key, reps }) => {
                    const job = reps[0]!
                    const displayName = job.job_display_name || 'Unknown job'
                    const hcp = job.job_hcp_number ? ` (HCP: ${job.job_hcp_number})` : ''
                    const isExpanded = reportsExpandedJobs.has(key)
                    return (
                      <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setReportsExpandedJobs((prev) => {
                              const next = new Set(prev)
                              if (next.has(key)) next.delete(key)
                              else next.add(key)
                              return next
                            })
                          }
                          style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.875rem' }}
                        >
                          <span>{displayName}{hcp}</span>
                          <span style={{ color: '#6b7280' }}>{reps.length} report{reps.length !== 1 ? 's' : ''}</span>
                          <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                        </button>
                        {isExpanded && (
                          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                            {reps.map((r) => (
                              <div key={r.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                  <div>
                                    <span style={{ fontWeight: 600 }}>{r.template_name}</span>
                                    <span style={{ fontSize: '0.8125rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                                      {new Date(r.created_at).toLocaleString()} · {r.created_by_name}
                                    </span>
                                  </div>
                                  {myRole === 'dev' && (
                                    <button
                                      type="button"
                                      onClick={() => deleteReport(r.id)}
                                      disabled={reportsDeletingId === r.id}
                                      title="Delete"
                                      aria-label="Delete"
                                      style={{ padding: '0.25rem', cursor: reportsDeletingId === r.id ? 'not-allowed' : 'pointer', background: 'none', border: 'none', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    >
                                      {reportsDeletingId === r.id ? '…' : 'Delete'}
                                    </button>
                                  )}
                                </div>
                                {r.field_values && Object.keys(r.field_values).length > 0 && (
                                  <div style={{ fontSize: '0.875rem' }}>
                                    {Object.entries(r.field_values).map(([label, val]) =>
                                      val ? (
                                        <div key={label} style={{ marginBottom: '0.25rem' }}>
                                          <span style={{ color: '#6b7280' }}>{label}:</span> {String(val)}
                                        </div>
                                      ) : null
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()
          )}
        </div>
        </ErrorBoundary>
      )}

      {activeTab === 'stages' && (
        <div>
          {/* #region agent log */}
          {(() => {
            const showIcon = (authRole || myRole) === 'dev'
            fetch('http://127.0.0.1:7507/ingest/676b7b9a-6887-4048-ac57-4002ec253a57',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0419eb'},body:JSON.stringify({sessionId:'0419eb',location:'Jobs.tsx:stages-render',message:'Stages tab render',data:{myRole,myRoleType:typeof myRole,authRole,activeTab,showIcon,myRoleEqualsDev:myRole==='dev'},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{})
            return null
          })()}
          {/* #endregion */}
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
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
              type="text"
              placeholder="Search by HCP, job name, or address"
              value={stagesSearchQuery}
              onChange={(e) => setStagesSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
            />
            {(['dev', 'assistant'] as const).includes((authRole || myRole) as 'dev' | 'assistant') && (
              <button
                type="button"
                onClick={toggleStagesHamMode}
                title={stagesHamMode ? 'Ham mode on: confirmation modals skipped' : 'Ham mode off: show confirmation modals'}
                aria-pressed={stagesHamMode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  padding: 0,
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: stagesHamMode ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  color: stagesHamMode ? '#2563eb' : '#6b7280',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor" aria-hidden>
                  <path d="M224 329.2C224 337.7 220.6 345.8 214.6 351.8L187.8 378.6C175.5 390.9 155.3 390 138.4 385.8C133.8 384.7 128.9 384 123.9 384C90.8 384 63.9 410.9 63.9 444C63.9 477.1 90.8 504 123.9 504C130.2 504 135.9 509.7 135.9 516C135.9 549.1 162.8 576 195.9 576C229 576 255.9 549.1 255.9 516C255.9 511 255.3 506.2 254.1 501.5C249.9 484.6 248.9 464.4 261.3 452.1L288.1 425.3C294.1 419.3 302.2 415.9 310.7 415.9L399.9 415.9C406.2 415.9 412.3 415.6 418.4 414.9C430.3 413.7 434.8 399.4 429.2 388.9C420.7 373.1 415.9 355.1 415.9 335.9C415.9 274 466 223.9 527.9 223.9C535.9 223.9 543.6 224.7 551.1 226.3C562.8 228.8 575.2 220.4 573.1 208.7C558.4 126.4 486.4 63.9 399.9 63.9C302.7 63.9 223.9 142.7 223.9 239.9L223.9 329.1z" />
                </svg>
              </button>
            )}
          </div>
          {(() => {
            const q = stagesSearchQuery.trim().toLowerCase()
            const filtered = q
              ? jobs.filter(
                  (j) =>
                    (j.hcp_number ?? '').toLowerCase().includes(q) ||
                    (j.job_name ?? '').toLowerCase().includes(q) ||
                    (j.job_address ?? '').toLowerCase().includes(q)
                )
              : jobs
            const status = (j: JobWithDetails) => (j.status ?? 'working') as string
            const working = filtered.filter((j) => status(j) === 'working')
            const readyToBill = filtered.filter((j) => status(j) === 'ready_to_bill')
            const billed = filtered.filter((j) => status(j) === 'billed')
            const paid = filtered.filter((j) => status(j) === 'paid')

            function toggleStages(key: keyof typeof stagesSectionOpen) {
              setStagesSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
            }

            function renderStagesTable(jobList: JobWithDetails[], actionLabel: React.ReactNode | null, onAction: (j: JobWithDetails) => void, showTimeOpen?: boolean, onSendBack?: (j: JobWithDetails) => void, onSendBackSimple?: (j: JobWithDetails) => void) {
              return (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
                  <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assigned</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Revenue</th>
                        {(actionLabel || onSendBack || onSendBackSimple) && <th style={{ padding: '0.75rem', width: 140, borderBottom: '1px solid #e5e7eb' }} />}
                        <th style={{ padding: '0.75rem', width: 120, borderBottom: '1px solid #e5e7eb' }}>View<br />Reports</th>
                        <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid #e5e7eb' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {jobList.length === 0 ? (
                        <tr>
                          <td colSpan={(actionLabel || onSendBack || onSendBackSimple) ? 7 : 6} style={{ padding: '0.75rem', color: '#6b7280' }}>
                            No jobs in this group
                          </td>
                        </tr>
                      ) : (
                        jobList.map((j) => (
                          <tr key={j.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.75rem' }}>{j.hcp_number || '—'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div>{j.job_name || '—'}</div>
                              {(j.job_address ?? '').trim() && (
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{j.job_address}</div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', position: 'relative' }}>
                              {stagesHamMode ? (
                                <div ref={assignedEditJobId === j.id ? assignedEditDropdownRef : undefined} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                  <span>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (assignedEditJobId === j.id) {
                                        setAssignedEditJobId(null)
                                      } else {
                                        setAssignedEditJobId(j.id)
                                        setAssignedEditSelectedIds((j.team_members ?? []).map((t) => t.user_id))
                                      }
                                    }}
                                    disabled={assignedEditSavingId === j.id}
                                    title="Change assigned"
                                    aria-label="Change assigned"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: 24,
                                      height: 24,
                                      padding: 0,
                                      border: 'none',
                                      borderRadius: 4,
                                      background: 'none',
                                      cursor: assignedEditSavingId === j.id ? 'not-allowed' : 'pointer',
                                      color: '#6b7280',
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                                      <path d="M100.4 417.2C104.5 402.6 112.2 389.3 123 378.5L304.2 197.3L338.1 163.4C354.7 180 389.4 214.7 442.1 267.4L476 301.3L442.1 335.2L260.9 516.4C250.2 527.1 236.8 534.9 222.2 539L94.4 574.6C86.1 576.9 77.1 574.6 71 568.4C64.9 562.2 62.6 553.3 64.9 545L100.4 417.2zM156 413.5C151.6 418.2 148.4 423.9 146.7 430.1L122.6 517L209.5 492.9C215.9 491.1 221.7 487.8 226.5 483.2L155.9 413.5zM510 267.4C493.4 250.8 458.7 216.1 406 163.4L372 129.5C398.5 103 413.4 88.1 416.9 84.6C430.4 71 448.8 63.4 468 63.4C487.2 63.4 505.6 71 519.1 84.6L554.8 120.3C568.4 133.9 576 152.3 576 171.4C576 190.5 568.4 209 554.8 222.5C551.3 226 536.4 240.9 509.9 267.4z" />
                                    </svg>
                                  </button>
                                  {assignedEditJobId === j.id && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: 4,
                                        zIndex: 50,
                                        background: 'white',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        padding: '0.5rem',
                                        minWidth: 180,
                                        maxHeight: 200,
                                        overflowY: 'auto',
                                      }}
                                    >
                                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Assigned</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {users.map((u) => (
                                          <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                            <input
                                              type="checkbox"
                                              checked={assignedEditSelectedIds.includes(u.id)}
                                              onChange={() => {
                                                setAssignedEditSelectedIds((prev) =>
                                                  prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                                                )
                                              }}
                                              style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                                            />
                                            <span>{u.name}</span>
                                          </label>
                                        ))}
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <button
                                          type="button"
                                          onClick={() => updateJobTeamMembers(j.id, assignedEditSelectedIds)}
                                          disabled={assignedEditSavingId === j.id}
                                          style={{
                                            padding: '0.35rem 0.75rem',
                                            fontSize: '0.8125rem',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: assignedEditSavingId === j.id ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          {assignedEditSavingId === j.id ? '…' : 'Apply'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setAssignedEditJobId(null)}
                                          style={{
                                            padding: '0.35rem 0.75rem',
                                            fontSize: '0.8125rem',
                                            background: 'none',
                                            color: '#6b7280',
                                            border: '1px solid #d1d5db',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                (j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              {j.revenue != null ? formatCurrency(Number(j.revenue)) : '—'}
                            </td>
                            {(actionLabel || onSendBack || onSendBackSimple) && (
                              <td style={{ padding: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  {showTimeOpen && (
                                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }} title="Time since job created">
                                      Open {formatTimeSince(j.created_at ?? null)}
                                    </span>
                                  )}
                                  {onSendBack && (
                                    <button
                                      type="button"
                                      onClick={() => onSendBack(j)}
                                      disabled={stagesStatusUpdatingId === j.id}
                                      style={{
                                        padding: '0.35rem 0.75rem',
                                        fontSize: '0.8125rem',
                                        background: 'none',
                                        color: '#6b7280',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      Send back
                                    </button>
                                  )}
                                  {onSendBackSimple && (
                                    <button
                                      type="button"
                                      onClick={() => onSendBackSimple(j)}
                                      disabled={stagesStatusUpdatingId === j.id}
                                      style={{
                                        padding: '0.35rem 0.75rem',
                                        fontSize: '0.8125rem',
                                        background: 'none',
                                        color: '#6b7280',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      Send back
                                    </button>
                                  )}
                                  {actionLabel && (
                                    <button
                                      type="button"
                                      onClick={() => onAction(j)}
                                      disabled={stagesStatusUpdatingId === j.id}
                                      style={{
                                        padding: '0.35rem 0.75rem',
                                        fontSize: '0.8125rem',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      {stagesStatusUpdatingId === j.id ? '…' : actionLabel}
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                                <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                                  {(j.report_count ?? 0)} report{(j.report_count ?? 0) !== 1 ? 's' : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  View<br />Reports
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                              <button
                                type="button"
                                onClick={() => openEdit(j)}
                                title="Edit"
                                aria-label="Edit"
                                style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                  <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            }

            return (
              <>
                <button
                  type="button"
                  onClick={() => toggleStages('working')}
                  aria-expanded={stagesSectionOpen.working}
                  style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <span aria-hidden>{stagesSectionOpen.working ? '\u25BC' : '\u25B6'}</span>
                  Working ({working.length})
                </button>
                {stagesSectionOpen.working && renderStagesTable(working, 'Ready for Billing', stagesHamMode
                  ? (j) => updateJobStatus(j.id, 'ready_to_bill')
                  : (j) => {
                    setReadyForBillingJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—' })
                    setReadyForBillingChecked1(false)
                    setReadyForBillingChecked2(false)
                  }, true)}

                <button
                  type="button"
                  onClick={() => toggleStages('readyToBill')}
                  aria-expanded={stagesSectionOpen.readyToBill}
                  style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <span aria-hidden>{stagesSectionOpen.readyToBill ? '\u25BC' : '\u25B6'}</span>
                  Ready to Bill ({readyToBill.length})
                </button>
                {stagesSectionOpen.readyToBill && renderStagesTable(readyToBill, 'Mark as Billed', stagesHamMode
                  ? (j) => updateJobStatus(j.id, 'billed')
                  : (j) => setConfirmJobStatusJob({ id: j.id, toStatus: 'billed', message: 'This will mark the job as Billed.' }), true, stagesHamMode
                  ? (j) => updateJobStatus(j.id, 'working')
                  : (j) => {
                    setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'working' })
                    setSendBackChecked(false)
                  })}

                <button
                  type="button"
                  onClick={() => toggleStages('billed')}
                  aria-expanded={stagesSectionOpen.billed}
                  style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <span aria-hidden>{stagesSectionOpen.billed ? '\u25BC' : '\u25B6'}</span>
                  Billed ({billed.length})
                </button>
                {stagesSectionOpen.billed && renderStagesTable(billed, <>Mark<br />Paid</>, stagesHamMode
                  ? (j) => updateJobStatus(j.id, 'paid')
                  : (j) => setConfirmJobStatusJob({ id: j.id, toStatus: 'paid', message: 'This will mark the job as Paid.' }), true, undefined, stagesHamMode
                  ? (j) => updateJobStatus(j.id, 'ready_to_bill')
                  : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'ready_to_bill' }))}

                <button
                  type="button"
                  onClick={() => toggleStages('paid')}
                  aria-expanded={stagesSectionOpen.paid}
                  style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <span aria-hidden>{stagesSectionOpen.paid ? '\u25BC' : '\u25B6'}</span>
                  Paid ({paid.length})
                </button>
                {stagesSectionOpen.paid && renderStagesTable(paid, null, () => {}, true, undefined, stagesHamMode
                  ? (j) => updateJobStatus(j.id, 'billed')
                  : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'billed' }))}
              </>
            )
          })()}
        </div>
      )}

      {activeTab === 'sub_sheet_ledger' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={openNewLaborJob}
              style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              New Job Labor
            </button>
            <button
              type="button"
              onClick={() => { loadDriveSettings(); setDriveSettingsOpen(true); }}
              style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Drive Settings
            </button>
            {myRole === 'dev' && (
              <button
                type="button"
                onClick={() => { loadDefaultLaborRate(); setDefaultLaborRateModalOpen(true); }}
                style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Default Labor Rate
              </button>
            )}
          </div>
          {laborJobsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading sub sheet ledger…</p>
          ) : laborJobs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No jobs yet. Click New Job Labor to add one.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contractor</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Distance</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Labor rate</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total hrs</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Drive</th>
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
                    const miles = Number(job.distance_miles) || 0
                    const mileageCost = driveMileageCost ?? 0.70
                    const timePerMile = driveTimePerMile ?? 0.02
                    const driveCost = miles > 0 && rate > 0
                      ? miles * mileageCost + miles * timePerMile * rate
                      : miles > 0 ? miles * mileageCost : 0
                    const totalCost = totalHrs * rate + driveCost
                    const dateInputValue = job.job_date ?? (job.created_at ? job.created_at.slice(0, 10) : '')
                    return (
                      <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{job.assigned_to_name}</td>
                        <td style={{ padding: '0.75rem' }}>{job.job_number ?? '—'}</td>
                        <td style={{ padding: '0.75rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {job.address ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#2563eb', textDecoration: 'none' }}
                              title={job.address}
                            >
                              {job.address}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {editingLaborJobDistanceId === job.id ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={editingLaborJobDistanceValue}
                                onChange={(e) => setEditingLaborJobDistanceValue(e.target.value)}
                                onBlur={() => {
                                  const v = editingLaborJobDistanceValue.trim()
                                  updateLaborJobDistance(job.id, v)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const v = editingLaborJobDistanceValue.trim()
                                    updateLaborJobDistance(job.id, v)
                                  }
                                  if (e.key === 'Escape') setEditingLaborJobDistanceId(null)
                                }}
                                autoFocus
                                style={{ width: 56, padding: '0.2rem 0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>mi</span>
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {job.distance_miles != null && !Number.isNaN(Number(job.distance_miles)) ? `${Number(job.distance_miles)} mi` : '—'}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLaborJobDistanceId(job.id)
                                  setEditingLaborJobDistanceValue(job.distance_miles != null ? String(job.distance_miles) : '')
                                }}
                                title="Edit distance"
                                style={{ padding: '0.15rem 0.35rem', background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}
                              >
                                Edit
                              </button>
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{job.labor_rate != null ? `$${formatCurrency(job.labor_rate)}/hr` : '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalHrs.toFixed(2)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{driveCost > 0 ? `$${formatCurrency(driveCost)}` : '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{rate > 0 || driveCost > 0 ? `$${formatCurrency(totalCost)}` : '—'}</td>
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
            <button
              type="button"
              onClick={() => {
                setBillingSortAsc((prev) => {
                  const next = !prev
                  if (authUser?.id && typeof window !== 'undefined') {
                    try {
                      localStorage.setItem(`jobs_billing_sort_asc_${authUser.id}`, String(next))
                    } catch {
                      /* ignore */
                    }
                  }
                  return next
                })
              }}
              title={billingSortAsc ? 'Lowest HCP first (click to reverse)' : 'Highest HCP first (click to reverse)'}
              aria-label={billingSortAsc ? 'Sort ascending' : 'Sort descending'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                padding: 0,
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: 'white',
                cursor: 'pointer',
                color: '#6b7280',
              }}
            >
              {billingSortAsc ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden>
                  <path d="M7 14l5-5 5 5H7z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden>
                  <path d="M7 10l5 5 5-5H7z" />
                </svg>
              )}
            </button>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            Assistants see jobs from their master and from other assistants adopted by the same master. If you don&apos;t see a colleague&apos;s jobs, the master must adopt both of you in Settings → Adopt Assistants.
          </p>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : sortedBillingJobs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No HCP jobs yet. Click New Job to add one.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Specific Work</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Billed Materials</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contractors</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Bill</th>
                    <th style={{ padding: '0.75rem', width: 100, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedBillingJobs.map((job) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {job.hcp_number || '—'}
                        {job.hcp_number && authRole !== 'primary' && !laborJobHcps.has((job.hcp_number ?? '').trim().toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => fillLaborFromBillingJobAndSwitch(job)}
                            title="Add Labor: fill from Billing and open Labor"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="#b91c1c" aria-hidden="true">
                              <path d="M192 112L304 112L304 200C304 239.8 336.2 272 376 272L464 272L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 128C176 119.2 183.2 112 192 112zM352 131.9L444.1 224L376 224C362.7 224 352 213.3 352 200L352 131.9zM192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 250.5C512 233.5 505.3 217.2 493.3 205.2L370.7 82.7C358.7 70.7 342.5 64 325.5 64L192 64zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
                            </svg>
                          </button>
                        )}
                      </td>
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
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          {(job.google_drive_link?.trim() || job.job_plans_link?.trim()) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
                              {job.google_drive_link?.trim() && (
                                <a
                                  href={job.google_drive_link.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => { e.preventDefault(); openInExternalBrowser(job.google_drive_link!.trim()) }}
                                  title="Google Drive"
                                  style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.25rem' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                    <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                                  </svg>
                                </a>
                              )}
                              {job.job_plans_link?.trim() && (
                                <a
                                  href={job.job_plans_link.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => { e.preventDefault(); openInExternalBrowser(job.job_plans_link!.trim()) }}
                                  title="Job Plans"
                                  style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.25rem' }}
                                >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                              </svg>
                            </a>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(job)}
                            title="Edit"
                            aria-label="Edit"
                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                              <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                            </svg>
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

      {activeTab === 'teams-summary' && (
        <div>
          {teamsSummaryData.rows.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No jobs yet. Add billing jobs and labor jobs to see the summary.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>User</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Labor Cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {teamsSummaryData.rows.map((row) => (
                    <tr key={row.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem' }}>{row.name}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(row.laborCost)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(row.billing)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600, background: '#f9fafb' }}>
                    <td style={{ padding: '0.75rem' }}>Total (matched jobs only)</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(teamsSummaryData.matchedLaborTotal)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(teamsSummaryData.matchedBillingTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'parts' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Search HCP, job name, fixture, part name…"
              value={tallyPartsSearch}
              onChange={(e) => setTallyPartsSearch(e.target.value)}
              style={{ flex: '1 1 200px', minWidth: 200, maxWidth: 400, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
            />
            {authRole !== 'subcontractor' && myRole !== 'subcontractor' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400, fontSize: '0.875rem', cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={showMyJobsOnly}
                  onChange={(e) => setShowMyJobsOnly(e.target.checked)}
                />
                Show my jobs only
              </label>
            )}
          </div>
          {tallyPartsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', width: 32, borderBottom: '1px solid #e5e7eb' }}></th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Parts Total</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Parts</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let filtered = tallyParts
                    if (showMyJobsOnly && myJobIds) {
                      filtered = filtered.filter((r) => myJobIds.has(r.job_id))
                    }
                    const q = tallyPartsSearch.trim().toLowerCase()
                    if (q) {
                      filtered = filtered.filter((r) => {
                        const hcp = (r.hcp_number ?? '').toLowerCase()
                        const job = (r.job_name ?? '').toLowerCase()
                        const fixture = (r.fixture_name ?? '').toLowerCase()
                        const part = (r.part_name ?? '').toLowerCase()
                        const mfr = (r.part_manufacturer ?? '').toLowerCase()
                        return hcp.includes(q) || job.includes(q) || fixture.includes(q) || part.includes(q) || mfr.includes(q)
                      })
                    }
                    const byJob = new Map<string, TallyPartRow[]>()
                    for (const r of filtered) {
                      const list = byJob.get(r.job_id) ?? []
                      list.push(r)
                      byJob.set(r.job_id, list)
                    }
                    const jobRows = Array.from(byJob.entries()).map(([jobId, parts]) => {
                      const first = parts[0]
                      if (!first) return null
                      return { jobId, hcpNumber: first.hcp_number, jobName: first.job_name, parts }
                    }).filter((r): r is NonNullable<typeof r> => r != null)
                    if (jobRows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>
                            No tally parts yet. Subs can record parts via the Job Parts Tally flow on the Dashboard.
                          </td>
                        </tr>
                      )
                    }
                    return jobRows.flatMap(({ jobId, hcpNumber, jobName, parts }) => {
                      const expanded = expandedPartsJobIds.has(jobId)
                      const partsTotal = parts.reduce((sum, r) => {
                        if (r.part_id == null) {
                          return sum + (Number(r.fixture_cost ?? 0) * Number(r.quantity))
                        }
                        return sum + (Number(r.price_at_time ?? 0) * Number(r.quantity))
                      }, 0)
                      const hasUnpricedFixture = parts.some(
                        (r) => r.part_id == null && (r.fixture_cost == null || Number(r.fixture_cost) === 0)
                      )
                      const toggle = () => {
                        setExpandedPartsJobIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(jobId)) next.delete(jobId)
                          else next.add(jobId)
                          return next
                        })
                      }
                      return [
                        <tr
                          key={jobId}
                          data-job-id={jobId}
                          style={{
                            borderBottom: '1px solid #f3f4f6',
                            cursor: 'pointer',
                            background: hasUnpricedFixture ? '#fef2f2' : expanded ? '#f9fafb' : undefined,
                          }}
                          onClick={toggle}
                        >
                          <td style={{ padding: '0.75rem', width: 32 }}>
                            {expanded ? '▼' : '▶'}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{hcpNumber ?? '—'}</td>
                          <td style={{ padding: '0.75rem' }}>{jobName ?? '—'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(partsTotal)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>{parts.length}</td>
                        </tr>,
                        ...(expanded
                          ? [
                              <tr key={`${jobId}-parts`}>
                                <td colSpan={5} style={{ padding: 0, borderBottom: '1px solid #e5e7eb', background: '#fff', verticalAlign: 'top' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                      <tr style={{ background: '#f3f4f6' }}>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Fixture</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Part</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Qty</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Price</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Purchase Order</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Entered by</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '0.5rem 0.75rem', width: 1 }}></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {parts.map((r) => (
                                        <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }} onClick={(e) => e.stopPropagation()}>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>{r.fixture_name || '—'}</td>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>
                                            {r.part_id == null ? (
                                              <span style={{ color: '#15803d', fontWeight: 500 }}>Fixture (sent for pricing)</span>
                                            ) : (
                                              <>
                                                {r.part_name ?? '—'}
                                                {r.part_manufacturer ? ` (${r.part_manufacturer})` : ''}
                                              </>
                                            )}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{Number(r.quantity)}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                            {r.part_id == null ? (
                                              <input
                                                key={`${r.id}-${r.fixture_cost ?? ''}`}
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                defaultValue={r.fixture_cost ?? ''}
                                                onBlur={(e) => {
                                                  const v = parseFloat((e.target as HTMLInputElement).value)
                                                  if (!Number.isNaN(v) && v >= 0) {
                                                    updateFixtureCost(r.id, v)
                                                  }
                                                }}
                                                disabled={updatingFixtureCostId === r.id}
                                                placeholder="Enter cost"
                                                style={{
                                                  width: 80,
                                                  padding: '0.25rem 0.5rem',
                                                  fontSize: '0.8125rem',
                                                  border: '1px solid #d1d5db',
                                                  borderRadius: 4,
                                                }}
                                              />
                                            ) : r.purchase_order_id && r.price_at_time != null ? (
                                              <button
                                                type="button"
                                                onClick={() => navigate(`/materials?tab=purchase-orders&po=${r.purchase_order_id}`)}
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
                                                {formatCurrency(Number(r.price_at_time))}
                                              </button>
                                            ) : (
                                              '—'
                                            )}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>
                                            {r.purchase_order_name
                                              ? `${r.purchase_order_name}${r.purchase_order_status ? ` [${r.purchase_order_status === 'finalized' ? 'Finalized' : 'Draft'}]` : ''}`
                                              : '—'}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>{r.created_by_name ?? '—'}</td>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <button
                                              type="button"
                                              onClick={() => deleteTallyPart(r.id)}
                                              disabled={deletingTallyPartId === r.id}
                                              style={{
                                                padding: '0.25rem 0.5rem',
                                                fontSize: '0.75rem',
                                                background: '#fee2e2',
                                                color: '#991b1b',
                                                border: 'none',
                                                borderRadius: 4,
                                                cursor: deletingTallyPartId === r.id ? 'not-allowed' : 'pointer',
                                              }}
                                            >
                                              {deletingTallyPartId === r.id ? '…' : 'Delete'}
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>,
                            ]
                          : []),
                      ]
                    })
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'job-summary' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {(loading || tallyPartsLoading || laborJobsLoading) ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : jobSummaryData.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No billing jobs yet. Add jobs in Billing to see the summary.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP #</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Labor Cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Parts Cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Bill</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {jobSummaryData.map(({ job, laborCost, partsCost, totalBill, profit }) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>{job.hcp_number ?? '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{job.job_name ?? '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{job.job_address ?? '—'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{laborCost === 0 ? '—' : `$${formatCurrency(laborCost)}`}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{partsCost === 0 ? '—' : `$${formatCurrency(partsCost)}`}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalBill === 0 ? '—' : `$${formatCurrency(totalBill)}`}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500, color: profit >= 0 ? undefined : '#b91c1c' }}>
                        ${formatCurrency(profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(laborModalOpen || editingLaborJob) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>{editingLaborJob ? 'Edit Job Labor' : 'New Job Labor'}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (editingLaborJob) saveEditedLaborJob(e)
                else saveLaborJob()
              }}
            >
              {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', whiteSpace: 'pre-line' }}>{error}</p>}
              <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: 0, marginBottom: '0.5rem' }}>Required: Address, Distance (mi), at least one contractor (Subcontractors or Everyone else), and at least one fixture with a name and count &gt; 0 (or hrs/unit for fixed items).</p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 120px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                    <label style={{ fontWeight: 500, margin: 0 }}>HCP</label>
                    {!editingLaborJob && (
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
                    )}
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
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Address <span style={{ color: '#b91c1c' }}>*</span></label>
                  <input
                    type="text"
                    value={laborAddress}
                    onChange={(e) => setLaborAddress(e.target.value)}
                    placeholder="Job address"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ flex: '0 0 110px', minWidth: 110 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, whiteSpace: 'nowrap' }}>Distance (mi) <span style={{ color: '#b91c1c' }}>*</span></label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    step={0.1}
                    value={laborDistance}
                    onChange={(e) => setLaborDistance(e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Subcontractors <span style={{ color: '#b91c1c' }}>*</span></div>
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
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date of Labor</label>
                  <input
                    type="date"
                    value={laborDate}
                    onChange={(e) => setLaborDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
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
              </div>
              {serviceTypes.length > 1 && (
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Service type</label>
                  <select
                    value={selectedServiceTypeId}
                    onChange={(e) => setSelectedServiceTypeId(e.target.value)}
                    style={{ width: '100%', maxWidth: 200, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Specific Work (Line Items) <span style={{ color: '#b91c1c' }}>*</span></th>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <select
                      value={selectedLaborBookVersionId ?? ''}
                      onChange={(e) => setSelectedLaborBookVersionId(e.target.value || null)}
                      style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', minWidth: '10rem' }}
                    >
                      <option value="">— Labor book version —</option>
                      {laborBookVersions.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={applyLaborBookHoursToPeople}
                      disabled={applyingLaborBookHours || !selectedLaborBookVersionId || !laborFixtureRows.some((r) => (r.fixture ?? '').trim())}
                      style={{
                        padding: '0.35rem 0.75rem',
                        background: applyingLaborBookHours || !selectedLaborBookVersionId || !laborFixtureRows.some((r) => (r.fixture ?? '').trim()) ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: applyingLaborBookHours || !selectedLaborBookVersionId || !laborFixtureRows.some((r) => (r.fixture ?? '').trim()) ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      {applyingLaborBookHours ? 'Applying…' : 'Apply matching Labor Hours'}
                    </button>
                    {laborBookApplyMessage && (
                      <span style={{ color: '#059669', fontSize: '0.875rem' }}>{laborBookApplyMessage}</span>
                    )}
                  </div>
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={laborSaving || laborAssignedTo.length === 0 || !laborAddress.trim() || (laborDistance.trim() === '' || isNaN(parseFloat(laborDistance)) || parseFloat(laborDistance) < 0) || laborFixtureRows.every((r) => {
                    const hasFixture = (r.fixture ?? '').trim()
                    const isFixed = r.is_fixed ?? false
                    return !hasFixture || (!isFixed && Number(r.count) <= 0)
                  })}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: laborSaving ? 'not-allowed' : 'pointer' }}
                >
                  {laborSaving ? 'Saving…' : (editingLaborJob ? 'Save' : 'Save Job')}
                </button>
                <button
                  type="button"
                  onClick={() => editingLaborJob ? printJobSubSheet(editingLaborJob) : printLaborSubSheet()}
                  style={{ padding: '0.5rem 1rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Print
                </button>
                <button type="button" onClick={closeLaborModal} disabled={laborSaving} style={{ padding: '0.5rem 1rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {defaultLaborRateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Default Labor Rate</h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              This rate is pre-filled when adding a new job. Leave empty for no default.
            </p>
            <form onSubmit={saveDefaultLaborRate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Labor rate ($/hr)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={defaultLaborRateValue}
                  onChange={(e) => setDefaultLaborRateValue(e.target.value)}
                  placeholder="e.g. 75.00"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" disabled={defaultLaborRateSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: defaultLaborRateSaving ? 'not-allowed' : 'pointer' }}>
                  {defaultLaborRateSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setDefaultLaborRateModalOpen(false)} disabled={defaultLaborRateSaving} style={{ padding: '0.5rem 1rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {driveSettingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Drive Settings</h2>
            <form onSubmit={saveDriveSettings}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Mileage cost ($/mi)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={driveMileageCost ?? ''}
                    onChange={(e) => setDriveMileageCost(e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                    placeholder="0.70"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Time per mile (hrs/mi)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={driveTimePerMile ?? ''}
                    onChange={(e) => setDriveTimePerMile(e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                    placeholder="0.02"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem' }}>
                Drive cost = (miles × mileage cost) + (miles × time per mile × labor rate). Defaults: $0.70/mi, 0.02 hrs/mi (~1.2 min/mi).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" disabled={driveSettingsSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: driveSettingsSaving ? 'not-allowed' : 'pointer' }}>
                  {driveSettingsSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setDriveSettingsOpen(false)} disabled={driveSettingsSaving} style={{ padding: '0.5rem 1rem' }}>
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
            <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '0 0 1rem 0' }}>Required: Job Name, Job Address</p>
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
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Name <span style={{ color: '#b91c1c' }}>*</span></label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    ref={jobNameInputRef}
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="Job name"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      jobNameInputRef.current?.focus()
                      if (!document.execCommand('paste')) {
                        try {
                          const text = await navigator.clipboard.readText()
                          setJobName(text)
                        } catch {
                          /* clipboard not available */
                        }
                      }
                    }}
                    style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                  >
                    Paste from Clipboard
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Address <span style={{ color: '#b91c1c' }}>*</span></label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    ref={jobAddressInputRef}
                    type="text"
                    value={jobAddress}
                    onChange={(e) => setJobAddress(e.target.value)}
                    placeholder="Address"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      jobAddressInputRef.current?.focus()
                      if (!document.execCommand('paste')) {
                        try {
                          const text = await navigator.clipboard.readText()
                          setJobAddress(text)
                        } catch {
                          /* clipboard not available */
                        }
                      }
                    }}
                    style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                  >
                    Paste from Clipboard
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Google Drive</label>
                <input
                  type="url"
                  value={googleDriveLink}
                  onChange={(e) => setGoogleDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
                <a
                  href="https://drive.google.com/drive/folders/1nKEuhuXRmRaA3lrullCAoHq6JvYuc-BW?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/1nKEuhuXRmRaA3lrullCAoHq6JvYuc-BW?usp=sharing') }}
                  style={{ fontSize: '0.8125rem', color: '#2563eb', marginTop: 4, display: 'inline-block' }}
                >
                  job folders
                </a>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Plans</label>
                <input
                  type="url"
                  value={jobPlansLink}
                  onChange={(e) => setJobPlansLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Billed Materials (Line Items)</th>
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
                  Add Billed Material
                </button>
              </div>
              <div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Specific Work (Line Items)</th>
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
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
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
              {editing && authRole !== 'primary' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!editing) return
                    if (!confirm('Delete this job from Billing?')) return
                    const ok = await deleteJob(editing.id)
                    if (ok) closeForm()
                  }}
                  disabled={deletingId === editing?.id}
                  style={{
                    padding: '0.5rem 1rem',
                    background: deletingId === editing?.id ? '#f3f4f6' : '#fee2e2',
                    color: deletingId === editing?.id ? '#9ca3af' : '#b91c1c',
                    border: 'none',
                    borderRadius: 4,
                    cursor: deletingId === editing?.id ? 'not-allowed' : 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  {deletingId === editing?.id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <NewReportModal
        open={newReportModalOpen}
        onClose={() => setNewReportModalOpen(false)}
        onSaved={() => { setNewReportModalOpen(false); loadReports(); }}
        authUserId={authUser?.id ?? null}
      />
      {viewReportsJob && (
        <JobReportsModal
          open={!!viewReportsJob}
          onClose={() => setViewReportsJob(null)}
          jobId={viewReportsJob.id}
          hcpNumber={viewReportsJob.hcpNumber}
          jobName={viewReportsJob.jobName}
          jobAddress={viewReportsJob.jobAddress}
          authUserId={authUser?.id ?? null}
        />
      )}
      {readyForBillingJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Send to<br />Billing</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {readyForBillingJob.hcpNumber} · {readyForBillingJob.jobName}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={readyForBillingChecked1}
                  onChange={(e) => setReadyForBillingChecked1(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>I have reported all the Job Parts I&apos;ve used</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={readyForBillingChecked2}
                  onChange={(e) => setReadyForBillingChecked2(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>The customer knows the work is done and is satisfied</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setReadyForBillingJob(null)
                  setReadyForBillingChecked1(false)
                  setReadyForBillingChecked2(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!readyForBillingChecked1 || !readyForBillingChecked2 || stagesStatusUpdatingId === readyForBillingJob.id}
                onClick={async () => {
                  if (!readyForBillingJob) return
                  await updateJobStatus(readyForBillingJob.id, 'ready_to_bill')
                  setReadyForBillingJob(null)
                  setReadyForBillingChecked1(false)
                  setReadyForBillingChecked2(false)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === readyForBillingJob.id ? '…' : 'Send for billing'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendBackJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Send back</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {sendBackJob.hcpNumber} · {sendBackJob.jobName}
            </p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
              {sendBackJob.toStatus === 'working' ? 'This will move the job back to Assigned Jobs (Working).' : 'This will move the job back to Ready to Bill.'}
            </p>
            {sendBackSentBy != null && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Sent by: {sendBackSentBy}
              </p>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sendBackChecked}
                  onChange={(e) => setSendBackChecked(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>I am going to call the Subcontractor and explain why</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setSendBackJob(null)
                  setSendBackChecked(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!sendBackChecked || stagesStatusUpdatingId === sendBackJob.id}
                onClick={async () => {
                  if (!sendBackJob) return
                  await updateJobStatus(sendBackJob.id, sendBackJob.toStatus)
                  setSendBackJob(null)
                  setSendBackChecked(false)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: sendBackChecked && stagesStatusUpdatingId !== sendBackJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: sendBackChecked && stagesStatusUpdatingId !== sendBackJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === sendBackJob.id ? '…' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmJobStatusJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {confirmJobStatusJob.message}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmJobStatusJob(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stagesStatusUpdatingId === confirmJobStatusJob.id}
                onClick={async () => {
                  if (!confirmJobStatusJob) return
                  await updateJobStatus(confirmJobStatusJob.id, confirmJobStatusJob.toStatus)
                  setConfirmJobStatusJob(null)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: stagesStatusUpdatingId !== confirmJobStatusJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: stagesStatusUpdatingId !== confirmJobStatusJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === confirmJobStatusJob.id ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendBackConfirmJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {sendBackConfirmJob.toStatus === 'ready_to_bill' ? 'This will move the job back to Ready to Bill.' : 'This will move the job back to Billed.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSendBackConfirmJob(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stagesStatusUpdatingId === sendBackConfirmJob.id}
                onClick={async () => {
                  if (!sendBackConfirmJob) return
                  await updateJobStatus(sendBackConfirmJob.id, sendBackConfirmJob.toStatus)
                  setSendBackConfirmJob(null)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: stagesStatusUpdatingId !== sendBackConfirmJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: stagesStatusUpdatingId !== sendBackConfirmJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === sendBackConfirmJob.id ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
