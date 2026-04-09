/* eslint-disable react-hooks/exhaustive-deps -- mount-only init; parent remounts via key */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NO_CUSTOMER_TYPE_LABEL } from '../../constants/customerTypeLabels'
import { supabase } from '../../lib/supabase'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { useAuth } from '../../hooks/useAuth'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { useToastContext } from '../../contexts/ToastContext'
import { parseCustomerImport } from '../../utils/parseCustomerImport'
import { nameSimilarity } from '../../utils/nameSimilarity'
import { withSupabaseRetry } from '../../utils/errorHandling'
import CustomerAcceptanceRecordModal from '../estimates/CustomerAcceptanceRecordModal'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { resolveCustomerIdForJobPayload } from '../../lib/jobLedgerCustomer'
import { resolveEffectiveJobMasterUserId } from '../../lib/resolveEffectiveJobMasterUserId'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { formatMercuryCardChargesPostedDate } from '../../lib/formatMercuryCardChargesPostedDate'
import { fetchJobMaterialsCostSnapshot } from '../../lib/fetchJobMaterialsCostSnapshot'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import type { JobMercuryAllocLine, JobSupplyInvoiceLine, JobTallyPartLine } from '../../lib/fetchJobMaterialsCostSnapshot'
import { MaterialsCostAccordionRow } from './JobFormMaterialsCostAccordion'
import type { JobBillingContext } from './SendRecordInvoiceModal'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'

type EstimatesRow = Database['public']['Tables']['estimates']['Row']
type JobsLedgerInvoiceRow = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }

type MaterialRow = { id: string; description: string; amount: number }

type MaterialsAccordionKey = 'supply' | 'mercury' | 'tally' | 'billed'

type PaymentRow = {
  id: string
  amount: number
  paid_on: string | null
  note: string | null
  /** Set when loaded from DB; payments applied to an invoice cannot be removed in this form. */
  invoice_id: string | null
}
type FixtureRow = { id: string; name: string; count: number }

function localDateYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function newEmptyPaymentRow(): PaymentRow {
  return { id: crypto.randomUUID(), amount: 0, paid_on: localDateYYYYMMDD(), note: null, invoice_id: null }
}

function paymentRowLinkedToInvoice(row: PaymentRow): boolean {
  return row.invoice_id != null && String(row.invoice_id).trim().length > 0
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function outstandingBillingLabel(inv: JobsLedgerInvoiceRow): string {
  if ((inv.stripe_invoice_id ?? '').trim()) return 'Stripe'
  const ch = (inv.external_send_channel ?? '').trim()
  if (ch === 'stripe') return 'Stripe'
  if (ch === 'housecallpro') return 'Outside (Housecall Pro)'
  if (ch === 'physical') return 'Outside (Physical)'
  if (ch) return `Outside (${ch})`
  return 'Billed'
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

function jobLedgerHasCustomerForBilling(customerId: string | null | undefined): boolean {
  return customerId != null && String(customerId).trim().length > 0
}

type ProjectOption = {
  id: string
  name: string
  customer_id: string
  master_user_id: string
  customers: { name: string } | null
}

/** Above Job Detail modal (`1004`) so Edit Job can stack on top without closing detail. */
const JOB_FORM_OVERLAY_Z_INDEX = 1010
const JOB_FORM_NESTED_OVERLAY_Z_INDEX = JOB_FORM_OVERLAY_Z_INDEX + 1

export type JobFormModalProps = {
  mode: 'new' | 'edit'
  editJobId: string | null
  initialJob: JobWithDetails | null
  newJobProjectId?: string | null
  billingCustomerHighlightInitial: boolean
  alsoOpenCreateCustomerModal: boolean
  onClose: () => void
  onSaved: (() => void) | null
  /** New job only: called with created id after insert succeeds. */
  onCreatedJobId?: ((jobId: string) => void) | null
}

export default function JobFormModal({
  mode,
  editJobId,
  initialJob,
  newJobProjectId = null,
  billingCustomerHighlightInitial,
  alsoOpenCreateCustomerModal,
  onClose,
  onSaved,
  onCreatedJobId = null,
}: JobFormModalProps) {
  const { user: authUser, role: authRole } = useAuth()
  const { nicknameByDebitCard } = useMercuryLedgerNicknames()
  const { showToast } = useToastContext()
  const billCustomer = useBillCustomerModal()
  const navigate = useNavigate()
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const onCreatedJobIdRef = useRef(onCreatedJobId)
  onCreatedJobIdRef.current = onCreatedJobId

  const [initDone, setInitDone] = useState(false)
  const [editing, setEditing] = useState<JobWithDetails | null>(null)
  const [sourceEstimateForJob, setSourceEstimateForJob] = useState<EstimatesRow | null>(null)
  const [sourceEstimateLoading, setSourceEstimateLoading] = useState(false)
  const [contractModalEstimateId, setContractModalEstimateId] = useState<string | null>(null)
  const [hcpNumber, setHcpNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(false)
  const [creatingCustomerFromJob, setCreatingCustomerFromJob] = useState(false)
  const [createCustomerFromJobModalOpen, setCreateCustomerFromJobModalOpen] = useState(false)
  const [createCustomerFromJobType, setCreateCustomerFromJobType] = useState<'residential' | 'commercial'>('residential')
  const [similarCustomersForCreate, setSimilarCustomersForCreate] = useState<CustomerRow[]>([])
  const [createCustomerFromJobModalLoading, setCreateCustomerFromJobModalLoading] = useState(false)
  const [customerExpanded, setCustomerExpanded] = useState(false)
  const [projectFilesPlansExpanded, setProjectFilesPlansExpanded] = useState(false)
  const [billingCustomerHighlight, setBillingCustomerHighlight] = useState(false)
  const [dateMet, setDateMet] = useState('')
  const [lastBillDate, setLastBillDate] = useState('')
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
  const billingCustomerHighlightRef = useRef<HTMLDivElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newInvoiceAmount, setNewInvoiceAmount] = useState('')
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [materialsAccordionOpen, setMaterialsAccordionOpen] = useState<MaterialsAccordionKey | null>('billed')
  const [jobMaterialsSnapshotLoading, setJobMaterialsSnapshotLoading] = useState(false)
  const [supplyInvoiceTotal, setSupplyInvoiceTotal] = useState(0)
  const [supplyInvoiceRpcFailed, setSupplyInvoiceRpcFailed] = useState(false)
  const [supplyInvoiceLines, setSupplyInvoiceLines] = useState<JobSupplyInvoiceLine[]>([])
  const [mercuryAllocLines, setMercuryAllocLines] = useState<JobMercuryAllocLine[]>([])
  const [mercuryFetchFailed, setMercuryFetchFailed] = useState(false)
  const [tallyPartLines, setTallyPartLines] = useState<JobTallyPartLine[]>([])
  const [tallyFetchFailed, setTallyFetchFailed] = useState(false)
  const jobNameInputRef = useRef<HTMLInputElement | null>(null)
  const jobAddressInputRef = useRef<HTMLInputElement | null>(null)

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

  function closeForm() {
    setContractModalEstimateId(null)
    setCreateCustomerFromJobModalOpen(false)
    setBillingCustomerHighlight(false)
    setNewInvoiceAmount('')
    onClose()
  }

  function applyEditJob(job: JobWithDetails, billingGate: boolean) {
    setBillingCustomerHighlight(billingGate)
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
    setCustomerExpanded(
      !!(job.customer_name || job.customer_email || job.customer_phone || job.customer_id) ||
        (billingGate && !jobLedgerHasCustomerForBilling(job.customer_id)),
    )
    setLastBillDate(job.last_bill_date ? job.last_bill_date.slice(0, 10) : '')
    setGoogleDriveLink(job.google_drive_link ?? '')
    setJobPlansLink(job.job_plans_link ?? '')
    setProjectFilesPlansExpanded(
      !!(job.project_id || (job.google_drive_link ?? '').trim() || (job.job_plans_link ?? '').trim()),
    )
    setRevenue(job.revenue != null ? String(job.revenue) : '')
    setPayments(
      job.payments?.length
        ? job.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            paid_on: p.paid_on ? String(p.paid_on).slice(0, 10) : null,
            note: p.note ?? null,
            invoice_id: p.invoice_id ?? null,
          }))
        : [newEmptyPaymentRow()],
    )
    setMaterials(
      job.materials.length > 0
        ? job.materials.map((m) => ({ id: m.id, description: m.description, amount: Number(m.amount) }))
        : [{ id: crypto.randomUUID(), description: '', amount: 0 }],
    )
    setFixtures(
      job.fixtures.length > 0
        ? job.fixtures.map((f) => ({ id: f.id, name: f.name, count: Number(f.count) || 1 }))
        : [{ id: crypto.randomUUID(), name: '', count: 1 }],
    )
    setTeamMemberIds(job.team_members.map((t) => t.user_id))
    setContractorsSearch('')
    setContractorsDropdownOpen(false)
  }

  function resetNewForm(projectPrefill: string | null) {
    setEditing(null)
    setHcpNumber('')
    setJobName('')
    setJobAddress('')
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setCustomerId(null)
    setProjectId(projectPrefill)
    setCustomerSearch('')
    setDateMet('')
    setCustomerExpanded(true)
    setLastBillDate('')
    setGoogleDriveLink('')
    setJobPlansLink('')
    setProjectFilesPlansExpanded(!!projectPrefill)
    setRevenue('')
    setPayments([newEmptyPaymentRow()])
    setMaterials([{ id: crypto.randomUUID(), description: '', amount: 0 }])
    setFixtures([{ id: crypto.randomUUID(), name: '', count: 1 }])
    setTeamMemberIds([])
    setContractorsSearch('')
    setContractorsDropdownOpen(false)
    setBillingCustomerHighlight(false)
    setSourceEstimateForJob(null)
    setContractModalEstimateId(null)
  }

  useLayoutEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    void (async () => {
      setCustomersLoading(true)
      try {
        async function loadFormUsers() {
          if (!authUser?.id) return
          const [usersRes, meRes] = await Promise.all([
            supabase.from('users').select('id, name, email, role').in('role', ['assistant', 'master_technician', 'subcontractor', 'estimator', 'primary', 'superintendent']).order('name'),
            supabase.from('users').select('role').eq('id', authUser.id).single(),
          ])
          let usersList = (usersRes.data as UserRow[]) ?? []
          const role = (meRes.data as { role?: string } | null)?.role
          if (role === 'dev') {
            const { data: devUsers } = await supabase.from('users').select('id, name, email, role').eq('role', 'dev')
            if (devUsers?.length) {
              const existingIds = new Set(usersList.map((u) => u.id))
              const newDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
              usersList = [...usersList, ...newDevs]
            }
          }
          if (!cancelled) setUsers(usersList)
        }

        const [{ data: custData }, { data: projData }] = await Promise.all([
          supabase.from('customers').select('id, name, address, contact_info, date_met, master_user_id, customer_type').order('name'),
          supabase.from('projects').select('id, name, customer_id, master_user_id, customers(name)').order('name'),
        ])
        if (cancelled) return
        setCustomers((custData as CustomerRow[]) ?? [])
        setProjects((projData as ProjectOption[]) ?? [])
        await loadFormUsers()
        if (cancelled) return

        if (mode === 'new') {
          resetNewForm(newJobProjectId)
          if (newJobProjectId) {
            const { data: pdata } = await supabase.from('projects').select('customer_id, customers(name, address, contact_info, date_met)').eq('id', newJobProjectId).single()
            if (cancelled || !pdata) {
              setInitDone(true)
              return
            }
            if (pdata.customer_id) {
              setCustomerId(pdata.customer_id)
              const c = (pdata as { customers?: { name: string; address: string | null; contact_info: unknown; date_met: string | null } }).customers
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
          }
        } else {
          let job: JobWithDetails | null = initialJob
          if (!job && editJobId) {
            job = await fetchJobWithDetailsById(editJobId)
          }
          if (cancelled) return
          if (!job) {
            showToast('Job not found or you do not have access.', 'error')
            onClose()
            return
          }
          applyEditJob(job, billingCustomerHighlightInitial)
          if (alsoOpenCreateCustomerModal && (job.customer_name ?? '').trim()) {
            setCreateCustomerFromJobType('residential')
            setCreateCustomerFromJobModalOpen(true)
          }
        }
        if (!cancelled) setInitDone(true)
      } finally {
        if (!cancelled) setCustomersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  useEffect(() => {
    const jobId = editing?.id ?? null
    if (!jobId) {
      setSourceEstimateForJob(null)
      setSourceEstimateLoading(false)
      return
    }
    let cancelled = false
    setSourceEstimateLoading(true)
    void (async () => {
      try {
        const est = await withSupabaseRetry(
          async () =>
            await supabase.from('estimates').select('*').eq('job_ledger_id', jobId).maybeSingle(),
          'load source estimate for job',
        )
        if (cancelled) return
        setSourceEstimateForJob((est ?? null) as EstimatesRow | null)
      } catch {
        if (!cancelled) setSourceEstimateForJob(null)
      } finally {
        if (!cancelled) setSourceEstimateLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editing?.id])

  useEffect(() => {
    const jobId = editing?.id ?? null
    if (!jobId) {
      setJobMaterialsSnapshotLoading(false)
      setSupplyInvoiceTotal(0)
      setSupplyInvoiceRpcFailed(false)
      setSupplyInvoiceLines([])
      setMercuryAllocLines([])
      setMercuryFetchFailed(false)
      setTallyPartLines([])
      setTallyFetchFailed(false)
      setMaterialsAccordionOpen('billed')
      return
    }
    let cancelled = false
    setJobMaterialsSnapshotLoading(true)
    setMaterialsAccordionOpen('billed')
    setSupplyInvoiceRpcFailed(false)
    setMercuryFetchFailed(false)
    setTallyFetchFailed(false)

    void (async () => {
      try {
        const snap = await fetchJobMaterialsCostSnapshot(jobId)
        if (cancelled) return
        setSupplyInvoiceTotal(snap.supplyInvoiceTotal)
        setSupplyInvoiceRpcFailed(snap.supplyInvoiceRpcFailed)
        setSupplyInvoiceLines(snap.supplyInvoiceLines)
        setMercuryAllocLines(snap.mercuryAllocLines)
        setMercuryFetchFailed(snap.mercuryFetchFailed)
        setTallyPartLines(snap.tallyPartLines)
        setTallyFetchFailed(snap.tallyFetchFailed)
      } finally {
        if (!cancelled) setJobMaterialsSnapshotLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editing?.id])

  useEffect(() => {
    if (customerId && billingCustomerHighlight) {
      setBillingCustomerHighlight(false)
    }
  }, [customerId, billingCustomerHighlight])

  useEffect(() => {
    if (!billingCustomerHighlight) return
    const id = requestAnimationFrame(() => {
      billingCustomerHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [billingCustomerHighlight])

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
    if (!contractorsDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (contractorsDropdownRef.current && !contractorsDropdownRef.current.contains(e.target as Node)) {
        setContractorsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contractorsDropdownOpen])

  const billedMaterialsTotalDisplay = useMemo(() => {
    const sum = materials.reduce((s, m) => s + (Number(m.amount) || 0), 0)
    return formatCurrency(sum)
  }, [materials])

  const mercuryCardTotal = useMemo(
    () => mercuryAllocLines.reduce((s, l) => s + Math.abs(Number(l.allocationAmount)), 0),
    [mercuryAllocLines],
  )

  const tallyPartsTotal = useMemo(() => tallyPartLines.reduce((s, l) => s + l.lineTotal, 0), [tallyPartLines])

  const toggleMaterialsAccordion = useCallback((key: MaterialsAccordionKey) => {
    setMaterialsAccordionOpen((prev) => (prev === key ? null : key))
  }, [])

  const projectFilesPlansSummary = useMemo(() => {
    const parts: string[] = []
    if (projectId) {
      parts.push(projects.find((p) => p.id === projectId)?.name ?? '—')
    }
    if (googleDriveLink.trim()) parts.push('Files')
    if (jobPlansLink.trim()) parts.push('Plans')
    if (parts.length === 0) return '—'
    return parts.join(' · ')
  }, [projectId, projects, googleDriveLink, jobPlansLink])

  function getEditJobBillableRemaining(): number {
    return Math.max(0, parseMoneyInputToNumber(revenue) - payments.reduce((s, p) => s + (Number(p.amount) || 0), 0))
  }

  async function createInvoice() {
    if (!editing) return
    const amount = parseFloat(newInvoiceAmount)
    if (!(amount > 0)) {
      setError('Enter a valid amount greater than 0')
      return
    }
    const remaining = getEditJobBillableRemaining()
    if (amount > remaining) {
      setError(`Amount cannot exceed Remaining ($${formatCurrency(remaining)})`)
      return
    }
    setCreatingInvoice(true)
    setError(null)
    try {
      const nextOrder = (editing.invoices ?? []).length
      const estBill = editing.last_bill_date?.trim().slice(0, 10) ?? null
      const { error: err } = await supabase.from('jobs_ledger_invoices').insert({
        job_id: editing.id,
        amount,
        status: 'ready_to_bill',
        sequence_order: nextOrder,
        estimated_bill_date: estBill,
        is_primary_rtb_bundle: false,
      })
      if (err) throw err
      setNewInvoiceAmount('')
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) setEditing(found)
      onSavedRef.current?.()
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string }
      const msg = err?.message || 'Failed to create invoice'
      const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
      setError(extra ? `${msg}. ${extra}` : msg)
    } finally {
      setCreatingInvoice(false)
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

  function requestRemovePaymentRow(row: PaymentRow) {
    if (paymentRowLinkedToInvoice(row)) {
      showToast(
        'This payment is linked to an invoice and can’t be removed in Edit Job. Change it from Outstanding billing or the mark-paid flow.',
        'error',
      )
      return
    }
    if (payments.length <= 1) {
      showToast(
        'At least one payment line must stay in this form. Add another line first, or set this row’s amount to $0 if you don’t need a payment here.',
        'info',
      )
      return
    }
    removePaymentRow(row.id)
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
        const found = await fetchJobWithDetailsById(editing.id)
        if (found) setEditing(found)
        onSavedRef.current?.()
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
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) setEditing(found)
      onSavedRef.current?.()
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
        filled > 0 ? 'success' : 'error',
      )
    } catch {
      showToast('Could not read clipboard', 'error')
    }
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
        const resolvedCustomerId = resolveCustomerIdForJobPayload(
          customerId,
          jobMasterForCustomer,
          customerName.trim(),
          customers,
        )
        const updatePayload = {
          hcp_number: hcpNumber.trim(),
          job_name: jobName.trim(),
          job_address: jobAddress.trim(),
          customer_id: resolvedCustomerId,
          customer_name: customerName.trim() || null,
          customer_email: customerEmail.trim() || null,
          customer_phone: customerPhone.trim() || null,
          last_bill_date: lastBillDate.trim() || null,
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
            invoice_id: p.invoice_id,
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
        const effectiveMasterId = await resolveEffectiveJobMasterUserId(supabase, authUser.id, projectId || null)

        const resolvedCustomerIdNew = resolveCustomerIdForJobPayload(
          customerId,
          effectiveMasterId,
          customerName.trim(),
          customers,
        )
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
            last_bill_date: lastBillDate.trim() || null,
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
              invoice_id: p.invoice_id,
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
          const validFixturesIns = fixtures.filter((f) => (f.name ?? '').trim())
          for (const [i, f] of validFixturesIns.entries()) {
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
          onCreatedJobIdRef.current?.(jobId)
        }
      }
      if (customerId && dateMet.trim()) {
        const c = customers.find((x) => x.id === customerId)
        if (c && !c.date_met) {
          await supabase.from('customers').update({ date_met: dateMet.trim() }).eq('id', customerId)
        }
      }
      closeForm()
      onSavedRef.current?.()
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
    onSavedRef.current?.()
    closeForm()
    setDeletingId(null)
    return true
  }

  if (!initDone) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: JOB_FORM_OVERLAY_Z_INDEX,
        }}
      >
        <div style={{ background: 'white', padding: '1.25rem 1.5rem', borderRadius: 8, fontSize: '0.9375rem' }}>Loading…</div>
      </div>
    )
  }

  return (
    <>

    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: JOB_FORM_OVERLAY_Z_INDEX,
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
        {editing && sourceEstimateLoading ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Checking for linked estimate…</p>
        ) : null}
        {editing && !sourceEstimateLoading && sourceEstimateForJob ? (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.6rem 0.75rem',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              fontSize: '0.875rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <span>
              <strong>Source estimate:</strong>{' '}
              <Link
                to={`/estimates/${sourceEstimateForJob.estimate_number}`}
                style={{ color: '#15803d', fontWeight: 600 }}
              >
                #{sourceEstimateForJob.estimate_number}
              </Link>
              {sourceEstimateForJob.title?.trim() ? ` · ${sourceEstimateForJob.title.trim()}` : null}
            </span>
            <button
              type="button"
              onClick={() => setContractModalEstimateId(sourceEstimateForJob.id)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                background: 'white',
                border: '1px solid #86efac',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              View contract &amp; acceptance
            </button>
          </div>
        ) : null}
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
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Last manual bill date</label>
              <input
                type="date"
                value={lastBillDate}
                onChange={(e) => setLastBillDate(e.target.value)}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            <div>
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
                <div
                  ref={billingCustomerHighlightRef}
                  style={{
                    marginBottom: '0.75rem',
                    position: 'relative',
                    ...(billingCustomerHighlight
                      ? {
                          padding: '0.75rem',
                          borderRadius: 8,
                          background: '#fef2f2',
                          border: '2px solid #fecaca',
                        }
                      : {}),
                  }}
                >
                  {billingCustomerHighlight ? (
                    <p
                      role="status"
                      aria-live="polite"
                      style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#991b1c' }}
                    >
                      Link a customer before sending this invoice.
                    </p>
                  ) : null}
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
            <div>
            <button
              type="button"
              id="job-form-project-files-plans-trigger"
              aria-expanded={projectFilesPlansExpanded}
              aria-controls="job-form-project-files-plans-panel"
              onClick={() => setProjectFilesPlansExpanded((p) => !p)}
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
                width: '100%',
                textAlign: 'left',
                marginBottom: projectFilesPlansExpanded ? '0.5rem' : 0,
              }}
            >
              <span aria-hidden>{projectFilesPlansExpanded ? '\u25BC' : '\u25B6'}</span>
              <span>
                Project, files, and plans: <span style={{ fontWeight: 400, color: '#6b7280' }}>{projectFilesPlansSummary}</span>
              </span>
            </button>
            {projectFilesPlansExpanded && (
              <div
                id="job-form-project-files-plans-panel"
                role="region"
                aria-labelledby="job-form-project-files-plans-trigger"
                style={{ paddingLeft: '1.25rem', borderLeft: '2px solid #e5e7eb' }}
              >
                <div style={{ marginBottom: '0.75rem' }}>
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
              </div>
            )}
            </div>
          </div>
          <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid #9ca3af', width: '50%' }} />
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginBottom: teamMemberIds.length > 0 ? '0.5rem' : 0,
              }}
            >
              <div ref={contractorsDropdownRef} style={{ position: 'relative', flex: '1 1 12rem', minWidth: 0 }}>
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
                  placeholder="Add People..."
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
                          No matches
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
            {teamMemberIds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
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
          </div>
          <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid #9ca3af', width: '50%' }} />
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151', marginBottom: '0.75rem' }}>Specific Work (Fixtures / Tie-ins / Repair)</div>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button type="button" onClick={addFixtureRow} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Add
              </button>
            </div>
          </div>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1rem', overflow: 'hidden' }}>
              {editing?.id ? (
                <>
                  <MaterialsCostAccordionRow
                    title="Supply house invoices"
                    totalDisplay={supplyInvoiceRpcFailed ? '—' : formatCurrency(supplyInvoiceTotal)}
                    expanded={materialsAccordionOpen === 'supply'}
                    onToggle={() => toggleMaterialsAccordion('supply')}
                    busy={jobMaterialsSnapshotLoading}
                  >
                    {supplyInvoiceLines.length === 0 && supplyInvoiceTotal > 0 && !supplyInvoiceRpcFailed ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                        Allocated invoice total for this job; line detail is available to office roles in Materials.
                      </p>
                    ) : supplyInvoiceLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No supply house invoice allocations for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Supply house</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Invoice</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Date</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Allocated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplyInvoiceLines.map((ln, idx) => (
                            <tr key={`${ln.invoiceNumber}-${ln.invoiceDate}-${idx}`} style={{ borderBottom: idx < supplyInvoiceLines.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{ln.supplyHouseName ?? '—'}</td>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{ln.invoiceNumber}</td>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{ln.invoiceDate || '—'}</td>
                              <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(ln.allocatedAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </MaterialsCostAccordionRow>
                  <MaterialsCostAccordionRow
                    title="Card charges"
                    totalDisplay={mercuryFetchFailed ? '—' : formatCurrency(mercuryCardTotal)}
                    expanded={materialsAccordionOpen === 'mercury'}
                    onToggle={() => toggleMaterialsAccordion('mercury')}
                    busy={jobMaterialsSnapshotLoading}
                  >
                    {mercuryFetchFailed ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#b91c1c' }}>Could not load card allocations.</p>
                    ) : mercuryAllocLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No Mercury card splits for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Posted</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Card</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Counterparty</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Amount</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mercuryAllocLines.map((ln, idx) => (
                            <tr key={ln.id} style={{ borderBottom: idx < mercuryAllocLines.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{formatMercuryCardChargesPostedDate(ln.postedAt)}</td>
                              <td
                                style={{
                                  padding: '0.5rem 0.625rem',
                                  maxWidth: 140,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={
                                  ln.debitCardId
                                    ? nicknameByDebitCard[ln.debitCardId] ?? formatMercuryDebitCardIdCompact(ln.debitCardId)
                                    : undefined
                                }
                              >
                                {ln.debitCardId
                                  ? nicknameByDebitCard[ln.debitCardId] ?? formatMercuryDebitCardIdCompact(ln.debitCardId)
                                  : '—'}
                              </td>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{ln.counterpartyName ?? '—'}</td>
                              <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Math.abs(ln.allocationAmount))}</td>
                              <td style={{ padding: '0.5rem 0.625rem', color: '#4b5563' }}>{ln.note ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </MaterialsCostAccordionRow>
                  <MaterialsCostAccordionRow
                    title="Parts from tally"
                    totalDisplay={tallyFetchFailed ? '—' : formatCurrency(tallyPartsTotal)}
                    expanded={materialsAccordionOpen === 'tally'}
                    onToggle={() => toggleMaterialsAccordion('tally')}
                    busy={jobMaterialsSnapshotLoading}
                  >
                    {tallyFetchFailed ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#b91c1c' }}>Could not load tally parts.</p>
                    ) : tallyPartLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No tally parts for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Description</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Qty</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Line total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tallyPartLines.map((ln, idx) => (
                            <tr key={ln.id} style={{ borderBottom: idx < tallyPartLines.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.625rem' }}>
                                {[ln.fixtureName, ln.partName].filter(Boolean).join(' · ') || '—'}
                              </td>
                              <td style={{ padding: '0.5rem 0.625rem', textAlign: 'center' }}>{ln.quantity}</td>
                              <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(ln.lineTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </MaterialsCostAccordionRow>
                </>
              ) : null}
              <MaterialsCostAccordionRow
                title="Other job charges"
                totalDisplay={billedMaterialsTotalDisplay}
                expanded={materialsAccordionOpen === 'billed'}
                onToggle={() => toggleMaterialsAccordion('billed')}
                busy={false}
              >
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
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                  <button type="button" onClick={addMaterialRow} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    Add
                  </button>
                </div>
              </MaterialsCostAccordionRow>
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
                  ${formatCurrency(getEditJobBillableRemaining())}
                </div>
              </div>
            </div>
          {editing && (
            <>
              {((editing.invoices ?? []).filter((i) => i.status === 'ready_to_bill' || i.status === 'billed').length > 0) && (
                <div style={{ marginBottom: '1rem' }}>
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
                              onClose()
                              navigate(`/jobs?tab=stages&stagesInvoice=${encodeURIComponent(inv.id)}`)
                            }}
                            style={{ marginLeft: 8, padding: '0.15rem 0.35rem', fontSize: '0.75rem', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            View in Stages
                          </button>
                          {inv.status === 'ready_to_bill' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!editing) return
                                if (!jobLedgerHasCustomerForBilling(editing.customer_id)) {
                                  showToast('Link this job to a customer before billing.', 'error')
                                  return
                                }
                                const ctx: JobBillingContext = {
                                  id: editing.id,
                                  master_user_id: editing.master_user_id,
                                  hcp_number: editing.hcp_number,
                                  job_name: editing.job_name,
                                  customer_id: editing.customer_id,
                                  customer_name: editing.customer_name,
                                  customer_email: editing.customer_email,
                                }
                                billCustomer?.openBillCustomer({
                                  payload: {
                                    kind: 'invoice',
                                    job: ctx,
                                    invoice: {
                                      id: inv.id,
                                      amount: inv.amount,
                                      status: inv.status,
                                    },
                                  },
                                  onSuccess: async () => {
                                    onSavedRef.current?.()
                                    const found = await fetchJobWithDetailsById(editing.id)
                                    if (found) setEditing(found)
                                  },
                                  onAfterEnsureSuccess: async () => {
                                    const found = await fetchJobWithDetailsById(editing.id)
                                    if (found) setEditing(found)
                                  },
                                })
                              }}
                              style={{
                                marginLeft: 8,
                                padding: '0.15rem 0.35rem',
                                fontSize: '0.75rem',
                                background: '#dbeafe',
                                border: '1px solid #93c5fd',
                                borderRadius: 4,
                                cursor: 'pointer',
                                color: '#1e40af',
                              }}
                            >
                              Preview / Stripe bill…
                            </button>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {(editing.invoices ?? []).some((i) => i.status === 'billed') && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Outstanding billing</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Label</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Note</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Billed</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editing.invoices ?? [])
                        .filter((i) => i.status === 'billed')
                        .map((inv, idx, arr) => {
                          const applied = (editing.payments ?? [])
                            .filter((p) => p.invoice_id === inv.id)
                            .reduce((s, p) => s + Number(p.amount ?? 0), 0)
                          const open = Math.max(0, Number(inv.amount ?? 0) - applied)
                          const sent =
                            inv.sent_to_customer_at != null && String(inv.sent_to_customer_at).trim()
                              ? String(inv.sent_to_customer_at).slice(0, 10)
                              : '—'
                          const note = (inv.external_send_note ?? '').trim() || '—'
                          return (
                            <tr
                              key={inv.id}
                              style={{ borderBottom: idx < arr.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                            >
                              <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>{outstandingBillingLabel(inv)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>{sent}</td>
                              <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top', wordBreak: 'break-word' }}>{note}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                ${formatCurrency(Number(inv.amount ?? 0))}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>
                                ${formatCurrency(open)}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                  {(() => {
                    const stripeLinks = (editing.invoices ?? [])
                      .filter((i) => i.status === 'billed')
                      .filter((inv) => (inv.stripe_invoice_id ?? '').trim() && (inv.hosted_invoice_url ?? '').trim())
                    if (stripeLinks.length === 0) return null
                    return (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                        {stripeLinks.map((inv) => (
                          <div key={inv.id} style={{ marginTop: 8 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              Stripe invoice #{inv.sequence_order} — ${formatCurrency(Number(inv.amount ?? 0))}
                            </div>
                            <StripeInvoiceSharePanel
                              hostedInvoiceUrl={inv.hosted_invoice_url!.trim()}
                              stripeInvoiceId={(inv.stripe_invoice_id ?? '').trim()}
                              customerEmail={editing.customer_email}
                              customerName={editing.customer_name}
                              jobName={editing.job_name}
                              hcpNumber={editing.hcp_number}
                              amountLabel={`$${formatCurrency(Number(inv.amount ?? 0))}`}
                              compact
                            />
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </>
          )}
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
                          onClick={() => requestRemovePaymentRow(row)}
                          title="Remove"
                          aria-label="Remove payment row"
                          style={{
                            padding: '0.35rem',
                            background:
                              payments.length <= 1 || paymentRowLinkedToInvoice(row) ? '#f3f4f6' : 'transparent',
                            color: payments.length <= 1 || paymentRowLinkedToInvoice(row) ? '#9ca3af' : '#991b1c',
                            border: 'none',
                            borderRadius: 4,
                            cursor:
                              payments.length <= 1 || paymentRowLinkedToInvoice(row) ? 'not-allowed' : 'pointer',
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
                    Record Payment
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
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.35rem' }}>
                      Remaining (billable): ${formatCurrency(getEditJobBillableRemaining())}
                      {getEditJobBillableRemaining() > 0 ? (
                        <>
                          {' · '}
                          <button
                            type="button"
                            onClick={() => {
                              setError(null)
                              setNewInvoiceAmount(getEditJobBillableRemaining().toFixed(2))
                            }}
                            aria-label="Fill partial invoice amount with full remaining billable balance"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              color: '#2563eb',
                              fontSize: 'inherit',
                              fontFamily: 'inherit',
                              textDecoration: 'underline',
                            }}
                          >
                            Use full remaining
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: JOB_FORM_NESTED_OVERLAY_Z_INDEX }} onClick={() => setCreateCustomerFromJobModalOpen(false)}>
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

      <CustomerAcceptanceRecordModal
        open={contractModalEstimateId != null}
        estimateId={contractModalEstimateId}
        onClose={() => setContractModalEstimateId(null)}
      />
    </>
  )
}
