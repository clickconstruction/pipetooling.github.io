import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { NO_CUSTOMER_TYPE_LABEL } from '../constants/customerTypeLabels'
import { supabase } from '../lib/supabase'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { parseCustomerImport } from '../utils/parseCustomerImport'
import { nameSimilarity } from '../utils/nameSimilarity'
import { withSupabaseRetry } from '../utils/errorHandling'
import { getDispatchNoteDisplayMeta } from '../utils/dispatchNoteDisplay'
import NewReportModal from '../components/NewReportModal'
import JobReportsModal from '../components/JobReportsModal'
import AddInspectionModal from '../components/AddInspectionModal'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { JobThreadNotesPanel } from '../components/JobThreadNotesPanel'
import { useJobThreadNotes } from '../hooks/useJobThreadNotes'
import { CrewJobsBlock } from '../components/CrewJobsBlock'
import { MoneyDecimalAmountInput } from '../components/MoneyDecimalAmountInput'
import type { Database } from '../types/database'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']
type InspectionRow = Database['public']['Tables']['inspections']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }

type JobWithDetails = JobsLedgerRow & {
  materials: JobsLedgerMaterial[]
  fixtures: JobsLedgerFixture[]
  payments: JobsLedgerPayment[]
  invoices: JobsLedgerInvoice[]
  team_members: (JobsLedgerTeamMember & { users: { name: string } | null })[]
  report_count?: number
  project?: { id: string; name: string } | null
}

type InvoiceWithJob = JobsLedgerInvoice & { job: JobWithDetails }

type StageRow =
  | { kind: 'job'; job: JobWithDetails }
  | { kind: 'invoice'; inv: JobsLedgerInvoice; job: JobWithDetails }

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

type JobsTab = 'reports' | 'stages' | 'billing' | 'sub_sheet_ledger' | 'combined-labor' | 'teams-summary' | 'parts' | 'job-summary' | 'inspections' | 'billed'

// Roster (for Labor / Sub Sheet Ledger)
type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type PersonKind =
  | 'assistant'
  | 'master_technician'
  | 'sub'
  | 'estimator'
  | 'primary'
  | 'superintendent'
const KIND_TO_USER_ROLE: Record<PersonKind, string> = {
  assistant: 'assistant',
  master_technician: 'master_technician',
  sub: 'subcontractor',
  estimator: 'estimator',
  primary: 'primary',
  superintendent: 'superintendent',
}

// Labor / Sub Sheet Ledger types
type ServiceType = { id: string; name: string; description: string | null; color: string | null; sequence_order: number; created_at: string; updated_at: string }
type LaborBookVersion = Database['public']['Tables']['labor_book_versions']['Row']
type LaborBookEntry = Database['public']['Tables']['labor_book_entries']['Row']
type LaborBookEntryWithFixture = LaborBookEntry & { fixture_types?: { name: string } | null }
type LaborFixtureRow = { id: string; fixture: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number }
type LaborJobPayment = { id: string; amount: number; memo: string | null; created_at: string }
type LaborJob = { id: string; assigned_to_name: string; address: string; job_number: string | null; labor_rate: number | null; job_date: string | null; created_at: string | null; distance_miles?: number | null; paid_at?: string | null; items?: Array<{ fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean; labor_rate?: number | null }>; payments?: LaborJobPayment[] }
type CrewJobAssignment = { job_id: string; pct: number }
type CrewJobRow = { crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }
type TeamLaborRow = { jobId: string; hcpNumber: string; jobName: string; jobAddress: string; people: string[]; manHours: number; jobCost: number; breakdown: Array<{ personName: string; hours: number; cost: number }> }

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

function formatCurrencyNoCents(n: number): string {
  return Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function sanitizeMoneyTyping(raw: string): string {
  const noComma = raw.replace(/,/g, '')
  let out = ''
  let dotSeen = false
  for (const c of noComma) {
    if (c >= '0' && c <= '9') out += c
    else if (c === '.' && !dotSeen) {
      dotSeen = true
      out += '.'
    }
  }
  return out
}

function parseMoneyInputToNumber(s: string): number {
  const t = s.replace(/,/g, '').trim()
  if (t === '' || t === '.') return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

function parseMoneyInputToNumberOrNull(s: string): number | null {
  const t = s.replace(/,/g, '').trim()
  if (t === '' || t === '.') return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

/** Calendar whole days from an ISO date/timestamp to now in UTC (avoids DST edge cases). */
function calendarDaysSinceDateUtc(dateIso: string, now = new Date()): number {
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return -1
  const fromUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const toUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((toUtc - fromUtc) / 86400000)
}

function buildClickToolingUrl(job: JobWithDetails): string {
  const params = new URLSearchParams()
  params.set('name', (job.customer_name ?? '').trim())
  params.set('email', (job.customer_email ?? '').trim())
  params.set('phone', (job.customer_phone ?? '').trim())
  params.set('location', (job.job_address ?? '').trim())
  return `https://clicktooling.com/?${params.toString()}`
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

function formatEstimatedCompletionDisplay(estimatedCompletionDate: string | null): string | null {
  if (!estimatedCompletionDate?.trim()) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(estimatedCompletionDate.trim() + 'T12:00:00')
  target.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / 86400000)
  const dayOfWeek = target.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
  if (diffDays > 0) return `T-${diffDays} (${dayOfWeek})`
  if (diffDays < 0) return `T+${Math.abs(diffDays)} (${dayOfWeek})`
  return `Today (${dayOfWeek})`
}

function addDaysToDate(dateStr: string | null, deltaDays: number): string {
  const base = dateStr?.trim() ? new Date(dateStr.trim() + 'T12:00:00') : new Date()
  base.setDate(base.getDate() + deltaDays)
  return base.toISOString().slice(0, 10)
}

/** Per-invoice est. bill date when set; else job-level est. done/bill date. */
function effectiveInvoiceEstBillDate(inv: JobsLedgerInvoice, job: JobWithDetails): string | null {
  return inv.estimated_bill_date ?? job.estimated_completion_date ?? null
}

function stageRowBilledRemainingAmount(r: StageRow): number {
  if (r.kind === 'job') {
    return Number(r.job.revenue ?? 0) - Number(r.job.payments_made ?? 0)
  }
  return Number(r.inv.amount ?? 0)
}

function stageRowBilledAgeDays(r: StageRow, now = new Date()): number | null {
  const iso =
    r.kind === 'job'
      ? r.job.estimated_completion_date ?? null
      : effectiveInvoiceEstBillDate(r.inv, r.job)
  if (!iso) return null
  const days = calendarDaysSinceDateUtc(iso, now)
  if (days < 0) return null
  return days
}

function stageRowBilledLineLabel(r: StageRow): string {
  const hcp = r.job.hcp_number || '—'
  if (r.kind === 'job') return `${hcp} · Job balance`
  return `${hcp} · Invoice #${r.inv.sequence_order}`
}

function sortStageRowsForTotalByNameDetail(rows: StageRow[]): StageRow[] {
  return [...rows].sort((a, b) => {
    const da = stageRowBilledAgeDays(a)
    const db = stageRowBilledAgeDays(b)
    if (da != null && db != null && da !== db) return db - da
    if (da != null && db == null) return -1
    if (da == null && db != null) return 1
    return stageRowBilledRemainingAmount(b) - stageRowBilledRemainingAmount(a)
  })
}

function formatYmdOrIsoDateForPrintDisplay(ymdOrIso: string): string {
  const trimmed = ymdOrIso.trim()
  const datePart = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed
  const d = new Date(`${datePart}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Reference date and whole calendar days since, for Billed Awaiting Payment printout. */
function printBilledRowReferenceDate(r: StageRow, now = new Date()): { display: string; ageDays: number | null } {
  if (r.kind === 'job') {
    const iso = r.job.estimated_completion_date?.trim() ?? null
    if (!iso) return { display: '—', ageDays: null }
    const days = calendarDaysSinceDateUtc(iso, now)
    if (days < 0) return { display: formatYmdOrIsoDateForPrintDisplay(iso), ageDays: null }
    return { display: formatYmdOrIsoDateForPrintDisplay(iso), ageDays: days }
  }
  const billedAt = r.inv.billed_at?.trim()
  if (billedAt) {
    const datePart = billedAt.length >= 10 ? billedAt.slice(0, 10) : billedAt
    const days = calendarDaysSinceDateUtc(datePart, now)
    const display = formatYmdOrIsoDateForPrintDisplay(datePart)
    if (days < 0) return { display, ageDays: null }
    return { display, ageDays: days }
  }
  const est = effectiveInvoiceEstBillDate(r.inv, r.job)
  if (!est) return { display: '—', ageDays: null }
  const days = calendarDaysSinceDateUtc(est, now)
  const display = `${formatYmdOrIsoDateForPrintDisplay(est)} (est.)`
  if (days < 0) return { display, ageDays: null }
  return { display, ageDays: days }
}

function formatPrintDaysSince(ageDays: number | null): string {
  if (ageDays == null) return '—'
  if (ageDays === 1) return '1 day'
  return `${ageDays} days`
}

type MaterialRow = { id: string; description: string; amount: number }
type PaymentRow = { id: string; amount: number; paid_on: string | null; note: string | null }

function localDateYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function newEmptyPaymentRow(): PaymentRow {
  return { id: crypto.randomUUID(), amount: 0, paid_on: localDateYYYYMMDD(), note: null }
}
type FixtureRow = { id: string; name: string; count: number }

const JOBS_TABS: JobsTab[] = ['reports', 'stages', 'billing', 'sub_sheet_ledger', 'combined-labor', 'teams-summary', 'parts', 'job-summary', 'inspections', 'billed']

const LABOR_ASSIGNED_DELIMITER = ' | '

const ADDRESS_LINE2_KEYWORDS = [
  'San Antonio', 'Seguin', 'Wimberley', 'Marion', 'Helotes', 'Taylor', 'Austin',
  'New Braunfels', 'Schertz', 'Kingsbury', 'Bastrop', 'Canyon Lake', 'Hondo',
  'Castroville', 'Shavano Park', 'Blanco',
]

const ADDRESS_STREET_SUFFIX_RE = /\b(Way|Circle|Dr\.?|Drive|Ln\.?|Lane|St\.?|Street|Rd\.?|Road|Ave\.?|Avenue|Blvd\.?|Boulevard|Ct\.?|Court|Pl\.?|Place|Ter\.?|Terrace|Trl\.?|Trail|Pkwy\.?|Parkway|Hwy\.?|Highway)\b/gi

function formatAddressTwoLines(addr: string | null): { line1: string; line2?: string } | null {
  const a = (addr ?? '').trim()
  if (!a) return null
  const lower = a.toLowerCase()
  let bestIdx = -1
  for (const kw of ADDRESS_LINE2_KEYWORDS) {
    const idx = lower.indexOf(kw.toLowerCase())
    if (idx === -1) continue
    if (kw === 'Blanco') {
      const after = a.slice(idx + 6)
      if (/^\s+Rd(\s|\.|$)/i.test(after) || /^\s+Road(\s|\.|$)/i.test(after)) continue
    }
    if (bestIdx === -1 || idx < bestIdx) bestIdx = idx
  }
  if (bestIdx !== -1 && bestIdx > 0) {
    const line1 = a.slice(0, bestIdx).trim()
    const line2 = a.slice(bestIdx).trim()
    return { line1, line2: line2 || undefined }
  }
  const commaIdx = a.indexOf(',')
  if (commaIdx !== -1) {
    const line1 = a.slice(0, commaIdx).trim()
    const line2 = a.slice(commaIdx + 1).trim()
    return { line1, line2: line2 || undefined }
  }
  let suffixEndIdx = -1
  let m: RegExpExecArray | null
  ADDRESS_STREET_SUFFIX_RE.lastIndex = 0
  while ((m = ADDRESS_STREET_SUFFIX_RE.exec(a)) !== null) {
    if (m[0].toLowerCase() === 'st' || m[0].toLowerCase() === 'st.') {
      if (m.index === 0) continue
    }
    const end = m.index + m[0].length
    if (end > suffixEndIdx) suffixEndIdx = end
  }
  if (suffixEndIdx > 0) {
    const line1 = a.slice(0, suffixEndIdx).trim()
    const line2 = a.slice(suffixEndIdx).trim()
    if (line2) return { line1, line2 }
  }
  return { line1: a }
}

function formatJobNameTwoLines(name: string | null): { line1: string; line2?: string } | null {
  const a = (name ?? '').trim()
  if (!a) return null
  const commaIdx = a.indexOf(',')
  if (commaIdx !== -1) {
    const line1 = a.slice(0, commaIdx).trim()
    const line2 = a.slice(commaIdx + 1).trim()
    return { line1, line2: line2 || undefined }
  }
  return { line1: a }
}

export default function Jobs() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: authUser, role: authRole, loading: authLoading } = useAuth()
  const { showToast } = useToastContext()
  const [activeTab, setActiveTab] = useState<JobsTab>('stages')
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [billingSortAsc, setBillingSortAsc] = useState(false) // false = highest HCP first (desc, largest to smallest)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<JobWithDetails | null>(null)
  const [hcpNumber, setHcpNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Array<{ id: string; name: string; customer_id: string; master_user_id: string; customers: { name: string } | null }>>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(false)
  const [creatingCustomerFromJob, setCreatingCustomerFromJob] = useState(false)
  const [createCustomerFromJobModalOpen, setCreateCustomerFromJobModalOpen] = useState(false)
  const [createCustomerFromJobType, setCreateCustomerFromJobType] = useState<'residential' | 'commercial'>('residential')
  const [similarCustomersForCreate, setSimilarCustomersForCreate] = useState<CustomerRow[]>([])
  const [createCustomerFromJobModalLoading, setCreateCustomerFromJobModalLoading] = useState(false)
  const [customerExpanded, setCustomerExpanded] = useState(false)
  const [dateMet, setDateMet] = useState('')
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('')
  const jobFormMissingFields: string[] = []
  if (!jobName.trim()) jobFormMissingFields.push('Job Name')
  if (!jobAddress.trim()) jobFormMissingFields.push('Job Address')
  const jobFormCanSubmit = jobFormMissingFields.length === 0
  const [googleDriveLink, setGoogleDriveLink] = useState('')
  const [jobPlansLink, setJobPlansLink] = useState('')
  const [revenue, setRevenue] = useState('')
  const [revenueInputFocused, setRevenueInputFocused] = useState(false)
  const [payments, setPayments] = useState<PaymentRow[]>(() => [newEmptyPaymentRow()])
  const [materials, setMaterials] = useState<MaterialRow[]>([{ id: crypto.randomUUID(), description: '', amount: 0 }])
  const [fixtures, setFixtures] = useState<FixtureRow[]>([{ id: crypto.randomUUID(), name: '', count: 1 }])
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])
  const [contractorsSearch, setContractorsSearch] = useState('')
  const [contractorsDropdownOpen, setContractorsDropdownOpen] = useState(false)
  const contractorsDropdownRef = useRef<HTMLDivElement | null>(null)
  const loadJobsInFlightRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newInvoiceAmount, setNewInvoiceAmount] = useState('')
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [createPartialInvoiceJob, setCreatePartialInvoiceJob] = useState<JobWithDetails | null>(null)
  const [createPartialInvoiceAmount, setCreatePartialInvoiceAmount] = useState('')
  const [creatingPartialInvoiceFromModal, setCreatingPartialInvoiceFromModal] = useState(false)

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
  const [laborDate, setLaborDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [laborFixtureRows, setLaborFixtureRows] = useState<LaborFixtureRow[]>([{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: 20 }])
  const [laborSaving, setLaborSaving] = useState(false)
  // Sub Sheet Ledger state
  const [laborJobs, setLaborJobs] = useState<LaborJob[]>([])
  const [laborJobNamesByHcp, setLaborJobNamesByHcp] = useState<Record<string, string>>({})
  const [laborJobsLoading, setLaborJobsLoading] = useState(false)
  const [laborJobDeletingId, setLaborJobDeletingId] = useState<string | null>(null)
  const [expandedSubLaborJobIds, setExpandedSubLaborJobIds] = useState<Set<string>>(new Set())
  const [makePaymentLaborJob, setMakePaymentLaborJob] = useState<{ id: string; contractor: string; hcp: string; totalCost: number; paid: number; outstanding: number } | null>(null)
  const [makePaymentAmount, setMakePaymentAmount] = useState('')
  const [makePaymentMemo, setMakePaymentMemo] = useState('')
  const [makePaymentSaving, setMakePaymentSaving] = useState(false)
  const [backchargeLaborJob, setBackchargeLaborJob] = useState<{ id: string; contractor: string; hcp: string; totalCost: number; paid: number } | null>(null)
  const [backchargeAmount, setBackchargeAmount] = useState('')
  const [backchargeMemo, setBackchargeMemo] = useState('')
  const [backchargeSaving, setBackchargeSaving] = useState(false)
  const [editingPayment, setEditingPayment] = useState<{
    id: string
    jobId: string
    amount: number
    memo: string | null
    isBackcharge: boolean
  } | null>(null)
  const [editPaymentAmount, setEditPaymentAmount] = useState('')
  const [editPaymentMemo, setEditPaymentMemo] = useState('')
  const [editPaymentSaving, setEditPaymentSaving] = useState(false)
  const [editingLaborJob, setEditingLaborJob] = useState<LaborJob | null>(null)
  const [laborModalOpen, setLaborModalOpen] = useState(false)
  const [driveSettingsOpen, setDriveSettingsOpen] = useState(false)
  const [driveMileageCost, setDriveMileageCost] = useState<number | null>(null)
  const [driveTimePerMile, setDriveTimePerMile] = useState<number | null>(null)
  const [driveSettingsSaving, setDriveSettingsSaving] = useState(false)
  const [defaultLaborRateModalOpen, setDefaultLaborRateModalOpen] = useState(false)
  const [defaultLaborRateValue, setDefaultLaborRateValue] = useState('')
  const [defaultLaborRateSaving, setDefaultLaborRateSaving] = useState(false)
  const [showAddSubcontractorModal, setShowAddSubcontractorModal] = useState(false)
  const [newSubcontractor, setNewSubcontractor] = useState({ name: '', email: '', phone: '', notes: '' })
  const [addSubcontractorError, setAddSubcontractorError] = useState<string | null>(null)
  const [savingAddSubcontractor, setSavingAddSubcontractor] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)

  const laborMissingFields: string[] = []
  if (laborAssignedTo.length === 0) laborMissingFields.push('Assigned')
  if (!laborAddress.trim()) laborMissingFields.push('Address')
  if (laborDistance.trim() === '' || isNaN(parseFloat(laborDistance)) || parseFloat(laborDistance) < 0) laborMissingFields.push('Distance')
  if (laborFixtureRows.every((r) => {
    const hasFixture = (r.fixture ?? '').trim()
    const isFixed = r.is_fixed ?? false
    return !hasFixture || (!isFixed && Number(r.count) <= 0)
  })) laborMissingFields.push('Fixtures')
  const laborCanSubmit = laborMissingFields.length === 0

  // Combined Labor tab (Team Job Labor) state
  const [teamLaborData, setTeamLaborData] = useState<TeamLaborRow[]>([])
  const [teamLaborLoading, setTeamLaborLoading] = useState(false)

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
  const [addInspectionModalOpen, setAddInspectionModalOpen] = useState(false)
  const [inspections, setInspections] = useState<InspectionRow[]>([])
  const [inspectionsLoading, setInspectionsLoading] = useState(false)
  const [inspectionsMonth, setInspectionsMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [inspectionsSelectedDay, setInspectionsSelectedDay] = useState<Date | null>(null)
  const [inspectionTypesModalOpen, setInspectionTypesModalOpen] = useState(false)
  const [inspectionTypesList, setInspectionTypesList] = useState<Array<{ name: string; sequence_order: number }>>([])
  const [inspectionTypesLoading, setInspectionTypesLoading] = useState(false)
  const [inspectionTypeFormOpen, setInspectionTypeFormOpen] = useState(false)
  const [editingInspectionTypeName, setEditingInspectionTypeName] = useState<string | null>(null)
  const [newInspectionTypeName, setNewInspectionTypeName] = useState('')
  const [inspectionTypeSaving, setInspectionTypeSaving] = useState(false)
  const [inspectionTypeDeletingName, setInspectionTypeDeletingName] = useState<string | null>(null)
  const [quickLinksModalOpen, setQuickLinksModalOpen] = useState(false)
  const [quickLinksList, setQuickLinksList] = useState<Array<{ id: string; label: string; url: string; sequence_order: number }>>([])
  const [quickLinksLoading, setQuickLinksLoading] = useState(false)
  const [quickLinkFormOpen, setQuickLinkFormOpen] = useState(false)
  const [editingQuickLinkId, setEditingQuickLinkId] = useState<string | null>(null)
  const [newQuickLinkLabel, setNewQuickLinkLabel] = useState('')
  const [newQuickLinkUrl, setNewQuickLinkUrl] = useState('')
  const [quickLinkSaving, setQuickLinkSaving] = useState(false)
  const [quickLinkDeletingId, setQuickLinkDeletingId] = useState<string | null>(null)
  const [tallyParts, setTallyParts] = useState<TallyPartRow[]>([])
  const [tallyPartsLoading, setTallyPartsLoading] = useState(false)
  const [invoiceAmountByJob, setInvoiceAmountByJob] = useState<Record<string, number>>({})
  const [tallyPartsSearch, setTallyPartsSearch] = useState('')
  const [showMyJobsOnly, setShowMyJobsOnly] = useState(false)
  const [subLaborSearch, setSubLaborSearch] = useState('')
  const [jobSummarySearch, setJobSummarySearch] = useState('')
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
  const [billedTotalByNameModalOpen, setBilledTotalByNameModalOpen] = useState(false)
  const [billedTotalByNameExpandedName, setBilledTotalByNameExpandedName] = useState<string | null>(null)
  const [capableToBillModalOpen, setCapableToBillModalOpen] = useState(false)
  const [whenBilledModalJob, setWhenBilledModalJob] = useState<JobWithDetails | null>(null)
  const [whenBilledModalDate, setWhenBilledModalDate] = useState('')
  const [whenInvoiceBillModal, setWhenInvoiceBillModal] = useState<{
    invoiceId: string
    jobId: string
    jobName: string
    hcpNumber: string
  } | null>(null)
  const [whenInvoiceBillModalDate, setWhenInvoiceBillModalDate] = useState('')
  const [invoiceEstimatedBillDateSavingId, setInvoiceEstimatedBillDateSavingId] = useState<string | null>(null)
  const [stagesSearchQuery, setStagesSearchQuery] = useState('')
  const [stagesStatusUpdatingId, setStagesStatusUpdatingId] = useState<string | null>(null)
  const [stagesInvoiceUpdatingId, setStagesInvoiceUpdatingId] = useState<string | null>(null)
  const [viewReportsJob, setViewReportsJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [readyForBillingJob, setReadyForBillingJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [readyForBillingChecked1, setReadyForBillingChecked1] = useState(false)
  const [readyForBillingChecked2, setReadyForBillingChecked2] = useState(false)
  const [markAsBilledJob, setMarkAsBilledJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [markAsBilledChecked, setMarkAsBilledChecked] = useState(false)
  const [markAsBilledInvoice, setMarkAsBilledInvoice] = useState<InvoiceWithJob | null>(null)
  const [markPaidJob, setMarkPaidJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [markPaidChecked, setMarkPaidChecked] = useState(false)
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceWithJob | null>(null)
  const [sendBackJob, setSendBackJob] = useState<{ id: string; hcpNumber: string; jobName: string; toStatus: 'working' | 'ready_to_bill' } | null>(null)
  const [sendBackInvoice, setSendBackInvoice] = useState<{ inv: InvoiceWithJob; action: 'delete' | 'revert' } | null>(null)
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
  const [pctCompleteSavingId, setPctCompleteSavingId] = useState<string | null>(null)
  const [estimatedCompletionDateSavingId, setEstimatedCompletionDateSavingId] = useState<string | null>(null)
  const assignedEditDropdownRef = useRef<HTMLDivElement | null>(null)
  const jobNameInputRef = useRef<HTMLInputElement | null>(null)
  const jobAddressInputRef = useRef<HTMLInputElement | null>(null)

  const stagesFilteredJobs = useMemo(() => {
    const q = stagesSearchQuery.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter(
      (j) =>
        (j.hcp_number ?? '').toLowerCase().includes(q) ||
        (j.job_name ?? '').toLowerCase().includes(q) ||
        (j.job_address ?? '').toLowerCase().includes(q)
    )
  }, [jobs, stagesSearchQuery])

  const billedAgingBuckets = useMemo(() => {
    const st = (j: JobWithDetails) => (j.status ?? 'working') as string
    const filtered = stagesFilteredJobs
    const billedJobsList = filtered.filter((j) => st(j) === 'billed')
    const billedInvoicesList = filtered.flatMap((j) =>
      (j.invoices ?? []).filter((i) => i.status === 'billed').map((inv) => ({ ...inv, job: j }))
    )
    const now = new Date()
    let count30_90 = 0
    let sum30_90 = 0
    let count90 = 0
    let sum90 = 0
    for (const j of billedJobsList) {
      const iso = j.estimated_completion_date
      if (!iso) continue
      const days = calendarDaysSinceDateUtc(iso, now)
      if (days < 30) continue
      const amount = Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)
      if (days < 90) {
        count30_90++
        sum30_90 += amount
      } else {
        count90++
        sum90 += amount
      }
    }
    for (const inv of billedInvoicesList) {
      const iso = effectiveInvoiceEstBillDate(inv, inv.job)
      if (!iso) continue
      const days = calendarDaysSinceDateUtc(iso, now)
      if (days < 30) continue
      const amount = Number(inv.amount ?? 0)
      if (days < 90) {
        count30_90++
        sum30_90 += amount
      } else {
        count90++
        sum90 += amount
      }
    }
    return { count30_90, sum30_90, count90, sum90 }
  }, [stagesFilteredJobs])

  const {
    expandedJobThreadId,
    setExpandedJobThreadId,
    jobThreadNotesByJobId,
    jobThreadNotesLoadingId,
    jobThreadSubmittingId,
    jobThreadDraft,
    setJobThreadDraft,
    submitJobThreadNote,
    jobThreadStatsByJobId,
    refreshJobThreadStatsForJobIds,
  } = useJobThreadNotes(showToast, authUser?.id)

  useEffect(() => {
    if (!authUser?.id || activeTab !== 'stages') return
    const ids = [...new Set(stagesFilteredJobs.map((j) => j.id))]
    void refreshJobThreadStatsForJobIds(ids)
  }, [authUser?.id, activeTab, stagesFilteredJobs, refreshJobThreadStatsForJobIds])

  function getCustomerDisplay(c: CustomerRow): string {
    if (c.address) return `${c.name} - ${c.address}`
    return c.name
  }

  function extractContactFromCustomer(c: CustomerRow): { phone: string; email: string } {
    const ci = c.contact_info
    if (ci == null || typeof ci !== 'object') return { phone: '', email: '' }
    const obj = ci as Record<string, unknown>
    return {
      phone: typeof obj.phone === 'string' ? obj.phone : '',
      email: typeof obj.email === 'string' ? obj.email : '',
    }
  }

  /** True when loaded customers include exactly one row matching name (prefer same master_user_id as the job). */
  function customerListImpliesLinkedRow(customersList: CustomerRow[], jobMasterUserId: string, customerNameTrimmed: string): boolean {
    const nameKey = customerNameTrimmed.trim().toLowerCase()
    if (!nameKey) return false
    const byName = customersList.filter((c) => (c.name ?? '').trim().toLowerCase() === nameKey)
    const byMaster = byName.filter((c) => c.master_user_id === jobMasterUserId)
    if (byMaster.length === 1) return true
    if (byMaster.length === 0 && byName.length === 1) return true
    return false
  }

  function customerTypeShortLabel(c: CustomerRow): string | null {
    const t = c.customer_type
    if (t === 'residential' || t === 'commercial') return t.charAt(0).toUpperCase() + t.slice(1)
    if (t == null || t === '') return NO_CUSTOMER_TYPE_LABEL
    return t
  }

  /** When saving, link job to the single customer row for this master with the same name (case-insensitive). */
  function resolveCustomerIdForPayload(explicitId: string | null, jobMasterUserId: string, nameTrimmed: string): string | null {
    if (explicitId) return explicitId
    const nameKey = nameTrimmed.trim().toLowerCase()
    if (!nameKey) return null
    const matches = customers.filter(
      (c) => c.master_user_id === jobMasterUserId && (c.name ?? '').trim().toLowerCase() === nameKey,
    )
    const only = matches.length === 1 ? matches[0] : null
    return only?.id ?? null
  }

  async function loadJobs() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    if (loadJobsInFlightRef.current) return
    loadJobsInFlightRef.current = true
    setLoading(true)
    setError(null)
    try {
    const customerFilter = searchParams.get('customer')
    let query = supabase
      .from('jobs_ledger')
      .select(
        `
        *,
        jobs_ledger_materials(*),
        jobs_ledger_fixtures(*),
        jobs_ledger_payments(*),
        jobs_ledger_invoices(*),
        jobs_ledger_team_members(*, users(name)),
        reports(job_ledger_id),
        projects:project_id(id, name)
      `
      )
      .order('hcp_number', { ascending: false })
    if (customerFilter) {
      query = query.eq('customer_id', customerFilter)
    }
    const { data, error: jobsErr } = await query
    if (jobsErr) {
      setError(jobsErr.message)
      setLoading(false)
      return []
    }
    const rows = (data ?? []) as Array<
      JobsLedgerRow & {
        jobs_ledger_materials?: JobsLedgerMaterial[]
        jobs_ledger_fixtures?: JobsLedgerFixture[]
        jobs_ledger_payments?: JobsLedgerPayment[]
        jobs_ledger_invoices?: JobsLedgerInvoice[]
        jobs_ledger_team_members?: (JobsLedgerTeamMember & { users: { name: string } | null })[]
        reports?: Array<{ job_ledger_id: string | null }>
        projects?: { id: string; name: string } | null
      }
    >
    if (rows.length === 0) {
      setJobs([])
      setLoading(false)
      return []
    }
    const jobsWithDetails: JobWithDetails[] = rows.map((row) => {
      const {
        jobs_ledger_materials: mat,
        jobs_ledger_fixtures: fix,
        jobs_ledger_payments: pay,
        jobs_ledger_invoices: inv,
        jobs_ledger_team_members: team,
        reports: rep,
        projects: proj,
        ...job
      } = row
      return {
        ...job,
        materials: (mat ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
        fixtures: (fix ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
        payments: (pay ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
        invoices: (inv ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
        team_members: team ?? [],
        report_count: (rep ?? []).length,
        project: proj ?? null,
      }
    })
    setJobs(jobsWithDetails)
    setLoading(false)
    return jobsWithDetails
    } finally {
      loadJobsInFlightRef.current = false
    }
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

  async function updateInvoiceStatus(invoiceId: string, status: 'ready_to_bill' | 'billed') {
    setStagesInvoiceUpdatingId(invoiceId)
    setError(null)
    try {
      const { error: err } = await supabase.from('jobs_ledger_invoices').update({ status }).eq('id', invoiceId)
      if (err) throw err
      await loadJobs()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update invoice')
    } finally {
      setStagesInvoiceUpdatingId(null)
    }
  }

  async function deleteInvoice(invoiceId: string) {
    setStagesInvoiceUpdatingId(invoiceId)
    setError(null)
    try {
      const { error: err } = await supabase.from('jobs_ledger_invoices').delete().eq('id', invoiceId)
      if (err) throw err
      await loadJobs()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete invoice')
    } finally {
      setStagesInvoiceUpdatingId(null)
    }
  }

  async function markInvoicePaid(invoiceId: string) {
    setStagesInvoiceUpdatingId(invoiceId)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('mark_invoice_paid', { p_invoice_id: invoiceId })
      if (err) throw err
      const result = data as { error?: string } | null
      if (result?.error) throw new Error(result.error)
      await loadJobs()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to mark invoice paid')
    } finally {
      setStagesInvoiceUpdatingId(null)
    }
  }

  async function markJobPaid(jobId: string) {
    setStagesStatusUpdatingId(jobId)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('mark_job_paid', { p_job_id: jobId })
      if (err) throw err
      const result = data as { error?: string } | null
      if (result?.error) throw new Error(result.error)
      await loadJobs()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to mark job paid')
    } finally {
      setStagesStatusUpdatingId(null)
    }
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

  useEffect(() => {
    if (!contractorsDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (contractorsDropdownRef.current && !contractorsDropdownRef.current.contains(e.target as Node)) {
        setContractorsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contractorsDropdownOpen])

  async function loadUsers() {
    if (!authUser?.id) return
    const [usersRes, meRes] = await Promise.all([
      supabase.from('users').select('id, name, email, role').in('role', ['assistant', 'master_technician', 'subcontractor', 'estimator', 'primary', 'superintendent']).order('name'),
      supabase.from('users').select('role').eq('id', authUser.id).single(),
    ])
    let usersList = (usersRes.data as UserRow[]) ?? []
    const role = (meRes.data as { role?: string } | null)?.role
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
    const { data: peopleData } = await supabase.from('people').select('id, master_user_id, kind, name, email, phone, notes').is('archived_at', null).order('kind').order('name')
    setPeople((peopleData as Person[]) ?? [])
    await loadUsers()
  }

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
    if (!authUser?.id) return
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
        master_user_id: authUser.id,
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

  async function loadInspections(month?: Date) {
    if (!authUser?.id) return
    setInspectionsLoading(true)
    const m = month ?? inspectionsMonth
    const start = new Date(m.getFullYear(), m.getMonth() - 1, 1)
    const end = new Date(m.getFullYear(), m.getMonth() + 2, 0)
    const startStr = start.toLocaleDateString('en-CA')
    const endStr = end.toLocaleDateString('en-CA')
    const { data, error: err } = await supabase
      .from('inspections')
      .select('*')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true })
    if (err) {
      setError(`Failed to load inspections: ${err.message}`)
      setInspections([])
    } else {
      setInspections((data as InspectionRow[]) ?? [])
    }
    setInspectionsLoading(false)
  }

  async function loadInspectionTypes() {
    setInspectionTypesLoading(true)
    const { data, error: err } = await supabase.from('inspection_types').select('name, sequence_order').order('sequence_order')
    if (err) {
      setError(`Failed to load inspection types: ${err.message}`)
      setInspectionTypesList([])
    } else {
      setInspectionTypesList((data as Array<{ name: string; sequence_order: number }>) ?? [])
    }
    setInspectionTypesLoading(false)
  }

  function openInspectionTypesModal() {
    setInspectionTypesModalOpen(true)
    setInspectionTypeFormOpen(false)
    setEditingInspectionTypeName(null)
    loadInspectionTypes()
  }

  function openAddInspectionType() {
    setEditingInspectionTypeName(null)
    setNewInspectionTypeName('')
    setInspectionTypeFormOpen(true)
  }

  function openEditInspectionType(typeRow: { name: string; sequence_order: number }) {
    setEditingInspectionTypeName(typeRow.name)
    setNewInspectionTypeName(typeRow.name)
    setInspectionTypeFormOpen(true)
  }

  function closeInspectionTypeForm() {
    setInspectionTypeFormOpen(false)
    setEditingInspectionTypeName(null)
  }

  async function saveInspectionType(e: React.FormEvent) {
    e.preventDefault()
    const name = newInspectionTypeName.trim()
    if (!name) return
    setInspectionTypeSaving(true)
    setError(null)
    if (editingInspectionTypeName) {
      const { error: err } = await supabase.from('inspection_types').update({ name }).eq('name', editingInspectionTypeName)
      if (err) {
        setError(err.message)
        setInspectionTypeSaving(false)
        return
      }
    } else {
      const { error: err } = await supabase.from('inspection_types').insert({ name, sequence_order: inspectionTypesList.length })
      if (err) {
        setError(err.message)
        setInspectionTypeSaving(false)
        return
      }
    }
    await loadInspectionTypes()
    setInspectionTypeSaving(false)
    closeInspectionTypeForm()
  }

  async function deleteInspectionType(name: string) {
    if (!confirm(`Delete inspection type "${name}"? This will fail if any inspections use it.`)) return
    setInspectionTypeDeletingName(name)
    setError(null)
    const { error: err } = await supabase.from('inspection_types').delete().eq('name', name)
    if (err) {
      setError(err.message.includes('violates foreign key') ? `Cannot delete: inspections are using this type.` : err.message)
    } else {
      await loadInspectionTypes()
      closeInspectionTypeForm()
    }
    setInspectionTypeDeletingName(null)
  }

  async function loadQuickLinks() {
    setQuickLinksLoading(true)
    const { data, error: err } = await supabase.from('inspection_quick_links').select('id, label, url, sequence_order').order('sequence_order')
    if (err) {
      setError(`Failed to load quick links: ${err.message}`)
      setQuickLinksList([])
    } else {
      setQuickLinksList((data as Array<{ id: string; label: string; url: string; sequence_order: number }>) ?? [])
    }
    setQuickLinksLoading(false)
  }

  function openQuickLinksModal() {
    setQuickLinksModalOpen(true)
    setQuickLinkFormOpen(false)
    setEditingQuickLinkId(null)
    loadQuickLinks()
  }

  function openAddQuickLink() {
    setEditingQuickLinkId(null)
    setNewQuickLinkLabel('')
    setNewQuickLinkUrl('')
    setQuickLinkFormOpen(true)
  }

  function openEditQuickLink(link: { id: string; label: string; url: string; sequence_order: number }) {
    setEditingQuickLinkId(link.id)
    setNewQuickLinkLabel(link.label)
    setNewQuickLinkUrl(link.url)
    setQuickLinkFormOpen(true)
  }

  function closeQuickLinkForm() {
    setQuickLinkFormOpen(false)
    setEditingQuickLinkId(null)
  }

  async function saveQuickLink(e: React.FormEvent) {
    e.preventDefault()
    const label = newQuickLinkLabel.trim()
    const url = newQuickLinkUrl.trim()
    if (!label || !url) return
    setQuickLinkSaving(true)
    setError(null)
    if (editingQuickLinkId) {
      const { error: err } = await supabase.from('inspection_quick_links').update({ label, url }).eq('id', editingQuickLinkId)
      if (err) {
        setError(err.message)
        setQuickLinkSaving(false)
        return
      }
    } else {
      const { error: err } = await supabase.from('inspection_quick_links').insert({ label, url, sequence_order: quickLinksList.length })
      if (err) {
        setError(err.message)
        setQuickLinkSaving(false)
        return
      }
    }
    await loadQuickLinks()
    setQuickLinkSaving(false)
    closeQuickLinkForm()
  }

  async function deleteQuickLink(id: string) {
    if (!confirm('Delete this quick link?')) return
    setQuickLinkDeletingId(id)
    setError(null)
    const { error: err } = await supabase.from('inspection_quick_links').delete().eq('id', id)
    if (err) {
      setError(err.message)
    } else {
      await loadQuickLinks()
      closeQuickLinkForm()
    }
    setQuickLinkDeletingId(null)
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
      setLaborJobNamesByHcp({})
    } else if (jobs?.length) {
      const jobIds = jobs.map((j) => j.id)
      const hcpNumbers = [...new Set((jobs as LaborJob[]).map((j) => (j.job_number ?? '').trim()).filter(Boolean))]
      const [itemsRes, paymentsRes, ledgerRes] = await Promise.all([
        supabase
          .from('people_labor_job_items')
          .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate')
          .in('job_id', jobIds)
          .order('sequence_order', { ascending: true }),
        supabase
          .from('people_labor_job_payments')
          .select('id, job_id, amount, memo, created_at')
          .in('job_id', jobIds)
          .order('sequence_order', { ascending: true }),
        hcpNumbers.length > 0 ? supabase.rpc('get_jobs_ledger_by_hcp_numbers', { p_hcp_numbers: hcpNumbers }) : { data: [] },
      ])
      const { data: items } = itemsRes
      const { data: paymentsData } = paymentsRes
      const { data: ledgerJobs } = ledgerRes
      const itemsByJob = new Map<string, Array<{ fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean; labor_rate?: number | null }>>()
      for (const it of (items ?? []) as Array<{ job_id: string; fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean; labor_rate?: number | null }>) {
        if (!itemsByJob.has(it.job_id)) itemsByJob.set(it.job_id, [])
        itemsByJob.get(it.job_id)!.push({ fixture: it.fixture, count: it.count, hrs_per_unit: it.hrs_per_unit, is_fixed: it.is_fixed, labor_rate: it.labor_rate })
      }
      const paymentsByJob = new Map<string, LaborJobPayment[]>()
      for (const p of (paymentsData ?? []) as Array<{ job_id: string; id: string; amount: number; memo: string | null; created_at: string }>) {
        if (!paymentsByJob.has(p.job_id)) paymentsByJob.set(p.job_id, [])
        paymentsByJob.get(p.job_id)!.push({ id: p.id, amount: Number(p.amount), memo: p.memo, created_at: p.created_at })
      }
      const jobNamesByHcp: Record<string, string> = {}
      for (const j of (ledgerJobs ?? []) as Array<{ hcp_number: string; job_name: string }>) {
        const key = (j.hcp_number ?? '').trim().toLowerCase()
        if (key && j.job_name) jobNamesByHcp[key] = j.job_name.trim()
      }
      setLaborJobNamesByHcp(jobNamesByHcp)
      const mappedJobs = (jobs as LaborJob[]).map((j) => ({ ...j, items: itemsByJob.get(j.id) ?? [], payments: paymentsByJob.get(j.id) ?? [] }))
      setLaborJobs(mappedJobs)
      setEditingLaborJob((prev) => {
        if (!prev) return prev
        const updated = mappedJobs.find((j) => j.id === prev.id)
        return updated ?? prev
      })
    } else {
      setLaborJobs([])
      setLaborJobNamesByHcp({})
    }
    setLaborJobsLoading(false)
  }

  async function loadTeamLaborData() {
    setTeamLaborLoading(true)
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const startDate = twoYearsAgo.toLocaleDateString('en-CA')
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
      const cfg = configMap[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
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
    if (jobIds.length === 0) {
      setTeamLaborData([])
      return
    }
    const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds })
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

  async function loadTallyParts() {
    if (!authUser?.id) return
    setTallyPartsLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('list_tally_parts_with_po')
    if (err) {
      setError(err.message)
      setTallyParts([])
      setInvoiceAmountByJob({})
    } else {
      const parts = (data ?? []) as TallyPartRow[]
      setTallyParts(parts)
      const tallyJobIds = new Set(parts.map((r) => r.job_id))
      const { data: allocData } = await supabase
        .from('supply_house_invoice_job_allocations')
        .select('job_id')
      for (const row of allocData ?? []) {
        tallyJobIds.add(row.job_id)
      }
      const jobIds = [...tallyJobIds]
      if (jobIds.length > 0) {
        const { data: amountsData } = await supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds })
        const map: Record<string, number> = {}
        for (const r of (amountsData ?? []) as { job_id: string; invoice_amount: number }[]) {
          map[r.job_id] = Number(r.invoice_amount ?? 0)
        }
        setInvoiceAmountByJob(map)
      } else {
        setInvoiceAmountByJob({})
      }
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
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureRows((prev) => [...prev, { id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate }])
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
    const firstRowRate = validRows[0]?.labor_rate != null ? Number(validRows[0].labor_rate) : null
    const { data: job, error: jobErr } = await supabase
      .from('people_labor_jobs')
      .insert({
        master_user_id: authUser.id,
        assigned_to_name: assigned,
        address,
        job_number: laborJobNumber.trim().slice(0, 10) || null,
        labor_rate: firstRowRate,
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
        labor_rate: r.labor_rate != null ? Number(r.labor_rate) : null,
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
    setLaborDate(new Date().toLocaleDateString('en-CA'))
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureRows([{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate }])
    setLaborSaving(false)
    setActiveTab('sub_sheet_ledger')
    closeLaborModal()
    await loadLaborJobs()
  }

  async function deleteLaborJob(id: string): Promise<boolean> {
    if (!confirm('Delete this job from the sub sheet ledger?')) return false
    setLaborJobDeletingId(id)
    setError(null)
    const { error: err } = await supabase.from('people_labor_jobs').delete().eq('id', id)
    if (err) {
      setError(err.message)
      setLaborJobDeletingId(null)
      return false
    }
    await loadLaborJobs()
    setLaborJobDeletingId(null)
    return true
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

  async function recordLaborJobPayment(jobId: string, amount: number, memo: string | null) {
    setError(null)
    const { data: existing } = await supabase.from('people_labor_job_payments').select('sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: false }).limit(1)
    const nextOrder = existing?.length ? (Number((existing[0] as { sequence_order: number }).sequence_order) + 1) : 0
    const { error: err } = await supabase.from('people_labor_job_payments').insert({ job_id: jobId, amount, memo: memo?.trim() || null, sequence_order: nextOrder })
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  async function recordLaborJobBackcharge(jobId: string, amount: number, memo: string) {
    setError(null)
    const { data: existing } = await supabase.from('people_labor_job_payments').select('sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: false }).limit(1)
    const nextOrder = existing?.length ? (Number((existing[0] as { sequence_order: number }).sequence_order) + 1) : 0
    const { error: err } = await supabase.from('people_labor_job_payments').insert({ job_id: jobId, amount: -Math.abs(amount), memo: memo.trim(), sequence_order: nextOrder })
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  async function deleteLaborJobPayment(paymentId: string) {
    setError(null)
    const { error: err } = await supabase.from('people_labor_job_payments').delete().eq('id', paymentId)
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  async function updateLaborJobPayment(
    paymentId: string,
    amount: number,
    memo: string | null,
    isBackcharge: boolean
  ) {
    setError(null)
    const amt = isBackcharge ? -Math.abs(amount) : Math.abs(amount)
    const { error: err } = await supabase
      .from('people_labor_job_payments')
      .update({ amount: amt, memo: memo?.trim() || null })
      .eq('id', paymentId)
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  function resetLaborForm() {
    setLaborAssignedTo([])
    setLaborAddress('')
    setLaborDistance('0')
    setLaborJobNumber('')
    setLaborDate(new Date().toLocaleDateString('en-CA'))
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureRows([{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate }])
  }

  function closeLaborModal() {
    setEditingLaborJob(null)
    setEditingPayment(null)
    setLaborModalOpen(false)
    setShowAddSubcontractorModal(false)
    setNewSubcontractor({ name: '', email: '', phone: '', notes: '' })
    setAddSubcontractorError(null)
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
    setLaborDate(job.job_date ?? new Date().toLocaleDateString('en-CA'))
    const jobRate = job.labor_rate ?? 0
    const rows = (job.items ?? []).map((i) => ({
      id: crypto.randomUUID(),
      fixture: i.fixture ?? '',
      count: Number(i.count) || 1,
      hrs_per_unit: Number(i.hrs_per_unit) || 0,
      is_fixed: i.is_fixed ?? false,
      labor_rate: i.labor_rate != null ? Number(i.labor_rate) : jobRate,
    }))
    const defaultRate = defaultLaborRateValue.trim() !== '' && !isNaN(parseFloat(defaultLaborRateValue)) ? parseFloat(defaultLaborRateValue) || 20 : 20
    setLaborFixtureRows(rows.length > 0 ? rows : [{ id: crypto.randomUUID(), fixture: '', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: defaultRate }])
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
        labor_rate: r.labor_rate != null ? Number(r.labor_rate) : null,
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

    const validRows = laborFixtureRows.filter((r) => (r.fixture ?? '').trim())
    const laborRowsHtml =
      validRows.length === 0
        ? '<tr><td colspan="5" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : validRows
            .map((row) => {
              const hrs = Number(row.hrs_per_unit) || 0
              const laborHrs = (row.is_fixed ?? false) ? hrs : (Number(row.count) || 0) * hrs
              const rate = row.labor_rate ?? 0
              const totalCost = rate * laborHrs
              return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${Number(row.count)}</td><td style="text-align:right">${laborHrs.toFixed(2)}</td><td style="text-align:right">$${rate.toFixed(2)}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            })
            .join('')

    let totalCost = 0
    if (validRows.length > 0) {
      totalCost = validRows.reduce((sum, row) => {
        const hrs = Number(row.hrs_per_unit) || 0
        const laborHrs = (row.is_fixed ?? false) ? hrs : (Number(row.count) || 0) * hrs
        const rate = row.labor_rate ?? 0
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
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th style="text-align:right">Labor Hours</th><th style="text-align:right">Rate ($/hr)</th><th style="text-align:right">Cost</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="4" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
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
    const jobRate = job.labor_rate ?? 0

    const items = job.items ?? []
    const laborRowsHtml =
      items.length === 0
        ? '<tr><td colspan="5" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : items
            .map((i) => {
              const hrs = Number(i.hrs_per_unit) || 0
              const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
              const rate = i.labor_rate ?? jobRate
              const totalCost = rate * laborHrs
              return `<tr><td>${escapeHtml(i.fixture ?? '')}</td><td style="text-align:center">${Number(i.count)}</td><td style="text-align:right">${laborHrs.toFixed(2)}</td><td style="text-align:right">$${rate.toFixed(2)}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            })
            .join('')

    let totalCost = 0
    if (items.length > 0) {
      totalCost = items.reduce((sum, i) => {
        const hrs = Number(i.hrs_per_unit) || 0
        const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
        const rate = i.labor_rate ?? jobRate
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
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th style="text-align:right">Labor Hours</th><th style="text-align:right">Rate ($/hr)</th><th style="text-align:right">Cost</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="4" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
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

  function printBilledAwaitingPaymentReport(rows: StageRow[], opts?: { searchFilter?: string }) {
    if (rows.length === 0) {
      showToast('Nothing to print in Billed Awaiting Payment.', 'warning')
      return
    }
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateStr = new Date().toLocaleDateString()
    const title = escapeHtml(`Billed awaiting payment — ${dateStr}`)
    const filterNote = opts?.searchFilter?.trim()
      ? `<p style="margin:0.35rem 0 0; font-size:0.9rem; color:#4b5563;">Filtered (stages search): ${escapeHtml(opts.searchFilter.trim())}</p>`
      : ''
    const grandTotal = rows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)

    const groups = new Map<string, { displayName: string; rows: StageRow[] }>()
    for (const r of rows) {
      const job = r.job
      const nameNorm = (job.customer_name ?? '').trim().toLowerCase()
      const key = job.customer_id ?? (nameNorm.length > 0 ? `name:${nameNorm}` : '—')
      let g = groups.get(key)
      if (!g) {
        g = { displayName: (job.customer_name ?? '').trim() || '—', rows: [] }
        groups.set(key, g)
      }
      g.rows.push(r)
    }
    for (const g of groups.values()) {
      const named = g.rows.map((row) => (row.job.customer_name ?? '').trim()).find((n) => n.length > 0)
      if (named) g.displayName = named
    }

    const sortedGroups = [...groups.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    )

    const sectionsHtml = sortedGroups
      .map((g) => {
        const sortedRows = sortStageRowsForTotalByNameDetail(g.rows)
        const contactJob = sortedRows[0]!.job
        const phoneRaw = (contactJob.customer_phone ?? '').trim()
        const emailRaw = (contactJob.customer_email ?? '').trim()
        const sectionHeading =
          (g.displayName ?? '').trim() && g.displayName !== '—' ? g.displayName : 'Jobs with no customer linked'
        const contactBlock =
          phoneRaw || emailRaw
            ? `<p style="margin:0 0 0.5rem; font-size:0.875rem; color:#374151">Phone: ${escapeHtml(phoneRaw || '—')} · Email: ${escapeHtml(emailRaw || '—')}</p>`
            : ''
        const subtotal = sortedRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
        const linesHtml = sortedRows
          .map((r) => {
            const j = r.job
            const detail = r.kind === 'job' ? 'Job balance' : `Invoice #${r.inv.sequence_order}`
            const amt = stageRowBilledRemainingAmount(r)
            const { display: dateDisplay, ageDays } = printBilledRowReferenceDate(r)
            return `<tr>
              <td>${escapeHtml(j.hcp_number ?? '—')}</td>
              <td style="line-height:1.2">${escapeHtml(j.job_name ?? '—')}<br />${escapeHtml(j.job_address ?? '—')}</td>
              <td>${escapeHtml(detail)}</td>
              <td style="text-align:center;line-height:1.2">${escapeHtml(dateDisplay)}<br />${escapeHtml(formatPrintDaysSince(ageDays))}</td>
              <td style="text-align:right">$${formatCurrency(amt)}</td>
            </tr>`
          })
          .join('')
        return `<section style="margin-bottom:1.25rem; page-break-inside:avoid">
  <h2 style="font-size:1.05rem; margin:0 0 0.35rem">${escapeHtml(sectionHeading)}</h2>
  ${contactBlock}
  <table>
    <thead><tr>
      <th>HCP</th><th style="text-align:left;line-height:1.15">Job<br />Address</th><th>Detail</th><th style="text-align:center;line-height:1.15">Billed<br />Days past</th><th style="text-align:right">Amount due</th>
    </tr></thead>
    <tbody>${linesHtml}
      <tr style="background:#f9fafb; font-weight:600">
        <td colspan="4" style="text-align:right">Subtotal:</td>
        <td style="text-align:right">$${formatCurrency(subtotal)}</td>
      </tr>
    </tbody>
  </table>
</section>`
      })
      .join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.35rem; font-size: 0.8125rem; }
  th, td { border: 1px solid #ccc; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  section h2 + p { word-break: break-word; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>${filterNote}
  ${sectionsHtml}
  <p style="margin-top:1rem; font-size:1rem; font-weight:600; text-align:right">Grand total: $${formatCurrency(grandTotal)}</p>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) {
      showToast('Allow pop-ups to print the report.', 'error')
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  useEffect(() => {
    if (authLoading || !authUser?.id) return
    if (activeTab === 'stages' || activeTab === 'billing') loadJobs()
    loadUsers()
  }, [authUser?.id, authLoading, searchParams, activeTab])

  useEffect(() => {
    if (authLoading || !authUser?.id) return
    const needCustomers = formOpen || activeTab === 'stages' || activeTab === 'billing'
    if (!needCustomers) return
    setCustomersLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, address, contact_info, date_met, master_user_id, customer_type')
        .order('name')
      setCustomers((data as CustomerRow[]) ?? [])
      setCustomersLoading(false)
    })()
  }, [formOpen, authUser?.id, authLoading, activeTab])

  useEffect(() => {
    if (!formOpen || !authUser?.id) return
    ;(async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, customer_id, master_user_id, customers(name)')
        .order('name')
      setProjects((data as Array<{ id: string; name: string; customer_id: string; master_user_id: string; customers: { name: string } | null }>) ?? [])
    })()
  }, [formOpen, authUser?.id])

  useEffect(() => {
    if (customerId && customers.length > 0) {
      const c = customers.find((x) => x.id === customerId)
      if (c) {
        setCustomerSearch(getCustomerDisplay(c))
        setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
      }
    }
  }, [customerId, customers])

  useEffect(() => {
    if (!createCustomerFromJobModalOpen || !authUser?.id) return
    setCreateCustomerFromJobModalLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, address, contact_info, date_met, master_user_id, customer_type')
        .order('name')
      const all = (data as CustomerRow[]) ?? []
      const name = customerName.trim()
      if (!name) {
        setSimilarCustomersForCreate([])
        setCreateCustomerFromJobModalLoading(false)
        return
      }
      const nameLower = name.toLowerCase()
      const withSimilarity = all
        .map((c) => ({ c, sim: nameSimilarity(name, c.name ?? '') }))
        .filter(({ c, sim }) => sim >= 0.7 || (c.name ?? '').toLowerCase().includes(nameLower) || nameLower.includes((c.name ?? '').toLowerCase()))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 10)
        .map(({ c }) => c)
      setSimilarCustomersForCreate(withSimilarity)
      setCreateCustomerFromJobModalLoading(false)
    })()
  }, [createCustomerFromJobModalOpen, authUser?.id, customerName])

  useEffect(() => {
    const tab = searchParams.get('tab')
    const editJobId = searchParams.get('edit')
    const editLaborHcp = searchParams.get('editLabor')
    const isPrimary = authRole === 'primary' || myRole === 'primary'
    const isSuperintendent = authRole === 'superintendent' || myRole === 'superintendent'
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
    // Redirect old receivables URLs to reports
    if (tab === 'receivables') {
      setActiveTab('reports')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'reports')
        return next
      }, { replace: true })
      return
    }
    // Redirect old ledger URLs to billing
    if (tab === 'ledger') {
      setActiveTab('billing')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'billing')
        return next
      }, { replace: true })
      return
    }
    // Redirect assistants away from Team Labor tab
    const isAssistant = authRole === 'assistant' || myRole === 'assistant'
    if (isAssistant && tab === 'combined-labor') {
      setActiveTab('stages')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'stages')
        return next
      }, { replace: true })
      return
    }
    // Redirect masters/assistants away from Teams tab
    const isMasterOrAssistant = authRole === 'master_technician' || authRole === 'assistant' || myRole === 'master_technician' || myRole === 'assistant'
    if (isMasterOrAssistant && tab === 'teams-summary') {
      setActiveTab('reports')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'reports')
        return next
      }, { replace: true })
      return
    }
    // Redirect superintendent away from Team Labor and Teams tabs
    if (isSuperintendent && (tab === 'combined-labor' || tab === 'teams-summary')) {
      setActiveTab('reports')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'reports')
        return next
      }, { replace: true })
      return
    }
    // Superintendent: reports, sub_sheet_ledger only; default reports
    if (isSuperintendent) {
      const superintendentTabs = ['reports', 'sub_sheet_ledger']
      if (tab && superintendentTabs.includes(tab)) {
        setActiveTab(tab as JobsTab)
      } else if (!tab || !superintendentTabs.includes(tab)) {
        setActiveTab('reports')
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'reports')
          return next
        }, { replace: true })
      }
      return
    }
    // Only primaries default to Reports; primaries only see Reports tab (Billing hidden)
    if (isPrimary) {
      const primaryTabs = ['reports']
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
    } else if (tab === 'billed') {
      setActiveTab('stages')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'stages')
        return next
      }, { replace: true })
    } else if (tab && JOBS_TABS.includes(tab as JobsTab)) {
      setActiveTab(tab as JobsTab)
    } else if (!tab) {
      // Default to Stages
      setActiveTab('stages')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'stages')
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
    } else if (newJob && (tab === 'billing' || tab === 'stages' || !tab)) {
      const projectParam = searchParams.get('project')
      setActiveTab(tab === 'billing' ? 'billing' : 'stages')
      setEditing(null)
      setHcpNumber('')
      setJobName('')
      setJobAddress('')
      setCustomerName('')
      setCustomerEmail('')
      setCustomerPhone('')
      setCustomerId(null)
      setProjectId(projectParam)
      setCustomerSearch('')
      setDateMet('')
      setCustomerExpanded(true)
      setEstimatedCompletionDate('')
      setGoogleDriveLink('')
      setJobPlansLink('')
      setRevenue('')
      setMaterials([{ id: crypto.randomUUID(), description: '', amount: 0 }])
      setFixtures([{ id: crypto.randomUUID(), name: '', count: 1 }])
      setTeamMemberIds([])
      setContractorsSearch('')
      setContractorsDropdownOpen(false)
      setFormOpen(true)
      if (projectParam) {
        ;(async () => {
          const { data } = await supabase.from('projects').select('customer_id, customers(name, address, contact_info, date_met)').eq('id', projectParam).single()
          if (data && data.customer_id) {
            setCustomerId(data.customer_id)
            const c = (data as { customers?: { name: string; address: string | null; contact_info: unknown; date_met: string | null } }).customers
            if (c) {
              setCustomerName(c.name ?? '')
              setJobAddress(c.address ?? '')
              setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
              const ci = c.contact_info as { phone?: string; email?: string } | null
              if (ci) {
                setCustomerEmail(ci.email ?? '')
                setCustomerPhone(ci.phone ?? '')
              }
            }
          }
        })()
      }
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('newJob')
        next.delete('project')
        if (!next.get('tab')) next.set('tab', 'stages')
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
    if (activeTab === 'sub_sheet_ledger') {
      const t = setTimeout(() => loadRoster(), 80)
      return () => clearTimeout(t)
    }
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
    if (activeTab === 'stages' && searchParams.get('showBilledTotalByName') === 'true') {
      setBilledTotalByNameModalOpen(true)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('showBilledTotalByName')
        return next
      }, { replace: true })
    }
  }, [activeTab, searchParams, setSearchParams])

  useEffect(() => {
    if (!billedTotalByNameModalOpen) setBilledTotalByNameExpandedName(null)
  }, [billedTotalByNameModalOpen])

  useEffect(() => {
    if ((activeTab === 'billing' || activeTab === 'sub_sheet_ledger' || activeTab === 'combined-labor' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) {
      const t = setTimeout(() => loadLaborJobs(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if ((activeTab === 'combined-labor' || activeTab === 'billing' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) {
      const t = setTimeout(() => loadTeamLaborData(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if ((activeTab === 'parts' || activeTab === 'job-summary') && authUser?.id) {
      const t = setTimeout(() => loadTallyParts(), 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id])

  useEffect(() => {
    if (activeTab === 'inspections' && authUser?.id) {
      const t = setTimeout(() => {
        loadInspections()
        loadQuickLinks()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id, inspectionsMonth])

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
    if ((activeTab === 'sub_sheet_ledger' || activeTab === 'teams-summary' || activeTab === 'job-summary') && authUser?.id) {
      const t = setTimeout(() => loadDriveSettings(), 80)
      return () => clearTimeout(t)
    }
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
    if (activeTab === 'reports' && authUser?.id) {
      const t = setTimeout(() => {
        loadReports()
        loadReportTemplates()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, authUser?.id])


  const laborJobHcps = useMemo(
    () => new Set(laborJobs.map((j) => (j.job_number ?? '').trim().toLowerCase()).filter(Boolean)),
    [laborJobs]
  )

  const teamLaborJobIds = useMemo(
    () => new Set(teamLaborData.map((r) => r.jobId)),
    [teamLaborData]
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

    for (const row of teamLaborData) {
      for (const p of row.breakdown) {
        laborCostByName.set(p.personName, (laborCostByName.get(p.personName) ?? 0) + p.cost)
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

    const hcpByJobId = new Map<string, string>()
    for (const j of jobs) {
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) hcpByJobId.set(j.id, hcp)
    }

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
    for (const row of teamLaborData) {
      const hcp = hcpByJobId.get(row.jobId)
      if (hcp && matchedHcps.has(hcp)) matchedLaborTotal += row.jobCost
    }
    for (const job of jobs) {
      const hcp = (job.hcp_number ?? '').trim().toLowerCase()
      if (!hcp || !matchedHcps.has(hcp) || job.revenue == null) continue
      matchedBillingTotal += Number(job.revenue)
    }

    return { rows, matchedLaborTotal, matchedBillingTotal }
  }, [jobs, laborJobs, teamLaborData, driveMileageCost, driveTimePerMile])

  const jobSummaryData = useMemo(() => {
    const partsCostByJobId = new Map<string, number>()
    for (const r of tallyParts) {
      const cost = r.part_id == null
        ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
        : Number(r.price_at_time ?? 0) * Number(r.quantity)
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
    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of teamLaborData) {
      teamLaborCostByJobId.set(r.jobId, r.jobCost)
    }
    return jobs.map((job) => {
      const hcp = (job.hcp_number ?? '').trim().toLowerCase()
      const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const teamLaborCost = teamLaborCostByJobId.get(job.id) ?? 0
      const laborCost = subLaborCost + teamLaborCost
      const partsFromTally = partsCostByJobId.get(job.id) ?? 0
      const invoicesFromSupplyHouses = invoiceAmountByJob[job.id] ?? 0
      const billedMaterialsSum = (job.materials ?? []).reduce((s, m) => s + Number(m.amount ?? 0), 0)
      const partsCost = partsFromTally + invoicesFromSupplyHouses + billedMaterialsSum
      const totalBill = job.revenue != null ? Number(job.revenue) : 0
      const profit = totalBill - partsCost - laborCost
      return {
        job,
        subLaborCost,
        teamLaborCost,
        partsCost,
        totalBill,
        profit,
      }
    })
  }, [jobs, laborJobs, tallyParts, teamLaborData, driveMileageCost, driveTimePerMile, invoiceAmountByJob])

  const subLaborDueTotal = useMemo(() => {
    const q = subLaborSearch.trim().toLowerCase()
    const filtered = laborJobs.filter((job) => {
      if (!q) return true
      const contractor = (job.assigned_to_name ?? '').toLowerCase()
      const hcp = (job.job_number ?? '').toLowerCase()
      const addr = (job.address ?? '').toLowerCase()
      const jobName = laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()]?.toLowerCase() ?? ''
      return contractor.includes(q) || hcp.includes(q) || addr.includes(q) || jobName.includes(q)
    })
    return filtered.reduce((sum, job) => {
      const jobRate = job.labor_rate ?? 0
      const laborTotal = (job.items ?? []).reduce((s, i) => {
        const hrs = Number(i.hrs_per_unit) || 0
        const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
        const rate = i.labor_rate != null ? Number(i.labor_rate) : jobRate
        return s + laborHrs * rate
      }, 0)
      let totalCost = laborTotal
      const jobPayments = job.payments ?? []
      const paid = jobPayments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
      const backcharges = jobPayments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
      if (totalCost === 0 && (paid > 0 || backcharges > 0)) {
        totalCost = paid + backcharges
      }
      const balance = totalCost - paid - backcharges
      return sum + (balance > 0 ? balance : 0)
    }, 0)
  }, [laborJobs, subLaborSearch, laborJobNamesByHcp])

  function openNew() {
    setEditing(null)
    setHcpNumber('')
    setJobName('')
    setJobAddress('')
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setCustomerId(null)
    setProjectId(null)
    setCustomerSearch('')
    setDateMet('')
    setCustomerExpanded(true)
    setEstimatedCompletionDate('')
    setGoogleDriveLink('')
    setJobPlansLink('')
    setRevenue('')
    setPayments([newEmptyPaymentRow()])
    setMaterials([{ id: crypto.randomUUID(), description: '', amount: 0 }])
    setFixtures([{ id: crypto.randomUUID(), name: '', count: 1 }])
    setTeamMemberIds([])
    setContractorsSearch('')
    setContractorsDropdownOpen(false)
    setFormOpen(true)
  }

  function openEdit(job: JobWithDetails) {
    setEditing(job)
    setHcpNumber(job.hcp_number ?? '')
    setJobName(job.job_name ?? '')
    setJobAddress(job.job_address ?? '')
    setCustomerName(job.customer_name ?? '')
    setCustomerEmail(job.customer_email ?? '')
    setCustomerPhone(job.customer_phone ?? '')
    setCustomerId(job.customer_id ?? null)
    setProjectId(job.project_id ?? null)
    setCustomerSearch('')
    setCustomerExpanded(!!(job.customer_name || job.customer_email || job.customer_phone || job.customer_id))
    setEstimatedCompletionDate(job.estimated_completion_date ? job.estimated_completion_date.slice(0, 10) : '')
    setGoogleDriveLink(job.google_drive_link ?? '')
    setJobPlansLink(job.job_plans_link ?? '')
    setRevenue(job.revenue != null ? String(job.revenue) : '')
    setPayments(
      job.payments?.length
        ? job.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            paid_on: p.paid_on ? String(p.paid_on).slice(0, 10) : null,
            note: p.note ?? null,
          }))
        : [newEmptyPaymentRow()]
    )
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
    setContractorsSearch('')
    setContractorsDropdownOpen(false)
    setFormOpen(true)
  }

  function openEditJobAndCreateCustomerFlow(job: JobWithDetails) {
    openEdit(job)
    if ((job.customer_name ?? '').trim()) {
      setCreateCustomerFromJobType('residential')
      setCreateCustomerFromJobModalOpen(true)
    }
  }

  async function handleCreateCustomerFromJob(customerType: 'residential' | 'commercial') {
    if (!authUser?.id) return
    const name = customerName.trim()
    if (!name) {
      showToast('Enter customer name first', 'error')
      return
    }
    setCreatingCustomerFromJob(true)
    setError(null)
    try {
      const contactInfo = (customerEmail.trim() || customerPhone.trim())
        ? { phone: customerPhone.trim() || null, email: customerEmail.trim() || null }
        : null
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({
          name,
          address: jobAddress.trim() || null,
          contact_info: contactInfo,
          customer_type: customerType,
          date_met: dateMet.trim() || null,
          master_user_id: authUser.id,
        })
        .select('id')
        .single()
      if (custErr) throw custErr
      const cid = (newCustomer as { id: string })?.id
      if (!cid) throw new Error('Failed to create customer')
      setCustomerId(cid)
      const c = { id: cid, name, address: jobAddress.trim() || null, contact_info: contactInfo, date_met: dateMet.trim() || null } as CustomerRow
      setCustomers((prev) => [...prev.filter((x) => x.id !== cid), c].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      setCustomerSearch(getCustomerDisplay(c))
      if (editing) {
        const { error: updErr } = await supabase.from('jobs_ledger').update({ customer_id: cid }).eq('id', editing.id)
        if (updErr) throw updErr
        const updated = await loadJobs()
        const found = updated?.find((j) => j.id === editing.id)
        if (found) setEditing(found)
      }
      setCreateCustomerFromJobModalOpen(false)
      showToast('Customer created and linked', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create customer'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setCreatingCustomerFromJob(false)
    }
  }

  async function handleLinkToSimilarCustomer(c: CustomerRow) {
    setCustomerId(c.id)
    setCustomerSearch(getCustomerDisplay(c))
    setCustomerName(c.name ?? '')
    setCustomerEmail(extractContactFromCustomer(c).email)
    setCustomerPhone(extractContactFromCustomer(c).phone)
    setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
    if (!jobAddress.trim()) setJobAddress(c.address ?? '')
    setCustomers((prev) => {
      if (prev.some((x) => x.id === c.id)) return prev
      return [...prev, c].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    })
    if (editing) {
      const { error: updErr } = await supabase.from('jobs_ledger').update({ customer_id: c.id }).eq('id', editing.id)
      if (updErr) {
        showToast(updErr.message, 'error')
        return
      }
      const updated = await loadJobs()
      const found = updated?.find((j) => j.id === editing.id)
      if (found) setEditing(found)
    }
    setCreateCustomerFromJobModalOpen(false)
    showToast('Linked to existing customer', 'success')
  }

  async function handleCustomerImport() {
    try {
      const text = await navigator.clipboard.readText()
      const trimmed = text.trim()
      if (!trimmed) {
        showToast('Clipboard is empty', 'error')
        return
      }
      const { name, address, email, phone } = parseCustomerImport(trimmed)
      if (name) setCustomerName(name)
      if (address) setJobAddress(address)
      if (email) setCustomerEmail(email)
      if (phone) setCustomerPhone(phone)
      const filled = [name, address, email, phone].filter(Boolean).length
      showToast(
        filled > 0 ? `Imported ${filled} field(s) from clipboard` : 'No recognizable fields in clipboard',
        filled > 0 ? 'success' : 'error'
      )
    } catch {
      showToast('Could not read clipboard', 'error')
    }
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setProjectId(null)
    setNewInvoiceAmount('')
    setCreateCustomerFromJobModalOpen(false)
  }

  async function createInvoice() {
    if (!editing) return
    const amount = parseFloat(newInvoiceAmount)
    if (!(amount > 0)) {
      setError('Enter a valid amount greater than 0')
      return
    }
    const remaining = Math.max(0, parseMoneyInputToNumber(revenue) - payments.reduce((s, p) => s + (Number(p.amount) || 0), 0))
    if (amount > remaining) {
      setError(`Amount cannot exceed Remaining ($${formatCurrency(remaining)})`)
      return
    }
    setCreatingInvoice(true)
    setError(null)
    try {
      const nextOrder = (editing.invoices ?? []).length
      const estBill = editing.estimated_completion_date?.trim().slice(0, 10) ?? null
      const { error: err } = await supabase.from('jobs_ledger_invoices').insert({
        job_id: editing.id,
        amount,
        status: 'ready_to_bill',
        sequence_order: nextOrder,
        estimated_bill_date: estBill,
      })
      if (err) throw err
      setNewInvoiceAmount('')
      const updated = await loadJobs()
      const found = updated?.find((j) => j.id === editing.id)
      if (found) setEditing(found)
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string }
      const msg = err?.message || 'Failed to create invoice'
      const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
      setError(extra ? `${msg}. ${extra}` : msg)
    } finally {
      setCreatingInvoice(false)
    }
  }

  async function createInvoiceFromModal() {
    if (!createPartialInvoiceJob) return
    const amount = parseFloat(createPartialInvoiceAmount)
    if (!(amount > 0)) {
      setError('Enter a valid amount greater than 0')
      return
    }
    const remaining = Math.max(0, (Number(createPartialInvoiceJob.revenue ?? 0) - Number(createPartialInvoiceJob.payments_made ?? 0)))
    if (amount > remaining) {
      setError(`Amount cannot exceed Remaining ($${formatCurrency(remaining)})`)
      return
    }
    setCreatingPartialInvoiceFromModal(true)
    setError(null)
    try {
      const nextOrder = (createPartialInvoiceJob.invoices ?? []).length
      const estBillModal =
        createPartialInvoiceJob.estimated_completion_date?.trim().slice(0, 10) ?? null
      const { error: err } = await supabase.from('jobs_ledger_invoices').insert({
        job_id: createPartialInvoiceJob.id,
        amount,
        status: 'ready_to_bill',
        sequence_order: nextOrder,
        estimated_bill_date: estBillModal,
      })
      if (err) throw err
      setCreatePartialInvoiceJob(null)
      setCreatePartialInvoiceAmount('')
      setError(null)
      await loadJobs()
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string }
      const msg = err?.message || 'Failed to create invoice'
      const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
      setError(extra ? `${msg}. ${extra}` : msg)
    } finally {
      setCreatingPartialInvoiceFromModal(false)
    }
  }

  function addMaterialRow() {
    setMaterials((prev) => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }])
  }

  function addPaymentRow() {
    setPayments((prev) => [...prev, newEmptyPaymentRow()])
  }

  function updatePaymentRow(id: string, updates: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  function removePaymentRow(id: string) {
    setPayments((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
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
    const revNum = parseMoneyInputToNumberOrNull(revenue)
    const paymentsMadeNum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const validPayments = payments.filter((p) => (Number(p.amount) || 0) > 0)
    const validMaterials = materials.filter((m) => (m.description ?? '').trim() !== '' || Number(m.amount) !== 0)
    try {
      if (editing) {
        const proj = projectId ? projects.find((p) => p.id === projectId) : null
        const jobMasterForCustomer = projectId && proj ? proj.master_user_id : editing.master_user_id
        const resolvedCustomerId = resolveCustomerIdForPayload(customerId, jobMasterForCustomer, customerName.trim())
        const updatePayload = {
          hcp_number: hcpNumber.trim(),
          job_name: jobName.trim(),
          job_address: jobAddress.trim(),
          customer_id: resolvedCustomerId,
          customer_name: customerName.trim() || null,
          customer_email: customerEmail.trim() || null,
          customer_phone: customerPhone.trim() || null,
          estimated_completion_date: estimatedCompletionDate.trim() || null,
          google_drive_link: googleDriveLink.trim() || null,
          job_plans_link: jobPlansLink.trim() || null,
          revenue: revNum,
          payments_made: paymentsMadeNum,
          project_id: projectId || null,
          ...(projectId && proj ? { master_user_id: proj.master_user_id } : {}),
        }
        const { error: updateErr } = await supabase
          .from('jobs_ledger')
          .update(updatePayload)
          .eq('id', editing.id)
        if (updateErr) throw updateErr
        await supabase.from('jobs_ledger_payments').delete().eq('job_id', editing.id)
        for (const [i, p] of validPayments.entries()) {
          await supabase.from('jobs_ledger_payments').insert({
            job_id: editing.id,
            amount: Number(p.amount) || 0,
            sequence_order: i,
            paid_on: p.paid_on?.trim() ? p.paid_on.trim() : null,
            note: p.note?.trim() ? p.note.trim() : null,
          })
        }
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
        // Resolve job owner (override for users who create jobs on behalf of others, or project owner when linking to project)
        let effectiveMasterId = authUser.id
        if (projectId) {
          const proj = projects.find((p) => p.id === projectId)
          if (proj) effectiveMasterId = proj.master_user_id
        }
        if (!projectId) {
          const override = await withSupabaseRetry(
            async () => {
              const result = await supabase
                .from('app_settings')
                .select('value_text')
                .eq('key', `job_owner_override_${authUser.id}`)
                .maybeSingle()
              return { data: result.data, error: result.error }
            },
            'fetch job owner override'
          )
          if (override?.value_text) {
            effectiveMasterId = override.value_text
          }
        }

        const resolvedCustomerIdNew = resolveCustomerIdForPayload(customerId, effectiveMasterId, customerName.trim())
        const { data: inserted, error: insertErr } = await supabase
          .from('jobs_ledger')
          .insert({
            master_user_id: effectiveMasterId,
            hcp_number: hcpNumber.trim(),
            job_name: jobName.trim(),
            job_address: jobAddress.trim(),
            customer_id: resolvedCustomerIdNew,
            customer_name: customerName.trim() || null,
            customer_email: customerEmail.trim() || null,
            customer_phone: customerPhone.trim() || null,
            estimated_completion_date: estimatedCompletionDate.trim() || null,
            google_drive_link: googleDriveLink.trim() || null,
            job_plans_link: jobPlansLink.trim() || null,
            revenue: revNum,
            payments_made: paymentsMadeNum,
            project_id: projectId || null,
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        const jobId = inserted?.id
        if (jobId) {
          for (const [i, p] of validPayments.entries()) {
            await supabase.from('jobs_ledger_payments').insert({
              job_id: jobId,
              amount: Number(p.amount) || 0,
              sequence_order: i,
              paid_on: p.paid_on?.trim() ? p.paid_on.trim() : null,
              note: p.note?.trim() ? p.note.trim() : null,
            })
          }
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
      if (customerId && dateMet.trim()) {
        const c = customers.find((x) => x.id === customerId)
        if (c && !c.date_met) {
          await supabase.from('customers').update({ date_met: dateMet.trim() }).eq('id', customerId)
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

  async function updateJobPctComplete(jobId: string, value: number | null) {
    setPctCompleteSavingId(jobId)
    setError(null)
    try {
      const { error: err } = await supabase.from('jobs_ledger').update({ pct_complete: value }).eq('id', jobId)
      if (err) throw err
      await loadJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update % complete')
    } finally {
      setPctCompleteSavingId(null)
    }
  }

  async function updateJobEstimatedCompletionDate(jobId: string, deltaDays: number, currentDate: string | null) {
    setEstimatedCompletionDateSavingId(jobId)
    setError(null)
    const newDate = addDaysToDate(currentDate, deltaDays)
    try {
      const { error: err } = await supabase.from('jobs_ledger').update({ estimated_completion_date: newDate }).eq('id', jobId)
      if (err) throw err
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, estimated_completion_date: newDate } : j))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update estimated completion date')
    } finally {
      setEstimatedCompletionDateSavingId(null)
    }
  }

  async function setJobEstimatedCompletionDate(jobId: string, date: string | null) {
    setEstimatedCompletionDateSavingId(jobId)
    setError(null)
    try {
      const { error: err } = await supabase.from('jobs_ledger').update({ estimated_completion_date: date }).eq('id', jobId)
      if (err) throw err
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, estimated_completion_date: date } : j))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update date')
    } finally {
      setEstimatedCompletionDateSavingId(null)
    }
  }

  async function setInvoiceEstimatedBillDate(invoiceId: string, jobId: string, date: string | null) {
    setInvoiceEstimatedBillDateSavingId(invoiceId)
    setError(null)
    try {
      await withSupabaseRetry(
        async () => {
          const r = await supabase
            .from('jobs_ledger_invoices')
            .update({ estimated_bill_date: date })
            .eq('id', invoiceId)
          return { data: r.data, error: r.error }
        },
        'update invoice estimated bill date'
      )
      setJobs((prev) =>
        prev.map((j) =>
          j.id !== jobId
            ? j
            : {
                ...j,
                invoices: (j.invoices ?? []).map((i) =>
                  i.id === invoiceId ? { ...i, estimated_bill_date: date } : i
                ),
              }
        )
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice bill date')
    } finally {
      setInvoiceEstimatedBillDateSavingId(null)
    }
  }

  /** Ham ±1: seed from invoice date, else job est. date, else today. */
  async function bumpInvoiceEstimatedBillDate(
    invoiceId: string,
    jobId: string,
    inv: JobsLedgerInvoice,
    job: JobWithDetails,
    deltaDays: number
  ) {
    const base =
      inv.estimated_bill_date ??
      job.estimated_completion_date ??
      new Date().toISOString().slice(0, 10)
    const newDate = addDaysToDate(base, deltaDays)
    await setInvoiceEstimatedBillDate(invoiceId, jobId, newDate)
  }

  // Hide primary-restricted tabs until role is known to prevent flash of wrong tabs
  const isPrimaryOrUnknown = (authRole === 'primary' || myRole === 'primary') || (authRole === null && myRole === null)
  const showPrimaryRestrictedTabs = !isPrimaryOrUnknown
  const isSuperintendent = authRole === 'superintendent' || myRole === 'superintendent'
  const showStagesAndBillingTabs = showPrimaryRestrictedTabs && !isSuperintendent
  const showTeamsTab = showPrimaryRestrictedTabs &&
    authRole !== 'master_technician' && authRole !== 'assistant' &&
    authRole !== 'superintendent' && myRole !== 'superintendent' &&
    myRole !== 'master_technician' && myRole !== 'assistant'
  const showTeamLaborTab = authRole !== 'assistant' && myRole !== 'assistant' &&
    authRole !== 'superintendent' && myRole !== 'superintendent'
  const showSuperintendentExtraTabs = !isSuperintendent

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
        {showTeamsTab && (
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
        {showStagesAndBillingTabs && (
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
          {showStagesAndBillingTabs && (
            <>
            <span style={{ color: '#9ca3af', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab('billing')
                setSearchParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('tab', 'billing')
                  return next
                })
              }}
              style={tabStyle(activeTab === 'billing')}
            >
              Billing
            </button>
            </>
          )}
          {showTeamLaborTab && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('combined-labor')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'combined-labor')
                return next
              })
            }}
            style={tabStyle(activeTab === 'combined-labor')}
          >
            Team Labor
          </button>
          )}
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
            Sub Labor
          </button>
          {showSuperintendentExtraTabs && (
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
          )}
          </>
        )}
        {showPrimaryRestrictedTabs && showSuperintendentExtraTabs && (
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
        {showPrimaryRestrictedTabs && showSuperintendentExtraTabs && (
          <>
          <span style={{ color: '#9ca3af', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
          <button
            type="button"
            onClick={() => {
              setActiveTab('inspections')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'inspections')
                return next
              })
            }}
            style={tabStyle(activeTab === 'inspections')}
          >
            Inspections
          </button>
          </>
        )}
          </div>
        </div>
        <h1 style={{ margin: 0, marginLeft: '1rem', flexShrink: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Jobs</h1>
      </div>

      {searchParams.get('customer') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '0.875rem' }}>
          <span style={{ color: '#1e40af' }}>Filtered by customer</span>
          <button
            type="button"
            onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('customer'); return n })}
            style={{ padding: '0.25rem 0.5rem', background: 'white', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer', color: '#1e40af', fontSize: '0.8125rem' }}
          >
            Clear filter
          </button>
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
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {loading && (
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Loading jobs…</p>
          )}
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
            <button
              type="button"
              onClick={() => setBilledTotalByNameModalOpen(true)}
              title="Total by Name"
              aria-label="Total by Name"
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} aria-hidden>
                <path
                  fill="currentColor"
                  d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM192 152C192 165.3 202.7 176 216 176L264 176C277.3 176 288 165.3 288 152C288 138.7 277.3 128 264 128L216 128C202.7 128 192 138.7 192 152zM192 248C192 261.3 202.7 272 216 272L264 272C277.3 272 288 261.3 288 248C288 234.7 277.3 224 264 224L216 224C202.7 224 192 234.7 192 248zM304 324L304 328C275.2 328.3 252 351.7 252 380.5C252 406.2 270.5 428.1 295.9 432.3L337.6 439.3C343.6 440.3 348 445.5 348 451.6C348 458.5 342.4 464.1 335.5 464.1L280 464C269 464 260 473 260 484C260 495 269 504 280 504L304 504L304 508C304 519 313 528 324 528C335 528 344 519 344 508L344 503.3C369 499.2 388 477.6 388 451.5C388 425.8 369.5 403.9 344.1 399.7L302.4 392.7C296.4 391.7 292 386.5 292 380.4C292 373.5 297.6 367.9 304.5 367.9L352 367.9C363 367.9 372 358.9 372 347.9C372 336.9 363 327.9 352 327.9L344 327.9L344 323.9C344 312.9 335 303.9 324 303.9C313 303.9 304 312.9 304 323.9z"
                />
              </svg>
            </button>
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
            const paid = filtered.filter((j) => status(j) === 'paid')
            const readyToBillJobs = filtered.filter((j) => status(j) === 'ready_to_bill')
            const billedJobs = filtered.filter((j) => status(j) === 'billed')
            const readyToBillInvoices: InvoiceWithJob[] = filtered.flatMap((j) =>
              (j.invoices ?? []).filter((i) => i.status === 'ready_to_bill').map((inv) => ({ ...inv, job: j }))
            )
            const billedInvoices: InvoiceWithJob[] = filtered.flatMap((j) =>
              (j.invoices ?? []).filter((i) => i.status === 'billed').map((inv) => ({ ...inv, job: j }))
            )

            const readyToBillRows: StageRow[] = [
              ...readyToBillJobs.map((j) => ({ kind: 'job' as const, job: j })),
              ...readyToBillInvoices.map(({ job, ...inv }) => ({ kind: 'invoice' as const, inv, job })),
            ]
            const billedRows: StageRow[] = [
              ...billedJobs.map((j) => ({ kind: 'job' as const, job: j })),
              ...billedInvoices.map(({ job, ...inv }) => ({ kind: 'invoice' as const, inv, job })),
            ]

            function toggleStages(key: keyof typeof stagesSectionOpen) {
              setStagesSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
            }

            function renderEstimatedCompletionBlock(
              job: JobWithDetails,
              options?: { showEmptyPrompt?: boolean; onEmptyClick?: (j: JobWithDetails) => void }
            ) {
              const display = formatEstimatedCompletionDisplay(job.estimated_completion_date)
              if (!display && options?.showEmptyPrompt && options?.onEmptyClick) {
                return (
                  <button
                    type="button"
                    onClick={() => options.onEmptyClick!(job)}
                    style={{
                      display: 'block',
                      marginTop: '0.15rem',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      color: '#b91c1c',
                      border: '2px solid #b91c1c',
                      borderRadius: 4,
                      background: 'none',
                      cursor: 'pointer',
                      width: 'fit-content',
                    }}
                  >
                    Missing Billed Date
                  </button>
                )
              }
              return (
                <>
                  {display && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{display}</div>
                  )}
                  {stagesHamMode && (
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.15rem' }}>
                      <button
                        type="button"
                        onClick={() => updateJobEstimatedCompletionDate(job.id, -1, job.estimated_completion_date)}
                        disabled={estimatedCompletionDateSavingId === job.id}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: 'none',
                          cursor: estimatedCompletionDateSavingId === job.id ? 'not-allowed' : 'pointer',
                          color: '#6b7280',
                        }}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => updateJobEstimatedCompletionDate(job.id, 1, job.estimated_completion_date)}
                        disabled={estimatedCompletionDateSavingId === job.id}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: 'none',
                          cursor: estimatedCompletionDateSavingId === job.id ? 'not-allowed' : 'pointer',
                          color: '#6b7280',
                        }}
                      >
                        +1
                      </button>
                    </div>
                  )}
                </>
              )
            }

            function renderJobCustomerLine(job: JobWithDetails) {
              const hasCustomerInfo = ((job.customer_name ?? '').trim() || (job.customer_email ?? '').trim() || (job.customer_phone ?? '').trim())
              if (!hasCustomerInfo) return null
              const cn = (job.customer_name ?? '').trim()
              const impliedCustomerLink = !job.customer_id && customerListImpliesLinkedRow(customers, job.master_user_id, cn)
              const showNotInCustomersBadge = !job.customer_id && !impliedCustomerLink
              return (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginTop: '0.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.25rem',
                  }}
                >
                  <span>Customer: {(job.customer_name ?? '').trim() || '—'}</span>
                  {showNotInCustomersBadge ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditJobAndCreateCustomerFlow(job)
                      }}
                      aria-label="Open Edit Job and create customer from job"
                      style={{
                        padding: '0.1rem 0.3rem',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        background: '#fef3c7',
                        color: '#92400e',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      Not in Customers
                    </button>
                  ) : null}
                </div>
              )
            }

            function toggleStagesJobThreadExpanded(id: string) {
              setExpandedJobThreadId((prev) => (prev === id ? null : id))
            }

            function shouldSuppressStagesRowJobThreadToggle(target: EventTarget | null): boolean {
              const el = target instanceof Element ? target : null
              if (!el) return false
              return !!el.closest('button, a, input, textarea, select, label, [role="button"]')
            }

            function renderStagesThreadExpandButton(jobId: string) {
              const expanded = expandedJobThreadId === jobId
              const stat = jobThreadStatsByJobId[jobId]
              const count = stat?.note_count ?? 0
              return (
                <button
                  type="button"
                  onClick={() => toggleStagesJobThreadExpanded(jobId)}
                  aria-expanded={expanded}
                  title={count > 0 ? `${count} thread note(s)` : 'Job notes thread'}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    padding: '0.25rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#374151',
                    fontSize: '0.75rem',
                    lineHeight: 1.1,
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                  }}
                >
                  <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
                  {count > 0 ? (
                    <span style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 600 }}>{count}</span>
                  ) : null}
                </button>
              )
            }

            function renderStagesLastActivityCell(jobId: string) {
              const stat = jobThreadStatsByJobId[jobId]
              const count = stat?.note_count ?? 0
              const notes = jobThreadNotesByJobId[jobId]
              const lastNote = notes?.length ? notes[notes.length - 1] : undefined
              const fromThreadBody = (lastNote?.body ?? '').trim()
              const titleForEmpty = 'Job notes thread'
              const titleWithNotes = count > 0 ? `${count} thread note(s)` : titleForEmpty
              const expanded = expandedJobThreadId === jobId

              const tdShellStyle: CSSProperties = {
                padding: '0.75rem',
                verticalAlign: 'top',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: '0.35rem',
              }

              function lastActivityBodyInteractiveProps(title: string): {
                role: 'button'
                tabIndex: 0
                title: string
                'aria-expanded': boolean
                onClick: () => void
                onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
                style: CSSProperties
              } {
                return {
                  role: 'button',
                  tabIndex: 0,
                  title,
                  'aria-expanded': expanded,
                  onClick: () => toggleStagesJobThreadExpanded(jobId),
                  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleStagesJobThreadExpanded(jobId)
                    }
                  },
                  style: {
                    flex: 1,
                    minWidth: 0,
                    cursor: 'pointer',
                  },
                }
              }

              if (count === 0 || !stat?.last_note_at) {
                return (
                  <td style={tdShellStyle}>
                    {renderStagesThreadExpandButton(jobId)}
                    <div {...lastActivityBodyInteractiveProps(titleForEmpty)}>
                      <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>—</span>
                    </div>
                  </td>
                )
              }
              const meta = getDispatchNoteDisplayMeta(stat.last_note_at)
              const author =
                stat.last_note_author_name?.trim() || lastNote?.author?.name?.trim() || ''
              const body = (stat.last_note_body ?? '').trim() || fromThreadBody
              return (
                <td style={{ ...tdShellStyle, maxWidth: 280 }}>
                  {renderStagesThreadExpandButton(jobId)}
                  <div {...lastActivityBodyInteractiveProps(titleWithNotes)}>
                    <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.2rem' }}>
                      {author ? <span>{author}</span> : null}
                      {author ? <span style={{ margin: '0 0.35rem' }}>·</span> : null}
                      <span>{meta.weekdayTimeChicago}</span>
                      <span style={{ marginLeft: '0.35rem' }}>({meta.daysAgoLabel})</span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: '#374151',
                        lineHeight: 1.35,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '4.2em',
                        overflow: 'hidden',
                      }}
                    >
                      {body || '—'}
                    </div>
                  </div>
                </td>
              )
            }

            function stagesRowHasProjectBanner(
              projectId: string | null,
              project: { name: string } | null | undefined
            ): boolean {
              return !!(projectId && project)
            }

            function renderStagesProjectBannerRow(
              projectId: string | null,
              project: { name: string } | null | undefined,
              colSpan: number
            ): React.ReactElement | null {
              if (!projectId || !project) return null
              return (
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td
                    colSpan={colSpan}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#eff6ff',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <Link to={`/workflows/${projectId}`} style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 500 }}>
                      Project: {project.name}
                    </Link>
                  </td>
                </tr>
              )
            }

            function renderStagesTable(jobList: JobWithDetails[], actionLabel: React.ReactNode | null, onAction: (j: JobWithDetails) => void, showTimeOpen?: boolean, onSendBack?: (j: JobWithDetails) => void, onSendBackSimple?: (j: JobWithDetails) => void, showRemaining?: boolean, showFinalBill?: boolean, showPctComplete?: boolean) {
              const stagesTableColCount = 6 + (showPctComplete ? 1 : 0)
              return (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
                  <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assigned<br />HCP</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', minWidth: 200 }}>Last activity</th>
                        {showPctComplete && (
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>% Complete<br />/ Value Created</th>
                        )}
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>{showRemaining ? <>Remaining<br />/ Total Bill</> : showFinalBill ? 'Final Bill' : 'Revenue'}</th>
                        <th style={{ padding: '0.75rem', width: 140, borderBottom: '1px solid #e5e7eb' }} />
                        <th style={{ padding: '0.75rem', width: 120, borderBottom: '1px solid #e5e7eb' }}>View<br />Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobList.length === 0 ? (
                        <tr>
                          <td colSpan={stagesTableColCount} style={{ padding: '0.75rem', color: '#6b7280' }}>
                            No jobs in this group
                          </td>
                        </tr>
                      ) : (
                        jobList.map((j) => (
                          <Fragment key={j.id}>
                          <tr
                            style={{
                              borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid #e5e7eb',
                            }}
                            onClick={(e) => {
                              if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
                              toggleStagesJobThreadExpanded(j.id)
                            }}
                          >
                            <td style={{ padding: '0.75rem', position: 'relative', verticalAlign: 'top' }}>
                              {stagesHamMode ? (
                                <div ref={assignedEditJobId === j.id ? assignedEditDropdownRef : undefined} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
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
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{j.hcp_number || '—'}</div>
                                  {renderEstimatedCompletionBlock(j)}
                                </div>
                              ) : (
                                <>
                                  <div>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{j.hcp_number || '—'}</div>
                                  {renderEstimatedCompletionBlock(j)}
                                </>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {(() => {
                                const fmt = formatJobNameTwoLines(j.job_name)
                                if (!fmt) return <div>—</div>
                                return (
                                  <>
                                    <div>{fmt.line1}</div>
                                    {fmt.line2 && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{fmt.line2}</div>}
                                  </>
                                )
                              })()}
                              {(() => {
                                const fmt = formatAddressTwoLines(j.job_address)
                                if (!fmt) return null
                                return (
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                    <div>{fmt.line1}</div>
                                    {fmt.line2 && <div>{fmt.line2}</div>}
                                  </div>
                                )
                              })()}
                              {renderJobCustomerLine(j)}
                            </td>
                            {renderStagesLastActivityCell(j.id)}
                            {showPctComplete && (
                              <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.15rem' }}>
                                    <input
                                      key={`pct-${j.id}-${j.pct_complete ?? 'null'}`}
                                      type="number"
                                      min={0}
                                      max={100}
                                      defaultValue={j.pct_complete != null ? j.pct_complete : ''}
                                      onBlur={(e) => {
                                        const v = e.target.value.trim()
                                        if (v === '') {
                                          updateJobPctComplete(j.id, null)
                                          return
                                        }
                                        const n = Math.round(Number(v))
                                        if (!Number.isNaN(n) && n >= 0 && n <= 100) {
                                          updateJobPctComplete(j.id, n)
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur()
                                        }
                                      }}
                                      disabled={pctCompleteSavingId === j.id}
                                      placeholder=""
                                      style={{
                                        width: '3.5rem',
                                        padding: '0.25rem 0.35rem',
                                        fontSize: '0.8125rem',
                                        textAlign: 'center',
                                        border: 'none',
                                        borderBottom: '1px solid #d1d5db',
                                        borderRadius: 0,
                                        background: 'transparent',
                                      }}
                                    />
                                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>%</span>
                                  </div>
                                  <div style={{ fontSize: '0.8125rem' }}>
                                    {j.pct_complete != null
                                      ? `${formatCurrencyNoCents((Number(j.revenue ?? 0) * j.pct_complete) / 100)} done`
                                      : '—'}
                                  </div>
                                  {(() => {
                                    const totalBill = Number(j.revenue ?? 0)
                                    const valueCreated = j.pct_complete != null ? (totalBill * j.pct_complete) / 100 : 0
                                    const remaining = Math.max(0, totalBill - Number(j.payments_made ?? 0))
                                    const toBill = valueCreated - (totalBill - remaining)
                                    return (
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                        {valueCreated === 0 || toBill === 0 ? '—' : `${formatCurrencyNoCents(toBill)} to bill`}
                                      </div>
                                    )
                                  })()}
                                </div>
                              </td>
                            )}
                            <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                              {showRemaining
                                ? (() => {
                                    const rev = j.revenue != null ? Number(j.revenue) : 0
                                    const pm = j.payments_made != null ? Number(j.payments_made) : 0
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{pm > 0 ? `${formatCurrencyNoCents(pm)} paid` : '—'}</span>
                                        <span>{rev > 0 || pm > 0 ? `${formatCurrencyNoCents(rev - pm)} left` : '—'}</span>
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{j.revenue != null ? `${formatCurrencyNoCents(Number(j.revenue))} bid` : '—'}</span>
                                      </div>
                                    )
                                  })()
                                : (j.revenue != null ? formatCurrency(Number(j.revenue)) : '—')}
                            </td>
                            <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {showTimeOpen && (
                                      <span style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'block', textAlign: 'center', minWidth: '5rem' }} title="Time since job created">
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
                                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => openInExternalBrowser(buildClickToolingUrl(j))}
                                      title="Open Click Tooling report (pre-fill customer info)"
                                      aria-label="Open Click Tooling"
                                      style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                        <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
                                      </svg>
                                    </button>
                                    {(() => {
                                      const rem = Math.max(0, (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)))
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => { setCreatePartialInvoiceAmount(''); setCreatePartialInvoiceJob(j) }}
                                          disabled={rem <= 0}
                                          title={rem <= 0 ? 'No remaining amount' : 'Create partial invoice'}
                                          aria-label="Create partial invoice"
                                          style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: rem <= 0 ? 'not-allowed' : 'pointer', color: rem <= 0 ? '#9ca3af' : '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                            <path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
                                          </svg>
                                        </button>
                                      )
                                    })()}
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
                                  </div>
                                </div>
                              </td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{
                                  fontSize: '0.8125rem',
                                  color: ((j.report_count ?? 0) > 0) ? '#111' : '#6b7280',
                                  fontWeight: ((j.report_count ?? 0) > 0) ? 600 : 400,
                                  textAlign: 'center',
                                }}>
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
                          </tr>
                          {expandedJobThreadId === j.id && (
                            <tr>
                              <td
                                colSpan={stagesTableColCount}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  background: '#f9fafb',
                                  borderBottom: '1px solid #e5e7eb',
                                }}
                              >
                                <JobThreadNotesPanel
                                  notes={jobThreadNotesByJobId[j.id] ?? []}
                                  loading={jobThreadNotesLoadingId === j.id}
                                  canPost={!!authUser}
                                  draft={jobThreadDraft}
                                  submitting={jobThreadSubmittingId === j.id}
                                  onDraftChange={setJobThreadDraft}
                                  onSubmit={() => void submitJobThreadNote(j.id)}
                                />
                              </td>
                            </tr>
                          )}
                          {renderStagesProjectBannerRow(j.project_id, j.project, stagesTableColCount)}
                          </Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            }

            function renderUnifiedStagesTable(
              rows: StageRow[],
              options: {
                actionLabel: React.ReactNode | null
                onJobAction: (j: JobWithDetails) => void
                onInvoiceAction: (inv: InvoiceWithJob) => void
                onJobSendBack?: (j: JobWithDetails) => void
                onInvoiceSendBack: (inv: InvoiceWithJob) => void
                showRemaining?: boolean
                showTimeOpen?: boolean
                sendBackBelowRemaining?: boolean
                showCreatePartialInvoice?: boolean
                showEmptyEstDoneBillDatePrompt?: boolean
                onEmptyEstDoneBillDateClick?: (j: JobWithDetails) => void
                onEmptyInvoiceEstBillDateClick?: (inv: JobsLedgerInvoice, job: JobWithDetails) => void
              }
            ) {
              const {
                actionLabel,
                onJobAction,
                onInvoiceAction,
                onJobSendBack,
                onInvoiceSendBack,
                showRemaining,
                showTimeOpen,
                sendBackBelowRemaining,
                showCreatePartialInvoice,
                showEmptyEstDoneBillDatePrompt,
                onEmptyEstDoneBillDateClick,
                onEmptyInvoiceEstBillDateClick,
              } = options
              const unifiedStagesColCount = 6
              return (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
                  <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assigned<br />HCP</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', minWidth: 200 }}>Last activity</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Remaining<br />/ Total Bill</th>
                        <th style={{ padding: '0.75rem', width: 140, borderBottom: '1px solid #e5e7eb' }} />
                        <th style={{ padding: '0.75rem', width: 120, borderBottom: '1px solid #e5e7eb' }}>View<br />Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={unifiedStagesColCount} style={{ padding: '0.75rem', color: '#6b7280' }}>
                            No jobs or invoices in this group
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => {
                          if (row.kind === 'job') {
                            const j = row.job
                            return (
                              <Fragment key={`job-${j.id}`}>
                              <tr
                                style={{
                                  borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid #e5e7eb',
                                }}
                                onClick={(e) => {
                                  if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
                                  toggleStagesJobThreadExpanded(j.id)
                                }}
                              >
                                <td style={{ padding: '0.75rem', verticalAlign: 'top', position: 'relative' }}>
                                  {stagesHamMode ? (
                                    <div ref={assignedEditJobId === j.id ? assignedEditDropdownRef : undefined} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
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
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{j.hcp_number || '—'}</div>
                                    {showEmptyEstDoneBillDatePrompt && onEmptyEstDoneBillDateClick
                                      ? renderEstimatedCompletionBlock(j, { showEmptyPrompt: true, onEmptyClick: onEmptyEstDoneBillDateClick })
                                      : renderEstimatedCompletionBlock(j)}
                                  </div>
                                  ) : (
                                    <>
                                      <div>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{j.hcp_number || '—'}</div>
                                      {showEmptyEstDoneBillDatePrompt && onEmptyEstDoneBillDateClick
                                        ? renderEstimatedCompletionBlock(j, { showEmptyPrompt: true, onEmptyClick: onEmptyEstDoneBillDateClick })
                                        : renderEstimatedCompletionBlock(j)}
                                    </>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {(() => {
                                    const fmt = formatJobNameTwoLines(j.job_name)
                                    if (!fmt) return <div>—</div>
                                    return (
                                      <>
                                        <div>{fmt.line1}</div>
                                        {fmt.line2 && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{fmt.line2}</div>}
                                      </>
                                    )
                                  })()}
                                  {(() => {
                                    const fmt = formatAddressTwoLines(j.job_address)
                                    if (!fmt) return null
                                    return (
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                        <div>{fmt.line1}</div>
                                        {fmt.line2 && <div>{fmt.line2}</div>}
                                      </div>
                                    )
                                  })()}
                                  {renderJobCustomerLine(j)}
                                </td>
                                {renderStagesLastActivityCell(j.id)}
                                <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    {showRemaining && (() => {
                                      const pm = j.payments_made != null ? Number(j.payments_made) : 0
                                      return <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{pm > 0 ? `${formatCurrencyNoCents(pm)} paid` : '—'}</span>
                                    })()}
                                    <span>
                                      {showRemaining
                                        ? (() => {
                                            const rev = j.revenue != null ? Number(j.revenue) : 0
                                            const pm = j.payments_made != null ? Number(j.payments_made) : 0
                                            return rev > 0 || pm > 0 ? `${formatCurrencyNoCents(rev - pm)} left` : '—'
                                          })()
                                        : (j.revenue != null ? formatCurrencyNoCents(Number(j.revenue)) : '—')}
                                    </span>
                                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{j.revenue != null ? `${formatCurrencyNoCents(Number(j.revenue))} bid` : '—'}</span>
                                    {sendBackBelowRemaining && onJobSendBack && (
                                      <button
                                        type="button"
                                        onClick={() => onJobSendBack(j)}
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
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                      {actionLabel && (
                                        <button
                                          type="button"
                                          onClick={() => onJobAction(j)}
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
                                      {showTimeOpen && (
                                        <span style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'block', textAlign: 'center', minWidth: '5rem' }} title="Time since job created">
                                          Open {formatTimeSince(j.created_at ?? null)}
                                        </span>
                                      )}
                                      {!sendBackBelowRemaining && onJobSendBack && (
                                        <button
                                          type="button"
                                          onClick={() => onJobSendBack(j)}
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
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => openInExternalBrowser(buildClickToolingUrl(j))}
                                        title="Open Click Tooling report (pre-fill customer info)"
                                        aria-label="Open Click Tooling"
                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                          <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
                                        </svg>
                                      </button>
                                      {showCreatePartialInvoice && (() => {
                                        const rem = Math.max(0, (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)))
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => { setCreatePartialInvoiceAmount(''); setCreatePartialInvoiceJob(j) }}
                                            disabled={rem <= 0}
                                            title={rem <= 0 ? 'No remaining amount' : 'Create partial invoice'}
                                            aria-label="Create partial invoice"
                                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: rem <= 0 ? 'not-allowed' : 'pointer', color: rem <= 0 ? '#9ca3af' : '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                              <path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
                                            </svg>
                                          </button>
                                        )
                                      })()}
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
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{
                                      fontSize: '0.8125rem',
                                      color: ((j.report_count ?? 0) > 0) ? '#111' : '#6b7280',
                                      fontWeight: ((j.report_count ?? 0) > 0) ? 600 : 400,
                                      textAlign: 'center',
                                    }}>
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
                              </tr>
                              {expandedJobThreadId === j.id && (
                                <tr>
                                  <td
                                    colSpan={unifiedStagesColCount}
                                    style={{
                                      padding: '0.5rem 0.75rem',
                                      background: '#f9fafb',
                                      borderBottom: '1px solid #e5e7eb',
                                    }}
                                  >
                                    <JobThreadNotesPanel
                                      notes={jobThreadNotesByJobId[j.id] ?? []}
                                      loading={jobThreadNotesLoadingId === j.id}
                                      canPost={!!authUser}
                                      draft={jobThreadDraft}
                                      submitting={jobThreadSubmittingId === j.id}
                                      onDraftChange={setJobThreadDraft}
                                      onSubmit={() => void submitJobThreadNote(j.id)}
                                    />
                                  </td>
                                </tr>
                              )}
                              {renderStagesProjectBannerRow(j.project_id, j.project, unifiedStagesColCount)}
                              </Fragment>
                            )
                          } else {
                            const { inv, job } = row
                            const invWithJob: InvoiceWithJob = { ...inv, job }
                            return (
                              <Fragment key={`inv-${inv.id}`}>
                              <tr
                                style={{
                                  borderBottom: stagesRowHasProjectBanner(job.project_id, job.project) ? 'none' : '1px solid #e5e7eb',
                                }}
                                onClick={(e) => {
                                  if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
                                  toggleStagesJobThreadExpanded(job.id)
                                }}
                              >
                                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                                  <div>{(job.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{job.hcp_number || '—'}</div>
                                  {(() => {
                                    const eff = effectiveInvoiceEstBillDate(inv, job)
                                    const display = formatEstimatedCompletionDisplay(eff)
                                    return (
                                      <>
                                        {!display && showEmptyEstDoneBillDatePrompt && onEmptyInvoiceEstBillDateClick ? (
                                          <button
                                            type="button"
                                            onClick={() => onEmptyInvoiceEstBillDateClick(inv, job)}
                                            style={{
                                              display: 'block',
                                              marginTop: '0.15rem',
                                              padding: '0.25rem 0.5rem',
                                              fontSize: '0.75rem',
                                              color: '#b91c1c',
                                              border: '2px solid #b91c1c',
                                              borderRadius: 4,
                                              background: 'none',
                                              cursor: 'pointer',
                                              width: 'fit-content',
                                            }}
                                          >
                                            Missing Billed Date
                                          </button>
                                        ) : null}
                                        {display ? (
                                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{display}</div>
                                        ) : null}
                                        {stagesHamMode ? (
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.25rem',
                                              marginTop: '0.15rem',
                                            }}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, job, -1)
                                              }}
                                              disabled={invoiceEstimatedBillDateSavingId === inv.id}
                                              style={{
                                                padding: '0.25rem 0.5rem',
                                                fontSize: '0.75rem',
                                                border: '1px solid #d1d5db',
                                                borderRadius: 4,
                                                background: 'none',
                                                cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                                color: '#6b7280',
                                              }}
                                            >
                                              -1
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, job, 1)
                                              }}
                                              disabled={invoiceEstimatedBillDateSavingId === inv.id}
                                              style={{
                                                padding: '0.25rem 0.5rem',
                                                fontSize: '0.75rem',
                                                border: '1px solid #d1d5db',
                                                borderRadius: 4,
                                                background: 'none',
                                                cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                                color: '#6b7280',
                                              }}
                                            >
                                              +1
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setWhenInvoiceBillModal({
                                                  invoiceId: inv.id,
                                                  jobId: job.id,
                                                  jobName: job.job_name ?? '—',
                                                  hcpNumber: job.hcp_number ?? '—',
                                                })
                                                setWhenInvoiceBillModalDate(
                                                  inv.estimated_bill_date?.trim().slice(0, 10) ??
                                                    job.estimated_completion_date?.trim().slice(0, 10) ??
                                                    ''
                                                )
                                              }}
                                              disabled={invoiceEstimatedBillDateSavingId === inv.id}
                                              title="Edit est. bill date"
                                              aria-label="Edit est. bill date"
                                              style={{
                                                padding: '0.25rem',
                                                background: 'none',
                                                border: 'none',
                                                cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                                color: '#374151',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                              }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
                                                <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                                              </svg>
                                            </button>
                                          </div>
                                        ) : null}
                                      </>
                                    )
                                  })()}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {(() => {
                                    const fmt = formatJobNameTwoLines(job.job_name)
                                    if (!fmt) return <div>—</div>
                                    return (
                                      <>
                                        <div>{fmt.line1}</div>
                                        {fmt.line2 && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{fmt.line2}</div>}
                                      </>
                                    )
                                  })()}
                                  {(() => {
                                    const fmt = formatAddressTwoLines(job.job_address)
                                    if (!fmt) return null
                                    return (
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                        <div>{fmt.line1}</div>
                                        {fmt.line2 && <div>{fmt.line2}</div>}
                                      </div>
                                    )
                                  })()}
                                  {renderJobCustomerLine(job)}
                                </td>
                                {renderStagesLastActivityCell(job.id)}
                                <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                                      {Number(job.payments_made ?? 0) > 0 ? `${formatCurrencyNoCents(Number(job.payments_made ?? 0))} paid` : '—'}
                                    </span>
                                    <span>{`${formatCurrencyNoCents(Number(inv.amount))} left`}</span>
                                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{job.revenue != null ? `${formatCurrencyNoCents(Number(job.revenue))} bid` : '—'}</span>
                                    {sendBackBelowRemaining && (
                                      <button
                                        type="button"
                                        onClick={() => onInvoiceSendBack(invWithJob)}
                                        disabled={stagesInvoiceUpdatingId === inv.id}
                                        style={{
                                          padding: '0.35rem 0.75rem',
                                          fontSize: '0.8125rem',
                                          background: 'none',
                                          color: '#6b7280',
                                          border: '1px solid #d1d5db',
                                          borderRadius: 4,
                                          cursor: stagesInvoiceUpdatingId === inv.id ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        Send back
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                      {actionLabel && (
                                        <button
                                          type="button"
                                          onClick={() => onInvoiceAction(invWithJob)}
                                          disabled={stagesInvoiceUpdatingId === inv.id}
                                          style={{
                                            padding: '0.35rem 0.75rem',
                                            fontSize: '0.8125rem',
                                            background: '#16a34a',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: stagesInvoiceUpdatingId === inv.id ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          {stagesInvoiceUpdatingId === inv.id ? '…' : actionLabel}
                                        </button>
                                      )}
                                      {!sendBackBelowRemaining && (
                                        <button
                                          type="button"
                                          onClick={() => onInvoiceSendBack(invWithJob)}
                                          disabled={stagesInvoiceUpdatingId === inv.id}
                                          style={{
                                            padding: '0.35rem 0.75rem',
                                            fontSize: '0.8125rem',
                                            background: 'none',
                                            color: '#6b7280',
                                            border: '1px solid #d1d5db',
                                            borderRadius: 4,
                                            cursor: stagesInvoiceUpdatingId === inv.id ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          Send back
                                        </button>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => openInExternalBrowser(buildClickToolingUrl(job))}
                                        title="Open Click Tooling report (pre-fill customer info)"
                                        aria-label="Open Click Tooling"
                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                          <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
                                        </svg>
                                      </button>
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
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{
                                      fontSize: '0.8125rem',
                                      color: ((job.report_count ?? 0) > 0) ? '#111' : '#6b7280',
                                      fontWeight: ((job.report_count ?? 0) > 0) ? 600 : 400,
                                      textAlign: 'center',
                                    }}>
                                      {(job.report_count ?? 0)} report{(job.report_count ?? 0) !== 1 ? 's' : ''}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setViewReportsJob({ id: job.id, hcpNumber: job.hcp_number ?? '—', jobName: job.job_name ?? '—', jobAddress: job.job_address ?? '—' })}
                                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      View<br />Reports
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {expandedJobThreadId === job.id && (
                                <tr>
                                  <td
                                    colSpan={unifiedStagesColCount}
                                    style={{
                                      padding: '0.5rem 0.75rem',
                                      background: '#f9fafb',
                                      borderBottom: '1px solid #e5e7eb',
                                    }}
                                  >
                                    <JobThreadNotesPanel
                                      notes={jobThreadNotesByJobId[job.id] ?? []}
                                      loading={jobThreadNotesLoadingId === job.id}
                                      canPost={!!authUser}
                                      draft={jobThreadDraft}
                                      submitting={jobThreadSubmittingId === job.id}
                                      onDraftChange={setJobThreadDraft}
                                      onSubmit={() => void submitJobThreadNote(job.id)}
                                    />
                                  </td>
                                </tr>
                              )}
                              {renderStagesProjectBannerRow(job.project_id, job.project, unifiedStagesColCount)}
                              </Fragment>
                            )
                          }
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )
            }

            const workingTotal = working.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0)
            const capableToBillTotal = working.reduce((s, j) => {
              const totalBill = Number(j.revenue ?? 0)
              const valueCreated = j.pct_complete != null ? (totalBill * j.pct_complete) / 100 : 0
              const remaining = Math.max(0, totalBill - Number(j.payments_made ?? 0))
              const toBill = valueCreated - (totalBill - remaining)
              return s + Math.max(0, toBill)
            }, 0)
            const readyToBillTotal =
              readyToBillJobs.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0) +
              readyToBillInvoices.reduce((s, i) => s + Number(i.amount), 0)
            const billedTotal =
              billedJobs.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0) +
              billedInvoices.reduce((s, i) => s + Number(i.amount), 0)
            return (
              <>
                <div id="stages-working" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('working')}
                    aria-expanded={stagesSectionOpen.working}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{stagesSectionOpen.working ? '\u25BC' : '\u25B6'}</span>
                    Working ({working.length}) - ${formatCurrency(workingTotal)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapableToBillModalOpen(true)}
                    style={{ fontSize: '0.9375rem', color: '#6b7280', fontWeight: 400, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Capable of Being Billed: <span style={{ fontWeight: 600 }}>${formatCurrencyNoCents(capableToBillTotal)}</span>
                  </button>
                </div>
                {stagesSectionOpen.working && renderStagesTable(
                  working,
                  'Ready to Bill',
                  (j) => stagesHamMode ? updateJobStatus(j.id, 'ready_to_bill') : (setReadyForBillingChecked1(false), setReadyForBillingChecked2(false), setReadyForBillingJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—' })),
                  true, undefined, undefined, true, undefined, true
                )}

                <button
                  type="button"
                  onClick={() => toggleStages('readyToBill')}
                  aria-expanded={stagesSectionOpen.readyToBill}
                  style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <span aria-hidden>{stagesSectionOpen.readyToBill ? '\u25BC' : '\u25B6'}</span>
                  Ready to Bill ({readyToBillJobs.length + readyToBillInvoices.length}) - ${formatCurrency(readyToBillTotal)}
                </button>
                {stagesSectionOpen.readyToBill && renderUnifiedStagesTable(readyToBillRows, {
                  actionLabel: 'Mark as Billed',
                  onJobAction: (j) => stagesHamMode ? updateJobStatus(j.id, 'billed') : (setMarkAsBilledChecked(false), setMarkAsBilledJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—' })),
                  onInvoiceAction: (inv) => stagesHamMode ? updateInvoiceStatus(inv.id, 'billed') : (setMarkAsBilledChecked(false), setMarkAsBilledInvoice(inv)),
                  onJobSendBack: (j) => stagesHamMode ? updateJobStatus(j.id, 'working') : (setSendBackChecked(false), setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'working' })),
                  onInvoiceSendBack: (inv) => stagesHamMode ? deleteInvoice(inv.id) : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'delete' })),
                  showRemaining: true,
                  showTimeOpen: true,
                  showCreatePartialInvoice: true,
                })}

                <div id="stages-billed" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => toggleStages('billed')}
                      aria-expanded={stagesSectionOpen.billed}
                      style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                    >
                      <span aria-hidden>{stagesSectionOpen.billed ? '\u25BC' : '\u25B6'}</span>
                      Billed Awaiting Payment ({billedJobs.length + billedInvoices.length}) - ${formatCurrency(billedTotal)}
                    </button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#6b7280' }}>
                      {`30+ days: ${billedAgingBuckets.count30_90} | $${formatCurrency(billedAgingBuckets.sum30_90)} — 90+ days: ${billedAgingBuckets.count90} | $${formatCurrency(billedAgingBuckets.sum90)} · est. bill date`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => printBilledAwaitingPaymentReport(billedRows, { searchFilter: stagesSearchQuery })}
                    disabled={billedRows.length === 0}
                    title="Print customers, contacts, and amounts due"
                    aria-label="Print billed awaiting payment report"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      flexShrink: 0,
                      height: 36,
                      padding: '0 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      background: billedRows.length === 0 ? '#f3f4f6' : 'white',
                      cursor: billedRows.length === 0 ? 'not-allowed' : 'pointer',
                      color: '#374151',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} aria-hidden>
                      <path
                        fill="currentColor"
                        d="M128 192L128 96C128 78.3 142.3 64 160 64L480 64C497.7 64 512 78.3 512 96L512 192L552 192C569.7 192 584 206.3 584 224L584 384C584 401.7 569.7 416 552 416L512 416L512 520C512 537.7 497.7 552 480 552L160 552C142.3 552 128 537.7 128 520L128 416L88 416C70.3 416 56 401.7 56 384L56 224C56 206.3 70.3 192 88 192L128 192zM176 416L176 496L464 496L464 416L176 416zM512 352L512 256L88 256L88 352L128 352L128 192L512 192L512 352zM464 144L464 120C464 111.2 456.8 104 448 104L192 104C183.2 104 176 111.2 176 120L176 144L464 144z"
                      />
                    </svg>
                    Print
                  </button>
                </div>
                {stagesSectionOpen.billed && renderUnifiedStagesTable(billedRows, {
                  actionLabel: 'Mark Paid',
                  onJobAction: (j) => stagesHamMode ? markJobPaid(j.id) : (setMarkPaidChecked(false), setMarkPaidJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—' })),
                  onInvoiceAction: (inv) => stagesHamMode ? markInvoicePaid(inv.id) : (setMarkPaidChecked(false), setMarkPaidInvoice(inv)),
                  onJobSendBack: (j) => stagesHamMode ? updateJobStatus(j.id, 'ready_to_bill') : (setSendBackChecked(false), setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'ready_to_bill' })),
                  onInvoiceSendBack: (inv) => stagesHamMode ? updateInvoiceStatus(inv.id, 'ready_to_bill') : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'revert' })),
                  showRemaining: true,
                  showTimeOpen: true,
                  sendBackBelowRemaining: true,
                  showCreatePartialInvoice: false,
                  showEmptyEstDoneBillDatePrompt: true,
                  onEmptyEstDoneBillDateClick: (j) => { setWhenBilledModalJob(j); setWhenBilledModalDate(''); },
                  onEmptyInvoiceEstBillDateClick: (inv, j) => {
                    setWhenInvoiceBillModal({
                      invoiceId: inv.id,
                      jobId: j.id,
                      jobName: j.job_name ?? '—',
                      hcpNumber: j.hcp_number ?? '—',
                    })
                    setWhenInvoiceBillModalDate('')
                  },
                })}

                <button
                  type="button"
                  onClick={() => toggleStages('paid')}
                  aria-expanded={stagesSectionOpen.paid}
                  style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <span aria-hidden>{stagesSectionOpen.paid ? '\u25BC' : '\u25B6'}</span>
                  Paid in Full ({paid.length})
                </button>
                {stagesSectionOpen.paid && renderStagesTable(paid, null, () => {}, true, undefined, stagesHamMode
                  ? (j) => updateJobStatus(j.id, 'billed')
                  : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'billed' }), false, true)}

                {billedTotalByNameModalOpen && (() => {
                  const byNameRows = new Map<string, StageRow[]>()
                  for (const r of billedRows) {
                    const name = r.job.job_name || '—'
                    const list = byNameRows.get(name) ?? []
                    list.push(r)
                    byNameRows.set(name, list)
                  }
                  const entries = [...byNameRows.entries()]
                    .map(([name, rows]) => ({
                      name,
                      rows,
                      total: rows.reduce((sum, row) => sum + stageRowBilledRemainingAmount(row), 0),
                    }))
                    .sort((a, b) => b.total - a.total)
                  return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 560, maxHeight: '80vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0 }}>Billed Awaiting Payment by Job Name</h2>
                          <button
                            type="button"
                            onClick={() => printBilledAwaitingPaymentReport(billedRows, { searchFilter: stagesSearchQuery })}
                            disabled={billedRows.length === 0}
                            title="Print customers, contacts, and amounts due"
                            aria-label="Print billed awaiting payment report"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              flexShrink: 0,
                              height: 36,
                              padding: '0 0.75rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: billedRows.length === 0 ? '#f3f4f6' : 'white',
                              cursor: billedRows.length === 0 ? 'not-allowed' : 'pointer',
                              color: '#374151',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} aria-hidden>
                              <path
                                fill="currentColor"
                                d="M128 192L128 96C128 78.3 142.3 64 160 64L480 64C497.7 64 512 78.3 512 96L512 192L552 192C569.7 192 584 206.3 584 224L584 384C584 401.7 569.7 416 552 416L512 416L512 520C512 537.7 497.7 552 480 552L160 552C142.3 552 128 537.7 128 520L128 416L88 416C70.3 416 56 401.7 56 384L56 224C56 206.3 70.3 192 88 192L128 192zM176 416L176 496L464 496L464 416L176 416zM512 352L512 256L88 256L88 352L128 352L128 192L512 192L512 352zM464 144L464 120C464 111.2 456.8 104 448 104L192 104C183.2 104 176 111.2 176 120L176 144L464 144z"
                              />
                            </svg>
                            Print
                          </button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Job Name</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map(({ name, total, rows }, idx) => {
                              const expanded = billedTotalByNameExpandedName === name
                              const panelId = `total-by-name-detail-${idx}`
                              const detailRows = sortStageRowsForTotalByNameDetail(rows)
                              return (
                                <Fragment key={name}>
                                  <tr style={{ borderBottom: expanded ? 'none' : '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setBilledTotalByNameExpandedName((prev) => (prev === name ? null : name))
                                        }
                                        aria-expanded={expanded}
                                        aria-controls={panelId}
                                        id={`total-by-name-toggle-${idx}`}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.35rem',
                                          padding: 0,
                                          border: 'none',
                                          background: 'none',
                                          cursor: 'pointer',
                                          color: '#111827',
                                          fontSize: 'inherit',
                                          textAlign: 'left',
                                          maxWidth: '100%',
                                        }}
                                      >
                                        <span aria-hidden style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                                          {expanded ? '\u25BC' : '\u25B6'}
                                        </span>
                                        {name}
                                      </button>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500 }}>${formatCurrency(total)}</td>
                                  </tr>
                                  {expanded && (
                                    <tr>
                                      <td
                                        colSpan={2}
                                        style={{
                                          padding: 0,
                                          borderBottom:
                                            idx === entries.length - 1 ? 'none' : '1px solid #e5e7eb',
                                          background: '#f9fafb',
                                        }}
                                      >
                                        <div id={panelId} role="region" aria-labelledby={`total-by-name-toggle-${idx}`} style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                              <tr>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Line</th>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Amount</th>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Age</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {detailRows.map((r, detailIdx) => {
                                                const amt = stageRowBilledRemainingAmount(r)
                                                const days = stageRowBilledAgeDays(r)
                                                const ageLabel = days == null ? '—' : `${days} day${days !== 1 ? 's' : ''}`
                                                const rowKey = r.kind === 'job' ? `job-${r.job.id}` : `inv-${r.inv.id}`
                                                const addr = (r.job.job_address ?? '').trim() || '—'
                                                const isLastBillInGroup = detailIdx === detailRows.length - 1
                                                return (
                                                  <Fragment key={rowKey}>
                                                    <tr style={{ borderBottom: 'none' }}>
                                                      <td style={{ padding: '0.35rem 0.5rem' }}>{stageRowBilledLineLabel(r)}</td>
                                                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>${formatCurrency(amt)}</td>
                                                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: '#6b7280' }}>{ageLabel}</td>
                                                    </tr>
                                                    <tr
                                                      style={{
                                                        borderBottom: isLastBillInGroup ? 'none' : '1px solid #e5e7eb',
                                                      }}
                                                    >
                                                      <td
                                                        colSpan={3}
                                                        style={{
                                                          padding: '0 0.5rem 0.35rem',
                                                          fontSize: '0.75rem',
                                                          color: '#6b7280',
                                                        }}
                                                      >
                                                        {addr}
                                                      </td>
                                                    </tr>
                                                  </Fragment>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setBilledTotalByNameModalOpen(false)
                              setStagesSectionOpen((prev) => ({ ...prev, billed: true }))
                              setTimeout(() => document.getElementById('stages-billed')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                            }}
                            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            take me to Job: Stages: Billed
                          </button>
                          <button type="button" onClick={() => setBilledTotalByNameModalOpen(false)} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {capableToBillModalOpen && (() => {
                  const rows = working
                    .map((j) => {
                      const totalBill = Number(j.revenue ?? 0)
                      const valueCreated = j.pct_complete != null ? (totalBill * j.pct_complete) / 100 : 0
                      const remaining = Math.max(0, totalBill - Number(j.payments_made ?? 0))
                      const toBill = valueCreated - (totalBill - remaining)
                      return { job: j, toBill, valueCreated }
                    })
                    .filter((r) => r.toBill > 0)
                    .sort((a, b) => b.toBill - a.toBill)
                  return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 480, maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
                        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Capable of Being Billed — Breakdown</h2>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                          Jobs in Working with billable value. Sorted by amount.
                        </p>
                        {rows.length === 0 ? (
                          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>No jobs with billable amount</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Job</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>%</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Done</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Paid</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>To Bill</th>
                                <th style={{ padding: '0.5rem 0.75rem', width: 80 }} />
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(({ job, toBill, valueCreated }) => (
                                <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <div>{job.job_name || '—'}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{job.hcp_number || '—'}</div>
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{job.pct_complete != null ? `${job.pct_complete}%` : '—'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(valueCreated)}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(Number(job.payments_made ?? 0))}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(toBill)}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditing(job)
                                        setCapableToBillModalOpen(false)
                                      }}
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
                                <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>Total</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(capableToBillTotal)}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        )}
                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setCapableToBillModalOpen(false)
                              setStagesSectionOpen((prev) => ({ ...prev, working: true }))
                              setTimeout(() => document.getElementById('stages-working')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                            }}
                            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            take me to Job: Stages: Working
                          </button>
                          <button type="button" onClick={() => setCapableToBillModalOpen(false)} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {whenInvoiceBillModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480 }}>
                      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Est. bill date for partial invoice</h2>
                      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                        {whenInvoiceBillModal.jobName} ({whenInvoiceBillModal.hcpNumber})
                      </p>
                      <label style={{ display: 'block', marginBottom: '1rem' }}>
                        <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Date</span>
                        <input
                          type="date"
                          value={whenInvoiceBillModalDate}
                          onChange={(e) => setWhenInvoiceBillModalDate(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                        />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setWhenInvoiceBillModal(null)
                            setWhenInvoiceBillModalDate('')
                          }}
                          style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={
                            !whenInvoiceBillModalDate.trim() ||
                            invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId
                          }
                          onClick={async () => {
                            if (!whenInvoiceBillModalDate.trim() || !whenInvoiceBillModal) return
                            await setInvoiceEstimatedBillDate(
                              whenInvoiceBillModal.invoiceId,
                              whenInvoiceBillModal.jobId,
                              whenInvoiceBillModalDate.trim()
                            )
                            setWhenInvoiceBillModal(null)
                            setWhenInvoiceBillModalDate('')
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor:
                              !whenInvoiceBillModalDate.trim() ||
                              invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId
                                ? 'not-allowed'
                                : 'pointer',
                          }}
                        >
                          {invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {whenBilledModalJob && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480 }}>
                      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>When was this job billed?</h2>
                      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                        {whenBilledModalJob.job_name || '—'} ({whenBilledModalJob.hcp_number || '—'})
                      </p>
                      <label style={{ display: 'block', marginBottom: '1rem' }}>
                        <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Date</span>
                        <input
                          type="date"
                          value={whenBilledModalDate}
                          onChange={(e) => setWhenBilledModalDate(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                        />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => { setWhenBilledModalJob(null); setWhenBilledModalDate(''); }}
                          style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!whenBilledModalDate.trim() || estimatedCompletionDateSavingId === whenBilledModalJob.id}
                          onClick={async () => {
                            if (!whenBilledModalDate.trim()) return
                            await setJobEstimatedCompletionDate(whenBilledModalJob.id, whenBilledModalDate.trim())
                            setWhenBilledModalJob(null)
                            setWhenBilledModalDate('')
                          }}
                          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: estimatedCompletionDateSavingId === whenBilledModalJob.id ? 'not-allowed' : 'pointer' }}
                        >
                          {estimatedCompletionDateSavingId === whenBilledModalJob.id ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {activeTab === 'sub_sheet_ledger' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="search"
              placeholder="Search contractor, HCP, address…"
              value={subLaborSearch}
              onChange={(e) => setSubLaborSearch(e.target.value)}
              style={{ flex: '1 1 200px', minWidth: 200, maxWidth: 400, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
            />
            <button
              type="button"
              onClick={openNewLaborJob}
              style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              New Sub Labor
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
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>
              Sub Labor Due: ${formatCurrency(subLaborDueTotal)}
            </div>
          </div>
          {laborJobsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading sub sheet ledger…</p>
          ) : laborJobs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No jobs yet. Click New Sub Labor to add one.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', width: 32, borderBottom: '1px solid #e5e7eb' }} />
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contractor</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Distance</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Due</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Sub Sheet</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                    <th style={{ padding: '0.75rem', width: 80, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {laborJobs
                    .filter((job) => {
                      const q = subLaborSearch.trim().toLowerCase()
                      if (!q) return true
                      const contractor = (job.assigned_to_name ?? '').toLowerCase()
                      const hcp = (job.job_number ?? '').toLowerCase()
                      const addr = (job.address ?? '').toLowerCase()
                      const jobName = laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()]?.toLowerCase() ?? ''
                      return contractor.includes(q) || hcp.includes(q) || addr.includes(q) || jobName.includes(q)
                    })
                    .flatMap((job) => {
                    const jobRate = job.labor_rate ?? 0
                    const laborTotal = (job.items ?? []).reduce((s, i) => {
                      const hrs = Number(i.hrs_per_unit) || 0
                      const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
                      const rate = i.labor_rate != null ? Number(i.labor_rate) : jobRate
                      return s + laborHrs * rate
                    }, 0)
                    let totalCost = laborTotal
                    const jobPayments = job.payments ?? []
                    const paid = jobPayments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
                    const backcharges = jobPayments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
                    if (totalCost === 0 && (paid > 0 || backcharges > 0)) {
                      totalCost = paid + backcharges
                    }
                    const balance = totalCost - paid - backcharges
                    const dateInputValue = job.job_date ?? (job.created_at ? job.created_at.slice(0, 10) : '')
                    const expanded = expandedSubLaborJobIds.has(job.id)
                    const toggle = () => {
                      setExpandedSubLaborJobIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(job.id)) next.delete(job.id)
                        else next.add(job.id)
                        return next
                      })
                    }
                    return [
                      <tr
                        key={job.id}
                        style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: expanded ? '#f9fafb' : undefined }}
                        onClick={toggle}
                      >
                        <td style={{ padding: '0.75rem', width: 32 }}>{expanded ? '▼' : '▶'}</td>
                        <td style={{ padding: '0.75rem' }}>{job.assigned_to_name}</td>
                        <td style={{ padding: '0.75rem', maxWidth: 220 }}>
                          <div style={{ lineHeight: 1.4 }}>
                            <div style={{ fontWeight: 500 }}>
                              {job.job_number ?? '—'}
                              {laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()] ? (
                                <> | {laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()]}</>
                              ) : null}
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>
                              {job.address ? (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#2563eb', textDecoration: 'none' }}
                                  title={job.address}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {job.address}
                                </a>
                              ) : (
                                '—'
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
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
                              {(Number(job.distance_miles) || 0) === 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingLaborJobDistanceId(job.id)
                                    setEditingLaborJobDistanceValue(job.distance_miles != null ? String(job.distance_miles) : '')
                                  }}
                                  title="Edit distance"
                                  style={{ padding: '0.15rem 0.35rem', background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  Edit
                                </button>
                              ) : null}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalCost > 0 ? `$${formatCurrency(totalCost)}` : '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem' }}>
                          {totalCost > 0 ? (
                            balance > 0 ? (
                              <span style={{ color: '#b91c1c' }}>${formatCurrency(balance)} due</span>
                            ) : balance < 0 ? (
                              <span style={{ color: '#059669' }}>Over ${formatCurrency(-balance)}</span>
                            ) : (
                              <span style={{ color: '#059669' }}>Paid</span>
                            )
                          ) : '—'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => printJobSubSheet(job)} style={{ padding: '0.25rem 0.5rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                            Print
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="date"
                            value={dateInputValue}
                            onChange={(e) => updateLaborJobDate(job.id, e.target.value || null)}
                            style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', display: 'flex', gap: '0.35rem', flexWrap: 'nowrap', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => { setMakePaymentAmount(balance > 0 ? String(balance) : ''); setMakePaymentMemo(''); setMakePaymentLaborJob({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost, paid, outstanding: Math.max(0, balance) }) }}
                            style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                          >
                            Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => { setBackchargeAmount(''); setBackchargeMemo(''); setBackchargeLaborJob({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost, paid }) }}
                            style={{ padding: '0.25rem 0.5rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                          >
                            Backcharge
                          </button>
                          <button type="button" onClick={() => openEditLaborJob(job)} style={{ padding: '0.25rem 0.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                            Edit
                          </button>
                        </td>
                      </tr>,
                      ...(expanded
                        ? [
                            <tr key={`${job.id}-expand`}>
                              <td colSpan={9} style={{ padding: 0, borderBottom: '1px solid #e5e7eb', background: '#fff', verticalAlign: 'top' }}>
                                <div onClick={(e) => e.stopPropagation()} style={{ padding: '1rem' }}>
                                  <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                    Total cost: ${formatCurrency(totalCost)} · Paid: ${formatCurrency(paid)} · Backcharges: ${formatCurrency(backcharges)}
                                  </p>
                                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Specific Work (Line Items)</h4>
                                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                      <thead style={{ background: '#f9fafb' }}>
                                        <tr>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>hrs/unit</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Labor Hours</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rate</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Cost</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(job.items ?? []).map((i, idx) => {
                                          const hrs = Number(i.hrs_per_unit) || 0
                                          const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
                                          const rate = i.labor_rate != null ? Number(i.labor_rate) : jobRate
                                          const cost = laborHrs * rate
                                          return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                              <td style={{ padding: '0.5rem 0.75rem' }}>{i.fixture ?? '—'}</td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{Number(i.count)}</td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{hrs.toFixed(2)}</td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{laborHrs.toFixed(2)}</td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${rate.toFixed(2)}</td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(cost)}</td>
                                            </tr>
                                          )
                                        })}
                                        {(job.items ?? []).length === 0 && (
                                          <tr><td colSpan={6} style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.875rem' }}>No line items yet</td></tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Payments</h4>
                                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                      <thead style={{ background: '#f9fafb' }}>
                                        <tr>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Memo</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(job.payments ?? []).map((p) => (
                                          <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>{Number(p.amount) < 0 ? 'Backcharge' : 'Payment'}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>${formatCurrency(Number(p.amount))}</td>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>{p.memo?.trim() ? p.memo : '—'}</td>
                                          </tr>
                                        ))}
                                        {(job.payments ?? []).length === 0 && (
                                          <tr><td colSpan={4} style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.875rem' }}>No payments yet</td></tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>,
                          ]
                        : []),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'combined-labor' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <CrewJobsBlock
            showCrewJobsSection
            showTeamLabor
            jobIdsFilter={jobs.map((j) => j.id)}
            showTitle={false}
            collapsibleCrewJobs
          />
        </div>
      )}

      {activeTab === 'billing' && (
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
                        {job.hcp_number && authRole !== 'primary' && !teamLaborLoading && !teamLaborJobIds.has(job.id) && (
                          <span
                            title="No Team Job Labor for this job"
                            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="#b91c1c" aria-hidden="true">
                              <path d="M240 104C240 73.1 265.1 48 296 48C326.9 48 352 73.1 352 104C352 134.9 326.9 160 296 160C265.1 160 240 134.9 240 104zM42.5 245.3C48.4 233.4 62.8 228.6 74.7 234.6L99.3 246.9L111.5 226.5C130.4 195 164.7 176 201.1 176C247.3 176 288.8 206.5 301.6 251.4L333.8 364.1L426.7 410.5L452.5 367.5C458.3 357.9 468.7 352 479.9 352C491.1 352 501.6 357.9 507.3 367.5L603.3 527.5C609.2 537.4 609.4 549.7 603.7 559.7C598 569.7 587.5 576 576 576L384 576C372.5 576 361.8 569.8 356.2 559.8C350.6 549.8 350.7 537.5 356.6 527.6L402 451.8L53.3 277.5C41.4 271.6 36.6 257.2 42.6 245.3zM126.3 371.4L238.3 427.4C249.1 432.8 256 443.9 256 456L256 544C256 561.7 241.7 576 224 576C206.3 576 192 561.7 192 544L192 475.8L130.7 445.1L94.4 554.1C88.8 570.9 70.7 579.9 53.9 574.3C37.1 568.7 28.1 550.6 33.7 533.9L81.7 389.9C84.6 381.1 91.2 374 99.8 370.5C108.4 367 118.1 367.3 126.4 371.4z" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>{job.job_name || '—'}</div>
                        {(() => {
                          const fmt = formatAddressTwoLines(job.job_address)
                          if (!fmt) return null
                          return (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                              <div>{fmt.line1}</div>
                              {fmt.line2 && <div>{fmt.line2}</div>}
                            </div>
                          )
                        })()}
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
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Parts from Tally</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Billed Materials</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Invoices from Supply Houses</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Parts Cost</th>
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
                    const jobRowsFromTally = Array.from(byJob.entries()).map(([jobId, parts]) => {
                      const first = parts[0]
                      if (!first) return null
                      return { jobId, hcpNumber: first.hcp_number, jobName: first.job_name, parts }
                    }).filter((r): r is NonNullable<typeof r> => r != null)
                    const jobIdsFromTally = new Set(jobRowsFromTally.map((r) => r.jobId))
                    const materialsOnlyJobs = jobs.filter(
                      (j) =>
                        (j.materials?.length ?? 0) > 0 &&
                        !jobIdsFromTally.has(j.id) &&
                        (!showMyJobsOnly || !myJobIds || myJobIds.has(j.id)) &&
                        (!q ||
                          (j.hcp_number ?? '').toLowerCase().includes(q) ||
                          (j.job_name ?? '').toLowerCase().includes(q))
                    )
                    const invoicesOnlyJobs = jobs.filter(
                      (j) =>
                        (invoiceAmountByJob[j.id] ?? 0) > 0 &&
                        !jobIdsFromTally.has(j.id) &&
                        (j.materials?.length ?? 0) === 0 &&
                        (!showMyJobsOnly || !myJobIds || myJobIds.has(j.id)) &&
                        (!q ||
                          (j.hcp_number ?? '').toLowerCase().includes(q) ||
                          (j.job_name ?? '').toLowerCase().includes(q))
                    )
                    const materialsOnlyRows = materialsOnlyJobs.map((j) => ({
                      jobId: j.id,
                      hcpNumber: j.hcp_number ?? null,
                      jobName: j.job_name ?? null,
                      parts: [] as TallyPartRow[],
                    }))
                    const invoicesOnlyRows = invoicesOnlyJobs.map((j) => ({
                      jobId: j.id,
                      hcpNumber: j.hcp_number ?? null,
                      jobName: j.job_name ?? null,
                      parts: [] as TallyPartRow[],
                    }))
                    const jobRows = [...jobRowsFromTally, ...materialsOnlyRows, ...invoicesOnlyRows].sort((a, b) => {
                      const ha = (a.hcpNumber ?? '').trim()
                      const hb = (b.hcpNumber ?? '').trim()
                      return -ha.localeCompare(hb, undefined, { numeric: true })
                    })
                    if (jobRows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>
                            No tally parts yet. Subs can record parts via the Job Parts Tally flow on the Dashboard.
                          </td>
                        </tr>
                      )
                    }
                    return jobRows.flatMap(({ jobId, hcpNumber, jobName, parts }) => {
                      const expanded = expandedPartsJobIds.has(jobId)
                      const job = jobs.find((j) => j.id === jobId)
                      const billedMaterialsSum = (job?.materials ?? []).reduce((s, m) => s + Number(m.amount ?? 0), 0)
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
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(billedMaterialsSum)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(invoiceAmountByJob[jobId] ?? 0)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(partsTotal + billedMaterialsSum + (invoiceAmountByJob[jobId] ?? 0))}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>{parts.length}</td>
                        </tr>,
                        ...(expanded
                          ? [
                              <tr key={`${jobId}-parts`}>
                                <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid #e5e7eb', background: '#fff', verticalAlign: 'top' }}>
                                  {parts.length > 0 && (
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
                                  )}
                                  {job && job.materials.length > 0 && (
                                    <div style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                                      <div style={{ fontWeight: 500, fontSize: '0.8125rem', marginBottom: '0.5rem' }}>Billed Materials</div>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                        <thead>
                                          <tr style={{ background: '#f3f4f6' }}>
                                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left' }}>Description</th>
                                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Amount ($)</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {job.materials
                                            .filter((m) => (m.description ?? '').trim() || Number(m.amount) !== 0)
                                            .map((m) => (
                                              <tr key={m.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '0.35rem 0.5rem' }}>{m.description?.trim() || 'Item'}</td>
                                                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{formatCurrency(Number(m.amount ?? 0))}</td>
                                              </tr>
                                            ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
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
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="search"
              placeholder="Search HCP, job name, address…"
              value={jobSummarySearch}
              onChange={(e) => setJobSummarySearch(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
            />
          </div>
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
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Team Labor</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Sub Labor</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Parts Cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Bill</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Revenue before Overhead</th>
                  </tr>
                </thead>
                <tbody>
                  {jobSummaryData
                    .filter(({ job }) => {
                      const q = jobSummarySearch.trim().toLowerCase()
                      if (!q) return true
                      const hcp = (job.hcp_number ?? '').toLowerCase()
                      const name = (job.job_name ?? '').toLowerCase()
                      const addr = (job.job_address ?? '').toLowerCase()
                      return hcp.includes(q) || name.includes(q) || addr.includes(q)
                    })
                    .map(({ job, subLaborCost, teamLaborCost, partsCost, totalBill, profit }) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>{job.hcp_number ?? '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{job.job_name ?? '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{job.job_address ?? '—'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{teamLaborCost === 0 ? '—' : `$${formatCurrency(teamLaborCost)}`}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{subLaborCost === 0 ? '—' : `$${formatCurrency(subLaborCost)}`}</td>
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

      {activeTab === 'inspections' && (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setAddInspectionModalOpen(true)}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Add Inspection
            </button>
            <button
              type="button"
              onClick={openInspectionTypesModal}
              style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Edit Inspection Types
            </button>
          </div>
          <section style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Quick Links</h3>
              <button
                type="button"
                onClick={openQuickLinksModal}
                style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Edit Quick Inspection Links
              </button>
            </div>
            {quickLinksLoading ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                {quickLinksList.map(({ id, label, url }) => (
                  <a
                    key={id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => { e.preventDefault(); openInExternalBrowser(url) }}
                    style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 4, color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            )}
          </section>
          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Upcoming</h3>
            {inspectionsLoading ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
            ) : (
              (() => {
                const today = new Date()
                const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                const endKey = (() => {
                  const d = new Date(today)
                  d.setDate(d.getDate() + 14)
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                })()
                const upcoming = inspections.filter((i) => i.scheduled_date >= todayKey && i.scheduled_date <= endKey).slice(0, 14)
                return upcoming.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No upcoming inspections in the next 14 days.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {upcoming.map((i) => {
                      const parts = i.scheduled_date.split('-').map(Number)
                      const scheduled = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
                      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
                      const diffDays = Math.round((scheduled.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
                      const dayOfWeek = scheduled.toLocaleDateString('en-US', { weekday: 'long' })
                      const formatted = `${i.scheduled_date} (${diffDays}) ${dayOfWeek}`
                      return (
                        <li key={i.id} style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, fontSize: '0.875rem' }}>
                          <div>
                            <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>{formatted}</span>
                            <span style={{ color: '#4b5563' }}>{' - '}{i.inspection_type}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                            <span style={{ fontWeight: 500 }}>{i.address}</span>
                            {i.address?.trim() && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address.trim())}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInExternalBrowser(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address.trim())}`) }}
                                title={`View ${i.address} on map`}
                                style={{ display: 'inline-flex', alignItems: 'center', color: '#2563eb', flexShrink: 0 }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 16, height: 16, fill: 'currentColor' }}>
                                  <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )
              })()
            )}
          </section>
          <section>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>Inspection Schedule</h3>
            {inspectionsLoading ? (
              <p style={{ color: '#6b7280' }}>Loading…</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button type="button" onClick={() => setInspectionsMonth(new Date(inspectionsMonth.getFullYear(), inspectionsMonth.getMonth() - 1, 1))} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>←</button>
                    <span style={{ minWidth: 180, textAlign: 'center', fontWeight: 500 }}>{inspectionsMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    <button type="button" onClick={() => setInspectionsMonth(new Date(inspectionsMonth.getFullYear(), inspectionsMonth.getMonth() + 1, 1))} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>→</button>
                  </div>
                  <button type="button" onClick={() => setInspectionsMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>Today</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} style={{ background: 'white', padding: '0.5rem', textAlign: 'center', fontWeight: 500, fontSize: '0.875rem' }}>{d}</div>
                  ))}
                  {(() => {
                    const year = inspectionsMonth.getFullYear()
                    const month = inspectionsMonth.getMonth()
                    const firstDay = new Date(year, month, 1)
                    const lastDay = new Date(year, month + 1, 0)
                    const days: Date[] = []
                    const startDayOfWeek = firstDay.getDay()
                    for (let i = startDayOfWeek - 1; i >= 0; i--) days.push(new Date(year, month, -i))
                    for (let day = 1; day <= lastDay.getDate(); day++) days.push(new Date(year, month, day))
                    for (let day = 1; day <= 6 - lastDay.getDay(); day++) days.push(new Date(year, month + 1, day))
                    const today = new Date()
                    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                    return days.map((day, idx) => {
                      const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                      const dayInspections = inspections.filter((i) => i.scheduled_date === dateKey)
                      const isCurrentMonth = day.getMonth() === month
                      const isToday = dateKey === todayKey
                      return (
                        <div
                          key={idx}
                          role="button"
                          tabIndex={0}
                          onClick={() => setInspectionsSelectedDay(day)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInspectionsSelectedDay(day) } }}
                          style={{
                            background: 'white',
                            minHeight: 100,
                            padding: '0.5rem',
                            border: isToday ? '2px solid #2563eb' : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ fontSize: '0.875rem', color: isCurrentMonth ? '#111827' : '#9ca3af', fontWeight: isToday ? 600 : 400, marginBottom: '0.25rem' }}>{day.getDate()}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto', flex: 1, minHeight: 0 }}>
                            {dayInspections.slice(0, 3).map((i) => (
                              <div key={i.id} style={{ fontSize: '0.7rem', padding: '2px 4px', background: '#dbeafe', color: '#1e40af', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${i.address} - ${i.inspection_type}`}>
                                {i.address} - {i.inspection_type}
                              </div>
                            ))}
                            {dayInspections.length > 3 && <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>+{dayInspections.length - 3} more</div>}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </>
            )}
          </section>
          {inspectionsSelectedDay && (() => {
            const dateKey = `${inspectionsSelectedDay.getFullYear()}-${String(inspectionsSelectedDay.getMonth() + 1).padStart(2, '0')}-${String(inspectionsSelectedDay.getDate()).padStart(2, '0')}`
            const dayInspections = inspections.filter((i) => i.scheduled_date === dateKey)
            const dateStr = inspectionsSelectedDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
            return (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={() => setInspectionsSelectedDay(null)}>
                <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{dateStr}</h3>
                    <button type="button" onClick={() => setInspectionsSelectedDay(null)} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>Close</button>
                  </div>
                  {dayInspections.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No inspections on this day.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {dayInspections.map((i) => (
                        <li key={i.id} style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4 }}>
                          <div style={{ fontWeight: 500 }}>{i.address}</div>
                          <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>{i.inspection_type}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })()}
          {inspectionTypesModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                {inspectionTypeFormOpen ? (
                  <>
                    <h3 style={{ margin: '0 0 1rem 0' }}>{editingInspectionTypeName ? 'Edit inspection type' : 'Add inspection type'}</h3>
                    <form onSubmit={saveInspectionType}>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name *</label>
                        <input type="text" value={newInspectionTypeName} onChange={(e) => setNewInspectionTypeName(e.target.value)} required placeholder="e.g. Plumbing Rough-In" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" onClick={closeInspectionTypeForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                          {editingInspectionTypeName && (
                            <button type="button" onClick={() => deleteInspectionType(editingInspectionTypeName)} disabled={!!inspectionTypeDeletingName} style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: inspectionTypeDeletingName ? 'not-allowed' : 'pointer' }}>{inspectionTypeDeletingName === editingInspectionTypeName ? '…' : 'Delete'}</button>
                          )}
                        </div>
                        <button type="submit" disabled={inspectionTypeSaving || !newInspectionTypeName.trim()} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: inspectionTypeSaving ? 'not-allowed' : 'pointer' }}>{inspectionTypeSaving ? 'Saving…' : 'Save'}</button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}>Inspection Types</h3>
                      <button type="button" onClick={() => setInspectionTypesModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }} aria-label="Close">×</button>
                    </div>
                    <button type="button" onClick={openAddInspectionType} style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add type</button>
                    {inspectionTypesLoading ? (
                      <p style={{ color: '#6b7280' }}>Loading…</p>
                    ) : inspectionTypesList.length === 0 ? (
                      <p style={{ color: '#6b7280' }}>No inspection types yet.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {inspectionTypesList.map((t) => (
                          <li key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                            <span>{t.name}</span>
                            <button type="button" onClick={() => openEditInspectionType(t)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          {quickLinksModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                {quickLinkFormOpen ? (
                  <>
                    <h3 style={{ margin: '0 0 1rem 0' }}>{editingQuickLinkId ? 'Edit quick link' : 'Add quick link'}</h3>
                    <form onSubmit={saveQuickLink}>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Label *</label>
                        <input type="text" value={newQuickLinkLabel} onChange={(e) => setNewQuickLinkLabel(e.target.value)} required placeholder="e.g. City of New Braunfels" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                      </div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>URL *</label>
                        <input type="url" value={newQuickLinkUrl} onChange={(e) => setNewQuickLinkUrl(e.target.value)} required placeholder="https://..." style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" onClick={closeQuickLinkForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                          {editingQuickLinkId && (
                            <button type="button" onClick={() => deleteQuickLink(editingQuickLinkId)} disabled={!!quickLinkDeletingId} style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: quickLinkDeletingId ? 'not-allowed' : 'pointer' }}>{quickLinkDeletingId === editingQuickLinkId ? '…' : 'Delete'}</button>
                          )}
                        </div>
                        <button type="submit" disabled={quickLinkSaving || !newQuickLinkLabel.trim() || !newQuickLinkUrl.trim()} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: quickLinkSaving ? 'not-allowed' : 'pointer' }}>{quickLinkSaving ? 'Saving…' : 'Save'}</button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}>Quick Inspection Links</h3>
                      <button type="button" onClick={() => setQuickLinksModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }} aria-label="Close">×</button>
                    </div>
                    <button type="button" onClick={openAddQuickLink} style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add link</button>
                    {quickLinksLoading ? (
                      <p style={{ color: '#6b7280' }}>Loading…</p>
                    ) : quickLinksList.length === 0 ? (
                      <p style={{ color: '#6b7280' }}>No quick links yet.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {quickLinksList.map((link) => (
                          <li key={link.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                            <span>{link.label}</span>
                            <button type="button" onClick={() => openEditQuickLink(link)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <AddInspectionModal
        open={addInspectionModalOpen}
        onClose={() => setAddInspectionModalOpen(false)}
        onSaved={() => { setAddInspectionModalOpen(false); loadInspections(); }}
        authUserId={authUser?.id ?? null}
      />

      {(laborModalOpen || editingLaborJob) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>{editingLaborJob ? 'Edit Sub Labor' : 'New Sub Labor'}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (editingLaborJob) saveEditedLaborJob(e)
                else saveLaborJob()
              }}
            >
              {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', whiteSpace: 'pre-line' }}>{error}</p>}
              <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: 0, marginBottom: '0.5rem' }}>Required: Address, Distance (mi), at least one contractor (External Subs, Internal Subs, or Office Team), and at least one fixture with a name and count &gt; 0 (or hrs/unit for fixed items).</p>
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
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Address <span style={{ color: '#b91c1c' }}>*</span></label>
                  <input
                    type="text"
                    value={laborAddress}
                    onChange={(e) => setLaborAddress(e.target.value)}
                    placeholder="Job address"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
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
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date of Labor</label>
                  <input
                    type="date"
                    value={laborDate}
                    onChange={(e) => setLaborDate(e.target.value)}
                    style={{ width: '11ch', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                  />
                </div>
                {serviceTypes.length > 1 && (
                  <div style={{ flex: '0 0 auto' }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Service type</label>
                    <select
                      value={selectedServiceTypeId}
                      onChange={(e) => setSelectedServiceTypeId(e.target.value)}
                      style={{ width: 'max-content', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, height: 38, boxSizing: 'border-box' }}
                    >
                      {serviceTypes.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Subcontractors <span style={{ color: '#b91c1c' }}>*</span></div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem', marginTop: '0.5rem' }}>External Subs</div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddSubcontractorModal(true)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                      >
                        Add Subcontractor
                      </button>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 100, overflowY: 'auto', flex: 1, minWidth: 0 }}>
                        {rosterSubcontractorsWithoutAccount().map((n) => (
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
                        {rosterSubcontractorsWithoutAccount().length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>None</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem', marginTop: '0.5rem' }}>Internal Subs</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, maxHeight: 100, overflowY: 'auto' }}>
                      {rosterSubcontractorsWithAccount().map((n) => (
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
                      {rosterSubcontractorsWithAccount().length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>None</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Office Team</div>
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
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Rate ($/hr)</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Cost</th>
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
                                onWheel={(e) => e.currentTarget.blur()}
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
                                onWheel={(e) => e.currentTarget.blur()}
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
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={row.labor_rate != null && row.labor_rate !== 0 ? row.labor_rate : ''}
                                onChange={(e) => updateLaborFixtureRow(row.id, { labor_rate: parseFloat(e.target.value) || 0 })}
                                onWheel={(e) => e.currentTarget.blur()}
                                placeholder="0"
                                style={{ width: '5rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500 }}>
                              ${formatCurrency(laborHrs * (row.labor_rate ?? 0))}
                            </td>
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
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }} />
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                          ${formatCurrency(
                            laborFixtureRows.reduce((s, r) => {
                              const hrs = Number(r.hrs_per_unit) || 0
                              const laborHrs = (r.is_fixed ?? false) ? hrs : (Number(r.count) || 0) * hrs
                              return s + laborHrs * (r.labor_rate ?? 0)
                            }, 0)
                          )}
                        </td>
                        <td style={{ padding: '0.5rem' }} />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={addLaborFixtureRow}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: '#fff',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Add additional fixture or tie-in
                  </button>
                </div>
                {laborFixtureRows.some((r) => (r.fixture ?? '').trim()) && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    Total labor cost: ${formatCurrency(
                      laborFixtureRows.reduce((s, r) => {
                        const hrs = Number(r.hrs_per_unit) || 0
                        const laborHrs = (r.is_fixed ?? false) ? hrs : (Number(r.count) || 0) * hrs
                        const rate = r.labor_rate ?? 0
                        return s + laborHrs * rate
                      }, 0)
                    )}
                  </p>
                )}
              </div>
              {editingLaborJob && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Payments</h4>
                  {(() => {
                    const laborTotal = laborFixtureRows.reduce((s, r) => {
                      const hrs = Number(r.hrs_per_unit) || 0
                      const laborHrs = (r.is_fixed ?? false) ? hrs : (Number(r.count) || 0) * hrs
                      return s + laborHrs * (r.labor_rate ?? 0)
                    }, 0)
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
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: '0.5rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: '#f9fafb' }}>
                              <tr>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Memo</th>
                                <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {(editingLaborJob.payments ?? []).map((p) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>{Number(p.amount) < 0 ? 'Backcharge' : 'Payment'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>${formatCurrency(Number(p.amount))}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{p.memo || '—'}</td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <button type="button" onClick={() => { setEditPaymentAmount(String(Math.abs(Number(p.amount)))); setEditPaymentMemo(p.memo ?? ''); setEditingPayment({ id: p.id, jobId: editingLaborJob.id, amount: Number(p.amount), memo: p.memo, isBackcharge: Number(p.amount) < 0 }) }} style={{ padding: '0.25rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>Edit</button>
                                  </td>
                                </tr>
                              ))}
                              {(editingLaborJob.payments ?? []).length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.875rem' }}>No payments yet</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => { setMakePaymentAmount(balance > 0 ? String(balance) : ''); setMakePaymentMemo(''); setMakePaymentLaborJob({ id: editingLaborJob.id, contractor: editingLaborJob.assigned_to_name, hcp: editingLaborJob.job_number ?? '—', totalCost, paid, outstanding: Math.max(0, balance) }) }} style={{ padding: '0.35rem 0.75rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>Payment</button>
                          <button type="button" onClick={() => { setBackchargeAmount(''); setBackchargeMemo(''); setBackchargeLaborJob({ id: editingLaborJob.id, contractor: editingLaborJob.assigned_to_name, hcp: editingLaborJob.job_number ?? '—', totalCost, paid }) }} style={{ padding: '0.35rem 0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>Backcharge</button>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
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
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem', alignItems: 'center' }}>
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
                  <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem', display: 'inline-block' }}>
                  <span style={{ display: 'block' }}>Required:</span>
                  {laborMissingFields.map((f) => (
                    <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                  ))}
                </span>
                )}
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
                  type="button"
                  onClick={closeLaborModal}
                  disabled={laborSaving}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: laborSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                {editingLaborJob && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await deleteLaborJob(editingLaborJob.id)
                      if (ok) closeLaborModal()
                    }}
                    disabled={laborJobDeletingId === editingLaborJob.id}
                    style={{
                      marginLeft: 'auto',
                      padding: '0.5rem 1.25rem',
                      background: laborJobDeletingId === editingLaborJob.id ? '#fecaca' : '#fee2e2',
                      color: '#991b1b',
                      border: '1px solid #fca5a5',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: laborJobDeletingId === editingLaborJob.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {laborJobDeletingId === editingLaborJob.id ? '…' : 'Delete'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddSubcontractorModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Add Subcontractor</h3>
            {addSubcontractorError && (
              <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{addSubcontractorError}</p>
            )}
            <form onSubmit={handleSaveAddSubcontractor}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-sub-name" style={{ display: 'block', marginBottom: 4 }}>Name <span style={{ color: '#b91c1c' }}>*</span></label>
                <input
                  id="new-sub-name"
                  type="text"
                  value={newSubcontractor.name}
                  onChange={(e) => setNewSubcontractor((p) => ({ ...p, name: e.target.value }))}
                  required
                  disabled={savingAddSubcontractor}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{editing ? 'Edit Job' : 'New Job'}</h2>
              {projectId ? (
                (() => {
                  const proj = projects.find((p) => p.id === projectId)
                  return (
                    <Link
                      to={`/workflows/${projectId}`}
                      style={{
                        fontSize: '0.875rem',
                        padding: '0.25rem 0.5rem',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        borderRadius: 4,
                        textDecoration: 'none',
                        fontWeight: 500,
                        display: 'inline-block',
                      }}
                    >
                      Project: {proj?.name ?? 'Project'}
                    </Link>
                  )
                })()
              ) : (
                (() => {
                  const projectPrefillParams = new URLSearchParams()
                  if (customerId) projectPrefillParams.set('customer', customerId)
                  if (jobName.trim()) projectPrefillParams.set('name', jobName.trim())
                  projectPrefillParams.set('address', jobAddress.trim())
                  if (jobPlansLink.trim()) projectPrefillParams.set('plans', jobPlansLink.trim())
                  if (hcpNumber.trim()) projectPrefillParams.set('hcp', hcpNumber.trim())
                  if (editing?.id) projectPrefillParams.set('job', editing.id)
                  const projectNewUrl = projectPrefillParams.toString() ? `/projects/new?${projectPrefillParams.toString()}` : '/projects/new'
                  return (
                    <Link
                      to={projectNewUrl}
                      style={{
                        fontSize: '0.875rem',
                        color: '#2563eb',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      + Add Project
                    </Link>
                  )
                })()
              )}
            </div>
            {error && <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 110px', minWidth: 110 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>HCP</label>
                  <input
                    type="text"
                    value={hcpNumber}
                    onChange={(e) => setHcpNumber(e.target.value)}
                    placeholder="HCP number"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
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
                      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Paste from clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '0 0 auto', minWidth: 140 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Est. Done and Bill Date</label>
                  <input
                    type="date"
                    value={estimatedCompletionDate}
                    onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                    style={{ width: '100%', minWidth: 140, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
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
                      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Paste from clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: customerExpanded ? '0.5rem' : 0 }}>
                  <button
                    type="button"
                    aria-expanded={customerExpanded}
                    onClick={() => setCustomerExpanded((p) => !p)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: 'inherit',
                      color: 'inherit',
                      flex: 1,
                      textAlign: 'left',
                    }}
                  >
                    <span aria-hidden>{customerExpanded ? '\u25BC' : '\u25B6'}</span>
                    Customer: {customerName.trim() || customerEmail.trim() || customerPhone.trim() ? (customerName.trim() || '—') : '—'}
                    {(() => {
                      const projRow = projectId ? projects.find((p) => p.id === projectId) : undefined
                      const masterForFormCustomer =
                        projRow?.master_user_id ?? editing?.master_user_id ?? authUser?.id ?? ''
                      const showFormNotInCustomers =
                        !!(customerName.trim() || customerEmail.trim() || customerPhone.trim()) &&
                        !customerId &&
                        !customerListImpliesLinkedRow(customers, masterForFormCustomer, customerName)
                      return showFormNotInCustomers ? (
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            padding: '0.15rem 0.4rem',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: '#fef3c7',
                            color: '#92400e',
                            borderRadius: 4,
                          }}
                        >
                          Not in Customers
                        </span>
                      ) : null
                    })()}
                  </button>
                  {customerExpanded && (
                    <button
                      type="button"
                      onClick={handleCustomerImport}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        background: '#f9fafb',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Import
                    </button>
                  )}
                </div>
                {customerExpanded && (
                  <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid #e5e7eb' }}>
                    <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Link to customer</label>
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => {
                          const value = e.target.value
                          setCustomerSearch(value)
                          setCustomerDropdownOpen(true)
                          if (customerId) {
                            const selected = customers.find((c) => c.id === customerId)
                            if (!selected || !value || getCustomerDisplay(selected).toLowerCase() !== value.toLowerCase()) {
                              setCustomerId(null)
                            }
                          }
                        }}
                        onFocus={() => setCustomerDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
                        placeholder="Search customers (residential & commercial)…"
                        aria-label="Search customers to link, residential and commercial"
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                      {customerDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: 4,
                            maxHeight: 180,
                            overflowY: 'auto',
                            zIndex: 100,
                            marginTop: 2,
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          {customersLoading ? (
                            <div style={{ padding: '0.5rem', color: '#6b7280' }}>Loading…</div>
                          ) : (
                            (() => {
                              const q = customerSearch.toLowerCase()
                              const filtered = customers.filter((c) =>
                                (c.name || '').toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q)
                              )
                              return (
                                <>
                                  {filtered.map((c) => (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    setCustomerId(c.id)
                                    setCustomerSearch(getCustomerDisplay(c))
                                    setCustomerName(c.name)
                                    setCustomerEmail(extractContactFromCustomer(c).email)
                                    setCustomerPhone(extractContactFromCustomer(c).phone)
                                    setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
                                    if (!jobAddress.trim()) setJobAddress(c.address ?? '')
                                    setCustomerDropdownOpen(false)
                                  }}
                                  style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                                    <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 500 }}>
                                      {customerTypeShortLabel(c)}
                                    </span>
                                  </div>
                                  {c.address && <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>{c.address}</div>}
                                </div>
                                  ))}
                                  {filtered.length === 0 && (
                                    <div style={{ padding: '0.5rem', color: '#6b7280', fontStyle: 'italic' }}>No customers found</div>
                                  )}
                                </>
                              )
                            })()
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {!customerId && (
                          <button
                            type="button"
                            disabled={!customerName.trim()}
                            onClick={() => setCreateCustomerFromJobModalOpen(true)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.875rem',
                              border: '1px solid #d1d5db',
                              background: !customerName.trim() ? '#f3f4f6' : '#f9fafb',
                              borderRadius: 4,
                              cursor: !customerName.trim() ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Create customer from job
                          </button>
                        )}
                        {customerId && (
                          <button
                            type="button"
                            onClick={() => { setCustomerId(null); setCustomerSearch(''); setDateMet('') }}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer', color: '#6b7280' }}
                          >
                            Clear link
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Name</label>
                      <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Phone</label>
                      <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Email</label>
                      <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: 0 }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                        Date Met
                        {customerId && customers.find((c) => c.id === customerId)?.date_met && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400, marginLeft: 4 }}>(edit in Customers)</span>
                        )}
                      </label>
                      <input
                        type="date"
                        value={dateMet}
                        onChange={(e) => setDateMet(e.target.value)}
                        disabled={!!(customerId && customers.find((c) => c.id === customerId)?.date_met)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: customerId && customers.find((c) => c.id === customerId)?.date_met ? '#f9fafb' : 'white',
                          color: customerId && customers.find((c) => c.id === customerId)?.date_met ? '#6b7280' : 'inherit',
                          cursor: customerId && customers.find((c) => c.id === customerId)?.date_met ? 'not-allowed' : 'text',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Project</label>
                <select
                  value={projectId ?? ''}
                  onChange={(e) => {
                    const pid = e.target.value || null
                    setProjectId(pid)
                    if (pid) {
                      const proj = projects.find((p) => p.id === pid)
                      if (proj && !customerId) {
                        setCustomerId(proj.customer_id)
                      }
                    }
                  }}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.customers?.name ? ` (${p.customers.name})` : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, display: 'block' }}>
                  Link job to a multi-phase project for billing after each phase
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Files</label>
                  <input
                    type="url"
                    value={googleDriveLink}
                    onChange={(e) => setGoogleDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                  />
                  <a
                    href="https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link') }}
                    style={{ fontSize: '0.8125rem', color: '#2563eb', marginTop: 4, display: 'inline-block' }}
                  >
                    job folders
                  </a>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Plans</label>
                  <input
                    type="url"
                    value={jobPlansLink}
                    onChange={(e) => setJobPlansLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid #9ca3af', width: '50%' }} />
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151', marginBottom: '0.75rem' }}>Contractors</div>
                <div ref={contractorsDropdownRef} style={{ position: 'relative' }}>
                  {teamMemberIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                      {teamMemberIds.map((id) => {
                        const u = users.find((x) => x.id === id)
                        return (
                          <span
                            key={id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              background: '#eff6ff',
                              borderRadius: 6,
                              fontSize: '0.875rem',
                            }}
                          >
                            {u?.name ?? id}
                            <button
                              type="button"
                              onClick={() => setTeamMemberIds((prev) => prev.filter((x) => x !== id))}
                              title="Remove"
                              style={{
                                padding: 0,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: '#6b7280',
                                fontSize: '0.875rem',
                              }}
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <input
                    type="text"
                    value={contractorsSearch}
                    onChange={(e) => setContractorsSearch(e.target.value)}
                    onFocus={() => setContractorsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setContractorsDropdownOpen(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setContractorsDropdownOpen(false)
                      if (e.key === 'Enter') {
                        const filtered = users.filter((u) => !teamMemberIds.includes(u.id) && u.name.toLowerCase().includes(contractorsSearch.toLowerCase().trim()))
                        const first = filtered[0]
                        if (first) {
                          e.preventDefault()
                          setTeamMemberIds((prev) => [...prev, first.id])
                          setContractorsSearch('')
                        }
                      }
                    }}
                    placeholder="Search contractors…"
                    style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                  />
                  {contractorsDropdownOpen && (() => {
                    const filtered = users.filter((u) => !teamMemberIds.includes(u.id) && u.name.toLowerCase().includes(contractorsSearch.toLowerCase().trim()))
                    if (filtered.length === 0 && !contractorsSearch.trim()) return null
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: 4,
                          marginTop: 2,
                          maxHeight: 200,
                          overflowY: 'auto',
                          zIndex: 9999,
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        }}
                      >
                        {filtered.length > 0 ? (
                          filtered.map((u, idx) => (
                            <button
                              key={u.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setTeamMemberIds((prev) => [...prev, u.id])
                                setContractorsSearch('')
                              }}
                              style={{
                                width: '100%',
                                padding: '0.5rem 0.75rem',
                                textAlign: 'left',
                                background: 'white',
                                border: 'none',
                                borderBottom: idx < filtered.length - 1 ? '1px solid #e5e7eb' : 'none',
                                cursor: 'pointer',
                                color: '#111827',
                                fontSize: '0.875rem',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                            >
                              {u.name}
                            </button>
                          ))
                        ) : (
                          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                            No matching contractors
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
              <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid #9ca3af', width: '50%' }} />
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '1rem', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151', marginBottom: '0.75rem' }}>Billed Materials</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Line Item</th>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Amount ($)</th>
                      <th style={{ padding: '0.625rem 0.5rem', width: 48, borderBottom: '1px solid #e5e7eb' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: idx < materials.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '0.625rem 0.75rem' }}>
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateMaterialRow(row.id, { description: e.target.value })}
                            placeholder="Item description"
                            style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.amount || ''}
                            onChange={(e) => updateMaterialRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            style={{ width: '6rem', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '0.625rem 0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => removeMaterialRow(row.id)}
                            disabled={materials.length <= 1}
                            title="Remove"
                            style={{
                              padding: '0.35rem',
                              background: materials.length <= 1 ? '#f3f4f6' : 'transparent',
                              color: materials.length <= 1 ? '#9ca3af' : '#991b1c',
                              border: 'none',
                              borderRadius: 4,
                              cursor: materials.length <= 1 ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={addMaterialRow} style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  Add Billed Material
                </button>
              </div>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '1rem', overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151', marginBottom: '0.75rem' }}>Specific Work (Fixtures / Tie-ins)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Line Item</th>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 600, width: 80 }}>Count</th>
                      <th style={{ padding: '0.625rem 0.5rem', width: 48, borderBottom: '1px solid #e5e7eb' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {fixtures.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: idx < fixtures.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '0.625rem 0.75rem' }}>
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateFixtureRow(row.id, { name: e.target.value })}
                            placeholder="Fixture or tie-in name"
                            style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            min={1}
                            value={row.count}
                            onChange={(e) => updateFixtureRow(row.id, { count: Math.max(1, Number(e.target.value) || 1) })}
                            style={{ width: '4rem', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', textAlign: 'center' }}
                          />
                        </td>
                        <td style={{ padding: '0.625rem 0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => removeFixtureRow(row.id)}
                            disabled={fixtures.length <= 1}
                            title="Remove"
                            style={{
                              padding: '0.35rem',
                              background: fixtures.length <= 1 ? '#f3f4f6' : 'transparent',
                              color: fixtures.length <= 1 ? '#9ca3af' : '#991b1c',
                              border: 'none',
                              borderRadius: 4,
                              cursor: fixtures.length <= 1 ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={addFixtureRow} style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  Add Fixture /Tie-in
                </button>
              </div>
              <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid #9ca3af', width: '50%' }} />
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151', marginBottom: '0.75rem' }}>Billing</div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Total / Bid ($)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={
                        revenueInputFocused
                          ? revenue
                          : revenue.trim() === ''
                            ? ''
                            : formatCurrency(parseMoneyInputToNumber(revenue))
                      }
                      onFocus={() => setRevenueInputFocused(true)}
                      onBlur={() => {
                        setRevenueInputFocused(false)
                        const n = parseMoneyInputToNumberOrNull(revenue)
                        setRevenue(n == null ? '' : String(n))
                      }}
                      onChange={(e) => setRevenue(sanitizeMoneyTyping(e.target.value))}
                      placeholder="Optional"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Remaining ($)</label>
                    <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151', background: '#f9fafb', borderRadius: 6 }}>
                      ${formatCurrency(Math.max(0, parseMoneyInputToNumber(revenue) - payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)))}
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Payments received ($)</label>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Note</th>
                        <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Amount ($)</th>
                        <th style={{ padding: '0.625rem 0.5rem', width: 48, borderBottom: '1px solid #e5e7eb' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: idx < payments.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                          <td style={{ padding: '0.625rem 0.75rem', verticalAlign: 'middle' }}>
                            <input
                              id={`edit-job-payment-date-${row.id}`}
                              type="date"
                              value={row.paid_on ?? ''}
                              onChange={(e) => updatePaymentRow(row.id, { paid_on: e.target.value ? e.target.value : null })}
                              aria-label="Payment date"
                              style={{ width: '100%', maxWidth: '11rem', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem', verticalAlign: 'middle', minWidth: 120 }}>
                            <input
                              id={`edit-job-payment-note-${row.id}`}
                              type="text"
                              value={row.note ?? ''}
                              onChange={(e) => updatePaymentRow(row.id, { note: e.target.value === '' ? null : e.target.value })}
                              placeholder="Optional"
                              aria-label="Payment note"
                              style={{ width: '100%', minWidth: '8rem', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', verticalAlign: 'middle' }}>
                            <MoneyDecimalAmountInput
                              value={row.amount}
                              onChange={(amount) => updatePaymentRow(row.id, { amount })}
                              placeholder="0"
                              aria-label="Payment amount"
                              style={{ width: '6rem', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '0.625rem 0.5rem', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              onClick={() => removePaymentRow(row.id)}
                              disabled={payments.length <= 1}
                              title="Remove"
                              style={{
                                padding: '0.35rem',
                                background: payments.length <= 1 ? '#f3f4f6' : 'transparent',
                                color: payments.length <= 1 ? '#9ca3af' : '#991b1c',
                                border: 'none',
                                borderRadius: 4,
                                cursor: payments.length <= 1 ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      marginTop: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #f3f4f6',
                    }}
                  >
                    <div>
                      <button type="button" onClick={addPaymentRow} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                        Add Payment
                      </button>
                    </div>
                    {editing && (
                      <div
                        style={{
                          padding: '0.75rem',
                          borderRadius: 8,
                          border: '1px solid #e5e7eb',
                          background: '#f9fafb',
                        }}
                      >
                        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Partial invoice</h4>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                          Break off an amount to send through Ready to Bill. The job stays in Working.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <label htmlFor="edit-job-partial-invoice-amount" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                            Amount ($)
                          </label>
                          <input
                            id="edit-job-partial-invoice-amount"
                            type="number"
                            min={0}
                            step={0.01}
                            value={newInvoiceAmount}
                            onChange={(e) => setNewInvoiceAmount(e.target.value)}
                            placeholder="0"
                            title="Break off an amount to send through Ready to Bill. Job stays in Working."
                            style={{ width: '6rem', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', background: 'white' }}
                          />
                          <button
                            type="button"
                            onClick={createInvoice}
                            disabled={creatingInvoice || !(parseFloat(newInvoiceAmount) > 0)}
                            style={{
                              padding: '0.5rem 1rem',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              background: creatingInvoice || !(parseFloat(newInvoiceAmount) > 0) ? '#9ca3af' : '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              cursor: creatingInvoice || !(parseFloat(newInvoiceAmount) > 0) ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {creatingInvoice ? '…' : 'Create invoice'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              {editing && (
                <>
                  {((editing.invoices ?? []).filter((i) => i.status === 'ready_to_bill' || i.status === 'billed').length > 0) && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Open invoices</h4>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                        {(editing.invoices ?? [])
                          .filter((i) => i.status === 'ready_to_bill' || i.status === 'billed')
                          .map((inv) => (
                            <li key={inv.id} style={{ marginBottom: '0.25rem' }}>
                              ${formatCurrency(Number(inv.amount))} — {inv.status === 'ready_to_bill' ? 'Ready to Bill' : 'Billed'}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('stages')
                                  setSearchParams((p) => {
                                    const next = new URLSearchParams(p)
                                    next.set('tab', 'stages')
                                    return next
                                  })
                                  closeForm()
                                }}
                                style={{ marginLeft: 8, padding: '0.15rem 0.35rem', fontSize: '0.75rem', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              >
                                View in Stages
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: '1.25rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
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
                    }}
                  >
                    {deletingId === editing?.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={saveJob}
                  disabled={!jobFormCanSubmit || saving}
                  title={!jobFormCanSubmit ? `Required: ${jobFormMissingFields.join(', ')}` : undefined}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: jobFormCanSubmit && !saving ? 'pointer' : 'not-allowed',
                    fontWeight: 500,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {!jobFormCanSubmit && !saving && jobFormMissingFields.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#FF6600', display: 'inline-block' }}>
                    <span style={{ display: 'block' }}>Required:</span>
                    {jobFormMissingFields.map((f) => (
                      <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>
                        {f}
                      </span>
                    ))}
                  </span>
                )}
                <button type="button" onClick={closeForm} style={{ padding: '0.5rem 1rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
          {createCustomerFromJobModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={() => setCreateCustomerFromJobModalOpen(false)}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Create customer from job</h2>
                <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {customerName.trim() || '—'} · {jobAddress.trim() || '—'}
                  {(customerEmail.trim() || customerPhone.trim()) && (
                    <span> · {customerEmail.trim() || customerPhone.trim()}</span>
                  )}
                </p>
                <label style={{ display: 'block', marginBottom: '1rem' }}>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Customer type</span>
                  <div style={{ display: 'flex', gap: 0 }}>
                    <button
                      type="button"
                      onClick={() => setCreateCustomerFromJobType('residential')}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px 0 0 4px',
                        background: createCustomerFromJobType === 'residential' ? '#3b82f6' : 'white',
                        color: createCustomerFromJobType === 'residential' ? 'white' : '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      Residential
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateCustomerFromJobType('commercial')}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0 4px 4px 0',
                        background: createCustomerFromJobType === 'commercial' ? '#3b82f6' : 'white',
                        color: createCustomerFromJobType === 'commercial' ? 'white' : '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      Commercial
                    </button>
                  </div>
                </label>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Possible matches – link instead?</span>
                  {createCustomerFromJobModalLoading ? (
                    <div style={{ padding: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>Loading…</div>
                  ) : similarCustomersForCreate.length > 0 ? (
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, maxHeight: 160, overflowY: 'auto' }}>
                      {similarCustomersForCreate.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleLinkToSimilarCustomer(c)}
                          style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                        >
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          {c.address && <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>{c.address}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '0.5rem', color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>No similar customers found</div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setCreateCustomerFromJobModalOpen(false)}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!customerName.trim() || creatingCustomerFromJob}
                    onClick={() => handleCreateCustomerFromJob(createCustomerFromJobType)}
                    style={{ padding: '0.5rem 1rem', background: !customerName.trim() || creatingCustomerFromJob ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: !customerName.trim() || creatingCustomerFromJob ? 'not-allowed' : 'pointer' }}
                  >
                    {creatingCustomerFromJob ? 'Creating…' : 'Create new customer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <NewReportModal
        open={newReportModalOpen}
        onClose={() => setNewReportModalOpen(false)}
        onSaved={() => { setNewReportModalOpen(false); loadReports(); }}
        authUserId={authUser?.id ?? null}
        userRole={authRole}
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
          userRole={authRole}
        />
      )}
      {readyForBillingJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Ready to Bill</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {readyForBillingJob.hcpNumber} · {readyForBillingJob.jobName}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <input type="checkbox" checked={readyForBillingChecked1} onChange={(e) => setReadyForBillingChecked1(e.target.checked)} style={{ marginTop: 4 }} />
                <span>I have reported all the Job Parts I&apos;ve used</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={readyForBillingChecked2} onChange={(e) => setReadyForBillingChecked2(e.target.checked)} style={{ marginTop: 4 }} />
                <span>The customer knows the work is done and is satisfied</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setReadyForBillingJob(null); setReadyForBillingChecked1(false); setReadyForBillingChecked2(false) }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={!readyForBillingChecked1 || !readyForBillingChecked2 || stagesStatusUpdatingId === readyForBillingJob.id} onClick={async () => { if (!readyForBillingJob) return; await updateJobStatus(readyForBillingJob.id, 'ready_to_bill'); setReadyForBillingJob(null); setReadyForBillingChecked1(false); setReadyForBillingChecked2(false); loadJobs() }} style={{ padding: '0.5rem 1rem', background: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? 'pointer' : 'not-allowed' }}>{stagesStatusUpdatingId === readyForBillingJob.id ? '…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {createPartialInvoiceJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Create partial invoice</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{createPartialInvoiceJob.hcp_number ?? '—'} · {createPartialInvoiceJob.job_name ?? '—'}</p>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>Remaining: ${formatCurrency(Math.max(0, (Number(createPartialInvoiceJob.revenue ?? 0) - Number(createPartialInvoiceJob.payments_made ?? 0))))}</div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Amount ($)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={createPartialInvoiceAmount}
                  onChange={(e) => setCreatePartialInvoiceAmount(e.target.value)}
                  placeholder="0"
                  style={{ width: '100%', marginTop: 4, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </label>
              {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{error}</p>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setCreatePartialInvoiceJob(null); setCreatePartialInvoiceAmount(''); setError(null) }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={creatingPartialInvoiceFromModal || !(parseFloat(createPartialInvoiceAmount) > 0)} onClick={createInvoiceFromModal} style={{ padding: '0.5rem 1rem', background: creatingPartialInvoiceFromModal || !(parseFloat(createPartialInvoiceAmount) > 0) ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: creatingPartialInvoiceFromModal || !(parseFloat(createPartialInvoiceAmount) > 0) ? 'not-allowed' : 'pointer' }}>{creatingPartialInvoiceFromModal ? '…' : 'Create invoice'}</button>
            </div>
          </div>
        </div>
      )}
      {markAsBilledJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Mark as Billed</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{markAsBilledJob.hcpNumber} · {markAsBilledJob.jobName}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={markAsBilledChecked} onChange={(e) => setMarkAsBilledChecked(e.target.checked)} style={{ marginTop: 4 }} />
                <span>Invoice has been sent to the customer</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setMarkAsBilledJob(null); setMarkAsBilledChecked(false) }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={!markAsBilledChecked || stagesStatusUpdatingId === markAsBilledJob.id} onClick={async () => { if (!markAsBilledJob) return; await updateJobStatus(markAsBilledJob.id, 'billed'); setMarkAsBilledJob(null); setMarkAsBilledChecked(false); loadJobs() }} style={{ padding: '0.5rem 1rem', background: markAsBilledChecked && stagesStatusUpdatingId !== markAsBilledJob.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: markAsBilledChecked && stagesStatusUpdatingId !== markAsBilledJob.id ? 'pointer' : 'not-allowed' }}>{stagesStatusUpdatingId === markAsBilledJob.id ? '…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {markAsBilledInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Mark as Billed</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{markAsBilledInvoice.job.hcp_number || '—'} · {markAsBilledInvoice.job.job_name || '—'} · ${Number(markAsBilledInvoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={markAsBilledChecked} onChange={(e) => setMarkAsBilledChecked(e.target.checked)} style={{ marginTop: 4 }} />
                <span>Invoice has been sent to the customer</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setMarkAsBilledInvoice(null); setMarkAsBilledChecked(false) }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={!markAsBilledChecked || stagesInvoiceUpdatingId === markAsBilledInvoice.id} onClick={async () => { if (!markAsBilledInvoice) return; await updateInvoiceStatus(markAsBilledInvoice.id, 'billed'); setMarkAsBilledInvoice(null); setMarkAsBilledChecked(false); loadJobs() }} style={{ padding: '0.5rem 1rem', background: markAsBilledChecked && stagesInvoiceUpdatingId !== markAsBilledInvoice.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: markAsBilledChecked && stagesInvoiceUpdatingId !== markAsBilledInvoice.id ? 'pointer' : 'not-allowed' }}>{stagesInvoiceUpdatingId === markAsBilledInvoice.id ? '…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {markPaidJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Mark Paid</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{markPaidJob.hcpNumber} · {markPaidJob.jobName}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={markPaidChecked} onChange={(e) => setMarkPaidChecked(e.target.checked)} style={{ marginTop: 4 }} />
                <span>Payment has been received and recorded</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setMarkPaidJob(null); setMarkPaidChecked(false) }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={!markPaidChecked || stagesStatusUpdatingId === markPaidJob.id} onClick={async () => { if (!markPaidJob) return; await markJobPaid(markPaidJob.id); setMarkPaidJob(null); setMarkPaidChecked(false); loadJobs() }} style={{ padding: '0.5rem 1rem', background: markPaidChecked && stagesStatusUpdatingId !== markPaidJob.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: markPaidChecked && stagesStatusUpdatingId !== markPaidJob.id ? 'pointer' : 'not-allowed' }}>{stagesStatusUpdatingId === markPaidJob.id ? '…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {markPaidInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Mark Paid</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{markPaidInvoice.job.hcp_number || '—'} · {markPaidInvoice.job.job_name || '—'} · ${Number(markPaidInvoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={markPaidChecked} onChange={(e) => setMarkPaidChecked(e.target.checked)} style={{ marginTop: 4 }} />
                <span>Payment has been received and recorded</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setMarkPaidInvoice(null); setMarkPaidChecked(false) }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={!markPaidChecked || stagesInvoiceUpdatingId === markPaidInvoice.id} onClick={async () => { if (!markPaidInvoice) return; await markInvoicePaid(markPaidInvoice.id); setMarkPaidInvoice(null); setMarkPaidChecked(false); loadJobs() }} style={{ padding: '0.5rem 1rem', background: markPaidChecked && stagesInvoiceUpdatingId !== markPaidInvoice.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: markPaidChecked && stagesInvoiceUpdatingId !== markPaidInvoice.id ? 'pointer' : 'not-allowed' }}>{stagesInvoiceUpdatingId === markPaidInvoice.id ? '…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {makePaymentLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Make Payment</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{makePaymentLaborJob.contractor} · {makePaymentLaborJob.hcp}</p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>Total: ${formatCurrency(makePaymentLaborJob.totalCost)} · Paid: ${formatCurrency(makePaymentLaborJob.paid)} · Outstanding: ${formatCurrency(makePaymentLaborJob.outstanding)}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={makePaymentAmount}
                onChange={(e) => setMakePaymentAmount(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo (optional)</label>
              <textarea
                value={makePaymentMemo}
                onChange={(e) => setMakePaymentMemo(e.target.value)}
                placeholder="Optional note"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={makePaymentSaving || !(parseFloat(makePaymentAmount) > 0)} onClick={async () => { if (!makePaymentLaborJob) return; const amt = parseFloat(makePaymentAmount); if (!(amt > 0)) return; setMakePaymentSaving(true); await recordLaborJobPayment(makePaymentLaborJob.id, amt, makePaymentMemo || null); setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo(''); setMakePaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? 'not-allowed' : 'pointer' }}>{makePaymentSaving ? '…' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}
      {backchargeLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Backcharge</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{backchargeLaborJob.contractor} · {backchargeLaborJob.hcp}</p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>Total: ${formatCurrency(backchargeLaborJob.totalCost)} · Paid: ${formatCurrency(backchargeLaborJob.paid)}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={backchargeAmount}
                onChange={(e) => setBackchargeAmount(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo <span style={{ color: '#b91c1c' }}>*</span></label>
              <textarea
                value={backchargeMemo}
                onChange={(e) => setBackchargeMemo(e.target.value)}
                placeholder="Required for backcharges"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setBackchargeLaborJob(null); setBackchargeAmount(''); setBackchargeMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim()} onClick={async () => { if (!backchargeLaborJob) return; const amt = parseFloat(backchargeAmount); if (!(amt > 0) || !backchargeMemo.trim()) return; setBackchargeSaving(true); await recordLaborJobBackcharge(backchargeLaborJob.id, amt, backchargeMemo); setBackchargeLaborJob(null); setBackchargeAmount(''); setBackchargeMemo(''); setBackchargeSaving(false) }} style={{ padding: '0.5rem 1rem', background: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? 'not-allowed' : 'pointer' }}>{backchargeSaving ? '…' : 'Record Backcharge'}</button>
            </div>
          </div>
        </div>
      )}
      {editingPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{editingPayment.isBackcharge ? 'Edit Backcharge' : 'Edit Payment'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={editPaymentAmount}
                onChange={(e) => setEditPaymentAmount(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo {editingPayment.isBackcharge ? <span style={{ color: '#b91c1c' }}>*</span> : '(optional)'}</label>
              <textarea
                value={editPaymentMemo}
                onChange={(e) => setEditPaymentMemo(e.target.value)}
                placeholder={editingPayment.isBackcharge ? 'Required for backcharges' : 'Optional note'}
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button type="button" disabled={editPaymentSaving} onClick={async () => { if (!editingPayment || !confirm('Remove this payment?')) return; setEditPaymentSaving(true); await deleteLaborJobPayment(editingPayment.id); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving ? '#9ca3af' : '#fee2e2', color: '#991b1c', border: 'none', borderRadius: 4, cursor: editPaymentSaving ? 'not-allowed' : 'pointer' }}>Remove</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="button" disabled={editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim())} onClick={async () => { if (!editingPayment) return; const amt = parseFloat(editPaymentAmount); if (!(amt > 0)) return; if (editingPayment.isBackcharge && !editPaymentMemo.trim()) return; setEditPaymentSaving(true); await updateLaborJobPayment(editingPayment.id, amt, editPaymentMemo || null, editingPayment.isBackcharge); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? 'not-allowed' : 'pointer' }}>{editPaymentSaving ? '…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {sendBackInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Send back</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{sendBackInvoice.inv.job.hcp_number || '—'} · {sendBackInvoice.inv.job.job_name || '—'} · ${Number(sendBackInvoice.inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>{sendBackInvoice.action === 'delete' ? 'This will remove the invoice from Ready to Bill.' : 'This will move the invoice back to Ready to Bill.'}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={sendBackChecked} onChange={(e) => setSendBackChecked(e.target.checked)} style={{ marginTop: 4 }} />
                <span>I am going to call the Subcontractor and explain why</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setSendBackInvoice(null); setSendBackChecked(false) }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={!sendBackChecked || stagesInvoiceUpdatingId === sendBackInvoice.inv.id} onClick={async () => { if (!sendBackInvoice) return; if (sendBackInvoice.action === 'delete') await deleteInvoice(sendBackInvoice.inv.id); else await updateInvoiceStatus(sendBackInvoice.inv.id, 'ready_to_bill'); setSendBackInvoice(null); setSendBackChecked(false); loadJobs() }} style={{ padding: '0.5rem 1rem', background: sendBackChecked && stagesInvoiceUpdatingId !== sendBackInvoice.inv.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: sendBackChecked && stagesInvoiceUpdatingId !== sendBackInvoice.inv.id ? 'pointer' : 'not-allowed' }}>{stagesInvoiceUpdatingId === sendBackInvoice.inv.id ? '…' : 'Send back'}</button>
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
              {sendBackConfirmJob.toStatus === 'ready_to_bill' ? 'This will move the job back to Ready to Bill.' : 'This will move the job back to Billed Awaiting Payment.'}
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
