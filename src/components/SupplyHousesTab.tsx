import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../lib/format'
import { parsePoGeneratorCodeFromPurchaseOrderName } from '../lib/parsePoGeneratorCodeFromPurchaseOrderName'
import { DEFAULT_JOB_LEDGER_PREFIX, effectiveJobLedgerNumber, formatJobLedgerNumberLabel } from '../lib/ledgerDisplayPrefixes'
import { stripTrailingZip } from '../lib/displayAddress'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { UnifiedSearchResultRow } from './search/UnifiedSearchResultRow'
import { useJobBidSearchEvidence } from '../hooks/useJobBidSearchEvidence'
import { longTimeAgoPhrase } from '../lib/subcontractorLastActivityCompact'
import {
  AGING_BUCKETS,
  buildSupplyHouseAgingMatrix,
  countSupplyHousesPastDue60,
  supplyHouseAgingPhoneNote,
  daysPastDue,
  nextMonthlyPaymentDueYmd,
  type AgingBucketKey,
} from '../lib/supplyHouseAging'
import { SupplyHouseDirectory } from './materials/SupplyHouseDirectory'
import { useSupplyHouseEditor } from './materials/useSupplyHouseEditor'
import { SupplyHouseWebsiteLink } from './SupplyHouseWebsiteLink'
import type { Database } from '../types/database'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { STICKY_MODAL_CLOSE_BUTTON_STYLE, stickyModalHeaderStyle, stickyModalPanelStyle } from '../lib/stickyModalHeaderStyle'
import {
  addAllocation,
  allocationTotal,
  dueDateHint,
  paidAtPayload,
  paidOnYmdFromIso,
  poCodeHint,
  poCodeHintText,
  removeAllocation,
  setAllocationPct,
  amountProblem,
  creditEffectSentence,
  documentKindFromRow,
  documentWords,
  signedAmountForSave,
  typedAmountFromStored,
  type SupplyDocumentKind,
} from '../lib/materials/supplyHouseInvoiceForm'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { SupplyHouseJobAccountsSection } from './materials/SupplyHouseJobAccountsSection'
import { SupplyHouseJobAccountsRoster } from './materials/SupplyHouseJobAccountsRoster'
import { MarkJobAccountOpenedModal } from './materials/MarkJobAccountOpenedModal'
import { openedViaPhrase, type JobSupplyHouseAccountRow } from '../lib/materials/jobSupplyHouseAccounts'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useReportQuickfillSectionMetric } from '../contexts/QuickfillSectionMetricsContext'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { isSupplyCredit } from '../lib/supplyHouseDocument'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type SupplyHouseInvoice = Database['public']['Tables']['supply_house_invoices']['Row']
type InvoiceJobAllocation = { job_id: string; pct: number }
type SupplyHouseInvoiceWithAllocations = SupplyHouseInvoice & { job_allocations?: InvoiceJobAllocation[] }
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent'

type POItemWithDetails = PurchaseOrderItem & {
  part: MaterialPart
  supply_house?: SupplyHouse
  source_template?: { id: string; name: string } | null
}
type PurchaseOrderWithItems = PurchaseOrder & { items: POItemWithDetails[] }

type SupplyHouseSummaryRow = {
  supply_house_id: string
  name: string
  outstanding: number
  monthlyPaymentDay: number | null
  lastInvoiceUpdatedAt: string | null
  lastInvoicePaidAt: string | null
}

/**
 * Format a DATE-only column (YYYY-MM-DD) in the user's locale. `new Date('2026-07-10')` parses
 * as UTC midnight, which renders as the PREVIOUS day in US timezones — parse at local noon.
 */
function formatYmdLocal(ymd: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(ymd + 'T12:00:00') : new Date(ymd)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString()
}

const INVOICE_INPUT_STYLE = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' as const }
const INVOICE_LABEL_STYLE = { display: 'block', marginBottom: '0.25rem', fontWeight: 500 }

/** The Add / Edit Invoice form reads in the order the paper does — each group gets a small rule-off caption (v2.3474). */
function InvoiceFormSection({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, margin: '0.25rem 0 0.5rem' }}>
      {children}
      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

/** Heat colors for the aging map — green (not due) through deepening reds. */
const AGING_CELL_STYLES: Record<AgingBucketKey, { background: string; color: string }> = {
  current: { background: 'var(--bg-emerald-tint)', color: 'var(--text-emerald-800)' },
  past1_30: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  past30_60: { background: 'var(--bg-orange-100)', color: 'var(--text-orange-800)' },
  past60_90: { background: 'var(--bg-red-100)', color: 'var(--text-red-800)' },
  past90plus: { background: 'var(--bg-red-200)', color: 'var(--text-red-900)' },
  noDueDate: { background: 'var(--bg-muted)', color: 'var(--text-600)' },
}

interface SupplyHousesTabProps {
  supplyHouses?: SupplyHouse[]
  onSupplyHousesChange?: () => void | Promise<void>
  myRole?: UserRole | null
  showTitle?: boolean
  selectedServiceTypeId?: string
  onNavigateToPO?: (poId: string) => void
  /** Opens this house's detail once the house list is available (Job Accounts → "Open house"). */
  autoOpenHouseId?: string | null
  onAutoOpenHouseHandled?: () => void
}

export function SupplyHousesTab({
  supplyHouses: supplyHousesProp,
  onSupplyHousesChange,
  myRole: myRoleProp,
  showTitle = false,
  selectedServiceTypeId: selectedServiceTypeIdProp,
  onNavigateToPO,
  autoOpenHouseId,
  onAutoOpenHouseHandled,
}: SupplyHousesTabProps) {
  const navigate = useNavigate()
  const { user: authUser, role: authRole } = useAuth()
  const confirmDialog = useConfirmDialog()
  const myRole = myRoleProp ?? (authRole as UserRole | null) ?? null

  const [supplyHousesInternal, setSupplyHousesState] = useState<SupplyHouse[]>(supplyHousesProp ?? [])
  const supplyHousesList = supplyHousesProp ?? supplyHousesInternal

  const [error, setError] = useState<string | null>(null)
  /** Bumped after every house save so the Directory pane refetches reps and request history. */
  const [directoryReloadKey, setDirectoryReloadKey] = useState(0)

  const [supplyHouseSummary, setSupplyHouseSummary] = useState<SupplyHouseSummaryRow[]>([])
  const [supplyHouseSummaryLoading, setSupplyHouseSummaryLoading] = useState(false)
  const [agingUnpaidInvoices, setAgingUnpaidInvoices] = useState<
    Array<{ supply_house_id: string; amount: number; due_date: string | null }>
  >([])
  const [selectedSupplyHouseForDetail, setSelectedSupplyHouseForDetail] = useState<SupplyHouse | null>(null)
  const [supplyHouseInvoices, setSupplyHouseInvoices] = useState<SupplyHouseInvoiceWithAllocations[]>([])
  const [supplyHousePOs, setSupplyHousePOs] = useState<PurchaseOrderWithItems[]>([])
  /** Ledger po_code values visible for this supply house (rows for this house + rows with no supply house); null if fetch failed (no warning icons). */
  const [poGeneratorCodesForSelectedHouse, setPoGeneratorCodesForSelectedHouse] = useState<Set<number> | null>(null)
  const [supplyHouseDetailLoading, setSupplyHouseDetailLoading] = useState(false)
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<SupplyHouseInvoice | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  /** What the paper is (v2.3503). The amount box stays positive; this is what decides the sign. */
  const [invoiceDocumentKind, setInvoiceDocumentKind] = useState<SupplyDocumentKind>('invoice')
  const [invoicePurchaseOrderNumber, setInvoicePurchaseOrderNumber] = useState('')
  const [invoiceLink, setInvoiceLink] = useState('')
  const [invoiceIsPaid, setInvoiceIsPaid] = useState(false)
  /** "Paid on" calendar day (company tz); '' lets the DB trigger stamp now() when the invoice flips to paid. */
  const [invoicePaidOn, setInvoicePaidOn] = useState('')
  const [invoiceOnJobAccount, setInvoiceOnJobAccount] = useState(false)
  const [invoiceJobAllocations, setInvoiceJobAllocations] = useState<InvoiceJobAllocation[]>([])
  /** Inline job search inside the form (v2.3474) — replaces the stacked "Add job for invoice" modal. */
  const [invoiceJobSearchText, setInvoiceJobSearchText] = useState('')
  const [invoiceJobSearchResults, setInvoiceJobSearchResults] = useState<Array<{ id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string; service_type_id?: string | null; service_type_name?: string | null }>>([])
  const invoiceJobPrefixMap = useLedgerPrefixMap()
  const invoiceJobResultsUnified = useMemo(
    () => invoiceJobSearchResults.map((j) => ({ source: 'job' as const, ...j })),
    [invoiceJobSearchResults],
  )
  const { jobEvidence: invoiceJobEvidence, evidenceMode: invoiceJobEvidenceMode } =
    useJobBidSearchEvidence(invoiceJobResultsUnified)
  /** Job accounts are per property — the flag applies only when the invoice is allocated to exactly one job. */
  const invoiceSingleAllocatedJobId =
    invoiceJobAllocations.length === 1 ? (invoiceJobAllocations[0]?.job_id ?? null) : null
  /**
   * v2.3430: the job's account at THIS house (job_supply_house_accounts), keyed so we
   * fetch once per (job, house). Open → the flag defaults on for a new invoice; else a
   * nudge with Mark opened. Replaces the v2.2669 share-packet cross-check.
   */
  const [invoiceJobAccount, setInvoiceJobAccount] = useState<JobSupplyHouseAccountRow | null>(null)
  const [invoiceJobAccountKey, setInvoiceJobAccountKey] = useState<string | null>(null)
  const [invoiceJobAccountReps, setInvoiceJobAccountReps] = useState<Array<{ id: string; name: string | null; email: string; phone: string | null }>>([])
  const [invoiceMarkOpenedOpen, setInvoiceMarkOpenedOpen] = useState(false)
  /** The user touched the checkbox this session — stop defaulting it. */
  const invoiceOnJobAccountTouchedRef = useRef(false)
  useEffect(() => {
    const houseId = selectedSupplyHouseForDetail?.id ?? null
    if (!invoiceFormOpen || !invoiceSingleAllocatedJobId || !houseId) {
      setInvoiceJobAccount(null)
      setInvoiceJobAccountKey(null)
      return
    }
    const key = `${invoiceSingleAllocatedJobId}:${houseId}`
    if (invoiceJobAccountKey === key) return
    let cancelled = false
    void (async () => {
      const [accRes, repRes] = await Promise.all([
        supabase
          .from('job_supply_house_accounts')
          .select('id, job_id, supply_house_id, status, account_ref, opened_via, rep_contact_id, requested_by, requested_at, requested_from_counter, opened_by, opened_at, note')
          .eq('job_id', invoiceSingleAllocatedJobId)
          .eq('supply_house_id', houseId)
          .maybeSingle(),
        supabase
          .from('supply_house_contacts')
          .select('id, name, email, phone')
          .eq('supply_house_id', houseId)
          .eq('role', 'job_accounts')
          .is('archived_at', null),
      ])
      if (cancelled) return
      const row = accRes.error ? null : ((accRes.data as JobSupplyHouseAccountRow | null) ?? null)
      setInvoiceJobAccount(row)
      setInvoiceJobAccountReps(repRes.error ? [] : ((repRes.data ?? []) as Array<{ id: string; name: string | null; email: string; phone: string | null }>))
      setInvoiceJobAccountKey(key)
      // The default: a new invoice on a job with an open account here is on the account.
      if (!editingInvoice && !invoiceOnJobAccountTouchedRef.current && row?.status === 'open') setInvoiceOnJobAccount(true)
    })()
    return () => {
      cancelled = true
    }
  }, [invoiceFormOpen, invoiceSingleAllocatedJobId, invoiceJobAccountKey, selectedSupplyHouseForDetail?.id, editingInvoice])
  const [invoiceJobDetailsMap, setInvoiceJobDetailsMap] = useState<Record<string, { hcp_number: string; click_number?: string; job_name: string; job_address: string }>>({})
  const [supplyHouseJobDetailsMap, setSupplyHouseJobDetailsMap] = useState<Record<string, { hcp_number: string; click_number?: string; job_name: string }>>({})
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [applyPaymentFormOpen, setApplyPaymentFormOpen] = useState(false)
  const [applyPaymentLink, setApplyPaymentLink] = useState('')
  const [applyPaymentSelectedIds, setApplyPaymentSelectedIds] = useState<Set<string>>(new Set())
  const [applyPaymentShowAll, setApplyPaymentShowAll] = useState(false)
  const [savingApplyPayment, setSavingApplyPayment] = useState(false)
  const [creatingPOForSupplyHouse, setCreatingPOForSupplyHouse] = useState(false)
  const [firstServiceTypeId, setFirstServiceTypeId] = useState<string | null>(null)
  const [showPaidInvoices, setShowPaidInvoices] = useState(false)
  const [showLastPayment, setShowLastPayment] = useState(false)

  const serviceTypeId = selectedServiceTypeIdProp ?? firstServiceTypeId

  async function loadSupplyHousesInternal() {
    const { data, error: err } = await supabase.from('supply_houses').select('*').order('name')
    if (err) {
      const fallback = await supabase.from('supply_houses').select('id, name, phone, address, notes, website_url, created_at, updated_at').order('name')
      if (fallback.error) setError(`Failed to load supply houses: ${err.message}`)
      else setSupplyHousesState((fallback.data ?? []).map((h) => ({ ...h, monthly_payment_day: null })) as SupplyHouse[])
    } else {
      setSupplyHousesState((data as SupplyHouse[]) ?? [])
    }
  }

  async function loadSupplyHouses() {
    if (supplyHousesProp) {
      await onSupplyHousesChange?.()
    } else {
      await loadSupplyHousesInternal()
    }
  }

  async function loadFirstServiceType() {
    const { data } = await supabase.from('service_types').select('id').order('sequence_order', { ascending: true }).limit(1)
    const first = (data as { id: string }[] | null)?.[0]
    setFirstServiceTypeId(first?.id ?? null)
  }

  function formatOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'] as const
    const v = n % 100
    const ord = v >= 11 && v <= 13 ? 'th' : (s[v % 10] ?? 'th')
    return n + ord
  }

  async function loadSupplyHouseSummary() {
    setSupplyHouseSummaryLoading(true)
    let housesList: { id: string; name: string; monthly_payment_day: number | null }[]
    const housesRes = await supabase.from('supply_houses').select('id, name, monthly_payment_day').order('name')
    if (housesRes.error) {
      const fallbackRes = await supabase.from('supply_houses').select('id, name').order('name')
      const fallback = (fallbackRes.data ?? []) as { id: string; name: string }[]
      housesList = fallback.map((h) => ({ ...h, monthly_payment_day: null }))
    } else {
      housesList = (housesRes.data ?? []) as { id: string; name: string; monthly_payment_day: number | null }[]
    }
    const { data: invoices } = await supabase
      .from('supply_house_invoices')
      .select('supply_house_id, amount, is_paid, updated_at, paid_at, due_date')
    const invoicesList = (invoices ?? []) as { supply_house_id: string; amount: number; is_paid: boolean; updated_at: string | null; paid_at: string | null; due_date: string | null }[]
    setAgingUnpaidInvoices(
      invoicesList
        .filter((inv) => !inv.is_paid)
        .map((inv) => ({ supply_house_id: inv.supply_house_id, amount: inv.amount, due_date: inv.due_date })),
    )
    const byHouse = new Map<string, number>()
    const maxUpdatedByHouse = new Map<string, string>()
    const maxPaidByHouse = new Map<string, string>()
    for (const h of housesList) byHouse.set(h.id, 0)
    for (const inv of invoicesList) {
      if (!inv.is_paid) {
        const cur = byHouse.get(inv.supply_house_id)
        if (cur !== undefined) byHouse.set(inv.supply_house_id, cur + inv.amount)
      }
      // Track most recent invoice update per supply house across paid + unpaid;
      // ISO 8601 timestamps sort lexicographically so string comparison is safe.
      if (inv.updated_at) {
        const prev = maxUpdatedByHouse.get(inv.supply_house_id)
        if (!prev || inv.updated_at > prev) maxUpdatedByHouse.set(inv.supply_house_id, inv.updated_at)
      }
      if (inv.is_paid && inv.paid_at) {
        const prev = maxPaidByHouse.get(inv.supply_house_id)
        if (!prev || inv.paid_at > prev) maxPaidByHouse.set(inv.supply_house_id, inv.paid_at)
      }
    }
    const rows: SupplyHouseSummaryRow[] = housesList.map((h) => ({
      supply_house_id: h.id,
      name: h.name,
      outstanding: byHouse.get(h.id) ?? 0,
      monthlyPaymentDay: h.monthly_payment_day,
      lastInvoiceUpdatedAt: maxUpdatedByHouse.get(h.id) ?? null,
      lastInvoicePaidAt: maxPaidByHouse.get(h.id) ?? null,
    }))
    rows.sort((a, b) => b.outstanding - a.outstanding)
    setSupplyHouseSummary(rows)
    setSupplyHouseSummaryLoading(false)
  }

  async function loadSupplyHouseDetail(sh: SupplyHouse) {
    setSupplyHouseDetailLoading(true)
    setPoGeneratorCodesForSelectedHouse(null)
    const shRes = await supabase.from('supply_houses').select('*').eq('id', sh.id).single()
    const shData = shRes.error
      ? (await supabase.from('supply_houses').select('id, name, phone, address, notes, website_url, created_at, updated_at').eq('id', sh.id).single()).data
      : shRes.data
    setSelectedSupplyHouseForDetail((shData as SupplyHouse) ?? sh)
    const [invRes, poRes, allocRes, genRes] = await Promise.all([
      supabase.from('supply_house_invoices').select('*').eq('supply_house_id', sh.id).order('invoice_date', { ascending: false }),
      supabase.from('purchase_orders').select('*').eq('supply_house_id', sh.id).order('created_at', { ascending: false }),
      supabase.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct'),
      supabase
        .from('material_po_generator_entries')
        .select('po_code')
        .or(`supply_house_id.eq.${sh.id},supply_house_id.is.null`),
    ])
    const invoices = (invRes.data as SupplyHouseInvoice[]) ?? []
    const allocations = (allocRes.data as { invoice_id: string; job_id: string; pct: number }[]) ?? []
    const byInvoice = new Map<string, InvoiceJobAllocation[]>()
    for (const a of allocations) {
      const list = byInvoice.get(a.invoice_id) ?? []
      list.push({ job_id: a.job_id, pct: Number(a.pct) })
      byInvoice.set(a.invoice_id, list)
    }
    const invoicesWithAllocations: SupplyHouseInvoiceWithAllocations[] = invoices.map((inv) => ({
      ...inv,
      job_allocations: byInvoice.get(inv.id) ?? [],
    }))
    setSupplyHouseInvoices(invoicesWithAllocations)
    const jobIds = [...new Set(allocations.map((a) => a.job_id))]
    if (jobIds.length > 0) {
      supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }).then(({ data }) => {
        const map: Record<string, { hcp_number: string; click_number?: string; job_name: string }> = {}
        for (const r of (data ?? []) as { id: string; hcp_number: string; click_number: string; job_name: string }[]) {
          map[r.id] = { hcp_number: r.hcp_number ?? '', click_number: r.click_number ?? '', job_name: r.job_name ?? '' }
        }
        setSupplyHouseJobDetailsMap(map)
      })
    } else {
      setSupplyHouseJobDetailsMap({})
    }
    const pos = (poRes.data as PurchaseOrder[]) ?? []
    const posWithItems: PurchaseOrderWithItems[] = await Promise.all(
      pos.map(async (po) => {
        const { data: itemsData } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', po.id)
          .order('sequence_order', { ascending: true })
        const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map((item) => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses ?? undefined,
          source_template: item.source_template ?? null,
        }))
        return { ...po, items: itemsWithDetails }
      })
    )
    setSupplyHousePOs(posWithItems)
    if (genRes.error) {
      setPoGeneratorCodesForSelectedHouse(null)
    } else {
      const genRows = (genRes.data ?? []) as { po_code: number }[]
      setPoGeneratorCodesForSelectedHouse(new Set(genRows.map((r) => Number(r.po_code))))
    }
    setSupplyHouseDetailLoading(false)
  }

  useEffect(() => {
    if (!selectedServiceTypeIdProp) loadFirstServiceType()
  }, [selectedServiceTypeIdProp])

  useEffect(() => {
    loadSupplyHouseSummary()
    if (!supplyHousesProp) loadSupplyHousesInternal()
  }, [])

  useEffect(() => {
    if (supplyHousesProp) setSupplyHousesState(supplyHousesProp)
  }, [supplyHousesProp])

  // Job Accounts → "Open house": open the requested house's detail once the list has it.
  useEffect(() => {
    if (!autoOpenHouseId) return
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === autoOpenHouseId)
    if (!sh) return
    void loadSupplyHouseDetail(sh)
    onAutoOpenHouseHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenHouseId, supplyHousesList])

  useEffect(() => {
    if (!invoiceFormOpen || !invoiceJobSearchText.trim()) {
      setInvoiceJobSearchResults([])
      return
    }
    const t = setTimeout(() => {
      supabase.rpc('search_jobs_ledger', { search_text: invoiceJobSearchText }).then(({ data }) => {
        setInvoiceJobSearchResults((data ?? []) as Array<{ id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string }>)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [invoiceFormOpen, invoiceJobSearchText])

  useEffect(() => {
    const jobIds = invoiceJobAllocations.map((a) => a.job_id).filter((id) => !invoiceJobDetailsMap[id])
    if (jobIds.length === 0) return
    supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }).then(({ data }) => {
      const map: Record<string, { hcp_number: string; click_number?: string; job_name: string; job_address: string }> = {}
      for (const r of (data ?? []) as { id: string; hcp_number: string; click_number: string; job_name: string; job_address: string }[]) {
        map[r.id] = { hcp_number: r.hcp_number ?? '', click_number: r.click_number ?? '', job_name: r.job_name ?? '', job_address: r.job_address ?? '' }
      }
      setInvoiceJobDetailsMap((prev) => ({ ...prev, ...map }))
    })
  }, [invoiceJobAllocations, invoiceJobDetailsMap])

  const canAccess = myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)
  const agingTodayYmd = todayYmdInAppTz()
  const agingMatrix = buildSupplyHouseAgingMatrix(
    supplyHouseSummary.map((r) => ({ id: r.supply_house_id, name: r.name })),
    agingUnpaidInvoices,
    agingTodayYmd,
  )
  // The credits column only appears once a credit memo exists (v2.3500), so a book with none
  // reads exactly as it did before.
  const agingHasCredits = agingMatrix.creditsTotal < -0.005
  // Every label that names the document follows the kind (v2.3503).
  const invoiceWords = documentWords(invoiceDocumentKind)
  const invoiceCreditJobLabel = (() => {
    const only = invoiceJobAllocations.length === 1 ? invoiceJobAllocations[0] : null
    if (!only) return null
    const d = invoiceJobDetailsMap[only.job_id]
    return d ? formatJobLedgerNumberLabel(DEFAULT_JOB_LEDGER_PREFIX, d.hcp_number, d.click_number) : null
  })()
  const creditEffect = creditEffectSentence({
    amountTyped: invoiceAmount,
    houseName: selectedSupplyHouseForDetail?.name ?? '',
    jobLabel: invoiceCreditJobLabel,
  })
  // Phone layout + the Quickfill "N open" metric (v2.2191). Hooks live above the
  // access gate (rules-of-hooks); the metric no-ops outside the Quickfill
  // provider (this tab also lives on /materials).
  const narrowAging = useNarrowViewport640()
  // The invoice form is taller than a phone screen — freeze the page behind it so the panel is the only scroller.
  useBodyScrollLock(invoiceFormOpen)
  const housesPastDue60 = countSupplyHousesPastDue60(agingMatrix)
  const houseEditor = useSupplyHouseEditor({
    myRole,
    onSaved: async ({ kind, houseId }) => {
      await Promise.all([loadSupplyHouses(), loadSupplyHouseSummary()])
      setDirectoryReloadKey((k) => k + 1)
      if (kind === 'deleted' && selectedSupplyHouseForDetail?.id === houseId) {
        setSelectedSupplyHouseForDetail(null)
        setPoGeneratorCodesForSelectedHouse(null)
      } else if (kind === 'updated' && selectedSupplyHouseForDetail?.id === houseId) {
        await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      }
    },
  })

  useReportQuickfillSectionMetric(
    'supply-houses',
    !canAccess || supplyHouseSummaryLoading ? null : housesPastDue60,
    canAccess && supplyHouseSummaryLoading,
  )

  if (!canAccess) return null

  function handleNavigateToPO(poId: string) {
    if (onNavigateToPO) {
      onNavigateToPO(poId)
    } else {
      navigate('/materials', { state: { openPOId: poId } })
    }
  }

  async function createBlankPOForSupplyHouse(supplyHouseId: string) {
    if (!authUser?.id || !serviceTypeId) return
    setCreatingPOForSupplyHouse(true)
    setError(null)
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === supplyHouseId)
    const currentDate = new Date().toLocaleDateString()
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        name: `PO: ${sh?.name ?? 'Supply House'} [${currentDate}]`,
        status: 'draft',
        created_by: authUser.id,
        notes: null,
        service_type_id: serviceTypeId,
        supply_house_id: supplyHouseId,
      })
      .select('id')
      .single()
    setCreatingPOForSupplyHouse(false)
    if (poError) {
      setError(`Failed to create PO: ${poError.message}`)
      return
    }
    await loadSupplyHouseDetail(sh!)
    if (poData?.id) handleNavigateToPO(poData.id)
  }

  function openAddInvoice() {
    invoiceOnJobAccountTouchedRef.current = false
    setInvoiceJobAccountKey(null)
    setEditingInvoice(null)
    setInvoiceNumber('')
    const todayYmd = todayYmdInAppTz()
    setInvoiceDate(todayYmd)
    // Prefill from the house's monthly payment day (next occurrence) — editable, just a default.
    const paymentDay = selectedSupplyHouseForDetail?.monthly_payment_day
    setInvoiceDueDate(paymentDay ? nextMonthlyPaymentDueYmd(paymentDay, todayYmd) : '')
    setInvoiceAmount('')
    setInvoiceDocumentKind('invoice')
    setInvoiceLink('')
    setInvoiceIsPaid(false)
    setInvoicePaidOn('')
    setInvoiceOnJobAccount(false)
    setInvoicePurchaseOrderNumber('')
    setInvoiceJobAllocations([])
    setInvoiceJobSearchText('')
    setInvoiceFormOpen(true)
  }

  function openEditInvoice(inv: SupplyHouseInvoice | SupplyHouseInvoiceWithAllocations) {
    invoiceOnJobAccountTouchedRef.current = true
    setInvoiceJobAccountKey(null)
    setEditingInvoice(inv)
    setInvoiceNumber(inv.invoice_number)
    setInvoiceDate(inv.invoice_date)
    setInvoiceDueDate(inv.due_date ?? '')
    setInvoiceAmount(typedAmountFromStored(inv.amount))
    setInvoiceDocumentKind(documentKindFromRow(inv))
    setInvoiceLink(inv.link ?? '')
    setInvoiceIsPaid(inv.is_paid)
    setInvoicePaidOn(inv.is_paid ? paidOnYmdFromIso(inv.paid_at) : '')
    // === true: pre-migration rows fetched before the column existed read as undefined.
    setInvoiceOnJobAccount(inv.on_job_account === true)
    setInvoicePurchaseOrderNumber(inv.purchase_order_number ?? '')
    setInvoiceJobAllocations((inv as SupplyHouseInvoiceWithAllocations).job_allocations ?? [])
    setInvoiceJobSearchText('')
    setInvoiceFormOpen(true)
  }

  function closeInvoiceForm() {
    setInvoiceFormOpen(false)
    setEditingInvoice(null)
    setInvoiceJobSearchText('')
  }

  function openApplyPaymentForm() {
    setApplyPaymentLink('')
    setApplyPaymentSelectedIds(new Set())
    setApplyPaymentShowAll(false)
    setApplyPaymentFormOpen(true)
  }

  function closeApplyPaymentForm() {
    setApplyPaymentFormOpen(false)
    setApplyPaymentLink('')
    setApplyPaymentSelectedIds(new Set())
    setApplyPaymentShowAll(false)
  }

  async function applyPayment(e: React.FormEvent) {
    e.preventDefault()
    const ids = Array.from(applyPaymentSelectedIds)
    if (ids.length === 0) return
    setSavingApplyPayment(true)
    const linkValue = applyPaymentLink.trim() || null
    const { error } = await supabase
      .from('supply_house_invoices')
      .update({ is_paid: true, link: linkValue })
      .in('id', ids)
    if (!error && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
      closeApplyPaymentForm()
    }
    setSavingApplyPayment(false)
  }

  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplyHouseForDetail || !invoiceNumber.trim() || !invoiceDate) return
    // v2.3503: the box holds a positive number and the KIND decides the sign, so a slipped minus
    // key cannot invent a credit and a missing one cannot lose a real credit.
    const problem = amountProblem(invoiceDocumentKind, invoiceAmount)
    if (problem) {
      setError(problem)
      return
    }
    const amt = signedAmountForSave(invoiceDocumentKind, invoiceAmount)
    if (amt == null) {
      setError('Amount must be a number.')
      return
    }
    setSavingInvoice(true)
    setError(null)
    // Per-property flag: forced off unless the invoice is allocated to exactly one job.
    const effectiveOnJobAccount = invoiceOnJobAccount && invoiceSingleAllocatedJobId != null
    const priorOnJobAccount = editingInvoice ? editingInvoice.on_job_account === true : false
    const payload = {
      supply_house_id: selectedSupplyHouseForDetail.id,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      due_date: invoiceDueDate.trim() || null,
      amount: amt,
      document_kind: invoiceDocumentKind,
      link: invoiceLink.trim() || null,
      is_paid: invoiceIsPaid,
      // Only when the office typed a day that differs from what's stored — the trigger
      // stamps now() on the flip to paid and nulls it on the flip back.
      ...paidAtPayload(invoiceIsPaid, invoicePaidOn, editingInvoice?.paid_at),
      purchase_order_number: invoicePurchaseOrderNumber.trim() || null,
      // Sent only when it changes, so untouched saves keep working in the
      // merge-to-db-push window before the column exists in prod.
      ...(effectiveOnJobAccount !== priorOnJobAccount ? { on_job_account: effectiveOnJobAccount } : {}),
    }
    let invoiceId: string | null = null
    if (editingInvoice) {
      const { error: err } = await supabase.from('supply_house_invoices').update(payload).eq('id', editingInvoice.id)
      if (err) {
        setError(err.message)
        setSavingInvoice(false)
        return
      }
      invoiceId = editingInvoice.id
    } else {
      const { data: inserted, error: err } = await supabase.from('supply_house_invoices').insert(payload).select('id').single()
      if (err) {
        setError(err.message)
        setSavingInvoice(false)
        return
      }
      invoiceId = (inserted as { id: string })?.id ?? null
    }
    if (invoiceId && invoiceJobAllocations.length > 0) {
      await supabase.from('supply_house_invoice_job_allocations').delete().eq('invoice_id', invoiceId)
      const toInsert = invoiceJobAllocations.filter((a) => a.job_id && Number(a.pct) > 0).map((a) => ({
        invoice_id: invoiceId!,
        job_id: a.job_id,
        pct: Number(a.pct),
      }))
      if (toInsert.length > 0) {
        const { error: allocErr } = await supabase.from('supply_house_invoice_job_allocations').insert(toInsert)
        if (allocErr) setError(allocErr.message)
      }
    } else if (invoiceId && editingInvoice) {
      await supabase.from('supply_house_invoice_job_allocations').delete().eq('invoice_id', invoiceId)
    }
    if (selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
      closeInvoiceForm()
    }
    setSavingInvoice(false)
  }

  async function toggleInvoicePaid(inv: SupplyHouseInvoice) {
    const { error } = await supabase
      .from('supply_house_invoices')
      .update({ is_paid: !inv.is_paid })
      .eq('id', inv.id)
    if (!error && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
    }
  }

  async function deleteInvoice(inv: SupplyHouseInvoice) {
    if (!(await confirmDialog({ message: 'Delete this invoice?', confirmLabel: 'Delete', danger: true }))) return
    const { error } = await supabase.from('supply_house_invoices').delete().eq('id', inv.id)
    if (!error && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
      closeInvoiceForm()
    }
  }


  function openHouseFromAging(supplyHouseId: string) {
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === supplyHouseId)
    if (!sh) return
    loadSupplyHouseDetail(sh)
  }

  return (
    <div>
      {showTitle && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            marginBottom: '0.75rem',
            gap: '0.5rem',
          }}
        >
          <span aria-hidden="true" style={{ minWidth: 0 }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, justifySelf: 'center' }}>
            Supply Houses
          </h2>
        </div>
      )}
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      {houseEditor.error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{houseEditor.error}</p>}

      {/* Pane 1 — the Directory: the same component the estimator's tab renders alone (to-dos/supply-house-directory). */}
      <section style={{ marginBottom: '2.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Directory</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>houses, reps and websites</span>
        </div>
        <SupplyHouseDirectory
          supplyHouses={supplyHousesList}
          audience="office"
          onAddHouse={houseEditor.openAdd}
          onEditHouse={houseEditor.openEdit}
          reloadKey={directoryReloadKey}
        />
      </section>

      {/* Pane 2 — accounts payable: invoices, aging, balances. Office only; unchanged by the Directory split. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Accounts payable</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>invoices, aging and balances — office only</span>
      </div>
      <section style={{ marginBottom: '2rem' }}>
        {supplyHouseSummaryLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'start', marginBottom: '0.75rem' }}>
              <span aria-hidden="true" />
              <div style={{ fontSize: '1rem', fontWeight: 600, textAlign: 'center', alignSelf: 'center' }}>
                Supply Houses: ${formatCurrency(supplyHouseSummary.reduce((sum, row) => sum + row.outstanding, 0))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', justifySelf: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={showPaidInvoices}
                    onChange={(e) => setShowPaidInvoices(e.target.checked)}
                  />
                  Show paid invoices
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={showLastPayment}
                    onChange={(e) => setShowLastPayment(e.target.checked)}
                  />
                  Show last payment
                </label>
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Unpaid dollars by days past due (from invoice due dates).
                  {housesPastDue60 > 0 ? ` ${housesPastDue60} house${housesPastDue60 === 1 ? '' : 's'} 60+ past due.` : ''}
                  {agingMatrix.missingDueDateCount > 0
                    ? ` ${agingMatrix.missingDueDateCount} unpaid invoice${agingMatrix.missingDueDateCount === 1 ? ' has' : 's have'} no due date — open the house and add one to place ${agingMatrix.missingDueDateCount === 1 ? 'it' : 'them'}.`
                    : ''}
                </p>
{narrowAging ? (
                  /* Phone (v2.2191): one row per house — name · worst-news note · 5-bucket bar · total.
                     The bar's five colors are the table's five aging columns, worst on the right. */
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {agingMatrix.rows.length === 0 ? (
                      <p style={{ margin: 0, padding: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>No unpaid invoices.</p>
                    ) : (
                      agingMatrix.rows.map((row, i) => {
                        const segs = [
                          { v: row.buckets.current, c: '#86efac' },
                          { v: row.buckets.past1_30, c: '#fde68a' },
                          { v: row.buckets.past30_60, c: '#fdba74' },
                          { v: row.buckets.past60_90, c: '#fca5a5' },
                          { v: row.buckets.past90plus, c: '#ef4444' },
                          { v: row.buckets.noDueDate, c: '#9ca3af' },
                        ].filter((x) => x.v > 0.005)
                        return (
                          <button
                            key={row.supplyHouseId}
                            type="button"
                            onClick={() => openHouseFromAging(row.supplyHouseId)}
                            title="Open this supply house"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.55rem 0.75rem',
                              background: 'none',
                              border: 'none',
                              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                              cursor: 'pointer',
                              font: 'inherit',
                              color: 'inherit',
                            }}
                          >
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', overflowWrap: 'anywhere' }}>{row.name}</span>
                              <span style={{ display: 'block', fontSize: '0.72rem', color: row.buckets.past90plus > 0.005 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                                {supplyHouseAgingPhoneNote(row)}
                              </span>
                            </span>
                            <span aria-hidden style={{ display: 'flex', width: 96, height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-subtle)', flexShrink: 0 }}>
                              {segs.map((x, j) => (
                                // v2.3500: `row.total` is owed-only and can be 0 on a house listed for its credits.
                                <span key={j} style={{ display: 'block', height: '100%', width: `${row.total > 0.005 ? Math.max(3, (x.v / row.total) * 100) : 0}%`, background: x.c }} />
                              ))}
                            </span>
                            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>${formatCurrency(row.total)}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Supply House</th>
                      {AGING_BUCKETS.map((b) => (
                        <th
                          key={b.key}
                          title={b.key === 'current' ? 'Not yet due' : b.key === 'noDueDate' ? 'Unpaid, no due date recorded' : `${b.label} days past due`}
                          style={{ padding: '0.6rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}
                        >
                          {b.label}
                        </th>
                      ))}
                      {agingHasCredits ? (
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Credits open</th>
                      ) : null}
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>{agingHasCredits ? 'Owed' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agingMatrix.rows.length === 0 ? (
                      <tr>
                        <td colSpan={AGING_BUCKETS.length + (agingHasCredits ? 3 : 2)} style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          No unpaid invoices.
                        </td>
                      </tr>
                    ) : (
                      agingMatrix.rows.map((row) => (
                        <tr
                          key={row.supplyHouseId}
                          onClick={() => openHouseFromAging(row.supplyHouseId)}
                          title="Open this supply house"
                          style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        >
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{row.name}</td>
                          {AGING_BUCKETS.map((b) => {
                            const amount = row.buckets[b.key]
                            const has = amount > 0.005
                            return (
                              <td
                                key={b.key}
                                style={{
                                  padding: '0.6rem 0.75rem',
                                  textAlign: 'right',
                                  fontVariantNumeric: 'tabular-nums',
                                  whiteSpace: 'nowrap',
                                  ...(has ? AGING_CELL_STYLES[b.key] : { color: 'var(--text-faint-300)' }),
                                }}
                              >
                                {has ? `$${formatCurrency(amount)}` : '—'}
                              </td>
                            )
                          })}
                          {agingHasCredits ? (
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(row.creditsOpen < -0.005 ? { color: 'var(--text-green-700)' } : { color: 'var(--text-faint-300)' }) }}>
                              {row.creditsOpen < -0.005 ? `−$${formatCurrency(Math.abs(row.creditsOpen))}` : '—'}
                            </td>
                          ) : null}
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            ${formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>Total</td>
                      {AGING_BUCKETS.map((b) => {
                        const amount = agingMatrix.totals[b.key]
                        const has = amount > 0.005
                        return (
                          <td key={b.key} style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: has ? undefined : 'var(--text-faint-300)' }}>
                            {has ? `$${formatCurrency(amount)}` : '—'}
                          </td>
                        )
                      })}
                      {agingHasCredits ? (
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-green-700)' }}>
                          −${formatCurrency(Math.abs(agingMatrix.creditsTotal))}
                        </td>
                      ) : null}
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        ${formatCurrency(agingMatrix.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Supply House</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Outstanding</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Due</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Updated</th>
                  {showLastPayment && (
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Last Paid</th>
                  )}
                  <th style={{ padding: '0.75rem', textAlign: 'right', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {supplyHouseSummary.map((row) => {
                  const sh = supplyHousesList.find((s: SupplyHouse) => s.id === row.supply_house_id)
                  const isExpanded = selectedSupplyHouseForDetail?.id === row.supply_house_id
                  return (
                    <Fragment key={row.supply_house_id}>
                      <tr
                        onClick={() => {
                          if (!sh) return
                          if (isExpanded) {
                            setSelectedSupplyHouseForDetail(null)
                            setPoGeneratorCodesForSelectedHouse(null)
                          } else loadSupplyHouseDetail(sh)
                        }}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: isExpanded ? '#f0f9ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: row.outstanding > 0 ? 600 : 400 }}>
                          ${formatCurrency(row.outstanding)}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                          {row.monthlyPaymentDay ? formatOrdinal(row.monthlyPaymentDay) : '—'}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {row.lastInvoiceUpdatedAt ? longTimeAgoPhrase(row.lastInvoiceUpdatedAt) : '—'}
                        </td>
                        {showLastPayment && (
                          <td
                            style={{ padding: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                            title={row.lastInvoicePaidAt ?? undefined}
                          >
                            {row.lastInvoicePaidAt ? longTimeAgoPhrase(row.lastInvoicePaidAt) : '—'}
                          </td>
                        )}
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {isExpanded && selectedSupplyHouseForDetail && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                houseEditor.openEdit(selectedSupplyHouseForDetail)
                              }}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && selectedSupplyHouseForDetail && (
                        <tr>
                          <td colSpan={showLastPayment ? 6 : 5} style={{ padding: 0, verticalAlign: 'top', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-subtle)', borderLeft: '3px solid #3b82f6' }}>
                              {supplyHouseDetailLoading ? (
                                <p>Loading…</p>
                              ) : (
                                <>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                    {selectedSupplyHouseForDetail.address && (
                                      <div><strong>Address:</strong> {selectedSupplyHouseForDetail.address}</div>
                                    )}
                                    {(selectedSupplyHouseForDetail.phone || selectedSupplyHouseForDetail.website_url?.trim()) && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                                        {selectedSupplyHouseForDetail.phone && (
                                          <span><strong>Phone:</strong> {selectedSupplyHouseForDetail.phone}</span>
                                        )}
                                        <SupplyHouseWebsiteLink websiteUrl={selectedSupplyHouseForDetail.website_url} />
                                      </div>
                                    )}
                                  </div>
                                  <SupplyHouseJobAccountsRoster
                                    house={selectedSupplyHouseForDetail}
                                    invoices={supplyHouseInvoices}
                                    jobDetails={supplyHouseJobDetailsMap}
                                  />
                                  <section style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                      <h3 style={{ margin: 0, fontSize: '1rem' }}>Invoices</h3>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openAddInvoice() }}
                                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          Add Invoice
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openApplyPaymentForm() }}
                                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          Make Payment
                                        </button>
                                      </div>
                                    </div>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                                      A red icon appears when Purchase Order # contains a PO Generator code (five digits, 10000–99999) that is not on the
                                      PO Generator ledger for this supply house or with no supply house on the ledger row. Shop-style refs like 40326-1
                                      are not treated as generator codes. Empty or other text is not flagged.
                                    </p>
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead style={{ background: 'var(--bg-subtle)' }}>
                                          <tr>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Invoice #</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Purchase Order #</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Date</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Due</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Amount</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Jobs</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Paid</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Paid On</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Link</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(() => {
                                            const invoicesToShow = showPaidInvoices
                                              ? supplyHouseInvoices
                                              : supplyHouseInvoices.filter((inv) => !inv.is_paid)
                                            return invoicesToShow.length === 0 ? (
                                              <tr><td colSpan={10} style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>No invoices</td></tr>
                                            ) : (
                                              invoicesToShow.map((inv) => {
                                                const poGenCode = parsePoGeneratorCodeFromPurchaseOrderName(inv.purchase_order_number ?? '')
                                                const showPoGenMismatch =
                                                  poGenCode != null &&
                                                  poGeneratorCodesForSelectedHouse != null &&
                                                  !poGeneratorCodesForSelectedHouse.has(poGenCode)
                                                return (
                                              <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{inv.invoice_number}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <span>{inv.purchase_order_number?.trim() ? inv.purchase_order_number : '—'}</span>
                                                    {showPoGenMismatch ? (
                                                      <span title="No PO Generator ledger entry for this number for this supply house.">
                                                        <AlertCircle
                                                          size={16}
                                                          color="#dc2626"
                                                          aria-label="No PO Generator ledger entry for this number for this supply house."
                                                          style={{ flexShrink: 0, display: 'block' }}
                                                        />
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{formatYmdLocal(inv.invoice_date)}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                                                  {inv.due_date ? formatYmdLocal(inv.due_date) : '—'}
                                                  {(() => {
                                                    if (inv.is_paid || !inv.due_date) return null
                                                    const days = daysPastDue(inv.due_date, todayYmdInAppTz())
                                                    if (days <= 0) return null
                                                    return (
                                                      <span
                                                        style={{
                                                          marginLeft: '0.4rem',
                                                          padding: '0.1rem 0.4rem',
                                                          borderRadius: 999,
                                                          fontSize: '0.7rem',
                                                          fontWeight: 600,
                                                          background: days >= 60 ? 'var(--bg-red-100)' : 'var(--bg-orange-100)',
                                                          color: days >= 60 ? 'var(--text-red-800)' : 'var(--text-orange-800)',
                                                        }}
                                                      >
                                                        {days}d past due
                                                      </span>
                                                    )
                                                  })()}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap', ...(isSupplyCredit(inv.amount) ? { color: 'var(--text-green-700)', fontWeight: 600 } : {}) }}>
                                                  {isSupplyCredit(inv.amount) ? `− $${formatCurrency(Math.abs(inv.amount))}` : `$${formatCurrency(inv.amount)}`}
                                                  {isSupplyCredit(inv.amount) ? <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 500 }}>credit</span> : null}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
                                                  {inv.on_job_account === true && (
                                                    <span
                                                      title="On the house's job account — if this goes unpaid, the house bills the property owner, not you."
                                                      style={{ marginRight: '0.35rem', padding: '1px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: '#ccfbf1', color: '#0f766e', whiteSpace: 'nowrap' }}
                                                    >
                                                      Job acct
                                                    </span>
                                                  )}
                                                  {inv.job_allocations && inv.job_allocations.length > 0
                                                    ? inv.job_allocations
                                                        .map((a) => {
                                                          const d = supplyHouseJobDetailsMap[a.job_id]
                                                          return d ? `${effectiveJobLedgerNumber(d.hcp_number, d.click_number)} · ${d.job_name} (${a.pct}%)` : a.job_id.slice(0, 8)
                                                        })
                                                        .join(', ')
                                                    : '—'}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <input
                                                    type="checkbox"
                                                    checked={inv.is_paid}
                                                    onChange={() => toggleInvoicePaid(inv)}
                                                  />
                                                </td>
                                                <td
                                                  style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                                                  title={inv.paid_at ?? undefined}
                                                >
                                                  {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '—'}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  {inv.link ? (
                                                    <a href={inv.link} target="_blank" rel="noreferrer" style={{ color: 'var(--text-blue-500)', textDecoration: 'underline' }}>View</a>
                                                  ) : (
                                                    '—'
                                                  )}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); openEditInvoice(inv) }} title="Edit" aria-label="Edit" style={{ padding: '0.25rem', cursor: 'pointer', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={16} height={16} fill="currentColor" aria-hidden="true">
                                                      <path d="M362.7 19.3L314.3 67.7 444.3 197.7 492.7 149.3c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18.3 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
                                                    </svg>
                                                  </button>
                                                </td>
                                              </tr>
                                            )
                                              })
                                            )
                                          })()}
                                        </tbody>
                                      </table>
                                    </div>
                                  </section>
                                  <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                      <h3 style={{ margin: 0, fontSize: '1rem' }}>Purchase Orders</h3>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); createBlankPOForSupplyHouse(selectedSupplyHouseForDetail.id) }}
                                        disabled={creatingPOForSupplyHouse || !serviceTypeId}
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: creatingPOForSupplyHouse || !serviceTypeId ? 'not-allowed' : 'pointer' }}
                                      >
                                        {creatingPOForSupplyHouse ? 'Creating…' : 'Create PO'}
                                      </button>
                                    </div>
                                    {!serviceTypeId && (
                                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                        {selectedServiceTypeIdProp !== undefined ? 'Select a service type above to create POs.' : 'Loading service types…'}
                                      </p>
                                    )}
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead style={{ background: 'var(--bg-subtle)' }}>
                                          <tr>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Name</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Status</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {supplyHousePOs.length === 0 ? (
                                            <tr><td colSpan={3} style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>No purchase orders</td></tr>
                                          ) : (
                                            supplyHousePOs.map((po) => (
                                              <tr key={po.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{po.name}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{po.status}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleNavigateToPO(po.id) }}
                                                    style={{ marginRight: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}
                                                  >
                                                    View
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleNavigateToPO(po.id) }}
                                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}
                                                  >
                                                    Edit
                                                  </button>
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </section>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SupplyHouseJobAccountsSection />

      {houseEditor.modal}

      {invoiceFormOpen && selectedSupplyHouseForDetail && (() => {
        const house = selectedSupplyHouseForDetail
        const poHint = poCodeHintText(poCodeHint(invoicePurchaseOrderNumber, poGeneratorCodesForSelectedHouse), house.name)
        const poHintTone = poCodeHint(invoicePurchaseOrderNumber, poGeneratorCodesForSelectedHouse).kind
        const dueHint = dueDateHint(house.name, house.monthly_payment_day)
        const showPct = invoiceJobAllocations.length >= 2
        const flagOn = invoiceOnJobAccount && invoiceSingleAllocatedJobId != null
        const pdfHref = /^https?:\/\//i.test(invoiceLink.trim()) ? invoiceLink.trim() : null
        const searchOpen = invoiceJobSearchText.trim().length > 0
        return (
        <div style={{ position: 'fixed', inset: 0, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1003 }}>
          {/* This panel is the scroller — the form outgrew short screens once the job-account block landed (v2.2669)
              and a centered, unscrollable panel clipped both ends; the title bar and the Save footer stick (v2.990 pattern). */}
          <div role="dialog" aria-modal="true" aria-label={invoiceWords.title(editingInvoice != null)} style={{ background: 'var(--surface)', borderRadius: 8, maxHeight: 'min(90vh, 100%)', overflow: 'auto', ...stickyModalPanelStyle(560) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', ...stickyModalHeaderStyle() }}>
              <div>
                <h3 style={{ margin: 0 }}>{invoiceWords.title(editingInvoice != null)}</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {house.name}{editingInvoice?.invoice_number ? ` · ${editingInvoice.invoice_number}` : ''}
                </p>
              </div>
              <button type="button" onClick={closeInvoiceForm} style={STICKY_MODAL_CLOSE_BUTTON_STYLE} aria-label="Close">×</button>
            </div>
            <form onSubmit={saveInvoice}>
              {/* ① The fields in the order they sit on the paper: number · date · amount, then the PO. */}
              {/* ⓪ What the paper is (v2.3503). The sign is derived from this, never typed. */}
              <InvoiceFormSection>What the paper is</InvoiceFormSection>
              <div style={{ marginBottom: '0.75rem' }}>
                <div role="radiogroup" aria-label="Document kind" style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 5, overflow: 'hidden' }}>
                  {(['invoice', 'credit'] as SupplyDocumentKind[]).map((k, i) => {
                    const on = invoiceDocumentKind === k
                    return (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setInvoiceDocumentKind(k)}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.5rem',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: 'none',
                          borderLeft: i === 0 ? 'none' : '1px solid var(--border-strong)',
                          background: on ? (k === 'credit' ? 'var(--bg-green-200)' : 'var(--bg-blue-200)') : 'var(--bg-subtle)',
                          color: on ? (k === 'credit' ? 'var(--text-green-700)' : 'var(--text-blue-700)') : 'var(--text-muted)',
                        }}
                      >
                        {k === 'invoice' ? 'Invoice' : 'Credit'}
                      </button>
                    )
                  })}
                </div>
                {invoiceDocumentKind === 'credit' ? (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    A credit memo, a return, or a price correction the house issued. Type the amount as a positive number.
                  </div>
                ) : null}
              </div>
              <InvoiceFormSection>{invoiceDocumentKind === 'credit' ? 'From the credit' : 'From the invoice'}</InvoiceFormSection>
              <div style={{ display: 'grid', gridTemplateColumns: narrowAging ? '1fr' : '1.2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label htmlFor="invoice-number" style={{ ...INVOICE_LABEL_STYLE, whiteSpace: 'nowrap' }}>{invoiceWords.numberLabel} *</label>
                  <input id="invoice-number" type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required style={INVOICE_INPUT_STYLE} />
                </div>
                <div>
                  <label htmlFor="invoice-date" style={INVOICE_LABEL_STYLE}>{invoiceWords.dateLabel} *</label>
                  <input id="invoice-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required style={INVOICE_INPUT_STYLE} />
                </div>
                <div>
                  <label htmlFor="invoice-amount" style={INVOICE_LABEL_STYLE}>Amount *</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 4, paddingLeft: '0.5rem', background: 'var(--surface)' }}>
                    <span aria-hidden style={{ color: invoiceDocumentKind === 'credit' ? 'var(--text-green-700)' : 'var(--text-muted)', fontWeight: invoiceDocumentKind === 'credit' ? 600 : 400, whiteSpace: 'nowrap' }}>{invoiceWords.amountAdornment}</span>
                    <input
                      id="invoice-amount"
                      type="number"
                      step="0.01"
                      min={0}
                      inputMode="decimal"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      required
                      style={{ flex: 1, minWidth: 0, padding: '0.5rem', border: 'none', background: 'transparent', textAlign: 'right', fontVariantNumeric: 'tabular-nums', font: 'inherit', color: 'inherit' }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invoice-po" style={INVOICE_LABEL_STYLE}>Purchase order #</label>
                <input id="invoice-po" type="text" value={invoicePurchaseOrderNumber} onChange={(e) => setInvoicePurchaseOrderNumber(e.target.value)} placeholder="e.g. PO-12345" style={INVOICE_INPUT_STYLE} />
                {/* ② The PO Generator check, while she types — the table's red icon only ever showed after Save. */}
                {poHint ? (
                  <div
                    data-invoice-po-hint={poHintTone}
                    style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: poHintTone === 'not_on_ledger' ? 'var(--text-red-800)' : poHintTone === 'on_ledger' ? 'var(--text-green-800)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    {poHintTone === 'not_on_ledger' ? <AlertCircle size={13} color="#dc2626" aria-hidden style={{ flexShrink: 0 }} /> : null}
                    {poHint}
                  </div>
                ) : null}
              </div>

              {/* ③ Inline job search; the job becomes a card. Percent fields only once there are two jobs to split. */}
              <InvoiceFormSection>Which job</InvoiceFormSection>
              <input
                id="invoice-job-search"
                type="search"
                placeholder="Add a job — J#, name or address…"
                aria-label="Add a job"
                value={invoiceJobSearchText}
                onChange={(e) => setInvoiceJobSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && invoiceJobSearchText) {
                    e.preventDefault()
                    e.stopPropagation()
                    setInvoiceJobSearchText('')
                  }
                  // Enter in the search box must not submit the invoice.
                  if (e.key === 'Enter') e.preventDefault()
                }}
                style={{ ...INVOICE_INPUT_STYLE, marginBottom: '0.5rem' }}
              />
              {searchOpen ? (
                <div role="listbox" aria-label="Matching jobs" style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '0.5rem' }}>
                  {invoiceJobSearchResults.length === 0 ? (
                    <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</div>
                  ) : (
                    invoiceJobSearchResults.map((j) => {
                      const already = invoiceJobAllocations.some((a) => a.job_id === j.id)
                      return (
                        <button
                          key={j.id}
                          type="button"
                          role="option"
                          aria-selected={already}
                          disabled={already}
                          onClick={() => {
                            setInvoiceJobDetailsMap((prev) => ({ ...prev, [j.id]: { hcp_number: j.hcp_number, click_number: j.click_number, job_name: j.job_name, job_address: j.job_address } }))
                            setInvoiceJobAllocations((prev) => addAllocation(prev, j.id))
                            setInvoiceJobSearchText('')
                          }}
                          style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: already ? 'default' : 'pointer', fontSize: '0.875rem', opacity: already ? 0.5 : 1, font: 'inherit', color: 'inherit' }}
                        >
                          <UnifiedSearchResultRow
                            result={{ source: 'job', ...j }}
                            prefixMap={invoiceJobPrefixMap}
                            jobEvidence={invoiceJobEvidence.get(j.id)}
                            evidenceMode={invoiceJobEvidenceMode}
                          />
                        </button>
                      )
                    })
                  )}
                </div>
              ) : null}
              {invoiceJobAllocations.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{invoiceWords.noJobLine}</div>
              ) : null}
              {invoiceJobAllocations.map((a, idx) => {
                const details = invoiceJobDetailsMap[a.job_id]
                // Plain J prefix, like the search row above it (the per-trade JP/JE prefixes belong on the ledger pages).
                const label = details
                  ? `${formatJobLedgerNumberLabel(DEFAULT_JOB_LEDGER_PREFIX, details.hcp_number, details.click_number)} · ${details.job_name || '—'}`
                  : a.job_id.slice(0, 8)
                const isSingle = invoiceSingleAllocatedJobId === a.job_id
                return (
                  <div
                    key={a.job_id}
                    data-invoice-job-card
                    style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${isSingle && flagOn ? '#0f766e' : 'var(--border-strong)'}`, borderRadius: 6, padding: '0.6rem 0.75rem', marginBottom: '0.5rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.9375rem' }}>{label}</strong>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                        {showPct ? (
                          <>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.1"
                              aria-label={`Share of this invoice on ${label}`}
                              value={a.pct}
                              onChange={(e) => setInvoiceJobAllocations((prev) => setAllocationPct(prev, idx, parseFloat(e.target.value)))}
                              style={{ width: 56, padding: '0.15rem 0.25rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }}
                            />
                            <span style={{ fontSize: '0.875rem' }}>%</span>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setInvoiceJobAllocations((prev) => removeAllocation(prev, idx))}
                          style={{ padding: '0.1rem 0.3rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1 }}
                          aria-label={`Remove ${label}`}
                          title="Remove job"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                    {details?.job_address ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stripTrailingZip(details.job_address)}</div> : null}
                    {/* ④ The job account is a fact about this job at this house, so it lives on the job card. */}
                    {isSingle ? (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={flagOn}
                            onChange={(e) => {
                              invoiceOnJobAccountTouchedRef.current = true
                              setInvoiceOnJobAccount(e.target.checked)
                            }}
                            style={{ marginTop: 2, accentColor: '#0f766e' }}
                          />
                          <span>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: flagOn ? '#0f766e' : 'var(--text-base)' }}>On {house.name}'s job account</span>
                            <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>If this goes unpaid the house bills the property owner, not you.</span>
                          </span>
                        </label>
                        {invoiceJobAccountKey === `${a.job_id}:${house.id}` ? (
                          invoiceJobAccount?.status === 'open' ? (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', padding: '0.4rem 0.55rem', borderRadius: 5, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }} data-invoice-job-account="open">
                              <strong>Job account open at {house.name}</strong>
                              {invoiceJobAccount.account_ref ? ` · ref ${invoiceJobAccount.account_ref}` : ''}
                              {invoiceJobAccount.opened_at ? ` · ${openedViaPhrase(invoiceJobAccount.opened_via)} ${new Date(invoiceJobAccount.opened_at).toLocaleDateString()}` : ''}.
                              {!invoiceOnJobAccount ? ' The flag is off — untick only if this invoice is not on the account.' : ''}
                            </div>
                          ) : invoiceJobAccount?.status === 'not_needed' ? (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', padding: '0.4rem 0.55rem', borderRadius: 5, background: 'var(--bg-muted)', color: 'var(--text-muted)' }} data-invoice-job-account="not_needed">
                              Marked <strong>not needed</strong> at {house.name}{invoiceJobAccount.note ? ` — ${invoiceJobAccount.note}` : ''}.
                            </div>
                          ) : (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', padding: '0.4rem 0.55rem', borderRadius: 5, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }} data-invoice-job-account={invoiceJobAccount?.status === 'requested' ? 'requested' : 'none'}>
                              <span>
                                <strong>{invoiceJobAccount?.status === 'requested' ? 'Job account asked for, not open yet' : `No job account at ${house.name} on record for this job`}.</strong>{' '}
                                If the house opened one, mark it — the flag will default on from then.
                              </span>
                              <button
                                type="button"
                                onClick={() => setInvoiceMarkOpenedOpen(true)}
                                style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, background: '#0f766e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}
                              >
                                Mark opened…
                              </button>
                            </div>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
              {showPct ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                  Total: {allocationTotal(invoiceJobAllocations).toFixed(1)}% · Job accounts are per property — available when the invoice is on a single job.
                </div>
              ) : (
                <div style={{ height: '0.5rem' }} />
              )}
              {invoiceMarkOpenedOpen && invoiceSingleAllocatedJobId ? (
                <MarkJobAccountOpenedModal
                  jobId={invoiceSingleAllocatedJobId}
                  jobLabel={(() => {
                    const d = invoiceJobDetailsMap[invoiceSingleAllocatedJobId]
                    return d ? `${effectiveJobLedgerNumber(d.hcp_number, d.click_number) || '—'} · ${d.job_name || '—'}` : 'this job'
                  })()}
                  house={{ id: house.id, name: house.name }}
                  existing={invoiceJobAccount}
                  reps={invoiceJobAccountReps}
                  onClose={() => setInvoiceMarkOpenedOpen(false)}
                  onSaved={(row) => {
                    setInvoiceMarkOpenedOpen(false)
                    setInvoiceJobAccount(row)
                    if (row.status === 'open' && !invoiceOnJobAccountTouchedRef.current) setInvoiceOnJobAccount(true)
                  }}
                />
              ) : null}

              {/* ⑤ Paid is a status with a date (paid_at already exists); the due-date hint says where the prefill came from. */}
              <InvoiceFormSection>{invoiceWords.statusCaption}</InvoiceFormSection>
              <div style={{ display: 'grid', gridTemplateColumns: narrowAging ? '1fr' : '1fr 1.6fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label htmlFor="invoice-due" style={INVOICE_LABEL_STYLE}>Due date</label>
                  <input id="invoice-due" type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} style={INVOICE_INPUT_STYLE} />
                  {dueHint ? <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dueHint}</div> : null}
                </div>
                <fieldset style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                  <legend style={INVOICE_LABEL_STYLE}>Status</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1rem', minHeight: 36 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input id="invoice-status-unpaid" type="radio" name="invoice-paid-status" checked={!invoiceIsPaid} onChange={() => { setInvoiceIsPaid(false); setInvoicePaidOn('') }} />
                      {invoiceWords.openLabel}
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        id="invoice-status-paid"
                        type="radio"
                        name="invoice-paid-status"
                        checked={invoiceIsPaid}
                        onChange={() => {
                          setInvoiceIsPaid(true)
                          if (!invoicePaidOn) setInvoicePaidOn(paidOnYmdFromIso(editingInvoice?.paid_at) || todayYmdInAppTz())
                        }}
                      />
                      {invoiceWords.closedLabel}
                    </label>
                    <input
                      id="invoice-paid-on"
                      type="date"
                      aria-label="Paid on"
                      value={invoicePaidOn}
                      disabled={!invoiceIsPaid}
                      onChange={(e) => setInvoicePaidOn(e.target.value)}
                      style={{ ...INVOICE_INPUT_STYLE, width: 'auto', padding: '0.3rem 0.4rem', marginLeft: '-0.5rem', opacity: invoiceIsPaid ? 1 : 0.5 }}
                    />
                  </div>
                </fieldset>
              </div>

              {/* ⑥ Every link here is the scanned invoice on Drive — name it, and give her a way to glance at it. */}
              <InvoiceFormSection>Paperwork</InvoiceFormSection>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invoice-link" style={INVOICE_LABEL_STYLE}>{invoiceWords.documentPdfLabel}</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                  <input id="invoice-link" type="url" value={invoiceLink} onChange={(e) => setInvoiceLink(e.target.value)} placeholder="https://drive.google.com/…" style={{ ...INVOICE_INPUT_STYLE, flex: 1, minWidth: 0 }} />
                  {pdfHref ? (
                    <a href={pdfHref} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 0.75rem', fontSize: '0.8125rem', fontWeight: 500, border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      Open ↗
                    </a>
                  ) : null}
                </div>
              </div>

              {/* ⑧ What this credit does, in the office's words, while a wrong house or job can still be fixed. */}
              {invoiceDocumentKind === 'credit' && creditEffect ? (
                <div
                  role="status"
                  style={{
                    margin: '0 0 1rem',
                    border: '1px solid var(--border-green)',
                    background: 'var(--bg-green-tint)',
                    borderRadius: 5,
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-green-700)',
                    display: 'flex',
                    gap: '0.5rem',
                  }}
                >
                  <span aria-hidden style={{ fontWeight: 700 }}>&rarr;</span>
                  <span>{creditEffect}</span>
                </div>
              ) : null}

              {/* ⑦ Save never scrolls away — the footer sticks to the panel's bottom edge, mirroring the title bar. */}
              <div style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--surface)', borderTop: '1px solid var(--border)', margin: '0 -1.5rem -1.5rem', padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingInvoice ? (
                  <button
                    type="button"
                    onClick={() => deleteInvoice(editingInvoice)}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                ) : null}
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                  <button type="button" onClick={closeInvoiceForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingInvoice} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{invoiceWords.saveLabel(editingInvoice != null, savingInvoice)}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
        )
      })()}

      {applyPaymentFormOpen && selectedSupplyHouseForDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1003 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Apply Payment</h3>
            <form onSubmit={applyPayment}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Link (optional)</label>
                <input
                  type="text"
                  value={applyPaymentLink}
                  onChange={(e) => setApplyPaymentLink(e.target.value)}
                  placeholder="Payment or receipt link..."
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={applyPaymentShowAll} onChange={(e) => setApplyPaymentShowAll(e.target.checked)} />
                  Show all invoices
                </label>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Select invoices to mark as paid</label>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4, padding: '0.5rem' }}>
                  {(() => {
                    const invoicesToShow = applyPaymentShowAll
                      ? supplyHouseInvoices
                      : supplyHouseInvoices.filter((inv) => !inv.is_paid)
                    if (invoicesToShow.length === 0) {
                      return <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{applyPaymentShowAll ? 'No invoices' : 'No unpaid invoices'}</p>
                    }
                    return invoicesToShow.map((inv) => (
                      <label key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={applyPaymentSelectedIds.has(inv.id)}
                          onChange={(e) => {
                            setApplyPaymentSelectedIds((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(inv.id)
                              else next.delete(inv.id)
                              return next
                            })
                          }}
                        />
                        <span>{inv.invoice_number}</span>
                        {inv.on_job_account === true && (
                          <span
                            title="On the house's job account — if this goes unpaid, the house bills the property owner, not you."
                            style={{ padding: '1px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: '#ccfbf1', color: '#0f766e', whiteSpace: 'nowrap' }}
                          >
                            Job acct
                          </span>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{formatYmdLocal(inv.invoice_date)}</span>
                        <span style={{ marginLeft: 'auto', ...(isSupplyCredit(inv.amount) ? { color: 'var(--text-green-700)', fontWeight: 600 } : {}) }}>
                          {isSupplyCredit(inv.amount) ? `− $${formatCurrency(Math.abs(inv.amount))} credit` : `$${formatCurrency(inv.amount)}`}
                        </span>
                        {inv.is_paid && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-green-600)' }} title={inv.paid_at ?? undefined}>
                            Paid{inv.paid_at ? ` ${new Date(inv.paid_at).toLocaleDateString()}` : ''}
                          </span>
                        )}
                      </label>
                    ))
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeApplyPaymentForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingApplyPayment || applyPaymentSelectedIds.size === 0} style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: savingApplyPayment || applyPaymentSelectedIds.size === 0 ? 'not-allowed' : 'pointer' }}>
                  {savingApplyPayment ? 'Applying…' : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
