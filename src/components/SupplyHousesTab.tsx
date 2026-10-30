import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { summarizeSupplyHouseBalances, supplyHouseCardMoney, ordinalDay } from '../lib/materials/supplyHousePhone'
import { SupplyHousePhoneScreen } from './materials/SupplyHousePhoneScreen'
import { CreditPairPick } from './materials/CreditPairPick'
import { telHrefFor } from '../lib/phoneContact'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { saveSupplyInvoice, supabaseSupplyInvoiceDb } from '../lib/materials/supplyInvoiceWrite'
import { useAuth } from '../hooks/useAuth'
import { countedLabel } from '../lib/batchWords'
import { formatErrorMessage } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { formatCurrency } from '../lib/format'
import { parsePoGeneratorCodeFromPurchaseOrderName } from '../lib/parsePoGeneratorCodeFromPurchaseOrderName'
import { STATED_NEED_COLUMN } from '../lib/materials/poCodeStatedNeed'
import { DEFAULT_JOB_LEDGER_PREFIX, effectiveJobLedgerNumber, formatJobLedgerNumberLabel } from '../lib/ledgerDisplayPrefixes'
import { stripTrailingZip } from '../lib/displayAddress'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { UnifiedSearchResultRow } from './search/UnifiedSearchResultRow'
import { useJobBidSearchEvidence } from '../hooks/useJobBidSearchEvidence'
import { longTimeAgoPhrase } from '../lib/subcontractorLastActivityCompact'
import {
  AGING_BUCKETS,
  agingCellTitle,
  buildSupplyHouseAgingMatrix,
  countSupplyHousesPastDue60,
  supplyHouseAgingPhoneNote,
  daysPastDue,
  invoicesForAgingCell,
  isMovableAgingInvoice,
  movableCandidates,
  moveStripSummary,
  nextMonthlyPaymentDueYmd,
  type AgingBucketKey,
  type AgingCellKey,
} from '../lib/supplyHouseAging'
import { SUPPLY_MOVE_ASK_AGE, ageState } from '../lib/ageState'
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
  paidOnYmdFromIso,
  poCodeHint,
  poCodeHintText,
  poLedgerCodes,
  poLedgerEntryCard,
  poLedgerEntryJobMismatch,
  poLedgerJobMatches,
  removeAllocation,
  setAllocationPct,
  applyPaymentUpdate,
  creditEffectSentence,
  creditPairingLine,
  documentKindFromRow,
  documentWords,
  typedAmountFromStored,
  type PoLedgerEntriesByCode,
  type PoLedgerEntry,
  type SupplyDocumentKind,
} from '../lib/materials/supplyHouseInvoiceForm'
import { ariaSortFor, nextSupplyHouseSummarySort, parseSupplyHouseSummarySort, serializeSupplyHouseSummarySort, sortSupplyHouseSummary, type SupplyHouseSummarySort, type SupplyHouseSummarySortKey } from '../lib/materials/supplyHouseSummarySort'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { SupplyHouseJobAccountsSection } from './materials/SupplyHouseJobAccountsSection'
import { SupplyHouseJobAccountsRoster } from './materials/SupplyHouseJobAccountsRoster'
import { MarkJobAccountOpenedModal } from './materials/MarkJobAccountOpenedModal'
import { openedViaPhrase, type JobAccountRep, type JobSupplyHouseAccountRow } from '../lib/materials/jobSupplyHouseAccounts'
import { agingCellAccountSplit, agingCellJobStateWords, agingCellJobsLine, groupAgingCellByJob, type AgingCellJobGroup } from '../lib/materials/agingCellByJob'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useReportQuickfillSectionMetric } from '../contexts/QuickfillSectionMetricsContext'
import { supplyHousesNextLine } from '../lib/quickfill/nextLine'
import { todayYmdInAppTz, calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { isSupplyCredit } from '../lib/supplyHouseDocument'
import { EmptyState } from './EmptyState'
import { SUPPLY_HOUSE_AGING_EMPTY, supplyHouseInvoicesEmptyWords, supplyHousePosEmptyWords } from '../lib/materials/materialsEmptyWords'

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
 * The aging fetch's rows (v2.5673): enough to draw the matrix AND to list a cell's invoices
 * in the drill-down modal, still one slim select — never the whole table row.
 */
type AgingInvoiceRow = {
  id: string
  supply_house_id: string
  invoice_number: string
  purchase_order_number: string | null
  invoice_date: string
  amount: number
  due_date: string | null
  on_job_account: boolean | null
  link: string | null
  credits_invoice_id: string | null
}

/** An open (unconfirmed) job-account move ask (PR 3) — the follow-up the office owes. */
type MoveAskRow = { id: string; invoice_id: string; requested_at: string; via: string; sent_to: string }

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
const REMEMBERED_TOGGLE_PREFIX = 'supplyHouses.accountsPayable.'
function readRememberedToggle(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(REMEMBERED_TOGGLE_PREFIX + key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
function writeRememberedToggle(key: string, value: boolean): void {
  try {
    localStorage.setItem(REMEMBERED_TOGGLE_PREFIX + key, value ? '1' : '0')
  } catch {
    /* private mode / quota — the toggle still works for the session */
  }
}

/** The teal "of which on a job account" line under an aging cell (B). Saturated status colour, kept literal like the Job acct chip. */
const JOB_ACCOUNT_LINE_STYLE = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#0f766e', whiteSpace: 'nowrap' } as const
const JOB_ACCOUNT_LINE_TITLE = "Of this, on the house's job account — the owner's debt to collect on, not Click's. The cell keeps the house's total."

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
  /** Opens this house's detail once the house list is available (Held for suppliers → "Open house"). */
  autoOpenHouseId?: string | null
  onAutoOpenHouseHandled?: () => void
  /** The Needs You line's door (v2.5723): `?list=movable` opens the move window's worked list once the book and its move data are read. */
  openList?: 'movable' | null
  onOpenListHandled?: () => void
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
  openList,
  onOpenListHandled,
}: SupplyHousesTabProps) {
  const navigate = useNavigate()
  const { user: authUser, role: authRole } = useAuth()
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const myRole = myRoleProp ?? (authRole as UserRole | null) ?? null

  const [supplyHousesInternal, setSupplyHousesState] = useState<SupplyHouse[]>(supplyHousesProp ?? [])
  const supplyHousesList = supplyHousesProp ?? supplyHousesInternal

  const [error, setError] = useState<string | null>(null)
  /** Bumped after every house save so the Directory pane refetches reps and request history. */
  const [directoryReloadKey, setDirectoryReloadKey] = useState(0)

  const [supplyHouseSummary, setSupplyHouseSummary] = useState<SupplyHouseSummaryRow[]>([])
  const [supplyHouseSummaryLoading, setSupplyHouseSummaryLoading] = useState(false)
  const [agingUnpaidInvoices, setAgingUnpaidInvoices] = useState<AgingInvoiceRow[]>([])
  /** The open aging-cell drill-down (v2.5673): which cell's invoices the modal lists.
   *  'movable' (PR 3) is the worked list — every still-current charge not on a job account. */
  const [agingCellModal, setAgingCellModal] = useState<{ houseId: string | null; cell: AgingCellKey | 'movable' } | null>(null)
  /** The open cell's job allocations and job names, fetched once per modal open. */
  const [agingCellJobs, setAgingCellJobs] = useState<{
    allocations: Record<string, InvoiceJobAllocation[]>
    jobs: Record<string, { hcp_number: string; click_number?: string; job_name: string }>
  }>({ allocations: {}, jobs: {} })
  /**
   * PR 2 (punch list #132): the (job, house) account rows behind the modal's job headings, keyed
   * `${jobId}:${houseId}` (an entry of null = checked, none on record), the job-accounts reps
   * per house for the Mark opened sheet, which invoice's Mark opened sheet is up — from a job
   * heading (v2.5694) it only records the account; from the move modal, saved open also flags the
   * invoice — and which job (`${jobId}:${houseId}`) has Flag anyway unfolded. All cleared when the
   * modal closes.
   */
  const [agingCellAccounts, setAgingCellAccounts] = useState<Record<string, JobSupplyHouseAccountRow | null>>({})
  const [agingCellAccountsLoaded, setAgingCellAccountsLoaded] = useState(false)
  const [agingCellReps, setAgingCellReps] = useState<Record<string, JobAccountRep[]>>({})
  const [agingCellMarkOpenedFor, setAgingCellMarkOpenedFor] = useState<{ inv: AgingInvoiceRow; flagOnOpen: boolean } | null>(null)
  const [agingCellFlagAnywayFor, setAgingCellFlagAnywayFor] = useState<string | null>(null)
  /**
   * PR 3 (the move window): the allocations and open asks behind the strip — read once per
   * summary load for the still-current unflagged invoices — plus the move modal's state.
   * The asks read tolerates the table not existing yet (the client can deploy first).
   */
  const [agingMoveData, setAgingMoveData] = useState<{
    allocations: Record<string, InvoiceJobAllocation[]>
    asks: Record<string, MoveAskRow>
    /** Candidates whose one job's account at the house is on record as not needed (v2.6086, punch list #178): out of the window. */
    notNeeded: ReadonlySet<string>
    loaded: boolean
  }>({ allocations: {}, asks: {}, notNeeded: new Set(), loaded: false })
  /** Which unpaid book (by identity) the move data above was read for, and whether the book itself has loaded once — the worked-list door waits on both. */
  const [agingMoveDataBook, setAgingMoveDataBook] = useState<AgingInvoiceRow[] | null>(null)
  const [agingBookLoaded, setAgingBookLoaded] = useState(false)
  const [agingMoveModalFor, setAgingMoveModalFor] = useState<string | null>(null)
  const [agingMoveAttest, setAgingMoveAttest] = useState(false)
  const [agingMoveBusy, setAgingMoveBusy] = useState<null | 'send' | 'move' | string>(null)
  const [agingMoveError, setAgingMoveError] = useState<string | null>(null)
  const [selectedSupplyHouseForDetail, setSelectedSupplyHouseForDetail] = useState<SupplyHouse | null>(null)
  const [supplyHouseInvoices, setSupplyHouseInvoices] = useState<SupplyHouseInvoiceWithAllocations[]>([])
  const [supplyHousePOs, setSupplyHousePOs] = useState<PurchaseOrderWithItems[]>([])
  /** Ledger po_code values visible for this supply house (rows for this house + rows with no supply house); null if fetch failed (no warning icons). */
  /** This house's PO Generator rows by code (plus the house-less ones), for the invoice form's PO check and its card (v2.3599). */
  const [poGeneratorEntriesForSelectedHouse, setPoGeneratorEntriesForSelectedHouse] = useState<PoLedgerEntriesByCode | null>(null)
  const poGeneratorCodesForSelectedHouse = useMemo(() => poLedgerCodes(poGeneratorEntriesForSelectedHouse), [poGeneratorEntriesForSelectedHouse])
  const [supplyHouseDetailLoading, setSupplyHouseDetailLoading] = useState(false)
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<SupplyHouseInvoice | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  /** What the paper is (v2.3503). The amount box stays positive; this is what decides the sign. */
  const [invoiceDocumentKind, setInvoiceDocumentKind] = useState<SupplyDocumentKind>('invoice')
  /** v2.5035 · on a credit, the same house's invoice it credits ('' = not paired). */
  const [invoiceCreditsInvoiceId, setInvoiceCreditsInvoiceId] = useState('')
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
  // The three Accounts-payable toggles survive a refresh (v2.3568 — a May follow-up;
  // docs/recent-features/v2.3568.md). Per device; storage may be unavailable.
  /** v2.5693: the Directory folds away — the office lives in Accounts payable (the owner's ask, 2026-10-21). Collapsed by default, remembered per device. */
  const [directoryOpen, setDirectoryOpen] = useState(() => readRememberedToggle('directory-open', false))
  const [showPaidInvoices, setShowPaidInvoices] = useState(() => readRememberedToggle('show-paid-invoices', false))
  const [showLastPayment, setShowLastPayment] = useState(() => readRememberedToggle('show-last-payment', false))
  // v2.3604: the summary table's sort — every header a button, the pick remembered on the device.
  const [summarySort, setSummarySort] = useState<SupplyHouseSummarySort>(() => {
    try {
      return parseSupplyHouseSummarySort(localStorage.getItem(REMEMBERED_TOGGLE_PREFIX + 'summary-sort'))
    } catch {
      return parseSupplyHouseSummarySort(null)
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(REMEMBERED_TOGGLE_PREFIX + 'summary-sort', serializeSupplyHouseSummarySort(summarySort))
    } catch {
      /* private mode / quota — the sort still works for the session */
    }
  }, [summarySort])
  const sortedSupplyHouseSummary = useMemo(() => sortSupplyHouseSummary(supplyHouseSummary, summarySort), [supplyHouseSummary, summarySort])
  const summaryHeader = (key: SupplyHouseSummarySortKey, label: string, align: 'left' | 'right') => (
    <th aria-sort={ariaSortFor(summarySort, key)} style={{ padding: 0, textAlign: align }}>
      <button
        type="button"
        onClick={() => setSummarySort((cur) => nextSupplyHouseSummarySort(cur, key))}
        title={summarySort.key === key ? (summarySort.dir === 'asc' ? 'Sorted ascending — click to flip' : 'Sorted descending — click to flip') : `Sort by ${label}`}
        style={{ width: '100%', padding: '0.75rem', textAlign: align, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 'inherit', color: 'inherit', display: 'inline-flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', alignItems: 'center', gap: '0.3rem' }}
      >
        {label}
        <span aria-hidden style={{ fontSize: '0.7rem', color: summarySort.key === key ? 'var(--text-strong)' : 'var(--text-muted)', opacity: summarySort.key === key ? 1 : 0.5 }}>
          {summarySort.key === key ? (summarySort.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  )
  // B (decided 2026-09-17): job-account invoices stay in the cells; this marks their share.
  const [markJobAccountInvoices, setMarkJobAccountInvoices] = useState(() => readRememberedToggle('mark-job-account-invoices', true))
  useEffect(() => writeRememberedToggle('directory-open', directoryOpen), [directoryOpen])
  useEffect(() => writeRememberedToggle('show-paid-invoices', showPaidInvoices), [showPaidInvoices])
  useEffect(() => writeRememberedToggle('show-last-payment', showLastPayment), [showLastPayment])
  useEffect(() => writeRememberedToggle('mark-job-account-invoices', markJobAccountInvoices), [markJobAccountInvoices])

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
    const { data } = await supabase.from('service_types').select('id').eq('billing_only', false).order('sequence_order', { ascending: true }).limit(1)
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
      .select('id, supply_house_id, invoice_number, purchase_order_number, invoice_date, amount, is_paid, updated_at, paid_at, due_date, on_job_account, link, credits_invoice_id')
    const invoicesList = (invoices ?? []) as (AgingInvoiceRow & { is_paid: boolean; updated_at: string | null; paid_at: string | null })[]
    setAgingUnpaidInvoices(invoicesList.filter((inv) => !inv.is_paid))
    setAgingBookLoaded(true)
    // The balance per house is a tested kernel since v2.3888 (it was inline here, untested).
    const rows: SupplyHouseSummaryRow[] = summarizeSupplyHouseBalances(housesList, invoicesList)
    setSupplyHouseSummary(rows)
    setSupplyHouseSummaryLoading(false)
  }

  async function loadSupplyHouseDetail(sh: SupplyHouse) {
    setSupplyHouseDetailLoading(true)
    setPoGeneratorEntriesForSelectedHouse(null)
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
        .select(
          `po_code, notes, created_at, job_ledger_id,
          jobs_ledger(hcp_number, click_number, job_name),
          for_user:users!material_po_generator_entries_for_user_id_fkey(name, email),
          created_by_user:users!material_po_generator_entries_created_by_fkey(name, email)`,
        )
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
      setPoGeneratorEntriesForSelectedHouse(null)
    } else {
      type GenRow = {
        po_code: number
        notes: string | null
        created_at: string | null
        job_ledger_id: string | null
        jobs_ledger: { hcp_number: string | null; click_number: string | null; job_name: string | null } | null
        for_user: { name: string | null; email: string | null } | null
        created_by_user: { name: string | null; email: string | null } | null
      }
      const genRows = (genRes.data ?? []) as unknown as GenRow[]
      const byCode = new Map<number, PoLedgerEntry>()
      for (const r of genRows) {
        const code = Number(r.po_code)
        const jl = r.jobs_ledger
        byCode.set(code, {
          code,
          jobLabel: `${DEFAULT_JOB_LEDGER_PREFIX}${effectiveJobLedgerNumber(jl?.hcp_number, jl?.click_number) || '—'} · ${jl?.job_name?.trim() || '—'}`,
          jobLedgerId: r.job_ledger_id ?? null,
          personName: r.for_user?.name?.trim() || r.for_user?.email?.trim() || '—',
          createdAt: r.created_at,
          createdBy: r.created_by_user?.name?.trim() || r.created_by_user?.email?.trim() || null,
          statedNeed: r.notes,
        })
      }
      setPoGeneratorEntriesForSelectedHouse(byCode)
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

  // Held for suppliers → "Open house": open the requested house's detail once the list has it.
  useEffect(() => {
    if (!autoOpenHouseId) return
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === autoOpenHouseId)
    if (!sh) return
    void loadSupplyHouseDetail(sh)
    onAutoOpenHouseHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenHouseId, supplyHousesList])

  // The aging-cell modal's Jobs column (v2.5673): one allocations read for just the listed
  // invoices, then the job names — fetched once per open, never for the whole book.
  useEffect(() => {
    if (!agingCellModal) {
      setAgingCellJobs({ allocations: {}, jobs: {} })
      setAgingCellAccounts({})
      setAgingCellAccountsLoaded(false)
      setAgingCellReps({})
      setAgingCellMarkOpenedFor(null)
      setAgingCellFlagAnywayFor(null)
      return
    }
    const cellRows =
      agingCellModal.cell === 'movable'
        ? movableCandidates(agingUnpaidInvoices, todayYmdInAppTz()).filter((r) => (agingMoveData.allocations[r.id]?.length ?? 0) === 1 && !agingMoveData.notNeeded.has(r.id))
        : invoicesForAgingCell(agingUnpaidInvoices, agingCellModal.houseId, agingCellModal.cell, todayYmdInAppTz())
    const ids = cellRows.map((r) => r.id)
    if (ids.length === 0) {
      setAgingCellAccountsLoaded(true)
      return
    }
    const houseByInvoice = new Map(cellRows.map((r) => [r.id, r.supply_house_id]))
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('supply_house_invoice_job_allocations')
        .select('invoice_id, job_id, pct')
        .in('invoice_id', ids)
      if (cancelled) return
      const allocations: Record<string, InvoiceJobAllocation[]> = {}
      for (const a of (data ?? []) as { invoice_id: string; job_id: string; pct: number }[]) {
        ;(allocations[a.invoice_id] ??= []).push({ job_id: a.job_id, pct: Number(a.pct) })
      }
      const jobIds = [...new Set(Object.values(allocations).flat().map((a) => a.job_id))]
      // PR 2: the chips need the (job, house) account rows — only the single-job pairs can
      // carry the flag — and each involved house's job-accounts reps for the Mark opened sheet.
      const pairs: Array<{ jobId: string; houseId: string }> = []
      for (const [invoiceId, list] of Object.entries(allocations)) {
        const houseId = houseByInvoice.get(invoiceId)
        if (list.length === 1 && houseId) pairs.push({ jobId: list[0]!.job_id, houseId })
      }
      const pairJobIds = [...new Set(pairs.map((p) => p.jobId))]
      const pairHouseIds = [...new Set(pairs.map((p) => p.houseId))]
      const [jobRes, accRes, repRes] = await Promise.all([
        jobIds.length > 0 ? supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
        pairs.length > 0
          ? supabase
              .from('job_supply_house_accounts')
              .select('id, job_id, supply_house_id, status, account_ref, opened_via, rep_contact_id, requested_by, requested_at, requested_from_counter, opened_by, opened_at, note')
              .in('job_id', pairJobIds)
              .in('supply_house_id', pairHouseIds)
          : Promise.resolve({ data: [] }),
        pairHouseIds.length > 0
          ? supabase
              .from('supply_house_contacts')
              .select('id, supply_house_id, name, email, phone')
              .in('supply_house_id', pairHouseIds)
              .eq('role', 'job_accounts')
              .is('archived_at', null)
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      const jobs: Record<string, { hcp_number: string; click_number?: string; job_name: string }> = {}
      for (const r of (jobRes.data ?? []) as { id: string; hcp_number: string; click_number: string; job_name: string }[]) {
        jobs[r.id] = { hcp_number: r.hcp_number ?? '', click_number: r.click_number ?? '', job_name: r.job_name ?? '' }
      }
      const accounts: Record<string, JobSupplyHouseAccountRow | null> = {}
      for (const p of pairs) accounts[`${p.jobId}:${p.houseId}`] = null
      for (const row of (accRes.data ?? []) as JobSupplyHouseAccountRow[]) {
        accounts[`${row.job_id}:${row.supply_house_id}`] = row
      }
      const reps: Record<string, JobAccountRep[]> = {}
      for (const c of (repRes.data ?? []) as Array<JobAccountRep & { supply_house_id: string }>) {
        ;(reps[c.supply_house_id] ??= []).push(c)
      }
      setAgingCellJobs({ allocations, jobs })
      setAgingCellAccounts(accounts)
      setAgingCellReps(reps)
      setAgingCellAccountsLoaded(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agingCellModal])

  /**
   * PR 2's one write: the flag flips, every reader re-derives from the same state (the
   * matrix, the teal lines, the open modal's footer), and an expanded house showing the
   * same invoice reloads so its table agrees.
   */
  // PR 3: the strip's data — allocations and open asks for the still-current unflagged
  // invoices, re-read whenever the book reloads. Small sets; one query each.
  useEffect(() => {
    const candidates = movableCandidates(agingUnpaidInvoices, todayYmdInAppTz())
    const ids = candidates.map((r) => r.id)
    if (ids.length === 0) {
      setAgingMoveData({ allocations: {}, asks: {}, notNeeded: new Set(), loaded: true })
      setAgingMoveDataBook(agingUnpaidInvoices)
      return
    }
    let cancelled = false
    void (async () => {
      const [allocRes, askRes] = await Promise.all([
        supabase.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct').in('invoice_id', ids),
        supabase
          .from('supply_house_invoice_move_requests')
          .select('id, invoice_id, requested_at, via, sent_to')
          .in('invoice_id', ids)
          .is('confirmed_at', null),
      ])
      if (cancelled) return
      const allocations: Record<string, InvoiceJobAllocation[]> = {}
      for (const a of (allocRes.data ?? []) as { invoice_id: string; job_id: string; pct: number }[]) {
        ;(allocations[a.invoice_id] ??= []).push({ job_id: a.job_id, pct: Number(a.pct) })
      }
      const asks: Record<string, MoveAskRow> = {}
      // askRes.error: the table may not be pushed yet — the strip still works, with no asks.
      for (const r of (askRes.error ? [] : askRes.data ?? []) as MoveAskRow[]) asks[r.invoice_id] = r
      // v2.6086: a single-job candidate whose job's account at the house is marked not needed leaves the window.
      const houseOf = new Map(candidates.map((r) => [r.id, r.supply_house_id]))
      const pairs = Object.entries(allocations).filter(([, list]) => list.length === 1).map(([invoiceId, list]) => ({ invoiceId, jobId: list[0]!.job_id, houseId: houseOf.get(invoiceId) ?? '' }))
      const notNeeded = new Set<string>()
      if (pairs.length > 0) {
        const accRes = await supabase
          .from('job_supply_house_accounts')
          .select('job_id, supply_house_id')
          .in('job_id', [...new Set(pairs.map((p) => p.jobId))])
          .in('supply_house_id', [...new Set(pairs.map((p) => p.houseId))])
          .eq('status', 'not_needed')
        if (cancelled) return
        const marked = new Set(((accRes.data ?? []) as { job_id: string; supply_house_id: string }[]).map((a) => `${a.job_id}:${a.supply_house_id}`))
        for (const p of pairs) if (marked.has(`${p.jobId}:${p.houseId}`)) notNeeded.add(p.invoiceId)
      }
      setAgingMoveData({ allocations, asks, notNeeded, loaded: true })
      setAgingMoveDataBook(agingUnpaidInvoices)
    })()
    return () => {
      cancelled = true
    }
  }, [agingUnpaidInvoices])

  // The Needs You line's door (v2.5723): `?list=movable` opens the worked list — the same modal
  // the strip's Work the list opens — once the move data is for the book on screen, so the
  // modal's one-time jobs fetch sees the rows. Handled once; the parent drops the param.
  useEffect(() => {
    if (openList !== 'movable' || !agingBookLoaded || agingMoveDataBook !== agingUnpaidInvoices) return
    setAgingCellModal({ houseId: null, cell: 'movable' })
    onOpenListHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openList, agingBookLoaded, agingMoveDataBook, agingUnpaidInvoices])

  /** PR 3: email the house's job-accounts rep the move request for these invoices (one house per call). */
  async function sendMoveRequest(invoiceIds: string[], busyKey: string, includeAsked: boolean): Promise<void> {
    if (invoiceIds.length === 0) return
    setAgingMoveBusy(busyKey)
    setAgingMoveError(null)
    const { data, error } = await supabase.functions.invoke('request-job-account-move', {
      body: { invoice_ids: invoiceIds, include_asked: includeAsked },
    })
    setAgingMoveBusy(null)
    const payload = (data ?? {}) as { error?: string; asked?: string[]; sent_to?: string }
    if (error || payload.error) {
      setAgingMoveError(payload.error ?? error?.message ?? 'The email did not send.')
      return
    }
    const now = new Date().toISOString()
    setAgingMoveData((prev) => {
      const asks = { ...prev.asks }
      for (const id of payload.asked ?? invoiceIds) {
        asks[id] = { id: asks[id]?.id ?? 'pending', invoice_id: id, requested_at: now, via: 'email', sent_to: payload.sent_to ?? '' }
      }
      return { ...prev, asks }
    })
  }

  /** PR 3: the attested call — the flag flips, and the ask (or a fresh phone row) is confirmed. */
  async function markMovedConfirmed(inv: AgingInvoiceRow, jobId: string): Promise<void> {
    setAgingMoveBusy('move')
    setAgingMoveError(null)
    await setInvoiceJobAcct(inv, true)
    const now = new Date().toISOString()
    // Confirm the open ask if one exists; a pure phone move writes its own confirmed record.
    const { data: updated, error: updErr } = await supabase
      .from('supply_house_invoice_move_requests')
      .update({ confirmed_at: now })
      .eq('invoice_id', inv.id)
      .is('confirmed_at', null)
      .select('id')
    if (!updErr && (updated ?? []).length === 0) {
      await supabase.from('supply_house_invoice_move_requests').insert({
        invoice_id: inv.id,
        job_id: jobId,
        supply_house_id: inv.supply_house_id,
        via: 'phone',
        confirmed_at: now,
      })
    }
    setAgingMoveData((prev) => {
      const asks = { ...prev.asks }
      delete asks[inv.id]
      return { ...prev, asks }
    })
    setAgingMoveModalFor(null)
    setAgingMoveAttest(false)
    setAgingMoveBusy(null)
  }

  async function setInvoiceJobAcct(inv: AgingInvoiceRow, on: boolean) {
    const { error } = await supabase.from('supply_house_invoices').update({ on_job_account: on }).eq('id', inv.id)
    if (error) {
      setError(`Could not ${on ? 'flag' : 'unflag'} ${inv.invoice_number}: ${error.message}`)
      return
    }
    setAgingUnpaidInvoices((prev) => prev.map((r) => (r.id === inv.id ? { ...r, on_job_account: on } : r)))
    if (selectedSupplyHouseForDetail?.id === inv.supply_house_id) void loadSupplyHouseDetail(selectedSupplyHouseForDetail)
  }

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
  /** PR 3: the movable set (current, unflagged, exactly one job) and the strip's numbers. */
  const agingMovable = movableCandidates(agingUnpaidInvoices, agingTodayYmd).filter(
    (r) => (agingMoveData.allocations[r.id]?.length ?? 0) === 1 && !agingMoveData.notNeeded.has(r.id),
  )
  const agingMoveStrip = moveStripSummary(agingMovable, new Set(Object.keys(agingMoveData.asks)))
  const agingHasCurrentUnpaid = agingUnpaidInvoices.some(
    (inv) => Number(inv.amount ?? 0) > 0 && inv.due_date != null && daysPastDue(inv.due_date, agingTodayYmd) <= 0,
  )
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
  useBodyScrollLock(invoiceFormOpen || agingCellModal != null)
  const housesPastDue60 = countSupplyHousesPastDue60(agingMatrix)
  const houseEditor = useSupplyHouseEditor({
    myRole,
    onSaved: async ({ kind, houseId }) => {
      await Promise.all([loadSupplyHouses(), loadSupplyHouseSummary()])
      setDirectoryReloadKey((k) => k + 1)
      if (kind === 'deleted' && selectedSupplyHouseForDetail?.id === houseId) {
        setSelectedSupplyHouseForDetail(null)
        setPoGeneratorEntriesForSelectedHouse(null)
      } else if (kind === 'updated' && selectedSupplyHouseForDetail?.id === houseId) {
        await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      }
    },
  })

  useReportQuickfillSectionMetric(
    'supply-houses',
    !canAccess || supplyHouseSummaryLoading ? null : housesPastDue60,
    canAccess && supplyHouseSummaryLoading,
    null,
    null,
    !canAccess || supplyHouseSummaryLoading ? null : supplyHousesNextLine(agingMatrix.rows.map((r) => ({ name: r.name, past60_90: r.buckets.past60_90, past90plus: r.buckets.past90plus }))),
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
    setInvoiceCreditsInvoiceId('')
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
    setInvoiceCreditsInvoiceId((inv as { credits_invoice_id?: string | null }).credits_invoice_id ?? '')
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
    const { error } = await supabase
      .from('supply_house_invoices')
      .update(applyPaymentUpdate(applyPaymentLink))
      .in('id', ids)
    // The reason reaches the person (punch list #184): a Supabase error is a plain object, so it goes through formatErrorMessage.
    if (error) showToast(formatErrorMessage(error, 'Could not apply the payment'), 'error')
    if (!error && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
      closeApplyPaymentForm()
    }
    setSavingApplyPayment(false)
  }

  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplyHouseForDetail) return
    setSavingInvoice(true)
    setError(null)
    // The one write (punch list #179, v2.6088): the payload rules and the three writes live in supplyInvoiceWrite.ts,
    // so a bill typed here and a bill filled from its PDF save through the same path.
    const saved = await saveSupplyInvoice(
      supabaseSupplyInvoiceDb,
      {
        supplyHouseId: selectedSupplyHouseForDetail.id,
        kind: invoiceDocumentKind,
        number: invoiceNumber,
        dateYmd: invoiceDate,
        dueDateYmd: invoiceDueDate,
        amountTyped: invoiceAmount,
        purchaseOrderNumber: invoicePurchaseOrderNumber,
        link: invoiceLink,
        isPaid: invoiceIsPaid,
        paidOnYmd: invoicePaidOn,
        onJobAccount: invoiceOnJobAccount,
        allocations: invoiceJobAllocations,
        creditsInvoiceId: invoiceCreditsInvoiceId,
      },
      editingInvoice,
    )
    if (!saved.ok) {
      setError(saved.problem)
      setSavingInvoice(false)
      return
    }
    if (saved.allocationProblem) setError(saved.allocationProblem)
    await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
    await loadSupplyHouseSummary()
    closeInvoiceForm()
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
    // v2.3506: the confirm names the paper too — a credit memo is never called an invoice on screen.
    const paper = documentKindFromRow(inv) === 'credit' ? 'credit' : 'invoice'
    if (!(await confirmDialog({ message: `Delete this ${paper}?`, confirmLabel: 'Delete', danger: true }))) return
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

  /**
   * A money cell of the aging map is a door (v2.5673): click or Enter opens the invoices
   * behind it. Spread onto the `<td>`; stops the row's own open-the-house click.
   */
  function agingCellDoorProps(houseId: string | null, cell: AgingCellKey, title: string) {
    const open = () => setAgingCellModal({ houseId, cell })
    return {
      role: 'button' as const,
      tabIndex: 0,
      title,
      onClick: (e: ReactMouseEvent<HTMLTableCellElement>) => {
        e.stopPropagation()
        open()
      },
      onKeyDown: (e: ReactKeyboardEvent<HTMLTableCellElement>) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        e.stopPropagation()
        open()
      },
    }
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

      {/* Pane 1 — the Directory: the same component the estimator's tab renders alone (to-dos/supply-house-directory).
          v2.5693: it folds, and starts folded — the office's work is Accounts payable below; the header is the door. */}
      <section style={{ marginBottom: directoryOpen ? '2.25rem' : '1.5rem' }}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={directoryOpen}
          title={directoryOpen ? 'Fold the Directory away' : 'Open the Directory'}
          onClick={() => setDirectoryOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            setDirectoryOpen((o) => !o)
          }}
          style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: directoryOpen ? '0.75rem' : 0, flexWrap: 'wrap', cursor: 'pointer' }}
        >
          <span aria-hidden style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{directoryOpen ? '▾' : '▸'}</span>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Directory</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {directoryOpen
              ? 'houses, reps and websites'
              : `${supplyHousesList.length} vendor${supplyHousesList.length === 1 ? '' : 's'} — houses, reps and websites`}
          </span>
        </div>
        {directoryOpen ? (
          <SupplyHouseDirectory
            supplyHouses={supplyHousesList}
            audience="office"
            onAddHouse={houseEditor.openAdd}
            onEditHouse={houseEditor.openEdit}
            reloadKey={directoryReloadKey}
            moneyByHouseId={supplyHouseSummaryLoading ? undefined : supplyHouseCardMoney(supplyHouseSummary, agingMatrix.rows)}
          />
        ) : null}
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
                {agingMatrix.jobAccountInvoiceCount > 0 && (
                  <label title="Under each aging cell, how much of it sits on the house's job account (the owner's debt, not Click's)" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={markJobAccountInvoices}
                      onChange={(e) => setMarkJobAccountInvoices(e.target.checked)}
                    />
                    Mark job-account invoices
                  </label>
                )}
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
                {/* PR 3 — the move window: the still-current charges not on a job account, with the
                    soonest window to close. Desktop only, like the table whose cells it works. */}
                {!narrowAging && agingMoveData.loaded && (agingMoveStrip.count > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', margin: '0 auto 0.9rem', maxWidth: 900, padding: '0.45rem 0.8rem', border: '1px solid var(--border)', borderLeft: '4px solid #0f766e', borderRadius: 8, background: 'var(--bg-emerald-tint)', fontSize: '0.8125rem', color: 'var(--text-emerald-800)' }}>
                    <span>
                      <strong>${formatCurrency(agingMoveStrip.dollars)}</strong> on {agingMoveStrip.count} current invoice{agingMoveStrip.count === 1 ? '' : 's'} is not on a job account yet — a house moves a charge only while it is current.
                      {agingMoveStrip.askedCount > 0 ? <> <strong>{agingMoveStrip.askedCount}</strong> asked, awaiting the house.</> : null}
                      {agingMoveStrip.soonestDueYmd ? <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}> Soonest window closes {formatYmdLocal(agingMoveStrip.soonestDueYmd)}.</span> : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAgingCellModal({ houseId: null, cell: 'movable' })}
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: '#0f766e', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Work the list ›
                    </button>
                  </div>
                ) : agingHasCurrentUnpaid ? (
                  <p style={{ margin: '0 0 0.9rem', fontSize: '0.8125rem', color: 'var(--text-emerald-800)', textAlign: 'center' }}>
                    Every current charge that belongs on a job account is on one. ✓
                  </p>
                ) : null)}
{narrowAging ? (
                  /* Phone (v2.2191): one row per house — name · worst-news note · 5-bucket bar · total.
                     The bar's five colors are the table's five aging columns, worst on the right. */
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {agingMatrix.rows.length === 0 ? (
                      <EmptyState compact {...SUPPLY_HOUSE_AGING_EMPTY} />
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
                        <td colSpan={AGING_BUCKETS.length + (agingHasCredits ? 3 : 2)} style={{ padding: 0 }}>
                          <EmptyState compact {...SUPPLY_HOUSE_AGING_EMPTY} />
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
                                {...(has ? agingCellDoorProps(row.supplyHouseId, b.key, `${row.name} — ${agingCellTitle(b.key)}: see the invoices`) : {})}
                                style={{
                                  padding: '0.6rem 0.75rem',
                                  textAlign: 'right',
                                  fontVariantNumeric: 'tabular-nums',
                                  whiteSpace: 'nowrap',
                                  ...(has ? { ...AGING_CELL_STYLES[b.key], cursor: 'pointer' } : { color: 'var(--text-faint-300)' }),
                                }}
                              >
                                {has ? `$${formatCurrency(amount)}` : '—'}
                                {markJobAccountInvoices && row.jobAccount[b.key] > 0.005 ? (
                                  <span title={JOB_ACCOUNT_LINE_TITLE} style={JOB_ACCOUNT_LINE_STYLE}>${formatCurrency(row.jobAccount[b.key])} job acct</span>
                                ) : null}
                              </td>
                            )
                          })}
                          {agingHasCredits ? (
                            <td
                              {...(row.creditsOpen < -0.005 ? agingCellDoorProps(row.supplyHouseId, 'credits', `${row.name} — open credits: see the memos`) : {})}
                              style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(row.creditsOpen < -0.005 ? { color: 'var(--text-green-700)', cursor: 'pointer' } : { color: 'var(--text-faint-300)' }) }}
                            >
                              {row.creditsOpen < -0.005 ? `−$${formatCurrency(Math.abs(row.creditsOpen))}` : '—'}
                            </td>
                          ) : null}
                          <td
                            {...(row.total > 0.005 ? agingCellDoorProps(row.supplyHouseId, 'owed', `${row.name} — every unpaid invoice`) : {})}
                            style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(row.total > 0.005 ? { cursor: 'pointer' } : {}) }}
                          >
                            ${formatCurrency(row.total)}
                            {markJobAccountInvoices && row.jobAccountTotal > 0.005 ? (
                              <span title={JOB_ACCOUNT_LINE_TITLE} style={JOB_ACCOUNT_LINE_STYLE}>${formatCurrency(row.jobAccountTotal)} job acct</span>
                            ) : null}
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
                          <td
                            key={b.key}
                            {...(has ? agingCellDoorProps(null, b.key, `Every house — ${agingCellTitle(b.key)}: see the invoices`) : {})}
                            style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: has ? undefined : 'var(--text-faint-300)', ...(has ? { cursor: 'pointer' } : {}) }}
                          >
                            {has ? `$${formatCurrency(amount)}` : '—'}
                          </td>
                        )
                      })}
                      {agingHasCredits ? (
                        <td
                          {...agingCellDoorProps(null, 'credits', 'Every house — open credits: see the memos')}
                          style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-green-700)', cursor: 'pointer' }}
                        >
                          −${formatCurrency(Math.abs(agingMatrix.creditsTotal))}
                        </td>
                      ) : null}
                      <td
                        {...(agingMatrix.grandTotal > 0.005 ? agingCellDoorProps(null, 'owed', 'Every house — every unpaid invoice') : {})}
                        style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(agingMatrix.grandTotal > 0.005 ? { cursor: 'pointer' } : {}) }}
                      >
                        ${formatCurrency(agingMatrix.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                )}
            </div>
            {narrowAging ? (
              /* Phone (v2.3888, punch list #30 PR 5c): the summary as rows — a house opens its own screen. */
              <div data-supply-house-phone-list style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {sortedSupplyHouseSummary.map((row, i) => {
                  const sh = supplyHousesList.find((s: SupplyHouse) => s.id === row.supply_house_id)
                  return (
                    <button
                      key={row.supply_house_id}
                      type="button"
                      onClick={() => sh && loadSupplyHouseDetail(sh)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', minHeight: 52, textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', overflowWrap: 'anywhere' }}>{row.name}</span>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {[row.monthlyPaymentDay ? `pays on the ${ordinalDay(row.monthlyPaymentDay)}` : '', row.lastInvoiceUpdatedAt ? `updated ${longTimeAgoPhrase(row.lastInvoiceUpdatedAt)}` : ''].filter(Boolean).join(' · ') || 'no invoices yet'}
                        </span>
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: row.outstanding > 0 ? 700 : 400, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>${formatCurrency(row.outstanding)}</span>
                      <span aria-hidden style={{ color: 'var(--text-muted)' }}>›</span>
                    </button>
                  )
                })}
              </div>
            ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {summaryHeader('name', 'Supply House', 'left')}
                  {summaryHeader('outstanding', 'Outstanding', 'right')}
                  {summaryHeader('due', 'Due', 'left')}
                  {summaryHeader('updated', 'Updated', 'left')}
                  {showLastPayment && summaryHeader('lastPaid', 'Last Paid', 'left')}
                  <th style={{ padding: '0.75rem', textAlign: 'right', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedSupplyHouseSummary.map((row) => {
                  const sh = supplyHousesList.find((s: SupplyHouse) => s.id === row.supply_house_id)
                  const isExpanded = selectedSupplyHouseForDetail?.id === row.supply_house_id
                  return (
                    <Fragment key={row.supply_house_id}>
                      <tr
                        onClick={() => {
                          if (!sh) return
                          if (isExpanded) {
                            setSelectedSupplyHouseForDetail(null)
                            setPoGeneratorEntriesForSelectedHouse(null)
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
                                          <span><strong>Phone:</strong> <a href={telHrefFor(selectedSupplyHouseForDetail.phone)} style={{ color: 'var(--text-link)' }}>{selectedSupplyHouseForDetail.phone}</a></span>
                                        )}
                                        <SupplyHouseWebsiteLink websiteUrl={selectedSupplyHouseForDetail.website_url} />
                                      </div>
                                    )}
                                  </div>
                                  <SupplyHouseJobAccountsRoster
                                    house={selectedSupplyHouseForDetail}
                                    invoices={supplyHouseInvoices}
                                    jobDetails={supplyHouseJobDetailsMap}
                                    onInvoicesChanged={() => void loadSupplyHouseDetail(selectedSupplyHouseForDetail)}
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
                                              <tr>
                                                <td colSpan={10} style={{ padding: 0 }}>
                                                  <EmptyState
                                                    compact
                                                    {...supplyHouseInvoicesEmptyWords({
                                                      house: selectedSupplyHouseForDetail.name.trim() || 'this house',
                                                      total: supplyHouseInvoices.length,
                                                      addInvoice: openAddInvoice,
                                                      showPaid: () => setShowPaidInvoices(true),
                                                    })}
                                                  />
                                                </td>
                                              </tr>
                                            ) : (
                                              invoicesToShow.map((inv) => {
                                                const poGenCode = parsePoGeneratorCodeFromPurchaseOrderName(inv.purchase_order_number ?? '')
                                                const showPoGenMismatch =
                                                  poGenCode != null &&
                                                  poGeneratorCodesForSelectedHouse != null &&
                                                  !poGeneratorCodesForSelectedHouse.has(poGenCode)
                                                return (
                                              <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  {inv.invoice_number}
                                                  {(() => {
                                                    // v2.5035 · a credit and the invoice it credits name each other; read against every row, paid ones too.
                                                    const pair = creditPairingLine(inv, supplyHouseInvoices)
                                                    return pair ? <span data-testid="supply-credit-pair" style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{pair}</span> : null
                                                  })()}
                                                </td>
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
                                                <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                                                  {inv.link || inv.payment_link ? (
                                                    <span style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                                      {inv.link ? (
                                                        <a href={inv.link} target="_blank" rel="noreferrer" title="The invoice" style={{ color: 'var(--text-blue-500)', textDecoration: 'underline' }}>View</a>
                                                      ) : null}
                                                      {/* v2.3843: the payment / receipt link from Make Payment, beside the invoice scan. */}
                                                      {inv.payment_link ? (
                                                        <a href={inv.payment_link} target="_blank" rel="noreferrer" title="Payment or receipt (Make Payment)" style={{ color: 'var(--text-blue-500)', textDecoration: 'underline' }}>Receipt</a>
                                                      ) : null}
                                                    </span>
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
                                            <tr>
                                              <td colSpan={3} style={{ padding: 0 }}>
                                                <EmptyState
                                                  compact
                                                  {...supplyHousePosEmptyWords({
                                                    house: selectedSupplyHouseForDetail.name.trim() || 'this house',
                                                    createPo: serviceTypeId && !creatingPOForSupplyHouse ? () => void createBlankPOForSupplyHouse(selectedSupplyHouseForDetail.id) : null,
                                                  })}
                                                />
                                              </td>
                                            </tr>
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
            )}
          </div>
        )}
      </section>

      {narrowAging && selectedSupplyHouseForDetail ? (
        <SupplyHousePhoneScreen
          house={selectedSupplyHouseForDetail}
          money={supplyHouseCardMoney(supplyHouseSummary, agingMatrix.rows)[selectedSupplyHouseForDetail.id] ?? null}
          loading={supplyHouseDetailLoading}
          invoices={supplyHouseInvoices}
          jobLabel={(jobId) => {
            const d = supplyHouseJobDetailsMap[jobId]
            return d ? effectiveJobLedgerNumber(d.hcp_number, d.click_number) : jobId.slice(0, 8)
          }}
          todayYmd={todayYmdInAppTz()}
          formatMoney={(n) => `$${formatCurrency(n)}`}
          onClose={() => {
            setSelectedSupplyHouseForDetail(null)
            setPoGeneratorEntriesForSelectedHouse(null)
          }}
          onEditHouse={() => houseEditor.openEdit(selectedSupplyHouseForDetail)}
          onAddInvoice={openAddInvoice}
          onMakePayment={openApplyPaymentForm}
          onTogglePaid={(id) => {
            const inv = supplyHouseInvoices.find((x) => x.id === id)
            if (inv) void toggleInvoicePaid(inv)
          }}
          onEditInvoice={(id) => {
            const inv = supplyHouseInvoices.find((x) => x.id === id)
            if (inv) openEditInvoice(inv)
          }}
          onSaveNotes={async (notes) => {
            const house = selectedSupplyHouseForDetail
            const { error } = await supabase.from('supply_houses').update({ notes: notes.trim() ? notes : null }).eq('id', house.id)
            if (error) return false
            setSelectedSupplyHouseForDetail({ ...house, notes: notes.trim() ? notes : null })
            setDirectoryReloadKey((k) => k + 1)
            return true
          }}
        />
      ) : null}

      <SupplyHouseJobAccountsSection />

      {/* The aging-cell drill-down (v2.5673): exactly the invoices the cell sums, grouped by job (v2.5694). */}
      {agingCellModal && (() => {
        const { houseId, cell } = agingCellModal
        const isMovableList = cell === 'movable'
        const cellRows = isMovableList
          ? agingMovable.slice().sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
          : invoicesForAgingCell(agingUnpaidInvoices, houseId, cell, agingTodayYmd)
        const houseNameOf = (id: string) =>
          supplyHouseSummary.find((r) => r.supply_house_id === id)?.name ??
          supplyHousesList.find((s: SupplyHouse) => s.id === id)?.name ??
          'this house'
        const houseName = houseId ? houseNameOf(houseId) : 'Every house'
        const total = cellRows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
        const isCredits = cell === 'credits'
        const movableToAsk = isMovableList ? cellRows.filter((r) => !agingMoveData.asks[r.id]).length : 0
        const noun = isCredits
          ? cellRows.length === 1 ? 'credit memo' : 'credit memos'
          : cellRows.length === 1 ? 'invoice' : 'invoices'
        // The footer row's modal groups by house, in the matrix's own order (owed desc).
        const groups = houseId && !isMovableList
          ? [{ key: houseId, name: null as string | null, rows: cellRows }]
          : agingMatrix.rows
              .map((r) => ({ key: r.supplyHouseId, name: r.name as string | null, rows: cellRows.filter((inv) => inv.supply_house_id === r.supplyHouseId) }))
              .filter((g) => g.rows.length > 0)
        // v2.5694: the window by job. The strip answers the cell's question first: how much is on a job account. Then
        // each house's rows sit under their job, whose heading says its job-account state in words and holds its press.
        const allocationsOf = (id: string) => agingCellJobs.allocations[id] ?? []
        const accountOf = (jobId: string, hId: string) => (agingCellAccountsLoaded ? agingCellAccounts[`${jobId}:${hId}`] ?? null : undefined)
        const byHouse = groups.map((g) => ({ ...g, byJob: groupAgingCellByJob(g.rows, allocationsOf, accountOf) }))
        const accountSplit = agingCellAccountSplit(cellRows)
        const showSplit = !isMovableList && !isCredits && cellRows.length > 0
        const onPct = accountSplit.onAmount + accountSplit.offAmount > 0 ? (accountSplit.onAmount / (accountSplit.onAmount + accountSplit.offAmount)) * 100 : 0
        const jobsLine = agingCellAccountsLoaded ? agingCellJobsLine(byHouse.flatMap((g) => g.byJob.jobs), houseId ? houseName : null) : ''
        const money = (n: number) => (n < 0 ? `−$${formatCurrency(Math.abs(n))}` : `$${formatCurrency(n)}`)
        const jobLabelOf = (jobId: string) => {
          const d = agingCellJobs.jobs[jobId]
          return d ? { num: effectiveJobLedgerNumber(d.hcp_number, d.click_number) || '', name: d.job_name || '—' } : { num: '', name: jobId.slice(0, 8) }
        }
        const jobsText = (invoiceId: string) =>
          allocationsOf(invoiceId)
            .map((a) => {
              const j = jobLabelOf(a.job_id)
              return `${j.num ? `${j.num} · ` : ''}${j.name} (${a.pct}%)`
            })
            .join(', ')
        // markOnTitle: the row offers Mark it on (with these words on hover) when not flagged and past its window.
        const renderRow = (inv: AgingInvoiceRow, markOnTitle: string | null, note: string | null) => {
          const credit = isSupplyCredit(inv.amount)
          const isOn = inv.on_job_account === true
          // PR 3: a still-current single-job row moves through the move modal, never a bare flag.
          const movableRow = !isOn && isMovableAgingInvoice(inv, allocationsOf(inv.id).length, agingTodayYmd, agingMoveData.notNeeded.has(inv.id) ? 'not_needed' : null)
          const moveAsk = movableRow ? agingMoveData.asks[inv.id] ?? null : null
          const openMoveModal = () => {
            setAgingMoveModalFor(inv.id)
            setAgingMoveAttest(false)
            setAgingMoveError(null)
          }
          const days = inv.due_date && !credit ? daysPastDue(inv.due_date, agingTodayYmd) : null
          const po = inv.purchase_order_number?.trim()
          const poDate = `${po ? `PO ${po} · ` : ''}${formatYmdLocal(inv.invoice_date)}`
          const pair = creditPairingLine(inv, agingUnpaidInvoices)
          const rowNote = [pair, note].filter(Boolean).join(' · ')
          return (
            <div key={inv.id} className="aging-win-row">
              <span className="aging-win-inv">{inv.invoice_number}</span>
              <span className="aging-win-po" title={poDate}>{poDate}</span>
              {/* A credit never wears an age chip — it has a size, not an age (v2.3500). */}
              {credit ? (
                <span className="aging-win-age" />
              ) : !inv.due_date ? (
                <span className="aging-win-age">no due date</span>
              ) : days != null && days > 0 ? (
                <span className={`aging-win-age ${days >= 60 ? 'aging-win-age--old' : 'aging-win-age--late'}`} title={`${days} days past due · due ${formatYmdLocal(inv.due_date)}`}>
                  {days} d
                </span>
              ) : (
                <span className="aging-win-age" title={`Due ${formatYmdLocal(inv.due_date)}`}>
                  due {Number(inv.due_date.slice(5, 7))}/{Number(inv.due_date.slice(8, 10))}
                </span>
              )}
              <span className={`aging-win-amt${credit ? ' aging-win-amt--credit' : ''}`}>{money(Number(inv.amount ?? 0))}</span>
              <span className="aging-win-rowstate">
                {credit ? null : isOn ? (
                  <button type="button" className="aging-win-state aging-win-state--on" onClick={() => void setInvoiceJobAcct(inv, false)} title={`${JOB_ACCOUNT_LINE_TITLE} Press to take it off.`}>
                    On it ✓
                  </button>
                ) : movableRow ? (
                  moveAsk ? (
                    (() => {
                      const age = ageState(moveAsk.requested_at, undefined, SUPPLY_MOVE_ASK_AGE)
                      return (
                        <button
                          type="button"
                          onClick={openMoveModal}
                          title={`The move was asked for by ${moveAsk.via}${moveAsk.sent_to ? ` (${moveAsk.sent_to})` : ''} — follow up with a call, then mark it moved`}
                          style={{ padding: '1px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', font: 'inherit', background: age === 'red' ? 'var(--bg-red-100)' : 'var(--bg-amber-tint)', color: age === 'red' ? 'var(--text-red-800)' : 'var(--text-amber-800)' }}
                        >
                          asked {formatYmdLocal(calendarYmdInAppTzFromIso(moveAsk.requested_at))} · follow up ☎
                        </button>
                      )
                    })()
                  ) : (
                    <button
                      type="button"
                      className="aging-win-btn"
                      onClick={openMoveModal}
                      title={`Movable${inv.due_date ? ` until ${formatYmdLocal(inv.due_date)}` : ''}. A house moves a charge onto the job account only while it is current. Start the move with a call or an emailed request.`}
                    >
                      Move it…
                    </button>
                  )
                ) : markOnTitle ? (
                  <button type="button" className="aging-win-link" onClick={() => void setInvoiceJobAcct(inv, true)} title={markOnTitle}>
                    Mark it on
                  </button>
                ) : null}
              </span>
              {inv.link ? (
                <a className="aging-win-ext" href={inv.link} target="_blank" rel="noreferrer" title="The invoice" aria-label={`Open invoice ${inv.invoice_number}`}>
                  ↗
                </a>
              ) : (
                <span className="aging-win-ext" />
              )}
              {rowNote ? <span className="aging-win-note">{rowNote}</span> : null}
            </div>
          )
        }
        const renderJob = (job: AgingCellJobGroup<AgingInvoiceRow>) => {
          const j = jobLabelOf(job.jobId)
          const words = agingCellJobStateWords(job.state, houseNameOf(job.houseId))
          // A past-due bill is marked on with one press per row. With an open account every such row offers it. With
          // none on record, Flag anyway unfolds the same press for this job (the to-do #132 call: never a block).
          const jobKey = `${job.jobId}:${job.houseId}`
          const noAccount = job.state.kind === 'none' || job.state.kind === 'requested' || job.state.kind === 'not_needed'
          const pastWindowOff = job.rows.filter((r) => r.on_job_account !== true && !isMovableAgingInvoice(r, 1, agingTodayYmd)).length
          const anywayOpen = noAccount && agingCellFlagAnywayFor === jobKey
          const markOnTitle =
            job.state.kind === 'open'
              ? 'The job account is open at this house. One press marks this invoice on it.'
              : anywayOpen
                ? 'No job account on record. This only records that the house carries this bill on one. The house roster keeps its bought, no account line.'
                : null
          const n = job.rows.length
          return (
            <div key={`${job.jobId}:${job.houseId}`} className="aging-win-job">
              <div className="aging-win-job-head">
                <div className="aging-win-job-name">
                  {j.num ? <span className="aging-win-job-num">{j.num}</span> : null}
                  {j.name}
                </div>
                <div className="aging-win-job-act">
                  <span className={`aging-win-state aging-win-state--${words.tone}`}>{words.label}</span>
                  {job.state.kind === 'none' || job.state.kind === 'requested' ? (
                    <button type="button" className="aging-win-btn" onClick={() => setAgingCellMarkOpenedFor({ inv: job.rows[0]!, flagOnOpen: false })}>
                      Mark opened…
                    </button>
                  ) : null}
                  {noAccount && pastWindowOff > 0 ? (
                    <button
                      type="button"
                      className="aging-win-link"
                      aria-pressed={anywayOpen}
                      onClick={() => setAgingCellFlagAnywayFor(anywayOpen ? null : jobKey)}
                      title="Flag a bill as on the job account with no account on record"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {anywayOpen ? 'Done' : 'Flag anyway…'}
                    </button>
                  ) : null}
                </div>
                <div className="aging-win-job-meta">
                  {n} {n === 1 ? 'invoice' : 'invoices'} · {money(job.total)}
                  {job.onCount > 0 && job.offCount > 0 ? ` · ${job.onCount} of ${n} on it` : ''}
                </div>
              </div>
              <div className="aging-win-rows">{job.rows.map((r) => renderRow(r, markOnTitle, null))}</div>
            </div>
          )
        }
        return (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setAgingCellModal(null)
            }}
            style={{ position: 'fixed', inset: 0, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1003 }}
          >
            <div role="dialog" aria-modal="true" aria-label={isMovableList ? 'Still movable: current charges not on a job account' : `${houseName}, ${agingCellTitle(cell)}`} style={{ background: 'var(--surface)', borderRadius: 8, maxHeight: 'min(90vh, 100%)', overflow: 'auto', ...stickyModalPanelStyle(800) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', ...stickyModalHeaderStyle() }}>
                <div>
                  {/* v2.5766: the house is the title and the bucket a chip beside it; the subtitle says one thing. */}
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isMovableList ? 'Still movable' : houseName}
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, padding: '1px 9px', borderRadius: 999, border: '1px solid var(--border-strong)', color: isMovableList || cell === 'current' || cell === 'noDueDate' || cell === 'owed' || cell === 'credits' ? 'var(--text-muted)' : '#b42318', whiteSpace: 'nowrap' }}>
                      {isMovableList ? 'current charges not on a job account' : agingCellTitle(cell)}
                    </span>
                  </h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {isMovableList
                      ? 'A house moves a charge onto the job account only while it is current. Call the rep, or email the request and follow up, then mark each one moved.'
                      : `${cellRows.length} unpaid ${noun}, the cell's sum`}
                  </p>
                </div>
                <button type="button" onClick={() => setAgingCellModal(null)} style={STICKY_MODAL_CLOSE_BUTTON_STYLE} aria-label="Close">×</button>
              </div>
              {showSplit ? (
                <div className="aging-win-split">
                  <div className="aging-win-split-row">
                    <div className="aging-win-fig aging-win-fig--on">
                      <b>{money(accountSplit.onAmount)}</b>
                      <span>on job accounts · {accountSplit.onCount} of {accountSplit.onCount + accountSplit.offCount} · the owners' debt</span>
                    </div>
                    <div className="aging-win-fig aging-win-fig--off">
                      <b>{money(accountSplit.offAmount)}</b>
                      <span>not on one · {accountSplit.offCount} of {accountSplit.onCount + accountSplit.offCount} · Click's debt</span>
                    </div>
                  </div>
                  <div className="aging-win-bar" role="img" aria-label={`${money(accountSplit.onAmount)} on job accounts, ${money(accountSplit.offAmount)} not on one`}>
                    {accountSplit.onAmount > 0 ? <i className="aging-win-bar-on" style={{ width: `${onPct}%` }} /> : null}
                    {accountSplit.offAmount > 0 ? <i className="aging-win-bar-off" style={{ width: `${100 - onPct}%` }} /> : null}
                  </div>
                  {jobsLine ? <p className="aging-win-why">{jobsLine}</p> : null}
                </div>
              ) : null}
              {cellRows.length === 0 ? (
                <EmptyState compact main={isMovableList ? 'Nothing left to move. Every current charge that belongs on a job account is on one. ✓' : 'Nothing is left in this cell.'} />
              ) : !agingCellAccountsLoaded ? (
                <p style={{ margin: 0, padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Reading the jobs…</p>
              ) : (
                byHouse.map((g) => (
                  <Fragment key={g.key}>
                    {g.name ? (
                      <div className="aging-win-house">
                        {g.name} · {money(g.rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0))}
                        {isMovableList ? (() => {
                          const rep = (agingCellReps[g.key] ?? []).find((r) => typeof r.email === 'string' && r.email.includes('@')) ?? (agingCellReps[g.key] ?? [])[0]
                          const unasked = g.rows.filter((r) => !agingMoveData.asks[r.id])
                          const busyKey = `house:${g.key}`
                          return (
                            <>
                              {rep ? (
                                <span style={{ marginLeft: '0.6rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#0f766e' }}>
                                  ☎ {(rep.name ?? '').trim() || rep.email}{'phone' in rep && rep.phone ? ` · ${rep.phone}` : ''}
                                </span>
                              ) : (
                                <span style={{ marginLeft: '0.6rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--text-amber-800)' }}>no job-accounts rep on file — add one on the house</span>
                              )}
                              {rep && typeof rep.email === 'string' && rep.email.includes('@') && unasked.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => void sendMoveRequest(unasked.map((r) => r.id), busyKey, false)}
                                  disabled={agingMoveBusy === busyKey}
                                  style={{ marginLeft: '0.6rem', padding: '0.1rem 0.55rem', fontSize: '0.7rem', fontWeight: 600, textTransform: 'none', letterSpacing: 0, background: 'transparent', color: '#0f766e', border: '1px solid #0f766e', borderRadius: 4, cursor: 'pointer', font: 'inherit', opacity: agingMoveBusy === busyKey ? 0.6 : 1 }}
                                >
                                  {agingMoveBusy === busyKey ? 'Sending…' : `✉ Email ${(rep.name ?? '').trim().split(' ')[0] || 'the rep'} the list ›`}
                                </button>
                              ) : null}
                            </>
                          )
                        })() : null}
                      </div>
                    ) : null}
                    {g.byJob.jobs.map(renderJob)}
                    {g.byJob.split.length > 0 ? (
                      <div className="aging-win-job">
                        <div className="aging-win-job-head">
                          <div className="aging-win-job-name">Split across jobs</div>
                          <div className="aging-win-job-meta">A job account belongs to one property. A split invoice cannot sit on one.</div>
                        </div>
                        <div className="aging-win-rows">{g.byJob.split.map((r) => renderRow(r, null, jobsText(r.id)))}</div>
                      </div>
                    ) : null}
                    {g.byJob.noJob.length > 0 ? (
                      <div className="aging-win-job">
                        <div className="aging-win-job-head">
                          <div className="aging-win-job-name">No job yet</div>
                          <div className="aging-win-job-meta">Open {houseNameOf(g.key)} and choose its job first.</div>
                        </div>
                        <div className="aging-win-rows">{g.byJob.noJob.map((r) => renderRow(r, null, null))}</div>
                      </div>
                    ) : null}
                    {g.byJob.credits.length > 0 ? (
                      <div className="aging-win-job">
                        {isCredits ? null : (
                          <div className="aging-win-job-head">
                            <div className="aging-win-job-name">Credit memos</div>
                          </div>
                        )}
                        <div className="aging-win-rows" style={isCredits ? { paddingTop: '0.4rem' } : undefined}>
                          {g.byJob.credits.map((r) => renderRow(r, null, allocationsOf(r.id).length > 0 ? jobsText(r.id) : null))}
                        </div>
                      </div>
                    ) : null}
                  </Fragment>
                ))
              )}
              {/* Sticky pins to the panel's content box: the negative bottom and margin cover its bottom padding, so no
                  row shows through under the pinned footer. */}
              <div style={{ position: 'sticky', bottom: '-1.5rem', zIndex: 2, background: 'var(--surface)', borderTop: '1px solid var(--border)', margin: '0 -1.5rem -1.5rem', padding: '0.6rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600 }}>
                  {isMovableList ? (
                    <>
                      {cellRows.length === 0 ? 'All moved or marked.' : `${movableToAsk} to ask · ${cellRows.length - movableToAsk} asked, awaiting the house · $${formatCurrency(total)}`}
                      {agingMoveError ? <span style={{ display: 'block', fontWeight: 500, color: 'var(--text-red-700)' }}>{agingMoveError}</span> : null}
                    </>
                  ) : (
                    <>
                  {isCredits ? 'Open credits' : 'Cell total'}: {money(total)}
                    </>
                  )}
                </div>
                {houseId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAgingCellModal(null)
                      openHouseFromAging(houseId)
                    }}
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Open {houseName} ›
                  </button>
                ) : null}
              </div>
              {/* PR 3: the move modal — the attested call, or the emailed request with a follow-up. */}
              {agingMoveModalFor && (() => {
                const inv = agingUnpaidInvoices.find((r) => r.id === agingMoveModalFor)
                if (!inv) return null
                const allocations = agingCellJobs.allocations[inv.id] ?? agingMoveData.allocations[inv.id] ?? []
                const jobId = allocations.length === 1 ? allocations[0]!.job_id : null
                if (!jobId) return null
                const d = agingCellJobs.jobs[jobId]
                const jobLabel = d ? `${effectiveJobLedgerNumber(d.hcp_number, d.click_number) || '—'} · ${d.job_name || '—'}` : 'its job'
                const key = `${jobId}:${inv.supply_house_id}`
                const account = agingCellAccounts[key] ?? null
                const reps = agingCellReps[inv.supply_house_id] ?? []
                const rep = reps.find((r) => typeof r.email === 'string' && r.email.includes('@')) ?? reps[0] ?? null
                const repHasEmail = rep != null && typeof rep.email === 'string' && rep.email.includes('@')
                const moveAsk = agingMoveData.asks[inv.id] ?? null
                const daysLeft = inv.due_date ? -daysPastDue(inv.due_date, agingTodayYmd) : 0
                const thisHouse = houseNameOf(inv.supply_house_id)
                const closeMove = () => {
                  setAgingMoveModalFor(null)
                  setAgingMoveAttest(false)
                  setAgingMoveError(null)
                }
                return (
                  <div
                    onClick={(e) => {
                      if (e.target === e.currentTarget) closeMove()
                    }}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem 1rem' }}
                  >
                    <div role="dialog" aria-modal="true" aria-label={`Move ${inv.invoice_number} onto the job account`} style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(560px, 100%)', maxHeight: 'min(88vh, 100%)', overflow: 'auto', padding: '1rem 1.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Move {inv.invoice_number} onto the job account</h3>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            {thisHouse} · {jobLabel} · ${formatCurrency(inv.amount)}{inv.due_date ? <> · due {formatYmdLocal(inv.due_date)} — <strong style={{ color: 'var(--text-amber-800)' }}>{daysLeft} day{daysLeft === 1 ? '' : 's'} left in the window</strong></> : null}
                          </p>
                        </div>
                        <button type="button" onClick={closeMove} style={STICKY_MODAL_CLOSE_BUTTON_STYLE} aria-label="Close">×</button>
                      </div>
                      {account?.status === 'open' ? (
                        <div style={{ margin: '0.7rem 0 0', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', fontSize: '0.8125rem' }}>
                          Job account open{account.account_ref ? ` · ref ${account.account_ref}` : ''}{account.opened_at ? ` · ${openedViaPhrase(account.opened_via)} ${new Date(account.opened_at).toLocaleDateString()}` : ''}.
                        </div>
                      ) : (
                        <div style={{ margin: '0.7rem 0 0', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ flex: '1 1 14rem' }}>No job account on record for this job — ask {rep?.name?.trim() || 'the house'} to open one on the same call.</span>
                          <button
                            type="button"
                            onClick={() => setAgingCellMarkOpenedFor({ inv, flagOnOpen: true })}
                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, background: '#0f766e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}
                          >
                            Mark opened…
                          </button>
                        </div>
                      )}
                      {moveAsk ? (
                        <div style={{ margin: '0.5rem 0 0', padding: '0.45rem 0.6rem', borderRadius: 6, background: ageState(moveAsk.requested_at, undefined, SUPPLY_MOVE_ASK_AGE) === 'red' ? 'var(--bg-red-100)' : 'var(--bg-amber-tint)', color: ageState(moveAsk.requested_at, undefined, SUPPLY_MOVE_ASK_AGE) === 'red' ? 'var(--text-red-800)' : 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
                          Asked by {moveAsk.via} {formatYmdLocal(calendarYmdInAppTzFromIso(moveAsk.requested_at))}{moveAsk.sent_to ? ` (${moveAsk.sent_to})` : ''} — follow up with a call{rep ? `: ☎ ${(rep.name ?? '').trim() || rep.email}${'phone' in rep && rep.phone ? ` · ${rep.phone}` : ''}` : ''}.
                        </div>
                      ) : null}
                      <div style={{ margin: '0.9rem 0 0.25rem', fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                        The call{rep ? ` — ☎ ${(rep.name ?? '').trim() || rep.email}${'phone' in rep && rep.phone ? ` · ${rep.phone}` : ''}` : ''}
                      </div>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={agingMoveAttest}
                          onChange={(e) => setAgingMoveAttest(e.target.checked)}
                          style={{ marginTop: 2, accentColor: '#0f766e' }}
                        />
                        <span>I called {thisHouse}{rep?.name?.trim() ? ` (${rep.name.trim()})` : ''} — this charge was moved onto the job account.</span>
                      </label>
                      <button
                        type="button"
                        disabled={!agingMoveAttest || agingMoveBusy === 'move'}
                        onClick={() => void markMovedConfirmed(inv, jobId)}
                        style={{ marginTop: '0.5rem', padding: '0.35rem 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: '#0f766e', color: 'white', border: 'none', borderRadius: 5, cursor: !agingMoveAttest || agingMoveBusy === 'move' ? 'not-allowed' : 'pointer', opacity: !agingMoveAttest || agingMoveBusy === 'move' ? 0.5 : 1 }}
                      >
                        {agingMoveBusy === 'move' ? 'Marking…' : 'Mark it moved ✓'}
                      </button>
                      {!moveAsk ? (
                        <>
                          <div style={{ margin: '1rem 0 0.25rem', fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Or ask by email — we follow up with a call
                          </div>
                          {repHasEmail ? (
                            <>
                              <div style={{ padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                <div><strong style={{ color: 'var(--text-base)' }}>To:</strong> {(rep!.name ?? '').trim() || 'Job accounts'} · {rep!.email}</div>
                                <div><strong style={{ color: 'var(--text-base)' }}>Subject:</strong> Move invoice {inv.invoice_number} to the {jobLabel.split(' ·')[0]} job account</div>
                                <div style={{ marginTop: '0.3rem', borderTop: '1px dashed var(--border)', paddingTop: '0.3rem' }}>
                                  Please move this charge onto the job account for {jobLabel}: {inv.invoice_number} · {formatYmdLocal(inv.invoice_date)} · ${formatCurrency(inv.amount)}{inv.purchase_order_number?.trim() ? ` · PO ${inv.purchase_order_number}` : ''}.{' '}
                                  {account?.status === 'open' && account.account_ref ? `Account ref ${account.account_ref}.` : 'No account on this job yet — please open one with it.'} We'll call to confirm. Replies come to you.
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={agingMoveBusy === 'send'}
                                onClick={() => void sendMoveRequest([inv.id], 'send', false)}
                                style={{ marginTop: '0.5rem', padding: '0.35rem 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: '#0f766e', color: 'white', border: 'none', borderRadius: 5, cursor: agingMoveBusy === 'send' ? 'not-allowed' : 'pointer', opacity: agingMoveBusy === 'send' ? 0.6 : 1 }}
                              >
                                {agingMoveBusy === 'send' ? 'Sending…' : 'Send the request ›'}
                              </button>
                            </>
                          ) : (
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
                              No job-accounts rep with an email on file for {thisHouse} — add one on the house, or call.
                            </p>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={agingMoveBusy === 'send' || !repHasEmail}
                          onClick={() => void sendMoveRequest([inv.id], 'send', true)}
                          style={{ marginTop: '0.75rem', padding: '0.25rem 0.6rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', font: 'inherit' }}
                        >
                          {agingMoveBusy === 'send' ? 'Sending…' : 'Send the email again ›'}
                        </button>
                      )}
                      {agingMoveError ? <p style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{agingMoveError}</p> : null}
                    </div>
                  </div>
                )
              })()}
              {/* A job heading's or the move modal's Mark opened… — the shared v2.3423 sheet, stacked above (z 1100). */}
              {agingCellMarkOpenedFor && (() => {
                const { inv, flagOnOpen } = agingCellMarkOpenedFor
                const alloc = agingCellJobs.allocations[inv.id] ?? []
                const jobId = alloc.length === 1 ? alloc[0]!.job_id : null
                if (!jobId) return null
                const d = agingCellJobs.jobs[jobId]
                const key = `${jobId}:${inv.supply_house_id}`
                return (
                  <MarkJobAccountOpenedModal
                    jobId={jobId}
                    jobLabel={d ? `${effectiveJobLedgerNumber(d.hcp_number, d.click_number) || '—'} · ${d.job_name || '—'}` : 'this job'}
                    house={{ id: inv.supply_house_id, name: houseNameOf(inv.supply_house_id) }}
                    existing={agingCellAccounts[key] ?? null}
                    reps={agingCellReps[inv.supply_house_id] ?? []}
                    onClose={() => setAgingCellMarkOpenedFor(null)}
                    onSaved={(row) => {
                      setAgingCellMarkOpenedFor(null)
                      setAgingCellAccounts((prev) => ({ ...prev, [key]: row }))
                      // From the move modal, saved as open flags the invoice the press was about. From a job
                      // heading it only records the account; each invoice then wears its own Mark it on.
                      if (flagOnOpen && row.status === 'open') void setInvoiceJobAcct(inv, true)
                    }}
                  />
                )
              })()}
            </div>
          </div>
        )
      })()}

      {houseEditor.modal}

      {invoiceFormOpen && selectedSupplyHouseForDetail && (() => {
        const house = selectedSupplyHouseForDetail
        const poHintKind = poCodeHint(invoicePurchaseOrderNumber, poGeneratorCodesForSelectedHouse)
        const poHint = poCodeHintText(poHintKind, house.name)
        const poHintTone = poHintKind.kind
        const poEntryCard = poLedgerEntryCard(poHintKind, poGeneratorEntriesForSelectedHouse)
        // v2.3724: the ledger read against the job the invoice is on — the exact code's job must agree,
        // and when the paper carries no code (the house printed the job name) the codes for that job near the date.
        const poJobIds = invoiceJobAllocations.map((a) => a.job_id)
        const poJobMismatch = poLedgerEntryJobMismatch(poHintKind, poGeneratorEntriesForSelectedHouse, poJobIds)
        const poJobMatches = poLedgerJobMatches({ hint: poHintKind, entries: poGeneratorEntriesForSelectedHouse, jobIds: poJobIds, invoiceDateYmd: invoiceDate, houseName: house.name })
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
              {invoiceDocumentKind === 'credit' ? (
                <CreditPairPick rows={supplyHouseInvoices} creditId={editingInvoice?.id ?? null} value={invoiceCreditsInvoiceId} onChange={setInvoiceCreditsInvoiceId} />
              ) : null}
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
                {/* ②b The matched ledger row (v2.3599): what the code was minted for, so the amount above can be read against it. */}
                {poEntryCard ? (
                  <div
                    data-invoice-po-entry
                    style={{ marginTop: '0.4rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600 }}>{poEntryCard.head}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{poEntryCard.meta}</span>
                    </div>
                    <div style={{ marginTop: '0.25rem', paddingLeft: '0.6rem', borderLeft: '3px solid var(--border-strong)' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{STATED_NEED_COLUMN}</div>
                      {poEntryCard.statedNeed ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{poEntryCard.statedNeed}</div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Nothing written down when the code was minted.</div>
                      )}
                    </div>
                    {poJobMismatch ? (
                      <div data-invoice-po-job-mismatch style={{ marginTop: '0.4rem', padding: '0.35rem 0.5rem', borderRadius: 5, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
                        {poJobMismatch}
                      </div>
                    ) : null}
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
              {/* ③b The codes for this job at this house near the invoice date (v2.3724) — the reader for the
                  bills whose PO # is the job's name, not a code. Under the job cards, because it needs the job. */}
              {poJobMatches ? (
                <div data-invoice-po-job-matches style={{ marginBottom: '0.75rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
                  <div style={{ color: poJobMatches.rows.length > 0 ? 'var(--text-strong)' : 'var(--text-muted)', fontWeight: poJobMatches.rows.length > 0 ? 600 : 400 }}>{poJobMatches.line}</div>
                  {poJobMatches.rows.length > 0 ? (
                    <ul style={{ listStyle: 'none', margin: '0.35rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {poJobMatches.rows.map((r) => (
                        <li key={r.code} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>PO {r.code}</span>
                          {poJobMatches.showJob ? <span>{r.jobLabel}</span> : null}
                          <span style={{ color: 'var(--text-muted)' }}>for {r.personName}{r.when ? ` · ${r.when} (${r.apart})` : ''}</span>
                          {r.statedNeed ? <span>— {r.statedNeed}</span> : <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>— nothing written down</span>}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1003, paddingTop: 'var(--app-top-chrome, 0px)' }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Apply Payment</h3>
            <form onSubmit={applyPayment}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="apply-payment-link" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Payment or receipt link (optional)</label>
                <input
                  id="apply-payment-link"
                  type="text"
                  value={applyPaymentLink}
                  onChange={(e) => setApplyPaymentLink(e.target.value)}
                  placeholder="Payment or receipt link..."
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
                {/* v2.3843: filed as each bill's Receipt, beside its invoice scan (link). */}
                <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saved as each bill’s Receipt — its invoice scan stays.</div>
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
                      return (
                        <EmptyState
                          compact
                          {...(applyPaymentShowAll || supplyHouseInvoices.length === 0
                            ? { main: 'No invoices from this house yet.' }
                            : { main: 'Nothing unpaid with this house.', next: { label: 'Show all invoices', onPress: () => setApplyPaymentShowAll(true) }, tail: 'lists the paid ones too.' })}
                        />
                      )
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
                  {savingApplyPayment ? 'Applying…' : countedLabel('Apply to', applyPaymentSelectedIds.size, 'invoice')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
