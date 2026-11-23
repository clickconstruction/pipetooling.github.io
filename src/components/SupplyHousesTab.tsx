import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supplyBookTotal, supplyHouseCardMoney, ordinalDay } from '../lib/materials/supplyHousePhone'
import { SupplyHousePhoneScreen } from './materials/SupplyHousePhoneScreen'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { supabasePaperIo, type PaperIo } from '../lib/materials/lines/paperIo'
import type { PaperRow } from '../lib/materials/lines/paperRows'
import { PaperLookModal } from './materials/PaperLookModal'
import { BillLinesHeld } from './materials/BillLinesHeld'
import { supabaseHeldBillsIo, type HeldBillsIo } from '../lib/materials/lines/heldBillsIo'
import { billsToRecordWords } from '../lib/materials/bills/billWords'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { formatCurrency } from '../lib/format'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { longTimeAgoPhrase } from '../lib/subcontractorLastActivityCompact'
import {
  buildSupplyHouseAgingMatrix,
  countSupplyHousesPastDue60,
  daysPastDue,
  movableWindowRows,
  moveStripSummary,
} from '../lib/supplyHouseAging'
import { SupplyHouseDirectory } from './materials/SupplyHouseDirectory'
import { useSupplyHouseEditor } from './materials/useSupplyHouseEditor'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import {
} from '../lib/materials/supplyHouseInvoiceForm'
import { ariaSortFor, nextSupplyHouseSummarySort, parseSupplyHouseSummarySort, serializeSupplyHouseSummarySort, sortSupplyHouseSummary, type SupplyHouseSummarySort, type SupplyHouseSummarySortKey } from '../lib/materials/supplyHouseSummarySort'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { SupplyHouseJobAccountsSection } from './materials/SupplyHouseJobAccountsSection'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useReportQuickfillSectionMetric } from '../contexts/QuickfillSectionMetricsContext'
import { supplyHousesNextLine } from '../lib/quickfill/nextLine'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { billDateWords } from '../lib/materials/supplyBillGroups'
import { supabaseSupplyFinishIo } from '../lib/materials/payments/supplyPaymentsFinishIo'
import { SupplyPaymentsToFinish } from './materials/SupplyPaymentsToFinish'
import { SupplyBankUnclaimed } from './materials/SupplyBankUnclaimed'
import { supabaseSupplyBankIo } from '../lib/materials/payments/supplyPaymentBankIo'
import { bankCandidatesFor, supplyBankLineWords } from '../lib/materials/payments/supplyPaymentBank'
import { supplyPhoneBills, typedPaidBillIds } from '../lib/materials/supplyHouseBillRows'
import { SupplyHouseInvoiceFormModal } from './materials/SupplyHouseInvoiceFormModal'
import { useSupplyHouseAgingWindows } from './materials/useSupplyHouseAgingWindows'
import { useSupplyHousePayments } from './materials/useSupplyHousePayments'
import { SupplyHousePaymentWindows } from './materials/SupplyHousePaymentWindows'
import { SupplyHouseDetailPanel } from './materials/SupplyHouseDetailPanel'
import { SupplyHouseAgingMap } from './materials/SupplyHouseAgingMap'
import { AgingCellWindow } from './materials/AgingCellWindow'
import { formatYmdLocal } from '../lib/materials/agingCellByJob'
import { useSupplyHouseAccountsPayable, type AgingInvoiceRow } from './materials/useSupplyHouseAccountsPayable'
import { useSupplyHouseInvoiceForm, type SupplyHouse, type SupplyHouseInvoice, type SupplyHousesTabRole } from './materials/useSupplyHouseInvoiceForm'
import { Money } from './Money'

type UserRole = SupplyHousesTabRole


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


interface SupplyHousesTabProps {
  supplyHouses?: SupplyHouse[]
  onSupplyHousesChange?: () => void | Promise<void>
  myRole?: UserRole | null
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
  const ap = useSupplyHouseAccountsPayable({ supplyHousesProp, onSupplyHousesChange, autoOpenHouseId, onAutoOpenHouseHandled, setError, loadPapersFor })
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
    poGeneratorEntriesForSelectedHouse,
    setPoGeneratorEntriesForSelectedHouse,
    poGeneratorCodesForSelectedHouse,
    supplyHouseDetailLoading,
    supplyHouseJobDetailsMap,
    housePayments,
    setHousePayments,
    interestYearWords,
    setPaidThisVisit,
    loadSupplyHouses,
    loadSupplyHouseSummary,
    loadSupplyHouseDetail,
    loadHousePayments,
  } = ap
  // The aging windows: the cell window and the move window, their state, reads and writes.
  const agingWindows = useSupplyHouseAgingWindows({ agingUnpaidInvoices, setAgingUnpaidInvoices, agingBookLoaded, selectedSupplyHouseForDetail, loadSupplyHouseDetail, setError, openList, onOpenListHandled })
  const { agingCellModal, setAgingCellModal, setAgingCellJobsRefresh, agingMoveData } = agingWindows
  /**
   * PR 4 (the doors): the one row or house whose detail is loading behind a press, so a second
   * press cannot open two forms; the field the form opens on (Add a due date › / Pick a job ›);
   * and a counter the form's save bumps so the open modal re-reads its jobs (a job picked from
   * the modal moves the row out of No job yet without closing and reopening it).
   */
  const [agingCellDoorBusy, setAgingCellDoorBusy] = useState<string | null>(null)
  const agingCellFormFocusRef = useRef<'invoice-due' | 'invoice-job-search' | null>(null)
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
  // The payments: which payment window is open, the bank side, and the writes that keep the house's rows in place.
  const payments = useSupplyHousePayments({ supplyHousesList, agingBookLoaded, openList, onOpenListHandled, housePayments, setHousePayments, setSupplyHouseInvoices, setPaidThisVisit, loadSupplyHouseSummary, loadHousePayments })
  const { finishListOpen, finishReloadKey, bankSide, setRecordStart, openRecordPayment, refreshHouseMoney, toggleInvoicePaid } = payments
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


  return (
    <div>
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
                Supply Houses: <Money amount={supplyBookTotal(supplyHouseSummary)} />
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
                      <strong><Money amount={agingMoveStrip.dollars} /></strong> on {agingMoveStrip.count} current invoice{agingMoveStrip.count === 1 ? '' : 's'} is not on a job account yet — a house moves a charge only while it is current.
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
                <SupplyHouseAgingMap narrowAging={narrowAging} agingMatrix={agingMatrix} agingHasCredits={agingHasCredits} markJobAccountInvoices={markJobAccountInvoices} openHouseFromAging={openHouseFromAging} setAgingCellModal={setAgingCellModal} />
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
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: row.outstanding > 0 ? 700 : 400, fontSize: '0.875rem', whiteSpace: 'nowrap' }}><Money amount={row.outstanding} /></span>
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
                          <Money amount={row.outstanding} />
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
                            <SupplyHouseDetailPanel ap={ap} payments={payments} sortedSupplyHouseSummary={sortedSupplyHouseSummary} showPaidInvoices={showPaidInvoices} setShowPaidInvoices={setShowPaidInvoices} jobAccountsOpen={jobAccountsOpen} setJobAccountsOpen={setJobAccountsOpen} papersByInvoice={papersByInvoice} paperNames={paperNames} openPaperLook={openPaperLook} openAddInvoice={openAddInvoice} openEditInvoice={openEditInvoice} serviceTypeId={serviceTypeId} selectedServiceTypeIdProp={selectedServiceTypeIdProp} creatingPOForSupplyHouse={creatingPOForSupplyHouse} createBlankPOForSupplyHouse={createBlankPOForSupplyHouse} handleNavigateToPO={handleNavigateToPO} />
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
      <AgingCellWindow aging={agingWindows} agingUnpaidInvoices={agingUnpaidInvoices} supplyHouseSummary={supplyHouseSummary} supplyHousesList={supplyHousesList} agingMatrix={agingMatrix} agingMovable={agingMovable} agingTodayYmd={agingTodayYmd} agingCellDoorBusy={agingCellDoorBusy} openInvoiceFromAgingCell={openInvoiceFromAgingCell} openPaymentFromAgingCell={openPaymentFromAgingCell} openHouseFromAging={openHouseFromAging} />

      {houseEditor.modal}

      <SupplyHouseInvoiceFormModal form={invoiceForm} selectedSupplyHouseForDetail={selectedSupplyHouseForDetail} supplyHouseInvoices={supplyHouseInvoices} poGeneratorEntriesForSelectedHouse={poGeneratorEntriesForSelectedHouse} poGeneratorCodesForSelectedHouse={poGeneratorCodesForSelectedHouse} narrowAging={narrowAging} />

      <SupplyHousePaymentWindows ap={ap} payments={payments} />

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
