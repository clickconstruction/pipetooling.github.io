import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/format'
import { withSupabaseRetry } from '../utils/errorHandling'
import { cascadePersonNameInPayTables } from '../lib/cascadePersonName'
import { findPersonUserDuplicates, mergePersonIntoUser } from '../lib/mergePersonUserDuplicates'
import { loginAsUser } from '../lib/loginAsUser'
import { useAuth } from '../hooks/useAuth'
import { HoursUnassignedModal } from '../components/HoursUnassignedModal'

type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type UserRow = { id: string; email: string | null; name: string; role: string; notes: string | null }
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

type PeopleTab = 'users' | 'pay_stubs' | 'pay' | 'hours' | 'team_costs' | 'vehicles' | 'offsets' | 'review'

type Vehicle = { id: string; year: number | null; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number; created_at: string | null; updated_at: string | null }
type VehicleOdometerEntry = { id: string; vehicle_id: string; odometer_value: number; read_date: string; created_at: string | null }
type VehicleReplacementValueEntry = { id: string; vehicle_id: string; replacement_value: number; read_date: string; created_at: string | null }
type VehiclePossession = { id: string; vehicle_id: string; user_id: string; start_date: string; end_date: string | null; created_at: string | null }

type PersonOffset = { id: string; person_name: string; type: string; amount: number; description: string | null; occurred_date: string; pay_stub_id: string | null; created_at: string | null }

export default function People() {
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [loggingInAsId, setLoggingInAsId] = useState<string | null>(null)
  const [personProjects, setPersonProjects] = useState<Record<string, string[]>>({})
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<PeopleTab>('users')

  // Pay/Hours tab state
  const [payTabLoading, setPayTabLoading] = useState(false)
  const [hoursTabLoading, setHoursTabLoading] = useState(false)
  const [canAccessPay, setCanAccessPay] = useState(false)
  const [canAccessHours, setCanAccessHours] = useState(false)
  const [canViewCostMatrixShared, setCanViewCostMatrixShared] = useState(false)
  const [isDev, setIsDev] = useState(false)
  const [canSeePushStatus, setCanSeePushStatus] = useState(false)
  const [pushEnabledUserIds, setPushEnabledUserIds] = useState<Set<string>>(new Set())
  type PayConfigRow = { person_name: string; hourly_wage: number | null; is_salary: boolean; show_in_hours: boolean; show_in_cost_matrix: boolean; record_hours_but_salary: boolean }
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  const [payConfigSaving, setPayConfigSaving] = useState(false)
  const [payConfigDraft, setPayConfigDraft] = useState<Record<string, string>>({})
  const payConfigRef = useRef(payConfig)
  payConfigRef.current = payConfig
  const payConfigDraftRef = useRef(payConfigDraft)
  payConfigDraftRef.current = payConfigDraft
  const payConfigDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [mergeDuplicates, setMergeDuplicates] = useState<Array<{ personName: string; userDisplayName: string; email: string }>>([])
  const [mergingPersonName, setMergingPersonName] = useState<string | null>(null)
  const [payConfigSectionOpen, setPayConfigSectionOpen] = useState(false)
  const [costMatrixShareSectionOpen, setCostMatrixShareSectionOpen] = useState(false)
  const [costMatrixTagColorsSectionOpen, setCostMatrixTagColorsSectionOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#e5e7eb')
  const [tagLedgerModalTag, setTagLedgerModalTag] = useState<string | null>(null)
  const [teamLedgerModalTeam, setTeamLedgerModalTeam] = useState<PeopleTeam | null>(null)
  const [costMatrixShareCandidates, setCostMatrixShareCandidates] = useState<Array<{ id: string; name: string; email: string | null; role: string }>>([])
  const [costMatrixSharedUserIds, setCostMatrixSharedUserIds] = useState<Set<string>>(new Set())
  const [costMatrixShareSaving, setCostMatrixShareSaving] = useState(false)
  const [costMatrixShareError, setCostMatrixShareError] = useState<string | null>(null)
  type HoursRow = { person_name: string; work_date: string; hours: number }
  const [peopleHours, setPeopleHours] = useState<HoursRow[]>([])
  const [hoursDaysCorrect, setHoursDaysCorrect] = useState<Set<string>>(new Set())
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
  const [payEditArrangement, setPayEditArrangement] = useState(false)
  const [payEditTags, setPayEditTags] = useState(false)
  const [costMatrixTags, setCostMatrixTags] = useState<Record<string, string>>({})
  const [costMatrixTagColors, setCostMatrixTagColors] = useState<Record<string, string>>({})
  const [matrixSortBy, setMatrixSortBy] = useState<'cost' | 'tag' | 'name'>('cost')
  const [showMaxHoursTeams, setShowMaxHoursTeams] = useState(false)
  const [hoursDateStart, setHoursDateStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toISOString().slice(0, 10)
  })
  // Pay History tab state
  type PayStubRow = { id: string; person_name: string; period_start: string; period_end: string; hours_total: number; gross_pay: number; created_at: string | null; paid_at: string | null; paid_by: string | null }
  const [payStubs, setPayStubs] = useState<PayStubRow[]>([])
  const [payStubsLoading, setPayStubsLoading] = useState(false)
  const [payStubGeneratorPerson, setPayStubGeneratorPerson] = useState('')
  const [payStubPeriodStart, setPayStubPeriodStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toISOString().slice(0, 10)
  })
  const [payStubPeriodEnd, setPayStubPeriodEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toISOString().slice(0, 10)
  })
  const [payStubCalendarPerson, setPayStubCalendarPerson] = useState<string | null>(null)
  const [payStubCalendarYear, setPayStubCalendarYear] = useState(() => new Date().getFullYear())
  const [payStubCalendarData, setPayStubCalendarData] = useState<{ earnedByDate: Record<string, number>; paidByDate: Record<string, number> } | null>(null)
  const [payStubCalendarLoading, setPayStubCalendarLoading] = useState(false)
  const [deletingPayStubId, setDeletingPayStubId] = useState<string | null>(null)
  const [markingPayStubId, setMarkingPayStubId] = useState<string | null>(null)
  const [generatingPayStubPerson, setGeneratingPayStubPerson] = useState<string | null>(null)
  const [runPayrollModalOpen, setRunPayrollModalOpen] = useState(false)
  const [payStubDeleteConfirm, setPayStubDeleteConfirm] = useState<PayStubRow | null>(null)
  const [hoursDateEnd, setHoursDateEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toISOString().slice(0, 10)
  })
  const [editingHoursCell, setEditingHoursCell] = useState<{ personName: string; workDate: string } | null>(null)
  const [editingHoursValue, setEditingHoursValue] = useState('')
  const [editingUserNote, setEditingUserNote] = useState<{ id: string; name: string; notes: string } | null>(null)
  const [userNoteSaving, setUserNoteSaving] = useState(false)
  const [authUserRole, setAuthUserRole] = useState<string | null>(null)

  // Team Costs tab state
  type CrewJobAssignment = { job_id: string; pct: number }
  type CrewJobRow = { crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }
  const [crewJobsDate, setCrewJobsDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [crewJobsData, setCrewJobsData] = useState<Record<string, CrewJobRow>>({})
  const [crewJobsLoading, setCrewJobsLoading] = useState(false)
  const [crewJobSearchModal, setCrewJobSearchModal] = useState<{ personName: string } | null>(null)
  const [crewJobSearchText, setCrewJobSearchText] = useState('')
  const [crewJobSearchResults, setCrewJobSearchResults] = useState<Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>>([])
  const [teamLaborSearch, setTeamLaborSearch] = useState('')
  const [breakdownModal, setBreakdownModal] = useState<{ jobId: string; jobName: string; type: 'hours' | 'cost' } | null>(null)
  const [crewJobDetailsMap, setCrewJobDetailsMap] = useState<Record<string, { hcp_number: string; job_name: string; job_address: string }>>({})
  const [teamLaborData, setTeamLaborData] = useState<Array<{ jobId: string; hcpNumber: string; jobName: string; jobAddress: string; people: string[]; manHours: number; jobCost: number; breakdown: Array<{ personName: string; hours: number; cost: number }> }>>([])
  const [teamLaborLoading, setTeamLaborLoading] = useState(false)
  const [crewJobsSectionOpen, setCrewJobsSectionOpen] = useState(false)
  const [crewJobsByDatePerson, setCrewJobsByDatePerson] = useState<Record<string, CrewJobRow>>({})
  const [hoursUnassignedModal, setHoursUnassignedModal] = useState<{ personName: string } | null>(null)

  // Vehicles tab state
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [vehiclesError, setVehiclesError] = useState<string | null>(null)
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [odometerEntries, setOdometerEntries] = useState<VehicleOdometerEntry[]>([])
  const [replacementValueEntries, setReplacementValueEntries] = useState<VehicleReplacementValueEntry[]>([])
  const [possessions, setPossessions] = useState<VehiclePossession[]>([])
  const [vehicleAssignees, setVehicleAssignees] = useState<Record<string, string>>({})
  const [vehicleYear, setVehicleYear] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleVin, setVehicleVin] = useState('')
  const [vehicleInsCost, setVehicleInsCost] = useState('')
  const [vehicleRegCost, setVehicleRegCost] = useState('')
  const [odometerFormOpen, setOdometerFormOpen] = useState(false)
  const [odometerDate, setOdometerDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [odometerValue, setOdometerValue] = useState('')
  const [replacementValueFormOpen, setReplacementValueFormOpen] = useState(false)
  const [replacementValueDate, setReplacementValueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [replacementValueValue, setReplacementValueValue] = useState('')
  const [possessionFormOpen, setPossessionFormOpen] = useState(false)
  // Offsets tab state
  const [offsets, setOffsets] = useState<PersonOffset[]>([])
  const [offsetsLoading, setOffsetsLoading] = useState(false)
  const [offsetsError, setOffsetsError] = useState<string | null>(null)
  const [offsetFormOpen, setOffsetFormOpen] = useState(false)
  const [editingOffset, setEditingOffset] = useState<PersonOffset | null>(null)
  const [offsetPersonName, setOffsetPersonName] = useState('')
  const [offsetType, setOffsetType] = useState<'backcharge' | 'damage'>('backcharge')
  const [offsetAmount, setOffsetAmount] = useState('')
  const [offsetDescription, setOffsetDescription] = useState('')
  const [offsetOccurredDate, setOffsetOccurredDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [offsetApplyModalOpen, setOffsetApplyModalOpen] = useState(false)
  const [offsetToApply, setOffsetToApply] = useState<PersonOffset | null>(null)
  const [offsetApplyPayStubId, setOffsetApplyPayStubId] = useState('')
  const [possessionUserId, setPossessionUserId] = useState('')
  const [possessionStartDate, setPossessionStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [possessionEndDate, setPossessionEndDate] = useState('')

  // Review tab state
  type ReviewPeriod = 'today' | 'yesterday' | 'last_week' | 'last_two_weeks' | 'last_month'
  const [selectedReviewPersonIndex, setSelectedReviewPersonIndex] = useState(0)
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>('last_week')
  const [reviewLoading, setReviewLoading] = useState(false)
  type ReviewLaborJob = {
    source: 'labor'
    id: string
    job_date: string | null
    address: string
    hoursInfo: string
    hours: number
    job_number: string | null
    job_id: string | null
    job_name: string
    laborCost: number
    partsCost: number
    totalBill: number
    revenueBeforeOverhead: number
    allocatedTotalBill: number
    allocatedRevenueBeforeOverhead: number
    allocatedPartsCost: number
    subLaborCost: number
    otherTeammatesLabor: number
    totalJobHours: number
    userTotalHoursOnJob: number
    userTotalContributionToBill: number
    userTotalContributionToRevenue: number
    userTotalLaborOnJob: number
  }
  type ReviewCrewJob = {
    source: 'crew'
    job_id: string
    work_date: string
    hcp_number: string
    job_name: string
    job_address: string
    viaLead: string | null
    crewMemberNames?: string[]
    hours: number
    laborCost: number
    partsCost: number
    totalBill: number
    revenueBeforeOverhead: number
    allocatedTotalBill: number
    allocatedRevenueBeforeOverhead: number
    allocatedPartsCost: number
    subLaborCost: number
    otherTeammatesLabor: number
    totalJobHours: number
    userTotalHoursOnJob: number
    userTotalContributionToBill: number
    userTotalContributionToRevenue: number
    userTotalLaborOnJob: number
  }
  const [reviewLaborJobs, setReviewLaborJobs] = useState<ReviewLaborJob[]>([])
  const [reviewCrewJobs, setReviewCrewJobs] = useState<ReviewCrewJob[]>([])
  const [reviewAllocatedRevenue, setReviewAllocatedRevenue] = useState(0)
  const [reviewAllocatedProfit, setReviewAllocatedProfit] = useState(0)
  const [reviewHours, setReviewHours] = useState<Array<{ work_date: string; hours: number }>>([])
  type ReviewReport = { id: string; template_name: string; job_display_name: string; created_at: string }
  const [reviewReports, setReviewReports] = useState<ReviewReport[]>([])
  type ReviewTask = { id: string; title: string; scheduled_date: string; completed_at: string | null }
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([])
  const [reviewJobsWorkedCollapsed, setReviewJobsWorkedCollapsed] = useState(false)
  const [reviewJobExpandedKey, setReviewJobExpandedKey] = useState<string | null>(null)
  const [reviewHoursPayCollapsed, setReviewHoursPayCollapsed] = useState(false)
  const [teamSummaryModalOpen, setTeamSummaryModalOpen] = useState(false)
  const [teamSummaryLoading, setTeamSummaryLoading] = useState(false)
  const [teamSummaryExcludeJob000Office, setTeamSummaryExcludeJob000Office] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('teamSummaryExcludeJob000Office') === 'true'
  )
  type TeamSummaryData = { totalRevenue: number; totalProfit: number; totalHours: number } | null
  const [teamSummaryData, setTeamSummaryData] = useState<TeamSummaryData>(null)

  const loadCrewJobsRef = useRef<() => void>()
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
      supabase.from('users').select('id, email, name, role, notes').in('role', ['assistant', 'master_technician', 'subcontractor', 'estimator', 'primary']),
      supabase.from('users').select('role').eq('id', authUser.id).single(),
    ])
    if (peopleRes.error) setError(peopleRes.error.message)
    else setPeople((peopleRes.data as Person[]) ?? [])
    let usersList = (usersRes.data as UserRow[]) ?? []
    const myRole = (meRes.data as { role?: string } | null)?.role ?? null
    setAuthUserRole(myRole)
    if (myRole === 'dev') {
      const { data: devUsers } = await supabase.from('users').select('id, email, name, role, notes').eq('role', 'dev')
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
    const tab = searchParams.get('tab')
    if (tab === 'users' || tab === 'pay_stubs' || tab === 'pay' || tab === 'hours' || tab === 'team_costs' || tab === 'vehicles' || tab === 'offsets' || tab === 'review') {
      setActiveTab(tab)
    } else if (!tab) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'users')
        return next
      }, { replace: true })
    }
  }, [searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#cost-matrix' && activeTab === 'pay') {
      const el = document.getElementById('cost-matrix')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeTab, searchParams])

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

  const canEditCrewJobs = canAccessPay || (authUserRole === 'assistant' && canAccessHours)

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
        const oldName = editing.name?.trim()
        if (oldName && oldName !== trimmedName) {
          await cascadePersonNameInPayTables(oldName, trimmedName)
        }
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
    const { data: usersData } = await supabase
      .from('users')
      .select('id, email, name')
      .in('role', ['assistant', 'master_technician', 'subcontractor', 'estimator', 'primary'])
    const usersAfterInvite = (usersData ?? []) as Array<{ id: string; email: string | null; name: string }>
    const dups = findPersonUserDuplicates(people, usersAfterInvite, payConfig)
    const invitedDup = dups.find((d) => d.email.toLowerCase() === p.email?.trim().toLowerCase())
    if (invitedDup) {
      const userId = usersAfterInvite.find((u) => u.email?.toLowerCase() === invitedDup.email?.toLowerCase())?.id
      try {
        await mergePersonIntoUser(invitedDup.personName, invitedDup.userDisplayName, payConfig, userId)
        await loadPayConfig()
        setMergeDuplicates((prev) => prev.filter((x) => x.personName !== invitedDup.personName))
      } catch (mergeErr) {
        setError(mergeErr instanceof Error ? mergeErr.message : 'Merge failed')
      }
    }
  }

  function confirmAndInvite() {
    if (!inviteConfirm) return
    const p = inviteConfirm
    setInviteConfirm(null)
    inviteAsUser(p)
  }

  async function handleMergeDuplicate(dup: { personName: string; userDisplayName: string; email: string }) {
    setMergingPersonName(dup.personName)
    setError(null)
    let userId: string | undefined
    if (dup.email?.trim()) {
      userId = users.find((u) => u.email?.toLowerCase() === dup.email?.toLowerCase())?.id
    } else {
      userId = users.find((u) => u.name?.trim() === dup.personName)?.id ?? users.find((u) => u.name?.trim() === dup.userDisplayName)?.id
    }
    try {
      await mergePersonIntoUser(dup.personName, dup.userDisplayName, payConfig, userId)
      await loadPayConfig()
      setMergeDuplicates((prev) => prev.filter((x) => x.personName !== dup.personName))
      if (activeTab === 'hours') {
        loadPeopleHours(hoursDateStart, hoursDateEnd)
      }
      if (activeTab === 'pay') {
        loadPeopleHours(matrixStartDate, matrixEndDate)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMergingPersonName(null)
    }
  }

  function byKind(k: PersonKind): ({ source: 'user'; id: string; name: string; email: string | null; notes: string | null } | ({ source: 'people' } & Person))[] {
    const userRole = KIND_TO_USER_ROLE[k]
    const fromUsers = users.filter((u) => u.role === userRole).map((u) => ({ source: 'user' as const, id: u.id, name: u.name, email: u.email, notes: u.notes }))
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
    for (const u of users.filter((u) => u.role === 'primary')) {
      if (u.name?.trim()) names.add(u.name.trim())
    }
    return Array.from(names).sort()
  }

  async function loadPayConfig() {
    if (!canAccessPay && !canAccessHours && !canViewCostMatrixShared) return
    const { data, error } = await supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary')
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
    setPayConfigDraft({})
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

  async function loadHoursDaysCorrect(start: string, end: string) {
    if (!canAccessHours && !canAccessPay && !canViewCostMatrixShared) return
    const { data, error } = await (supabase as any)
      .from('hours_days_correct')
      .select('work_date')
      .gte('work_date', start)
      .lte('work_date', end)
    if (error) {
      setError(error.message)
      return
    }
    setHoursDaysCorrect((prev) => {
      const next = new Set(prev)
      for (const d of getDaysInRange(start, end)) next.delete(d)
      for (const r of (data ?? []) as { work_date: string }[]) next.add(r.work_date)
      return next
    })
  }

  async function toggleHoursDayCorrect(workDate: string) {
    if (!canAccessHours && !canAccessPay) return
    const isCorrect = hoursDaysCorrect.has(workDate)
    if (isCorrect) {
      const { error } = await (supabase as any).from('hours_days_correct').delete().eq('work_date', workDate)
      if (error) setError(error.message)
      else setHoursDaysCorrect((prev) => { const next = new Set(prev); next.delete(workDate); return next })
    } else {
      const { error } = await (supabase as any).from('hours_days_correct').insert({ work_date: workDate, marked_by: authUser?.id ?? null })
      if (error) setError(error.message)
      else setHoursDaysCorrect((prev) => { const next = new Set(prev); next.add(workDate); return next })
    }
  }

  async function loadPayStubs() {
    if (!canAccessPay) return
    const { data, error } = await supabase
      .from('pay_stubs')
      .select('id, person_name, period_start, period_end, hours_total, gross_pay, created_at, paid_at, paid_by')
      .order('created_at', { ascending: false })
    if (error) {
      setError(error.message)
      return
    }
    setPayStubs((data ?? []) as PayStubRow[])
  }

  async function loadPayStubCalendarData(personName: string, year: number) {
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    setPayStubCalendarLoading(true)
    setPayStubCalendarData(null)
    const [hoursRes, paidRes] = await Promise.all([
      supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
      supabase.from('pay_stub_days').select('work_date, paid_amount').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
    ])
    setPayStubCalendarLoading(false)
    if (hoursRes.error || paidRes.error) {
      setError(hoursRes.error?.message ?? paidRes.error?.message ?? 'Failed to load calendar data')
      return
    }
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const isSalary = cfg?.is_salary ?? false
    const hoursMap = new Map<string, number>()
    for (const r of (hoursRes.data ?? []) as { work_date: string; hours: number }[]) {
      hoursMap.set(r.work_date, r.hours)
    }
    const paidMap = new Map<string, number>()
    for (const r of (paidRes.data ?? []) as { work_date: string; paid_amount: number }[]) {
      paidMap.set(r.work_date, (paidMap.get(r.work_date) ?? 0) + r.paid_amount)
    }
    const earnedByDate: Record<string, number> = {}
    const paidByDate: Record<string, number> = {}
    const d = new Date(start + 'T12:00:00')
    const endD = new Date(end + 'T12:00:00')
    while (d <= endD) {
      const key = d.toISOString().slice(0, 10)
      const hrs = isSalary ? (d.getDay() >= 1 && d.getDay() <= 5 ? 8 : 0) : hoursMap.get(key) ?? 0
      earnedByDate[key] = hrs * wage
      paidByDate[key] = paidMap.get(key) ?? 0
      d.setDate(d.getDate() + 1)
    }
    setPayStubCalendarData({ earnedByDate, paidByDate })
  }

  function computePayReportJobBreakdown(
    personName: string,
    dayRows: Array<{ work_date: string; hours: number }>,
    crewByDatePerson: Record<string, CrewJobRow>,
    jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }>
  ): Array<{ date: string; hours: number; jobsText: string }> {
    function getEffectiveAssignments(pn: string, workDate: string): CrewJobAssignment[] {
      const key = `${workDate}:${pn}`
      const row = crewByDatePerson[key]
      if (!row) return []
      if (row.crew_lead_person_name) {
        const leadKey = `${workDate}:${row.crew_lead_person_name}`
        const leadRow = crewByDatePerson[leadKey]
        return leadRow?.job_assignments ?? []
      }
      return row.job_assignments
    }
    function jobLabel(jobId: string): string {
      const d = jobsMap[jobId]
      if (!d) return jobId.slice(0, 8)
      const jobNum = (d.hcp_number ?? '').trim()
      const jobName = (d.job_name ?? '').trim()
      if (jobNum && jobName) return `Job ${jobNum} (${jobName})`
      return jobNum || jobName || (d.job_address ?? '').trim() || jobId.slice(0, 8)
    }
    return dayRows.map((r) => {
      const assignments = getEffectiveAssignments(personName, r.work_date)
      if (assignments.length === 0) return { date: r.work_date, hours: r.hours, jobsText: '—' }
      const parts = assignments.map((a) => {
        const jobHours = r.hours * (a.pct / 100)
        return `${jobLabel(a.job_id)} ${jobHours.toFixed(2)} hrs`
      })
      return { date: r.work_date, hours: r.hours, jobsText: parts.join(', ') }
    })
  }

  async function getVehiclesForPersonInPeriod(
    personName: string,
    periodStart: string,
    periodEnd: string
  ): Promise<Array<{ year: number; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number }>> {
    const n = personName.trim()
    const user = users.find((u) => (u.name ?? '').trim().toLowerCase() === n.toLowerCase())
    if (!user) return []
    const { data: possData } = await supabase
      .from('vehicle_possessions')
      .select('vehicle_id, start_date')
      .eq('user_id', user.id)
      .lte('start_date', periodEnd)
      .or(`end_date.is.null,end_date.gte.${periodStart}`)
      .order('start_date', { ascending: false })
    const poss = (possData ?? []) as { vehicle_id: string; start_date: string }[]
    const vehicleIds = [...new Set(poss.filter((p) => p.start_date <= periodEnd).map((p) => p.vehicle_id))]
    const result: Array<{ year: number; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number }> = []
    for (const vehicleId of vehicleIds) {
      const { data: vehicleData } = await supabase.from('vehicles').select('year, make, model, vin, weekly_insurance_cost, weekly_registration_cost').eq('id', vehicleId).single()
      if (!vehicleData) continue
      const v = vehicleData as { year: number | null; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number }
      result.push({
        year: v.year ?? 0,
        make: v.make ?? '',
        model: v.model ?? '',
        vin: v.vin ?? null,
        weekly_insurance_cost: v.weekly_insurance_cost ?? 0,
        weekly_registration_cost: v.weekly_registration_cost ?? 0,
      })
    }
    return result
  }

  async function getOffsetsForPayStub(
    personName: string,
    payStubId: string | null,
    _periodStart: string,
    _periodEnd: string
  ): Promise<{ appliedOffsets: Array<{ type: string; amount: number; description: string | null }>; pendingOffsets: Array<{ type: string; amount: number; description: string | null }> }> {
    const applied: Array<{ type: string; amount: number; description: string | null }> = []
    const pending: Array<{ type: string; amount: number; description: string | null }> = []
    if (payStubId) {
      const { data: appliedData } = await supabase.from('person_offsets').select('type, amount, description').eq('pay_stub_id', payStubId)
      for (const r of (appliedData ?? []) as { type: string; amount: number; description: string | null }[]) {
        applied.push({ type: r.type, amount: r.amount, description: r.description })
      }
    }
    const { data: pendingData } = await supabase.from('person_offsets').select('type, amount, description').eq('person_name', personName.trim()).is('pay_stub_id', null)
    for (const r of (pendingData ?? []) as { type: string; amount: number; description: string | null }[]) {
      pending.push({ type: r.type, amount: r.amount, description: r.description })
    }
    return { appliedOffsets: applied, pendingOffsets: pending }
  }

  function getPersonContact(personName: string): { email: string | null; phone: string | null } {
    const n = personName.trim()
    const p = people.find((x) => x.name?.trim() === n)
    if (p) return { email: p.email ?? null, phone: p.phone ?? null }
    const u = users.find((x) => x.name?.trim() === n)
    if (u) return { email: u.email ?? null, phone: null }
    return { email: null, phone: null }
  }

  function buildPayStubHtml(
    personName: string,
    periodStart: string,
    periodEnd: string,
    hourlyWage: number,
    hoursRows: Array<{ date: string; hours: number }>,
    hoursTotal: number,
    grossPay: number,
    rowsWithJobs?: Array<{ date: string; hours: number; jobsText: string }>,
    vehicles?: Array<{ year: number; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number }>,
    appliedOffsets?: Array<{ type: string; amount: number; description: string | null }>,
    pendingOffsets?: Array<{ type: string; amount: number; description: string | null }>
  ): string {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateWithDay = (dateStr: string) => {
      const d = new Date(dateStr + 'T12:00:00')
      const day = d.toLocaleDateString('en-US', { weekday: 'short' })
      return `${dateStr} (${day})`
    }
    const { email, phone } = getPersonContact(personName)
    const periodLabel = `Pay Period: ${new Date(periodStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(periodEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    const wageDisplay = hourlyWage > 0 ? `$${formatCurrency(hourlyWage)}/hr` : '—'
    const hasJobs = rowsWithJobs && rowsWithJobs.length > 0
    const tableRows = hasJobs
      ? rowsWithJobs!.map((r) => `<tr><td>${escapeHtml(dateWithDay(r.date))}</td><td style="text-align:right">${r.hours.toFixed(2)}</td><td>${escapeHtml(r.jobsText)}</td></tr>`).join('')
      : hoursRows.map((r) => `<tr><td>${escapeHtml(dateWithDay(r.date))}</td><td style="text-align:right">${r.hours.toFixed(2)}</td></tr>`).join('')
    const tableHeader = hasJobs
      ? '<thead><tr><th>Date</th><th style="text-align:right">Hours</th><th>Jobs</th></tr></thead>'
      : '<thead><tr><th>Date</th><th style="text-align:right">Hours</th></tr></thead>'
    const tableFooter = hasJobs
      ? `<tfoot><tr><td style="font-weight:600">Total</td><td style="text-align:right; font-weight:600">${hoursTotal.toFixed(2)}</td><td></td></tr></tfoot>`
      : `<tfoot><tr><td style="font-weight:600">Total</td><td style="text-align:right; font-weight:600">${hoursTotal.toFixed(2)}</td></tr></tfoot>`
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pay Report - ${escapeHtml(personName)}</title><style>
      body { font-family: sans-serif; margin: 1in; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      .meta { margin-bottom: 0.5rem; color: #666; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <h1>Pay Report</h1>
      <div style="margin-bottom: 0.5rem;"><strong>${escapeHtml(personName)}</strong></div>
      ${email ? `<div class="meta">${escapeHtml(email)}</div>` : ''}
      ${phone ? `<div class="meta">${escapeHtml(phone)}</div>` : ''}
      <div class="meta">${periodLabel}</div>
      <div class="meta">Hourly wage: ${wageDisplay}</div>
      <table>
        ${tableHeader}
        <tbody>${tableRows}</tbody>
        ${tableFooter}
      </table>
      <div style="margin-top: 1rem; font-weight: 600;">Gross Pay: $${formatCurrency(grossPay)}</div>
      ${(appliedOffsets && appliedOffsets.length > 0) || (pendingOffsets && pendingOffsets.length > 0) ? (() => {
        const applied = appliedOffsets ?? []
        const pending = pendingOffsets ?? []
        const appliedTotal = applied.reduce((s, o) => s + o.amount, 0)
        const netPay = grossPay - appliedTotal
        let html = '<div style="margin-top: 1rem;">'
        if (applied.length > 0) {
          html += '<div style="margin-top: 0.5rem;"><strong>Applied Offsets:</strong></div>'
          for (const o of applied) {
            html += `<div class="meta">- ${escapeHtml(o.type === 'backcharge' ? 'Backcharge' : 'Damage')}${o.description ? ` (${escapeHtml(o.description)})` : ''}: $${formatCurrency(o.amount)}</div>`
          }
          html += `<div class="meta"><strong>Total Applied: $${formatCurrency(appliedTotal)}</strong></div>`
          html += `<div class="meta" style="font-weight: 600;">Net Pay: $${formatCurrency(netPay)}</div>`
        }
        if (pending.length > 0) {
          html += '<div style="margin-top: 0.75rem;"><strong>Pending Offsets (not yet applied):</strong></div>'
          for (const o of pending) {
            html += `<div class="meta">- ${escapeHtml(o.type === 'backcharge' ? 'Backcharge' : 'Damage')}${o.description ? ` (${escapeHtml(o.description)})` : ''}: $${formatCurrency(o.amount)}</div>`
          }
        }
        html += '</div>'
        return html
      })() : ''}
      ${vehicles && vehicles.length > 0 ? `<div style="margin-top: 1rem;">${vehicles.map((v) => `<div class="meta">Vehicle: ${escapeHtml(String(v.year))} ${escapeHtml(v.make)} ${escapeHtml(v.model)}${v.vin ? ` (VIN: ${escapeHtml(v.vin)})` : ''}</div><div class="meta">Weekly insurance: $${formatCurrency(v.weekly_insurance_cost)} | Weekly registration: $${formatCurrency(v.weekly_registration_cost)}</div>`).join('')}</div>` : ''}
    </body></html>`
    return html
  }

  function openPayStubWindow(html: string, doPrint: boolean) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    if (doPrint) {
      win.print()
      win.onafterprint = () => win.close()
    }
  }

  async function generatePayStub(personOverride?: string) {
    const personName = (personOverride ?? payStubGeneratorPerson)?.trim()
    if (!authUser?.id || !personName) return
    const start = payStubPeriodStart
    const end = payStubPeriodEnd
    const { data: hoursData } = await supabase
      .from('people_hours')
      .select('work_date, hours')
      .eq('person_name', personName)
      .gte('work_date', start)
      .lte('work_date', end)
    const hoursRows = ((hoursData ?? []) as { work_date: string; hours: number }[])
      .sort((a, b) => a.work_date.localeCompare(b.work_date))
      .map((r) => ({ date: r.work_date, hours: r.hours }))
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const isSalary = cfg?.is_salary ?? false
    const daysInRange = getDaysInRange(start, end)
    const dayRows: Array<{ work_date: string; hours: number; paid_amount: number }> = []
    for (const d of daysInRange) {
      const hrs = isSalary
        ? (() => {
            const day = new Date(d + 'T12:00:00').getDay()
            return day >= 1 && day <= 5 ? 8 : 0
          })()
        : hoursRows.find((r) => r.date === d)?.hours ?? 0
      const paidAmount = hrs * wage
      dayRows.push({ work_date: d, hours: hrs, paid_amount: paidAmount })
    }
    const hoursTotal = dayRows.reduce((s, r) => s + r.hours, 0)
    const grossPay = dayRows.reduce((s, r) => s + r.paid_amount, 0)
    const { data: stubData, error: stubErr } = await supabase
      .from('pay_stubs')
      .insert({
        person_name: personName,
        period_start: start,
        period_end: end,
        hours_total: hoursTotal,
        gross_pay: grossPay,
        created_by: authUser.id,
      })
      .select('id')
      .single()
    if (stubErr || !stubData) {
      setError(stubErr?.message ?? 'Failed to create pay report')
      return
    }
    const payStubId = stubData.id as string
    const { error: daysErr } = await supabase.from('pay_stub_days').insert(
      dayRows.map((r) => ({
        pay_stub_id: payStubId,
        person_name: personName,
        work_date: r.work_date,
        hours_at_time: r.hours,
        rate_at_time: wage,
        paid_amount: r.paid_amount,
      }))
    )
    if (daysErr) {
      setError(daysErr.message)
      return
    }
    await loadPayStubs()
    const { data: crewData } = await supabase
      .from('people_crew_jobs')
      .select('work_date, person_name, crew_lead_person_name, job_assignments')
      .gte('work_date', start)
      .lte('work_date', end)
    const crewRows = (crewData ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const jobIds = new Set<string>()
    for (const r of dayRows) {
      const row = crewByDatePerson[`${r.work_date}:${personName}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
      for (const a of assignments) jobIds.add(a.job_id)
    }
    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
    if (jobIds.size > 0) {
      const { data: jobsData } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address').in('id', [...jobIds])
      for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
        jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
      }
    }
    const rowsWithJobs = computePayReportJobBreakdown(personName, dayRows, crewByDatePerson, jobsMap)
    const [vehicles, { appliedOffsets, pendingOffsets }] = await Promise.all([
      getVehiclesForPersonInPeriod(personName, start, end),
      getOffsetsForPayStub(personName, payStubId, start, end),
    ])
    const html = buildPayStubHtml(personName, start, end, wage, dayRows.map((r) => ({ date: r.work_date, hours: r.hours })), hoursTotal, grossPay, rowsWithJobs, vehicles, appliedOffsets, pendingOffsets)
    openPayStubWindow(html, false)
  }

  async function viewPayStub(stub: PayStubRow) {
    const start = stub.period_start
    const end = stub.period_end
    const cfg = payConfig[stub.person_name]
    const isSalary = cfg?.is_salary ?? false
    const { data: daysData } = await supabase.from('pay_stub_days').select('work_date, hours_at_time').eq('pay_stub_id', stub.id).order('work_date')
    let dayRows: Array<{ work_date: string; hours: number }>
    if (daysData && daysData.length > 0) {
      dayRows = (daysData as { work_date: string; hours_at_time: number }[]).map((r) => ({ work_date: r.work_date, hours: r.hours_at_time }))
    } else {
      const { data: hoursData } = await supabase.from('people_hours').select('work_date, hours').eq('person_name', stub.person_name).gte('work_date', start).lte('work_date', end)
      const hoursRows = ((hoursData ?? []) as { work_date: string; hours: number }[]).map((r) => ({ work_date: r.work_date, hours: r.hours }))
      const daysInRange = getDaysInRange(start, end)
      dayRows = daysInRange.map((d) => {
        const hrs = isSalary ? (() => { const day = new Date(d + 'T12:00:00').getDay(); return day >= 1 && day <= 5 ? 8 : 0 })() : (hoursRows.find((r) => r.work_date === d)?.hours ?? 0)
        return { work_date: d, hours: hrs }
      })
    }
    const wage = cfg?.hourly_wage ?? 0
    const { data: crewData } = await supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', start).lte('work_date', end)
    const crewRows = (crewData ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = { crew_lead_person_name: r.crew_lead_person_name, job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
    }
    const jobIds = new Set<string>()
    for (const r of dayRows) {
      const row = crewByDatePerson[`${r.work_date}:${stub.person_name}`]
      const assignments = row ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments) : []
      for (const a of assignments) jobIds.add(a.job_id)
    }
    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
    if (jobIds.size > 0) {
      const { data: jobsData } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address').in('id', [...jobIds])
      for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
        jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
      }
    }
    const rowsWithJobs = computePayReportJobBreakdown(stub.person_name, dayRows, crewByDatePerson, jobsMap)
    const hoursRows = dayRows.map((r) => ({ date: r.work_date, hours: r.hours }))
    const [vehicles, { appliedOffsets, pendingOffsets }] = await Promise.all([
      getVehiclesForPersonInPeriod(stub.person_name, start, end),
      getOffsetsForPayStub(stub.person_name, stub.id, start, end),
    ])
    const html = buildPayStubHtml(stub.person_name, start, end, wage, hoursRows, stub.hours_total, stub.gross_pay, rowsWithJobs, vehicles, appliedOffsets, pendingOffsets)
    openPayStubWindow(html, false)
  }

  async function printPayStub(stub: PayStubRow) {
    const start = stub.period_start
    const end = stub.period_end
    const cfg = payConfig[stub.person_name]
    const isSalary = cfg?.is_salary ?? false
    const { data: daysData } = await supabase.from('pay_stub_days').select('work_date, hours_at_time').eq('pay_stub_id', stub.id).order('work_date')
    let dayRows: Array<{ work_date: string; hours: number }>
    if (daysData && daysData.length > 0) {
      dayRows = (daysData as { work_date: string; hours_at_time: number }[]).map((r) => ({ work_date: r.work_date, hours: r.hours_at_time }))
    } else {
      const { data: hoursData } = await supabase.from('people_hours').select('work_date, hours').eq('person_name', stub.person_name).gte('work_date', start).lte('work_date', end)
      const hoursRows = ((hoursData ?? []) as { work_date: string; hours: number }[]).map((r) => ({ work_date: r.work_date, hours: r.hours }))
      const daysInRange = getDaysInRange(start, end)
      dayRows = daysInRange.map((d) => {
        const hrs = isSalary ? (() => { const day = new Date(d + 'T12:00:00').getDay(); return day >= 1 && day <= 5 ? 8 : 0 })() : (hoursRows.find((r) => r.work_date === d)?.hours ?? 0)
        return { work_date: d, hours: hrs }
      })
    }
    const wage = cfg?.hourly_wage ?? 0
    const { data: crewData } = await supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', start).lte('work_date', end)
    const crewRows = (crewData ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = { crew_lead_person_name: r.crew_lead_person_name, job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
    }
    const jobIds = new Set<string>()
    for (const r of dayRows) {
      const row = crewByDatePerson[`${r.work_date}:${stub.person_name}`]
      const assignments = row ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments) : []
      for (const a of assignments) jobIds.add(a.job_id)
    }
    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
    if (jobIds.size > 0) {
      const { data: jobsData } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address').in('id', [...jobIds])
      for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
        jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
      }
    }
    const rowsWithJobs = computePayReportJobBreakdown(stub.person_name, dayRows, crewByDatePerson, jobsMap)
    const hoursRows = dayRows.map((r) => ({ date: r.work_date, hours: r.hours }))
    const [vehicles, { appliedOffsets, pendingOffsets }] = await Promise.all([
      getVehiclesForPersonInPeriod(stub.person_name, start, end),
      getOffsetsForPayStub(stub.person_name, stub.id, start, end),
    ])
    const html = buildPayStubHtml(stub.person_name, start, end, wage, hoursRows, stub.hours_total, stub.gross_pay, rowsWithJobs, vehicles, appliedOffsets, pendingOffsets)
    openPayStubWindow(html, true)
  }

  async function deletePayStub(stub: PayStubRow) {
    setDeletingPayStubId(stub.id)
    setError(null)
    const { error: err } = await supabase.from('pay_stubs').delete().eq('id', stub.id)
    if (err) {
      setError(err.message)
    } else {
      setPayStubs((prev) => prev.filter((s) => s.id !== stub.id))
      setPayStubDeleteConfirm(null)
    }
    setDeletingPayStubId(null)
  }

  async function markPayStubPaid(stub: PayStubRow) {
    if (!authUser?.id) return
    setMarkingPayStubId(stub.id)
    setError(null)
    try {
      await withSupabaseRetry(
        async () => await supabase.from('pay_stubs').update({ paid_at: new Date().toISOString(), paid_by: authUser.id }).eq('id', stub.id),
        'mark pay stub paid'
      )
      await loadPayStubs()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark as paid')
    }
    setMarkingPayStubId(null)
  }

  async function unmarkPayStubPaid(stub: PayStubRow) {
    setMarkingPayStubId(stub.id)
    setError(null)
    try {
      await withSupabaseRetry(
        async () => await supabase.from('pay_stubs').update({ paid_at: null, paid_by: null }).eq('id', stub.id),
        'unmark pay stub paid'
      )
      await loadPayStubs()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unmark paid')
    }
    setMarkingPayStubId(null)
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
      supabase.from('users').select('id, name, email, role').in('role', ['master_technician', 'assistant', 'dev']).order('name'),
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

  async function loadCostMatrixTags() {
    if (!canAccessPay && !canViewCostMatrixShared) return
    const { data } = await supabase.from('people_cost_matrix_tags').select('person_name, tags')
    const map: Record<string, string> = {}
    for (const r of (data ?? []) as { person_name: string; tags: string }[]) {
      map[r.person_name] = r.tags ?? ''
    }
    setCostMatrixTags(map)
  }

  async function loadCostMatrixTagColors() {
    if (!canAccessPay && !canViewCostMatrixShared) return
    const { data } = await supabase.from('cost_matrix_tag_colors').select('tag, color')
    const map: Record<string, string> = {}
    for (const r of (data ?? []) as { tag: string; color: string }[]) {
      map[r.tag] = r.color ?? '#e5e7eb'
    }
    setCostMatrixTagColors(map)
  }

  useEffect(() => {
    if (activeTab === 'pay' && (canAccessPay || canViewCostMatrixShared)) {
      setPayTabLoading(true)
      Promise.all([
        loadPayConfig(),
        loadPeopleHours(matrixStartDate, matrixEndDate),
        loadTeams(),
        loadHoursDisplayOrder(),
        loadCostMatrixTags(),
        loadCostMatrixTagColors(),
      ]).finally(() => setPayTabLoading(false))
    }
    if (activeTab === 'team_costs' && (canAccessPay || canViewCostMatrixShared)) {
      setPayTabLoading(true)
      Promise.all([
        loadPayConfig(),
        loadHoursDisplayOrder(),
      ]).finally(() => setPayTabLoading(false))
    }
  }, [activeTab, canAccessPay, canViewCostMatrixShared, matrixStartDate, matrixEndDate])

  useEffect(() => {
    if (activeTab === 'pay' && Object.keys(payConfig).length > 0) {
      const dups = findPersonUserDuplicates(people, users, payConfig)
      setMergeDuplicates(dups)
    } else {
      setMergeDuplicates([])
    }
  }, [activeTab, payConfig, people, users])

  useEffect(() => {
    if (activeTab === 'pay' && isDev) {
      loadCostMatrixShares()
    }
  }, [activeTab, isDev])

  useEffect(() => {
    return () => {
      for (const t of Object.values(payConfigDebounceRef.current)) clearTimeout(t)
      payConfigDebounceRef.current = {}
    }
  }, [])

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

  async function saveCostMatrixTags(personName: string, tags: string) {
    if (!canAccessPay) return
    const trimmed = (tags ?? '').trim()
    setCostMatrixTags((prev) => ({ ...prev, [personName]: trimmed }))
    await supabase.from('people_cost_matrix_tags').upsert(
      { person_name: personName, tags: trimmed },
      { onConflict: 'person_name' }
    )
  }

  async function saveTagColor(tag: string, color: string) {
    if (!canAccessPay) return
    const trimmedTag = tag.trim()
    if (!trimmedTag) return
    setCostMatrixTagColors((prev) => ({ ...prev, [trimmedTag]: color }))
    await supabase.from('cost_matrix_tag_colors').upsert(
      { tag: trimmedTag, color },
      { onConflict: 'tag' }
    )
  }

  async function moveMatrixRow(personName: string, direction: 'up' | 'down') {
    const idx = showPeopleForMatrix.indexOf(personName)
    if (idx < 0) return
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1
    if (otherIdx < 0 || otherIdx >= showPeopleForMatrix.length) return
    const otherName = showPeopleForMatrix[otherIdx]
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
        loadHoursDaysCorrect(hoursDateStart, hoursDateEnd),
        loadHoursDisplayOrder(),
      ]).finally(() => setHoursTabLoading(false))
    }
  }, [activeTab, canAccessHours, hoursDateStart, hoursDateEnd])

  useEffect(() => {
    if (activeTab === 'pay_stubs' && canAccessPay) {
      setPayStubsLoading(true)
      Promise.all([loadPayConfig(), loadPayStubs()]).finally(() => setPayStubsLoading(false))
    }
  }, [activeTab, canAccessPay])

  useEffect(() => {
    if (activeTab === 'pay_stubs' && canAccessPay && payStubPeriodStart <= payStubPeriodEnd) {
      loadPeopleHours(payStubPeriodStart, payStubPeriodEnd)
      loadHoursDaysCorrect(payStubPeriodStart, payStubPeriodEnd)
    }
  }, [activeTab, canAccessPay, payStubPeriodStart, payStubPeriodEnd])

  useEffect(() => {
    if (payStubCalendarPerson) {
      loadPayStubCalendarData(payStubCalendarPerson, payStubCalendarYear)
    } else {
      setPayStubCalendarData(null)
    }
  }, [payStubCalendarPerson, payStubCalendarYear])

  async function loadCrewJobs(date: string) {
    setCrewJobsLoading(true)
    const { data, error } = await supabase
      .from('people_crew_jobs')
      .select('person_name, crew_lead_person_name, job_assignments')
      .eq('work_date', date)
    setCrewJobsLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    const map: Record<string, CrewJobRow> = {}
    for (const r of (data ?? []) as { person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }[]) {
      map[r.person_name] = {
        crew_lead_person_name: r.crew_lead_person_name ?? null,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    setCrewJobsData(map)
  }

  async function loadVehicles() {
    setVehiclesLoading(true)
    setVehiclesError(null)
    const today = new Date().toISOString().slice(0, 10)
    const { data: vehiclesData, error: vehiclesErr } = await supabase.from('vehicles').select('*').order('year', { ascending: false })
    setVehiclesLoading(false)
    if (vehiclesErr) {
      setVehiclesError(vehiclesErr.message)
      return
    }
    setVehicles((vehiclesData ?? []) as Vehicle[])
    const ids = (vehiclesData ?? []).map((v: { id: string }) => v.id)
    if (ids.length === 0) {
      setVehicleAssignees({})
      return
    }
    const { data: possData } = await supabase
      .from('vehicle_possessions')
      .select('vehicle_id, user_id')
      .in('vehicle_id', ids)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
    const possByVehicle: Record<string, string[]> = {}
    for (const p of (possData ?? []) as { vehicle_id: string; user_id: string }[]) {
      const arr = possByVehicle[p.vehicle_id] ??= []
      arr.push(p.user_id)
    }
    const userIds = [...new Set((possData ?? []).map((p: { user_id: string }) => p.user_id))]
    const { data: usersData } = userIds.length > 0
      ? await supabase.from('users').select('id, name').in('id', userIds)
      : { data: [] }
    const userNames: Record<string, string> = {}
    for (const u of (usersData ?? []) as { id: string; name: string }[]) {
      userNames[u.id] = u.name ?? ''
    }
    const assignees: Record<string, string> = {}
    for (const [vid, uids] of Object.entries(possByVehicle)) {
      assignees[vid] = uids.map((uid) => userNames[uid] || uid.slice(0, 8)).join(', ')
    }
    setVehicleAssignees(assignees)
  }

  async function loadOdometerEntries(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_odometer_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('read_date', { ascending: false })
    if (error) return
    setOdometerEntries((data ?? []) as VehicleOdometerEntry[])
  }

  async function loadReplacementValueEntries(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_replacement_value_entries')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('read_date', { ascending: false })
    if (error) return
    setReplacementValueEntries((data ?? []) as VehicleReplacementValueEntry[])
  }

  async function loadPossessions(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_possessions')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('start_date', { ascending: false })
    if (error) return
    setPossessions((data ?? []) as VehiclePossession[])
  }

  function openVehicleForm(v?: Vehicle) {
    setEditingVehicle(v ?? null)
    setVehicleYear(v?.year?.toString() ?? '')
    setVehicleMake(v?.make ?? '')
    setVehicleModel(v?.model ?? '')
    setVehicleVin(v?.vin ?? '')
    setVehicleInsCost(v?.weekly_insurance_cost?.toString() ?? '')
    setVehicleRegCost(v?.weekly_registration_cost?.toString() ?? '')
    setVehicleFormOpen(true)
  }

  function closeVehicleForm() {
    setVehicleFormOpen(false)
    setEditingVehicle(null)
    setVehicleYear('')
    setVehicleMake('')
    setVehicleModel('')
    setVehicleVin('')
    setVehicleInsCost('')
    setVehicleRegCost('')
  }

  async function upsertVehicle() {
    const year = parseInt(vehicleYear, 10)
    if (isNaN(year) || year < 1900 || year > 2100) {
      setVehiclesError('Year must be 1900–2100')
      return
    }
    const ins = parseFloat(vehicleInsCost) || 0
    const reg = parseFloat(vehicleRegCost) || 0
    if (editingVehicle) {
      const { error: err } = await supabase.from('vehicles').update({ year, make: vehicleMake.trim(), model: vehicleModel.trim(), vin: vehicleVin.trim() || null, weekly_insurance_cost: ins, weekly_registration_cost: reg, updated_at: new Date().toISOString() }).eq('id', editingVehicle.id)
      if (err) setVehiclesError(err.message)
      else {
        closeVehicleForm()
        loadVehicles()
      }
    } else {
      const { error: err } = await supabase.from('vehicles').insert({ year, make: vehicleMake.trim(), model: vehicleModel.trim(), vin: vehicleVin.trim() || null, weekly_insurance_cost: ins, weekly_registration_cost: reg })
      if (err) setVehiclesError(err.message)
      else {
        closeVehicleForm()
        loadVehicles()
      }
    }
  }

  async function deleteVehicle(v: Vehicle) {
    if (!window.confirm(`Delete ${v.year} ${v.make} ${v.model}?`)) return
    const { error: err } = await supabase.from('vehicles').delete().eq('id', v.id)
    if (err) setVehiclesError(err.message)
    else {
      setSelectedVehicleId((prev) => (prev === v.id ? null : prev))
      loadVehicles()
    }
  }

  async function insertOdometerEntry() {
    if (!selectedVehicleId) return
    const val = parseFloat(odometerValue)
    if (isNaN(val) || val < 0) {
      setVehiclesError('Odometer value must be a non-negative number')
      return
    }
    const { error: err } = await supabase.from('vehicle_odometer_entries').insert({ vehicle_id: selectedVehicleId, odometer_value: val, read_date: odometerDate })
    if (err) setVehiclesError(err.message)
    else {
      setOdometerFormOpen(false)
      setOdometerDate(new Date().toISOString().slice(0, 10))
      setOdometerValue('')
      loadOdometerEntries(selectedVehicleId)
    }
  }

  async function deleteOdometerEntry(entry: VehicleOdometerEntry) {
    const { error: err } = await supabase.from('vehicle_odometer_entries').delete().eq('id', entry.id)
    if (err) setVehiclesError(err.message)
    else if (selectedVehicleId) loadOdometerEntries(selectedVehicleId)
  }

  async function insertReplacementValueEntry() {
    if (!selectedVehicleId) return
    const val = parseFloat(replacementValueValue)
    if (isNaN(val) || val < 0) {
      setVehiclesError('Replacement value must be a non-negative number')
      return
    }
    const { error: err } = await supabase.from('vehicle_replacement_value_entries').insert({ vehicle_id: selectedVehicleId, replacement_value: val, read_date: replacementValueDate })
    if (err) setVehiclesError(err.message)
    else {
      setReplacementValueFormOpen(false)
      setReplacementValueDate(new Date().toISOString().slice(0, 10))
      setReplacementValueValue('')
      loadReplacementValueEntries(selectedVehicleId)
    }
  }

  async function deleteReplacementValueEntry(entry: VehicleReplacementValueEntry) {
    const { error: err } = await supabase.from('vehicle_replacement_value_entries').delete().eq('id', entry.id)
    if (err) setVehiclesError(err.message)
    else if (selectedVehicleId) loadReplacementValueEntries(selectedVehicleId)
  }

  async function upsertPossession() {
    if (!selectedVehicleId || !possessionUserId) {
      setVehiclesError('Select a user')
      return
    }
    const { error: err } = await supabase.from('vehicle_possessions').insert({ vehicle_id: selectedVehicleId, user_id: possessionUserId, start_date: possessionStartDate, end_date: possessionEndDate.trim() || null })
    if (err) setVehiclesError(err.message)
    else {
      setPossessionFormOpen(false)
      setPossessionUserId('')
      setPossessionStartDate(new Date().toISOString().slice(0, 10))
      setPossessionEndDate('')
      loadPossessions(selectedVehicleId)
      loadVehicles()
    }
  }

  async function deletePossession(p: VehiclePossession) {
    const { error: err } = await supabase.from('vehicle_possessions').delete().eq('id', p.id)
    if (err) setVehiclesError(err.message)
    else {
      if (selectedVehicleId) loadPossessions(selectedVehicleId)
      loadVehicles()
    }
  }

  async function loadOffsets() {
    setOffsetsLoading(true)
    setOffsetsError(null)
    const { data, error } = await supabase.from('person_offsets').select('*').order('occurred_date', { ascending: false })
    setOffsetsLoading(false)
    if (error) setOffsetsError(error.message)
    else setOffsets((data ?? []) as PersonOffset[])
  }

  function openOffsetForm(o?: PersonOffset) {
    setEditingOffset(o ?? null)
    setOffsetPersonName(o?.person_name ?? '')
    setOffsetType((o?.type as 'backcharge' | 'damage') ?? 'backcharge')
    setOffsetAmount(o?.amount?.toString() ?? '')
    setOffsetDescription(o?.description ?? '')
    setOffsetOccurredDate(o?.occurred_date ?? new Date().toISOString().slice(0, 10))
    setOffsetFormOpen(true)
  }

  function closeOffsetForm() {
    setOffsetFormOpen(false)
    setEditingOffset(null)
    setOffsetPersonName('')
    setOffsetType('backcharge')
    setOffsetAmount('')
    setOffsetDescription('')
    setOffsetOccurredDate(new Date().toISOString().slice(0, 10))
  }

  async function upsertOffset() {
    const amt = parseFloat(offsetAmount)
    if (isNaN(amt) || amt <= 0) {
      setOffsetsError('Amount must be a positive number')
      return
    }
    if (!offsetPersonName.trim()) {
      setOffsetsError('Select a person')
      return
    }
    if (editingOffset) {
      const { error: err } = await supabase.from('person_offsets').update({ person_name: offsetPersonName.trim(), type: offsetType, amount: amt, description: offsetDescription.trim() || null, occurred_date: offsetOccurredDate }).eq('id', editingOffset.id)
      if (err) setOffsetsError(err.message)
      else {
        closeOffsetForm()
        loadOffsets()
      }
    } else {
      const { error: err } = await supabase.from('person_offsets').insert({ person_name: offsetPersonName.trim(), type: offsetType, amount: amt, description: offsetDescription.trim() || null, occurred_date: offsetOccurredDate })
      if (err) setOffsetsError(err.message)
      else {
        closeOffsetForm()
        loadOffsets()
      }
    }
  }

  async function deleteOffset(o: PersonOffset) {
    if (!window.confirm(`Delete ${o.type} $${formatCurrency(o.amount)} for ${o.person_name}?`)) return
    const { error: err } = await supabase.from('person_offsets').delete().eq('id', o.id)
    if (err) setOffsetsError(err.message)
    else loadOffsets()
  }

  async function applyOffsetToPayStub() {
    if (!offsetToApply || !offsetApplyPayStubId) return
    const { error: err } = await supabase.from('person_offsets').update({ pay_stub_id: offsetApplyPayStubId }).eq('id', offsetToApply.id)
    if (err) setOffsetsError(err.message)
    else {
      setOffsetApplyModalOpen(false)
      setOffsetToApply(null)
      setOffsetApplyPayStubId('')
      loadOffsets()
    }
  }

  async function unapplyOffset(o: PersonOffset) {
    const { error: err } = await supabase.from('person_offsets').update({ pay_stub_id: null }).eq('id', o.id)
    if (err) setOffsetsError(err.message)
    else loadOffsets()
  }

  useEffect(() => {
    if (activeTab === 'team_costs' && (canAccessPay || canViewCostMatrixShared)) {
      loadCrewJobs(crewJobsDate)
    }
  }, [activeTab, crewJobsDate, canAccessPay, canViewCostMatrixShared])

  useEffect(() => {
    if (activeTab === 'vehicles' && canAccessPay) {
      loadVehicles()
    }
  }, [activeTab, canAccessPay])

  useEffect(() => {
    if (activeTab === 'offsets' && canAccessPay) {
      loadOffsets()
      loadPayStubs()
    }
  }, [activeTab, canAccessPay])

  useEffect(() => {
    if (activeTab === 'review' && isDev) {
      loadPayConfig()
    }
  }, [activeTab, isDev])

  useEffect(() => {
    if (selectedVehicleId) {
      loadOdometerEntries(selectedVehicleId)
      loadReplacementValueEntries(selectedVehicleId)
      loadPossessions(selectedVehicleId)
    } else {
      setOdometerEntries([])
      setReplacementValueEntries([])
      setPossessions([])
    }
  }, [selectedVehicleId])

  function loadCrewJobsForHoursRange() {
    const days = getDaysInRange(hoursDateStart, hoursDateEnd)
    if (days.length === 0) return
    supabase
      .from('people_crew_jobs')
      .select('work_date, person_name, crew_lead_person_name, job_assignments')
      .in('work_date', days)
      .then(({ data }) => {
        const map: Record<string, CrewJobRow> = {}
        for (const r of (data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>) {
          const key = `${r.work_date}:${r.person_name}`
          map[key] = {
            crew_lead_person_name: r.crew_lead_person_name ?? null,
            job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
          }
        }
        setCrewJobsByDatePerson(map)
      })
  }
  loadCrewJobsRef.current = loadCrewJobsForHoursRange

  useEffect(() => {
    if (activeTab !== 'hours' || !canAccessHours) return
    loadCrewJobsForHoursRange()
  }, [activeTab, hoursDateStart, hoursDateEnd, canAccessHours])

  async function saveCrewJobRow(personName: string, row: CrewJobRow) {
    if (!canAccessPay) return
    setCrewJobsData((prev) => ({ ...prev, [personName]: row }))
    const { error } = await supabase.from('people_crew_jobs').upsert(
      {
        work_date: crewJobsDate,
        person_name: personName,
        crew_lead_person_name: row.crew_lead_person_name || null,
        job_assignments: row.job_assignments,
      },
      { onConflict: 'work_date,person_name' }
    )
    if (error) setError(error.message)
    else loadTeamLaborData()
  }

  async function copyCrewFromYesterday() {
    if (!canAccessPay) return
    const d = new Date(crewJobsDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const yesterday = d.toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('people_crew_jobs')
      .select('person_name, crew_lead_person_name, job_assignments')
      .eq('work_date', yesterday)
    if (error) { setError(error.message); return }
    const rows = (data ?? []) as Array<{ person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const toCopy = rows.filter((r) => {
      const hasData = !!(r.crew_lead_person_name || (Array.isArray(r.job_assignments) && r.job_assignments.length > 0))
      return hasData && showPeopleForMatrix.includes(r.person_name)
    })
    if (toCopy.length === 0) {
      setError('No crew assignments for yesterday')
      return
    }
    setError(null)
    for (const r of toCopy) {
      const row: CrewJobRow = {
        crew_lead_person_name: r.crew_lead_person_name ?? null,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
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

  useEffect(() => {
    const jobIds = new Set<string>()
    for (const row of Object.values(crewJobsData)) {
      for (const a of row.job_assignments) jobIds.add(a.job_id)
    }
    const missing = [...jobIds].filter((id) => !crewJobDetailsMap[id])
    if (missing.length === 0) return
    supabase
      .rpc('get_jobs_ledger_by_ids', { p_job_ids: missing })
      .then(({ data }) => {
        const map: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
        for (const r of (data ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
          map[r.id] = { hcp_number: r.hcp_number ?? '', job_name: r.job_name ?? '', job_address: r.job_address ?? '' }
        }
        setCrewJobDetailsMap((prev) => ({ ...prev, ...map }))
      })
  }, [crewJobsData])

  useEffect(() => {
    const jobIds = new Set<string>()
    for (const row of Object.values(crewJobsByDatePerson)) {
      for (const a of row.job_assignments) jobIds.add(a.job_id)
    }
    const missing = [...jobIds].filter((id) => !crewJobDetailsMap[id])
    if (missing.length === 0) return
    supabase
      .rpc('get_jobs_ledger_by_ids', { p_job_ids: missing })
      .then(({ data }) => {
        const map: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
        for (const r of (data ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
          map[r.id] = { hcp_number: r.hcp_number ?? '', job_name: r.job_name ?? '', job_address: r.job_address ?? '' }
        }
        setCrewJobDetailsMap((prev) => ({ ...prev, ...map }))
      })
  }, [crewJobsByDatePerson])

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
    for (const c of configRows) {
      configMap[c.person_name] = { hourly_wage: c.hourly_wage ?? 0, is_salary: c.is_salary ?? false }
    }
    const hoursMap: Record<string, number> = {}
    for (const h of hoursRows) {
      hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
    }
    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    function getEffectiveAssignments(personName: string, workDate: string): CrewJobAssignment[] {
      const key = `${workDate}:${personName}`
      const row = crewByDatePerson[key]
      if (!row) return []
      if (row.crew_lead_person_name) {
        const leadKey = `${workDate}:${row.crew_lead_person_name}`
        const leadRow = crewByDatePerson[leadKey]
        return leadRow?.job_assignments ?? []
      }
      return row.job_assignments
    }
    const jobAgg: Record<string, { people: Set<string>; hoursByPerson: Record<string, number>; costByPerson: Record<string, number> }> = {}
    for (const r of crewRows) {
      const assignments = getEffectiveAssignments(r.person_name, r.work_date)
      const cfg = configMap[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        if (!jobAgg[a.job_id]) jobAgg[a.job_id] = { people: new Set(), hoursByPerson: {}, costByPerson: {} }
        const aggEntry = jobAgg[a.job_id]!
        aggEntry.people.add(r.person_name)
        const pctHrs = hours * (a.pct / 100)
        aggEntry.hoursByPerson[r.person_name] = (aggEntry.hoursByPerson[r.person_name] ?? 0) + pctHrs
        aggEntry.costByPerson[r.person_name] = (aggEntry.costByPerson[r.person_name] ?? 0) + pctHrs * rate
      }
    }
    const jobIds = Object.keys(jobAgg)
    if (jobIds.length === 0) {
      setTeamLaborData([])
      return
    }
    const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds })
    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
    for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
    }
    const rows = jobIds.map((jobId) => {
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

  useEffect(() => {
    if (activeTab === 'team_costs' && (canAccessPay || canViewCostMatrixShared)) {
      loadTeamLaborData()
    }
  }, [activeTab, canAccessPay, canViewCostMatrixShared])

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

  function upsertPayConfig(personName: string, row: Partial<PayConfigRow>) {
    if (!canAccessPay) return
    const cur = payConfig[personName] ?? { person_name: personName, hourly_wage: null, is_salary: false, show_in_hours: false, show_in_cost_matrix: false, record_hours_but_salary: false }
    const full = { person_name: personName, hourly_wage: row.hourly_wage ?? cur.hourly_wage, is_salary: row.is_salary ?? cur.is_salary, show_in_hours: row.show_in_hours ?? cur.show_in_hours, show_in_cost_matrix: row.show_in_cost_matrix ?? cur.show_in_cost_matrix, record_hours_but_salary: row.record_hours_but_salary ?? cur.record_hours_but_salary }
    setPayConfig((prev) => ({ ...prev, [personName]: full }))
    const prevTimeout = payConfigDebounceRef.current[personName]
    if (prevTimeout) clearTimeout(prevTimeout)
    payConfigDebounceRef.current[personName] = setTimeout(async () => {
      delete payConfigDebounceRef.current[personName]
      setPayConfigSaving(true)
      const toSave = payConfigRef.current[personName] ?? full
      const { error } = await supabase.from('people_pay_config').upsert(toSave, { onConflict: 'person_name' })
      if (error) setError(error.message)
      setPayConfigSaving(false)
    }, 2000)
  }

  function updatePayConfigHourlyWage(personName: string, rawValue: string) {
    if (!canAccessPay) return
    setPayConfigDraft((prev) => ({ ...prev, [personName]: rawValue }))
    const cur = payConfig[personName] ?? { person_name: personName, hourly_wage: null, is_salary: false, show_in_hours: false, show_in_cost_matrix: false, record_hours_but_salary: false }
    const parsed = rawValue === '' ? null : parseFloat(rawValue) || null
    const full = { ...cur, hourly_wage: parsed }
    setPayConfig((prev) => ({ ...prev, [personName]: full }))
    const prevTimeout = payConfigDebounceRef.current[personName]
    if (prevTimeout) clearTimeout(prevTimeout)
    payConfigDebounceRef.current[personName] = setTimeout(async () => {
      delete payConfigDebounceRef.current[personName]
      setPayConfigSaving(true)
      const draftVal = payConfigDraftRef.current[personName]
      const finalWage = draftVal !== undefined ? (draftVal === '' ? null : parseFloat(draftVal) || null) : (payConfigRef.current[personName]?.hourly_wage ?? null)
      const toSave = { ...(payConfigRef.current[personName] ?? full), hourly_wage: finalWage }
      const { error } = await supabase.from('people_pay_config').upsert(toSave, { onConflict: 'person_name' })
      if (error) setError(error.message)
      else setPayConfigDraft((prev) => { const next = { ...prev }; delete next[personName]; return next })
      setPayConfigSaving(false)
    }, 2000)
  }

  async function saveHours(personName: string, workDate: string, hours: number) {
    if (!canAccessHours && !canAccessPay) return
    if (hoursDaysCorrect.has(workDate)) return
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

  function canEditHours(personName: string): boolean {
    const cfg = payConfig[personName]
    return !(cfg?.is_salary ?? false) || (cfg?.record_hours_but_salary ?? false)
  }

  function getDisplayHours(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    if (cfg?.is_salary && !(cfg?.record_hours_but_salary ?? false)) return getEffectiveHours(personName, workDate)
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

  function textColorForBackground(hex: string): string {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (!m) return '#374151'
    const r = parseInt(m[1] ?? '00', 16) / 255
    const g = parseInt(m[2] ?? '00', 16) / 255
    const b = parseInt(m[3] ?? '00', 16) / 255
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return luminance < 0.5 ? '#ffffff' : '#374151'
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
    // "8.5" (one digit after dot) = 8.5 decimal hours. "8.30" (two digits, ≤59) = 8:30.
    if (!trimmed.includes(':') && /^\d+\.(\d+)$/.test(trimmed)) {
      const m = trimmed.match(/^\d+\.(\d+)$/)!
      const frac = m[1]!
      if (frac.length === 1) return parseFloat(trimmed) // 8.5 → 8.5 hrs
      if (parseInt(frac, 10) > 59) return parseFloat(trimmed) // 8.75 → 8.75 hrs
    }
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
  const showPeopleForMatrixBase = Object.keys(payConfig)
    .filter((n) => payConfig[n]?.show_in_cost_matrix ?? false)
    .sort((a, b) => {
      const orderA = hoursDisplayOrder[a] ?? 999999
      const orderB = hoursDisplayOrder[b] ?? 999999
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
    })

  const showPeopleForMatrix =
    matrixSortBy === 'cost'
      ? [...showPeopleForMatrixBase].sort((a, b) => {
          const days = getDaysInRange(matrixStartDate, matrixEndDate)
          const totalA = days.reduce((s, d) => s + getCostForPersonDateMatrix(a, d), 0)
          const totalB = days.reduce((s, d) => s + getCostForPersonDateMatrix(b, d), 0)
          return totalB - totalA
        })
      : matrixSortBy === 'tag'
        ? [...showPeopleForMatrixBase].sort((a, b) => {
            const tagsA = (costMatrixTags[a] ?? '').split(',').map((t) => t.trim()).filter(Boolean)
            const tagsB = (costMatrixTags[b] ?? '').split(',').map((t) => t.trim()).filter(Boolean)
            const firstA = tagsA[0] ?? 'zzz'
            const firstB = tagsB[0] ?? 'zzz'
            return firstA.localeCompare(firstB) || a.localeCompare(b)
          })
        : [...showPeopleForMatrixBase].sort((a, b) => a.localeCompare(b))

  const showPeopleForReview = useMemo(() => [...Object.keys(payConfig)].sort((a, b) => a.localeCompare(b)), [payConfig])

  function getReviewDateRange(): [string, string] {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    if (reviewPeriod === 'today') return [todayStr, todayStr]
    if (reviewPeriod === 'yesterday') {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      const y = d.toISOString().slice(0, 10)
      return [y, y]
    }
    // Current week's Sunday (start of this week)
    const day = today.getDay()
    const thisWeekSunday = new Date(today)
    thisWeekSunday.setDate(today.getDate() - day)
    if (reviewPeriod === 'last_week') {
      const lastWeekSunday = new Date(thisWeekSunday)
      lastWeekSunday.setDate(thisWeekSunday.getDate() - 7)
      const lastWeekSaturday = new Date(lastWeekSunday)
      lastWeekSaturday.setDate(lastWeekSunday.getDate() + 6)
      return [lastWeekSunday.toISOString().slice(0, 10), lastWeekSaturday.toISOString().slice(0, 10)]
    }
    if (reviewPeriod === 'last_month') {
      const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastOfLastMonth = new Date(firstOfThisMonth)
      lastOfLastMonth.setDate(0)
      const firstOfLastMonth = new Date(lastOfLastMonth.getFullYear(), lastOfLastMonth.getMonth(), 1)
      return [firstOfLastMonth.toISOString().slice(0, 10), lastOfLastMonth.toISOString().slice(0, 10)]
    }
    // last_two_weeks
    const twoWeeksAgoSunday = new Date(thisWeekSunday)
    twoWeeksAgoSunday.setDate(thisWeekSunday.getDate() - 14)
    const lastWeekSaturday = new Date(thisWeekSunday)
    lastWeekSaturday.setDate(thisWeekSunday.getDate() - 1)
    return [twoWeeksAgoSunday.toISOString().slice(0, 10), lastWeekSaturday.toISOString().slice(0, 10)]
  }

  function stripAddressZipState(addr: string): string {
    return (addr ?? '').replace(/\s*,\s*[A-Z]{2}\s+\d{5}(-\d{4})?\s*$/i, '').trim()
  }

  function formatDateWithDay(dateStr: string | null): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr + 'T12:00:00')
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const day = dayNames[d.getDay()]
    const month = d.getMonth() + 1
    const dayNum = d.getDate()
    return `${day} ${month}/${dayNum}`
  }

  function getReviewPeriodPay(personName: string): number {
    const [start, end] = getReviewDateRange()
    const days = getDaysInRange(start, end)
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    if (!wage) return 0
    return days.reduce((sum, d) => sum + getPayForPersonDate(personName, d), 0)
  }

  function getPayForPersonDate(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    if (!wage) return 0
    const dayOfWeek = new Date(workDate + 'T12:00:00').getDay()
    const hrs = cfg?.is_salary
      ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
      : (reviewHours.find((h) => h.work_date === workDate)?.hours ?? 0)
    return hrs * wage
  }

  async function loadReviewData(personName: string) {
    const [start, end] = getReviewDateRange()
    setReviewLoading(true)
    setReviewLaborJobs([])
    setReviewCrewJobs([])
    setReviewAllocatedRevenue(0)
    setReviewAllocatedProfit(0)
    setReviewHours([])
    setReviewReports([])
    setReviewTasks([])

    const userId = users.find((u) => u.name === personName)?.id ?? null

    const [laborRes, allLaborResForCost, crewRes, hoursRes, reportsRes, tasksRes, settingsRes, tallyRes, allHoursRes] = await Promise.all([
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').eq('assigned_to_name', personName).gte('job_date', start).lte('job_date', end),
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').gte('job_date', start).lte('job_date', end),
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
      supabase.rpc('list_reports_with_job_info'),
      userId
        ? supabase
            .from('checklist_instances')
            .select('id, checklist_item_id, scheduled_date, completed_at, checklist_items(title)')
            .eq('assigned_to_user_id', userId)
            .not('completed_at', 'is', null)
            .gte('completed_at', start + 'T00:00:00')
            .lte('completed_at', end + 'T23:59:59')
        : Promise.resolve({ data: [] }),
      supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
      supabase.rpc('list_tally_parts_with_po'),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end),
    ])

    const laborRows = (laborRes.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null }>
    const allLaborRowsForCost = (allLaborResForCost.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null }>
    const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const hoursRows = (hoursRes.data ?? []) as Array<{ work_date: string; hours: number }>
    const allReports = (reportsRes.data ?? []) as Array<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string }>
    const taskInstances = (tasksRes.data ?? []) as Array<{ id: string; checklist_item_id: string; scheduled_date: string; completed_at: string | null; checklist_items: { title: string } | null }>
    const settingsRows = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
    const tallyParts = (tallyRes.data ?? []) as Array<{ job_id: string; price_at_time: number | null; quantity: number }>
    const allHoursRows = (allHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>

    const mileageCost = settingsRows.find((r) => r.key === 'drive_mileage_cost')?.value_num ?? 0.70
    const timePerMile = settingsRows.find((r) => r.key === 'drive_time_per_mile')?.value_num ?? 0.02

    const partsCostByJobId = new Map<string, number>()
    for (const r of tallyParts) {
      const cost = Number(r.price_at_time ?? 0) * Number(r.quantity)
      partsCostByJobId.set(r.job_id, (partsCostByJobId.get(r.job_id) ?? 0) + cost)
    }

    const hoursMap: Record<string, number> = {}
    for (const h of allHoursRows) {
      hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
    }

    const allLaborJobIdsForCost = allLaborRowsForCost.map((r) => r.id)
    const laborItemsRes =
      allLaborJobIdsForCost.length > 0
        ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', allLaborJobIdsForCost)
        : { data: [] }
    const laborItems = (laborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const itemsByJob = new Map<string, typeof laborItems>()
    for (const i of laborItems) {
      const list = itemsByJob.get(i.job_id) ?? []
      list.push(i)
      itemsByJob.set(i.job_id, list)
    }

    const laborCostByHcp = new Map<string, number>()
    for (const r of allLaborRowsForCost) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const items = itemsByJob.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      laborCostByHcp.set(hcp, (laborCostByHcp.get(hcp) ?? 0) + laborCost)
    }

    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewMembersByDateAndLead = new Map<string, string[]>()
    for (const r of crewRows) {
      if (!r.crew_lead_person_name) continue
      const key = `${r.work_date}:${r.crew_lead_person_name}`
      const list = crewMembersByDateAndLead.get(key) ?? []
      if (!list.includes(r.person_name)) list.push(r.person_name)
      crewMembersByDateAndLead.set(key, list)
    }
    const crewJobIds = new Set<string>()
    const crewJobsWithLead: Array<{ work_date: string; job_id: string; viaLead: string | null; pct: number }> = []
    for (const r of crewRows) {
      if (r.person_name !== personName) continue
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
      for (const a of assignments) {
        crewJobIds.add(a.job_id)
        crewJobsWithLead.push({ work_date: r.work_date, job_id: a.job_id, viaLead: row?.crew_lead_person_name ?? null, pct: a.pct })
      }
    }

    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of crewRows) {
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        const cost = pctHrs * rate
        teamLaborCostByJobId.set(a.job_id, (teamLaborCostByJobId.get(a.job_id) ?? 0) + cost)
      }
    }

    const allJobIds = [...crewJobIds]
    const laborHcps = [...new Set(laborRows.filter((r) => (r.job_number ?? '').trim()).map((r) => (r.job_number ?? '').trim().toLowerCase()))]
    const [crewJobsRes, laborJobsRes] = await Promise.all([
      allJobIds.length > 0 ? supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, revenue').in('id', allJobIds) : { data: [] },
      laborHcps.length > 0 ? supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, revenue').in('hcp_number', laborHcps) : { data: [] },
    ])
    const crewJobsLedger = (crewJobsRes.data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string; revenue: number | null }>
    const laborJobsLedger = (laborJobsRes.data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string; revenue: number | null }>
    const jobsById = new Map<string, (typeof crewJobsLedger)[0]>()
    const jobIdByHcp = new Map<string, string>()
    for (const j of crewJobsLedger) {
      jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }
    for (const j of laborJobsLedger) {
      if (!jobsById.has(j.id)) jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }

    const laborJobs: ReviewLaborJob[] = laborRows.map((r) => {
      const items = itemsByJob.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const hoursInfo = items.length > 0 ? `${totalHrs.toFixed(2)} (${items.length} items)` : '—'
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? jobIdByHcp.get(hcp) ?? null : null
      const job = jobId ? jobsById.get(jobId) : null
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      const partsCost = jobId ? (partsCostByJobId.get(jobId) ?? 0) : 0
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const totalJobLabor = (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) + (jobId ? (teamLaborCostByJobId.get(jobId) ?? 0) : 0)
      const revenueBeforeOverhead = totalBill - partsCost - totalJobLabor
      return {
        source: 'labor',
        id: r.id,
        job_date: r.job_date,
        address: r.address ?? '',
        hoursInfo,
        hours: totalHrs,
        job_number: r.job_number,
        job_id: jobId,
        job_name: job?.job_name ?? '—',
        laborCost,
        partsCost,
        totalBill,
        revenueBeforeOverhead,
        allocatedTotalBill: 0,
        allocatedRevenueBeforeOverhead: 0,
        allocatedPartsCost: 0,
        subLaborCost: Math.max(0, (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) - laborCost),
        otherTeammatesLabor: jobId ? (teamLaborCostByJobId.get(jobId) ?? 0) : 0,
        totalJobHours: 0,
        userTotalHoursOnJob: 0,
        userTotalContributionToBill: 0,
        userTotalContributionToRevenue: 0,
        userTotalLaborOnJob: 0,
      }
    })

    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string; revenue: number | null }> = {}
    for (const j of crewJobsLedger) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '', revenue: j.revenue }
    }
    const cfg = personName ? payConfig[personName] : undefined
    const crewJobs: ReviewCrewJob[] = crewJobsWithLead.map((c) => {
      const j = jobsMap[c.job_id] ?? jobsById.get(c.job_id)
      const day = new Date(c.work_date + 'T12:00:00').getDay()
      const dayHours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${personName}:${c.work_date}`] ?? 0)
      const hours = dayHours * (c.pct / 100)
      const laborCost = hours * (cfg?.hourly_wage ?? 0)
      const partsCost = partsCostByJobId.get(c.job_id) ?? 0
      const totalBill = j?.revenue != null ? Number(j.revenue) : 0
      const hcp = (j?.hcp_number ?? '').trim().toLowerCase()
      const totalJobLabor = (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) + (teamLaborCostByJobId.get(c.job_id) ?? 0)
      const revenueBeforeOverhead = totalBill - partsCost - totalJobLabor
      return {
        source: 'crew',
        job_id: c.job_id,
        work_date: c.work_date,
        hcp_number: j?.hcp_number ?? '—',
        job_name: j?.job_name ?? '—',
        job_address: j?.job_address ?? '—',
        viaLead: c.viaLead,
        crewMemberNames: c.viaLead === null ? (crewMembersByDateAndLead.get(`${c.work_date}:${personName}`) ?? []) : undefined,
        hours,
        laborCost,
        partsCost,
        totalBill,
        revenueBeforeOverhead,
        allocatedTotalBill: 0,
        allocatedRevenueBeforeOverhead: 0,
        allocatedPartsCost: 0,
        subLaborCost: hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0,
        otherTeammatesLabor: Math.max(0, (teamLaborCostByJobId.get(c.job_id) ?? 0) - laborCost),
        totalJobHours: 0,
        userTotalHoursOnJob: 0,
        userTotalContributionToBill: 0,
        userTotalContributionToRevenue: 0,
        userTotalLaborOnJob: 0,
      }
    })

    const startDate = new Date(start + 'T00:00:00').getTime()
    const endDate = new Date(end + 'T23:59:59').getTime()
    const reports = allReports.filter((r) => r.created_by_name === personName && new Date(r.created_at).getTime() >= startDate && new Date(r.created_at).getTime() <= endDate)

    const tasks: ReviewTask[] = taskInstances.map((t) => ({
      id: t.id,
      title: (t.checklist_items as { title: string } | null)?.title ?? 'Untitled',
      scheduled_date: t.scheduled_date,
      completed_at: t.completed_at,
    }))

    const hoursOnJobInPeriod = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.job_id) hoursOnJobInPeriod.set(j.job_id, (hoursOnJobInPeriod.get(j.job_id) ?? 0) + j.hours)
    }
    for (const j of crewJobs) {
      hoursOnJobInPeriod.set(j.job_id, (hoursOnJobInPeriod.get(j.job_id) ?? 0) + j.hours)
    }

    const lookbackStart = (() => {
      const d = new Date(start + 'T12:00:00')
      d.setFullYear(d.getFullYear() - 5)
      return d.toISOString().slice(0, 10)
    })()
    const lookbackEnd = (() => {
      const d = new Date(end + 'T12:00:00')
      d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().slice(0, 10)
    })()

    const [allLaborRes, allCrewRes, allHoursRes2] = await Promise.all([
      (laborHcps.length > 0 || crewJobIds.size > 0) ? supabase.from('people_labor_jobs').select('id, job_number, job_date').gte('job_date', lookbackStart).lte('job_date', lookbackEnd) : { data: [] },
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', lookbackStart).lte('work_date', lookbackEnd),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart).lte('work_date', lookbackEnd),
    ])
    const allLaborRows = (allLaborRes.data ?? []) as Array<{ id: string; job_number: string | null; job_date: string | null }>
    const allCrewRows = (allCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const allHoursRows2 = (allHoursRes2.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const hoursMapAll: Record<string, number> = {}
    for (const h of allHoursRows2) {
      hoursMapAll[`${h.person_name}:${h.work_date}`] = h.hours
    }

    const allLaborJobIds = allLaborRows.map((r) => r.id)
    const allLaborItemsRes =
      allLaborJobIds.length > 0
        ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', allLaborJobIds)
        : { data: [] }
    const allLaborItems = (allLaborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const itemsByLaborJobId = new Map<string, typeof allLaborItems>()
    for (const i of allLaborItems) {
      const list = itemsByLaborJobId.get(i.job_id) ?? []
      list.push(i)
      itemsByLaborJobId.set(i.job_id, list)
    }

    const allHcpSet = new Set([
      ...laborHcps,
      ...Array.from(jobsById.values())
        .map((j) => (j.hcp_number ?? '').trim().toLowerCase())
        .filter(Boolean),
    ])
    const totalHoursOnJob = new Map<string, number>()
    const totalHoursOnJobInPeriod = new Map<string, number>()
    const laborHcpSet = new Set(laborHcps)
    for (const r of allLaborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp || !allHcpSet.has(hcp)) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByLaborJobId.get(r.id) ?? []
      const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      totalHoursOnJob.set(jobId, (totalHoursOnJob.get(jobId) ?? 0) + hrs)
      if (r.job_date && r.job_date >= start && r.job_date <= end && laborHcpSet.has(hcp)) {
        totalHoursOnJobInPeriod.set(jobId, (totalHoursOnJobInPeriod.get(jobId) ?? 0) + hrs)
      }
    }
    const allCrewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of allCrewRows) {
      allCrewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const allJobIdsForCrew = [...new Set([...crewJobIds, ...Array.from(jobIdByHcp.values())])]
    const jobIdsSet = new Set(allJobIdsForCrew)
    for (const r of allCrewRows) {
      const row = allCrewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (allCrewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAll[`${r.person_name}:${r.work_date}`] ?? 0)
      for (const a of assignments) {
        if (!jobIdsSet.has(a.job_id)) continue
        const pctHrs = hours * (a.pct / 100)
        totalHoursOnJob.set(a.job_id, (totalHoursOnJob.get(a.job_id) ?? 0) + pctHrs)
        if (r.work_date >= start && r.work_date <= end) {
          totalHoursOnJobInPeriod.set(a.job_id, (totalHoursOnJobInPeriod.get(a.job_id) ?? 0) + pctHrs)
        }
      }
    }

    const allocationJobsMap = new Map<string, { totalBill: number; revenueBeforeOverhead: number }>()
    const laborJobIdsSeen = new Set<string>()
    for (const r of laborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? jobIdByHcp.get(hcp) ?? null : null
      if (!jobId || laborJobIdsSeen.has(jobId)) continue
      laborJobIdsSeen.add(jobId)
      const job = jobsById.get(jobId)
      const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const teamLaborCost = teamLaborCostByJobId.get(jobId) ?? 0
      const laborCost = subLaborCost + teamLaborCost
      const partsCost = partsCostByJobId.get(jobId) ?? 0
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const revenueBeforeOverhead = totalBill - partsCost - laborCost
      allocationJobsMap.set(jobId, { totalBill, revenueBeforeOverhead })
    }
    for (const jobId of crewJobIds) {
      if (allocationJobsMap.has(jobId)) continue
      const j = jobsById.get(jobId)
      const laborCost = teamLaborCostByJobId.get(jobId) ?? 0
      const partsCost = partsCostByJobId.get(jobId) ?? 0
      const totalBill = j?.revenue != null ? Number(j.revenue) : 0
      const revenueBeforeOverhead = totalBill - partsCost - laborCost
      allocationJobsMap.set(jobId, { totalBill, revenueBeforeOverhead })
    }

    const costOnJobInPeriod = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.job_id) costOnJobInPeriod.set(j.job_id, (costOnJobInPeriod.get(j.job_id) ?? 0) + j.laborCost)
    }
    for (const j of crewJobs) {
      costOnJobInPeriod.set(j.job_id, (costOnJobInPeriod.get(j.job_id) ?? 0) + j.laborCost)
    }

    const personLaborFromLaborJobsByJobId = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.job_id) personLaborFromLaborJobsByJobId.set(j.job_id, (personLaborFromLaborJobsByJobId.get(j.job_id) ?? 0) + j.laborCost)
    }
    const allocationLaborByJobId = new Map<string, number>()
    for (const [jobId, teamCost] of teamLaborCostByJobId) {
      allocationLaborByJobId.set(jobId, (personLaborFromLaborJobsByJobId.get(jobId) ?? 0) + teamCost)
    }
    for (const jobId of personLaborFromLaborJobsByJobId.keys()) {
      if (!allocationLaborByJobId.has(jobId)) allocationLaborByJobId.set(jobId, personLaborFromLaborJobsByJobId.get(jobId) ?? 0)
    }

    let allocatedRevenue = 0
    let allocatedProfit = 0
    for (const [jobId, { totalBill, revenueBeforeOverhead }] of allocationJobsMap) {
      const allocationLabor = allocationLaborByJobId.get(jobId) ?? 0
      const costInPeriod = costOnJobInPeriod.get(jobId) ?? 0
      const ratio = allocationLabor > 0 ? costInPeriod / allocationLabor : (costInPeriod > 0 ? 1 : 0)
      allocatedRevenue += totalBill * ratio
      allocatedProfit += revenueBeforeOverhead * ratio
    }

    for (const j of laborJobs) {
      const totalHrs = j.job_id ? ((totalHoursOnJobInPeriod.get(j.job_id) ?? 0) || (totalHoursOnJob.get(j.job_id) ?? 0)) : 0
      j.totalJobHours = totalHrs
      j.userTotalHoursOnJob = j.job_id ? (hoursOnJobInPeriod.get(j.job_id) ?? 0) : 0
      j.userTotalContributionToBill = totalHrs > 0 ? j.totalBill * (j.userTotalHoursOnJob / totalHrs) : (j.userTotalHoursOnJob > 0 ? j.totalBill : 0)
      j.userTotalLaborOnJob = j.job_id ? (costOnJobInPeriod.get(j.job_id) ?? 0) : 0
      const hoursRatio = totalHrs > 0 ? j.hours / totalHrs : (j.hours > 0 ? 1 : 0)
      const allocationLabor = j.job_id ? (allocationLaborByJobId.get(j.job_id) ?? 0) : 0
      const costRatio = allocationLabor > 0 ? j.laborCost / allocationLabor : (j.laborCost > 0 ? 1 : 0)
      const revenueCostRatio = allocationLabor > 0 ? j.userTotalLaborOnJob / allocationLabor : (j.userTotalLaborOnJob > 0 ? 1 : 0)
      j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
      j.allocatedTotalBill = j.totalBill * hoursRatio
      j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
      j.allocatedPartsCost = j.partsCost * costRatio
    }
    for (const j of crewJobs) {
      const totalHrs = (totalHoursOnJobInPeriod.get(j.job_id) ?? 0) || (totalHoursOnJob.get(j.job_id) ?? 0)
      j.totalJobHours = totalHrs
      j.userTotalHoursOnJob = hoursOnJobInPeriod.get(j.job_id) ?? 0
      j.userTotalContributionToBill = totalHrs > 0 ? j.totalBill * (j.userTotalHoursOnJob / totalHrs) : (j.userTotalHoursOnJob > 0 ? j.totalBill : 0)
      j.userTotalLaborOnJob = costOnJobInPeriod.get(j.job_id) ?? 0
      const hoursRatio = totalHrs > 0 ? j.hours / totalHrs : (j.hours > 0 ? 1 : 0)
      const allocationLabor = allocationLaborByJobId.get(j.job_id) ?? 0
      const costRatio = allocationLabor > 0 ? j.laborCost / allocationLabor : (j.laborCost > 0 ? 1 : 0)
      const revenueCostRatio = allocationLabor > 0 ? j.userTotalLaborOnJob / allocationLabor : (j.userTotalLaborOnJob > 0 ? 1 : 0)
      j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
      j.allocatedTotalBill = j.totalBill * hoursRatio
      j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
      j.allocatedPartsCost = j.partsCost * costRatio
    }

    setReviewLaborJobs(laborJobs)
    setReviewCrewJobs(crewJobs)
    setReviewAllocatedRevenue(allocatedRevenue)
    setReviewAllocatedProfit(allocatedProfit)
    setReviewHours(hoursRows.map((r) => ({ work_date: r.work_date, hours: r.hours })))
    setReviewReports(reports.map((r) => ({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at })))
    setReviewTasks(tasks)
    setReviewLoading(false)
  }

  async function loadTeamSummaryData(opt?: { excludeJob000Office?: boolean }) {
    const excludeJob000 = opt?.excludeJob000Office ?? teamSummaryExcludeJob000Office
    const [start, end] = getReviewDateRange()
    setTeamSummaryLoading(true)
    setTeamSummaryData(null)

    const [laborRes, crewRes, settingsRes, tallyRes, allHoursRes] = await Promise.all([
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').gte('job_date', start).lte('job_date', end),
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
      supabase.rpc('list_tally_parts_with_po'),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end),
    ])

    const laborRows = (laborRes.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null }>
    const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const settingsRows = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
    const tallyParts = (tallyRes.data ?? []) as Array<{ job_id: string; price_at_time: number | null; quantity: number }>
    const allHoursRows = (allHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>

    const mileageCost = settingsRows.find((r) => r.key === 'drive_mileage_cost')?.value_num ?? 0.70
    const timePerMile = settingsRows.find((r) => r.key === 'drive_time_per_mile')?.value_num ?? 0.02

    const hoursMap: Record<string, number> = {}
    for (const h of allHoursRows) {
      hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
    }

    const partsCostByJobId = new Map<string, number>()
    for (const r of tallyParts) {
      const cost = Number(r.price_at_time ?? 0) * Number(r.quantity)
      partsCostByJobId.set(r.job_id, (partsCostByJobId.get(r.job_id) ?? 0) + cost)
    }

    const laborJobIds = laborRows.map((r) => r.id)
    const laborItemsRes =
      laborJobIds.length > 0
        ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', laborJobIds)
        : { data: [] }
    const laborItems = (laborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const itemsByJob = new Map<string, typeof laborItems>()
    for (const i of laborItems) {
      const list = itemsByJob.get(i.job_id) ?? []
      list.push(i)
      itemsByJob.set(i.job_id, list)
    }

    const laborCostByHcp = new Map<string, number>()
    for (const r of laborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const items = itemsByJob.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      laborCostByHcp.set(hcp, (laborCostByHcp.get(hcp) ?? 0) + laborCost)
    }

    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }

    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of crewRows) {
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        const cost = pctHrs * rate
        teamLaborCostByJobId.set(a.job_id, (teamLaborCostByJobId.get(a.job_id) ?? 0) + cost)
      }
    }

    const crewJobIds = new Set<string>()
    const crewJobKeys = new Set<string>()
    for (const r of crewRows) {
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
      for (const a of assignments) {
        crewJobIds.add(a.job_id)
        crewJobKeys.add(`${a.job_id}:${r.work_date}`)
      }
    }

    const laborHcps = [...new Set(laborRows.filter((r) => (r.job_number ?? '').trim()).map((r) => (r.job_number ?? '').trim().toLowerCase()))]
    const [crewJobsRes, laborJobsRes] = await Promise.all([
      crewJobIds.size > 0 ? supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, revenue').in('id', [...crewJobIds]) : { data: [] },
      laborHcps.length > 0 ? supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, revenue').in('hcp_number', laborHcps) : { data: [] },
    ])
    const crewJobsLedger = (crewJobsRes.data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string; revenue: number | null }>
    const laborJobsLedger = (laborJobsRes.data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string; revenue: number | null }>
    const jobsById = new Map<string, (typeof crewJobsLedger)[0]>()
    const jobIdByHcp = new Map<string, string>()
    for (const j of crewJobsLedger) {
      jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }
    for (const j of laborJobsLedger) {
      if (!jobsById.has(j.id)) jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }

    const hoursOnJobInPeriod = new Map<string, number>()
    for (const r of laborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? jobIdByHcp.get(hcp) ?? null : null
      if (!jobId) continue
      const items = itemsByJob.get(r.id) ?? []
      const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      hoursOnJobInPeriod.set(jobId, (hoursOnJobInPeriod.get(jobId) ?? 0) + hrs)
    }
    for (const r of crewRows) {
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (crewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${r.person_name}:${r.work_date}`] ?? 0)
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        hoursOnJobInPeriod.set(a.job_id, (hoursOnJobInPeriod.get(a.job_id) ?? 0) + pctHrs)
      }
    }

    const lookbackStart = (() => {
      const d = new Date(start + 'T12:00:00')
      d.setFullYear(d.getFullYear() - 5)
      return d.toISOString().slice(0, 10)
    })()
    const lookbackEnd = (() => {
      const d = new Date(end + 'T12:00:00')
      d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().slice(0, 10)
    })()

    const [allLaborRes, allCrewRes, allHoursRes2] = await Promise.all([
      (laborHcps.length > 0 || crewJobIds.size > 0) ? supabase.from('people_labor_jobs').select('id, job_number, job_date').gte('job_date', lookbackStart).lte('job_date', lookbackEnd) : { data: [] },
      supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments').gte('work_date', lookbackStart).lte('work_date', lookbackEnd),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart).lte('work_date', lookbackEnd),
    ])
    const allLaborRows = (allLaborRes.data ?? []) as Array<{ id: string; job_number: string | null; job_date: string | null }>
    const allCrewRows = (allCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }>
    const allHoursRows2 = (allHoursRes2.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const hoursMapAll: Record<string, number> = {}
    for (const h of allHoursRows2) {
      hoursMapAll[`${h.person_name}:${h.work_date}`] = h.hours
    }

    const allLaborJobIds = allLaborRows.map((r) => r.id)
    const allLaborItemsRes =
      allLaborJobIds.length > 0
        ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', allLaborJobIds)
        : { data: [] }
    const allLaborItems = (allLaborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const itemsByLaborJobId = new Map<string, typeof allLaborItems>()
    for (const i of allLaborItems) {
      const list = itemsByLaborJobId.get(i.job_id) ?? []
      list.push(i)
      itemsByLaborJobId.set(i.job_id, list)
    }

    const allHcpSet = new Set([
      ...laborHcps,
      ...Array.from(jobsById.values())
        .map((j) => (j.hcp_number ?? '').trim().toLowerCase())
        .filter(Boolean),
    ])
    const totalHoursOnJob = new Map<string, number>()
    for (const r of allLaborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp || !allHcpSet.has(hcp)) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByLaborJobId.get(r.id) ?? []
      const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      totalHoursOnJob.set(jobId, (totalHoursOnJob.get(jobId) ?? 0) + hrs)
    }
    const allCrewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of allCrewRows) {
      allCrewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        crew_lead_person_name: r.crew_lead_person_name,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const allJobIds = [...new Set([...crewJobIds, ...Array.from(jobIdByHcp.values())])]
    const jobIdsSet = new Set(allJobIds)
    for (const r of allCrewRows) {
      const row = allCrewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row
        ? (row.crew_lead_person_name ? (allCrewByDatePerson[`${r.work_date}:${row.crew_lead_person_name}`]?.job_assignments ?? []) : row.job_assignments)
        : []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAll[`${r.person_name}:${r.work_date}`] ?? 0)
      for (const a of assignments) {
        if (!jobIdsSet.has(a.job_id)) continue
        const pctHrs = hours * (a.pct / 100)
        totalHoursOnJob.set(a.job_id, (totalHoursOnJob.get(a.job_id) ?? 0) + pctHrs)
      }
    }

    let totalRevenue = 0
    let totalProfit = 0
    const jobsMap = new Map<string, { totalBill: number; revenueBeforeOverhead: number }>()
    const laborJobIdsSeen = new Set<string>()
    for (const r of laborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? jobIdByHcp.get(hcp) ?? null : null
      if (!jobId || laborJobIdsSeen.has(jobId)) continue
      laborJobIdsSeen.add(jobId)
      const job = jobsById.get(jobId)
      const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const teamLaborCost = teamLaborCostByJobId.get(jobId) ?? 0
      const laborCost = subLaborCost + teamLaborCost
      const partsCost = partsCostByJobId.get(jobId) ?? 0
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const revenueBeforeOverhead = totalBill - partsCost - laborCost
      jobsMap.set(jobId, { totalBill, revenueBeforeOverhead })
    }
    for (const jobId of crewJobIds) {
      if (jobsMap.has(jobId)) continue
      const j = jobsById.get(jobId)
      const laborCost = teamLaborCostByJobId.get(jobId) ?? 0
      const partsCost = partsCostByJobId.get(jobId) ?? 0
      const totalBill = j?.revenue != null ? Number(j.revenue) : 0
      const revenueBeforeOverhead = totalBill - partsCost - laborCost
      jobsMap.set(jobId, { totalBill, revenueBeforeOverhead })
    }

    for (const [jobId, { totalBill, revenueBeforeOverhead }] of jobsMap) {
      if (excludeJob000) {
        const job = jobsById.get(jobId)
        const hcp = (job?.hcp_number ?? '').trim().toLowerCase()
        if (hcp === '000') continue
      }
      const hrsInPeriod = hoursOnJobInPeriod.get(jobId) ?? 0
      const totalHrs = totalHoursOnJob.get(jobId) ?? 0
      const ratio = totalHrs > 0 ? hrsInPeriod / totalHrs : (hrsInPeriod > 0 ? 1 : 0)
      totalRevenue += totalBill * ratio
      totalProfit += revenueBeforeOverhead * ratio
    }

    const days = getDaysInRange(start, end)
    let totalHours = 0
    for (const personName of showPeopleForReview) {
      const cfg = payConfig[personName]
      if (!cfg) continue
      for (const d of days) {
        const dayOfWeek = new Date(d + 'T12:00:00').getDay()
        totalHours += cfg.is_salary
          ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
          : (hoursMap[`${personName}:${d}`] ?? 0)
      }
    }

    setTeamSummaryData({ totalRevenue, totalProfit, totalHours })
    setTeamSummaryLoading(false)
  }

  useEffect(() => {
    if (activeTab !== 'review' || showPeopleForReview.length === 0) return
    const idx = Math.max(0, Math.min(selectedReviewPersonIndex, showPeopleForReview.length - 1))
    if (idx !== selectedReviewPersonIndex) setSelectedReviewPersonIndex(idx)
    const personName = showPeopleForReview[idx]
    if (personName) loadReviewData(personName)
  }, [activeTab, selectedReviewPersonIndex, reviewPeriod, showPeopleForReview, users])

  function shiftMatrixWeek(delta: number) {
    const dStart = new Date(matrixStartDate + 'T12:00:00')
    const dEnd = new Date(matrixEndDate + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    setMatrixStartDate(dStart.toISOString().slice(0, 10))
    setMatrixEndDate(dEnd.toISOString().slice(0, 10))
  }

  function shiftHoursWeek(delta: number) {
    const dStart = new Date(hoursDateStart + 'T12:00:00')
    const dEnd = new Date(hoursDateEnd + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    setHoursDateStart(dStart.toISOString().slice(0, 10))
    setHoursDateEnd(dEnd.toISOString().slice(0, 10))
  }

  function shiftPayStubWeek(delta: number) {
    const dStart = new Date(payStubPeriodStart + 'T12:00:00')
    const dEnd = new Date(payStubPeriodEnd + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    setPayStubPeriodStart(dStart.toISOString().slice(0, 10))
    setPayStubPeriodEnd(dEnd.toISOString().slice(0, 10))
  }

  const matrixDays = getDaysInRange(matrixStartDate, matrixEndDate)
  const hoursDays = getDaysInRange(hoursDateStart, hoursDateEnd)

  function hasAssignmentsForDate(personName: string, workDate: string): boolean {
    const key = `${workDate}:${personName}`
    const row = crewJobsByDatePerson[key]
    if (!row) return false
    return !!(row.crew_lead_person_name || (row.job_assignments?.length ?? 0) > 0)
  }

  function hasUnassignedCorrectDays(personName: string): boolean {
    return hoursDays.some((d) => {
      if (!hoursDaysCorrect.has(d)) return false
      const hours = getDisplayHours(personName, d)
      if (hours <= 0) return false
      return !hasAssignmentsForDate(personName, d)
    })
  }

  const canEditUserNotes = authUserRole !== null && ['dev', 'master_technician', 'assistant'].includes(authUserRole)

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('users')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'users')
              return next
            })
          }}
          style={tabStyle(activeTab === 'users')}
        >
          Users
        </button>
        {canAccessPay && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('pay_stubs')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'pay_stubs')
                return next
              })
            }}
            style={tabStyle(activeTab === 'pay_stubs')}
          >
            Pay History
          </button>
        )}
        {(canAccessPay || canViewCostMatrixShared) && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('pay')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'pay')
                return next
              })
            }}
            style={tabStyle(activeTab === 'pay')}
          >
            Pay
          </button>
        )}
        {(canAccessPay || canAccessHours) && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('hours')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'hours')
                return next
              })
            }}
            style={tabStyle(activeTab === 'hours')}
          >
            Hours
          </button>
        )}
        {(canAccessPay || canViewCostMatrixShared) && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('team_costs')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'team_costs')
                return next
              })
            }}
            style={tabStyle(activeTab === 'team_costs')}
          >
            Team Costs
          </button>
        )}
        {canAccessPay && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('vehicles')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'vehicles')
                return next
              })
            }}
            style={tabStyle(activeTab === 'vehicles')}
          >
            Vehicles
          </button>
        )}
        {canAccessPay && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('offsets')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'offsets')
                return next
              })
            }}
            style={tabStyle(activeTab === 'offsets')}
          >
            Offsets
          </button>
        )}
        {isDev && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('review')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'review')
                return next
              })
            }}
            style={tabStyle(activeTab === 'review')}
          >
            Review
          </button>
        )}
        <h1 style={{ margin: 0, marginLeft: 'auto', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>People</h1>
      </div>
      {activeTab === 'users' && (
        <>
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
                            {u.notes && (
                              <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>— {u.notes}</span>
                            )}
                          </div>
                        </div>
                        {canEditUserNotes && (
                          <button
                            type="button"
                            title="Edit note"
                            onClick={() => setEditingUserNote({ id: u.id, name: u.name, notes: u.notes ?? '' })}
                            style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                              <path d="M32 160C32 124.7 60.7 96 96 96L544 96C579.3 96 608 124.7 608 160L32 160zM32 208L608 208L608 480C608 515.3 579.3 544 544 544L96 544C60.7 544 32 515.3 32 480L32 208zM279.3 480C299.5 480 314.6 460.6 301.7 445C287 427.3 264.8 416 240 416L176 416C151.2 416 129 427.3 114.3 445C101.4 460.6 116.5 480 136.7 480L279.2 480zM208 376C238.9 376 264 350.9 264 320C264 289.1 238.9 264 208 264C177.1 264 152 289.1 152 320C152 350.9 177.1 376 208 376zM392 272C378.7 272 368 282.7 368 296C368 309.3 378.7 320 392 320L504 320C517.3 320 528 309.3 528 296C528 282.7 517.3 272 504 272L392 272zM392 368C378.7 368 368 378.7 368 392C368 405.3 378.7 416 392 416L504 416C517.3 416 528 405.3 528 392C528 378.7 517.3 368 504 368L392 368z" />
                            </svg>
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Primaries</h2>
            {users.filter((u) => u.role === 'primary').length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {users
                  .filter((u) => u.role === 'primary')
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
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
                          {isDev && u.email && (
                            <>
                              {window.location.hostname === 'pipetooling.com' && (
                                <button
                                  type="button"
                                  title="imitate (pipetooling.com)"
                                  onClick={async () => {
                                    setLoggingInAsId(u.id)
                                    setError(null)
                                    try {
                                      await loginAsUser(u, 'https://pipetooling.com/dashboard')
                                    } catch (e) {
                                      setError(e instanceof Error ? e.message : 'Failed to imitate')
                                    } finally {
                                      setLoggingInAsId(null)
                                    }
                                  }}
                                  disabled={loggingInAsId === u.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: 0,
                                    marginRight: '0.35rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: loggingInAsId === u.id ? 'not-allowed' : 'pointer',
                                    verticalAlign: 'middle',
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                                    <path d="M96 64C60.7 64 32 92.7 32 128L32 200C32 213.3 42.7 224 56 224C69.3 224 80 213.3 80 200L80 128C80 119.2 87.2 112 96 112L168 112C181.3 112 192 101.3 192 88C192 74.7 181.3 64 168 64L96 64zM472 64C458.7 64 448 74.7 448 88C448 101.3 458.7 112 472 112L544 112C552.8 112 560 119.2 560 128L560 200C560 213.3 570.7 224 584 224C597.3 224 608 213.3 608 200L608 128C608 92.7 579.3 64 544 64L472 64zM80 440C80 426.7 69.3 416 56 416C42.7 416 32 426.7 32 440L32 512C32 547.3 60.7 576 96 576L168 576C181.3 576 192 565.3 192 552C192 538.7 181.3 528 168 528L96 528C87.2 528 80 520.8 80 512L80 440zM608 440C608 426.7 597.3 416 584 416C570.7 416 560 426.7 560 440L560 512C560 520.8 552.8 528 544 528L472 528C458.7 528 448 538.7 448 552C448 565.3 458.7 576 472 576L544 576C579.3 576 608 547.3 608 512L608 440zM320 280C350.9 280 376 254.9 376 224C376 193.1 350.9 168 320 168C289.1 168 264 193.1 264 224C264 254.9 289.1 280 320 280zM320 320C267 320 224 363 224 416L224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440L416 416C416 363 373 320 320 320zM512 256C512 229.5 490.5 208 464 208C437.5 208 416 229.5 416 256C416 282.5 437.5 304 464 304C490.5 304 512 282.5 512 256zM200 336.3C150.7 340.4 112 381.6 112 432L112 442.7C112 454.5 121.6 464 133.3 464L180.1 464C177.4 456.5 176 448.4 176 440L176 416C176 386.5 184.8 359.1 200 336.3zM459.9 464L506.7 464C518.5 464 528 454.4 528 442.7L528 432C528 381.7 489.3 340.4 440 336.3C455.2 359.1 464 386.5 464 416L464 440C464 448.4 462.6 456.5 459.9 464zM224 256C224 229.5 202.5 208 176 208C149.5 208 128 229.5 128 256C128 282.5 149.5 304 176 304C202.5 304 224 282.5 224 256z" />
                                  </svg>
                                </button>
                              )}
                              {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                                <button
                                  type="button"
                                  title="imitate (localhost)"
                                  onClick={async () => {
                                    setLoggingInAsId(u.id)
                                    setError(null)
                                    try {
                                      await loginAsUser(u, 'http://localhost:5173/dashboard')
                                    } catch (e) {
                                      setError(e instanceof Error ? e.message : 'Failed to imitate')
                                    } finally {
                                      setLoggingInAsId(null)
                                    }
                                  }}
                                  disabled={loggingInAsId === u.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: 0,
                                    marginRight: '0.35rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: loggingInAsId === u.id ? 'not-allowed' : 'pointer',
                                    verticalAlign: 'middle',
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                                    <path d="M31 31C21.7 40.4 21.7 55.6 31 65L87 121C96.4 130.4 111.6 130.4 120.9 121C130.2 111.6 130.3 96.4 120.9 87.1L65 31C55.6 21.6 40.4 21.6 31.1 31zM609 31C599.6 21.6 584.4 21.6 575.1 31L519 87C509.6 96.4 509.6 111.6 519 120.9C528.4 130.2 543.6 130.3 552.9 120.9L609 65C618.4 55.6 618.4 40.4 609 31.1zM65 609L121 553C130.4 543.6 130.4 528.4 121 519.1C111.6 509.8 96.4 509.7 87.1 519.1L31 575C21.6 584.4 21.6 599.6 31 608.9C40.4 618.2 55.6 618.3 64.9 608.9zM609 609C618.4 599.6 618.4 584.4 609 575.1L553 519.1C543.6 509.7 528.4 509.7 519.1 519.1C509.8 528.5 509.7 543.7 519.1 553L575.1 609C584.5 618.4 599.7 618.4 609 609zM320 272C355.3 272 384 243.3 384 208C384 172.7 355.3 144 320 144C284.7 144 256 172.7 256 208C256 243.3 284.7 272 320 272zM320 304C258.1 304 208 354.1 208 416L208 424C208 437.3 218.7 448 232 448L408 448C421.3 448 432 437.3 432 424L432 416C432 354.1 381.9 304 320 304zM536 224C536 193.1 510.9 168 480 168C449.1 168 424 193.1 424 224C424 254.9 449.1 280 480 280C510.9 280 536 254.9 536 224zM451.2 324.4C469.4 350.3 480 381.9 480 416L480 424C480 432.4 478.6 440.5 475.9 448L554.7 448C566.5 448 576 438.4 576 426.7L576 416C576 363 533 320 480 320C470 320 460.3 321.5 451.2 324.4zM188.8 324.4C179.7 321.5 170 320 160 320C107 320 64 363 64 416L64 426.7C64 438.5 73.6 448 85.3 448L164.1 448C161.4 440.5 160 432.4 160 424L160 416C160 381.9 170.6 350.3 188.8 324.4zM216 224C216 193.1 190.9 168 160 168C129.1 168 104 193.1 104 224C104 254.9 129.1 280 160 280C190.9 280 216 254.9 216 224z" />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        <span style={{ fontWeight: 500 }}>{u.name || u.email || 'Unknown'}</span>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>(account)</span>
                        {u.email && (
                          <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                            <a href={`mailto:${u.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                              {u.email}
                            </a>
                          </span>
                        )}
                        {u.notes && (
                          <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>— {u.notes}</span>
                        )}
                        </div>
                      </div>
                      {canEditUserNotes && (
                        <button
                          type="button"
                          title="Edit note"
                          onClick={() => setEditingUserNote({ id: u.id, name: u.name || '', notes: u.notes ?? '' })}
                          style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                            <path d="M32 160C32 124.7 60.7 96 96 96L544 96C579.3 96 608 124.7 608 160L32 160zM32 208L608 208L608 480C608 515.3 579.3 544 544 544L96 544C60.7 544 32 515.3 32 480L32 208zM279.3 480C299.5 480 314.6 460.6 301.7 445C287 427.3 264.8 416 240 416L176 416C151.2 416 129 427.3 114.3 445C101.4 460.6 116.5 480 136.7 480L279.2 480zM208 376C238.9 376 264 350.9 264 320C264 289.1 238.9 264 208 264C177.1 264 152 289.1 152 320C152 350.9 177.1 376 208 376zM392 272C378.7 272 368 282.7 368 296C368 309.3 378.7 320 392 320L504 320C517.3 320 528 309.3 528 296C528 282.7 517.3 272 504 272L392 272zM392 368C378.7 368 368 378.7 368 392C368 405.3 378.7 416 392 416L504 416C517.3 416 528 405.3 528 392C528 378.7 517.3 368 504 368L392 368z" />
                          </svg>
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </section>
          {KINDS.map((k) => (
        <section key={k} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{KIND_LABELS[k]}</h2>
            <button type="button" onClick={() => openAdd(k)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
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
                      {isDev && item.source === 'user' && item.email && (
                        <>
                          {window.location.hostname === 'pipetooling.com' && (
                          <button
                            type="button"
                            title="imitate (pipetooling.com)"
                            onClick={async () => {
                              setLoggingInAsId(item.id)
                              setError(null)
                              try {
                                await loginAsUser(item, 'https://pipetooling.com/dashboard')
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Failed to imitate')
                              } finally {
                                setLoggingInAsId(null)
                              }
                            }}
                            disabled={loggingInAsId === item.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: 0,
                              marginRight: '0.35rem',
                              background: 'none',
                              border: 'none',
                              cursor: loggingInAsId === item.id ? 'not-allowed' : 'pointer',
                              verticalAlign: 'middle',
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                              <path d="M96 64C60.7 64 32 92.7 32 128L32 200C32 213.3 42.7 224 56 224C69.3 224 80 213.3 80 200L80 128C80 119.2 87.2 112 96 112L168 112C181.3 112 192 101.3 192 88C192 74.7 181.3 64 168 64L96 64zM472 64C458.7 64 448 74.7 448 88C448 101.3 458.7 112 472 112L544 112C552.8 112 560 119.2 560 128L560 200C560 213.3 570.7 224 584 224C597.3 224 608 213.3 608 200L608 128C608 92.7 579.3 64 544 64L472 64zM80 440C80 426.7 69.3 416 56 416C42.7 416 32 426.7 32 440L32 512C32 547.3 60.7 576 96 576L168 576C181.3 576 192 565.3 192 552C192 538.7 181.3 528 168 528L96 528C87.2 528 80 520.8 80 512L80 440zM608 440C608 426.7 597.3 416 584 416C570.7 416 560 426.7 560 440L560 512C560 520.8 552.8 528 544 528L472 528C458.7 528 448 538.7 448 552C448 565.3 458.7 576 472 576L544 576C579.3 576 608 547.3 608 512L608 440zM320 280C350.9 280 376 254.9 376 224C376 193.1 350.9 168 320 168C289.1 168 264 193.1 264 224C264 254.9 289.1 280 320 280zM320 320C267 320 224 363 224 416L224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440L416 416C416 363 373 320 320 320zM512 256C512 229.5 490.5 208 464 208C437.5 208 416 229.5 416 256C416 282.5 437.5 304 464 304C490.5 304 512 282.5 512 256zM200 336.3C150.7 340.4 112 381.6 112 432L112 442.7C112 454.5 121.6 464 133.3 464L180.1 464C177.4 456.5 176 448.4 176 440L176 416C176 386.5 184.8 359.1 200 336.3zM459.9 464L506.7 464C518.5 464 528 454.4 528 442.7L528 432C528 381.7 489.3 340.4 440 336.3C455.2 359.1 464 386.5 464 416L464 440C464 448.4 462.6 456.5 459.9 464zM224 256C224 229.5 202.5 208 176 208C149.5 208 128 229.5 128 256C128 282.5 149.5 304 176 304C202.5 304 224 282.5 224 256z" />
                            </svg>
                          </button>
                          )}
                          {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                          <button
                            type="button"
                            title="imitate (localhost)"
                            onClick={async () => {
                              setLoggingInAsId(item.id)
                              setError(null)
                              try {
                                await loginAsUser(item, 'http://localhost:5173/dashboard')
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Failed to imitate')
                              } finally {
                                setLoggingInAsId(null)
                              }
                            }}
                            disabled={loggingInAsId === item.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: 0,
                              marginRight: '0.35rem',
                              background: 'none',
                              border: 'none',
                              cursor: loggingInAsId === item.id ? 'not-allowed' : 'pointer',
                              verticalAlign: 'middle',
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                              <path d="M31 31C21.7 40.4 21.7 55.6 31 65L87 121C96.4 130.4 111.6 130.4 120.9 121C130.2 111.6 130.3 96.4 120.9 87.1L65 31C55.6 21.6 40.4 21.6 31.1 31zM609 31C599.6 21.6 584.4 21.6 575.1 31L519 87C509.6 96.4 509.6 111.6 519 120.9C528.4 130.2 543.6 130.3 552.9 120.9L609 65C618.4 55.6 618.4 40.4 609 31.1zM65 609L121 553C130.4 543.6 130.4 528.4 121 519.1C111.6 509.8 96.4 509.7 87.1 519.1L31 575C21.6 584.4 21.6 599.6 31 608.9C40.4 618.2 55.6 618.3 64.9 608.9zM609 609C618.4 599.6 618.4 584.4 609 575.1L553 519.1C543.6 509.7 528.4 509.7 519.1 519.1C509.8 528.5 509.7 543.7 519.1 553L575.1 609C584.5 618.4 599.7 618.4 609 609zM320 272C355.3 272 384 243.3 384 208C384 172.7 355.3 144 320 144C284.7 144 256 172.7 256 208C256 243.3 284.7 272 320 272zM320 304C258.1 304 208 354.1 208 416L208 424C208 437.3 218.7 448 232 448L408 448C421.3 448 432 437.3 432 424L432 416C432 354.1 381.9 304 320 304zM536 224C536 193.1 510.9 168 480 168C449.1 168 424 193.1 424 224C424 254.9 449.1 280 480 280C510.9 280 536 254.9 536 224zM451.2 324.4C469.4 350.3 480 381.9 480 416L480 424C480 432.4 478.6 440.5 475.9 448L554.7 448C566.5 448 576 438.4 576 426.7L576 416C576 363 533 320 480 320C470 320 460.3 321.5 451.2 324.4zM188.8 324.4C179.7 321.5 170 320 160 320C107 320 64 363 64 416L64 426.7C64 438.5 73.6 448 85.3 448L164.1 448C161.4 440.5 160 432.4 160 424L160 416C160 381.9 170.6 350.3 188.8 324.4zM216 224C216 193.1 190.9 168 160 168C129.1 168 104 193.1 104 224C104 254.9 129.1 280 160 280C190.9 280 216 254.9 216 224z" />
                            </svg>
                          </button>
                          )}
                        </>
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
                      {item.source === 'user' && 'notes' in item && item.notes && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>— {item.notes}</span>
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
                  {item.source === 'user' && canEditUserNotes && (
                    <button
                      type="button"
                      title="Edit note"
                      onClick={() => setEditingUserNote({ id: item.id, name: item.name, notes: ('notes' in item ? item.notes : null) ?? '' })}
                      style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                        <path d="M32 160C32 124.7 60.7 96 96 96L544 96C579.3 96 608 124.7 608 160L32 160zM32 208L608 208L608 480C608 515.3 579.3 544 544 544L96 544C60.7 544 32 515.3 32 480L32 208zM279.3 480C299.5 480 314.6 460.6 301.7 445C287 427.3 264.8 416 240 416L176 416C151.2 416 129 427.3 114.3 445C101.4 460.6 116.5 480 136.7 480L279.2 480zM208 376C238.9 376 264 350.9 264 320C264 289.1 238.9 264 208 264C177.1 264 152 289.1 152 320C152 350.9 177.1 376 208 376zM392 272C378.7 272 368 282.7 368 296C368 309.3 378.7 320 392 320L504 320C517.3 320 528 309.3 528 296C528 282.7 517.3 272 504 272L392 272zM392 368C378.7 368 368 378.7 368 392C368 405.3 378.7 416 392 416L504 416C517.3 416 528 405.3 528 392C528 378.7 517.3 368 504 368L392 368z" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
        </>
      )}

      {activeTab === 'pay_stubs' && canAccessPay && (
        <div>
          {payStubsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <>
              {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
              <section style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setRunPayrollModalOpen(true)}
                  disabled={showPeopleForHours.length === 0}
                  title={showPeopleForHours.length === 0 ? 'Go to Pay tab and check Show in Hours for people to track' : undefined}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.9375rem',
                    background: showPeopleForHours.length === 0 ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: showPeopleForHours.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Generate Pay Reports
                </button>
              </section>
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem' }}>Generate Pay Reports</h2>
                {showPeopleForHours.length === 0 && (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>
                    No people with Show in Hours selected. Go to Pay tab and check Show in Hours for people to track.
                  </p>
                )}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Person</span>
                    <select
                      value={payStubGeneratorPerson}
                      onChange={(e) => setPayStubGeneratorPerson(e.target.value)}
                      style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 140 }}
                    >
                      <option value="">Select person</option>
                      {showPeopleForHours.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                    <input
                      type="date"
                      value={payStubPeriodStart}
                      onChange={(e) => setPayStubPeriodStart(e.target.value)}
                      style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </label>
                  <label>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                    <input
                      type="date"
                      value={payStubPeriodEnd}
                      onChange={(e) => setPayStubPeriodEnd(e.target.value)}
                      style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => generatePayStub()}
                      disabled={!payStubGeneratorPerson?.trim()}
                      title={
                        !payStubGeneratorPerson?.trim()
                          ? showPeopleForHours.length === 0
                            ? 'Go to Pay tab and check Show in Hours for people to track'
                            : 'Select a person to generate a pay report'
                          : undefined
                      }
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.875rem',
                        background: payStubGeneratorPerson?.trim() ? '#3b82f6' : '#9ca3af',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: payStubGeneratorPerson?.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 500,
                      }}
                    >
                      Generate Pay Report
                    </button>
                    {!payStubGeneratorPerson?.trim() && (
                      <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                        {showPeopleForHours.length === 0
                          ? 'Go to Pay tab and check Show in Hours for people to track'
                          : 'Select a person to generate a pay report'}
                      </span>
                    )}
                  </span>
                </div>
                {payStubGeneratorPerson?.trim() && payStubPeriodStart <= payStubPeriodEnd && (() => {
                  const days = getDaysInRange(payStubPeriodStart, payStubPeriodEnd)
                  const byDay = days.map((d) => ({ date: d, cost: getCostForPersonDate(payStubGeneratorPerson.trim(), d) }))
                  const total = byDay.reduce((s, x) => s + x.cost, 0)
                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  return (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                        Pay tab payments for {payStubGeneratorPerson.trim()} ({payStubPeriodStart} to {payStubPeriodEnd})
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Date</th>
                              <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Day</th>
                              <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byDay.map(({ date, cost }) => {
                              const isCorrect = hoursDaysCorrect.has(date)
                              return (
                                <tr
                                  key={date}
                                  style={{
                                    borderBottom: '1px solid #f3f4f6',
                                    background: isCorrect ? undefined : 'rgba(251, 146, 60, 0.15)',
                                  }}
                                  title={isCorrect ? undefined : 'Day not marked Correct in Hours tab'}
                                >
                                  <td style={{ padding: '0.25rem 0.5rem' }}>{date}</td>
                                  <td style={{ padding: '0.25rem 0.5rem', color: '#6b7280' }}>
                                    {dayNames[new Date(date + 'T12:00:00').getDay()]}
                                  </td>
                                  <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>
                                    ${cost > 0 ? cost.toFixed(2) : '0.00'}
                                  </td>
                                </tr>
                              )
                            })}
                            <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                              <td colSpan={2} style={{ padding: '0.35rem 0.5rem' }}>Total</td>
                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                ${total.toFixed(2)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}
              </section>
              <section>
                <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem' }}>Ledger</h2>
                {payStubs.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No pay reports yet. Generate one above.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Person</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Period</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Hours</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Gross Pay</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Created</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Paid</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payStubs.map((stub) => (
                          <tr key={stub.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => setPayStubCalendarPerson(stub.person_name)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  textDecoration: 'underline',
                                  fontSize: 'inherit',
                                  fontFamily: 'inherit',
                                }}
                              >
                                {stub.person_name}
                              </button>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {new Date(stub.period_start + 'T12:00:00').toLocaleDateString()} – {new Date(stub.period_end + 'T12:00:00').toLocaleDateString()}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{stub.hours_total.toFixed(2)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(stub.gross_pay)}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {stub.created_at ? new Date(stub.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {stub.paid_at ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span style={{ fontSize: '0.8125rem', color: '#059669' }}>Paid {new Date(stub.paid_at).toLocaleDateString()}</span>
                                  <button
                                    type="button"
                                    onClick={() => unmarkPayStubPaid(stub)}
                                    disabled={markingPayStubId === stub.id}
                                    style={{ padding: '2px 6px', fontSize: '0.75rem', background: 'none', border: '1px solid #d1d5db', borderRadius: 4, cursor: markingPayStubId === stub.id ? 'not-allowed' : 'pointer', color: '#6b7280' }}
                                  >
                                    {markingPayStubId === stub.id ? '...' : 'Unmark'}
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => markPayStubPaid(stub)}
                                  disabled={markingPayStubId === stub.id}
                                  style={{ padding: '2px 6px', fontSize: '0.8125rem', background: markingPayStubId === stub.id ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: markingPayStubId === stub.id ? 'not-allowed' : 'pointer' }}
                                >
                                  {markingPayStubId === stub.id ? '...' : 'Mark as paid'}
                                </button>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => viewPayStub(stub)}
                                style={{ padding: '2px 6px', fontSize: '0.8125rem', marginRight: '0.35rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => printPayStub(stub)}
                                style={{ padding: '2px 6px', fontSize: '0.8125rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Print
                              </button>
                              {isDev && (
                                <button
                                  type="button"
                                  onClick={() => setPayStubDeleteConfirm(stub)}
                                  disabled={deletingPayStubId === stub.id}
                                  style={{ padding: '2px 6px', fontSize: '0.8125rem', marginLeft: '0.35rem', background: deletingPayStubId === stub.id ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: deletingPayStubId === stub.id ? 'not-allowed' : 'pointer' }}
                                >
                                  {deletingPayStubId === stub.id ? '...' : 'Delete'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {payStubDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              Delete this pay report for {payStubDeleteConfirm.person_name} ({new Date(payStubDeleteConfirm.period_start + 'T12:00:00').toLocaleDateString()} – {new Date(payStubDeleteConfirm.period_end + 'T12:00:00').toLocaleDateString()})? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPayStubDeleteConfirm(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPayStubId === payStubDeleteConfirm.id}
                onClick={() => deletePayStub(payStubDeleteConfirm)}
                style={{
                  padding: '0.5rem 1rem',
                  background: deletingPayStubId !== payStubDeleteConfirm.id ? '#dc2626' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: deletingPayStubId !== payStubDeleteConfirm.id ? 'pointer' : 'not-allowed',
                }}
              >
                {deletingPayStubId === payStubDeleteConfirm.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {runPayrollModalOpen && activeTab === 'pay_stubs' && canAccessPay && (() => {
        const start = payStubPeriodStart
        const end = payStubPeriodEnd
        const days = getDaysInRange(start, end)
        const paidCount = showPeopleForHours.filter((person) => {
          const stub = payStubs.find((s) => s.person_name === person && s.period_start <= end && s.period_end >= start)
          return stub?.paid_at
        }).length
        const totalAmount = showPeopleForHours.reduce((sum, person) => {
          const stub = payStubs.find((s) => s.person_name === person && s.period_start <= end && s.period_end >= start)
          if (stub) return sum + stub.gross_pay
          return sum + days.reduce((s, d) => s + getCostForPersonDate(person, d), 0)
        }, 0)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 600, maxHeight: '85vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Generate Pay Reports</h2>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    <label>
                      <span style={{ marginRight: '0.35rem', fontSize: '0.875rem' }}>Start</span>
                      <input
                        type="date"
                        value={start}
                        onChange={(e) => setPayStubPeriodStart(e.target.value)}
                        style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </label>
                    <label>
                      <span style={{ marginRight: '0.35rem', fontSize: '0.875rem' }}>End</span>
                      <input
                        type="date"
                        value={end}
                        onChange={(e) => setPayStubPeriodEnd(e.target.value)}
                        style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </label>
                    <button type="button" onClick={() => shiftPayStubWeek(0)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>This week</button>
                    <button type="button" onClick={() => shiftPayStubWeek(-1)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Last week</button>
                  </div>
                </div>
                <button type="button" onClick={() => setRunPayrollModalOpen(false)} style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280' }} aria-label="Close">×</button>
              </div>
              {showPeopleForHours.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No people with Show in Hours selected. Go to Pay tab and check Show in Hours for people to track.</p>
              ) : (
                <>
                  <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', width: 36 }}>Paid</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Person</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Status</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Hours</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Est. Gross</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {showPeopleForHours.map((person) => {
                          const stub = payStubs.find((s) => s.person_name === person && s.period_start <= end && s.period_end >= start)
                          const hours = days.reduce((s, d) => s + getEffectiveHours(person, d), 0)
                          const estGross = days.reduce((s, d) => s + getCostForPersonDate(person, d), 0)
                          const allDaysCorrect = days.every((d) => hoursDaysCorrect.has(d))
                          const status = stub
                            ? stub.paid_at
                              ? 'Paid'
                              : 'Report only'
                            : estGross > 0
                              ? allDaysCorrect
                                ? 'Ready'
                                : 'Review'
                              : 'No hours'
                          const isGenerating = generatingPayStubPerson === person
                          return (
                            <tr key={person} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                {stub && !stub.paid_at ? (
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    onChange={() => markPayStubPaid(stub)}
                                    disabled={markingPayStubId === stub.id}
                                    title="Mark as paid"
                                  />
                                ) : stub?.paid_at ? (
                                  <span style={{ color: '#059669', fontSize: '0.875rem' }} title="Paid">✓</span>
                                ) : (
                                  <span style={{ color: '#d1d5db' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{person}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <span
                                  style={{
                                    fontSize: '0.8125rem',
                                    color: status === 'Paid' ? '#059669' : status === 'Review' ? '#ea580c' : status === 'No hours' || status === 'Report only' ? '#6b7280' : undefined,
                                  }}
                                >
                                  {status}
                                </span>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{hours.toFixed(2)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(estGross)}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                {stub ? (
                                  <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <button type="button" onClick={() => viewPayStub(stub)} style={{ padding: '2px 6px', fontSize: '0.8125rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>View</button>
                                    {stub.paid_at ? (
                                      <button type="button" onClick={() => unmarkPayStubPaid(stub)} disabled={markingPayStubId === stub.id} style={{ padding: '2px 6px', fontSize: '0.75rem', background: 'none', border: '1px solid #d1d5db', borderRadius: 4, cursor: markingPayStubId === stub.id ? 'not-allowed' : 'pointer', color: '#6b7280' }}>{markingPayStubId === stub.id ? '...' : 'Unmark'}</button>
                                    ) : (
                                      <button type="button" onClick={() => markPayStubPaid(stub)} disabled={markingPayStubId === stub.id} style={{ padding: '2px 6px', fontSize: '0.8125rem', background: markingPayStubId === stub.id ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: markingPayStubId === stub.id ? 'not-allowed' : 'pointer' }}>{markingPayStubId === stub.id ? '...' : 'Mark as paid'}</button>
                                    )}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setGeneratingPayStubPerson(person)
                                      setError(null)
                                      await generatePayStub(person)
                                      setGeneratingPayStubPerson(null)
                                    }}
                                    disabled={isGenerating || estGross <= 0}
                                    style={{ padding: '2px 6px', fontSize: '0.8125rem', background: isGenerating || estGross <= 0 ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: isGenerating || estGross <= 0 ? 'not-allowed' : 'pointer' }}
                                  >
                                    {isGenerating ? '...' : 'Generate Pay Report'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
                    {paidCount} of {showPeopleForHours.length} paid · Total: ${formatCurrency(totalAmount)}
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {activeTab === 'pay' && (canAccessPay || canViewCostMatrixShared) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {payTabLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
          <>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {(() => {
            const matrixTotal = matrixDays.reduce(
              (daySum, d) => daySum + showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0),
              0
            )
            const tagTotals = new Map<string, number>()
            const tagHours = new Map<string, number>()
            for (const personName of showPeopleForMatrix) {
              const periodCost = matrixDays.reduce((s, d) => s + getCostForPersonDateMatrix(personName, d), 0)
              const periodHrs = matrixDays.reduce((s, d) => s + getEffectiveHours(personName, d), 0)
              const tags = (costMatrixTags[personName] ?? '').split(',').map((t) => t.trim()).filter(Boolean)
              for (const tag of tags) {
                tagTotals.set(tag, (tagTotals.get(tag) ?? 0) + periodCost)
                tagHours.set(tag, (tagHours.get(tag) ?? 0) + periodHrs)
              }
            }
            const sortedTags = [...tagTotals.entries()].sort((a, b) => b[1] - a[1])
            if (sortedTags.length === 0) return null
            return (
              <section style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9375rem' }}>Due by Trade</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                  {sortedTags.map(([tag, total]) => {
                    const pct = matrixTotal > 0 ? Math.round((total / matrixTotal) * 100) : 0
                    const hrs = tagHours.get(tag) ?? 0
                    const costPerHr = hrs > 0 ? `$${(total / hrs).toFixed(1)}/hr` : '—'
                    return (
                      <span
                        key={tag}
                        role="button"
                        tabIndex={0}
                        onClick={() => setTagLedgerModalTag(tag)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTagLedgerModalTag(tag) } }}
                        style={{ fontWeight: 500, cursor: 'pointer' }}
                        title="Click to view ledger"
                      >
                        {tag} ${Math.round(total).toLocaleString('en-US')} | {pct}% | {costPerHr}
                      </span>
                    )
                  })}
                </div>
              </section>
            )
          })()}
          {teams.length > 0 && (
            <section style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9375rem' }}>Due by Team:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                {teams.map((team) => {
                  const costForRange = (start: string, end: string) =>
                    team.members.reduce((sum, p) => sum + getDaysInRange(start, end).reduce((s, d) => s + getCostForPersonDateTeams(p, d), 0), 0)
                  const periodCost = costForRange(teamPeriodStart, teamPeriodEnd)
                  return (
                    <span
                      key={team.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTeamLedgerModalTeam(team)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTeamLedgerModalTeam(team) } }}
                      style={{ fontWeight: 500, cursor: 'pointer' }}
                      title="Click to view ledger"
                    >
                      {team.name}: ${Math.round(periodCost).toLocaleString('en-US')}
                    </span>
                  )
                })}
              </div>
            </section>
          )}
          {tagLedgerModalTag && (() => {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            const peopleWithTag = showPeopleForMatrix.filter((p) =>
              (costMatrixTags[p] ?? '').split(',').map((t) => t.trim()).filter(Boolean).includes(tagLedgerModalTag)
            )
            const daysInRange = getDaysInRange(matrixStartDate, matrixEndDate)
            const memberCostByWeekday = peopleWithTag.map((personName) => {
              const byDay = dayNames.map((_, dayOfWeek) => {
                const matchingDays = daysInRange.filter((d) => new Date(d + 'T12:00:00').getDay() === dayOfWeek)
                return matchingDays.reduce((sum, d) => sum + getCostForPersonDateMatrix(personName, d), 0)
              })
              const total = byDay.reduce((s, v) => s + v, 0)
              return { personName, byDay, total }
            })
            const costByWeekday = dayNames.map((_, dayOfWeek) =>
              memberCostByWeekday.reduce((s, r) => s + (r.byDay[dayOfWeek] ?? 0), 0)
            )
            const periodTotal = costByWeekday.reduce((s, v) => s + v, 0)
            return (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                }}
                onClick={() => setTagLedgerModalTag(null)}
              >
                <div
                  style={{
                    background: 'white',
                    borderRadius: 8,
                    padding: '1rem 1.25rem',
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                    overflow: 'auto',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                      {tagLedgerModalTag} — Week of {matrixStartDate} to {matrixEndDate}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setTagLedgerModalTag(null)}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Close
                    </button>
                  </div>
                  <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
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
                      {memberCostByWeekday.map(({ personName, byDay, total }) => (
                        <tr key={personName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.2rem 0.5rem' }}>{personName}</td>
                          {byDay.map((val, i) => (
                            <td key={dayNames[i]} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                          ))}
                          <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${Math.round(total).toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                        <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                        {costByWeekday.map((val, i) => (
                          <td key={dayNames[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                        ))}
                        <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${Math.round(periodTotal).toLocaleString('en-US')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
          {teamLedgerModalTeam && (() => {
            const team = teamLedgerModalTeam
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            const daysInRange = getDaysInRange(teamPeriodStart, teamPeriodEnd)
            const memberCostByWeekday = team.members.map((personName) => {
              const byDay = dayNames.map((_, dayOfWeek) => {
                const matchingDays = daysInRange.filter((d) => new Date(d + 'T12:00:00').getDay() === dayOfWeek)
                return matchingDays.reduce((sum, d) => sum + getCostForPersonDateTeams(personName, d), 0)
              })
              const total = byDay.reduce((s, v) => s + v, 0)
              return { personName, byDay, total }
            })
            const costByWeekday = dayNames.map((_, dayOfWeek) =>
              memberCostByWeekday.reduce((s, r) => s + (r.byDay[dayOfWeek] ?? 0), 0)
            )
            const periodTotal = costByWeekday.reduce((s, v) => s + v, 0)
            return (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                }}
                onClick={() => setTeamLedgerModalTeam(null)}
              >
                <div
                  style={{
                    background: 'white',
                    borderRadius: 8,
                    padding: '1rem 1.25rem',
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                    overflow: 'auto',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                      {team.name} — {teamPeriodStart} to {teamPeriodEnd}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setTeamLedgerModalTeam(null)}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Close
                    </button>
                  </div>
                  <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
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
                      {memberCostByWeekday.map(({ personName, byDay, total }) => (
                        <tr key={personName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.2rem 0.5rem' }}>{personName}</td>
                          {byDay.map((val, i) => (
                            <td key={dayNames[i]} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                          ))}
                          <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${Math.round(total).toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                        <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                        {costByWeekday.map((val, i) => (
                          <td key={dayNames[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                        ))}
                        <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${Math.round(periodTotal).toLocaleString('en-US')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
          <section id="cost-matrix">
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
              {canAccessPay && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={payEditArrangement}
                      onChange={(e) => setPayEditArrangement(e.target.checked)}
                    />
                    edit arrangement
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={payEditTags}
                      onChange={(e) => setPayEditTags(e.target.checked)}
                    />
                    edit tags
                  </label>
                </>
              )}
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
                onClick={() => shiftMatrixWeek(-1)}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                ← last week
              </button>
              <button
                type="button"
                onClick={() => shiftMatrixWeek(1)}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                next week →
              </button>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        Person
                        <button
                          type="button"
                          onClick={() => setMatrixSortBy('cost')}
                          title="Sort by cost (most expensive first)"
                          style={{
                            padding: '0.15rem 0.35rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: matrixSortBy === 'cost' ? '#e5e7eb' : 'white',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: matrixSortBy === 'cost' ? 600 : 400,
                          }}
                        >
                          $
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatrixSortBy('tag')}
                          title="Sort by first tag (A-Z)"
                          style={{
                            padding: '0.15rem 0.35rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: matrixSortBy === 'tag' ? '#e5e7eb' : 'white',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: matrixSortBy === 'tag' ? 600 : 400,
                          }}
                        >
                          tag
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatrixSortBy('name')}
                          title="Sort by name (A-Z)"
                          style={{
                            padding: '0.15rem 0.35rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: matrixSortBy === 'name' ? '#e5e7eb' : 'white',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: matrixSortBy === 'name' ? 600 : 400,
                          }}
                        >
                          name
                        </button>
                      </span>
                    </th>
                    {matrixDays.map((d) => {
                      const dt = new Date(d + 'T12:00:00')
                      const weekday = dt.toLocaleDateString(undefined, { weekday: 'short' })
                      const monthDay = dt.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
                      return (
                        <th key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', minWidth: 70 }}>
                          <span className="cost-matrix-date-header">
                            <span>{weekday}</span>
                            <span> {monthDay}</span>
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {showPeopleForMatrix.map((personName, idx) => {
                    const cfg = payConfig[personName]
                    const wage = cfg?.hourly_wage ?? 0
                    const periodTotal = matrixDays.reduce((s, d) => s + getCostForPersonDateMatrix(personName, d), 0)
                    return (
                      <tr key={personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem 0.75rem', position: 'sticky', left: 0, background: 'white', minWidth: 200 }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.2rem', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              {payEditArrangement && canAccessPay ? (
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 0, marginRight: '0.25rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => moveMatrixRow(personName, 'up')}
                                    disabled={idx === 0}
                                    title="Move up"
                                    style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveMatrixRow(personName, 'down')}
                                    disabled={idx === showPeopleForMatrix.length - 1}
                                    title="Move down"
                                    style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === showPeopleForMatrix.length - 1 ? 'not-allowed' : 'pointer', color: idx === showPeopleForMatrix.length - 1 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                                  >
                                    ▼
                                  </button>
                                </span>
                              ) : null}
                              <span>
                                {wage > 0 ? `$${Math.round(periodTotal).toLocaleString('en-US')}` : '—'} | {personName}{cfg?.is_salary && <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.35rem' }}>(salary)</span>}
                              </span>
                            </span>
                            {payEditTags && canAccessPay ? (
                              <input
                                type="text"
                                value={costMatrixTags[personName] ?? ''}
                                onChange={(e) => setCostMatrixTags((prev) => ({ ...prev, [personName]: e.target.value }))}
                                onBlur={(e) => saveCostMatrixTags(personName, e.target.value)}
                                placeholder="Tags (comma-separated)"
                                style={{ padding: '0.2rem 0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem', minWidth: 120, marginLeft: 'auto' }}
                              />
                            ) : (costMatrixTags[personName] ?? '').trim() ? (
                              <span style={{ display: 'flex', gap: '0.15rem', flexWrap: 'wrap', marginLeft: 'auto', justifyContent: 'flex-end' }}>
                                {(costMatrixTags[personName] ?? '')
                                  .split(',')
                                  .map((t) => t.trim())
                                  .filter(Boolean)
                                  .map((tag) => (
                                    <span
                                      key={tag}
                                      style={{
                                        padding: '0.1rem 0.35rem',
                                        background: costMatrixTagColors[tag] ?? '#e5e7eb',
                                        borderRadius: 4,
                                        fontSize: '0.7rem',
                                        color: textColorForBackground(costMatrixTagColors[tag] ?? '#e5e7eb'),
                                      }}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        {matrixDays.map((d) => {
                          const cost = getCostForPersonDateMatrix(personName, d)
                          return (
                            <td key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>
                              {wage > 0 ? `$${Math.round(cost).toLocaleString('en-US')}` : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                    <td style={{ padding: '0.5rem 0.75rem', position: 'sticky', left: 0, background: '#f9fafb' }}>
                      Internal Team: ${Math.round(
                        matrixDays.reduce(
                          (daySum, d) => daySum + showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0),
                          0
                        )
                      ).toLocaleString('en-US')}
                    </td>
                    {matrixDays.map((d) => {
                      const dayTotal = showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0)
                      return (
                        <td key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>
                          ${Math.round(dayTotal).toLocaleString('en-US')}
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
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
              {canViewCostMatrixShared && !canAccessPay ? 'Teams and combined cost for a date range.' : 'Add people to teams to see combined cost for a date range (default: last 7 days).'}
            </p>
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
                        <span style={{ fontWeight: 600 }}>Period: ${Math.round(periodCost).toLocaleString('en-US')}</span>
                        <span style={{ color: '#6b7280' }}>7d: ${Math.round(last7Cost).toLocaleString('en-US')}</span>
                        <span style={{ color: '#6b7280' }}>3d: ${Math.round(last3Cost).toLocaleString('en-US')}</span>
                        <span style={{ color: '#6b7280' }}>Yesterday: ${Math.round(yesterdayCost).toLocaleString('en-US')}</span>
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
                              <td key={dayNames[i]} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                            ))}
                            <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${Math.round(total).toLocaleString('en-US')}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                          <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                          {costByWeekday.map((val, i) => (
                            <td key={dayNames[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                          ))}
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${Math.round(periodTotal).toLocaleString('en-US')}</td>
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
          {canAccessPay && mergeDuplicates.length > 0 && (
          <section style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 4 }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#92400e' }}>
              Found {mergeDuplicates.length} duplicate{mergeDuplicates.length !== 1 ? 's' : ''}: person name vs user. Merge to consolidate.
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {mergeDuplicates.map((dup) => (
                <li key={dup.personName} style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{dup.personName} → {dup.userDisplayName}</span>
                  <button
                    type="button"
                    onClick={() => handleMergeDuplicate(dup)}
                    disabled={mergingPersonName === dup.personName}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: mergingPersonName === dup.personName ? 'not-allowed' : 'pointer' }}
                  >
                    {mergingPersonName === dup.personName ? 'Merging…' : 'Merge'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          )}
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
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }} title="Record hours for tracking (salary still used for pay)">Record hours</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Show in Hours</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Show in Cost Matrix</th>
                  </tr>
                </thead>
                <tbody>
                  {allRosterNames().map((n) => {
                    const c = payConfig[n] ?? { person_name: n, hourly_wage: null, is_salary: false, show_in_hours: false, show_in_cost_matrix: false, record_hours_but_salary: false }
                    return (
                      <tr key={n} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{n}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={payConfigDraft[n] !== undefined ? payConfigDraft[n] : (c.hourly_wage ?? '')}
                            onChange={(e) => updatePayConfigHourlyWage(n, e.target.value)}
                            disabled={payConfigSaving}
                            style={{ width: 80, padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={c.is_salary}
                            onChange={(e) => upsertPayConfig(n, { is_salary: e.target.checked })}
                            disabled={payConfigSaving}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={c.record_hours_but_salary}
                            onChange={(e) => upsertPayConfig(n, { record_hours_but_salary: e.target.checked })}
                            disabled={payConfigSaving || !c.is_salary}
                            title={!c.is_salary ? 'Only applies when Salary is checked' : undefined}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={c.show_in_hours}
                            onChange={(e) => upsertPayConfig(n, { show_in_hours: e.target.checked })}
                            disabled={payConfigSaving || !isDev}
                            title={!isDev ? 'Only dev can change this' : undefined}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={c.show_in_cost_matrix}
                            onChange={(e) => upsertPayConfig(n, { show_in_cost_matrix: e.target.checked })}
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
          {canAccessPay && (
          <section>
            <button
              type="button"
              onClick={() => setCostMatrixTagColorsSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                marginBottom: costMatrixTagColorsSectionOpen ? '0.75rem' : 0,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.125rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{costMatrixTagColorsSectionOpen ? '▼' : '▶'}</span>
              Tag colors
            </button>
            {costMatrixTagColorsSectionOpen && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Click a tag to change its color.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                  {(() => {
                    const tagsInUse = new Set<string>()
                    for (const tags of Object.values(costMatrixTags)) {
                      for (const t of (tags ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
                        tagsInUse.add(t)
                      }
                    }
                    const tagsWithColors = new Set(Object.keys(costMatrixTagColors))
                    const allTags = [...new Set([...tagsInUse, ...tagsWithColors])].sort()
                    return (
                      <>
                        {allTags.map((tag) => {
                          const bg = costMatrixTagColors[tag] ?? '#e5e7eb'
                          return (
                            <label
                              key={tag}
                              style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}
                              title="Click to change color"
                            >
                              <input
                                type="color"
                                value={bg}
                                onChange={(e) => saveTagColor(tag, e.target.value)}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  opacity: 0,
                                  cursor: 'pointer',
                                  width: '100%',
                                  height: '100%',
                                }}
                              />
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.1rem 0.35rem',
                                  background: bg,
                                  borderRadius: 4,
                                  fontSize: '0.7rem',
                                  color: textColorForBackground(bg),
                                }}
                              >
                                {tag}
                              </span>
                            </label>
                          )
                        })}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.25rem' }}>
                          <input
                            type="text"
                            placeholder="Add tag"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const t = newTagName.trim()
                                if (t) {
                                  saveTagColor(t, newTagColor)
                                  setNewTagName('')
                                  setNewTagColor('#e5e7eb')
                                }
                              }
                            }}
                            style={{ width: 80, padding: '0.1rem 0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.7rem' }}
                          />
                          <label style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }} title="Color for new tag">
                            <input
                              type="color"
                              value={newTagColor}
                              onChange={(e) => setNewTagColor(e.target.value)}
                              style={{
                                position: 'absolute',
                                inset: 0,
                                opacity: 0,
                                cursor: 'pointer',
                                width: '100%',
                                height: '100%',
                              }}
                            />
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.1rem 0.35rem',
                                background: newTagColor,
                                borderRadius: 4,
                                fontSize: '0.7rem',
                                color: textColorForBackground(newTagColor),
                              }}
                            >
                              +
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const t = newTagName.trim()
                              if (t) {
                                saveTagColor(t, newTagColor)
                                setNewTagName('')
                                setNewTagColor('#e5e7eb')
                              }
                            }}
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.7rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
                          >
                            Add
                          </button>
                        </span>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </section>
          )}
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
              onClick={() => shiftHoursWeek(-1)}
              style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              ← last week
            </button>
            <button
              type="button"
              onClick={() => shiftHoursWeek(1)}
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
                  {hoursDays.map((d) => (
                    <col key={d} style={{ width: 72 }} />
                  ))}
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                    {hoursDays.map((d) => (
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
                    const isUnassigned = hasUnassignedCorrectDays(personName)
                    const isClickable = isUnassigned && canEditCrewJobs
                    return (
                      <tr
                        key={personName}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          ...(isUnassigned && {
                            outline: '2px solid #dc2626',
                            outlineOffset: -1,
                            background: 'rgba(220, 38, 38, 0.05)',
                          }),
                          ...(isClickable && { cursor: 'pointer' }),
                        }}
                        onClick={isClickable ? () => setHoursUnassignedModal({ personName }) : undefined}
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onKeyDown={isClickable ? (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            setHoursUnassignedModal({ personName })
                          }
                        } : undefined}
                      >
                        <td style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ display: 'flex', flexDirection: 'row', gap: 0, marginRight: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moveHoursRow(personName, 'up') }}
                              disabled={idx === 0}
                              title="Move up"
                              style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moveHoursRow(personName, 'down') }}
                              disabled={idx === showPeopleForHours.length - 1}
                              title="Move down"
                              style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === showPeopleForHours.length - 1 ? 'not-allowed' : 'pointer', color: idx === showPeopleForHours.length - 1 ? '#d1d5db' : '#6b7280', lineHeight: 1 }}
                            >
                              ▼
                            </button>
                          </span>
                          {personName}
                        </td>
                        {hoursDays.map((d) => {
                          const dayLocked = hoursDaysCorrect.has(d)
                          const canEdit = canEditHours(personName)
                          return (
                            <td key={d} style={{ padding: '0.35rem 0.5rem', textAlign: canEdit ? 'right' : 'center' }}>
                              {!canEdit ? (
                                <span style={{ color: '#6b7280' }}>{decimalToHms(getDisplayHours(personName, d)) || '-'}</span>
                              ) : dayLocked ? (
                                <span style={{ color: '#6b7280' }} title="Day marked Correct — locked">{decimalToHms(getDisplayHours(personName, d)) || '-'}</span>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={editingHoursCell?.personName === personName && editingHoursCell?.workDate === d ? editingHoursValue : decimalToHms(getHoursForPersonDate(personName, d))}
                                  placeholder="-"
                                  onClick={(e) => e.stopPropagation()}
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
                          )
                        })}
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {decimalToHms(hoursDays.reduce((s, d) => s + getDisplayHours(personName, d), 0)) || '-'}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {(hoursDays.reduce((s, d) => s + getDisplayHours(personName, d), 0)).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot style={{ background: '#f9fafb', fontWeight: 600 }}>
                  {(() => {
                    const grandTotal = showPeopleForHours.reduce((s, p) => s + hoursDays.reduce((ds, d) => ds + getDisplayHours(p, d), 0), 0)
                    return (
                      <>
                        <tr>
                          <td style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb' }}>Total (HH:MM:SS):</td>
                          {hoursDays.map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getDisplayHours(p, d), 0)
                            return (
                              <td key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                                {decimalToHms(daySum) || '-'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                            {decimalToHms(grandTotal) || '-'}
                          </td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>-</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb' }}>Total (Decimal):</td>
                          {hoursDays.map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getDisplayHours(p, d), 0)
                            return (
                              <td key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                                {daySum.toFixed(2)}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>-</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                            {grandTotal.toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#f9fafb', fontWeight: 500, fontSize: '0.8125rem' }} title="Mark day as verified to lock from edits">Correct:</td>
                          {hoursDays.map((d) => {
                            const checked = hoursDaysCorrect.has(d)
                            return (
                              <td key={d} style={{ padding: '0.35rem 0.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title={checked ? 'Uncheck to allow edits' : 'Check to lock this day'}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleHoursDayCorrect(d)}
                                  />
                                </label>
                              </td>
                            )
                          })}
                          <td colSpan={2} style={{ padding: '0.5rem 0.5rem', borderTop: '1px solid #e5e7eb' }} />
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

      {activeTab === 'team_costs' && (canAccessPay || canViewCostMatrixShared) && (() => {
        const hasAnyCrewToday = showPeopleForMatrix.some((p) => {
          const r = crewJobsData[p] ?? { crew_lead_person_name: null, job_assignments: [] }
          return !!(r.crew_lead_person_name || (r.job_assignments?.length ?? 0) > 0)
        })
        return (
        <div>
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
              Crew Jobs
            </button>
            {crewJobsSectionOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(crewJobsDate + 'T12:00:00')
                  d.setDate(d.getDate() - 1)
                  setCrewJobsDate(d.toISOString().slice(0, 10))
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
              <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.25rem' }}>
                ({new Date(crewJobsDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })})
              </span>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(crewJobsDate + 'T12:00:00')
                  d.setDate(d.getDate() + 1)
                  setCrewJobsDate(d.toISOString().slice(0, 10))
                }}
                style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
              >
                →
              </button>
            </div>
            {!crewJobsLoading && !hasAnyCrewToday && canAccessPay && (
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
            <p style={{ color: '#6b7280' }}>No people in Cost Matrix. Go to Pay tab and check Show in Cost Matrix for people.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, marginBottom: '2rem' }}>
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
                    const isCrewLeadByOthers = showPeopleForMatrix.some((p) => {
                      const r = crewJobsData[p]
                      return r?.crew_lead_person_name === personName
                    })
                    const availableCrewLeads = showPeopleForMatrix.filter((p) => p !== personName)
                    const hasCrewLead = !!row.crew_lead_person_name
                    const jobsEditable = canAccessPay && !hasCrewLead
                    const crewEditable = canAccessPay && !isCrewLeadByOthers
                    return (
                      <tr key={personName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{personName}</td>
                        <td style={{ padding: '0.75rem', background: !crewEditable ? '#f3f4f6' : undefined }}>
                          {crewEditable ? (
                            <select
                              value={row.crew_lead_person_name ?? ''}
                              onChange={(e) => {
                                const v = e.target.value || null
                                saveCrewJobRow(personName, { ...row, crew_lead_person_name: v })
                              }}
                              style={{ padding: '0.35rem 0.5rem', minWidth: 140, border: '1px solid #d1d5db', borderRadius: 4 }}
                            >
                              <option value="">—</option>
                              {availableCrewLeads.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
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
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={a.pct}
                                      onChange={(e) => {
                                        const v = parseFloat(e.target.value) || 0
                                        const rest = row.job_assignments.filter((_, i) => i !== idx)
                                        const restSum = rest.reduce((s, x) => s + x.pct, 0)
                                        const scale = restSum > 0 ? (100 - v) / restSum : 1
                                        let newAssignments = row.job_assignments.map((x, i) =>
                                          i === idx ? { ...x, pct: v } : { ...x, pct: Math.round(x.pct * scale * 10) / 10 }
                                        )
                                        const sum = newAssignments.reduce((s, x) => s + x.pct, 0)
                                        if (Math.abs(sum - 100) > 0.01 && newAssignments.length > 0) {
                                          const lastIdx = newAssignments.length - 1
                                          newAssignments = newAssignments.map((x, i) =>
                                            i === lastIdx ? { ...x, pct: Math.round((x.pct + (100 - sum)) * 10) / 10 } : x
                                          )
                                        }
                                        saveCrewJobRow(personName, { ...row, job_assignments: newAssignments })
                                      }}
                                      style={{ width: 44, padding: '0.15rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                    />
                                    %
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const rest = row.job_assignments.filter((_, i) => i !== idx)
                                        if (rest.length === 0) {
                                          saveCrewJobRow(personName, { ...row, job_assignments: [] })
                                          return
                                        }
                                        const n = rest.length
                                        const pctEach = Math.round((100 / n) * 10) / 10
                                        const newAssignments = rest.map((x, i) => ({
                                          ...x,
                                          pct: i === n - 1 ? Math.round((100 - (n - 1) * pctEach) * 10) / 10 : pctEach,
                                        }))
                                        saveCrewJobRow(personName, { ...row, job_assignments: newAssignments })
                                      }}
                                      style={{ padding: '0.1rem 0.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1 }}
                                      title="Remove job"
                                    >
                                      ×
                                    </button>
                                  </span>
                                )
                              })}
                              <button
                                type="button"
                                onClick={() => { setCrewJobSearchModal({ personName }); setCrewJobSearchText(''); setCrewJobSearchResults([]) }}
                                style={{ padding: '0.2rem 0.5rem', border: '1px dashed #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
                              >
                                +
                              </button>
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
          </div>
            )}
          </div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Team Job Labor</h2>
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
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Job Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {teamLaborData
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
                          {r.jobAddress && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{r.jobAddress}</div>}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{r.people.join(', ') || '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setBreakdownModal({ jobId: r.jobId, jobName: r.jobName, type: 'hours' })}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2563eb', textDecoration: 'underline', fontSize: 'inherit' }}
                          >
                            {r.manHours.toFixed(2)}
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setBreakdownModal({ jobId: r.jobId, jobName: r.jobName, type: 'cost' })}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2563eb', textDecoration: 'underline', fontSize: 'inherit' }}
                          >
                            ${r.jobCost.toFixed(2)}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {teamLaborData.length === 0 && <p style={{ padding: '1rem', color: '#6b7280', margin: 0 }}>No job labor data yet. Add jobs in Crew Jobs above.</p>}
            </div>
          )}
        </div>
        )
      })()}

      {activeTab === 'vehicles' && canAccessPay && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Vehicles</h2>
            <button
              type="button"
              onClick={() => openVehicleForm()}
              style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
            >
              + Add Vehicle
            </button>
          </div>
          {vehiclesError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{vehiclesError}</p>}
          {vehiclesLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Year</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Make</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Model</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>VIN</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Ins/wk</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Reg/wk</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assigned to</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <Fragment key={v.id}>
                      <tr
                        key={v.id}
                        style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: selectedVehicleId === v.id ? '#f0f9ff' : undefined }}
                        onClick={() => setSelectedVehicleId((prev) => (prev === v.id ? null : v.id))}
                      >
                        <td style={{ padding: '0.75rem' }}>{v.year ?? '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{v.make || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{v.model || '—'}</td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8125rem' }}>{v.vin ? (v.vin.length <= 8 ? v.vin : `${v.vin.slice(0, 4)}...${v.vin.slice(-4)}`) : '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(v.weekly_insurance_cost)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(v.weekly_registration_cost)}</td>
                        <td style={{ padding: '0.75rem' }}>{vehicleAssignees[v.id] || '—'}</td>
                        <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => openVehicleForm(v)} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>Edit</button>
                          <button type="button" onClick={() => deleteVehicle(v)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', color: '#b91c1c' }}>Delete</button>
                        </td>
                      </tr>
                      {selectedVehicleId === v.id && (
                        <tr key={`${v.id}-detail`}>
                          <td colSpan={8} style={{ padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Odometer entries</h4>
                                <button type="button" onClick={() => { setOdometerFormOpen(true); setOdometerValue(''); setOdometerDate(new Date().toISOString().slice(0, 10)) }} style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>+ Add odometer entry</button>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                  <thead><tr><th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Value</th><th></th></tr></thead>
                                  <tbody>
                                    {odometerEntries.map((e) => (
                                      <tr key={e.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '0.5rem' }}>{e.read_date}</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{e.odometer_value.toLocaleString()}</td>
                                        <td style={{ padding: '0.5rem' }}><button type="button" onClick={() => deleteOdometerEntry(e)} style={{ padding: 0, background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem' }}>×</button></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Replacement value</h4>
                                <button type="button" onClick={() => { setReplacementValueFormOpen(true); setReplacementValueValue(''); setReplacementValueDate(new Date().toISOString().slice(0, 10)) }} style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>+ Add replacement value</button>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                  <thead><tr><th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Value</th><th></th></tr></thead>
                                  <tbody>
                                    {replacementValueEntries.map((e) => (
                                      <tr key={e.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '0.5rem' }}>{e.read_date}</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(e.replacement_value)}</td>
                                        <td style={{ padding: '0.5rem' }}><button type="button" onClick={() => deleteReplacementValueEntry(e)} style={{ padding: 0, background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem' }}>×</button></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>Possessions</h4>
                                <button type="button" onClick={() => { setPossessionFormOpen(true); setPossessionUserId(''); setPossessionStartDate(new Date().toISOString().slice(0, 10)); setPossessionEndDate('') }} style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>+ Assign to user</button>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                  <thead><tr><th style={{ padding: '0.5rem', textAlign: 'left' }}>User</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Start</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>End</th><th></th></tr></thead>
                                  <tbody>
                                    {possessions.map((p) => {
                                      const u = users.find((x) => x.id === p.user_id)
                                      return (
                                        <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                          <td style={{ padding: '0.5rem' }}>{u?.name ?? p.user_id.slice(0, 8)}</td>
                                          <td style={{ padding: '0.5rem' }}>{p.start_date}</td>
                                          <td style={{ padding: '0.5rem' }}>{p.end_date ?? '—'}</td>
                                          <td style={{ padding: '0.5rem' }}><button type="button" onClick={() => deletePossession(p)} style={{ padding: 0, background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem' }}>×</button></td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
                {vehicles.length > 0 && (
                  <tfoot style={{ background: '#f9fafb', fontWeight: 600 }}>
                    <tr>
                      <td colSpan={4} style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb' }}>Total</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>${formatCurrency(vehicles.reduce((s, v) => s + (v.weekly_insurance_cost ?? 0), 0))}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>${formatCurrency(vehicles.reduce((s, v) => s + (v.weekly_registration_cost ?? 0), 0))}</td>
                      <td colSpan={2} style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb' }} />
                    </tr>
                  </tfoot>
                )}
              </table>
              {vehicles.length === 0 && <p style={{ padding: '1rem', color: '#6b7280', margin: 0 }}>No vehicles yet. Add one to get started.</p>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'offsets' && canAccessPay && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Offsets</h2>
            <button
              type="button"
              onClick={() => openOffsetForm()}
              style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
            >
              + Add Offset
            </button>
          </div>
          {offsetsError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{offsetsError}</p>}
          {offsetsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offsets.map((o) => {
                    const stub = o.pay_stub_id ? payStubs.find((s) => s.id === o.pay_stub_id) : null
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{o.person_name}</td>
                        <td style={{ padding: '0.75rem' }}>{o.type === 'backcharge' ? 'Backcharge' : 'Damage'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(o.amount)}</td>
                        <td style={{ padding: '0.75rem' }}>{o.description || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{o.occurred_date}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {o.pay_stub_id ? (
                            stub ? `Applied (${stub.period_start} – ${stub.period_end})` : 'Applied'
                          ) : (
                            'Pending'
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {o.pay_stub_id ? (
                              <button
                                type="button"
                                onClick={() => unapplyOffset(o)}
                                title="Unapply"
                                aria-label="Unapply from pay stub"
                                style={{ padding: '0.35rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setOffsetToApply(o); setOffsetApplyPayStubId(''); setOffsetApplyModalOpen(true) }}
                                title="Apply to pay stub"
                                aria-label="Apply to pay stub"
                                style={{ padding: '0.35rem', cursor: 'pointer', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openOffsetForm(o)}
                              title="Edit"
                              aria-label="Edit"
                              style={{ padding: '0.35rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={16} height={16} fill="currentColor" aria-hidden="true">
                                <path d="M362.7 19.3L314.3 67.7 444.3 197.7 492.7 149.3c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18.3 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteOffset(o)}
                              title="Delete"
                              aria-label="Delete"
                              style={{ padding: '0.35rem', cursor: 'pointer', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
                                <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {offsets.length === 0 && <p style={{ padding: '1rem', color: '#6b7280', margin: 0 }}>No offsets yet. Add backcharges or damages to get started.</p>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'review' && isDev && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedReviewPersonIndex((i) => Math.max(0, i - 1))}
              disabled={showPeopleForReview.length === 0 || selectedReviewPersonIndex <= 0}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: selectedReviewPersonIndex <= 0 ? 'not-allowed' : 'pointer', opacity: selectedReviewPersonIndex <= 0 ? 0.6 : 1 }}
            >
              ← Prev
            </button>
            <span style={{ fontWeight: 500 }}>
              Person: <strong>{showPeopleForReview[selectedReviewPersonIndex] ?? '—'}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSelectedReviewPersonIndex((i) => Math.min(showPeopleForReview.length - 1, i + 1))}
              disabled={showPeopleForReview.length === 0 || selectedReviewPersonIndex >= showPeopleForReview.length - 1}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: selectedReviewPersonIndex >= showPeopleForReview.length - 1 ? 'not-allowed' : 'pointer', opacity: selectedReviewPersonIndex >= showPeopleForReview.length - 1 ? 0.6 : 1 }}
            >
              Next →
            </button>
            <select
              value={reviewPeriod}
              onChange={(e) => setReviewPeriod(e.target.value as ReviewPeriod)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_week">Last week</option>
              <option value="last_two_weeks">Last two weeks</option>
              <option value="last_month">Last month</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setTeamSummaryModalOpen(true)
                loadTeamSummaryData()
              }}
              style={{ marginLeft: 'auto', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Team Summary
            </button>
          </div>

          {showPeopleForReview.length === 0 ? (
            <p style={{ color: '#6b7280', padding: '1rem', margin: 0 }}>No people in pay config. Add people in Pay tab first.</p>
          ) : reviewLoading ? (
            <p style={{ color: '#6b7280', padding: '1rem', margin: 0 }}>Loading…</p>
          ) : (
            <>
              {(() => {
                const personName = showPeopleForReview[selectedReviewPersonIndex]
                const cfg = personName ? payConfig[personName] : undefined
                const [start, end] = getReviewDateRange()
                const days = getDaysInRange(start, end)
                const getHoursForDay = (d: string) => {
                  if (!cfg) return 0
                  const dayOfWeek = new Date(d + 'T12:00:00').getDay()
                  return cfg.is_salary
                    ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
                    : (reviewHours.find((h) => h.work_date === d)?.hours ?? 0)
                }
                const totalHours = days.reduce((s, d) => s + getHoursForDay(d), 0)
                const totalRevenue = reviewAllocatedRevenue
                const totalProfit = reviewAllocatedProfit
                const revPerHour = totalHours > 0 ? totalRevenue / totalHours : 0
                const profitPerHour = totalHours > 0 ? totalProfit / totalHours : 0
                return (
                  <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Revenue per Man Hour Delivered:</span>
                      <strong>{totalHours > 0 ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                      <span
                        title="Revenue allocated by (hours in period ÷ total job hours) × job bill, summed ÷ Total Hours"
                        aria-label="Proportional allocation: revenue attributed to period work ÷ total hours"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Profit per Man Hour Delivered:</span>
                      <strong>{totalHours > 0 ? `$${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                      <span
                        title="Profit allocated by (hours in period ÷ total job hours) × job profit, summed ÷ Total Hours"
                        aria-label="Proportional allocation: profit attributed to period work ÷ total hours"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                )
              })()}
              <section style={{ marginBottom: '1.5rem' }}>
                <h3
                  role="button"
                  tabIndex={0}
                  onClick={() => setReviewJobsWorkedCollapsed((c) => !c)}
                  onKeyDown={(e) => e.key === 'Enter' && setReviewJobsWorkedCollapsed((c) => !c)}
                  style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', userSelect: 'none' }}
                >
                  <span style={{ transform: reviewJobsWorkedCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                  Jobs Worked ({reviewLaborJobs.length + reviewCrewJobs.length})
                </h3>
                {reviewLaborJobs.length === 0 && reviewCrewJobs.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No jobs in this period.</p>
                ) : (
                  <>
                    {reviewJobsWorkedCollapsed ? (
                      <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb' }}>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Labor / Labor:</span>
                          <span style={{ fontWeight: 600 }}>{(() => {
                            const totalThisLabor = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.laborCost, 0)
                            const totalLaborByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) {
                                const total = j.subLaborCost + j.otherTeammatesLabor + j.userTotalLaborOnJob
                                totalLaborByJob.set(j.job_id, total)
                              }
                            }
                            const totalLabor = [...totalLaborByJob.values()].reduce((s, v) => s + v, 0)
                            const thisStr = totalThisLabor > 0 ? `$${Math.round(totalThisLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const totalStr = totalLabor > 0 ? `$${Math.round(totalLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            return [thisStr, totalStr].filter(Boolean).join(' / ') || '—'
                          })()}</span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Revenue / Total:</span>
                          {(() => {
                            const totalRevenue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                            const revenueBeforeOverheadByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) revenueBeforeOverheadByJob.set(j.job_id, j.revenueBeforeOverhead)
                            }
                            const totalRevBeforeOverhead = [...revenueBeforeOverheadByJob.values()].reduce((s, v) => s + v, 0)
                            const revenueStr = totalRevenue !== 0 ? `$${Math.round(totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const revBeforeStr = totalRevBeforeOverhead !== 0 ? `$${Math.round(totalRevBeforeOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const text = [revenueStr, revBeforeStr].filter(Boolean).join(' / ') || '—'
                            return <span style={{ fontWeight: 600, color: totalRevenue < 0 ? '#b91c1c' : undefined }}>{text}</span>
                          })()}
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Bill / Total:</span>
                          {(() => {
                            const totalThisBill = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                            const totalBillByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) totalBillByJob.set(j.job_id, j.totalBill)
                            }
                            const totalBill = [...totalBillByJob.values()].reduce((s, v) => s + v, 0)
                            const thisStr = totalThisBill > 0 ? `$${Math.round(totalThisBill).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const totalStr = totalBill > 0 ? `$${Math.round(totalBill).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const text = [thisStr, totalStr].filter(Boolean).join(' / ') || '—'
                            return <span style={{ fontWeight: 600 }}>{text}</span>
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead style={{ background: '#f9fafb' }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Source</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job Name / Job Address</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP# / Date</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>This Labor / Labor</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>This Revenue / Total</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>This Bill / Total</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rev/hr / Profit/hr</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reviewLaborJobs.map((j) => {
                              const key = `labor-${j.id}`
                              const expanded = reviewJobExpandedKey === key
                              const revPerHour = j.hours > 0 ? j.allocatedTotalBill / j.hours : null
                              const profitPerHour = j.hours > 0 ? j.allocatedRevenueBeforeOverhead / j.hours : null
                              const revProfitStr = revPerHour != null && profitPerHour != null
                                ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })} / $${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: '#6b7280' }}>{expanded ? '▾' : '▸'}</span>
                                        <span style={{ fontWeight: 600 }}>Labor</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{stripAddressZipState(j.address) || '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_number ?? '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{formatDateWithDay(j.job_date)}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(j.subLaborCost + j.otherTeammatesLabor + j.userTotalLaborOnJob) > 0 ? `$${formatCurrency(j.subLaborCost + j.otherTeammatesLabor + j.userTotalLaborOnJob)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontSize: '0.8125rem' }}>{revProfitStr}</div>
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                      <td colSpan={7} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: '#6b7280' }}>Total Bill to Customer</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution to Bill</span>
                                          <span>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution this Day</span>
                                          <span style={{ textDecoration: 'underline' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Total Labor on Job</span>
                                          <span>{(() => {
                                            const totalLabor = j.subLaborCost + j.otherTeammatesLabor + j.userTotalLaborOnJob
                                            const laborStr = totalLabor > 0 ? `$${formatCurrency(totalLabor)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Teams Labor:</span>
                                          <span>{(() => {
                                            const laborStr = j.otherTeammatesLabor > 0 ? `$${formatCurrency(j.otherTeammatesLabor)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Total labor on Job</span>
                                          <span>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Labor this Day</span>
                                          <span style={{ textDecoration: 'underline' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Cost Per Hour (this entry)</span>
                                          <span>{j.hours > 0 ? `$${formatCurrency(j.laborCost / j.hours)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Teammates Cost Per Hour (job avg)</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            return teammatesHours > 0 ? `$${formatCurrency(j.otherTeammatesLabor / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Teams Avg Cost Per Hour for this job</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency((j.otherTeammatesLabor + j.userTotalLaborOnJob) / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Total Revenue Before Overhead</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution to Revenue</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Revenue this Day</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Rev/hr</span>
                                          <span>{revPerHour != null ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Profit/hr</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{ color: profitPerHour != null && profitPerHour < 0 ? '#b91c1c' : undefined }}>{profitPerHour != null ? `$${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                            <span
                                              title="Rev/hr < Profit/hr when the user's cost per hour is higher than the blended crew average. They work fewer hours but have a larger share of labor cost, so: Their bill share (by hours) is relatively small. Their profit share (by cost) is relatively large. Rev/hr and Profit/hr use different allocation rules (hours vs. cost). Rev/hr can be lower than Profit/hr when the user's cost per hour is high enough that their profit share (by cost) per hour exceeds their bill share (by hours) per hour."
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                            {reviewCrewJobs.map((j) => {
                              const key = `crew-${j.job_id}-${j.work_date}`
                              const expanded = reviewJobExpandedKey === key
                              const revPerHour = j.hours > 0 ? j.allocatedTotalBill / j.hours : null
                              const profitPerHour = j.hours > 0 ? j.allocatedRevenueBeforeOverhead / j.hours : null
                              const revProfitStr = revPerHour != null && profitPerHour != null
                                ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })} / $${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: '#6b7280' }}>{expanded ? '▾' : '▸'}</span>
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{j.viaLead ? `Crew: ${j.viaLead}` : 'Crew Lead'}</div>
                                          {!j.viaLead && (j.crewMemberNames ?? []).length > 0 && (
                                            <div style={{ fontSize: '0.8em', color: '#6b7280', marginTop: '0.15rem' }}>
                                              {j.crewMemberNames!.join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{stripAddressZipState(j.job_address) || '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.hcp_number}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{formatDateWithDay(j.work_date)}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(j.subLaborCost + j.otherTeammatesLabor + j.userTotalLaborOnJob) > 0 ? `$${formatCurrency(j.subLaborCost + j.otherTeammatesLabor + j.userTotalLaborOnJob)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontSize: '0.8125rem' }}>{revProfitStr}</div>
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                      <td colSpan={7} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: '#6b7280' }}>Total Bill to Customer</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution to Bill</span>
                                          <span>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution this Day</span>
                                          <span style={{ textDecoration: 'underline' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Total Labor on Job</span>
                                          <span>{(() => {
                                            const totalLabor = j.subLaborCost + j.otherTeammatesLabor + j.userTotalLaborOnJob
                                            const laborStr = totalLabor > 0 ? `$${formatCurrency(totalLabor)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Teams Labor:</span>
                                          <span>{(() => {
                                            const laborStr = j.otherTeammatesLabor > 0 ? `$${formatCurrency(j.otherTeammatesLabor)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Total labor on Job</span>
                                          <span>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Labor this Day</span>
                                          <span style={{ textDecoration: 'underline' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Users Cost Per Hour (this entry)</span>
                                          <span>{j.hours > 0 ? `$${formatCurrency(j.laborCost / j.hours)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Teammates Cost Per Hour (job avg)</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            return teammatesHours > 0 ? `$${formatCurrency(j.otherTeammatesLabor / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Teams Avg Cost Per Hour for this job</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency((j.otherTeammatesLabor + j.userTotalLaborOnJob) / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Total Revenue Before Overhead</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Contribution to Revenue</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Users Revenue this Day</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Rev/hr</span>
                                          <span>{revPerHour != null ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Profit/hr</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{ color: profitPerHour != null && profitPerHour < 0 ? '#b91c1c' : undefined }}>{profitPerHour != null ? `$${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                            <span
                                              title="Rev/hr < Profit/hr when the user's cost per hour is higher than the blended crew average. They work fewer hours but have a larger share of labor cost, so: Their bill share (by hours) is relatively small. Their profit share (by cost) is relatively large. Rev/hr and Profit/hr use different allocation rules (hours vs. cost). Rev/hr can be lower than Profit/hr when the user's cost per hour is high enough that their profit share (by cost) per hour exceeds their bill share (by hours) per hour."
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                          <tfoot style={{ background: '#f9fafb', fontWeight: 600, borderTop: '2px solid #e5e7eb' }}>
                            <tr>
                              <td colSpan={3} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>Totals</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>{(() => {
                                  const totalThisLabor = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.laborCost, 0)
                                  return totalThisLabor > 0 ? `$${Math.round(totalThisLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const totalLaborByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) totalLaborByJob.set(j.job_id, j.subLaborCost + j.otherTeammatesLabor + j.userTotalLaborOnJob)
                                  }
                                  const totalLabor = [...totalLaborByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalLabor > 0 ? `$${Math.round(totalLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                {(() => {
                                  const totalRevenue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                                  return (
                                    <div style={{ fontWeight: 600, color: totalRevenue >= 0 ? undefined : '#b91c1c' }}>{totalRevenue !== 0 ? `$${Math.round(totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</div>
                                  )
                                })()}
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const revBeforeByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) revBeforeByJob.set(j.job_id, j.revenueBeforeOverhead)
                                  }
                                  const totalRevBeforeOverhead = [...revBeforeByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalRevBeforeOverhead !== 0 ? `$${Math.round(totalRevBeforeOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>{(() => {
                                  const totalThisBill = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                                  return totalThisBill > 0 ? `$${Math.round(totalThisBill).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const totalBillByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) totalBillByJob.set(j.job_id, j.totalBill)
                                  }
                                  const totalBill = [...totalBillByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalBill > 0 ? `$${Math.round(totalBill).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                {(() => {
                                  const totalRev = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                                  const totalProfit = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                                  const totalHrs = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                                  if (totalHrs <= 0) return '—'
                                  const revHr = totalRev / totalHrs
                                  const profitHr = totalProfit / totalHrs
                                  return `$${Math.round(revHr).toLocaleString('en-US', { maximumFractionDigits: 0 })} / $${Math.round(profitHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                                })()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3
                  role="button"
                  tabIndex={0}
                  onClick={() => setReviewHoursPayCollapsed((c) => !c)}
                  onKeyDown={(e) => e.key === 'Enter' && setReviewHoursPayCollapsed((c) => !c)}
                  style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', userSelect: 'none' }}
                >
                  <span style={{ transform: reviewHoursPayCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                  Hours and Pay
                </h3>
                {(() => {
                  const personName = showPeopleForReview[selectedReviewPersonIndex]
                  const cfg = personName ? payConfig[personName] : undefined
                  const wage = cfg?.hourly_wage ?? 0
                  const [start, end] = getReviewDateRange()
                  const days = getDaysInRange(start, end)
                  const getHoursForDay = (d: string) => {
                    if (!cfg) return 0
                    const dayOfWeek = new Date(d + 'T12:00:00').getDay()
                    return cfg.is_salary
                      ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
                      : (reviewHours.find((h) => h.work_date === d)?.hours ?? 0)
                  }
                  const totalHours = days.reduce((s, d) => s + getHoursForDay(d), 0)
                  const totalPay = personName ? getReviewPeriodPay(personName) : 0
                  if (reviewHoursPayCollapsed) {
                    return (
                      <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb' }}>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Hours:</span>
                          <span style={{ fontWeight: 600 }}>{totalHours > 0 ? decimalToHms(totalHours).replace(/:00$/, '') || '-' : '-'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Pay:</span>
                          <span style={{ fontWeight: 600 }}>{wage > 0 ? `$${Math.round(totalPay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Hours</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Pay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {days.map((d) => {
                            const hrs = getHoursForDay(d)
                            const pay = personName && wage > 0 ? getPayForPersonDate(personName, d) : 0
                            return (
                              <tr key={d} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{d}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{hrs > 0 ? decimalToHms(hrs).replace(/:00$/, '') || '-' : '-'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{wage > 0 ? `$${Math.round(pay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot style={{ background: '#f9fafb', fontWeight: 600, borderTop: '2px solid #e5e7eb' }}>
                          <tr>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>Totals</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>{totalHours > 0 ? decimalToHms(totalHours).replace(/:00$/, '') || '-' : '-'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>{wage > 0 ? `$${Math.round(totalPay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                })()}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Reports Filed ({reviewReports.length})</h3>
                {reviewReports.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No reports in this period.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Template</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Created</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewReports.map((r) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{r.template_name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{r.job_display_name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(r.created_at).toLocaleString()}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <Link to={`/jobs?report=${r.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>View</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Tasks Completed ({reviewTasks.length})</h3>
                {reviewTasks.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No tasks in this period.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Title</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Scheduled</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTasks.map((t) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{t.title}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{t.scheduled_date}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{t.completed_at ? new Date(t.completed_at).toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {offsetFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingOffset ? 'Edit offset' : 'Add offset'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Person *</label>
              <select value={offsetPersonName} onChange={(e) => setOffsetPersonName(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {[...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])].filter(Boolean).sort((a, b) => (a ?? '').localeCompare(b ?? '')).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Type *</label>
              <select value={offsetType} onChange={(e) => setOffsetType(e.target.value as 'backcharge' | 'damage')} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="backcharge">Backcharge</option>
                <option value="damage">Damage</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Amount ($) *</label>
              <input type="number" min={0} step={0.01} value={offsetAmount} onChange={(e) => setOffsetAmount(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Description</label>
              <input type="text" value={offsetDescription} onChange={(e) => setOffsetDescription(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Occurred date *</label>
              <input type="date" value={offsetOccurredDate} onChange={(e) => setOffsetOccurredDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertOffset} style={{ padding: '0.5rem 1rem' }}>Save</button>
              <button type="button" onClick={closeOffsetForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {teamSummaryModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Team Summary</h2>
              <button
                type="button"
                onClick={() => setTeamSummaryModalOpen(false)}
                style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Close
              </button>
            </div>
            {teamSummaryLoading ? (
              <p style={{ color: '#6b7280', margin: 0 }}>Loading…</p>
            ) : teamSummaryData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={teamSummaryExcludeJob000Office}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setTeamSummaryExcludeJob000Office(checked)
                      try { localStorage.setItem('teamSummaryExcludeJob000Office', String(checked)) } catch { /* ignore */ }
                      loadTeamSummaryData({ excludeJob000Office: checked })
                    }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Exclude job 000 Office from summary</span>
                </label>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Company</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Revenue per Man Hour Delivered:</span>
                    <strong>{teamSummaryData.totalHours > 0 ? `$${Math.round(teamSummaryData.totalRevenue / teamSummaryData.totalHours).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                    <span
                      title="Revenue allocated by (hours in period ÷ total job hours) × job bill, summed ÷ Total Hours"
                      aria-label="Proportional allocation: revenue attributed to period work ÷ total hours"
                      style={{ color: '#6b7280', cursor: 'help', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                      </svg>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Profit per Man Hour Delivered:</span>
                    <strong>{teamSummaryData.totalHours > 0 ? `$${Math.round(teamSummaryData.totalProfit / teamSummaryData.totalHours).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                    <span
                      title="Profit allocated by (hours in period ÷ total job hours) × job profit, summed ÷ Total Hours"
                      aria-label="Proportional allocation: profit attributed to period work ÷ total hours"
                      style={{ color: '#6b7280', cursor: 'help', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#6b7280', margin: 0 }}>No data.</p>
            )}
          </div>
        </div>
      )}

      {offsetApplyModalOpen && offsetToApply && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Apply offset to pay stub</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>Apply {offsetToApply.type} ${formatCurrency(offsetToApply.amount)} for {offsetToApply.person_name} to a pay stub:</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Pay stub</label>
              <select value={offsetApplyPayStubId} onChange={(e) => setOffsetApplyPayStubId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {payStubs.filter((s) => s.person_name === offsetToApply.person_name).sort((a, b) => b.period_start.localeCompare(a.period_start)).map((s) => (
                  <option key={s.id} value={s.id}>{s.period_start} – {s.period_end} (${formatCurrency(s.gross_pay)})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={applyOffsetToPayStub} disabled={!offsetApplyPayStubId} style={{ padding: '0.5rem 1rem' }}>Apply</button>
              <button type="button" onClick={() => { setOffsetApplyModalOpen(false); setOffsetToApply(null); setOffsetApplyPayStubId('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {vehicleFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingVehicle ? 'Edit vehicle' : 'Add vehicle'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Year *</label>
              <input type="number" min={1900} max={2100} value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Make *</label>
              <input type="text" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Model *</label>
              <input type="text" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>VIN</label>
              <input type="text" value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Weekly insurance cost</label>
              <input type="number" min={0} step={0.01} value={vehicleInsCost} onChange={(e) => setVehicleInsCost(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Weekly registration cost</label>
              <input type="number" min={0} step={0.01} value={vehicleRegCost} onChange={(e) => setVehicleRegCost(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertVehicle} style={{ padding: '0.5rem 1rem' }}>Save</button>
              <button type="button" onClick={closeVehicleForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {odometerFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Add odometer entry</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={odometerDate} onChange={(e) => setOdometerDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Value</label>
              <input type="number" min={0} step={1} value={odometerValue} onChange={(e) => setOdometerValue(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={insertOdometerEntry} style={{ padding: '0.5rem 1rem' }}>Add</button>
              <button type="button" onClick={() => { setOdometerFormOpen(false); setOdometerValue('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {replacementValueFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Add replacement value</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={replacementValueDate} onChange={(e) => setReplacementValueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Value ($)</label>
              <input type="number" min={0} step={0.01} value={replacementValueValue} onChange={(e) => setReplacementValueValue(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={insertReplacementValueEntry} style={{ padding: '0.5rem 1rem' }}>Add</button>
              <button type="button" onClick={() => { setReplacementValueFormOpen(false); setReplacementValueValue('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {possessionFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Assign to user</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>User *</label>
              <select value={possessionUserId} onChange={(e) => setPossessionUserId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {users.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Start date</label>
              <input type="date" value={possessionStartDate} onChange={(e) => setPossessionStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>End date (optional)</label>
              <input type="date" value={possessionEndDate} onChange={(e) => setPossessionEndDate(e.target.value)} placeholder="Leave blank if still in possession" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertPossession} style={{ padding: '0.5rem 1rem' }}>Assign</button>
              <button type="button" onClick={() => setPossessionFormOpen(false)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
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

      {editingUserNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: 500, width: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Edit note for {editingUserNote.name}</h3>
            <textarea
              value={editingUserNote.notes}
              onChange={(e) => setEditingUserNote((prev) => (prev ? { ...prev, notes: e.target.value } : null))}
              rows={4}
              placeholder="General note about this user..."
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', resize: 'vertical' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={async () => {
                  if (!editingUserNote) return
                  setUserNoteSaving(true)
                  setError(null)
                  const trimmed = editingUserNote.notes.trim()
                  const { error: err } = await supabase.from('users').update({ notes: trimmed || null }).eq('id', editingUserNote.id)
                  setUserNoteSaving(false)
                  if (err) setError(err.message)
                  else {
                    await loadPeople()
                    setEditingUserNote(null)
                  }
                }}
                disabled={userNoteSaving}
                style={{ padding: '0.5rem 1rem' }}
              >
                {userNoteSaving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditingUserNote(null)} disabled={userNoteSaving} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {crewJobSearchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Add job for {crewJobSearchModal.personName}</h3>
            <input
              type="search"
              placeholder="Search HCP, job name, address…"
              value={crewJobSearchText}
              onChange={(e) => setCrewJobSearchText(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {crewJobSearchResults.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => addJobToPerson(crewJobSearchModal!.personName, j)}
                  style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'left', border: 'none', borderBottom: '1px solid #e5e7eb', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  <div style={{ fontWeight: 500 }}>{j.hcp_number || '—'} · {j.job_name || '—'}</div>
                  {j.job_address && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{j.job_address}</div>}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setCrewJobSearchModal(null); setCrewJobSearchText(''); setCrewJobSearchResults([]) }} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {hoursUnassignedModal && canEditCrewJobs && (
        <HoursUnassignedModal
          personName={hoursUnassignedModal.personName}
          hoursDateStart={hoursDateStart}
          hoursDateEnd={hoursDateEnd}
          onClose={() => setHoursUnassignedModal(null)}
          onSaved={() => loadCrewJobsRef.current?.()}
          canEditCrewJobs={canEditCrewJobs}
        />
      )}


      {payStubCalendarPerson && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}
          onClick={() => setPayStubCalendarPerson(null)}
        >
          <div
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{payStubCalendarPerson} — Annual Pay to Date</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label>
                  <span style={{ marginRight: '0.35rem', fontSize: '0.875rem' }}>Year</span>
                  <select
                    value={payStubCalendarYear}
                    onChange={(e) => setPayStubCalendarYear(parseInt(e.target.value, 10))}
                    style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => setPayStubCalendarPerson(null)} style={{ padding: '0.35rem 0.75rem' }}>
                  Close
                </button>
              </div>
            </div>
            {payStubCalendarLoading ? (
              <p style={{ color: '#6b7280' }}>Loading…</p>
            ) : payStubCalendarData ? (
              <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#22c55e', marginRight: '0.25rem', verticalAlign: 'middle' }} /> Fully paid</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#eab308', marginRight: '0.25rem', verticalAlign: 'middle' }} /> Underpaid</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#f97316', marginRight: '0.25rem', verticalAlign: 'middle' }} /> Overpaid</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#e5e7eb', marginRight: '0.25rem', verticalAlign: 'middle' }} /> No hours</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#e5e7eb', border: '1px solid #e5e7eb', fontSize: '0.625rem' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} style={{ background: '#f9fafb', padding: '0.25rem', textAlign: 'center', fontWeight: 600 }}>
                      {d}
                    </div>
                  ))}
                  {(() => {
                    const jan1 = new Date(payStubCalendarYear, 0, 1)
                    const firstSunday = new Date(jan1)
                    firstSunday.setDate(jan1.getDate() - jan1.getDay())
                    const dec31 = new Date(payStubCalendarYear, 11, 31)
                    const lastSunday = new Date(dec31)
                    lastSunday.setDate(dec31.getDate() + (6 - dec31.getDay()))
                    const cells: Array<{ date: string; earned: number; paid: number } | null> = []
                    const d = new Date(firstSunday)
                    while (d <= lastSunday) {
                      const key = d.toISOString().slice(0, 10)
                      const inYear = d.getFullYear() === payStubCalendarYear
                      if (inYear && payStubCalendarData) {
                        const earned = payStubCalendarData.earnedByDate[key] ?? 0
                        const paid = payStubCalendarData.paidByDate[key] ?? 0
                        cells.push({ date: key, earned, paid })
                      } else {
                        cells.push(null)
                      }
                      d.setDate(d.getDate() + 1)
                    }
                    return cells.map((cell, idx) => {
                      if (!cell) {
                        return <div key={idx} style={{ background: '#f3f4f6', minHeight: 10 }} />
                      }
                      const { date, earned, paid } = cell
                      const tol = 0.01
                      let bg = '#e5e7eb'
                      let title = `${date}: no hours`
                      if (earned > 0 || paid > 0) {
                        if (paid > earned + tol) {
                          bg = '#f97316'
                          title = `${date}: $${formatCurrency(earned)} earned, $${formatCurrency(paid)} paid (overpaid)`
                        } else if (paid < earned - tol || (paid === 0 && earned > 0)) {
                          bg = '#eab308'
                          title = `${date}: $${formatCurrency(earned)} earned, $${formatCurrency(paid)} paid (underpaid)`
                        } else {
                          bg = '#22c55e'
                          title = `${date}: $${formatCurrency(earned)} earned, $${formatCurrency(paid)} paid`
                        }
                      }
                      return (
                        <div
                          key={idx}
                          style={{ background: bg, minHeight: 10, cursor: 'default' }}
                          title={title}
                        />
                      )
                    })
                  })()}
                </div>
                {payStubCalendarData && (
                  <div style={{ marginTop: '1rem', fontSize: '0.875rem', display: 'flex', gap: '1.5rem' }}>
                    <span>Earned YTD: ${formatCurrency(Object.values(payStubCalendarData.earnedByDate).reduce((s, v) => s + v, 0))}</span>
                    <span>Paid YTD: ${formatCurrency(Object.values(payStubCalendarData.paidByDate).reduce((s, v) => s + v, 0))}</span>
                    <span>
                      Unpaid: $
                      {formatCurrency(
                        Object.entries(payStubCalendarData.earnedByDate).reduce(
                          (s, [k, earned]) => s + Math.max(0, earned - (payStubCalendarData.paidByDate[k] ?? 0)),
                          0
                        )
                      )}
                    </span>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {breakdownModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
              Crew {breakdownModal.type === 'hours' ? 'Man Hours' : 'Job Cost'} Breakdown for Job {breakdownModal.jobName}
            </h3>
            {(() => {
              const row = teamLaborData.find((r) => r.jobId === breakdownModal.jobId)
              if (!row) return <p style={{ color: '#6b7280' }}>No data</p>
              const items = breakdownModal.type === 'hours' ? row.breakdown.map((b) => ({ ...b, value: b.hours })) : row.breakdown.map((b) => ({ ...b, value: b.cost }))
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
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{breakdownModal.type === 'hours' ? b.value.toFixed(2) : `$${b.value.toFixed(2)}`}</td>
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

    </div>
  )
}
