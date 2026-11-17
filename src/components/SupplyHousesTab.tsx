import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { supplyBookTotal, supplyHouseCardMoney, ordinalDay } from '../lib/materials/supplyHousePhone'
import { SupplyHousePhoneScreen } from './materials/SupplyHousePhoneScreen'
import { telHrefFor } from '../lib/phoneContact'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { supabasePaperIo, type PaperIo } from '../lib/materials/lines/paperIo'
import type { PaperRow } from '../lib/materials/lines/paperRows'
import { PaperLookModal } from './materials/PaperLookModal'
import { BillLinesHeld } from './materials/BillLinesHeld'
import { supabaseHeldBillsIo, type HeldBillsIo } from '../lib/materials/lines/heldBillsIo'
import { billsToRecordWords } from '../lib/materials/bills/billWords'
import { useAuth } from '../hooks/useAuth'
import { formatErrorMessage } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { formatCurrency } from '../lib/format'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { longTimeAgoPhrase } from '../lib/subcontractorLastActivityCompact'
import {
  AGING_BUCKETS,
  agingCellModalDoors,
  agingCellRowDoors,
  agingCellTitle,
  buildSupplyHouseAgingMatrix,
  countSupplyHousesPastDue60,
  supplyHouseAgingPhoneNote,
  daysPastDue,
  invoicesForAgingCell,
  isMovableAgingInvoice,
  movableCandidates,
  movableWindowRows,
  moveStripSummary,
  notNeededInvoiceIds,
  singleJobPairs,
  withEmailedAsks,
  type MoveAsk,
  type AgingBucketKey,
  type AgingCellKey,
} from '../lib/supplyHouseAging'
import { AgingInvoiceDoor, AgingMakePaymentDoor, AgingRowDoors } from './materials/AgingCellDoors'
import { SUPPLY_MOVE_ASK_AGE, ageState } from '../lib/ageState'
import { SupplyHouseDirectory } from './materials/SupplyHouseDirectory'
import { useSupplyHouseEditor } from './materials/useSupplyHouseEditor'
import { SupplyHouseWebsiteLink } from './SupplyHouseWebsiteLink'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { STICKY_MODAL_CLOSE_BUTTON_STYLE, stickyModalHeaderStyle, stickyModalPanelStyle } from '../lib/stickyModalHeaderStyle'
import {
  groupAllocationsByInvoice,
  creditPairingLine,
} from '../lib/materials/supplyHouseInvoiceForm'
import { ariaSortFor, nextSupplyHouseSummarySort, parseSupplyHouseSummarySort, serializeSupplyHouseSummarySort, sortSupplyHouseSummary, type SupplyHouseSummarySort, type SupplyHouseSummarySortKey } from '../lib/materials/supplyHouseSummarySort'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { SupplyHouseJobAccountsSection } from './materials/SupplyHouseJobAccountsSection'
import { SupplyHouseJobAccountsRoster } from './materials/SupplyHouseJobAccountsRoster'
import { MarkJobAccountOpenedModal } from './materials/MarkJobAccountOpenedModal'
import { accountsByPair, openedViaPhrase, repsByHouse, type JobAccountRep, type JobSupplyHouseAccountRow } from '../lib/materials/jobSupplyHouseAccounts'
import { agingCellAccountSplit, agingCellJobStateWords, agingCellJobsLine, groupAgingCellByJob, type AgingCellJobGroup } from '../lib/materials/agingCellByJob'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useReportQuickfillSectionMetric } from '../contexts/QuickfillSectionMetricsContext'
import { supplyHousesNextLine } from '../lib/quickfill/nextLine'
import { todayYmdInAppTz, calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { isSupplyCredit } from '../lib/supplyHouseDocument'
import { billDateWords } from '../lib/materials/supplyBillGroups'
import { removedLately } from '../lib/materials/payments/supplyPaymentMove'
import { supabaseSupplyFinishIo } from '../lib/materials/payments/supplyPaymentsFinishIo'
import { SupplyPaymentsToFinish } from './materials/SupplyPaymentsToFinish'
import { SupplyPaymentHowEditor } from './materials/SupplyPaymentHowEditor'
import { SupplyBankUnclaimed } from './materials/SupplyBankUnclaimed'
import { useSupplyHouseBank } from '../hooks/useSupplyHouseBank'
import { supabaseSupplyBankIo } from '../lib/materials/payments/supplyPaymentBankIo'
import { bankCandidatesFor, supplyBankLineWords } from '../lib/materials/payments/supplyPaymentBank'
import type { SupplyPayChip } from '../lib/materials/payments/supplyPayment'
import { SupplyHouseBillsCard } from './materials/SupplyHouseBillsCard'
import { houseOnAccountTotal, jobsLedgerNames, paymentWindowBills, recordPaymentBills, supplyBillCardRows, supplyBillsToList, supplyPhoneBills, typedPaidBillIds, type JobsLedgerNameRow } from '../lib/materials/supplyHouseBillRows'
import { RecordSupplyPaymentModal } from './materials/RecordSupplyPaymentModal'
import { supabaseSupplyPaymentsIo } from '../lib/materials/payments/supplyPaymentsIo'
import { billPaidBy, lastMethodUsed } from '../lib/materials/payments/supplyPayment'
import { SupplyPaymentWindow } from './materials/SupplyPaymentWindow'
import { EmptyState } from './EmptyState'
import { SupplyHouseInvoiceFormModal } from './materials/SupplyHouseInvoiceFormModal'
import { useSupplyHouseAccountsPayable, type AgingInvoiceRow, type InvoiceJobAllocation } from './materials/useSupplyHouseAccountsPayable'
import { useSupplyHouseInvoiceForm, type SupplyHouse, type SupplyHouseInvoice, type SupplyHousesTabRole } from './materials/useSupplyHouseInvoiceForm'
import { SUPPLY_HOUSE_AGING_EMPTY, supplyHouseInvoicesEmptyWords, supplyHousePosEmptyWords } from '../lib/materials/materialsEmptyWords'

type UserRole = SupplyHousesTabRole

/** An open (unconfirmed) job-account move ask (PR 3) — the follow-up the office owes. */
type MoveAskRow = MoveAsk

/**
 * Format a DATE-only column (YYYY-MM-DD) in the user's locale. `new Date('2026-07-10')` parses
 * as UTC midnight, which renders as the PREVIOUS day in US timezones — parse at local noon.
 */
function formatYmdLocal(ymd: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(ymd + 'T12:00:00') : new Date(ymd)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString()
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
  openList?: 'movable' | 'finish' | null
  onOpenListHandled?: () => void
  /** The thread's *Record this bill* (punch list #179, v2.6095): the thread file to pick on the Add invoice window once the house is open. */
  openBill?: string | null
  onOpenBillHandled?: () => void
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
  openBill,
  onOpenBillHandled,
}: SupplyHousesTabProps) {
  const navigate = useNavigate()
  const { user: authUser, role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const myRole = myRoleProp ?? (authRole as UserRole | null) ?? null


  const [error, setError] = useState<string | null>(null)
  /** Bumped after every house save so the Directory pane refetches reps and request history. */
  const [directoryReloadKey, setDirectoryReloadKey] = useState(0)

  // The data: the house list, the book and the open house, with their loaders. One engine for both mounts.
  const {
    supplyHousesList,
    supplyHouseSummary,
    supplyHouseSummaryLoading,
    agingUnpaidInvoices,
    setAgingUnpaidInvoices,
    agingBookLoaded,
    selectedSupplyHouseForDetail,
    setSelectedSupplyHouseForDetail,
    supplyHouseInvoices,
    setSupplyHouseInvoices,
    supplyHousePOs,
    poGeneratorEntriesForSelectedHouse,
    setPoGeneratorEntriesForSelectedHouse,
    poGeneratorCodesForSelectedHouse,
    supplyHouseDetailLoading,
    supplyHouseJobDetailsMap,
    housePayments,
    setHousePayments,
    interestYearWords,
    paidThisVisit,
    setPaidThisVisit,
    loadSupplyHouses,
    loadSupplyHouseSummary,
    loadSupplyHouseDetail,
    loadHousePayments,
  } = useSupplyHouseAccountsPayable({ supplyHousesProp, onSupplyHousesChange, autoOpenHouseId, onAutoOpenHouseHandled, setError, loadPapersFor })
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
   * PR 4 (the doors): the one row or house whose detail is loading behind a press, so a second
   * press cannot open two forms; the field the form opens on (Add a due date › / Pick a job ›);
   * and a counter the form's save bumps so the open modal re-reads its jobs (a job picked from
   * the modal moves the row out of No job yet without closing and reopening it).
   */
  const [agingCellDoorBusy, setAgingCellDoorBusy] = useState<string | null>(null)
  const agingCellFormFocusRef = useRef<'invoice-due' | 'invoice-job-search' | null>(null)
  const [agingCellJobsRefresh, setAgingCellJobsRefresh] = useState(0)
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
  const [agingMoveModalFor, setAgingMoveModalFor] = useState<string | null>(null)
  const [agingMoveAttest, setAgingMoveAttest] = useState(false)
  const [agingMoveBusy, setAgingMoveBusy] = useState<null | 'send' | 'move' | string>(null)
  const [agingMoveError, setAgingMoveError] = useState<string | null>(null)
  /**
   * Supply house bill lines (punch list #298 PR 1b, v2.6819): the paper read from each bill's PDF, by invoice id, for
   * the row's Lines cell; the Look window beside its paper. A bill saved from a fill writes its paper at Save.
   */
  const paperIo = useMemo<PaperIo>(() => supabasePaperIo(), [])
  const [papersByInvoice, setPapersByInvoice] = useState<Map<string, PaperRow>>(() => new Map())
  const [paperNames, setPaperNames] = useState<Map<string, string>>(() => new Map())
  const [paperLook, setPaperLook] = useState<{ paper: PaperRow; invoice: SupplyHouseInvoice; bytes: ArrayBuffer | null } | null>(null)
  async function loadPapersFor(invoices: ReadonlyArray<{ id: string }>) {
    const papers = await paperIo.loadForInvoices(invoices.map((i) => i.id))
    setPapersByInvoice(papers)
    const who = [...new Set([...papers.values()].map((p) => p.acceptedBy).filter((v): v is string => !!v))]
    if (who.length > 0) setPaperNames(await paperIo.namesOf(who))
  }
  /**
   * The bills that need a person (punch list #298 PR 3, v2.7110): the one line under Accounts payable and its window.
   * The line reads again after a bill is saved or a paper is fixed (`linesRefresh`). *Open the bill* opens the bill's
   * house and its own Edit window, where the link, the number and the amount are.
   */
  const heldIo = useMemo<HeldBillsIo>(() => supabaseHeldBillsIo(), [])
  const [linesRefresh, setLinesRefresh] = useState(0)
  async function openBillFromLines(bill: { invoiceId: string; houseId: string | null }) {
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === bill.houseId)
    if (!sh) return
    const invoices = selectedSupplyHouseForDetail?.id === sh.id ? supplyHouseInvoices : await loadSupplyHouseDetail(sh)
    const inv = invoices.find((i) => i.id === bill.invoiceId)
    if (inv) openEditInvoice(inv)
  }
  async function paperBytesOf(filePath: string): Promise<ArrayBuffer | null> {
    const url = await billsIo.fileUrl(filePath).catch(() => null)
    return url ? fetch(url).then((r) => r.arrayBuffer()).catch(() => null) : null
  }
  async function openPaperLook(inv: SupplyHouseInvoice) {
    const paper = papersByInvoice.get(inv.id)
    if (!paper) return
    setPaperLook({ paper, invoice: inv, bytes: paper.filePath ? await paperBytesOf(paper.filePath) : null })
  }
  /** Record a payment (2026-11-16): the window that took Apply Payment's place, and the open house's payments. */
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  /** The payment a paid row opened, by id. */
  const [paymentViewId, setPaymentViewId] = useState<string | null>(null)
  /** The finish-later list under Accounts payable: opened by the Needs You door, and read again when a payment changes. */
  const [finishListOpen, setFinishListOpen] = useState(false)
  const [finishReloadKey, setFinishReloadKey] = useState(0)
  /** The payment whose "how it was sent" is being edited from its own window or a paid row. */
  const [howEditId, setHowEditId] = useState<string | null>(null)
  /** The removed payment whose Put it back is saving. */
  const [puttingBackPaymentId, setPuttingBackPaymentId] = useState<string | null>(null)
  /** The bank side (v2.7471): the feed's money out, the matches that stand, and the lines to a house nobody recorded. Supply houses only: a line to an insurer or a rental yard is not a bill's payment. */
  const bankHouses = useMemo(() => supplyHousesList.filter((h: SupplyHouse) => (h.vendor_kind ?? 'supply_house') === 'supply_house').map((h: SupplyHouse) => ({ id: h.id, name: h.name })), [supplyHousesList])
  const bankSide = useSupplyHouseBank(agingBookLoaded, supabaseSupplyBankIo, bankHouses)
  /** Record a payment opened from a bank line: what to fill, and the line the recorded payment is matched to. */
  const [recordStart, setRecordStart] = useState<{ lineId: string; amount: number; paidOn: string; chip: SupplyPayChip; words: string } | null>(null)
  const [creatingPOForSupplyHouse, setCreatingPOForSupplyHouse] = useState(false)
  const [firstServiceTypeId, setFirstServiceTypeId] = useState<string | null>(null)
  // The three Accounts-payable toggles survive a refresh (v2.3568 — a May follow-up;
  // docs/recent-features/v2.3568.md). Per device; storage may be unavailable.
  /** v2.5693: the Directory folds away — the office lives in Accounts payable (the owner's ask, 2026-10-21). Collapsed by default, remembered per device. */
  const [directoryOpen, setDirectoryOpen] = useState(() => readRememberedToggle('directory-open', false))
  const [showPaidInvoices, setShowPaidInvoices] = useState(() => readRememberedToggle('show-paid-invoices', false))
  // Punch list #334 PR 5: a house's card opens on its bills. The job accounts fold under them, and start folded.
  const [jobAccountsOpen, setJobAccountsOpen] = useState(() => readRememberedToggle('job-accounts-open', false))
  useEffect(() => writeRememberedToggle('job-accounts-open', jobAccountsOpen), [jobAccountsOpen])
  /** The bill whose Mark paid is saving, and the bills marked paid on this visit, which stay where they were. */
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
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
  /** The house's row (punch list #179): how many files on its thread wait to be recorded, and the press that opens the form on the first. */
  const billPill = (houseId: string): ReactNode => {
    const words = billsToRecordWords(billCounts.get(houseId) ?? 0)
    if (!words || !billFillOn) return null
    return (
      <span data-bills-to-record={houseId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem', verticalAlign: 'middle' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.05rem 0.5rem', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}>{words.pill}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openHouseOnBill(houseId, null)
          }}
          style={{ font: 'inherit', fontSize: '0.7rem', fontWeight: 600, padding: '0.05rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {words.press}
        </button>
      </span>
    )
  }
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


  async function loadFirstServiceType() {
    const { data } = await supabase.from('service_types').select('id').eq('billing_only', false).order('sequence_order', { ascending: true }).limit(1)
    const first = (data as { id: string }[] | null)?.[0]
    setFirstServiceTypeId(first?.id ?? null)
  }


  useEffect(() => {
    if (!selectedServiceTypeIdProp) loadFirstServiceType()
  }, [selectedServiceTypeIdProp])


  // The Add / Edit invoice form's engine: its fields, the bill reader, and open, close, save and delete.
  const invoiceForm = useSupplyHouseInvoiceForm({ myRole, selectedSupplyHouseForDetail, supplyHouseInvoices, poGeneratorEntriesForSelectedHouse, housePayments, supplyHouseSummary, supplyHousesList, autoOpenHouseId, openBill, onOpenBillHandled, agingCellFormFocusRef, paperIo, loadSupplyHouseDetail, loadSupplyHouseSummary, setError, setLinesRefresh, agingCellModal, setAgingCellJobsRefresh })
  const { billsIo, billFillOn, billCounts, billSwitchBusy, invoiceFormOpen, openAddInvoice, openEditInvoice, openHouseOnBill, toggleBillSwitch } = invoiceForm


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
        ? movableWindowRows(agingUnpaidInvoices, todayYmdInAppTz(), agingMoveData)
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
      const allocations = groupAllocationsByInvoice((data ?? []) as { invoice_id: string; job_id: string; pct: number }[])
      const jobIds = [...new Set(Object.values(allocations).flat().map((a) => a.job_id))]
      // PR 2: the chips need the (job, house) account rows — only the single-job pairs can
      // carry the flag — and each involved house's job-accounts reps for the Mark opened sheet.
      const pairs = singleJobPairs(allocations, houseByInvoice).filter((p) => p.houseId)
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
      const jobs = jobsLedgerNames((jobRes.data ?? []) as JobsLedgerNameRow[])
      const accounts = accountsByPair(pairs, (accRes.data ?? []) as JobSupplyHouseAccountRow[])
      const reps: Record<string, JobAccountRep[]> = repsByHouse((repRes.data ?? []) as Array<JobAccountRep & { supply_house_id: string }>)
      setAgingCellJobs({ allocations, jobs })
      setAgingCellAccounts(accounts)
      setAgingCellReps(reps)
      setAgingCellAccountsLoaded(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agingCellModal, agingCellJobsRefresh])


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
      const allocations = groupAllocationsByInvoice((allocRes.data ?? []) as { invoice_id: string; job_id: string; pct: number }[])
      const asks: Record<string, MoveAskRow> = {}
      // askRes.error: the table may not be pushed yet — the strip still works, with no asks.
      for (const r of (askRes.error ? [] : askRes.data ?? []) as MoveAskRow[]) asks[r.invoice_id] = r
      // v2.6086: a single-job candidate whose job's account at the house is marked not needed leaves the window.
      const houseOf = new Map(candidates.map((r) => [r.id, r.supply_house_id]))
      const pairs = singleJobPairs(allocations, houseOf)
      let notNeeded = new Set<string>()
      if (pairs.length > 0) {
        const accRes = await supabase
          .from('job_supply_house_accounts')
          .select('job_id, supply_house_id')
          .in('job_id', [...new Set(pairs.map((p) => p.jobId))])
          .in('supply_house_id', [...new Set(pairs.map((p) => p.houseId))])
          .eq('status', 'not_needed')
        if (cancelled) return
        notNeeded = notNeededInvoiceIds(pairs, (accRes.data ?? []) as { job_id: string; supply_house_id: string }[])
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

  // The other Needs You door (v2.7469): `?list=finish` lands with the finish-later list open.
  useEffect(() => {
    if (openList !== 'finish') return
    setFinishListOpen(true)
    onOpenListHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openList])

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
    setAgingMoveData((prev) => ({ ...prev, asks: withEmailedAsks(prev.asks, payload.asked ?? invoiceIds, now, payload.sent_to ?? '') }))
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
  const agingMovable = movableWindowRows(agingUnpaidInvoices, agingTodayYmd, agingMoveData)
  const agingMoveStrip = moveStripSummary(agingMovable, new Set(Object.keys(agingMoveData.asks)))
  const agingHasCurrentUnpaid = agingUnpaidInvoices.some(
    (inv) => Number(inv.amount ?? 0) > 0 && inv.due_date != null && daysPastDue(inv.due_date, agingTodayYmd) <= 0,
  )
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


  function openRecordPayment() {
    setRecordPaymentOpen(true)
  }


  /**
   * After a payment is recorded, moved, removed or put back: the house's bills and payments are read again where
   * they stand. The card keeps its place and an open payment window stays open, since neither is emptied first.
   */
  async function refreshHouseMoney(houseId: string) {
    const [billsRes, pays] = await Promise.all([
      supabase.from('supply_house_invoices').select('id, is_paid, paid_at').eq('supply_house_id', houseId),
      supabaseSupplyPaymentsIo.loadHouse(houseId).catch(() => null),
    ])
    const now = new Map((billsRes.data ?? []).map((r) => [r.id, r]))
    setSupplyHouseInvoices((list) =>
      list.map((row) => {
        const fresh = now.get(row.id)
        return fresh ? { ...row, is_paid: fresh.is_paid, paid_at: fresh.paid_at } : row
      }),
    )
    if (pays) setHousePayments(pays)
    setFinishReloadKey((k) => k + 1)
    void loadSupplyHouseSummary()
  }


  async function toggleInvoicePaid(inv: SupplyHouseInvoice) {
    // One bill at a time. The row is changed where it stands: reading the whole card again would fold it to
    // "Loading…" and lose the place, which made paying several bills in a row a scroll back each time.
    if (inv.is_paid) {
      // A typed payment is money that was sent, so Mark unpaid does not unmake it: the row opens the payment instead.
      const typed = billPaidBy(inv.id, housePayments.payments, housePayments.lines).typed[0]
      if (typed) {
        setPaymentViewId(typed.payment.id)
        return
      }
    }
    setPayingInvoiceId(inv.id)
    try {
      const { data: saved, error } = await supabase
        .from('supply_house_invoices')
        .update({ is_paid: !inv.is_paid })
        .eq('id', inv.id)
        .select('is_paid, paid_at')
        .single()
      if (error) {
        showToast(`${inv.invoice_number} was not changed. ${formatErrorMessage(error)}`, 'error', 5000)
        return
      }
      const isPaid = saved?.is_paid ?? !inv.is_paid
      setSupplyHouseInvoices((list) => list.map((row) => (row.id === inv.id ? { ...row, is_paid: isPaid, paid_at: saved?.paid_at ?? null } : row)))
      setPaidThisVisit((ids) => {
        const next = new Set(ids)
        if (isPaid) next.add(inv.id)
        else next.delete(inv.id)
        return next
      })
      void loadSupplyHouseSummary()
      loadHousePayments(inv.supply_house_id)
      // Mark paid made a payment with no method: the finish-later list counts it.
      setFinishReloadKey((k) => k + 1)
    } finally {
      setPayingInvoiceId(null)
    }
  }



  function openHouseFromAging(supplyHouseId: string) {
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === supplyHouseId)
    if (!sh) return
    loadSupplyHouseDetail(sh)
  }

  /**
   * The doors out of the cell modal (punch list #132 PR 4): a row opens its invoice through
   * the house detail — the same door the expanded house's pencil is — and the modal stays
   * under the form. The house detail is loaded first because the form reads the house (its
   * PO ledger, its pay day) and the invoice with its allocations from it; `focus` names the
   * field Add a due date › or Pick a job › land on, so the act is one press and one field.
   */
  async function openInvoiceFromAgingCell(inv: AgingInvoiceRow, focus: 'invoice-due' | 'invoice-job-search' | null) {
    if (agingCellDoorBusy) return
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === inv.supply_house_id)
    if (!sh) {
      showToast('This house is not in the list on screen. Reload the page and try again.', 'error')
      return
    }
    setAgingCellDoorBusy(inv.id)
    try {
      const rows = await loadSupplyHouseDetail(sh)
      const full = rows.find((r) => r.id === inv.id)
      if (!full) {
        showToast(`Invoice ${inv.invoice_number} is no longer on ${sh.name}. The table reads it again.`, 'error')
        await loadSupplyHouseSummary()
        return
      }
      agingCellFormFocusRef.current = focus
      openEditInvoice(full)
    } finally {
      setAgingCellDoorBusy(null)
    }
  }

  /** Record a payment › on a house-scoped modal: the house's own Record a payment window, over the modal. */
  async function openPaymentFromAgingCell(houseId: string) {
    if (agingCellDoorBusy) return
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === houseId)
    if (!sh) {
      showToast('This house is not in the list on screen. Reload the page and try again.', 'error')
      return
    }
    setAgingCellDoorBusy(`house:${houseId}`)
    try {
      await loadSupplyHouseDetail(sh)
      openRecordPayment()
    } finally {
      setAgingCellDoorBusy(null)
    }
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
        {myRole === 'dev' || myRole === 'master_technician' ? (
          <span data-bill-switch style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Fill a bill from its PDF: {billFillOn ? 'on' : 'off'}
            <button type="button" disabled={billSwitchBusy} onClick={() => void toggleBillSwitch()} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.1rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }}>
              {billFillOn ? 'Turn it off' : 'Turn it on'}
            </button>
          </span>
        ) : null}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>invoices, aging and balances — office only</span>
      </div>
      <BillLinesHeld io={heldIo} paperIo={paperIo} onOpenBill={(bill) => void openBillFromLines(bill)} loadPaperBytes={paperBytesOf} refreshKey={linesRefresh} />
      <section style={{ marginBottom: '2rem' }}>
        {supplyHouseSummaryLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'start', marginBottom: '0.75rem' }}>
              <span aria-hidden="true" />
              <div style={{ fontSize: '1rem', fontWeight: 600, textAlign: 'center', alignSelf: 'center' }}>
                Supply Houses: ${formatCurrency(supplyBookTotal(supplyHouseSummary))}
                {interestYearWords ? (
                  <div style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }} data-testid="supply-interest-year">
                    {interestYearWords}
                  </div>
                ) : null}
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
            {/* Mark paid stays one press; the payment it makes waits here until someone says how it was sent. */}
            <SupplyPaymentsToFinish
              io={supabaseSupplyFinishIo}
              todayYmd={todayYmdInAppTz()}
              reloadKey={finishReloadKey}
              openAtStart={finishListOpen}
              onChanged={() => {
                bankSide.reload()
                if (selectedSupplyHouseForDetail) void refreshHouseMoney(selectedSupplyHouseForDetail.id)
              }}
              bankFor={(p) => {
                // Only a line whose payee reads like the house is offered here: this press fills the day and the method unasked.
                const line = bankCandidatesFor(p, p.houseName, bankSide.lines, bankSide.taken).find((c) => c.isHouse)
                return line ? { id: line.id, words: supplyBankLineWords(line, (ymd) => billDateWords(ymd, todayYmdInAppTz())) } : null
              }}
              onUseLine={(paymentId, bankLineId) => supabaseSupplyBankIo.match(paymentId, bankLineId, true)}
            />
            {/* The other direction: money the bank shows going to a house that no payment claims. */}
            <SupplyBankUnclaimed
              lines={bankSide.unclaimed}
              todayYmd={todayYmdInAppTz()}
              onSay={(u) => {
                setRecordStart({ lineId: u.line.id, amount: u.line.amount, paidOn: u.line.ymd, chip: u.line.method, words: supplyBankLineWords(u.line, (ymd) => billDateWords(ymd, todayYmdInAppTz())) })
                void openPaymentFromAgingCell(u.houseId)
              }}
            />
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
                                  ...(has ? { ...AGING_CELL_STYLES[b.key], cursor: 'pointer' } : { color: 'var(--text-faint)' }),
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
                              style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(row.creditsOpen < -0.005 ? { color: 'var(--text-green-700)', cursor: 'pointer' } : { color: 'var(--text-faint)' }) }}
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
                            style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: has ? undefined : 'var(--text-faint)', ...(has ? { cursor: 'pointer' } : {}) }}
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
                        {billPill(row.supply_house_id)}
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
                        data-supply-house-row={row.supply_house_id}
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
                          background: isExpanded ? 'var(--bg-sky-tint)' : undefined,
                          scrollMarginTop: 'calc(var(--app-top-chrome, 0px) + 1rem)',
                        }}
                      >
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                          {row.name}
                          {billPill(row.supply_house_id)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: row.outstanding > 0 ? 600 : 400 }}>
                          ${formatCurrency(row.outstanding)}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                          {row.monthlyPaymentDay ? ordinalDay(row.monthlyPaymentDay) : '—'}
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
                                  <section style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                      <h3 style={{ margin: 0, fontSize: '1rem' }}>
                                        Invoices{' '}
                                        <span style={{ fontWeight: 400, fontSize: '0.875rem', color: 'var(--text-muted)' }} data-testid="supply-bills-payday">
                                          {(() => {
                                            const day = sortedSupplyHouseSummary.find((r) => r.supply_house_id === selectedSupplyHouseForDetail.id)?.monthlyPaymentDay
                                            return day ? `pays on the ${ordinalDay(day)}` : ''
                                          })()}
                                        </span>
                                      </h3>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openAddInvoice() }}
                                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          Add Invoice
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openRecordPayment() }}
                                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          Record a payment
                                        </button>
                                      </div>
                                    </div>
                                    {(() => {
                                      // A bill marked paid on this visit stays listed, so the rows under it do not move.
                                      const billToday = todayYmdInAppTz()
                                      const rows = supplyBillCardRows({
                                        shown: supplyBillsToList(supplyHouseInvoices, showPaidInvoices, paidThisVisit),
                                        all: supplyHouseInvoices,
                                        payments: housePayments,
                                        jobs: supplyHouseJobDetailsMap,
                                        ledgerCodes: poGeneratorCodesForSelectedHouse,
                                        papers: papersByInvoice,
                                        paperNames,
                                      })
                                      const byId = (id: string) => supplyHouseInvoices.find((x) => x.id === id) ?? null
                                      return (
                                        <SupplyHouseBillsCard
                                          bills={rows}
                                          todayYmd={billToday}
                                          jobAccountsInUse={!!selectedSupplyHouseForDetail.job_accounts?.trim() || supplyHouseInvoices.some((inv) => inv.on_job_account === true)}
                                          paidThisVisit={paidThisVisit}
                                          payingId={payingInvoiceId}
                                          onAccount={houseOnAccountTotal(housePayments)}
                                          empty={
                                            <EmptyState
                                              compact
                                              {...supplyHouseInvoicesEmptyWords({
                                                house: selectedSupplyHouseForDetail.name.trim() || 'this house',
                                                total: supplyHouseInvoices.length,
                                                addInvoice: openAddInvoice,
                                                showPaid: () => setShowPaidInvoices(true),
                                              })}
                                            />
                                          }
                                          onTogglePaid={(id) => {
                                            const inv = byId(id)
                                            if (inv) void toggleInvoicePaid(inv)
                                          }}
                                          onEdit={(id) => {
                                            const inv = byId(id)
                                            if (inv) openEditInvoice(inv)
                                          }}
                                          onLook={(id) => {
                                            const inv = byId(id)
                                            if (inv) void openPaperLook(inv)
                                          }}
                                          removedPayments={removedLately(housePayments.payments, Date.now(), (ymd) => billDateWords(ymd, billToday), calendarYmdInAppTzFromIso).map((r) => ({ id: r.payment.id, words: r.words }))}
                                          puttingBackId={puttingBackPaymentId}
                                          onFinish={(billId) => setHowEditId(billPaidBy(billId, housePayments.payments, housePayments.lines).needsHowId ?? null)}
                                          onPutBack={(paymentId) => {
                                            const houseId = selectedSupplyHouseForDetail.id
                                            setPuttingBackPaymentId(paymentId)
                                            supabaseSupplyPaymentsIo
                                              .restore(paymentId)
                                              .then(async () => {
                                                showToast('The payment is back. Its bills read as they did.', 'success')
                                                await refreshHouseMoney(houseId)
                                              })
                                              .catch((e: unknown) => showToast(formatErrorMessage(e, 'The payment was not put back.'), 'error', 6000))
                                              .finally(() => setPuttingBackPaymentId(null))
                                          }}
                                        />
                                      )
                                    })()}
                                  </section>
                                  {/* The job accounts sit under the bills, folded until asked for. The fold is remembered. */}
                                  <section style={{ marginBottom: '1.5rem' }} data-testid="supply-job-accounts-fold">
                                    <button
                                      type="button"
                                      aria-expanded={jobAccountsOpen}
                                      onClick={(e) => { e.stopPropagation(); setJobAccountsOpen((o) => !o) }}
                                      style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', width: '100%', minHeight: 44, padding: '0.5rem 0.75rem', marginBottom: jobAccountsOpen ? '0.75rem' : 0, font: 'inherit', textAlign: 'left', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      <span aria-hidden style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{jobAccountsOpen ? '▾' : '▸'}</span>
                                      <b>Job accounts</b>
                                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{jobAccountsOpen ? 'fold them away' : 'each job’s account with this house'}</span>
                                    </button>
                                    {jobAccountsOpen && (
                                    <SupplyHouseJobAccountsRoster
                                      house={selectedSupplyHouseForDetail}
                                      invoices={supplyHouseInvoices}
                                      jobDetails={supplyHouseJobDetailsMap}
                                      onInvoicesChanged={() => void loadSupplyHouseDetail(selectedSupplyHouseForDetail)}
                                    />
                                    )}
                                  </section>
                                  <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                      <h3 style={{ margin: 0, fontSize: '1rem' }}>Purchase Orders</h3>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); createBlankPOForSupplyHouse(selectedSupplyHouseForDetail.id) }}
                                        disabled={creatingPOForSupplyHouse || !serviceTypeId}
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: creatingPOForSupplyHouse || !serviceTypeId ? 'not-allowed' : 'pointer' }}
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
          invoices={supplyPhoneBills(supplyHouseInvoices, housePayments)}
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
          onMakePayment={openRecordPayment}
          typedPaidIds={typedPaidBillIds(supplyHouseInvoices, housePayments)}
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
          // A bill paid in part sits in the cell for what is left on it, and says what it was billed for.
          const partNote = inv.billed != null && Math.abs(inv.billed - inv.amount) > 0.005 ? `left of $${formatCurrency(Math.abs(inv.billed))}` : null
          const rowNote = [inv.is_interest ? 'interest, not a job cost' : null, partNote, pair, note].filter(Boolean).join(' · ')
          return (
            <div key={inv.id} className="aging-win-row">
              <AgingInvoiceDoor invoiceNumber={inv.invoice_number} busy={agingCellDoorBusy === inv.id} onOpen={() => void openInvoiceFromAgingCell(inv, null)} />
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
                <AgingRowDoors
                  doors={agingCellRowDoors(inv, agingCellAccountsLoaded ? allocationsOf(inv.id).length : null)}
                  busy={agingCellDoorBusy === inv.id}
                  onAddDueDate={() => void openInvoiceFromAgingCell(inv, 'invoice-due')}
                  onPickJob={() => void openInvoiceFromAgingCell(inv, 'invoice-job-search')}
                />
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
                          <div className="aging-win-job-meta">Press Pick a job › on the row to choose its job.</div>
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
                {houseId && agingCellModalDoors(houseId, cell).openHouse ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <AgingMakePaymentDoor doors={agingCellModalDoors(houseId, cell)} busy={agingCellDoorBusy === `house:${houseId}`} onMakePayment={() => void openPaymentFromAgingCell(houseId)} />
                    <button
                      type="button"
                      onClick={() => {
                        setAgingCellModal(null)
                        openHouseFromAging(houseId)
                      }}
                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Open {houseName} ›
                    </button>
                  </div>
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

      <SupplyHouseInvoiceFormModal form={invoiceForm} selectedSupplyHouseForDetail={selectedSupplyHouseForDetail} supplyHouseInvoices={supplyHouseInvoices} poGeneratorEntriesForSelectedHouse={poGeneratorEntriesForSelectedHouse} poGeneratorCodesForSelectedHouse={poGeneratorCodesForSelectedHouse} narrowAging={narrowAging} />

      {recordPaymentOpen && selectedSupplyHouseForDetail && (
        <RecordSupplyPaymentModal
          house={{
            id: selectedSupplyHouseForDetail.id,
            name: selectedSupplyHouseForDetail.name,
            monthlyPaymentDay: selectedSupplyHouseForDetail.monthly_payment_day ?? null,
          }}
          bills={recordPaymentBills(supplyHouseInvoices, supplyHouseJobDetailsMap)}
          io={supabaseSupplyPaymentsIo}
          todayYmd={todayYmdInAppTz()}
          parts
          start={recordStart ?? undefined}
          onClose={() => {
            setRecordPaymentOpen(false)
            setRecordStart(null)
          }}
          onRecorded={(result, words) => {
            const houseId = selectedSupplyHouseForDetail.id
            const fromBank = recordStart
            setRecordPaymentOpen(false)
            setRecordStart(null)
            showToast(words, 'success')
            // Opened from a bank line: the payment it recorded is the one that line is.
            const matched = fromBank && result.payment_id ? supabaseSupplyBankIo.match(result.payment_id, fromBank.lineId, false).catch((e: unknown) => showToast(formatErrorMessage(e, 'The payment is recorded. It was not matched to its bank line.'), 'error', 6000)) : Promise.resolve()
            void matched.then(() => {
              bankSide.reload()
              return refreshHouseMoney(houseId)
            })
          }}
        />
      )}

      {(() => {
        const viewed = paymentViewId ? housePayments.payments.find((p) => p.id === paymentViewId) : null
        if (!viewed || !selectedSupplyHouseForDetail) return null
        const house = selectedSupplyHouseForDetail
        return (
          <SupplyPaymentWindow
            payment={viewed}
            payments={housePayments.payments}
            lines={housePayments.lines}
            bills={paymentWindowBills(supplyHouseInvoices, supplyHouseJobDetailsMap)}
            events={housePayments.events}
            houseName={house.name.trim() || 'this house'}
            todayYmd={todayYmdInAppTz()}
            onClose={() => setPaymentViewId(null)}
            onRemove={async (payment, reason) => {
              await supabaseSupplyPaymentsIo.remove(payment.id, reason)
              setPaymentViewId(null)
              showToast('The payment is removed. Its bills read unpaid again. It can be put back for 30 days.', 'success')
              await refreshHouseMoney(house.id)
            }}
            onMove={async (input) => {
              await supabaseSupplyPaymentsIo.move(input)
              showToast('The money is moved. Both bills say where it went.', 'success')
              await refreshHouseMoney(house.id)
            }}
            onUndoMove={async (eventId) => {
              await supabaseSupplyPaymentsIo.undoMove(eventId)
              showToast('The move is taken back.', 'success')
              await refreshHouseMoney(house.id)
            }}
            onEditHow={() => setHowEditId(viewed.id)}
            bank={{
              matched: bankSide.lines.find((b) => b.id === bankSide.matchedByPayment.get(viewed.id)) ?? null,
              hasMatch: bankSide.matchedByPayment.has(viewed.id),
              candidates: bankSide.matchedByPayment.has(viewed.id) ? [] : bankCandidatesFor(viewed, house.name, bankSide.lines, bankSide.taken),
              onMatch: async (bankLineId) => {
                await supabaseSupplyBankIo.match(viewed.id, bankLineId, false)
                showToast('The bank agrees with this payment.', 'success')
                bankSide.reload()
              },
              onUnmatch: async () => {
                await supabaseSupplyBankIo.unmatch(viewed.id)
                showToast('The payment is off its bank line.', 'success')
                bankSide.reload()
              },
            }}
          />
        )
      })()}

      {/* How a payment was sent, said after the fact: from a paid row's Finish…, or from the payment's own window. */}
      {(() => {
        const editing = howEditId ? housePayments.payments.find((p) => p.id === howEditId) : null
        if (!editing || !selectedSupplyHouseForDetail) return null
        const house = selectedSupplyHouseForDetail
        const numbers = [...new Set(housePayments.lines.filter((l) => l.payment_id === editing.id).map((l) => supplyHouseInvoices.find((inv) => inv.id === l.invoice_id)?.invoice_number ?? ''))].filter(Boolean)
        return (
          <SupplyPaymentHowEditor
            payment={editing}
            title={[house.name.trim() || 'This house', numbers.length === 1 ? numbers[0] : numbers.length > 1 ? `${numbers.length} bills` : 'on account'].join(' · ')}
            lastMethod={lastMethodUsed(housePayments.payments)}
            onClose={() => setHowEditId(null)}
            onSave={async (paymentId, patch, words) => {
              await supabaseSupplyFinishIo.saveHowSent(paymentId, patch)
              setHowEditId(null)
              showToast(words, 'success')
              await refreshHouseMoney(house.id)
            }}
          />
        )
      })()}

      {paperLook ? (
        <PaperLookModal
          paper={paperLook.paper}
          invoice={paperLook.invoice}
          io={paperIo}
          fileBytes={paperLook.bytes}
          acceptedByName={paperLook.paper.acceptedBy ? paperNames.get(paperLook.paper.acceptedBy) : null}
          onClose={() => setPaperLook(null)}
          onChanged={() => {
            void loadPapersFor(supplyHouseInvoices)
            setLinesRefresh((k) => k + 1)
          }}
        />
      ) : null}
    </div>
  )
}
