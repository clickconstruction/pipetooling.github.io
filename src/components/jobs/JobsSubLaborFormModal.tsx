import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type CSSProperties,
  type Dispatch,
  type ForwardedRef,
  type SetStateAction,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { assigneePersonIdsForNames } from '../../lib/people/assigneePersonIds'
import { filterLaborCrewNames, formatCurrency } from '../../lib/jobs/jobFormatting'
import { laborItemsSubtotal, lineLaborCost } from '../../lib/peopleLaborJobItemLineCost'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { buildLaborFormSubSheetHtml } from '../../lib/jobsDocuments/subLaborSheet'
import { resolvedLaborInvoiceLink } from '../../lib/jobs/jobAddressUrls'
import { SubSheetPortalFieldsBox } from './SubSheetPortalFieldsBox'
import { normalizeSubSheetStage, type SubSheetStage } from '../../lib/subSheetStage'
import { SubSheetWorkOrderPanel } from './SubSheetWorkOrderPanel'
import { WorkOrderAssemblerModal, type WorkOrderAssemblerInitial } from './WorkOrderAssemblerModal'
import {
  resolveSubLaborJobByNumber,
  subLaborAssignPickerRows,
  subLaborJobDisplayLabel,
  subLaborJobNumberForStorage,
} from '../../lib/jobs/subLaborJobPicker'
import { ScheduleDispatchAssignJobPickerModal } from '../schedule/ScheduleDispatchAssignJobPickerModal'
import type { Database } from '../../types/database'
import type { LaborJob, SubLaborBackchargeTarget, SubLaborPaymentTarget } from '../../types/laborJob'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { Person, UserRow } from '../../pages/Jobs'
import type { EditingPaymentTarget } from './SubLaborPaymentModals'

type PersonKind =
  | 'assistant'
  | 'master_technician'
  | 'sub'
  | 'helper'
  | 'estimator'
  | 'primary'
  | 'superintendent'
const KIND_TO_USER_ROLE: Record<PersonKind, string> = {
  assistant: 'assistant',
  master_technician: 'master_technician',
  sub: 'subcontractor',
  helper: 'helpers',
  estimator: 'estimator',
  primary: 'primary',
  superintendent: 'superintendent',
}

// Labor / Sub Sheet Ledger types
type ServiceType = { id: string; name: string; description: string | null; color: string | null; sequence_order: number; created_at: string; updated_at: string }
type LaborBookVersion = Database['public']['Tables']['labor_book_versions']['Row']
type LaborBookEntry = Database['public']['Tables']['labor_book_entries']['Row']
type LaborBookEntryWithFixture = LaborBookEntry & { fixture_types?: { name: string } | null }
type LaborFixtureRow = {
  id: string
  fixture: string
  count: number
  hrs_per_unit: number
  is_fixed: boolean
  labor_rate: number
  direct_labor_amount: number | null
}

import { LABOR_ASSIGNED_DELIMITER } from '../../lib/combinePeople'

/**
 * Imperative handle the parent (Jobs.tsx) uses to drive the always-mounted modal.
 * Form state lives inside this component and survives open/close, exactly as it
 * did when the modal was inline in Jobs.tsx.
 */
export type JobsSubLaborFormModalHandle = {
  /** Bare open with no form reset — preserves the old `?newJob=` deep-link behavior (`setLaborModalOpen(true)` only). */
  open: () => void
  openNew: () => void
  openEdit: (job: LaborJob) => void
  /** `openNew()` then seed the HCP field — used by the `?editLabor=` fallback. */
  openNewWithJobNumber: (jobNumber: string) => void
  /** Form side of the old `fillLaborFromBillingJobAndSwitch` (Billing tab "Add Labor" fill). */
  openWithBillingPrefill: (seed: { jobNumber: string; address: string; teamMemberNames: string[] }) => void
}

export type JobsSubLaborFormModalProps = {
  /** Parent-owned: the `?editLabor=` deep link and useSubLaborLedger's onLaborJobsReloaded sync need it. */
  editingLaborJob: LaborJob | null
  setEditingLaborJob: Dispatch<SetStateAction<LaborJob | null>>
  jobs: JobWithDetails[]
  users: UserRow[]
  people: Person[]
  loadRoster: () => Promise<void>
  loadLaborJobs: () => Promise<void>
  deleteLaborJob: (id: string) => Promise<boolean>
  laborJobDeletingId: string | null
  setLaborJobs: Dispatch<SetStateAction<LaborJob[]>>
  /** Page-global error (shared across tabs — JOBS_TABS_ARCHITECTURE.md quirk #7). */
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  /** Default Labor Rate setting (its modal stays parent-side). */
  defaultLaborRateValue: string
  setActiveTab: (tab: 'sub_sheet_ledger') => void
  /** Payment modal trio openers — routed to SubLaborPaymentModals' imperative handle by the parent. */
  onOpenMakePayment: (target: SubLaborPaymentTarget, defaultAmount: string) => void
  onOpenBackcharge: (target: SubLaborBackchargeTarget) => void
  onOpenEditPayment: (payment: EditingPaymentTarget, amountSeed: string, memoSeed: string) => void
  onClearEditPayment: () => void
  authUserId: string | undefined
  /** Saved-job print thunk (stays in the parent; the list view uses it too). */
  printJobSubSheet: (job: LaborJob) => void
  /** The board cache loads non-paid scopes only — this merges the paid scope into
   * `jobs` so the job picker's "Finished jobs" divider can include paid-in-full jobs. */
  ensurePaidJobsLoaded?: () => void
  /** True while that paid-scope fetch is in flight (picker subtitle says so). */
  paidJobsLoading?: boolean
}

function JobsSubLaborFormModalInner(
  {
    editingLaborJob,
    setEditingLaborJob,
    jobs,
    users,
    people,
    loadRoster,
    loadLaborJobs,
    deleteLaborJob,
    laborJobDeletingId,
    setLaborJobs,
    error,
    setError,
    defaultLaborRateValue,
    setActiveTab,
    onOpenMakePayment,
    onOpenBackcharge,
    onOpenEditPayment,
    onClearEditPayment,
    authUserId,
    printJobSubSheet,
    ensurePaidJobsLoaded,
    paidJobsLoading,
  }: JobsSubLaborFormModalProps,
  ref: ForwardedRef<JobsSubLaborFormModalHandle>,
) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
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
  /**
   * v2.1616: NEW entries pick the job with the standard search (required) —
   * Job # and Address derive from the pick. Storage is unchanged (job_number +
   * address text), so edit mode and every rollup keep working as before.
   */
  const [laborPickedJobId, setLaborPickedJobId] = useState<string | null>(null)
  // Work Orders tab PR 3: the sheet box opens the assembler when the sheet's job is in the cache.
  const [assemblerInitial, setAssemblerInitial] = useState<WorkOrderAssemblerInitial | null>(null)
  const sheetJobForAssembler = editingLaborJob
    ? (laborPickedJobId ? jobs.find((j) => j.id === laborPickedJobId) : undefined) ??
      jobs.find((j) => (j.hcp_number ?? '').trim().toLowerCase() === (editingLaborJob.job_number ?? '').trim().toLowerCase()) ??
      null
    : null
  /**
   * v2.1617: NEW entries walk a 3-step sheet — Job → Crew → Work and cost —
   * so the phone-width modal shows one decision at a time. Edit mode keeps
   * the classic single-scroll form. Distance is gone from new entries (saved
   * as 0; the drive-cost rollups keep honoring old rows' stored miles).
   */
  const [laborStep, setLaborStep] = useState<1 | 2 | 3>(1)
  /** v2.1618: the Job field opens the app-standard job picker (stage chips, trade pills). */
  const [laborJobPickerOpen, setLaborJobPickerOpen] = useState(false)
  const [laborJobPickerSearch, setLaborJobPickerSearch] = useState('')
  const [laborJobPickerNumberQuery, setLaborJobPickerNumberQuery] = useState('')
  const [laborDate, setLaborDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [laborFixtureEntryMode, setLaborFixtureEntryMode] = useState<'simple' | 'itemized'>('simple')
  const [laborFixtureRows, setLaborFixtureRows] = useState<LaborFixtureRow[]>([
    { id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: 20, direct_labor_amount: null },
  ])
  const [laborSaving, setLaborSaving] = useState(false)
  const [laborModalOpen, setLaborModalOpen] = useState(false)
  const [laborModalInternalSubsOpen, setLaborModalInternalSubsOpen] = useState(false)
  const [laborModalOfficeTeamOpen, setLaborModalOfficeTeamOpen] = useState(false)
  const [laborCrewSearch, setLaborCrewSearch] = useState('')
  const [laborInvoiceLinkExpanded, setLaborInvoiceLinkExpanded] = useState(false)
  const [laborInvoiceLinkDraft, setLaborInvoiceLinkDraft] = useState('')
  const [laborInvoiceLinkCommitted, setLaborInvoiceLinkCommitted] = useState('')
  const [laborInvoiceLinkSaving, setLaborInvoiceLinkSaving] = useState(false)
  const [showAddSubcontractorModal, setShowAddSubcontractorModal] = useState(false)
  const [newSubcontractor, setNewSubcontractor] = useState({ name: '', email: '', phone: '', notes: '' })
  const [addSubcontractorError, setAddSubcontractorError] = useState<string | null>(null)
  const [savingAddSubcontractor, setSavingAddSubcontractor] = useState(false)

  const laborMissingFields: string[] = []
  if (!editingLaborJob && !laborPickedJobId) laborMissingFields.push('Job')
  if (laborAssignedTo.length === 0) laborMissingFields.push('Assigned')
  if (!laborAddress.trim()) laborMissingFields.push('Address')
  if (laborFixtureEntryMode === 'simple') {
    if (
      laborFixtureRows.every((r) => {
        const hasFixture = (r.fixture ?? '').trim()
        return !hasFixture || !(Number(r.direct_labor_amount) > 0)
      })
    ) {
      laborMissingFields.push('Fixtures')
    }
  } else if (
    laborFixtureRows.every((r) => {
      const hasFixture = (r.fixture ?? '').trim()
      const isFixed = r.is_fixed ?? false
      return !hasFixture || (!isFixed && Number(r.count) <= 0)
    })
  ) {
    laborMissingFields.push('Fixtures')
  }
  const laborCanSubmit = laborMissingFields.length === 0

  async function checkDuplicateName(nameToCheck: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false
    const [peopleRes, usersRes] = await Promise.all([
      supabase.from('people').select('id, name').is('archived_at', null),
      supabase.from('users').select('id, name'),
    ])
    const hasDuplicateInPeople = peopleRes.data?.some((p) => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersRes.data?.some((u) => u.name?.toLowerCase() === trimmedName) ?? false
    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  async function handleSaveAddSubcontractor(e: React.FormEvent) {
    e.preventDefault()
    if (!authUserId) return
    setSavingAddSubcontractor(true)
    setAddSubcontractorError(null)
    const trimmedName = newSubcontractor.name.trim()
    if (!trimmedName) {
      setAddSubcontractorError('Name is required')
      setSavingAddSubcontractor(false)
      return
    }
    const isDuplicate = await checkDuplicateName(trimmedName)
    if (isDuplicate) {
      setAddSubcontractorError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
      setSavingAddSubcontractor(false)
      return
    }
    const { error: err } = await supabase
      .from('people')
      .insert({
        master_user_id: authUserId,
        kind: 'sub',
        name: trimmedName,
        email: newSubcontractor.email.trim() || null,
        phone: newSubcontractor.phone.trim() || null,
        notes: newSubcontractor.notes.trim() || null,
      })
      .select('name')
      .single()
    if (err) {
      setAddSubcontractorError(err.message)
      setSavingAddSubcontractor(false)
      return
    }
    await loadRoster()
    setLaborAssignedTo((prev) => (prev.includes(trimmedName) ? prev : [...prev, trimmedName]))
    setShowAddSubcontractorModal(false)
    setNewSubcontractor({ name: '', email: '', phone: '', notes: '' })
    setSavingAddSubcontractor(false)
  }

  function isAlreadyUser(email: string | null): boolean {
    if (!email?.trim()) return false
    const e = email.trim().toLowerCase()
    return users.some((u) => u.email && u.email.toLowerCase() === e)
  }

  /**
   * Belt-and-braces id link after an assigned_to_name write (identity Phase D,
   * same pattern as PeopleSubsTab.assignGroup): the sync trigger rebuilds the
   * junction from the name string, so this only adds rows for picked people
   * whose names resolve_pay_person_id can't map server-side. Best-effort —
   * a failure here never blocks the sheet save the user just made.
   */
  async function upsertAssigneeJunction(laborJobId: string, names: string[]) {
    const rows = assigneePersonIdsForNames(names, people, users).map((person_id) => ({
      labor_job_id: laborJobId,
      person_id,
    }))
    if (rows.length === 0) return
    await supabase
      .from('people_labor_job_assignees')
      .upsert(rows, { onConflict: 'labor_job_id,person_id', ignoreDuplicates: true })
  }

  function byKind(k: PersonKind): ({ source: 'user'; id: string; name: string; email: string | null } | ({ source: 'people' } & Person))[] {
    const userRole = KIND_TO_USER_ROLE[k]
    const fromUsers = users.filter((u) => (k === 'assistant' ? isAssistantLike(u.role) : u.role === userRole)).map((u) => ({ source: 'user' as const, id: u.id, name: u.name, email: u.email }))
    const fromPeople = people.filter((p) => p.kind === k && !isAlreadyUser(p.email)).map((p) => ({ source: 'people' as const, ...p }))
    return [...fromUsers, ...fromPeople].sort((a, b) => a.name.localeCompare(b.name))
  }

  function rosterNamesSubcontractors(): string[] {
    const fromSubs = byKind('sub')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
    const fromPrimaries = byKind('primary')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
    return [...new Set([...fromSubs, ...fromPrimaries])].sort((a, b) => a.localeCompare(b))
  }

  function rosterSubcontractorsWithAccount(): string[] {
    const fromSubs = byKind('sub')
      .filter((item) => item.source === 'user')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
    const fromPrimaries = byKind('primary')
      .filter((item) => item.source === 'user')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
    return [...new Set([...fromSubs, ...fromPrimaries])].sort((a, b) => a.localeCompare(b))
  }

  function rosterSubcontractorsWithoutAccount(): string[] {
    return byKind('sub')
      .filter((item) => item.source === 'people')
      .map((item) => item.name?.trim())
      .filter((n): n is string => !!n)
      .sort((a, b) => a.localeCompare(b))
  }

  function rosterNamesEveryoneElse(): string[] {
    const result: string[] = []
    const seen = new Set<string>()
    const kindsExceptSub: PersonKind[] = [
      'master_technician',
      'assistant',
      'estimator',
      'primary',
      'superintendent',
    ]
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

  const laborCrewSearchLower = laborCrewSearch.trim().toLowerCase()
  const laborCrewSearchActive = laborCrewSearch.trim().length > 0
  const laborModalExternalSubsAll = rosterSubcontractorsWithoutAccount()
  const laborModalExternalSubsShown = filterLaborCrewNames(laborModalExternalSubsAll, laborCrewSearchLower)
  const laborModalInternalSubsAll = rosterSubcontractorsWithAccount()
  const laborModalInternalSubsShown = filterLaborCrewNames(laborModalInternalSubsAll, laborCrewSearchLower)
  const laborModalOfficeTeamAll = rosterNamesEveryoneElse()
  const laborModalOfficeTeamShown = filterLaborCrewNames(laborModalOfficeTeamAll, laborCrewSearchLower)

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
          if (matchedTotal != null) return { ...row, hrs_per_unit: matchedTotal, direct_labor_amount: null }
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
    if (
      !(await confirmDialog({
        message: `Delete labor book "${v.name}"? This will delete all entries in this version.`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return
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
    if (
      !(await confirmDialog({
        message: `Delete "${entry.fixture_types?.name ?? ''}" from this labor book?`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return
    const { error: err } = await supabase.from('labor_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (laborBookEntriesVersionId) await loadLaborBookEntries(laborBookEntriesVersionId)
  }

  function addLaborFixtureRow() {
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        fixture: '',
        count: 1,
        hrs_per_unit: 0,
        is_fixed: false,
        labor_rate: defaultRate,
        direct_labor_amount: null,
      },
    ])
  }

  function removeLaborFixtureRow(id: string) {
    setLaborFixtureRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  }

  function updateLaborFixtureRow(id: string, updates: Partial<LaborFixtureRow>) {
    setLaborFixtureRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  async function saveLaborJob() {
    if (!authUserId) return
    const assignedNames = laborAssignedTo.map((n) => n.trim()).filter(Boolean)
    const assigned = assignedNames.join(LABOR_ASSIGNED_DELIMITER)
    const address = laborAddress.trim()

    const errors: string[] = []
    if (assignedNames.length === 0) {
      errors.push('Select at least one subcontractor or team member.')
    }
    if (!editingLaborJob && !laborPickedJobId) {
      errors.push('Pick the job this labor belongs to.')
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
      if (!hasFixture) return false
      if (laborFixtureEntryMode === 'simple') {
        return Number(r.direct_labor_amount) > 0
      }
      const isFixed = r.is_fixed ?? false
      return isFixed ? Number(r.hrs_per_unit) >= 0 : Number(r.count) > 0
    })
    if (validRows.length === 0) {
      if (laborFixtureEntryMode === 'simple') {
        const hasAnyFixture = laborFixtureRows.some((r) => (r.fixture ?? '').trim())
        const hasInvalidCost = laborFixtureRows.some(
          (r) => (r.fixture ?? '').trim() && !(Number(r.direct_labor_amount) > 0),
        )
        if (!hasAnyFixture) {
          errors.push('Add at least one line item with a description.')
        } else if (hasInvalidCost) {
          errors.push('For each line item, enter a cost greater than 0.')
        } else {
          errors.push('Add at least one valid line item.')
        }
      } else {
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
    }
    if (errors.length > 0) {
      setError(errors.length === 1 ? errors[0]! : `To save this job:\n• ${errors.join('\n• ')}`)
      return
    }
    setLaborSaving(true)
    setError(null)
    const firstRowRate = validRows[0]?.labor_rate != null ? Number(validRows[0].labor_rate) : null
    const { data: job, error: jobErr } = await supabase
      .from('people_labor_jobs')
      .insert({
        master_user_id: authUserId,
        assigned_to_name: assigned,
        address,
        job_number: laborJobNumber.trim().slice(0, 10) || null,
        labor_rate: firstRowRate,
        job_date: laborDate.trim() ? laborDate.trim() : null,
        distance_miles: parseFloat(laborDistance) || 0,
        invoice_link: resolvedLaborInvoiceLink(laborInvoiceLinkCommitted),
      })
      .select('id')
      .single()
    if (jobErr) {
      setError(jobErr.message)
      setLaborSaving(false)
      return
    }
    await upsertAssigneeJunction(job.id, assignedNames)
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i]!
      const { error: itemErr } = await supabase.from('people_labor_job_items').insert({
        job_id: job.id,
        fixture: r.fixture.trim(),
        count: laborFixtureEntryMode === 'simple' ? 1 : Number(r.count) || 1,
        hrs_per_unit: laborFixtureEntryMode === 'simple' ? 0 : Number(r.hrs_per_unit) || 0,
        is_fixed: laborFixtureEntryMode === 'simple' ? false : r.is_fixed ?? false,
        labor_rate: laborFixtureEntryMode === 'simple' ? null : r.labor_rate != null ? Number(r.labor_rate) : null,
        direct_labor_amount: laborFixtureEntryMode === 'simple' ? Number(r.direct_labor_amount) : null,
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
    setLaborPickedJobId(null)
    setLaborStep(1)
    setLaborDate(new Date().toLocaleDateString('en-CA'))
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureEntryMode('simple')
    setLaborFixtureRows([
      { id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate, direct_labor_amount: null },
    ])
    setLaborSaving(false)
    setActiveTab('sub_sheet_ledger')
    closeLaborModal()
    await loadLaborJobs()
  }

  function handleLaborFixtureEntryModeToggle(nextItemized: boolean) {
    const jobLevelFallback = editingLaborJob?.labor_rate ?? laborFixtureRows[0]?.labor_rate ?? 20
    if (nextItemized) {
      setLaborFixtureRows((prev) => prev.map((r) => ({ ...r, direct_labor_amount: null })))
      setLaborFixtureEntryMode('itemized')
    } else {
      // Itemized → simple: preserve dollar totals as direct line amounts.
      setLaborFixtureRows((prev) =>
        prev.map((r) => ({
          ...r,
          direct_labor_amount: lineLaborCost(
            {
              count: r.count,
              hrs_per_unit: r.hrs_per_unit,
              is_fixed: r.is_fixed,
              labor_rate: r.labor_rate,
              direct_labor_amount: null,
            },
            jobLevelFallback,
          ),
        })),
      )
      setLaborFixtureEntryMode('simple')
    }
  }

  function resetLaborForm() {
    setLaborAssignedTo([])
    setLaborAddress('')
    setLaborDistance('0')
    setLaborJobNumber('')
    setLaborPickedJobId(null)
    setLaborStep(1)
    setLaborDate(new Date().toLocaleDateString('en-CA'))
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureEntryMode('simple')
    setLaborFixtureRows([
      { id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate, direct_labor_amount: null },
    ])
    setLaborModalInternalSubsOpen(false)
    setLaborModalOfficeTeamOpen(false)
    setLaborCrewSearch('')
    setLaborInvoiceLinkExpanded(false)
    setLaborInvoiceLinkDraft('')
    setLaborInvoiceLinkCommitted('')
  }

  function closeLaborModal() {
    setEditingLaborJob(null)
    onClearEditPayment()
    setLaborModalOpen(false)
    setShowAddSubcontractorModal(false)
    setNewSubcontractor({ name: '', email: '', phone: '', notes: '' })
    setAddSubcontractorError(null)
    resetLaborForm()
  }

  function openEditLaborJob(job: LaborJob) {
    setLaborModalInternalSubsOpen(false)
    setLaborModalOfficeTeamOpen(false)
    setLaborCrewSearch('')
    setEditingLaborJob(job)
    const names = job.assigned_to_name
      ? job.assigned_to_name.split(LABOR_ASSIGNED_DELIMITER).map((s) => s.trim()).filter(Boolean)
      : []
    setLaborAssignedTo(names)
    setLaborAddress(job.address)
    setLaborDistance(job.distance_miles != null ? String(job.distance_miles) : '0')
    setLaborJobNumber(job.job_number ?? '')
    // v2.2142: Edit links by the typed number — the Job field shows the match
    // (address stays the sheet's own until the user picks a different job).
    setLaborPickedJobId(resolveSubLaborJobByNumber(jobs, job.job_number)?.id ?? null)
    setLaborDate(job.job_date ?? new Date().toLocaleDateString('en-CA'))
    const jobRate = job.labor_rate ?? 0
    const items = job.items ?? []
    const allDirect =
      items.length > 0 &&
      items.every((i) => i.direct_labor_amount != null && Number.isFinite(Number(i.direct_labor_amount)))
    setLaborFixtureEntryMode(allDirect ? 'simple' : 'itemized')
    const rows = items.map((i) => ({
      id: crypto.randomUUID(),
      fixture: i.fixture ?? '',
      count: Number(i.count) || 1,
      hrs_per_unit: Number(i.hrs_per_unit) || 0,
      is_fixed: i.is_fixed ?? false,
      labor_rate: i.labor_rate != null ? Number(i.labor_rate) : jobRate,
      direct_labor_amount: i.direct_labor_amount != null ? Number(i.direct_labor_amount) : null,
    }))
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureRows(
      rows.length > 0
        ? rows
        : [{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate, direct_labor_amount: null }],
    )
    const invoiceLink = job.invoice_link?.trim() ?? ''
    setLaborInvoiceLinkCommitted(invoiceLink)
    setLaborInvoiceLinkDraft(invoiceLink)
    setLaborInvoiceLinkExpanded(false)
    setError(null)
  }

  async function saveLaborInvoiceLinkDraft() {
    const resolved = resolvedLaborInvoiceLink(laborInvoiceLinkDraft)
    const committedDisplay = resolved ?? ''
    setLaborInvoiceLinkCommitted(committedDisplay)
    setLaborInvoiceLinkDraft(committedDisplay)
    setLaborInvoiceLinkExpanded(false)
    if (!editingLaborJob) return
    setLaborInvoiceLinkSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('people_labor_jobs')
      .update({ invoice_link: resolved })
      .eq('id', editingLaborJob.id)
    setLaborInvoiceLinkSaving(false)
    if (err) {
      setError(err.message)
      setLaborInvoiceLinkCommitted(editingLaborJob.invoice_link?.trim() ?? '')
      setLaborInvoiceLinkDraft(editingLaborJob.invoice_link?.trim() ?? '')
      return
    }
    setEditingLaborJob((prev) => (prev ? { ...prev, invoice_link: resolved } : prev))
    setLaborJobs((prev) =>
      prev.map((j) => (j.id === editingLaborJob.id ? { ...j, invoice_link: resolved } : j)),
    )
  }

  function cancelLaborInvoiceLinkDraft() {
    setLaborInvoiceLinkDraft(laborInvoiceLinkCommitted)
    setLaborInvoiceLinkExpanded(false)
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
      if (!hasFixture) return false
      if (laborFixtureEntryMode === 'simple') {
        return Number(r.direct_labor_amount) > 0
      }
      const isFixed = r.is_fixed ?? false
      return isFixed ? Number(r.hrs_per_unit) >= 0 : Number(r.count) > 0
    })
    if (validRows.length === 0) {
      if (laborFixtureEntryMode === 'simple') {
        const hasAnyFixture = laborFixtureRows.some((r) => (r.fixture ?? '').trim())
        const hasInvalidCost = laborFixtureRows.some(
          (r) => (r.fixture ?? '').trim() && !(Number(r.direct_labor_amount) > 0),
        )
        if (!hasAnyFixture) {
          errors.push('Add at least one line item with a description.')
        } else if (hasInvalidCost) {
          errors.push('For each line item, enter a cost greater than 0.')
        } else {
          errors.push('Add at least one valid line item.')
        }
      } else {
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
    }
    if (errors.length > 0) {
      setError(errors.length === 1 ? errors[0]! : `To save this job:\n• ${errors.join('\n• ')}`)
      return
    }
    setLaborSaving(true)
    setError(null)
    const firstRowRate = validRows[0]?.labor_rate != null ? Number(validRows[0].labor_rate) : null
    const { error: jobErr } = await supabase
      .from('people_labor_jobs')
      .update({
        assigned_to_name: assigned,
        address,
        job_number: laborJobNumber.trim().slice(0, 10) || null,
        labor_rate: firstRowRate,
        job_date: laborDate.trim() ? laborDate.trim() : null,
        distance_miles: parseFloat(laborDistance) || 0,
        invoice_link: resolvedLaborInvoiceLink(laborInvoiceLinkCommitted),
      })
      .eq('id', editingLaborJob.id)
    if (jobErr) {
      setError(jobErr.message)
      setLaborSaving(false)
      return
    }
    await upsertAssigneeJunction(editingLaborJob.id, assignedNames)
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
        count: laborFixtureEntryMode === 'simple' ? 1 : Number(r.count) || 1,
        hrs_per_unit: laborFixtureEntryMode === 'simple' ? 0 : Number(r.hrs_per_unit) || 0,
        is_fixed: laborFixtureEntryMode === 'simple' ? false : r.is_fixed ?? false,
        labor_rate: laborFixtureEntryMode === 'simple' ? null : r.labor_rate != null ? Number(r.labor_rate) : null,
        direct_labor_amount: laborFixtureEntryMode === 'simple' ? Number(r.direct_labor_amount) : null,
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
    openHtmlPrintWindow(
      buildLaborFormSubSheetHtml({
        assignedNames: laborAssignedTo,
        address: laborAddress,
        rows: laborFixtureRows,
      }),
    )
  }

  /**
   * Edit mode: the job link persists the moment it's picked (same instant-save
   * contract as the invoice-link field) — closing the modal without Save used
   * to silently drop the pick, leaving the sheet on its old number.
   */
  async function persistPickedJobForEdit(sheetId: string, job: JobWithDetails) {
    setError(null)
    const { error: err } = await supabase
      .from('people_labor_jobs')
      .update({
        job_number: subLaborJobNumberForStorage(job) || null,
        address: job.job_address ?? '',
      })
      .eq('id', sheetId)
    if (err) {
      setError(`Job change didn't save: ${err.message}`)
      return
    }
    showToast(`Sheet moved to ${subLaborJobDisplayLabel(job)} — saved`, 'success')
    await loadLaborJobs()
  }

  /** Picking a job fills Job #, Address, and pre-checks its crew (the old "fill", automatic). */
  function applyPickedLaborJob(job: JobWithDetails, opts?: { keepAssigned?: boolean }) {
    setLaborPickedJobId(job.id)
    setLaborJobNumber(subLaborJobNumberForStorage(job))
    setLaborAddress(job.job_address ?? '')
    if (opts?.keepAssigned) return
    const rosterNames = [...rosterNamesSubcontractors(), ...rosterNamesEveryoneElse()]
    const teamNames = (job.team_members ?? [])
      .map((t) => t.users?.name?.trim())
      .filter((n): n is string => !!n && rosterNames.includes(n))
    setLaborAssignedTo(teamNames)
  }

  useEffect(() => {
    if ((laborModalOpen || editingLaborJob) && authUserId) loadServiceTypes()
  }, [authUserId, laborModalOpen, editingLaborJob])

  // The jobs cache holds non-paid scopes until the board's Paid in Full section
  // expands — merge the paid scope in as the form opens so the job picker can
  // offer paid-in-full jobs (under its "Finished jobs" divider) and edit sheets
  // on paid jobs can resolve their pick.
  useEffect(() => {
    if (laborModalOpen || editingLaborJob) ensurePaidJobsLoaded?.()
  }, [laborModalOpen, editingLaborJob, ensurePaidJobsLoaded])

  // Edit mode (v2.2142): the jobs cache can arrive after the sheet opened (a
  // ?editLabor= deep link straight to the tab) — link the typed number once it
  // resolves. Only fills an empty pick; never overrides a job the user chose.
  useEffect(() => {
    if (!editingLaborJob || laborPickedJobId) return
    const match = resolveSubLaborJobByNumber(jobs, laborJobNumber)
    if (match) setLaborPickedJobId(match.id)
  }, [editingLaborJob, jobs, laborJobNumber, laborPickedJobId])

  useEffect(() => {
    if (!(laborModalOpen || editingLaborJob)) return
    if (!laborCrewSearch.trim()) return
    setLaborModalInternalSubsOpen(true)
    setLaborModalOfficeTeamOpen(true)
  }, [laborCrewSearch, laborModalOpen, editingLaborJob])

  useEffect(() => {
    if ((laborModalOpen || editingLaborJob) && selectedServiceTypeId && authUserId) {
      setLaborBookEntriesVersionId(null)
      loadFixtureTypes()
      loadLaborBookVersions()
    }
  }, [laborModalOpen, editingLaborJob, selectedServiceTypeId, authUserId])

  useEffect(() => {
    if (laborBookEntriesVersionId) loadLaborBookEntries(laborBookEntriesVersionId)
    else setLaborBookEntries([])
  }, [laborBookEntriesVersionId])

  useImperativeHandle(ref, () => ({
    open: () => setLaborModalOpen(true),
    openNew: () => openNewLaborJob(),
    openEdit: (job: LaborJob) => openEditLaborJob(job),
    openNewWithJobNumber: (jobNumber: string) => {
      openNewLaborJob()
      const match = resolveSubLaborJobByNumber(jobs, jobNumber)
      if (match) applyPickedLaborJob(match)
      else setLaborJobNumber(jobNumber)
    },
    openWithBillingPrefill: (seed) => {
      resetLaborForm()
      const match = resolveSubLaborJobByNumber(jobs, seed.jobNumber)
      if (match) applyPickedLaborJob(match, { keepAssigned: true })
      else {
        setLaborJobNumber(seed.jobNumber)
        setLaborAddress(seed.address)
      }
      const rosterNames = [...rosterNamesSubcontractors(), ...rosterNamesEveryoneElse()]
      setLaborAssignedTo(seed.teamMemberNames.filter((n) => rosterNames.includes(n)))
      setLaborModalOpen(true)
    },
  }))

  /** v2.1617 wizard: which region renders. Edit mode shows everything (classic form). */
  /** Stage moved from the portal-fields box (v2.2767): patch the ledger row + the open modal row. */
  const onLaborJobStageSaved = (stage: SubSheetStage) => {
    const targetId = editingLaborJob?.id
    if (!targetId) return
    const patch = {
      stage,
      stage_changed_at: new Date().toISOString(),
      stage_changed_by: authUserId ?? null,
      stage_source: 'office',
      stage_note: null,
      stage_changed_by_name: null,
    }
    setLaborJobs((prev) => prev.map((j) => (j.id === targetId ? { ...j, ...patch } : j)))
    setEditingLaborJob((prev) => (prev && prev.id === targetId ? { ...prev, ...patch } : prev))
  }

  const laborStepVisible = (n: 1 | 2 | 3): boolean => (editingLaborJob ? true : laborStep === n)
  /** Edit header line (v2.2142): contractor · total · due — same math as the Payments block. */
  const editSummary = editingLaborJob
    ? (() => {
        const fallback =
          editingLaborJob.labor_rate ??
          laborFixtureRows.find((r) => r.labor_rate != null && r.labor_rate !== 0)?.labor_rate ??
          20
        let total = laborItemsSubtotal(laborFixtureRows, fallback)
        const payments = editingLaborJob.payments ?? []
        const paid = payments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
        const backcharges = payments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
        if (total === 0 && (paid > 0 || backcharges > 0)) total = paid + backcharges
        const contractor = (editingLaborJob.assigned_to_name ?? '')
          .split(LABOR_ASSIGNED_DELIMITER)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(', ')
        return { contractor, total, due: total - paid - backcharges }
      })()
    : null
  const LABOR_STEP_TITLES: Record<1 | 2 | 3, string> = { 1: 'Job', 2: 'Crew', 3: 'Work and cost' }
  const laborStepNextBlocked =
    laborStep === 1 ? (!laborPickedJobId ? 'Pick the job first' : !laborAddress.trim() ? 'The job has no address — add it in Edit Job first' : null)
    : laborStep === 2 ? (laborAssignedTo.length === 0 ? 'Pick at least one contractor' : null)
    : null

  /** Crew chip (v2.1617): tap to toggle; replaces the checkbox rows in every group. */
  const renderLaborCrewChip = (n: string) => {
    const on = laborAssignedTo.includes(n)
    return (
      <button
        key={n}
        type="button"
        aria-pressed={on}
        aria-label={n}
        onClick={() => setLaborAssignedTo((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
        style={{
          padding: '0.35rem 0.8rem',
          borderRadius: 999,
          fontSize: '0.8125rem',
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          border: on ? '1px solid #2563eb' : '1px solid var(--border-strong)',
          background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
          color: on ? 'var(--text-blue-700)' : 'var(--text-700)',
        }}
      >
        {on ? '✓ ' : ''}
        {n}
      </button>
    )
  }

  return (
    <>
      {(laborModalOpen || editingLaborJob) && (
        <div style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(400px, calc(100vw - 2rem))', maxWidth: '90vw', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>{editingLaborJob ? 'Edit Sub Labor' : 'New Sub Labor'}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (editingLaborJob) {
                  saveEditedLaborJob(e)
                  return
                }
                if (laborStep < 3) {
                  if (!laborStepNextBlocked) setLaborStep((s) => (s === 1 ? 2 : 3))
                  return
                }
                saveLaborJob()
              }}
            >
              {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem', whiteSpace: 'pre-line' }}>{error}</p>}
              {editingLaborJob && editSummary ? (
                // v2.2142: which sheet is open, at a glance. The Save button
                // already spells out anything missing (same as New).
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '-0.35rem 0 0.75rem' }}>
                  {editSummary.contractor || 'No contractor'} · ${formatCurrency(editSummary.total)} ·{' '}
                  {editSummary.due > 0 ? `$${formatCurrency(editSummary.due)} due` : 'Paid'}
                </p>
              ) : (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }} aria-hidden>
                    {([1, 2, 3] as const).map((n) => (
                      <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= laborStep ? '#2563eb' : 'var(--bg-muted)' }} />
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Step {laborStep} of 3 · {LABOR_STEP_TITLES[laborStep]}
                  </p>
                </div>
              )}
              {(
                <div style={{ marginBottom: '0.75rem', display: laborStepVisible(1) ? undefined : 'none' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                    Job {!editingLaborJob ? <span style={{ color: 'var(--text-red-700)' }}>*</span> : null}
                  </label>
                  {/* v2.1618: the field opens the app-standard job picker
                      (ScheduleDispatchAssignJobPickerModal) — type in its search,
                      rows carry trade pills + stage chips; picking fills the
                      field, Address, and the crew. */}
                  {(() => {
                    const picked = laborPickedJobId ? jobs.find((j) => j.id === laborPickedJobId) : undefined
                    // v2.2142 (Edit): a typed number that matches no job — old
                    // HCP-era sheets. Kept as typed; "link" opens the search.
                    const typedUnmatched = !picked && !!editingLaborJob && laborJobNumber.trim() !== ''
                    return (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => {
                          setLaborJobPickerSearch('')
                          setLaborJobPickerNumberQuery('')
                          ensurePaidJobsLoaded?.()
                          setLaborJobPickerOpen(true)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          width: '100%',
                          padding: '0.5rem',
                          border: `1px solid ${typedUnmatched ? 'var(--text-amber-800)' : 'var(--border-strong)'}`,
                          borderRadius: 4,
                          minHeight: 38,
                          boxSizing: 'border-box',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          font: 'inherit',
                          color: picked || typedUnmatched ? 'inherit' : 'var(--text-faint)',
                        }}
                      >
                        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {picked ? (
                              subLaborJobDisplayLabel(picked)
                            ) : typedUnmatched ? (
                              <>
                                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem', color: 'var(--text-amber-800)', marginRight: 6 }}>#{laborJobNumber.trim()}</span>
                                No job with this number
                              </>
                            ) : (
                              'Search job # / name / address / customer'
                            )}
                          </span>
                          {/* v2.1621: the address is the JOB's — read-only, shown right here. */}
                          {picked && laborAddress.trim() ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {laborAddress}
                            </span>
                          ) : typedUnmatched ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Keeps the typed number until you link one</span>
                          ) : null}
                        </span>
                        <span aria-hidden style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {picked ? 'change' : typedUnmatched ? 'link' : '\u2315'}
                        </span>
                      </button>
                    )
                  })()}
                </div>
              )}
              <div style={{ display: laborStepVisible(1) ? 'flex' : 'none', gap: '1rem', flexWrap: 'wrap', justifyContent: editingLaborJob ? undefined : 'center' }}>
                {/* v2.2142: Address is typed only while no job is linked; a linked sheet shows the job's address under the Job field. */}
                {editingLaborJob && !laborPickedJobId ? (
                  <div style={{ flex: '1 1 100%', minWidth: 0 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Address <span style={{ color: 'var(--text-red-700)' }}>*</span></label>
                    <input
                      type="text"
                      value={laborAddress}
                      onChange={(e) => setLaborAddress(e.target.value)}
                      placeholder="Job address"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                    />
                  </div>
                ) : null}
                <div style={{ flex: '0 0 auto', textAlign: editingLaborJob ? undefined : 'center' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date of Labor</label>
                  {editingLaborJob ? (
                    <input
                      type="date"
                      value={laborDate}
                      onChange={(e) => setLaborDate(e.target.value)}
                      style={{ width: '11ch', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                    />
                  ) : (
                    // v2.1628: native date inputs can't render MM/DD/YY, so the
                    // short date shows as text with the real (invisible) picker
                    // stretched over it — tapping anywhere opens the calendar.
                    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '9ch', height: 38, padding: '0 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', cursor: 'pointer' }}>
                      {(() => {
                        const [y, m, d] = laborDate.split('-')
                        return m && d && y ? `${m}/${d}/${y.slice(2)}` : laborDate
                      })()}
                      <input
                        type="date"
                        value={laborDate}
                        onChange={(e) => setLaborDate(e.target.value)}
                        aria-label="Date of Labor"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                      />
                    </span>
                  )}
                </div>
                {serviceTypes.length > 1 && (
                  <div style={{ flex: '0 0 auto', textAlign: editingLaborJob ? undefined : 'center' }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Service type</label>
                    <select
                      value={selectedServiceTypeId}
                      onChange={(e) => setSelectedServiceTypeId(e.target.value)}
                      style={{ width: 'max-content', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                    >
                      {serviceTypes.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: laborStepVisible(2) ? undefined : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Crew <span style={{ color: 'var(--text-red-700)' }}>*</span></div>
                    {laborAssignedTo.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: '0.35rem' }}>
                        {laborAssignedTo.map((n) => renderLaborCrewChip(n))}
                      </div>
                    ) : null}
                    <input
                      id="labor-crew-search"
                      type="search"
                      value={laborCrewSearch}
                      onChange={(e) => setLaborCrewSearch(e.target.value)}
                      placeholder="Search for crew"
                      aria-label="Search for crew"
                      autoComplete="off"
                      style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: '24rem',
                        marginTop: '0.35rem',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        marginBottom: '0.5rem',
                        padding: '0.4rem 0.5rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        fontSize: '0.875rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {laborCrewSearchActive &&
                      laborModalExternalSubsShown.length === 0 &&
                      laborModalInternalSubsShown.length === 0 &&
                      laborModalOfficeTeamShown.length === 0 && (
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-faint)', textAlign: 'center' }}>No crew match this search</p>
                    )}
                    {(!laborCrewSearchActive || laborModalExternalSubsShown.length > 0) && (
                      <>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem', marginTop: '0.5rem' }}>External Subs</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, maxHeight: 120, overflowY: 'auto', minWidth: 0 }}>
                          {laborModalExternalSubsShown.map((n) => renderLaborCrewChip(n))}
                          {laborModalExternalSubsAll.length === 0 && <span style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>None</span>}
                        </div>
                      </>
                    )}
                    {/* v2.1628: one control row under the External Subs box — Add New
                        Sub on the left, the collapsed group toggles beside it.
                        Expanded groups render below with their own collapse toggle. */}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem 0.9rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddSubcontractorModal(true)}
                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.8125rem', fontWeight: 600, background: 'var(--surface)', color: 'var(--text-link)', border: '1px dashed var(--border-strong)', borderRadius: 999, cursor: 'pointer', flexShrink: 0 }}
                      >
                        + Add Sub
                      </button>
                      {!laborModalInternalSubsOpen && (!laborCrewSearchActive || laborModalInternalSubsShown.length > 0) && (
                        <button
                          type="button"
                          onClick={() => setLaborModalInternalSubsOpen(true)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}
                        >
                          <span style={{ fontSize: '0.75rem' }}>▶</span>
                          Internal Subs
                        </button>
                      )}
                      {!laborModalOfficeTeamOpen && (!laborCrewSearchActive || laborModalOfficeTeamShown.length > 0) && (
                        <button
                          type="button"
                          onClick={() => setLaborModalOfficeTeamOpen(true)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}
                        >
                          <span style={{ fontSize: '0.75rem' }}>▶</span>
                          Office Team
                        </button>
                      )}
                    </div>
                    {laborModalInternalSubsOpen && (!laborCrewSearchActive || laborModalInternalSubsShown.length > 0) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setLaborModalInternalSubsOpen((prev) => !prev)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: laborModalInternalSubsOpen ? 'flex-start' : 'center',
                            width: '100%',
                            gap: '0.35rem',
                            margin: 0,
                            marginTop: '0.5rem',
                            marginBottom: laborModalInternalSubsOpen ? '0.25rem' : 0,
                            padding: 0,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                          }}
                        >
                          <span style={{ fontSize: '0.75rem' }}>{laborModalInternalSubsOpen ? '▼' : '▶'}</span>
                          Internal Subs
                        </button>
                        {laborModalInternalSubsOpen && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, maxHeight: 120, overflowY: 'auto' }}>
                            {laborModalInternalSubsShown.map((n) => renderLaborCrewChip(n))}
                            {laborModalInternalSubsAll.length === 0 && <span style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>None</span>}
                          </div>
                        )}
                      </>
                    )}
                  {laborModalOfficeTeamOpen && (!laborCrewSearchActive || laborModalOfficeTeamShown.length > 0) && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setLaborModalOfficeTeamOpen((prev) => !prev)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: laborModalOfficeTeamOpen ? 'flex-start' : 'center',
                          width: '100%',
                          gap: '0.35rem',
                          margin: 0,
                          marginBottom: laborModalOfficeTeamOpen ? '0.25rem' : 0,
                          padding: 0,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem' }}>{laborModalOfficeTeamOpen ? '▼' : '▶'}</span>
                        Office Team
                      </button>
                      {laborModalOfficeTeamOpen && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, maxHeight: 120, overflowY: 'auto' }}>
                          {laborModalOfficeTeamShown.map((n) => renderLaborCrewChip(n))}
                          {laborModalOfficeTeamAll.length === 0 && <span style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>None</span>}
                        </div>
                      )}
                    </div>
                  )}
                    </div>
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: laborStepVisible(3) ? undefined : 'none' }}>
                {(() => {
                  const laborModalLineFallbackRate =
                    editingLaborJob?.labor_rate ??
                    laborFixtureRows.find((r) => r.labor_rate != null && r.labor_rate !== 0)?.labor_rate ??
                    20
                  const laborModalLinesSubtotal = laborFixtureRows.reduce(
                    (s, r) => s + lineLaborCost(r, laborModalLineFallbackRate),
                    0
                  )
                  const itemizeToggleLabel = (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        margin: 0,
                        fontWeight: 500,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={laborFixtureEntryMode === 'itemized'}
                        onChange={(e) => handleLaborFixtureEntryModeToggle(e.target.checked)}
                        style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                      />
                      <span>Itemize hours and rate</span>
                    </label>
                  )
                  const itemizeTotalsFirstCell = (
                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'middle' }}>{itemizeToggleLabel}</td>
                  )
                  const laborModalTotalHrs = laborFixtureRows.reduce((s, r) => {
                    const hrs = Number(r.hrs_per_unit) || 0
                    return s + ((r.is_fixed ?? false) ? hrs : (Number(r.count) || 0) * hrs)
                  }, 0)
                  return (
                    <>
                      <div style={laborFixtureEntryMode === 'simple' ? { border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' } : undefined}>
                        {laborFixtureEntryMode === 'simple' ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: 'var(--bg-subtle)' }}>
                              <tr>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                  Specific Work (Line Items) <span style={{ color: 'var(--text-red-700)' }}>*</span>
                                </th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)', width: 1, whiteSpace: 'nowrap' }}>
                                  Cost ($) <span style={{ color: 'var(--text-red-700)' }}>*</span>
                                </th>
                                {editingLaborJob ? <th style={{ padding: '0.5rem 0.75rem', width: 60, borderBottom: '1px solid var(--border)' }} /> : null}
                              </tr>
                            </thead>
                            <tbody>
                              {laborFixtureRows.map((row) => (
                                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    {/* v2.1629: wraps as you type (field-sizing: content
                                        auto-grows in Chromium; elsewhere it's a 1-row textarea). */}
                                    <textarea
                                      rows={1}
                                      value={row.fixture}
                                      onChange={(e) => updateLaborFixtureRow(row.id, { fixture: e.target.value })}
                                      placeholder="e.g. Toilet, Sink"
                                      style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'none', font: 'inherit', lineHeight: 1.35, boxSizing: 'border-box', ...({ fieldSizing: 'content' } as CSSProperties) }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={row.direct_labor_amount != null && row.direct_labor_amount !== 0 ? row.direct_labor_amount : ''}
                                      onChange={(e) => {
                                        const v = e.target.value.trim()
                                        updateLaborFixtureRow(row.id, {
                                          direct_labor_amount: v === '' ? null : parseFloat(v) || 0,
                                        })
                                      }}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      placeholder="0"
                                      style={{ width: `${Math.max(5, ...laborFixtureRows.map((r) => String(r.direct_labor_amount ?? '').length + 3))}ch`, padding: '0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center' }}
                                    />
                                  </td>
                                  {editingLaborJob ? (
                                    <td style={{ padding: '0.5rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => removeLaborFixtureRow(row.id)}
                                        disabled={laborFixtureRows.length <= 1}
                                        style={{
                                          padding: '0.25rem',
                                          background: 'var(--bg-red-100)',
                                          color: '#991b1c',
                                          border: 'none',
                                          borderRadius: 4,
                                          cursor: laborFixtureRows.length <= 1 ? 'not-allowed' : 'pointer',
                                          fontSize: '0.8125rem',
                                        }}
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  ) : null}
                                </tr>
                              ))}
                              <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                                {itemizeTotalsFirstCell}
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(laborModalLinesSubtotal)}</td>
                                {editingLaborJob ? <td style={{ padding: '0.5rem' }} /> : null}
                              </tr>
                            </tbody>
                          </table>
                        ) : (
                          <div>
                            {laborFixtureRows.map((row) => {
                              const isFixed = row.is_fixed ?? false
                              const hrsPerUnit = Number(row.hrs_per_unit) || 0
                              const laborHrs = isFixed ? hrsPerUnit : (Number(row.count) || 0) * hrsPerUnit
                              const tinyLabel: CSSProperties = { display: 'block', marginBottom: 2, fontSize: '0.6875rem', color: 'var(--text-muted)' }
                              const numInput: CSSProperties = { padding: '0.3rem 0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center', boxSizing: 'border-box' }
                              return (
                                <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.75rem', marginBottom: '0.5rem' }}>
                                  <label style={tinyLabel}>
                                    Specific Work <span style={{ color: 'var(--text-red-700)' }}>*</span>
                                  </label>
                                  <textarea
                                    rows={1}
                                    value={row.fixture}
                                    onChange={(e) => updateLaborFixtureRow(row.id, { fixture: e.target.value })}
                                    placeholder="e.g. Toilet, Sink"
                                    style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'none', font: 'inherit', lineHeight: 1.35, boxSizing: 'border-box', ...({ fieldSizing: 'content' } as CSSProperties) }}
                                  />
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                                    {!isFixed && (
                                      <>
                                        <div>
                                          <label style={tinyLabel}>Count</label>
                                          <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={row.count || ''}
                                            onChange={(e) => updateLaborFixtureRow(row.id, { count: parseFloat(e.target.value) || 0 })}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            style={{ ...numInput, width: '3.5rem' }}
                                          />
                                        </div>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', paddingBottom: '0.45rem' }}>×</span>
                                      </>
                                    )}
                                    <div>
                                      <label style={tinyLabel}>{isFixed ? 'Hrs' : 'Hrs each'}</label>
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.25}
                                        value={row.hrs_per_unit || ''}
                                        onChange={(e) => updateLaborFixtureRow(row.id, { hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        style={{ ...numInput, width: '4rem' }}
                                      />
                                    </div>
                                    <div>
                                      <label style={tinyLabel}>Rate $/hr</label>
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={row.labor_rate != null && row.labor_rate !== 0 ? row.labor_rate : ''}
                                        onChange={(e) => updateLaborFixtureRow(row.id, { labor_rate: parseFloat(e.target.value) || 0 })}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        placeholder="0"
                                        style={{ ...numInput, width: '4.5rem' }}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateLaborFixtureRow(row.id, { is_fixed: !isFixed })}
                                      title="Fixed hours: enter total hours directly instead of count × hours"
                                      style={{
                                        padding: '0.25rem 0.7rem',
                                        marginBottom: '0.15rem',
                                        background: 'transparent',
                                        color: isFixed ? 'var(--text-blue-500)' : 'var(--text-muted)',
                                        border: isFixed ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                                        borderRadius: 999,
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isFixed ? '✓ Fixed hrs' : 'Fixed hrs'}
                                    </button>
                                    <span style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{laborHrs.toFixed(2)} hrs</span>
                                      <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>${formatCurrency(lineLaborCost(row, laborModalLineFallbackRate))}</span>
                                    </span>
                                    {editingLaborJob ? (
                                      <button
                                        type="button"
                                        onClick={() => removeLaborFixtureRow(row.id)}
                                        disabled={laborFixtureRows.length <= 1}
                                        style={{ padding: '0.25rem 0.5rem', marginBottom: '0.15rem', background: 'var(--bg-red-100)', color: '#991b1c', border: 'none', borderRadius: 4, cursor: laborFixtureRows.length <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', flexShrink: 0 }}
                                      >
                                        Remove
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
                              {itemizeToggleLabel}
                              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{laborFixtureRows.length} {laborFixtureRows.length === 1 ? 'item' : 'items'} · {laborModalTotalHrs.toFixed(2)} hrs · </span>
                                ${formatCurrency(laborModalLinesSubtotal)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          marginTop: '0.75rem',
                        }}
                      >
                        {!editingLaborJob ? (
                          <button
                            type="button"
                            onClick={() => {
                              const last = laborFixtureRows[laborFixtureRows.length - 1]
                              if (last && laborFixtureRows.length > 1) removeLaborFixtureRow(last.id)
                            }}
                            disabled={laborFixtureRows.length <= 1}
                            title="Remove the last line item"
                            style={{
                              padding: '0.5rem 1.25rem',
                              background: laborFixtureRows.length <= 1 ? 'var(--bg-muted)' : 'var(--bg-red-100)',
                              color: laborFixtureRows.length <= 1 ? 'var(--text-faint)' : '#991b1c',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              cursor: laborFixtureRows.length <= 1 ? 'not-allowed' : 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={addLaborFixtureRow}
                          style={{
                            padding: '0.5rem 1.25rem',
                            background: 'var(--surface)',
                            color: 'var(--text-700)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 6,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          Add line item
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', minWidth: 0, marginTop: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (laborInvoiceLinkExpanded) {
                              cancelLaborInvoiceLinkDraft()
                            } else {
                              setLaborInvoiceLinkDraft(laborInvoiceLinkCommitted)
                              setLaborInvoiceLinkExpanded(true)
                            }
                          }}
                          style={{
                            padding: '0.5rem 1.25rem',
                            background: laborInvoiceLinkExpanded ? 'var(--bg-200)' : 'var(--surface)',
                            color: 'var(--text-700)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 6,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          Link Invoice
                        </button>
                        {!laborInvoiceLinkExpanded && laborInvoiceLinkCommitted.trim() ? (
                          <span
                            style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(100%, 280px)' }}
                            title={laborInvoiceLinkCommitted}
                          >
                            Linked
                          </span>
                        ) : null}
                      </div>
                      {laborInvoiceLinkExpanded ? (
                        <div
                          style={{
                            marginTop: '0.75rem',
                            padding: '0.75rem',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            background: 'var(--bg-subtle)',
                          }}
                        >
                          <label htmlFor="labor-invoice-link" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>
                            Invoice link
                          </label>
                          <input
                            id="labor-invoice-link"
                            type="url"
                            value={laborInvoiceLinkDraft}
                            onChange={(e) => setLaborInvoiceLinkDraft(e.target.value)}
                            placeholder="https://..."
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.75rem' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={cancelLaborInvoiceLinkDraft}
                              disabled={laborInvoiceLinkSaving}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: 'var(--bg-muted)',
                                color: 'var(--text-700)',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
                                cursor: laborInvoiceLinkSaving ? 'not-allowed' : 'pointer',
                                fontSize: '0.875rem',
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveLaborInvoiceLinkDraft()}
                              disabled={laborInvoiceLinkSaving}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: laborInvoiceLinkSaving ? 'not-allowed' : 'pointer',
                                fontSize: '0.875rem',
                              }}
                            >
                              {laborInvoiceLinkSaving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )
                })()}
              </div>
              {editingLaborJob && (
                <SubSheetPortalFieldsBox
                  laborJobId={editingLaborJob.id}
                  contractorName={editingLaborJob.assigned_to_name}
                  initialStage={editingLaborJob.stage ?? null}
                  initialStageChangedAt={editingLaborJob.stage_changed_at ?? null}
                  initialStageSource={editingLaborJob.stage_source ?? null}
                  initialStageNote={editingLaborJob.stage_note ?? null}
                  initialStageChangedByName={editingLaborJob.stage_changed_by_name ?? null}
                  onStageSaved={onLaborJobStageSaved}
                  initialPayableAfter={
                    (editingLaborJob as { payable_after?: string | null }).payable_after ?? null
                  }
                  initialHoldReason={
                    (editingLaborJob as { pay_hold_reason?: string | null }).pay_hold_reason ?? null
                  }
                />
              )}
              {editingLaborJob && (
                <SubSheetWorkOrderPanel
                  laborJobId={editingLaborJob.id}
                  sheet={{ job_number: editingLaborJob.job_number, address: laborAddress || editingLaborJob.address, assigned_to_name: editingLaborJob.assigned_to_name }}
                  sheetTotal={editSummary?.total ?? 0}
                  sheetOpen={editSummary?.due ?? 0}
                  sheetStage={normalizeSubSheetStage(editingLaborJob.stage)}
                  defaultServiceTypeId={
                    (laborPickedJobId ? jobs.find((j) => j.id === laborPickedJobId)?.service_type_id : null) ??
                    jobs.find((j) => (j.hcp_number ?? '').trim().toLowerCase() === (editingLaborJob.job_number ?? '').trim().toLowerCase())?.service_type_id ??
                    null
                  }
                  serviceTypes={serviceTypes.map((t) => ({ id: t.id, name: t.name }))}
                  authUserId={authUserId}
                  onChanged={() => void loadLaborJobs()}
                  onOpenAssembler={
                    sheetJobForAssembler
                      ? (init) => setAssemblerInitial({ jobId: sheetJobForAssembler.id, personId: init.personId, laborJobId: init.laborJobId, commitmentId: init.commitmentId, amount: init.amount })
                      : undefined
                  }
                />
              )}
              {editingLaborJob && sheetJobForAssembler && (
                <WorkOrderAssemblerModal
                  open={assemblerInitial != null}
                  onClose={() => setAssemblerInitial(null)}
                  jobs={jobs}
                  initial={assemblerInitial}
                  authUserId={authUserId}
                  onChanged={() => void loadLaborJobs()}
                />
              )}
              {editingLaborJob && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Payments</h4>
                  {(() => {
                    const laborModalPayFallback =
                      editingLaborJob?.labor_rate ??
                      laborFixtureRows.find((r) => r.labor_rate != null && r.labor_rate !== 0)?.labor_rate ??
                      20
                    const laborTotal = laborItemsSubtotal(laborFixtureRows, laborModalPayFallback)
                    let totalCost = laborTotal
                    const payments = editingLaborJob.payments ?? []
                    const paid = payments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
                    const backcharges = payments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
                    if (totalCost === 0 && (paid > 0 || backcharges > 0)) {
                      totalCost = paid + backcharges
                    }
                    const balance = totalCost - paid - backcharges
                    return (
                      <>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>Total cost: ${formatCurrency(totalCost)} · Paid: ${formatCurrency(paid)} · Backcharges: ${formatCurrency(backcharges)} · {balance > 0 ? `$${formatCurrency(balance)} due` : balance < 0 ? `Over $${formatCurrency(-balance)}` : '$0.00 due'}</p>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: '0.5rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: 'var(--bg-subtle)' }}>
                              <tr>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Type</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Amount</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Memo</th>
                                <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid var(--border)' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {(editingLaborJob.payments ?? []).map((p) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{p.payment_date ? new Date(p.payment_date + 'T00:00:00').toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>{Number(p.amount) < 0 ? 'Backcharge' : 'Payment'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>${formatCurrency(Number(p.amount))}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{p.memo || '—'}</td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <button type="button" onClick={() => onOpenEditPayment({ id: p.id, jobId: editingLaborJob.id, amount: Number(p.amount), memo: p.memo, isBackcharge: Number(p.amount) < 0, paymentDate: p.payment_date ?? null, createdAt: p.created_at ?? null }, String(Math.abs(Number(p.amount))), p.memo ?? '')} style={{ padding: '0.25rem', background: 'var(--bg-200)', color: 'var(--text-700)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>Edit</button>
                                  </td>
                                </tr>
                              ))}
                              {(editingLaborJob.payments ?? []).length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '0.75rem', color: 'var(--text-faint)', fontSize: '0.875rem' }}>No payments yet</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => onOpenMakePayment({ id: editingLaborJob.id, contractor: editingLaborJob.assigned_to_name, hcp: editingLaborJob.job_number ?? '—', totalCost, paid, outstanding: Math.max(0, balance) }, balance > 0 ? String(balance) : '')} style={{ padding: '0.35rem 0.75rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>Payment</button>
                          <button type="button" onClick={() => onOpenBackcharge({ id: editingLaborJob.id, contractor: editingLaborJob.assigned_to_name, hcp: editingLaborJob.job_number ?? '—', totalCost, paid })} style={{ padding: '0.35rem 0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>Backcharge</button>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
              {/* v2.1628: the Labor book belongs to Work and cost — hidden on wizard steps 1–2. */}
              <div style={{ marginTop: '1.5rem', display: laborStepVisible(3) ? undefined : 'none' }}>
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
                          style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '12rem' }}
                        >
                          {laborBookVersions.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={applyLaborBookHoursToPeople}
                        disabled={
                          applyingLaborBookHours ||
                          laborFixtureEntryMode === 'simple' ||
                          !selectedLaborBookVersionId ||
                          !laborFixtureRows.some((r) => (r.fixture ?? '').trim())
                        }
                        style={{
                          padding: '0.35rem 0.75rem',
                          background:
                            applyingLaborBookHours ||
                            laborFixtureEntryMode === 'simple' ||
                            !selectedLaborBookVersionId ||
                            !laborFixtureRows.some((r) => (r.fixture ?? '').trim())
                              ? '#9ca3af'
                              : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor:
                            applyingLaborBookHours ||
                            laborFixtureEntryMode === 'simple' ||
                            !selectedLaborBookVersionId ||
                            !laborFixtureRows.some((r) => (r.fixture ?? '').trim())
                              ? 'not-allowed'
                              : 'pointer',
                          fontSize: '0.875rem',
                        }}
                        title={laborFixtureEntryMode === 'simple' ? 'Switch to itemized mode to apply labor book hours' : undefined}
                      >
                        {applyingLaborBookHours ? 'Applying…' : 'Apply matching Labor Hours'}
                      </button>
                      {laborBookApplyMessage && (
                        <span style={{ color: 'var(--text-green-600)', fontSize: '0.875rem' }}>{laborBookApplyMessage}</span>
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
                            background: laborBookEntriesVersionId === v.id ? 'var(--bg-blue-200)' : 'var(--bg-muted)',
                            border: laborBookEntriesVersionId === v.id ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
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
                        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'var(--bg-subtle)' }}>
                              <tr>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture or Tie-in</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Rough In (hrs)</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Top Out (hrs)</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Trim Set (hrs)</th>
                                <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid var(--border)' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {laborBookEntries.map((entry) => (
                                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.5rem' }}>
                                    {entry.fixture_types?.name ?? ''}
                                    {entry.alias_names?.length ? (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
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
              {!editingLaborJob ? (
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  {laborStep === 1 ? (
                    <button
                      type="button"
                      onClick={closeLaborModal}
                      disabled={laborSaving}
                      style={{ padding: '0.6rem 1rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLaborStep((s) => (s === 3 ? 2 : 1))}
                      disabled={laborSaving}
                      style={{ padding: '0.6rem 1rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
                    >
                      Back
                    </button>
                  )}
                  {laborStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!laborStepNextBlocked) setLaborStep((s) => (s === 1 ? 2 : 3))
                      }}
                      aria-disabled={!!laborStepNextBlocked}
                      title={laborStepNextBlocked ?? undefined}
                      style={{
                        flex: 1,
                        padding: '0.6rem 1rem',
                        background: laborStepNextBlocked ? '#9ca3af' : '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: laborStepNextBlocked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {laborStepNextBlocked ?? `Next · ${LABOR_STEP_TITLES[(laborStep + 1) as 2 | 3]}`}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => printLaborSubSheet()}
                        style={{ padding: '0.6rem 1rem', background: '#4b5563', color: 'white', border: '1px solid #4b5563', borderRadius: 6, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
                      >
                        Print
                      </button>
                      <button
                        type="submit"
                        disabled={!laborCanSubmit || laborSaving}
                        title={!laborCanSubmit ? `Required: ${laborMissingFields.join(', ')}` : undefined}
                        style={{
                          flex: 1,
                          padding: '0.6rem 1rem',
                          background: laborCanSubmit && !laborSaving ? '#2563eb' : '#9ca3af',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: laborCanSubmit && !laborSaving ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {laborSaving ? 'Saving…' : !laborCanSubmit && laborMissingFields.length > 0 ? `Needs: ${laborMissingFields.join(', ')}` : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              ) : (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginTop: '1.25rem',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                {editingLaborJob && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await deleteLaborJob(editingLaborJob.id)
                      if (ok) closeLaborModal()
                    }}
                    disabled={laborJobDeletingId === editingLaborJob.id}
                    style={{
                      // v2.2142: quiet and alone on the left — away from Save.
                      marginRight: 'auto',
                      padding: '0.5rem 0.5rem 0.5rem 0',
                      background: 'transparent',
                      color: 'var(--text-red-700)',
                      border: '1px solid transparent',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: laborJobDeletingId === editingLaborJob.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {laborJobDeletingId === editingLaborJob.id ? '…' : 'Delete'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeLaborModal}
                  disabled={laborSaving}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: 'var(--surface)',
                    color: 'var(--text-700)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: laborSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => editingLaborJob ? printJobSubSheet(editingLaborJob) : printLaborSubSheet()}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: '#4b5563',
                    color: 'white',
                    border: '1px solid #4b5563',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Print
                </button>
                <button
                  type="submit"
                  disabled={!laborCanSubmit || laborSaving}
                  title={!laborCanSubmit ? `Required: ${laborMissingFields.join(', ')}` : undefined}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: laborCanSubmit && !laborSaving ? '#2563eb' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: laborCanSubmit && !laborSaving ? 'pointer' : 'not-allowed',
                  }}
                >
                  {laborSaving ? 'Saving…' : 'Save'}
                </button>
                {!laborCanSubmit && !laborSaving && laborMissingFields.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#FF6600', display: 'inline-block', textAlign: 'left' }}>
                    <span style={{ display: 'block' }}>Required:</span>
                    {laborMissingFields.map((f) => (
                      <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                    ))}
                  </span>
                )}
              </div>
              )}
            </form>
            {laborJobPickerOpen ? (
              <ScheduleDispatchAssignJobPickerModal
                open
                onClose={() => setLaborJobPickerOpen(false)}
                title="Which job is this sub labor for?"
                subtitle={
                  paidJobsLoading
                    ? 'Number, name, address or customer — loading paid-in-full jobs…'
                    : 'Number, name, address or customer — finished jobs sit under their own divider'
                }
                jobRows={subLaborAssignPickerRows(jobs, laborJobPickerSearch, laborJobPickerNumberQuery)}
                searchValue={laborJobPickerSearch}
                onSearchChange={setLaborJobPickerSearch}
                numberQuery={laborJobPickerNumberQuery}
                onNumberQueryChange={setLaborJobPickerNumberQuery}
                searchPlaceholder="Search job # / name / address / customer"
                onPickJob={(jobId) => {
                  const job = jobs.find((j) => j.id === jobId)
                  // Edit (v2.2142): the sheet's crew is already the truth — picking a job never rewrites it.
                  if (job) {
                    applyPickedLaborJob(job, { keepAssigned: !!editingLaborJob })
                    if (editingLaborJob) void persistPickedJobForEdit(editingLaborJob.id, job)
                  }
                  setLaborJobPickerOpen(false)
                }}
              />
            ) : null}
          </div>
        </div>
      )}

      {showAddSubcontractorModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Add Sub</h3>
            {addSubcontractorError && (
              <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem', fontSize: '0.875rem' }}>{addSubcontractorError}</p>
            )}
            <form onSubmit={handleSaveAddSubcontractor}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-sub-name" style={{ display: 'block', marginBottom: 4 }}>Name <span style={{ color: 'var(--text-red-700)' }}>*</span></label>
                <input
                  id="new-sub-name"
                  type="text"
                  value={newSubcontractor.name}
                  onChange={(e) => setNewSubcontractor((p) => ({ ...p, name: e.target.value }))}
                  required
                  disabled={savingAddSubcontractor}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-sub-email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                <input
                  id="new-sub-email"
                  type="email"
                  value={newSubcontractor.email}
                  onChange={(e) => setNewSubcontractor((p) => ({ ...p, email: e.target.value }))}
                  disabled={savingAddSubcontractor}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-sub-phone" style={{ display: 'block', marginBottom: 4 }}>Phone</label>
                <input
                  id="new-sub-phone"
                  type="tel"
                  value={newSubcontractor.phone}
                  onChange={(e) => setNewSubcontractor((p) => ({ ...p, phone: e.target.value }))}
                  disabled={savingAddSubcontractor}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-sub-notes" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea
                  id="new-sub-notes"
                  value={newSubcontractor.notes}
                  onChange={(e) => setNewSubcontractor((p) => ({ ...p, notes: e.target.value }))}
                  disabled={savingAddSubcontractor}
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={savingAddSubcontractor} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingAddSubcontractor ? 'not-allowed' : 'pointer' }}>
                  {savingAddSubcontractor ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSubcontractorModal(false)
                    setNewSubcontractor({ name: '', email: '', phone: '', notes: '' })
                    setAddSubcontractorError(null)
                  }}
                  disabled={savingAddSubcontractor}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {laborVersionFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={closeLaborVersionForm}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>{editingLaborVersion ? 'Edit version' : 'New version'}</h3>
            <form onSubmit={saveLaborVersion}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
              <input
                type="text"
                value={laborVersionNameInput}
                onChange={(e) => setLaborVersionNameInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g. Default"
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingLaborVersion && editingLaborVersion.name !== 'Default' && (
                    <button
                      type="button"
                      onClick={() => deleteLaborVersion(editingLaborVersion)}
                      style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete version
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={closeLaborVersionForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingLaborVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborVersion ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {laborEntryFormOpen && laborBookEntriesVersionId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={closeLaborEntryForm}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>{editingLaborEntry ? 'Edit entry' : 'New entry'}</h3>
            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>{error}</div>
            )}
            <form onSubmit={saveLaborEntry}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in *</label>
              <input
                type="text"
                list="jobs-labor-fixture-types"
                value={laborEntryFixtureName}
                onChange={(e) => setLaborEntryFixtureName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
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
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g. WC, toilet"
              />
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Rough In (hrs)</label>
                  <input type="number" min={0} step={0.25} value={laborEntryRoughIn} onChange={(e) => setLaborEntryRoughIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Top Out (hrs)</label>
                  <input type="number" min={0} step={0.25} value={laborEntryTopOut} onChange={(e) => setLaborEntryTopOut(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Trim Set (hrs)</label>
                  <input type="number" min={0} step={0.25} value={laborEntryTrimSet} onChange={(e) => setLaborEntryTrimSet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                {editingLaborEntry && (
                  <button
                    type="button"
                    onClick={() => editingLaborEntry && deleteLaborEntry(editingLaborEntry)}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', marginRight: 'auto' }}
                  >
                    Delete entry
                  </button>
                )}
                <button type="button" onClick={closeLaborEntryForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingLaborEntry} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborEntry ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * New/Edit Sub Labor modal + Add Subcontractor modal + labor-book version/entry
 * form modals, extracted verbatim from Jobs.tsx (v2.823, step 4a of the mapped
 * decomposition in docs/JOBS_TABS_ARCHITECTURE.md). Always mounted by the parent;
 * opened via the imperative handle above.
 */
const JobsSubLaborFormModal = forwardRef(JobsSubLaborFormModalInner)

export default JobsSubLaborFormModal
