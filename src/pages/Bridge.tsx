import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isOwnerOrDev } from '../lib/doorRoles'
import { useAuth } from '../hooks/useAuth'
import { useDashboardFinancials } from '../hooks/useDashboardFinancials'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { BRIDGE_DAYS_AHEAD, BRIDGE_DAYS_BACK, loadBridgeData, saveBridgeCashOnHand, saveBridgeFloor, type BridgeData } from '../lib/bridge/loadBridgeData'
import { buildCourseModel } from '../lib/bridge/courseModel'
import { buildNetPositionHistory, cashTodayFromAsOf } from '../lib/bridge/netPosition'
import { DOUBTFUL_AFTER_DAYS, LATE_RECEIPT_GRACE_DAYS, buildCashForecast, type CashEvent } from '../lib/bridge/cashForecast'
import { buildTruthCheck, truthCheckVerdictText, type TruthCheck } from '../lib/bridge/truthCheck'
import { BridgeCashChart, BridgeNetPositionChart } from '../components/bridge/BridgeCashCharts'
import { BridgeVectorsPanel } from '../components/bridge/BridgeVectorsPanel'
import { loadBridgeVectorInputs, type BridgeVectorInputs } from '../lib/bridge/loadBridgeVectors'
import { buildVectors } from '../lib/bridge/vectors'
import { BridgeVectorDaysPanel } from '../components/bridge/BridgeVectorDaysPanel'
import type { VectorReading } from '../lib/bridge/vectorReading'
import { BridgeHeadline } from '../components/bridge/BridgeHeadline'
import { buildHeadline, cashLight, netPositionLight } from '../lib/bridge/headline'
import type { MercuryCash } from '../lib/bridge/mercuryCash'
import { buildCashAccounts, flipAccountOut } from '../lib/bridge/cashAccounts'
import { loadBankRead, saveAccountsOut } from '../lib/bridge/cashAccountsIo'
import { carryingDay, carryingSentence, receiptsConfidence } from '../lib/bridge/cashConfidence'
import { BridgeCashConfidence } from '../components/bridge/BridgeCashConfidence'
import { buildSoftNumbers } from '../lib/bridge/softNumbers'
import { BridgeSoftNumbers } from '../components/bridge/BridgeSoftNumbers'
import { doorFromSearch, searchAfterDoor, type DoorId } from '../lib/bridge/doors'
import { BRIDGE_DOOR_PANEL_ID, BridgeDoors } from '../components/bridge/BridgeDoors'
import { MONEY_LIST_DAYS, laterPress, listWindow } from '../lib/bridge/moneyLists'
import { peopleSummary } from '../lib/bridge/peopleStrip'
import { BridgePeople } from '../components/bridge/BridgePeople'
import { DEFAULT_PAY_DAYS, SUB_LABOR_DEFAULT_DAYS, buildBills, buildCollectDeskFrom, buildReceipts, md } from '../lib/bridge/sheetBuild'
import { BridgeWeeklySend } from '../components/bridge/BridgeWeeklySend'
import { loadVectorDaysInputs, type VectorDaysInputs } from '../lib/bridge/loadVectorDays'
import { buildVectorGrid, monthStartOf, vectorAnchorStep, vectorRangeFor, vectorRangeLabel, type VectorTimeMode, type VectorZoom } from '../lib/bridge/vectorDays'
import { readVectorDaysMode, writeVectorDaysMode } from '../lib/bridge/vectorDaysModeStorage'
import { formatPayWeekLabel, payWeekContaining } from '../lib/payWeekAnchor'
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../utils/dateUtils'
import { buildStageFlow, withFieldPaces, type StageId } from '../lib/bridge/stageFlow'
import { BridgeStages } from '../components/bridge/BridgeStages'
import { BridgePctPrompt } from '../components/bridge/BridgePctPrompt'
import { buildPctPrompt, withPctSet } from '../lib/bridge/pctPrompt'
import { BridgeRule } from '../components/bridge/BridgeRule'
import { BridgeCashAccounts } from '../components/bridge/BridgeCashAccounts'
import { BridgeWeek } from '../components/bridge/BridgeWeek'
import { WEEK_CALL_MOVES, WEEK_CALL_MOVES_PHONE, WEEK_CARD_LABEL, WEEK_CASH_MAY_LEAD, buildWeekCall, deskMoves, type WeekCallInput } from '../lib/bridge/weekCall'
import { nowDeskFoot } from '../lib/bridge/pulseWords'
import { buildProfitPanel } from '../lib/bridge/profitPanel'
import { buildRecordedReading, buildWaitingDays } from '../lib/bridge/waitingDays'
import { BridgeProfitPanel } from '../components/bridge/BridgeProfitPanel'
import { buildFixSizes } from '../lib/bridge/fixSizes'
import { buildFlowStrip } from '../lib/bridge/flowStrip'
import { BridgeFlowStrip } from '../components/bridge/BridgeFlowStrip'
import { BridgeFlowStripDown } from '../components/bridge/BridgeFlowStripDown'
import { buildEstimateWins, type EstimateSent } from '../lib/bridge/estimateWins'
import { loadEstimatesSent } from '../lib/bridge/loadEstimateWins'
import { BID_SIZES, buildBidWins, buildMarketWorth, marketWorthInput, type BidSent } from '../lib/bridge/bidWins'
import { loadBidsSent } from '../lib/bridge/loadBidWins'
import { leftOutKey, leftOutPickerNames, withLeftOutJobIds, type LeftOutRule } from '../lib/bridge/leftOut'
import { loadLeftOut, loadLeftOutJobIds, saveLeftOut, type LeftOutRead } from '../lib/bridge/leftOutIo'
import { BridgeLeftOut } from '../components/bridge/BridgeLeftOut'
import { accrualLine, burnPerDay, cashLine, runwayFoot } from '../lib/bridge/moneyCard'
import { jobPage, moveDive, type DiveFacts, type DivePctJob, type DiveTarget } from '../lib/bridge/callDive'
import { lastWorkedCell } from '../lib/bridge/pctFacts'
import { useBridgePctFacts } from '../hooks/useBridgePctFacts'
import { BridgePctRun } from '../components/bridge/BridgePctRun'
import { todoLinkPaths, type CallTodo } from '../lib/bridge/callTodo'
import { todoStates, type TodoCard, type TodoState } from '../lib/bridge/callTodoState'
import type { TodoLinesRead } from '../components/bridge/BridgeTodoCheck'
import { BridgeTodoOpen } from '../components/bridge/BridgeTodoOpen'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { APP_ORIGIN } from '../lib/appOrigin'
import { NO_JOB_HOURS, jobHoursByJob, jobHoursCell, jobHoursLine, type JobHoursSession } from '../lib/bridge/jobHours'
import { BridgeJobHoursWindow } from '../components/bridge/BridgeJobHours'
import SetPromisedPayDateModal from '../components/jobs/SetPromisedPayDateModal'
import { useIsNarrowScreen } from '../hooks/useIsNarrowScreen'
import { deskStatus, isStageLink, type CallLink } from '../lib/bridge/calls'
import { BridgeLinkDesk } from '../components/bridge/BridgeLinkDesk'
import { BridgeCollectDesk } from '../components/bridge/BridgeCollectDesk'
import { arRowInvoiceId } from '../lib/bridge/collect/collectBills'
import { loadCollectDeskReads, type CollectDeskReads } from '../lib/bridge/collect/loadCollectDesk'
import { useArLienChips } from '../hooks/useArLienChips'
import { OWED_DOORS } from '../lib/bridge/owedPanel'
import { buildCollectSheet, collectMoveFor } from '../lib/bridge/collect/collectMoves'
import { collectDecisions } from '../lib/bridge/collect/collectDecisions'
import { collectWhatIf } from '../lib/bridge/collect/collectWhatIf'
import { lienArChipHref } from '../lib/jobs/lienArChip'
import { addPaymentChaseTouch, recordPromiseForJobs } from '../lib/jobs/paymentChaseIo'
import type { CollectOutcomeWriter } from '../components/bridge/BridgeCollectOutcome'
import { buildBuildPace, type BuildPaceInput } from '../lib/bridge/buildPace'
import { fieldPaceByHours } from '../lib/bridge/fieldPace'
import { loadBuildPaceInputs } from '../lib/bridge/loadBuildPace'
import { billStageInput, buildBillPile, type BillPileJob } from '../lib/bridge/billPile'
import { loadBillPileJobs } from '../lib/bridge/loadBillPile'
import { useZzTestJobsHidden } from '../lib/jobs/zzTestJobSwitch'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'
import { buildDemand, type DemandInput } from '../lib/bridge/demandPace'
import { loadDemandInputs } from '../lib/bridge/loadDemandPace'
import { buildDialReading, dialSpec, marketPaceIsWorth, todayPace } from '../lib/bridge/dial'
import type { StageFlowInput } from '../lib/bridge/stageFlow'
import { BridgeDial } from '../components/bridge/BridgeDial'
import { buildResources, type ResourceId } from '../lib/bridge/resources'
import { BridgeResources } from '../components/bridge/BridgeResources'
import { buildOrder } from '../lib/bridge/order'
import { BridgeOrderModal } from '../components/bridge/BridgeOrderModal'
import { buildReflexes, otherLevers, reflexLine, type ReflexId } from '../lib/bridge/waits'
import { BridgeWaits } from '../components/bridge/BridgeWaits'
import { buildWeekCards } from '../lib/bridge/weekCard'
import { formatWeekRangeLabel } from '../lib/people/approvalsQueue'
import { buildOwedPanel } from '../lib/bridge/owedPanel'
import { BridgeOwedPanel } from '../components/bridge/BridgeOwedPanel'
import { buildHoursPanel } from '../lib/bridge/hoursPanel'
import { BridgeHoursPanel } from '../components/bridge/BridgeHoursPanel'
import { buildCashPanel, buildNetPanel } from '../lib/bridge/netCashPanels'
import { BridgeBreakdownPanel } from '../components/bridge/BridgeBreakdownPanel'
import { pageGate } from '../lib/roleGate'
import { BridgeBillDesk } from '../components/bridge/BridgeBillDesk'
import { billDeskFacts, buildBillDesk, scorecardStart, shapeBillDeskBills, shapeBillDeskJobs, type BillDeskPageInput } from '../lib/bridge/bill/billDesk'
import { loadBillDeskReads, type BillDeskReads } from '../lib/bridge/bill/loadBillDesk'
import { BridgeBuildDesk } from '../components/bridge/BridgeBuildDesk'
import { buildBuildDesk, type BuildDeskReads } from '../lib/bridge/build/buildDesk'
import { loadBuildDeskReads } from '../lib/bridge/build/loadBuildDesk'
import { BridgeMarketDesk } from '../components/bridge/BridgeMarketDesk'
import { buildMarketDesk, marketHeader } from '../lib/bridge/market/marketDesk'
import { loadMarketDeskReads, type MarketDeskReads } from '../lib/bridge/market/loadMarketDesk'
import { buildSalesDesk } from '../lib/bridge/sales/salesDesk'
import { loadSalesDeskReads, type SalesDeskReads } from '../lib/bridge/sales/loadSalesDesk'
import { BridgeSalesDesk } from '../components/bridge/BridgeSalesDesk'
import { BridgePunchListLink } from '../components/bridge/BridgePunchListLink'

/**
 * The Bridge (v2.2726 — the plain version). Dev only. Where we stand (net
 * position), where cash is going (forecast by date), what would change it.
 * Cash on hand is typed on this page and rolled forward through the bank
 * flows since; the floor is set here too. No ship words on the instruments.
 */

const money = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`

const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }
const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const big: CSSProperties = { fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, margin: '0.1rem 0' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
/** The names the page hands a read that looks people up itself: none, so the read fetches the few it needs. */
const NO_NAMES: ReadonlyMap<string, string> = new Map()
/** Where a door on the first screen lands: clear of the app's top bar. */
const inputStyle: CSSProperties = { width: 110, font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.4rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)' }
const btnStyle: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }
const listRow: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }

export default function Bridge() {
  const { user, role, loading: authLoading } = useAuth()
  const { showToast } = useToastContext()
  const [data, setData] = useState<BridgeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [cashDraft, setCashDraft] = useState('')
  const [floorDraft, setFloorDraft] = useState('')
  const [vectorInputs, setVectorInputs] = useState<BridgeVectorInputs | null>(null)
  const [vectorError, setVectorError] = useState<string | null>(null)
  const [vectorWeekStart, setVectorWeekStart] = useState<string | null>(null)
  // Vectors by the day (v2.4217): the period drawn (a month of days, 13 pay weeks or 12 months — v2.4219), its sessions and job rates (cached per period on this page).
  const [daysZoom, setDaysZoom] = useState<VectorZoom>('days')
  const [daysMode, setDaysMode] = useState<VectorTimeMode>(() => readVectorDaysMode())
  // The day grid's reading (link PR 12): profit as built, revenue at the job's rate, or cost in wages.
  const [daysReading, setDaysReading] = useState<VectorReading>('profit')
  const [daysAnchor, setDaysAnchor] = useState<string | null>(null)
  const [daysInputs, setDaysInputs] = useState<VectorDaysInputs | null>(null)
  const [daysError, setDaysError] = useState<string | null>(null)
  const daysCacheRef = useRef(new Map<string, VectorDaysInputs>())
  // The top line (v2.5216): the last 13 pay weeks' sessions, the Weeks zoom's own range, through the same cache.
  const [weeksInputs, setWeeksInputs] = useState<VectorDaysInputs | null>(null)
  const [weeksError, setWeeksError] = useState<string | null>(null)
  // Cash on hand from the bank (v2.5218): Mercury's balances, read when the page loads; the typed figure is the fallback.
  const [bank, setBank] = useState<MercuryCash | null>(null)
  // Every account by its Mercury name, and the ones the owner leaves out of cash on hand (v2.6838).
  const [bankNames, setBankNames] = useState<Map<string, string>>(() => new Map())
  const [accountsOut, setAccountsOut] = useState<string[]>([])
  // A choice the save refused holds for the visit: Read again must not put the saved one back over it.
  const accountsOutUnsavedRef = useRef(false)
  const [bankError, setBankError] = useState<string | null>(null)
  const [bankLoading, setBankLoading] = useState(false)
  // The doors (punch list #303, PR 2): which part of the page is open under the first screen rides in the address.
  // The Monday sheet's `?view=monday` (v2.5224) retired with it: the first screen is the sheet.
  const [searchParams, setSearchParams] = useSearchParams()
  const doorParam = searchParams.get('door')
  /** The pipe stands up (punch list #318). `?pipe=across` draws it lying down, as it was. */
  const pipeAcross = searchParams.get('pipe') === 'across'
  /** The app's Add task window, which a grey check opens already written (punch list #334, PR 9). */
  const addTask = useChecklistAddModal()
  // What a press on the card What to do now opened (punch list #334, PR 8): the customer the Collect window opens on,
  // the job whose percent is being set, and the project whose pay date is being written down.
  const [collectFocus, setCollectFocus] = useState<string | null>(null)
  const [pctFor, setPctFor] = useState<DivePctJob | null>(null)
  const [promiseFor, setPromiseFor] = useState<{ jobId: string; jobLabel: string; ymd: string | null; context: string } | null>(null)
  // Where to land after a door opens: the doors row, or a part inside the door.
  const [doorScroll, setDoorScroll] = useState<{ id: string; n: number } | null>(null)
  // Bills and receipts show fourteen days until this is pressed.
  const [listsAll, setListsAll] = useState(false)
  // What is left after overhead (v2.6840): the breakdown under the eight week chart, closed until pressed.
  const [profitOpen, setProfitOpen] = useState(false)
  const narrow = useIsNarrowScreen()
  // The weakest link (link PR 1): the stage pressed; the lit link until someone presses another.
  const [pickedStage, setPickedStage] = useState<CallLink | null>(null)
  // The order (link PR 6): the badge pressed, if any; null closes the modal.
  const [orderFor, setOrderFor] = useState<CallLink | null>(null)
  // Everything else waits (link PR 7): the usual fix pressed, if any; it sets the dial, and dragging the dial clears it.
  const [reflexId, setReflexId] = useState<ReflexId | null>(null)
  // The card panels (link PR 9): which card's panel is open, if any. Money owed sits behind Money, Crew hours behind People.
  const [openCard, setOpenCard] = useState<'owed' | 'hours' | null>(null)
  // The breakdowns behind the two charts (link PR 11).
  const [netOpen, setNetOpen] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  /** ZZ test jobs leave the Bridge's own reads, the Bill pile and the Bill desk for everyone but a dev who shows them, as on the Dashboard (v2.5834, v2.6807). */
  const hideZz = useZzTestJobsHidden(role)
  // What the Bridge leaves out (punch list #334, PR 2): a list set on the page, of developments, customers and addresses.
  // The jobs it names leave through the same ids as the ZZ test jobs, so they are left out exactly where a test job is.
  const [leftOutRead, setLeftOutRead] = useState<LeftOutRead | null>(null)
  const [leftOutRules, setLeftOutRules] = useState<LeftOutRule[] | null>(null)
  const [leftOutSaved, setLeftOutSaved] = useState(true)
  const [leftOutJobIds, setLeftOutJobIds] = useState<ReadonlySet<string> | null>(null)
  useEffect(() => {
    if (!isOwnerOrDev(role) || !user?.id) return
    let cancelled = false
    void (async () => {
      try {
        const read = await loadLeftOut(supabase)
        if (cancelled) return
        setLeftOutRead(read)
        setLeftOutRules(read.rules)
        setLeftOutSaved(!read.isDefault)
      } catch {
        // A list that cannot be read leaves nothing out, and the page still loads.
        if (!cancelled) setLeftOutRules([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, user?.id])
  useEffect(() => {
    if (!leftOutRules) return
    let cancelled = false
    void (async () => {
      try {
        const ids = await loadLeftOutJobIds(supabase, leftOutRules)
        if (!cancelled) setLeftOutJobIds(ids)
      } catch {
        if (!cancelled) setLeftOutJobIds(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [leftOutRules])
  const fin = useDashboardFinancials(isOwnerOrDev(role) && leftOutJobIds != null, refreshKey, role, user?.id ?? null, leftOutJobIds)
  /** The ids every Bridge read takes (v2.6813): the ZZ test jobs while they are hidden, and the jobs of whatever the Bridge leaves out. Null keeps every job. */
  const readZzTestJobIds = useCallback(async (): Promise<ReadonlySet<string> | null> => {
    const zz = hideZz ? await loadZzTestJobIds(user?.id ?? null) : null
    return withLeftOutJobIds(zz, leftOutJobIds)
  }, [hideZz, user?.id, leftOutJobIds])
  /**
   * The viewer's ZZ switch alone, for the won rates. There a set stands for the switch, and a bid on something left
   * out leaves by the list's own rules, so a dev who shows ZZ bids keeps them when the list names something else.
   */
  const readZzSwitchIds = useCallback((): Promise<ReadonlySet<string> | null> => (hideZz ? loadZzTestJobIds(user?.id ?? null) : Promise.resolve(null)), [hideZz, user?.id])
  const zzKey = `${hideZz ? 'hide' : 'show'}:${leftOutRules ? leftOutKey(leftOutRules) : ''}`
  // The page follows a change at once and the list is saved behind it. A save that is refused says why and holds for the visit.
  const changeLeftOut = useCallback(
    async (next: LeftOutRule[]) => {
      setLeftOutRules(next)
      try {
        await saveLeftOut(supabase, next)
        setLeftOutSaved(true)
      } catch (e) {
        showToast(`Not saved, so it holds until you leave the page. ${formatErrorMessage(e)}`, 'error', 5000)
      }
    },
    [showToast],
  )

  useEffect(() => {
    // The left-out list is read first, so the page is read once, without the jobs it names.
    if (!isOwnerOrDev(role) || !user?.id || leftOutJobIds == null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const d = await loadBridgeData(supabase, { zzTestJobIds })
        if (cancelled) return
        setData(d)
        setCashDraft(d.cashSetting ? String(d.cashSetting.usd) : '')
        setFloorDraft(String(d.floorUsd))
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, user?.id, refreshKey, leftOutJobIds, readZzTestJobIds])

  useEffect(() => {
    if (!isOwnerOrDev(role) || !user?.id) return
    let cancelled = false
    setBankLoading(true)
    setBankError(null)
    void (async () => {
      try {
        const b = await loadBankRead(supabase)
        if (!cancelled) {
          setBank(b.cash)
          setBankNames(b.names)
          if (!accountsOutUnsavedRef.current) setAccountsOut(b.out)
        }
      } catch (e) {
        if (!cancelled) {
          setBank(null)
          setBankError(formatErrorMessage(e))
        }
      } finally {
        if (!cancelled) setBankLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, user?.id, refreshKey])

  const profit = useMemo(
    () =>
      data
        ? buildCourseModel({
            todayYmd: data.todayYmd,
            daysBack: BRIDGE_DAYS_BACK,
            daysAhead: 1,
            earnedByDay: data.earnedByDay,
            directByDay: data.directByDay,
            overheadByDay: data.overheadByDay,
            targetUsd: null,
            overheadPerDayBaseline: data.overheadPerDayBaseline,
          })
        : null,
    [data],
  )

  const typedRolled = useMemo(() => {
    if (!data?.cashSetting) return null
    return cashTodayFromAsOf({ cashAsOfUsd: data.cashSetting.usd, asOfYmd: data.cashSetting.asOfYmd, todayYmd: data.todayYmd, bankFlowByDay: data.bankFlowByDay })
  }, [data])
  // Cash on hand is the accounts switched on; `bank` stays the whole bank for the lines that compare it with the ledger.
  const cashAccounts = useMemo(() => (bank ? buildCashAccounts({ bank, names: bankNames, out: accountsOut }) : null), [bank, bankNames, accountsOut])
  const cashToday = useMemo(() => (cashAccounts ? cashAccounts.countedUsd : typedRolled), [cashAccounts, typedRolled])

  const history = useMemo(() => {
    if (!data || cashToday == null || !fin.data) return null
    return buildNetPositionHistory({
      todayYmd: data.todayYmd,
      daysBack: BRIDGE_DAYS_BACK,
      cashTodayUsd: cashToday,
      arTodayUsd: fin.data.ar.total,
      apTodayUsd: fin.data.ap.total,
      bankFlowByDay: data.bankFlowByDay,
      invoicesSentByDay: data.invoicesSentByDay,
      paymentsReceivedByDay: data.paymentsReceivedByDay,
      supplyDatedByDay: data.supplyDatedByDay,
      supplyPaidByDay: data.supplyPaidByDay,
    })
  }, [data, cashToday, fin.data])

  // The Collect desk (punch list #177, v2.5853): the pile by each payer's own pace, read when the window opens.
  const [collectOpen, setCollectOpen] = useState(false)
  const [collectReads, setCollectReads] = useState<{ forKey: string; reads: CollectDeskReads } | null>(null)
  const collectReadKey = fin.data ? `${fin.data.ar.count}:${fin.data.ar.total}:${fin.data.arCollections.count}` : ''
  useEffect(() => {
    // Since v2.5856 the reads load with the page: the Collect card's weeks read the pile kernel too.
    if (!fin.data || !data) return
    if (collectReads && collectReads.forKey === collectReadKey) return
    let cancelled = false
    const items = [...fin.data.ar.items, ...fin.data.arCollections.items]
    const key = collectReadKey
    void (async () => {
      try {
        const reads = await loadCollectDeskReads(supabase, { jobIds: items.map((i) => i.jobId).filter((id): id is string => !!id), invoiceIds: items.map((i) => arRowInvoiceId(i.key)).filter((id): id is string => !!id), canReadTouches: isOwnerOrDev(role) })
        if (!cancelled) setCollectReads({ forKey: key, reads })
      } catch {
        if (!cancelled) setCollectReads({ forKey: key, reads: { payAppJobIds: new Set(), gcPayerIds: new Set(), sentByInvoice: new Map(), touches: null } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fin.data, data, role, collectReads, collectReadKey])
  const collectDesk = useMemo(() => (collectReads && collectReads.forKey === collectReadKey ? buildCollectDeskFrom(fin.data, data as BridgeData, collectReads.reads) : null), [fin.data, data, collectReads, collectReadKey])
  // Every payer's jobs, not only the cut's: a lien deadline on a small account still reaches the owner's strip (v2.5873).
  const collectChipJobIds = useMemo(() => (collectDesk ? [...new Set(collectDesk.cut.payers.flatMap((p) => p.bills.map((b) => b.jobId)).filter((id): id is string => !!id))] : []), [collectDesk])
  const collectChips = useArLienChips(collectOpen && collectChipJobIds.length > 0, collectChipJobIds, data?.todayYmd ?? '', role, hideZz)
  // PR D (v2.5855): after the call, the sheet's writes are the Payment Chase touch and the promise the AR window already records.
  const collectOutcomeWriter = useMemo<CollectOutcomeWriter>(
    () => ({
      write: async (payer, w) => {
        if (!payer.payerId) throw new Error('This payer has no customer record to write to.')
        const jobIds = [...new Set(payer.bills.map((b) => b.jobId).filter((id): id is string => !!id))]
        if (w.kind === 'promise') {
          await recordPromiseForJobs({ customerId: payer.payerId, jobYmds: jobIds.map((id) => [id, w.ymd] as const), note: w.note, saidBy: w.saidBy, channel: 'phone' })
          return
        }
        await addPaymentChaseTouch({ customerId: payer.payerId, jobId: jobIds[0] ?? null, outcome: w.outcome, note: w.note })
      },
    }),
    [],
  )
  // Receipts and the doubtful: the sheet kernel's read (v2.5881), the page's own until then.
  const { receipts, doubtful } = useMemo(() => (data ? buildReceipts({ data, fin: fin.data, collectDesk }) : { receipts: [], doubtful: [] }), [data, fin.data, collectDesk])

  // Bills: supply due dates and payroll Fridays from the loader, plus sub labor owed on the default horizon (the sheet kernel's read).
  const bills = useMemo(() => (data ? buildBills(data, fin.data) : []), [data, fin.data])

  const forecast = useMemo(() => {
    if (!data || cashToday == null) return null
    const events: CashEvent[] = [...bills.map((b) => ({ ymd: b.ymd, usd: b.usd, label: b.label, kind: 'bill' as const })), ...receipts]
    return buildCashForecast({ todayYmd: data.todayYmd, daysAhead: BRIDGE_DAYS_AHEAD, cashTodayUsd: cashToday, floorUsd: data.floorUsd, events, dailyDrainUsd: data.dailyDrainUsd })
  }, [data, cashToday, receipts, bills])

  const confidence = useMemo(() => receiptsConfidence(receipts), [receipts])
  const carry = useMemo(() => (forecast ? carryingSentence(carryingDay(forecast, receipts), md) : null), [forecast, receipts])

  // Build by percent (link PR 3): the open jobs, the percent points and the jobs created, loaded once the Bridge data is in.
  const [buildInputs, setBuildInputs] = useState<BuildPaceInput | null>(null)
  const [buildError, setBuildError] = useState<string | null>(null)
  useEffect(() => {
    if (!data) return
    let cancelled = false
    setBuildInputs(null)
    setBuildError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const v = await loadBuildPaceInputs(supabase, { windowStart: data.windowStart, todayYmd: data.todayYmd, officeJobLedgerId: data.officeJobLedgerId, zzTestJobIds })
        if (!cancelled) setBuildInputs(v)
      } catch (e) {
        if (!cancelled) setBuildError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, readZzTestJobIds])
  const buildPace = useMemo(() => (buildInputs ? buildBuildPace(buildInputs) : null), [buildInputs])
  // The Bill pile (v2.5834): finished work less what is billed on the working and ready-to-bill jobs, read with Build's percent points.
  const [billJobs, setBillJobs] = useState<BillPileJob[] | null>(null)
  const [billError, setBillError] = useState<string | null>(null)
  useEffect(() => {
    if (!data) return
    let cancelled = false
    setBillJobs(null)
    setBillError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const v = await loadBillPileJobs(supabase, { officeJobLedgerId: data.officeJobLedgerId, zzTestJobIds })
        if (!cancelled) setBillJobs(v)
      } catch (e) {
        if (!cancelled) setBillError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, readZzTestJobIds])
  const billPile = useMemo(() => (billJobs && data ? buildBillPile({ jobs: billJobs, points: buildInputs?.points ?? [], todayYmd: data.todayYmd }) : null), [billJobs, buildInputs, data])

  // The percents prompt (v2.5245): the open jobs with no %, and the ones set this visit; a save patches the Build reads in place.
  const [pctSetThisVisit, setPctSetThisVisit] = useState<ReadonlyMap<string, number>>(() => new Map())
  const pctPrompt = useMemo(() => (buildInputs ? buildPctPrompt(buildInputs.openJobs, pctSetThisVisit) : null), [buildInputs, pctSetThisVisit])
  const savePct = useCallback((jobId: string, pct: number) => {
    setPctSetThisVisit((m) => new Map(m).set(jobId, pct))
    setBuildInputs((prev) => (prev ? withPctSet(prev, jobId, pct) : prev))
  }, [])

  // Market and Sales (link PR 4): the bids and estimates over the window and the awaiting span.
  const [demandInputs, setDemandInputs] = useState<DemandInput | null>(null)
  const [demandError, setDemandError] = useState<string | null>(null)
  useEffect(() => {
    if (!data) return
    let cancelled = false
    setDemandInputs(null)
    setDemandError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const v = await loadDemandInputs(supabase, { windowStart: data.windowStart, todayYmd: data.todayYmd, zzTestJobIds })
        if (!cancelled) setDemandInputs(v)
      } catch (e) {
        if (!cancelled) setDemandError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, readZzTestJobIds])
  const demand = useMemo(() => (demandInputs ? buildDemand(demandInputs) : null), [demandInputs])

  // Estimates through their won rate (punch list #318): every estimate ever sent, read once the page's data is in.
  // A read that fails leaves the line off the pipe; nothing else on the page waits on it.
  const [estimatesSent, setEstimatesSent] = useState<EstimateSent[] | null>(null)
  useEffect(() => {
    if (!data) return
    let cancelled = false
    void (async () => {
      try {
        // The viewer's ZZ switch, read the way the bids read it: a set leaves the ZZ test estimates out (punch list #334, PR 3).
        const zzTestJobIds = await readZzSwitchIds()
        if (cancelled) return
        const v = await loadEstimatesSent(supabase, { leftOut: leftOutRules ?? [], zzTestJobIds })
        if (!cancelled) setEstimatesSent(v)
      } catch {
        if (!cancelled) setEstimatesSent(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, leftOutRules, readZzSwitchIds])
  const estimateWins = useMemo(() => (data && estimatesSent ? buildEstimateWins({ todayYmd: data.todayYmd, windowStart: data.windowStart, estimates: estimatesSent }) : null), [data, estimatesSent])

  // Bids through theirs, the same way: every bid ever sent and the jobs made from them.
  const [bidsSent, setBidsSent] = useState<BidSent[] | null>(null)
  useEffect(() => {
    if (!data) return
    let cancelled = false
    void (async () => {
      try {
        const zzTestJobIds = await readZzSwitchIds()
        if (cancelled) return
        const v = await loadBidsSent(supabase, { zzTestJobIds, leftOut: leftOutRules ?? [] })
        if (!cancelled) setBidsSent(v)
      } catch {
        if (!cancelled) setBidsSent(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, readZzSwitchIds, leftOutRules])
  const bidWins = useMemo(() => (data && bidsSent ? buildBidWins({ todayYmd: data.todayYmd, windowStart: data.windowStart, bids: bidsSent }) : null), [data, bidsSent])
  // What Market is worth: both kinds of ask, each through its own won rate. It waits for both reads, so the pipe is sized once.
  const marketWorth = useMemo(() => (bidWins && estimateWins ? buildMarketWorth(bidWins, estimateWins) : null), [bidWins, estimateWins])

  // The Bill desk (punch list #192, v2.5930): the leaks, the fast lane and the scorecard, read once when the window first opens.
  // The kernel memo sits after the stage flow below, since its facts read the Bill card's paces and weeks.
  const [billOpen, setBillOpen] = useState(false)
  const [billReads, setBillReads] = useState<{ forKey: string; reads: BillDeskReads } | null>(null)
  const [billReadsError, setBillReadsError] = useState<string | null>(null)
  const billReadKey = data && billPile ? `${data.todayYmd}:${billPile.items.length}:${Math.round(billPile.knownUsd)}:${zzKey}` : ''
  useEffect(() => {
    if (!billOpen || !data || !billPile) return
    if (billReads && billReads.forKey === billReadKey) return
    let cancelled = false
    const key = billReadKey
    setBillReadsError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const reads = await loadBillDeskReads(supabase, { sinceYmd: scorecardStart(data.todayYmd), pileJobIds: billPile.items.map((i) => i.id), zzTestJobIds })
        if (!cancelled) setBillReads({ forKey: key, reads })
      } catch (e) {
        if (!cancelled) setBillReadsError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [billOpen, data, billPile, billReads, billReadKey, readZzTestJobIds])

  // The Build desk (punch list #192, v2.5929): hours in against work out per open job. The Schedule's blocks and the jobs' lifetime hours are read on the first open; the kernel runs below, once the stage flow is in.
  const [buildOpen, setBuildOpen] = useState(false)
  const [buildReads, setBuildReads] = useState<{ forKey: string; reads: BuildDeskReads } | null>(null)
  const [buildReadError, setBuildReadError] = useState<string | null>(null)
  const buildReadKey = buildInputs && data ? `${data.todayYmd}:${buildInputs.openJobs.map((j) => j.id).join(',')}` : ''
  useEffect(() => {
    if (!buildOpen || !buildInputs || !data) return
    if (buildReads && buildReads.forKey === buildReadKey) return
    let cancelled = false
    const key = buildReadKey
    setBuildReadError(null)
    void (async () => {
      try {
        const reads = await loadBuildDeskReads(supabase, { jobIds: buildInputs.openJobs.map((j) => j.id), todayYmd: data.todayYmd })
        if (!cancelled) setBuildReads({ forKey: key, reads })
      } catch (e) {
        if (!cancelled) {
          setBuildReadError(formatErrorMessage(e))
          setBuildReads({ forKey: key, reads: { blocks: [], names: new Map(), lifetimeHours: new Map() } })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [buildOpen, buildInputs, data, buildReads, buildReadKey])

  // The Market desk (punch list #192, v2.5931): the intake over the relationship book, read on the first open.
  const [marketOpen, setMarketOpen] = useState(false)
  const [marketReads, setMarketReads] = useState<{ forKey: string; reads: MarketDeskReads } | null>(null)
  const [marketError, setMarketError] = useState<string | null>(null)
  const marketReadKey = data ? `${data.todayYmd}:${demand?.market.bidsInvited ?? 0}:${demand?.market.estimatesRequested ?? 0}:${zzKey}` : ''
  useEffect(() => {
    if (!marketOpen || !data) return
    if (marketReads && marketReads.forKey === marketReadKey) return
    let cancelled = false
    const key = marketReadKey
    setMarketError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const reads = await loadMarketDeskReads(supabase, { todayYmd: data.todayYmd, zzTestJobIds })
        if (!cancelled) setMarketReads({ forKey: key, reads })
      } catch (e) {
        if (!cancelled) setMarketError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [marketOpen, data, marketReads, marketReadKey, readZzTestJobIds])

  // The Sales desk (punch list #192, v2.5932): the pile in expected dollars, read when the window first opens.
  const [salesOpen, setSalesOpen] = useState(false)
  const [salesReads, setSalesReads] = useState<{ forKey: string; reads: SalesDeskReads } | null>(null)
  const [salesError, setSalesError] = useState<string | null>(null)
  const salesReadKey = data && demand ? `${data.todayYmd}:${demand.sales.awaiting.bids}:${demand.sales.awaiting.bidsUsd}:${demand.sales.awaiting.estimates}:${demand.sales.awaiting.estimatesUsd}:${zzKey}` : ''
  useEffect(() => {
    if (!salesOpen || !data || !demand) return
    if (salesReads && salesReads.forKey === salesReadKey) return
    let cancelled = false
    const key = salesReadKey
    setSalesError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const reads = await loadSalesDeskReads(supabase, { todayYmd: data.todayYmd, zzTestJobIds })
        if (!cancelled) setSalesReads({ forKey: key, reads })
      } catch (e) {
        if (!cancelled) setSalesError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [salesOpen, data, demand, salesReads, salesReadKey, readZzTestJobIds])
  const salesDesk = useMemo(() => {
    if (!data || !demand || !salesReads || salesReads.forKey !== salesReadKey) return null
    // An asker with few marked bids is read at the won rate for bids the size of each ask, and the estimates at their own won rate (punch list #318).
    const bidSizeRates = bidWins ? BID_SIZES.map((size, i) => ({ underUsd: size.underUsd, rate: bidWins.sizes[i]?.usedRate ?? null })) : null
    return buildSalesDesk({ ...salesReads.reads, todayYmd: data.todayYmd, fallbackRate: bidWins?.coefficient ?? null, bidSizeRates, estimateShare: estimateWins?.coefficient ?? null })
  }, [data, demand, salesReads, salesReadKey, bidWins, estimateWins])

  // The pay week today falls in.
  const thisWeekStart = data ? payWeekContaining(data.todayYmd).start : null

  // The top line's weeks (the eight-week grid on recorded and approved time), read here because the stage cards take the field's pace from it.
  const weeksRange = useMemo(() => (data ? vectorRangeFor('weeks', data.todayYmd) : null), [data])
  useEffect(() => {
    if (!data || !weeksRange) return
    const key = `${weeksRange.start}:${weeksRange.end}:${zzKey}`
    const cached = daysCacheRef.current.get(key)
    if (cached) {
      setWeeksInputs(cached)
      setWeeksError(null)
      return
    }
    let cancelled = false
    setWeeksInputs(null)
    setWeeksError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const v = await loadVectorDaysInputs(supabase, { start: weeksRange.start, end: weeksRange.end, todayYmd: data.todayYmd, officeJobLedgerId: data.officeJobLedgerId, zzTestJobIds })
        daysCacheRef.current.set(key, v)
        if (!cancelled) setWeeksInputs(v)
      } catch (e) {
        if (!cancelled) setWeeksError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, weeksRange, zzKey, readZzTestJobIds])
  const headlineAndCards = useMemo(() => {
    if (!data || !weeksRange || !weeksInputs || !vectorInputs) return null
    const common = { zoom: 'weeks' as const, anchorYmd: weeksRange.end, todayYmd: data.todayYmd, people: vectorInputs.people, wages: vectorInputs.wages, sessions: weeksInputs.sessions, ratePerHourByJob: weeksInputs.ratePerHourByJob, assumedHalfJobs: weeksInputs.assumedHalfJobs, jobLabels: weeksInputs.jobLabels }
    const recorded = buildVectorGrid({ ...common, mode: 'recorded' })
    const approved = buildVectorGrid({ ...common, mode: 'approved' })
    const headline = buildHeadline({ recorded, approved })
    // The week cards (link PR 8): sessions counted by the pay week they fall in.
    const sessionsByWeek = new Map<string, number>()
    for (const sess of weeksInputs.sessions) {
      if (sess.officeJob || !(sess.hours > 0)) continue
      const wk = payWeekContaining(sess.workDate).start
      sessionsByWeek.set(wk, (sessionsByWeek.get(wk) ?? 0) + 1)
    }
    const cards = buildWeekCards({ headline, recorded, approved, sessionsByWeek, dateRange: formatWeekRangeLabel })
    // The Crew hours panel (link PR 10): office and bid hours by pay week; the grid keeps only field people.
    const officeByWeek = new Map<string, number>()
    for (const sess of weeksInputs.sessions) {
      if (!sess.officeJob || !(sess.hours > 0)) continue
      const wk = payWeekContaining(sess.workDate).start
      officeByWeek.set(wk, (officeByWeek.get(wk) ?? 0) + sess.hours)
    }
    return { headline, cards, recorded, approved, officeByWeek }
  }, [data, weeksRange, weeksInputs, vectorInputs])
  const headline = headlineAndCards?.headline ?? null
  // The field's pace by hours (follow-up A): earned per week on recorded time, the way the top line reads it; approved-only reads low while hours wait.
  const fieldPace = useMemo(() => (data && weeksInputs ? fieldPaceByHours({ sessions: weeksInputs.sessions, ratePerHourByJob: weeksInputs.ratePerHourByJob, windowStart: data.windowStart, todayYmd: data.todayYmd, weeks: BRIDGE_DAYS_BACK / 7 }) : null), [data, weeksInputs])

  // The weakest link (link PR 1): Bill and Collect from what the page already reads — the piles from the finance hook, the paces from the window's flows by day.
  const stageInput = useMemo<StageFlowInput | null>(() => {
    if (!data) return null
    const weeks = BRIDGE_DAYS_BACK / 7
    const sumWindow = (m: Map<string, number>): number => {
      let s = 0
      for (const [ymd, usd] of m) if (ymd >= data.windowStart && ymd <= data.todayYmd) s += usd
      return s
    }
    const billedPerWeek = sumWindow(data.invoicesSentByDay) / weeks
    const paidPerWeek = sumWindow(data.paymentsReceivedByDay) / weeks
    const lateCount = receipts.filter((r) => r.basis === 'late').length + doubtful.length
    // Build's pace is the larger of built-by-percent and earned-by-hours; Bill's in-rate is what the field earned on recorded time.
    const build = buildPace ? withFieldPaces(buildPace.stageInput, fieldPace?.earnedPerWeekUsd ?? null) : null
    const finishedPerWeek = fieldPace?.earnedPerWeekUsd ?? data.totals.earnedUsd / weeks
    return {
      // Market reads at what the asks are worth at the won rates (punch list #318), once both are read.
      market: demand ? { ...demand.market, worth: marketWorthInput(marketWorth, bidWins, estimateWins) } : null,
      sales: demand ? { ...demand.sales, soldPerWeekUsd: buildPace?.soldPerWeekUsd ?? null } : null,
      fieldPerWeekUsd: build?.outPerWeekUsd ?? null,
      bill: billPile ? billStageInput(billPile, finishedPerWeek, billedPerWeek) : null,
      // v2.5856: Collect's weeks read the bills past their day by each payer's own pace (the Collect desk's pile); what is not yet due is grey. The Dashboard's AR total stands in until the pile is read.
      collect: collectDesk
        ? { pileUsd: collectDesk.pile.byState.late.usd + collectDesk.pile.byState.broken.usd + collectDesk.pile.byState.doubtful.usd, notDueUsd: collectDesk.pile.byState.notdue.usd + collectDesk.pile.byState.promised.usd, pileCount: collectDesk.pile.pastDueCount, inPerWeekUsd: billedPerWeek, outPerWeekUsd: paidPerWeek, lateCount: collectDesk.pile.pastDueCount }
        : fin.data
          ? { pileUsd: fin.data.ar.total, pileCount: fin.data.ar.count, inPerWeekUsd: billedPerWeek, outPerWeekUsd: paidPerWeek, lateCount }
          : null,
      build,
      // No call holds a step for the week (punch list #334, PR 7): the red follows today's reading.
      heldLinkId: null,
      // "reading…" on Market and Sales while their loader is in flight; the error line below the cards is the failure state.
      demandLoading: !demand && !demandError,
    }
  }, [data, fin.data, receipts, doubtful, buildPace, demand, demandError, fieldPace, billPile, collectDesk, marketWorth, bidWins, estimateWins])
  const stageFlow = useMemo(() => (stageInput ? buildStageFlow(stageInput) : null), [stageInput])
  // The Bill desk's kernel (v2.5930): the facts the page knows at once, and the rows once the desk's own reads land.
  const billDesk = useMemo(() => {
    if (!billOpen || !data || !billPile || !billJobs || !stageInput?.bill) return null
    const weeks = BRIDGE_DAYS_BACK / 7
    const sumWindow = (m: Map<string, number>): number => {
      let s = 0
      for (const [ymd, usd] of m) if (ymd >= data.windowStart && ymd <= data.todayYmd) s += usd
      return s
    }
    const page: BillDeskPageInput = {
      todayYmd: data.todayYmd,
      windowStart: data.windowStart,
      pile: { knownUsd: billPile.knownUsd, readyUsd: billPile.items.filter((i) => i.source === 'ready').reduce((s, i) => s + i.usd, 0) },
      pace: { inPerWeekUsd: stageInput.bill.inPerWeekUsd, outPerWeekUsd: stageInput.bill.outPerWeekUsd, weeks: stageFlow?.stages.find((s) => s.id === 'bill')?.weeks ?? null, windowWeeks: weeks },
      flows: { billedUsd: sumWindow(data.invoicesSentByDay), paidUsd: sumWindow(data.paymentsReceivedByDay), arTotalUsd: fin.data?.ar.total ?? null },
      companyPaceDays: data.paySpeeds?.company?.medianDays ?? null,
      cashTodayUsd: cashToday ?? null,
    }
    const facts = billDeskFacts(page)
    if (!billReads || billReads.forKey !== billReadKey) return { facts, desk: null }
    const r = billReads.reads
    const jobs = shapeBillDeskJobs({ pile: billPile, jobs: billJobs, points: buildInputs?.points ?? [], sessions: weeksInputs?.sessions ?? [], labels: r.labels, readyDaysByJob: r.readyDaysByJob, invoices: r.invoices, windowStart: data.windowStart, todayYmd: data.todayYmd })
    const bills = shapeBillDeskBills({ invoices: r.invoices, labels: r.labels, readyDaysByJob: r.readyDaysByJob, todayYmd: data.todayYmd })
    return { facts, desk: buildBillDesk({ ...page, jobs, bills, dayLabel: md }) }
  }, [billOpen, data, billPile, billJobs, stageInput, stageFlow, fin.data, billReads, billReadKey, buildInputs, weeksInputs])
  // The Build desk's reading (v2.5929): the kernel over the page's Build reads, the top line's 13 weeks of sessions, the card's paces and the desk's own reads.
  const buildDesk = useMemo(() => {
    if (!buildInputs || !weeksInputs || !weeksRange || !data) return null
    const reads = buildReads && buildReads.forKey === buildReadKey ? buildReads.reads : null
    const spanWeeks = Math.max(1, Math.round((Date.parse(`${weeksRange.end}T00:00:00Z`) - Date.parse(`${weeksRange.start}T00:00:00Z`) + 86_400_000) / (7 * 86_400_000)))
    const b = stageInput?.build
    return buildBuildDesk({ openJobs: buildInputs.openJobs, points: buildInputs.points, sessions: weeksInputs.sessions, spanWeeks, todayYmd: data.todayYmd, reads, paces: b?.paces ?? null, outPerWeekUsd: b?.outPerWeekUsd ?? null, weeks: stageFlow?.stages.find((s) => s.id === 'build')?.weeks ?? null })
  }, [buildInputs, weeksInputs, weeksRange, data, buildReads, buildReadKey, stageInput, stageFlow])
  // The Market desk's kernel and header (v2.5931) sit after the stage input because they read the field's pace from it.
  const marketHeaderNow = useMemo(() => (demand ? marketHeader({ askedPerWeekUsd: (demand.market.bidsInvitedUsd + demand.market.estimatesRequestedUsd) / Math.max(1, demand.market.weeks), winShare: null, fieldPerWeekUsd: stageInput?.fieldPerWeekUsd ?? null }) : null), [demand, stageInput])
  const marketDesk = useMemo(() => {
    if (!data || !marketReads || marketReads.forKey !== marketReadKey) return null
    const r = marketReads.reads
    return buildMarketDesk({ todayYmd: data.todayYmd, windowStart: data.windowStart, bids: r.bids, estimates: r.estimates, gcNames: r.gcNames, firstBidYmdByGc: r.firstBidYmdByGc, lifetimeByGc: r.lifetimeByGc, winShare: null, fieldPerWeekUsd: stageInput?.fieldPerWeekUsd ?? null, dayLabel: md })
  }, [data, marketReads, marketReadKey, stageInput])
  // The pressed link (a stage or a resource); the lit stage is it when it is a stage, else the link.
  const litLink: CallLink | null = pickedStage ?? stageFlow?.linkId ?? null
  const litStage: StageId | null = litLink && isStageLink(litLink) ? litLink : (stageFlow?.linkId ?? null)

  // The dial (link PR 5): the pressed stage's pace, in dollars a week; the cards read the dial's flow while it is moved.
  const [dialUsd, setDialUsd] = useState<Partial<Record<StageId, number>>>({})
  const perUnitUsd = useMemo((): number | null => {
    if (!litStage || !data) return null
    const weeks = BRIDGE_DAYS_BACK / 7
    if (litStage === 'bill') return billPile && billPile.knownJobs > 0 ? billPile.knownUsd / billPile.knownJobs : null
    if (litStage === 'collect') return fin.data && fin.data.ar.count > 0 ? fin.data.ar.total / fin.data.ar.count : null
    if (litStage === 'build') {
      const b = stageInput?.build
      if (!b) return null
      if (fieldPace && fieldPace.hoursPerWeek > 0) return b.outPerWeekUsd / fieldPace.hoursPerWeek
      return data.crew.fieldHoursWindow > 0 ? b.outPerWeekUsd / (data.crew.fieldHoursWindow / weeks) : null
    }
    if (litStage === 'sales') return buildPace && buildPace.soldJobs > 0 ? buildPace.soldUsd / buildPace.soldJobs : null
    // Market's dial is in dollars of worth, so an ask is worth the window's worth over its asks.
    const m = stageInput?.market
    const asks = m ? m.bidsInvited + m.estimatesRequested : 0
    return m?.worth && asks > 0 ? (m.worth.perWeekUsd * m.weeks) / asks : null
  }, [litStage, data, billPile, fin.data, stageInput, fieldPace, buildPace])
  const dialSpecNow = useMemo(() => (stageInput && litStage ? dialSpec(stageInput, litStage, { perUnitUsd }) : null), [stageInput, litStage, perUnitUsd])
  const dialReading = useMemo(() => {
    if (!dialSpecNow || !stageInput || !litStage || !data) return null
    const usd = dialUsd[litStage] ?? dialSpecNow.todayUsd
    return buildDialReading(stageInput, litStage, usd, { spec: dialSpecNow, todayYmd: data.todayYmd, dayLabel: md })
  }, [dialSpecNow, stageInput, litStage, data, dialUsd])
  const dialMoved = !!(litStage && dialSpecNow && dialUsd[litStage] != null && dialUsd[litStage] !== dialSpecNow.todayUsd)
  const shownFlow = dialMoved && dialReading ? dialReading.flow : stageFlow

  // The three resources (link PR 6): what waits on the owner, the bank against the floor, who is in the field and who bills.
  const fieldPeople = useMemo(() => {
    if (!data) return 0
    const since = ymdAddDays(data.todayYmd, -6)
    return new Set((vectorInputs?.sessions ?? []).filter((x) => !x.officeJob && x.hours > 0 && x.workDate >= since).map((x) => x.userId)).size
  }, [data, vectorInputs])
  const resources = useMemo(() => {
    if (!data || !shownFlow) return null
    const sends = (vectorInputs?.invoiceSends ?? []).filter((x) => x.ymd >= data.windowStart)
    const billers = new Set(sends.filter((x) => x.userId).map((x) => x.userId as string)).size
    const billsWithoutSender = sends.filter((x) => !x.userId).length
    return buildResources({
      linkId: shownFlow.linkId,
      pendingHours: data.crew.pendingClosedHours,
      pendingSessions: data.crew.pendingClosedSessions,
      unpricedJobs: data.earned.noRevenueJobs.length,
      noPctJobs: buildPace?.pile.guessJobs ?? data.earned.assumedHalfJobs.length,
      unsortedBankRows: (data.hygiene.unattributedNoncard ?? 0) + (data.hygiene.unlinkedCard ?? 0),
      bidsNoValue: demand?.bidsNoValue ?? 0,
      bankUsd: cashToday,
      bankSynced: !!bank,
      lowestUsd: forecast ? forecast.lowest.cashUsd : null,
      lowestLabel: forecast ? md(forecast.lowest.ymd) : null,
      floorUsd: data.floorUsd,
      clearsFloor: forecast ? forecast.clearsFloor : null,
      fieldPeople,
      fieldHours7d: data.crew.fieldHours7d,
      billers,
      billsWithoutSender,
    })
  }, [data, shownFlow, vectorInputs, fieldPeople, buildPace, demand, cashToday, bank, forecast])
  const order = useMemo(() => (orderFor && shownFlow && resources ? buildOrder({ flow: shownFlow, resources, pressedId: orderFor }) : null), [orderFor, shownFlow, resources])
  const closeOrder = useCallback(() => setOrderFor(null), [])

  // Everything else waits (link PR 7): the four presses sized from the page's numbers, and the pressed one's line.
  const reflexes = useMemo(() => (stageInput && data ? buildReflexes({ stageInput, fieldHoursPerWeek: fieldPace && fieldPace.hoursPerWeek > 0 ? fieldPace.hoursPerWeek : data.crew.fieldHoursWindow > 0 ? data.crew.fieldHoursWindow / (BRIDGE_DAYS_BACK / 7) : null, fieldPeople }) : null), [stageInput, data, fieldPeople, fieldPace])
  const reflexLineNow = useMemo(() => {
    if (!reflexId || !reflexes || !stageFlow || !stageInput || !profit) return null
    const r = reflexes.find((x) => x.id === reflexId)
    if (!r) return null
    const billPerJob = billPile && billPile.knownJobs > 0 ? billPile.knownUsd / billPile.knownJobs : null
    return reflexLine({ reflex: r, before: stageFlow, reading: r.stage && litStage === r.stage ? dialReading : null, stageInput, overheadPerDayUsd: profit.speed.overheadPerDay, billPerJobUsd: billPerJob })
  }, [reflexId, reflexes, stageFlow, stageInput, profit, billPile, litStage, dialReading])
  const pressReflex = useCallback(
    (id: ReflexId) => {
      const r = reflexes?.find((x) => x.id === id)
      if (!r) return
      setReflexId(id)
      if (r.stage && r.usd != null) {
        setPickedStage(r.stage)
        setDialUsd({ [r.stage]: r.usd })
      } else setDialUsd({})
    },
    [reflexes],
  )
  const resetReflex = useCallback(() => {
    setReflexId(null)
    setDialUsd({})
  }, [])

  // Today's numbers behind the moves on the first screen's card.
  const moveNumbers = useMemo(
    () => ({
      bill: billPile ? billPile.knownUsd : null,
      chase: receipts.filter((r) => r.basis === 'late').reduce((s, r) => s + r.usd, 0) + doubtful.reduce((s, d) => s + d.usd, 0),
      approve: data ? data.crew.pendingClosedHours : null,
      price: data ? data.earned.noRevenueJobs.length : null,
      // A job set above nothing on this visit has its percent: it is off the count, and off the list below.
      pct: data ? data.earned.assumedHalfJobs.filter((id) => !((pctSetThisVisit.get(id) ?? 0) > 0)).length : null,
    }),
    [billPile, receipts, doubtful, data, pctSetThisVisit],
  )
  const deskReading = useMemo(() => {
    if (litLink && !isStageLink(litLink)) {
      const r = resources?.find((x) => x.id === litLink)
      return r ? `${r.gauge}. ${r.oneLine.charAt(0).toUpperCase()}${r.oneLine.slice(1)}.` : ''
    }
    const s = stageFlow?.stages.find((x) => x.id === litLink)
    if (!s) return ''
    if (!s.readable) return 'The app does not read this stage yet.'
    return `${s.pile.headline}${s.pile.sub.length ? `, ${s.pile.sub.join(', ')}` : ''}. ${s.flow.map((f) => `${f.who} ${f.usd} a week`).join('; ')}. ${s.weeksText}.`
  }, [stageFlow, litLink, resources])

  // PR C (v2.5854): the one move per payer with its words and paper, the owner's decisions, the what-if, read from the same pile.
  const collectPlan = useMemo(() => {
    if (!collectDesk || !data) return null
    const chipFor = (p: { bills: ReadonlyArray<{ jobId: string | null }> }) => {
      if (!collectChips.chipsByJob) return null
      for (const b of p.bills) {
        const c = b.jobId ? collectChips.chipsByJob.get(b.jobId) : null
        if (c) return c
      }
      return null
    }
    const sheet = buildCollectSheet(collectDesk.cut, (p) => collectMoveFor(p, { chip: chipFor(p), todayYmd: data.todayYmd, dayLabel: md, lienHref: lienArChipHref }))
    const decisions = collectDecisions(collectDesk.cut, { chipFor, lienHref: lienArChipHref, customerHref: (id) => `/customers/${id}`, jobsHref: (ids) => (ids.length === 1 ? `/jobs?tab=stages&edit=${ids[0]}` : '/jobs?tab=stages'), dayLabel: md })
    const collect = stageInput?.collect
    const whatIf = collect ? collectWhatIf({ pileUsd: collect.pileUsd, askUsd: sheet.askUsd, paidPerWeekUsd: collect.outPerWeekUsd, billedPerWeekUsd: collect.inPerWeekUsd, windowWeeks: BRIDGE_DAYS_BACK / 7, buildWeeks: stageFlow?.stages.find((s) => s.id === 'build')?.weeks ?? null }) : null
    return { sheet, decisions, whatIf }
  }, [collectDesk, data, collectChips.chipsByJob, stageInput, stageFlow])

  // The first screen (punch list #303, PR 1): the tiles and the card *What to do now*, read from the readings above.
  // The model reads today and nothing else (punch list #334): the slowest step, or cash in a week it leads.
  const weekInput = useMemo((): WeekCallInput | null => {
    if (!data || !thisWeekStart) return null
    const late = receipts.filter((r) => r.basis === 'late')
    return {
      todayYmd: data.todayYmd,
      weekStart: thisWeekStart,
      headline,
      forecast,
      cashTodayUsd: cashToday,
      cashNote: cashAccounts?.note ?? null,
      cashMayLead: WEEK_CASH_MAY_LEAD && bank != null,
      flow: stageFlow,
      moveNumbers,
      counts: { billJobs: billPile?.knownJobs ?? null, lateInvoices: late.length + doubtful.length },
      // The hazards are the supply invoices due, by day: the one bill a call can ask more days on.
      supplyDue: forecast ? (data.hazards.find((h) => h.ymd > data.todayYmd && h.ymd <= forecast.lowest.ymd) ?? null) : null,
      dayLabel: md,
    }
  }, [data, thisWeekStart, receipts, doubtful, headline, forecast, cashToday, cashAccounts, bank, stageFlow, moveNumbers, billPile])
  const weekModel = useMemo(() => (weekInput ? buildWeekCall(weekInput) : null), [weekInput])
  // The real things behind each move on the card (punch list #334, PR 8; `callDive.ts`), from what the page has
  // already read: nothing here is a new count.
  const supplyDueYmd = weekInput?.supplyDue?.ymd ?? null
  // The hours behind each job with no percent, and whose they are (punch list #334, PR 10; `jobHours.ts`). One read
  // for those jobs, again after a refresh.
  const noPctKey = data ? [...data.earned.assumedHalfJobs].sort().join(',') : ''
  const [jobHoursSessions, setJobHoursSessions] = useState<JobHoursSession[] | null>(null)
  const [hoursFor, setHoursFor] = useState<{ jobId: string; jobLabel: string; pctJob: DivePctJob | null } | null>(null)
  useEffect(() => {
    if (!noPctKey) {
      setJobHoursSessions([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { loadJobHours } = await import('../lib/bridge/jobHoursIo')
        const rows = await loadJobHours(supabase, noPctKey.split(','), NO_NAMES)
        if (!cancelled) setJobHoursSessions(rows)
      } catch {
        // An extra reading: a read that fails leaves the lines as they were, with no hours on them.
        if (!cancelled) setJobHoursSessions(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [noPctKey, refreshKey])
  const jobHours = useMemo(() => (jobHoursSessions ? jobHoursByJob(jobHoursSessions) : null), [jobHoursSessions])
  // What a percent is judged from, for the same jobs (v2.7221; `pctFacts.ts`): read while the move or its window is on screen.
  const noPctJobRows = useMemo(() => (data ? data.jobs.filter((j) => data.earned.assumedHalfJobs.includes(j.id)) : []), [data])
  const pctFacts = useBridgePctFacts({ jobs: noPctJobRows, hours: jobHours, todayYmd: data?.todayYmd ?? null, enabled: pctFor != null || (weekModel?.card.moves.some((m) => m.key === 'pct') ?? false), refreshKey })
  const callDives = useMemo<DiveFacts | null>(() => {
    if (!data) return null
    const jobById = new Map(data.jobs.map((j) => [j.id, j]))
    const named = (ids: ReadonlyArray<string>) => ids.map((id) => jobById.get(id)).filter((j): j is NonNullable<typeof j> => j != null)
    const byRevenue = (a: { revenueUsd: number | null }, b: { revenueUsd: number | null }) => (b.revenueUsd ?? 0) - (a.revenueUsd ?? 0)
    // A bill's own name, the job's number and name, by the AR row's key.
    const billLabelByKey = new Map([...(fin.data?.ar.items ?? []), ...(fin.data?.arCollections.items ?? [])].map((i) => [i.key, i.label] as const))
    return {
      // Each customer with the day they named, and their open bills as projects, each with its own promised day.
      payers: (collectDesk?.cut.cut ?? []).map((p) => ({
        key: p.payerId ?? p.payerName,
        payerId: p.payerId,
        name: p.payerName,
        lateUsd: p.latePileUsd,
        usd: p.usd,
        oldestAgeDays: p.oldestAgeDays,
        promise: { state: p.promise.state, ymd: p.promise.promise?.promisedYmd ?? null },
        projects: [...p.bills]
          .filter((b) => b.usd > 0)
          .sort((a, b) => b.usd - a.usd)
          .map((b) => ({ key: b.key, jobId: b.jobId, label: billLabelByKey.get(b.key) ?? 'A bill with no job', usd: b.usd, ageDays: b.ageDays, broken: b.state === 'broken', promisedYmd: b.promise?.promisedYmd ?? null, promisedBy: b.promise?.markedByName ?? null })),
      })),
      billJobs: (billPile?.items ?? [])
        .filter((i) => i.usd > 0 && i.source !== 'guess' && i.source !== 'no-price')
        .sort((a, b) => b.usd - a.usd)
        .flatMap((i) => {
          const j = jobById.get(i.id)
          return j ? [{ id: j.id, label: j.label, usd: i.usd }] : []
        }),
      // Each job as the percent window takes it, so its row can set the percent here: the percent prompt's own row
      // when it knows the job, else the job named by its label, as the prompt names a job with no number.
      // A job set above nothing on this visit leaves the list: it has its percent. One set to 0% stays, and says so.
      noPctJobs: named(data.earned.assumedHalfJobs)
        .filter((j) => !((pctSetThisVisit.get(j.id) ?? 0) > 0))
        .sort(byRevenue)
        .map((j) => ({
          id: j.id,
          label: j.label,
          revenueUsd: j.revenueUsd,
          pctJob: pctPrompt?.rows.find((r) => r.id === j.id)?.modalJob ?? { id: j.id, hcpNumber: j.label, jobName: j.label, label: j.label },
          setPct: pctSetThisVisit.get(j.id) ?? null,
          hoursLine: jobHours ? jobHoursLine(jobHours.get(j.id)) : null,
          hoursCell: jobHours ? jobHoursCell(jobHours.get(j.id)) : null,
          lastWorked: pctFacts.facts?.has(j.id) ? lastWorkedCell(pctFacts.facts.get(j.id)!, data.todayYmd, md) : null,
        })),
      noPriceJobs: named(data.earned.noRevenueJobs).map((j) => ({ id: j.id, label: j.label })),
      // The bills behind the cash moves' ask: the ones that fall due on the day it names, a row for each supply house.
      supplyBills: [
        ...Object.values(fin.data?.apBills ?? {})
          .filter((b) => b.amount > 0 && supplyDueYmd != null && b.dueDateYmd === supplyDueYmd)
          .reduce((houses, b) => {
            const h = houses.get(b.houseName) ?? { houseId: b.houseId ?? null, name: b.houseName, usd: 0, dueYmd: b.dueDateYmd, bills: 0 }
            houses.set(b.houseName, { ...h, usd: h.usd + b.amount, bills: h.bills + 1 })
            return houses
          }, new Map<string, { houseId: string | null; name: string; usd: number; dueYmd: string | null; bills: number }>())
          .values(),
      ].sort((a, b) => b.usd - a.usd),
      dayLabel: md,
    }
  }, [data, collectDesk, billPile, fin.data, supplyDueYmd, pctPrompt, pctSetThisVisit, jobHours, pctFacts.facts])
  // Where each line of the card stands as a to-do (punch list #334, PR 9; `callTodoState.ts`). The page asks for the
  // cards that carry one of its own tags (PR 12), or one of its tagged addresses in a link, and reads again after a
  // card is made or changed here.
  const todoList = useMemo(() => {
    const out: CallTodo[] = []
    if (!weekModel || !callDives) return out
    for (const move of weekModel.card.moves) {
      for (const item of moveDive(move, callDives)?.items ?? []) {
        if (item.todo) out.push(item.todo)
        for (const p of item.projects ?? []) if (p.todo) out.push(p.todo)
      }
    }
    return out
  }, [weekModel, callDives])
  const todoLinksKey = useMemo(() => [...new Set(todoList.map((t) => `${APP_ORIGIN}${todoLinkPaths(t)[0]}`))].sort().join('\n'), [todoList])
  const todoTagsKey = useMemo(() => [...new Set(todoList.map((t) => t.key))].sort().join('\n'), [todoList])
  const [todoCards, setTodoCards] = useState<TodoCard[] | null>(null)
  const [todoTick, setTodoTick] = useState(0)
  const [todoSeen, setTodoSeen] = useState<Extract<TodoState, { kind: 'open' | 'covered' | 'done' }> | null>(null)
  useEffect(() => {
    if (!todoLinksKey) {
      setTodoCards([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { loadTodoCards } = await import('../lib/bridge/callTodoIo')
        // A card's days are the company's days, as today is.
        const cards = await loadTodoCards(supabase, todoTagsKey.split('\n').filter(Boolean), todoLinksKey.split('\n'), calendarYmdInAppTzFromIso, NO_NAMES)
        if (!cancelled) setTodoCards(cards)
      } catch {
        // The checks are an extra reading: a read that fails leaves every check grey, and the list as it was.
        if (!cancelled) setTodoCards([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [todoLinksKey, todoTagsKey, todoTick, refreshKey])
  const todoStatesByKey = useMemo(() => (todoCards && data ? todoStates(todoCards, data.todayYmd) : null), [todoCards, data])
  const readTodoLines = useCallback<TodoLinesRead>(async (itemId, instanceIds) => (await import('../lib/taskLinesIo')).loadTaskLines({ itemIds: [itemId], taskIds: [], instanceIds }), [])

  // The two balances on the first screen (punch list #334, PR 6). The accrual balance is the page's net position:
  // cash, plus what customers owe, less what the company owes, the three figures Money owed walks through.
  // Runway burns payroll and overhead alone, the two figures the cash forecast already spends.
  const weekMoney = useMemo(() => {
    if (!weekInput) return null
    const burnPerDayUsd = data ? burnPerDay({ payrollPerWeekUsd: data.payrollWeeklyEstUsd, overheadPerDayUsd: data.dailyDrainUsd }) : null
    return {
      cash: cashLine({ ...weekInput, burnPerDayUsd }),
      accrual: accrualLine({ cashUsd: cashToday, owedToYouUsd: fin.data ? fin.data.ar.total : null, owedByYouUsd: fin.data ? fin.data.ap.total : null, burnPerDayUsd }),
      foot: runwayFoot(burnPerDayUsd),
    }
  }, [weekInput, cashToday, fin.data, data])

  // One account's switch: the page follows at once, the row is saved behind it, and a save that is refused says why.
  const flipAccount = useCallback(
    async (id: string) => {
      const next = flipAccountOut(accountsOut, id)
      setAccountsOut(next)
      try {
        await saveAccountsOut(supabase, next)
        accountsOutUnsavedRef.current = false
      } catch (e) {
        accountsOutUnsavedRef.current = true
        showToast(`Not saved, so it holds until you leave the page. ${formatErrorMessage(e)}`, 'error', 5000)
      }
    },
    [accountsOut, showToast],
  )

  const saveCash = useCallback(async () => {
    const v = Number(cashDraft.replace(/[^0-9.-]/g, ''))
    if (!Number.isFinite(v)) {
      showToast('Cash on hand must be a number', 'error', 2500)
      return
    }
    if (!data) return
    try {
      await saveBridgeCashOnHand(supabase, v, data.todayYmd)
      setData((prev) => (prev ? { ...prev, cashSetting: { usd: v, asOfYmd: prev.todayYmd } } : prev))
      showToast(`Cash on hand set: ${money(v)} as of today`, 'success', 2500)
    } catch (e) {
      showToast(formatErrorMessage(e), 'error', 4000)
    }
  }, [cashDraft, data, showToast])

  const saveFloor = useCallback(async () => {
    const v = Number(floorDraft.replace(/[^0-9.-]/g, ''))
    if (!Number.isFinite(v) || v < 0) {
      showToast('Floor must be a number', 'error', 2500)
      return
    }
    try {
      await saveBridgeFloor(supabase, v)
      setData((prev) => (prev ? { ...prev, floorUsd: v } : prev))
      showToast(`Cash floor set: ${money(v)}`, 'success', 2500)
    } catch (e) {
      showToast(formatErrorMessage(e), 'error', 4000)
    }
  }, [floorDraft, showToast])

  // Vectors (v2.3344): per-person inputs for the window, loaded once the Bridge data is in; the pay week is picked on the page.
  useEffect(() => {
    if (!data) return
    let cancelled = false
    setVectorInputs(null)
    setVectorError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const v = await loadBridgeVectorInputs(supabase, data, { zzTestJobIds })
        if (!cancelled) setVectorInputs(v)
      } catch (e) {
        if (!cancelled) setVectorError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, readZzTestJobIds])
  const vectorWeek = useMemo(() => {
    if (!data) return null
    return payWeekContaining(vectorWeekStart ?? data.todayYmd)
  }, [data, vectorWeekStart])
  const vectors = useMemo(() => {
    if (!vectorWeek) return null
    const inputs: BridgeVectorInputs = vectorInputs ?? { people: [], wages: [], sessions: [], ratePerHourByJob: new Map(), invoiceSends: [], payments: [], pctUpdates: [], fieldReports: [], bidsSent: [], bidsWon: [] }
    return buildVectors({ weekStart: vectorWeek.start, weekEnd: vectorWeek.end, ...inputs, assumedHalfJobs: new Set(data?.earned.assumedHalfJobs ?? []) })
  }, [vectorWeek, vectorInputs, data])

  // Vectors by the day (v2.4217): the period's sessions + rates per zoom and anchor, loaded once the Bridge data is in.
  const daysRange = useMemo(() => (data ? vectorRangeFor(daysZoom, daysAnchor ?? data.todayYmd) : null), [data, daysZoom, daysAnchor])
  useEffect(() => {
    if (!data || !daysRange || doorParam !== 'people') return
    const key = `${daysRange.start}:${daysRange.end}:${zzKey}`
    const cached = daysCacheRef.current.get(key)
    if (cached) {
      setDaysInputs(cached)
      setDaysError(null)
      return
    }
    let cancelled = false
    setDaysInputs(null)
    setDaysError(null)
    void (async () => {
      try {
        const zzTestJobIds = await readZzTestJobIds()
        if (cancelled) return
        const v = await loadVectorDaysInputs(supabase, { start: daysRange.start, end: daysRange.end, todayYmd: data.todayYmd, officeJobLedgerId: data.officeJobLedgerId, zzTestJobIds })
        daysCacheRef.current.set(key, v)
        if (!cancelled) setDaysInputs(v)
      } catch (e) {
        if (!cancelled) setDaysError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, daysRange, doorParam, zzKey, readZzTestJobIds])
  const daysGrid = useMemo(() => {
    if (!data || !daysRange || !daysInputs || !vectorInputs) return null
    return buildVectorGrid({
      zoom: daysZoom,
      anchorYmd: daysZoom === 'days' ? daysRange.start : daysRange.end,
      todayYmd: data.todayYmd,
      mode: daysMode,
      people: vectorInputs.people,
      wages: vectorInputs.wages,
      sessions: daysInputs.sessions,
      ratePerHourByJob: daysInputs.ratePerHourByJob,
      assumedHalfJobs: daysInputs.assumedHalfJobs,
      jobLabels: daysInputs.jobLabels,
      priorRatePerHourByJob: daysInputs.priorRatePerHourByJob,
    })
  }, [data, daysZoom, daysMode, daysRange, daysInputs, vectorInputs])


  // The Money owed and Crew hours panels (link PR 10).
  const owedPanel = useMemo(() => {
    if (!data || !fin.data || !billPile) return null
    return buildOwedPanel({
      todayYmd: data.todayYmd,
      cashUsd: cashToday,
      ar: { total: fin.data.ar.total, count: fin.data.ar.count, items: fin.data.ar.items },
      arCollections: { total: fin.data.arCollections.total, count: fin.data.arCollections.count },
      ap: { total: fin.data.ap.total, supplyTotal: fin.data.ap.supplyTotal, payrollTotal: fin.data.ap.payrollTotal, subLaborTotal: fin.data.ap.subLaborTotal, upcomingTotal: fin.data.ap.upcomingTotal },
      unbilled: { total: billPile.knownUsd, count: billPile.knownJobs },
      bills,
      noContractJobs: data.earned.noRevenueJobs.length,
      noPctJobs: buildPace?.pile.guessJobs ?? data.earned.assumedHalfJobs.length,
      pendingClosedHours: data.crew.pendingClosedHours,
      unattributedNoncard: data.hygiene.unattributedNoncard,
      dayLabel: md,
    })
  }, [data, fin.data, cashToday, bills, buildPace, billPile])
  const hoursPanel = useMemo(() => {
    if (!data || !headlineAndCards) return null
    return buildHoursPanel({
      recorded: headlineAndCards.recorded,
      approved: headlineAndCards.approved,
      officeByWeek: headlineAndCards.officeByWeek,
      todayYmd: data.todayYmd,
      pendingClosedHours: data.crew.pendingClosedHours,
      pendingClosedSessions: data.crew.pendingClosedSessions,
      officeBidHours7d: data.crew.officeBidHours7d,
      jobsWorked: data.jobsWorked,
      noContractJobs: data.earned.noRevenueJobs.length,
      fieldEarnedPerHour: data.crew.fieldHoursWindow > 0 ? data.totals.earnedUsd / data.crew.fieldHoursWindow : null,
      thisWeekRecordedUsd: headlineAndCards.headline.thisWeek.recordedUsd,
      weekLabel: md,
    })
  }, [data, headlineAndCards])

  // Truth check: paper profit vs the net position change over the chart's days — flows only, so it reads before cash is typed.
  const truth = useMemo<TruthCheck | null>(() => {
    if (!data) return null
    const assumedHalfEarnedUsd = data.earned.assumedHalfJobs.reduce((s, id) => s + (data.earned.earnedByJob.get(id) ?? 0), 0)
    return buildTruthCheck({
      windowStart: data.windowStart,
      todayYmd: data.todayYmd,
      earnedByDay: data.earnedByDay,
      directByDay: data.directByDay,
      overheadByDay: data.overheadByDay,
      bankFlowByDay: data.bankFlowByDay,
      invoicesSentByDay: data.invoicesSentByDay,
      paymentsReceivedByDay: data.paymentsReceivedByDay,
      supplyDatedByDay: data.supplyDatedByDay,
      supplyPaidByDay: data.supplyPaidByDay,
      pendingClosedHours: data.crew.pendingClosedHours,
      pendingClosedSessions: data.crew.pendingClosedSessions,
      fieldLaborUsd: data.totals.fieldLaborUsd,
      fieldHoursWindow: data.crew.fieldHoursWindow,
      assumedHalfEarnedUsd,
      assumedHalfJobs: data.earned.assumedHalfJobs.length,
      noContractJobs: data.earned.noRevenueJobs.length,
      unattributedNoncard: data.hygiene.unattributedNoncard,
      unlinkedCard: data.hygiene.unlinkedCard,
    })
  }, [data])


  const typedDaysAgo = data?.cashSetting ? Math.round((Date.parse(`${data.todayYmd}T00:00:00Z`) - Date.parse(`${data.cashSetting.asOfYmd}T00:00:00Z`)) / 86_400_000) : null
  const speed = profit?.speed
  const windowStartLabel = data ? md(data.windowStart) : ''
  const netToday = history ? (history[history.length - 1]?.netUsd ?? 0) : null
  const netStart = history ? (history[0]?.netUsd ?? 0) : null
  const cashRead = forecast
    ? forecast.clearsFloor
      ? `Lowest point: ${shortK(forecast.lowest.cashUsd)} on ${md(forecast.lowest.ymd)} — stays above your ${shortK(forecast.floorUsd)} floor`
      : `Lowest point: ${shortK(forecast.lowest.cashUsd)} on ${md(forecast.lowest.ymd)} — ${shortK(forecast.floorUsd - forecast.lowest.cashUsd)} under your ${shortK(forecast.floorUsd)} floor · ${forecast.daysUnderFloor} day${forecast.daysUnderFloor === 1 ? '' : 's'} below it`
    : ''
  const netLight = netPositionLight(netToday != null && netStart != null ? { deltaUsd: netToday - netStart, todayUsd: netToday, startLabel: windowStartLabel, paperProfitUsd: truth?.paper.profitUsd ?? null, billingLagUsd: truth?.billingLagUsd ?? null } : null)
  const cashLightRead = cashLight(forecast && data ? { lowestUsd: forecast.lowest.cashUsd, lowestLabel: md(forecast.lowest.ymd), floorUsd: forecast.floorUsd, clearsFloor: forecast.clearsFloor, daysUnderFloor: forecast.daysUnderFloor, typedLabel: bank ? null : data.cashSetting ? md(data.cashSetting.asOfYmd) : null, typedDaysAgo: bank ? null : typedDaysAgo, synced: !!bank } : null)
  const bankReadAt = bank ? new Date(bank.readAtIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  // Soft numbers (PR 2): the one list of what makes the reading unsure, where Fix the reading and This week stood.
  const softNumbers = useMemo(() => {
    if (!data) return []
    const assumedHalfEarnedUsd = data.earned.assumedHalfJobs.reduce((s, id) => s + (data.earned.earnedByJob.get(id) ?? 0), 0)
    const labelById = new Map(data.jobs.map((j) => [j.id, j.label]))
    return buildSoftNumbers({
      pendingClosedHours: data.crew.pendingClosedHours,
      pendingClosedSessions: data.crew.pendingClosedSessions,
      headlineRecordedUsd: headline?.thisWeek.recordedUsd ?? null,
      headlineApprovedUsd: headline?.thisWeek.approvedUsd ?? null,
      bankUsd: bank?.usd ?? null,
      typedRolledUsd: typedRolled,
      typedLabel: data.cashSetting ? md(data.cashSetting.asOfYmd) : null,
      typedDaysAgo,
      assumedHalfJobs: data.earned.assumedHalfJobs.length,
      assumedHalfEarnedUsd,
      noContractJobs: data.earned.noRevenueJobs.map((id) => ({ id, label: labelById.get(id) ?? id })),
      unattributedNoncard: data.hygiene.unattributedNoncard,
      unlinkedCard: data.hygiene.unlinkedCard,
      overheadPerDayUsd: profit?.speed.overheadPerDay ?? data.overheadPerDayBaseline,
      bidsNoValue: vectorInputs ? vectorInputs.bidsSent.filter((b) => b.ymd >= data.windowStart && b.usd <= 0).length : 0,
    })
  }, [data, headline, bank, typedRolled, typedDaysAgo, profit, vectorInputs])

  // What the hours still waiting on approval earn and cost, by day (v2.6965): from the recorded sessions the headline already loads.
  const waitingDays = useMemo(() => {
    if (!data || !weeksInputs || !vectorInputs) return null
    return buildWaitingDays({ start: data.windowStart, end: data.todayYmd, wages: vectorInputs.wages, sessions: weeksInputs.sessions, ratePerHourByJob: weeksInputs.ratePerHourByJob })
  }, [data, weeksInputs, vectorInputs])

  // What is left after overhead (v2.6840): the Daily profit rate panel's reading, opened from the eight week chart.
  // On recorded time since v2.6965, as the headline; on approved time, with its warning, only when the recorded hours cannot be read.
  const profitPanel = useMemo(() => {
    if (!data || !profit) return null
    // Still reading the recorded hours: the press waits with the chart above it, so the figures never switch under a reader.
    if (!waitingDays && weeksError == null && vectorError == null) return null
    const recorded = waitingDays
      ? buildRecordedReading({ todayYmd: data.todayYmd, daysBack: BRIDGE_DAYS_BACK, earnedByDay: data.earnedByDay, directByDay: data.directByDay, overheadByDay: data.overheadByDay, overheadPerDayBaseline: data.overheadPerDayBaseline, totals: data.totals, waiting: waitingDays })
      : null
    return buildProfitPanel({
      windowStart: data.windowStart,
      todayYmd: data.todayYmd,
      earnedByDay: recorded?.earnedByDay ?? data.earnedByDay,
      directByDay: recorded?.directByDay ?? data.directByDay,
      overheadByDay: data.overheadByDay,
      speed: recorded?.speed ?? profit.speed,
      contributionMargin: recorded ? recorded.contributionMargin : profit.contributionMargin,
      totals: recorded?.totals ?? data.totals,
      waitingWeeks: new Set((headline?.weeks ?? []).filter((w) => w.waiting).map((w) => w.start)),
      pendingClosedHours: data.crew.pendingClosedHours,
      unlinkedCard: data.hygiene.unlinkedCard,
      unattributedNoncard: data.hygiene.unattributedNoncard,
      fieldMadePerHour: data.crew.fieldHoursWindow > 0 ? (data.totals.earnedUsd - data.totals.fieldLaborUsd) / data.crew.fieldHoursWindow : null,
      waiting: waitingDays ? { hours: waitingDays.hours, approvedLeftUsd: profit.speed.climbPerDay } : null,
      weekLabel: md,
    })
  }, [data, profit, headline, waitingDays, weeksError, vectorError])

  // What a fix is worth (v2.6840): This week's sizes, on the usual fixes' own rows, and the bids due under them.
  const fixSizes = useMemo(() => {
    if (!data) return null
    return buildFixSizes({
      fieldEarnedPerHour: data.totals.earnedUsd > 0 && data.crew.fieldHoursWindow > 0 ? data.totals.earnedUsd / data.crew.fieldHoursWindow : null,
      contributionMargin: profit?.contributionMargin ?? null,
      overheadPerDayUsd: profit?.speed.overheadPerDay ?? 0,
      bidsDue: data.levers.bidsDue,
      dayLabel: md,
    })
  }, [data, profit])

  // The strip of pipe (PR 3): today's flow and each step's pace today, never the dial's what-if.
  const flowStrip = useMemo(() => {
    if (!stageFlow || !stageInput) return null
    return buildFlowStrip(stageFlow, { market: todayPace(stageInput, 'market'), sales: todayPace(stageInput, 'sales'), build: todayPace(stageInput, 'build'), bill: todayPace(stageInput, 'bill'), collect: todayPace(stageInput, 'collect') }, { marketIsWorth: marketPaceIsWorth(stageInput) })
  }, [stageFlow, stageInput])

  // Every move for the pressed step (v2.6840), for its desk: which of them the card at the top holds.
  const deskList = useMemo(() => {
    if (!weekInput || !weekModel || !litLink) return { moves: [], foot: '' }
    const cap = narrow ? WEEK_CALL_MOVES_PHONE : WEEK_CALL_MOVES
    const moves = deskMoves(litLink, weekInput, weekModel.card.moves.slice(0, cap))
    // With nothing to take off the card, the foot only says how many it shows.
    return { moves, foot: weekModel.link === litLink ? nowDeskFoot(moves.length, cap) : '' }
  }, [weekInput, weekModel, litLink, narrow])

  // The open door. Soft numbers has none when nothing is soft, so a stale link opens nothing.
  const door = doorFromSearch(doorParam, softNumbers.length)
  const softCount = softNumbers.length
  const pressDoor = useCallback(
    (id: DoorId, opts?: { keepOpen?: boolean; scrollTo?: string }) => {
      setSearchParams((prev) => new URLSearchParams(searchAfterDoor(prev.toString(), id, doorFromSearch(prev.get('door'), softCount), opts?.keepOpen)), { replace: true })
      setDoorScroll((d) => ({ id: opts?.scrollTo ?? 'bridge-doors', n: (d?.n ?? 0) + 1 }))
    },
    [setSearchParams, softCount],
  )
  // A press on a section of the strip opens that step's desk, the window its card's Break it down opens. A step whose
  // desk cannot be read yet opens The flow, where its card says why.
  const openStageDesk = useCallback(
    (id: StageId) => {
      if (id === 'collect' && fin.data) setCollectOpen(true)
      else if (id === 'bill' && billPile) setBillOpen(true)
      else if (id === 'build' && buildInputs && weeksInputs) setBuildOpen(true)
      else if ((id === 'market' || id === 'sales') && demand) (id === 'market' ? setMarketOpen : setSalesOpen)(true)
      else pressDoor('flow', { keepOpen: true })
    },
    [fin.data, billPile, buildInputs, weeksInputs, demand, pressDoor],
  )
  useEffect(() => {
    if (!doorScroll) return
    // After the door's part is drawn, and at once: a smooth scroll was dropped when a long part (The flow) was still laying out.
    // jsdom has no scrollIntoView, so the call is optional.
    const t = window.setTimeout(() => document.getElementById(doorScroll.id)?.scrollIntoView?.({ block: 'start' }), 80)
    return () => window.clearTimeout(t)
  }, [doorScroll])

  const netPanel = useMemo(() => {
    if (!history || !data) return null
    return buildNetPanel({ history, startLabel: windowStartLabel, bankUsd: bank?.usd ?? null, typedRolledUsd: typedRolled, typedLabel: data.cashSetting ? md(data.cashSetting.asOfYmd) : null, pendingClosedHours: data.crew.pendingClosedHours, paperProfitUsd: truth?.paper.profitUsd ?? null, billingLagUsd: truth?.billingLagUsd ?? null, costGapUsd: truth?.costGapUsd ?? null })
  }, [history, data, windowStartLabel, bank, typedRolled, truth])
  const cashPanel = useMemo(() => {
    if (!forecast || !data || cashToday == null) return null
    const c = carryingDay(forecast, receipts)
    return buildCashPanel({
      cashTodayUsd: cashToday,
      bankSynced: !!bank,
      typedLabel: data.cashSetting ? md(data.cashSetting.asOfYmd) : null,
      confidence,
      bills,
      dailyDrainUsd: data.dailyDrainUsd,
      daysAhead: BRIDGE_DAYS_AHEAD,
      endUsd: forecast.endUsd,
      lowestUsd: forecast.lowest.cashUsd,
      lowestLabel: md(forecast.lowest.ymd),
      floorUsd: forecast.floorUsd,
      clearsFloor: forecast.clearsFloor,
      daysUnderFloor: forecast.daysUnderFloor,
      payrollWeeklyEstUsd: data.payrollWeeklyEstUsd,
      pendingClosedHours: data.crew.pendingClosedHours,
      unattributedNoncard: data.hygiene.unattributedNoncard,
      doubtfulUsd: doubtful.reduce((s, d) => s + d.usd, 0),
      doubtfulCount: doubtful.length,
      collectionsUsd: fin.data?.arCollections.total ?? 0,
      collectionsCount: fin.data?.arCollections.count ?? 0,
      carryLabel: c ? md(c.ymd) : null,
      carryUsd: c ? c.receiptsUsd : null,
    })
  }, [forecast, data, cashToday, bank, confidence, bills, receipts, doubtful, fin.data])

  // A hard load waits for the role before it decides (`pageGate`).
  // Punch list #188 row 69 (v2.6763): it is his chart table, so the owner opens the Bridge with a dev.
  const gate = pageGate({ loading: authLoading, user, role }, (r) => isOwnerOrDev(r))
  if (gate === 'wait') return null
  if (gate === 'away') return <Navigate to="/dashboard" replace />

  const billsByDay = groupByDay(bills)
  const receiptsByDay = groupByDay(receipts)
  // Fourteen days on the page, the rest of the eight weeks behind one press (punch list #303, cut 4).
  const listLast = data ? ymdAddDays(data.todayYmd, MONEY_LIST_DAYS) : ''
  const billsList = listWindow(billsByDay, listLast, listsAll)
  const receiptsList = listWindow(receiptsByDay, listLast, listsAll)
  const billsPress = laterPress(billsList.later, listsAll, shortK)
  const receiptsPress = laterPress(receiptsList.later, listsAll, shortK)

  return (
    <div style={{ padding: '0.25rem 0 3rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>The Bridge</h1>
        {data ? (
          <span style={det} data-testid="bridge-date">
            {new Date(`${data.todayYmd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
            {vectorWeek ? ` · pay week ${formatPayWeekLabel(vectorWeek)}` : ''}
            {/* The loaded page says the window it read, as its loading line does (punch list #334, PR 1). */}
            <span data-testid="bridge-window"> · reads the last {BRIDGE_DAYS_BACK / 7} weeks, since {windowStartLabel}</span>
          </span>
        ) : (
          <span style={det}>Where we stand, where cash is going, what would change it.</span>
        )}
        <button type="button" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading} style={{ ...btnStyle, marginLeft: 'auto', borderRadius: 6, padding: '0.25rem 0.7rem' }}>
          {loading ? 'Reading…' : 'Refresh'}
        </button>
        <BridgePunchListLink role={role} />
      </div>
      {leftOutRules && (
        <BridgeLeftOut
          rules={leftOutRules}
          isDefault={!leftOutSaved}
          developments={leftOutPickerNames(leftOutRead?.developments ?? [], hideZz)}
          customers={leftOutPickerNames(leftOutRead?.customers ?? [], hideZz)}
          jobCount={leftOutJobIds ? leftOutJobIds.size : null}
          narrow={narrow}
          onChange={(next) => void changeLeftOut(next)}
        />
      )}
      {error ? <p style={{ color: 'var(--text-red-700)' }}>{error}</p> : null}
      {!data || !profit || !speed ? (
        <p style={det}>{loading ? `Reading the last ${BRIDGE_DAYS_BACK / 7} weeks…` : '—'}</p>
      ) : (
        <>
          {/* The first screen (punch list #303, PR 1): where we stand in the tiles, and what to do now. */}
          {weekModel && weekMoney ? (
            <BridgeWeek
              model={weekModel}
              onCashNote={() => pressDoor('money', { keepOpen: true, scrollTo: 'bridge-cash-accounts' })}
              strip={flowStrip ? pipeAcross ? <BridgeFlowStrip strip={flowStrip} onOpen={openStageDesk} /> : <BridgeFlowStripDown strip={flowStrip} onOpen={openStageDesk} market={marketWorth} /> : null}
              stripSide={!pipeAcross}
              money={weekMoney}
              dives={callDives}
              todoStates={todoStatesByKey}
              dayLabel={md}
              onTodoSee={setTodoSeen}
              onDive={(target: DiveTarget) => {
                if (target.kind === 'desk') {
                  // A named customer opens the Collect window on that customer; the move's own press opens it as it is.
                  setCollectFocus(target.stage === 'collect' ? (target.payerKey ?? null) : null)
                  openStageDesk(target.stage)
                }
                // The supply bills: the list of bills coming due, behind Money.
                else if (target.kind === 'money') pressDoor('money', { keepOpen: true, scrollTo: 'bridge-bills-due' })
                // One thing as a to-do card: the app's own Add task window, written for it. The person is picked there.
                // Its link is the app's public address, so a card opens for whoever gets it, wherever it was written.
                else if (target.kind === 'todo') addTask?.openAddModal({ preset: { title: target.todo.title, links: todoLinkPaths(target.todo).map((p) => `${APP_ORIGIN}${p}`), doneWhen: target.todo.doneWhen, asksForPhoto: false, sourceTag: target.todo.key }, onSaved: () => setTodoTick((t) => t + 1) })
                // A job's percent: the app's own percent window, where the reader stands.
                else if (target.kind === 'pct') setPctFor(target.job)
                // A job's hours: who worked them and when, with the percent window one press on.
                else if (target.kind === 'hours') setHoursFor({ jobId: target.jobId, jobLabel: target.jobLabel, pctJob: target.pctJob })
                // A project's pay date: the app's own sheet for a customer's word.
                else if (target.kind === 'promise') setPromiseFor({ jobId: target.jobId, jobLabel: target.jobLabel, ymd: target.ymd, context: target.context })
              }}
              onAccrual={() => {
                setOpenCard('owed')
                pressDoor('money', { keepOpen: true, scrollTo: 'bridge-money-owed' })
              }}
            />
          ) : (
            <p style={det} data-testid="bridge-week-wait">
              Reading {WEEK_CARD_LABEL.toLowerCase()}…
            </p>
          )}

          {/* The doors (PR 2): everything else the page had, one part open at a time under the first screen. */}
          <BridgeDoors door={door} softCount={softNumbers.length} onDoor={(id) => pressDoor(id)} />

          {door && (
            <div id={BRIDGE_DOOR_PANEL_ID} data-testid={`bridge-door-panel-${door}`}>
              {door === 'flow' && (
                <>
          {/* The rule (link PR 1): one line, the longer reading behind its ? */}
          <BridgeRule />

          {/* Where the work piles up (link PR 1): the five stages, the link lit */}
          {shownFlow && (
            <BridgeStages
              flow={shownFlow}
              pickedId={litLink && isStageLink(litLink) ? litLink : null}
              onPick={setPickedStage}
              onOrder={setOrderFor}
              desks={{
                ...(fin.data ? { collect: { label: 'Break it down', onPress: () => setCollectOpen(true) } } : {}),
                ...(billPile ? { bill: { label: 'Break it down', onPress: () => setBillOpen(true) } } : {}),
                ...(buildInputs && weeksInputs ? { build: { label: 'Break it down', onPress: () => setBuildOpen(true) } } : {}),
                ...(demand ? { market: { label: 'Break it down', onPress: () => setMarketOpen(true) } } : {}),
                ...(demand ? { sales: { label: 'Break it down', onPress: () => setSalesOpen(true) } } : {}),
              }}
            />
          )}
          {dialReading && litStage && (
            <BridgeDial
              reading={dialReading}
              moved={dialMoved}
              onChange={(usd) => {
                setReflexId(null)
                setDialUsd((d) => ({ ...d, [litStage]: usd }))
              }}
              onReset={() => {
                setReflexId(null)
                setDialUsd((d) => {
                  const next = { ...d }
                  delete next[litStage]
                  return next
                })
              }}
            />
          )}


          {/* What throttles the link (link PR 6): the three resources */}
          {resources && <BridgeResources resources={resources} pickedId={litLink && !isStageLink(litLink) ? (litLink as ResourceId) : null} onPick={setPickedStage} onOrder={setOrderFor} />}

          {/* The link's desk (link PR 2): what the pressed link is and today's reading. */}
          {stageFlow && litLink && (
            <BridgeLinkDesk
              link={litLink}
              status={deskStatus({ link: litLink, linkId: stageFlow.linkId })}
              todayReading={deskReading}
              door={litLink === 'collect' && fin.data ? { label: 'Break it down', onPress: () => setCollectOpen(true) } : undefined}
              onGoToCall={() => setDoorScroll((d) => ({ id: 'bridge-week', n: (d?.n ?? 0) + 1 }))}
              moves={deskList.moves}
              movesFoot={deskList.foot}
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: '0.6rem' }}>
            {reflexes && <BridgeWaits reflexes={reflexes} activeId={reflexId} line={reflexLineNow} levers={otherLevers(litLink)} onPress={pressReflex} onReset={resetReflex} sizes={fixSizes} />}
          </div>
          {buildError && <p style={{ ...det, color: 'var(--text-amber-800)' }}>Build could not be read ({buildError}).</p>}
          {billError && <p style={{ ...det, color: 'var(--text-amber-800)' }}>The Bill pile could not be read ({billError}).</p>}
          {demandError && <p style={{ ...det, color: 'var(--text-amber-800)' }}>Market and Sales could not be read ({demandError}).</p>}

          {/* The weekly email's switch (v2.5883): Monday 6 AM Central, off as it ships. It sat on the Monday sheet until that view retired. */}
          <div style={{ marginTop: '0.6rem' }}>
            <BridgeWeeklySend />
          </div>
                </>
              )}

              {door === 'money' && (
                <>
          {/* Cash forecast */}
          {/* Cash forecast */}
          <div style={{ ...panel, marginTop: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={label}>Cash — next 8 weeks</span>
              <span style={det}>bank balance today, then every bill on the day it's due and every receipt on the day it's expected</span>
              {cashPanel && (
                <button type="button" onClick={() => setCashOpen((o) => !o)} aria-expanded={cashOpen} data-testid="bridge-cash-breakdown" style={{ ...btnStyle, fontSize: '0.75rem', padding: '0.1rem 0.5rem' }}>
                  {cashOpen ? '▴ close' : '▾ break it down'}
                </button>
              )}
              {forecast && (
                <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums', color: forecast.clearsFloor ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{cashRead}</span>
              )}
            </div>
            {forecast && cashToday != null ? <BridgeCashChart forecast={forecast} cashTodayUsd={cashToday} /> : <div style={{ ...det, padding: '1.2rem 0' }}>{bankLoading ? 'Reading the bank balance…' : 'Type cash on hand below to start the forecast.'}</div>}
            {forecast && <BridgeCashConfidence confidence={confidence} carry={carry} />}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.3rem', ...det }}>
              <span><i aria-hidden style={{ display: 'inline-block', width: 14, borderTop: '2px dashed #8b5cf6', marginRight: 5, verticalAlign: 3 }} />Cash forecast</span>
              <span><i aria-hidden style={{ display: 'inline-block', width: 14, borderTop: '2px dotted var(--text-red-600)', marginRight: 5, verticalAlign: 3 }} />Cash floor</span>
              <span style={{ color: 'var(--text-red-600)' }}>▼ bill due</span>
              <span style={{ color: 'var(--text-green-700)' }}>▲ receipt expected</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }} data-testid="bridge-cash-source">
                {bank ? (
                  <>
                    <span style={det}>
                      Cash on hand <b style={{ color: 'var(--text)' }}>{shortK(cashToday ?? bank.usd)}</b> · the bank's balance at {bankReadAt}
                    </span>
                    {data.cashSetting && typedRolled != null && Math.abs(typedRolled - bank.usd) >= 1000 && (
                      <span style={{ ...det, color: 'var(--text-amber-800)' }} data-testid="bridge-cash-typed-drift">
                        the figure typed {md(data.cashSetting.asOfYmd)} rolled through the ledger would read {shortK(typedRolled)}: {shortK(Math.abs(typedRolled - bank.usd))} of flows since are not in the app
                      </span>
                    )}
                    <button type="button" onClick={() => setRefreshKey((k) => k + 1)} disabled={bankLoading} style={btnStyle}>
                      {bankLoading ? 'Reading…' : 'Read again'}
                    </button>
                  </>
                ) : (
                  <>
                    <label htmlFor="bridge-cash" style={det}>Cash on hand today</label>
                    <input id="bridge-cash" value={cashDraft} onChange={(e) => setCashDraft(e.target.value)} placeholder="e.g. 164000" inputMode="numeric" style={inputStyle} />
                    <button type="button" onClick={() => void saveCash()} style={btnStyle}>Set</button>
                    {bankError && <span style={{ ...det, color: 'var(--text-amber-800)' }}>the bank could not be read ({bankError}) — the typed figure stands for now</span>}
                    {data.cashSetting && data.cashSetting.asOfYmd !== data.todayYmd && cashToday != null && (
                      <span style={det}>typed {md(data.cashSetting.asOfYmd)} · rolled to {shortK(cashToday)} through bank flows since</span>
                    )}
                  </>
                )}
                <label htmlFor="bridge-floor" style={{ ...det, marginLeft: '0.6rem' }}>Floor</label>
                <input id="bridge-floor" value={floorDraft} onChange={(e) => setFloorDraft(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 80 }} />
                <button type="button" onClick={() => void saveFloor()} style={btnStyle}>Set</button>
              </span>
            </div>
            {cashAccounts && <BridgeCashAccounts accounts={cashAccounts} onFlip={(id) => void flipAccount(id)} />}
            {cashOpen && cashPanel && <BridgeBreakdownPanel title="Where the window's cash comes from, and where it goes" sub="today's bank, plus every receipt the forecast expects, less every bill it schedules, is where the line ends" bars={cashPanel.waterfall} sources={cashPanel.sources} closing={cashPanel.lowest} testId="bridge-cash-panel" />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
            <div id="bridge-bills-due" style={{ ...panel, scrollMarginTop: 'calc(var(--app-top-chrome, 0px) + 3rem)' }}>
              <div style={label}>Bills coming due · next {listsAll ? '8 weeks' : `${MONEY_LIST_DAYS} days`}</div>
              <div style={{ ...det, marginTop: '0.2rem' }}>payroll ≈ {money(data.payrollWeeklyEstUsd)}/week (8-week labor average{data.crew.pendingClosedHours > 0 ? ' — reads low while hours await approval' : ''}) · sub labor owed on a {SUB_LABOR_DEFAULT_DAYS}-day horizon · other spend ≈ {money(data.dailyDrainUsd)}/day (office parts, 90-day rate)</div>
              <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                {billsList.shown.map((b) => (
                  <li key={b.ymd} style={listRow}>
                    <span>
                      {md(b.ymd)} · {b.labels.join(' + ')}
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-red-700)', fontVariantNumeric: 'tabular-nums' }}>−{money(b.usd)}</span>
                  </li>
                ))}
              </ul>
              {billsPress && (
                <button type="button" onClick={() => setListsAll((a) => !a)} aria-expanded={listsAll} data-testid="bridge-bills-later" style={{ ...btnStyle, marginTop: '0.4rem', minHeight: 36 }}>
                  {billsPress}
                </button>
              )}
              <div style={{ ...det, marginTop: '0.4rem' }}>Insurance, rent, and card bills aren't scheduled yet — they arrive as bank transfers and only show once sorted.</div>
            </div>
            <div style={panel}>
              <div style={label}>Receipts expected · next {listsAll ? '8 weeks' : `${MONEY_LIST_DAYS} days`}</div>
              <div style={{ ...det, marginTop: '0.2rem' }}>promise date → this customer's pay speed → the GC pace here, or their segment's → company pace → {DEFAULT_PAY_DAYS} days · a late invoice assumed within its own pace from today (7–45d, {LATE_RECEIPT_GRACE_DAYS}d with none) · past {DOUBTFUL_AFTER_DAYS}d late not counted</div>
              <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                {receiptsList.shown.map((r) => (
                  <li key={r.ymd} style={listRow}>
                    <span>
                      {md(r.ymd)} · {r.labels.slice(0, 2).join(', ')}
                      {r.labels.length > 2 ? ` +${r.labels.length - 2}` : ''}
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.sources.join(' · ')}</span>
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-green-700)', fontVariantNumeric: 'tabular-nums' }}>+{money(r.usd)}</span>
                  </li>
                ))}
                {doubtful.length > 0 && (
                  <li style={{ ...listRow, color: 'var(--text-muted)' }}>
                    <span>
                      {doubtful.length} invoice{doubtful.length === 1 ? '' : 's'} more than {DOUBTFUL_AFTER_DAYS}d past expected — not counted
                      <span style={{ display: 'block', fontSize: '0.72rem' }}>{doubtful.slice(0, 3).map((d) => `${d.label} (${d.daysLate}d)`).join(' · ')}{doubtful.length > 3 ? ` +${doubtful.length - 3}` : ''}</span>
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>{shortK(doubtful.reduce((acc, d) => acc + d.usd, 0))}</span>
                  </li>
                )}
                {fin.data && fin.data.arCollections.count > 0 && (
                  <li style={{ ...listRow, color: 'var(--text-muted)' }}>
                    <span>Collections ({fin.data.arCollections.count}) — not counted</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>{shortK(fin.data.arCollections.total)}</span>
                  </li>
                )}
              </ul>
              {receiptsPress && (
                <button type="button" onClick={() => setListsAll((a) => !a)} aria-expanded={listsAll} data-testid="bridge-receipts-later" style={{ ...btnStyle, marginTop: '0.4rem', minHeight: 36 }}>
                  {receiptsPress}
                </button>
              )}
            </div>
          </div>

          {/* Net position */}
          {/* Net position */}
          <div style={{ ...panel, marginTop: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={label}>Net position — last 8 weeks</span>
              <span style={det}>cash + owed to you (collections excluded) − owed by you</span>
              {(netPanel || truth) && (
                <button type="button" onClick={() => setNetOpen((o) => !o)} aria-expanded={netOpen} data-testid="bridge-net-breakdown" style={{ ...btnStyle, fontSize: '0.75rem', padding: '0.1rem 0.5rem' }}>
                  {netOpen ? '▴ close' : '▾ break it down'}
                </button>
              )}
              {netToday != null && netStart != null && (
                <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums', color: netToday - netStart >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
                  Today: {shortK(netToday)} · {netToday - netStart >= 0 ? 'up' : 'down'} {shortK(Math.abs(netToday - netStart))} since {windowStartLabel}
                </span>
              )}
            </div>
            {history ? (
              <BridgeNetPositionChart history={history} />
            ) : (
              <div style={{ ...det, padding: '1.2rem 0' }}>{!fin.data ? 'Loading money owed…' : bankLoading ? 'Reading the bank balance…' : 'Type cash on hand below to anchor this line.'}</div>
            )}
            <div style={det}>Payroll and sub-labor owed are carried flat in the history (they turn over weekly); supply invoices move it on their invoice and payment dates.</div>
            {/* The truth check (v2.3335) explains this line, so it opens with the line's breakdown (punch list #303, cut 3). */}
            {netOpen && netPanel && <BridgeBreakdownPanel title={`What moved it, ${netPanel.startLabel} to today`} sub="the three parts of net position, each by how much it changed over the window" bars={netPanel.waterfall} sources={netPanel.sources} closing={netPanel.paper} testId="bridge-net-panel" />}
            {netOpen && truth && <TruthCheckPanel truth={truth} windowStartLabel={windowStartLabel} />}
          </div>

          {/* Money owed, both ways. The accrual balance on the first screen lands here. */}
          <div id="bridge-money-owed" style={{ marginTop: '0.6rem', scrollMarginTop: 'calc(var(--app-top-chrome, 0px) + 3rem)' }}>
            <button type="button" onClick={() => setOpenCard((c) => (c === 'owed' ? null : 'owed'))} aria-expanded={openCard === 'owed'} data-testid="bridge-card-owed" style={{ ...panel, width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', border: openCard === 'owed' ? '2px solid #2563eb' : panel.border, padding: openCard === 'owed' ? 'calc(0.7rem - 1px) calc(0.9rem - 1px)' : panel.padding }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={label}>Money owed</div>
                <span style={{ marginLeft: 'auto', ...det }}>{openCard === 'owed' ? '▴ close' : '▾ chart'}</span>
              </div>
              {fin.data ? (
                <>
                  <div style={big}>
                    {shortK(fin.data.ar.total)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>owed to you</span>
                  </div>
                  <div style={det}>
                    owed by you <b style={{ color: 'var(--text)' }}>{shortK(fin.data.ap.total)}</b> · finished work not yet billed <b style={{ color: 'var(--text)' }}>{billPile ? shortK(billPile.knownUsd) : '…'}</b> · collections {shortK(fin.data.arCollections.total)} ({fin.data.arCollections.count}) written off for planning
                  </div>
                </>
              ) : (
                <div style={det}>{fin.loading ? 'Loading…' : fin.error ?? '—'}</div>
              )}
            </button>
          </div>
          {openCard === 'owed' && owedPanel && <BridgeOwedPanel panel={owedPanel} onClose={() => setOpenCard(null)} />}

          {/* The eight weeks, full size (v2.5216): contribution per week, the two constraints as lights */}
          <div style={{ marginTop: '0.6rem' }}>
          <BridgeHeadline headline={headline} cards={headlineAndCards?.cards} loading={headline == null && weeksError == null && vectorError == null} error={weeksError ?? vectorError} net={netLight} cash={cashLightRead}>
            {/* What is left after overhead (v2.6840): the chart ends at wages, so its breakdown says what every other cost leaves. */}
            {profitPanel && (
              <div style={{ marginTop: '0.6rem' }}>
                <button type="button" onClick={() => setProfitOpen((o) => !o)} aria-expanded={profitOpen} data-testid="bridge-profit-toggle" style={{ ...btnStyle, fontWeight: 600, minHeight: 36, padding: '0.25rem 0.7rem', borderRadius: 8 }}>
                  What is left after overhead {profitOpen ? '▴' : '▾'}
                </button>
                {profitOpen && <BridgeProfitPanel panel={profitPanel} />}
              </div>
            )}
          </BridgeHeadline>
          </div>

          <p style={{ ...det, marginTop: '0.8rem', maxWidth: '92ch' }}>
            <b>How it's counted</b> is in the guide <Link to="/help/the-bridge">read the Bridge</Link>. Window {data.windowStart} → {data.todayYmd}: earned {shortK(data.totals.earnedUsd)} · field labor {shortK(data.totals.fieldLaborUsd)} · materials {shortK(data.totals.materialsUsd)} · subs {shortK(data.totals.subLaborUsd)} · overhead {shortK(data.totals.overheadUsd)}.
          </p>
                </>
              )}

              {door === 'people' && (
                <>
          {/* People (v2.5222): Vectors (v2.3344) and Vectors by the day (v2.4217), open behind their door */}
          <BridgePeople
            summary={peopleSummary(vectorInputs ? vectors : null, vectorWeek ? formatPayWeekLabel(vectorWeek) : '', vectorWeek ? vectorWeek.end >= data.todayYmd : false)}
            open
          >
          {vectors && vectorWeek && (
            <BridgeVectorsPanel
              vectors={vectors}
              weekLabel={formatPayWeekLabel(vectorWeek)}
              isCurrentWeek={vectorWeek.end >= data.todayYmd}
              canPrev={ymdAddDays(vectorWeek.start, -7) >= data.windowStart}
              canNext={vectorWeek.end < data.todayYmd}
              onPrev={() => setVectorWeekStart(ymdAddDays(vectorWeek.start, -7))}
              onNext={() => setVectorWeekStart(ymdAddDays(vectorWeek.start, 7))}
              loading={vectorInputs == null && vectorError == null}
              error={vectorError}
            />
          )}

          {/* Vectors by the day (v2.4217) */}
          {daysRange && (
            <BridgeVectorDaysPanel
              grid={daysGrid}
              zoom={daysZoom}
              onZoom={(z) => {
                setDaysZoom(z)
                setDaysAnchor(null)
              }}
              mode={daysMode}
              onMode={(m) => {
                setDaysMode(m)
                writeVectorDaysMode(m)
              }}
              reading={daysReading}
              onReading={setDaysReading}
              periodLabel={vectorRangeLabel(daysZoom, daysRange)}
              isCurrent={daysRange.end >= data.todayYmd}
              canPrev={daysRange.start > monthStartOf(ymdAddDays(data.todayYmd, -730))}
              canNext={daysRange.end < data.todayYmd}
              onPrev={() => setDaysAnchor(vectorAnchorStep(daysZoom, daysZoom === 'days' ? daysRange.start : daysRange.end, -1))}
              onNext={() => setDaysAnchor(vectorAnchorStep(daysZoom, daysZoom === 'days' ? daysRange.start : daysRange.end, 1))}
              loading={daysGrid == null && daysError == null}
              error={daysError ?? vectorError}
            />
          )}
          </BridgePeople>

          {/* Crew hours, and what waits on approval */}
          <div style={{ marginTop: '0.6rem' }}>
            <button type="button" onClick={() => setOpenCard((c) => (c === 'hours' ? null : 'hours'))} aria-expanded={openCard === 'hours'} data-testid="bridge-card-hours" style={{ ...panel, width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', border: openCard === 'hours' ? '2px solid #2563eb' : panel.border, padding: openCard === 'hours' ? 'calc(0.7rem - 1px) calc(0.9rem - 1px)' : panel.padding }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={label}>Crew hours · last 7 days</div>
                <span style={{ marginLeft: 'auto', ...det }}>{openCard === 'hours' ? '▴ close' : '▾ chart'}</span>
              </div>
              <div style={big}>
                {hrs(data.crew.fieldHours7d)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>approved field</span>
              </div>
              <div style={det}>
                office + bid <b style={{ color: 'var(--text)' }}>{hrs(data.crew.officeBidHours7d)}</b> · awaiting approval <b style={{ color: data.crew.pendingClosedHours > 0 ? 'var(--text-amber-800)' : 'var(--text)' }}>{hrs(data.crew.pendingClosedHours)}</b> ({data.crew.pendingClosedSessions}) · {data.jobsWorked} jobs worked in 8 weeks
              </div>
            </button>
          </div>
          {openCard === 'hours' && hoursPanel && <BridgeHoursPanel panel={hoursPanel} onClose={() => setOpenCard(null)} />}
                </>
              )}

              {door === 'soft' && (
                <>
          <BridgeSoftNumbers rows={softNumbers} />
          {/* The percents prompt (v2.5245): the jobs with no %, set from the page */}
          {pctPrompt && <BridgePctPrompt prompt={pctPrompt} onSaved={savePct} />}
                </>
              )}
            </div>
          )}

          {/* The desks open over the page from the stage cards and the link's desk. */}
          {/* A blue check's window, and from it the app's own task window. The checks are read again when a card is saved or closed. */}
          <BridgeTodoOpen seen={todoSeen} onSeenClose={() => setTodoSeen(null)} todayYmd={data.todayYmd} dayLabel={md} readLines={readTodoLines} role={role} setError={setError} onChanged={() => setTodoTick((t) => t + 1)} />
          {hoursFor && (
            <BridgeJobHoursWindow
              jobLabel={hoursFor.jobLabel}
              hours={jobHours?.get(hoursFor.jobId) ?? NO_JOB_HOURS}
              dayLabel={md}
              jobHref={`/jobs?tab=stages&edit=${hoursFor.jobId}`}
              onClose={() => setHoursFor(null)}
              onSetPct={
                hoursFor.pctJob
                  ? () => {
                      const job = hoursFor.pctJob
                      setHoursFor(null)
                      if (job) setPctFor(job)
                    }
                  : undefined
              }
            />
          )}
          {/* From the card What to do now: the app's own percent window and its sheet for a customer's word. */}
          {pctFor && <BridgePctRun job={pctFor} run={(callDives?.noPctJobs ?? []).flatMap((j) => (j.pctJob ? [j.pctJob] : []))} facts={pctFacts.facts} factsError={pctFacts.error} todayYmd={data.todayYmd} dayLabel={md} jobHref={jobPage} onMove={setPctFor} onSaved={savePct} onClose={() => setPctFor(null)} />}
          {promiseFor && (
            <SetPromisedPayDateModal
              jobId={promiseFor.jobId}
              jobLabel={promiseFor.jobLabel}
              initialYmd={promiseFor.ymd}
              contextLine={promiseFor.context}
              onClose={() => setPromiseFor(null)}
              onSaved={() => {
                // The same refresh the Collect window's After the call makes: the promises are read again.
                setCollectReads(null)
                setRefreshKey((k) => k + 1)
              }}
            />
          )}
          {collectOpen && data && (
            collectDesk ? (
              <BridgeCollectDesk
                pile={collectDesk.pile}
                cut={collectDesk.cut}
                pace={{ paidPerWeekUsd: stageInput?.collect?.outPerWeekUsd ?? 0, billedPerWeekUsd: stageInput?.collect?.inPerWeekUsd ?? 0 }}
                weeks={stageFlow?.stages.find((s) => s.id === 'collect')?.weeks ?? null}
                segments={{ commercial: data.paySpeeds?.segments.commercial?.medianDays ?? null, residential: data.paySpeeds?.segments.residential?.medianDays ?? null, company: data.paySpeeds?.company?.medianDays ?? null }}
                todayYmd={data.todayYmd}
                readStamp={`${new Date(`${data.todayYmd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}, ${md(data.todayYmd)} · pay week ${formatPayWeekLabel(payWeekContaining(data.todayYmd))}`}
                dayLabel={md}
                chipsByJob={collectChips.chipsByJob}
                arDoor={OWED_DOORS.billing}
                focusPayerKey={collectFocus}
                onClose={() => {
                  setCollectOpen(false)
                  setCollectFocus(null)
                }}
                sheet={collectPlan?.sheet ?? null}
                decisions={collectPlan?.decisions ?? null}
                whatIf={collectPlan?.whatIf ?? null}
                customerHref={(id) => `/customers/${id}`}
                outcomeWriter={collectOutcomeWriter}
                onOutcomeRecorded={() => {
                  setCollectReads(null)
                  setRefreshKey((k) => k + 1)
                }}
              />
            ) : (
              <div onClick={() => setCollectOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + var(--app-top-chrome, 0px)) 16px 16px' }} data-testid="bridge-collect-desk-loading">
                <div role="dialog" aria-modal="true" aria-label="Collect, broken down" style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 12, padding: '1rem 1.4rem', border: '1px solid var(--border)' }}>Reading the pile…</div>
              </div>
            )
          )}
          {billOpen && data && billDesk && (
            <BridgeBillDesk
              facts={billDesk.facts}
              desk={billDesk.desk}
              error={billReadsError}
              isLink={stageFlow?.linkId === 'bill'}
              readStamp={`${new Date(`${data.todayYmd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}, ${md(data.todayYmd)} · pay week ${formatPayWeekLabel(payWeekContaining(data.todayYmd))}`}
              onClose={() => setBillOpen(false)}
            />
          )}
          {buildOpen && data && buildDesk && (
            <BridgeBuildDesk
              desk={buildDesk}
              readsPending={!buildReads || buildReads.forKey !== buildReadKey}
              readError={buildReadError}
              isLink={stageFlow?.linkId === 'build'}
              readStamp={`${new Date(`${data.todayYmd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}, ${md(data.todayYmd)} · pay week ${formatPayWeekLabel(payWeekContaining(data.todayYmd))}`}
              onClose={() => setBuildOpen(false)}
              onSavePct={savePct}
            />
          )}
          {marketOpen && data && marketHeaderNow && (
            <BridgeMarketDesk
              header={marketHeaderNow}
              desk={marketDesk}
              error={marketError}
              isLink={stageFlow?.linkId === 'market'}
              fieldPerWeekUsd={stageInput?.fieldPerWeekUsd ?? null}
              worth={marketWorth}
              bidWins={bidWins}
              estimateWins={estimateWins}
              bids={bidsSent}
              estimates={estimatesSent}
              todayYmd={data.todayYmd}
              readStamp={`${new Date(`${data.todayYmd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}, ${md(data.todayYmd)} · pay week ${formatPayWeekLabel(payWeekContaining(data.todayYmd))}`}
              onClose={() => setMarketOpen(false)}
            />
          )}
          {salesOpen && data && (
            <BridgeSalesDesk
              desk={salesDesk}
              error={salesError}
              card={{ awaitingUsd: (demand?.sales.awaiting.bidsUsd ?? 0) + (demand?.sales.awaiting.estimatesUsd ?? 0), bids: demand?.sales.awaiting.bids ?? 0, bidsUsd: demand?.sales.awaiting.bidsUsd ?? 0, estimates: demand?.sales.awaiting.estimates ?? 0, estimatesUsd: demand?.sales.awaiting.estimatesUsd ?? 0 }}
              paces={{ soldPerWeekUsd: stageInput?.sales?.soldPerWeekUsd ?? null, fieldPerWeekUsd: stageInput?.fieldPerWeekUsd ?? null }}
              isLink={stageFlow?.linkId === 'sales'}
              worth={marketWorth}
              bidWins={bidWins}
              estimateWins={estimateWins}
              readStamp={`${new Date(`${data.todayYmd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}, ${md(data.todayYmd)} · pay week ${formatPayWeekLabel(payWeekContaining(data.todayYmd))}`}
              onClose={() => setSalesOpen(false)}
            />
          )}
          {order && <BridgeOrderModal order={order} note={dialMoved && dialReading ? `at the dial’s pace, ${dialReading.valueText}` : 'at today’s pace'} onClose={closeOrder} />}
        </>
      )}
    </div>
  )
}

function groupByDay<T extends { ymd: string; usd: number; label: string; source?: string }>(rows: ReadonlyArray<T>): Array<{ ymd: string; usd: number; labels: string[]; sources: string[] }> {
  const m = new Map<string, { ymd: string; usd: number; labels: string[]; sources: string[] }>()
  for (const r of rows) {
    const cur = m.get(r.ymd) ?? { ymd: r.ymd, usd: 0, labels: [], sources: [] }
    cur.usd += r.usd
    if (!cur.labels.includes(r.label)) cur.labels.push(r.label)
    if (r.source && !cur.sources.includes(r.source)) cur.sources.push(r.source)
    m.set(r.ymd, cur)
  }
  return [...m.values()].sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0))
}

/**
 * Truth check (v2.3335): paper profit and the net position change over the
 * same days, the gap split exactly into billing lag + costs the paper doesn't
 * see, and the signals that say where the cost side is dirty.
 */
function TruthCheckPanel({ truth, windowStartLabel }: { truth: TruthCheck; windowStartLabel: string }) {
  const verdictColor =
    truth.verdict === 'agree' ? 'var(--text-green-700)' : truth.verdict === 'billing_lag' ? 'var(--text-amber-800)' : truth.verdict === 'costs_disagree' ? 'var(--text-red-700)' : 'var(--text-muted)'
  const signed = (n: number): string => `${n < 0 ? '−' : '+'}${shortK(Math.abs(n))}`
  const cell: CSSProperties = { flex: '1 1 160px', minWidth: 0 }
  return (
    <div style={{ ...panel, marginTop: '0.6rem' }} data-testid="bridge-truth-check">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={label}>Truth check — same {Math.round(truth.days / 7)} weeks</span>
        <span style={det}>does the paper agree with the bank since {windowStartLabel}?</span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.85rem', color: verdictColor }}>{truthCheckVerdictText(truth)}</span>
      </div>
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
        <div style={cell}>
          <div style={det}>Profit on paper</div>
          <div style={{ ...big, fontSize: '1.2rem' }}>{signed(truth.paper.profitUsd)}</div>
          <div style={det}>
            earned {shortK(truth.paper.earnedUsd)} − jobs {shortK(truth.paper.directUsd)} − overhead {shortK(truth.paper.overheadUsd)}
          </div>
        </div>
        <div style={cell}>
          <div style={det}>Net position moved</div>
          <div style={{ ...big, fontSize: '1.2rem' }}>{signed(truth.net.deltaUsd)}</div>
          <div style={det}>
            invoiced {shortK(truth.net.invoicesSentUsd)} − what the bank and supply ledger charged {shortK(truth.net.costsUsd)}
          </div>
        </div>
        <div style={{ ...cell, flex: '2 1 280px' }}>
          <div style={det}>The {shortK(Math.abs(truth.gapUsd))} between them, exactly</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.15rem' }}>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{signed(truth.billingLagUsd)}</b> earned but not invoiced
            <span style={det}> — real on paper, invisible to the bank until it's billed</span>
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            <b style={{ fontVariantNumeric: 'tabular-nums', color: truth.verdict === 'costs_disagree' ? 'var(--text-red-700)' : 'var(--text)' }}>{signed(truth.costGapUsd)}</b> costs the paper doesn't see
            {truth.costGapShare != null && <span style={det}> — {Math.round(truth.costGapShare * 100)}% of paper costs; under 15% counts as agreement</span>}
          </div>
        </div>
      </div>
      <div style={{ ...det, marginTop: '0.4rem' }}>
        Net side = invoices sent − (payments received − bank net flow + supply invoices dated − supply invoices paid), the flows the line above walks. Money in that isn't a customer payment (a loan, an owner deposit) reads here as a negative cost; payroll and sub labor count when the bank pays them, not when the hours are worked.
      </div>
    </div>
  )
}
