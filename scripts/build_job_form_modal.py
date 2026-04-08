#!/usr/bin/env python3
"""One-off assembler: generates src/components/jobs/JobFormModal.tsx from extracted JSX."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BODY = (ROOT / "src/components/jobs/_modal_body_dedented.txt").read_text()

HEADER = r'''/* eslint-disable react-hooks/exhaustive-deps -- mount-only init; parent remounts via key */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NO_CUSTOMER_TYPE_LABEL } from '../../constants/customerTypeLabels'
import { supabase } from '../../lib/supabase'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { useAuth } from '../../hooks/useAuth'
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

type EstimatesRow = Database['public']['Tables']['estimates']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }

type MaterialRow = { id: string; description: string; amount: number }
type PaymentRow = { id: string; amount: number; paid_on: string | null; note: string | null }
type FixtureRow = { id: string; name: string; count: number }

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

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

export type JobFormModalProps = {
  mode: 'new' | 'edit'
  editJobId: string | null
  initialJob: JobWithDetails | null
  newJobProjectId?: string | null
  billingCustomerHighlightInitial: boolean
  alsoOpenCreateCustomerModal: boolean
  onClose: () => void
  onSaved: (() => void) | null
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
}: JobFormModalProps) {
  const { user: authUser, role: authRole } =useAuth()
  const { showToast } = useToastContext()
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

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
    setRevenue(job.revenue != null ? String(job.revenue) : '')
    setPayments(
      job.payments?.length
        ? job.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            paid_on: p.paid_on ? String(p.paid_on).slice(0, 10) : null,
            note: p.note ?? null,
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
    let cancelled = false
    void (async () => {
      if (!authUser?.id) return
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
  }, [])

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
          zIndex: 50,
        }}
      >
        <div style={{ background: 'white', padding: '1.25rem 1.5rem', borderRadius: 8, fontSize: '0.9375rem' }}>Loading…</div>
      </div>
    )
  }

  return (
    <>
'''

FOOTER = r'''
      <CustomerAcceptanceRecordModal
        open={contractModalEstimateId != null}
        estimateId={contractModalEstimateId}
        onClose={() => setContractModalEstimateId(null)}
      />
    </>
  )
}
'''

# fix typo useAuth
HEADER = HEADER.replace('=useAuth()', '= useAuth()')

out = HEADER + '\n' + BODY + '\n' + FOOTER
Path(ROOT / "src/components/jobs/JobFormModal.tsx").write_text(out)
print("Wrote JobFormModal.tsx", len(out), "chars")