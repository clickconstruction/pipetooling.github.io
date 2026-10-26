import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDashboardFinancials } from '../hooks/useDashboardFinancials'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { BRIDGE_DAYS_AHEAD, BRIDGE_DAYS_BACK, loadBridgeData, saveBridgeCashOnHand, saveBridgeFloor, type BridgeData } from '../lib/bridge/loadBridgeData'
import { buildCourseModel } from '../lib/bridge/courseModel'
import { buildNetPositionHistory, cashTodayFromAsOf } from '../lib/bridge/netPosition'
import { DOUBTFUL_AFTER_DAYS, LATE_RECEIPT_GRACE_DAYS, buildCashForecast, scheduleReceipt, type CashEvent } from '../lib/bridge/cashForecast'
import { billedExpectedPayModel } from '../lib/jobs/billedExpectedPay'
import { buildTruthCheck, truthCheckVerdictText, type TruthCheck } from '../lib/bridge/truthCheck'
import { BridgeCashChart, BridgeNetPositionChart } from '../components/bridge/BridgeCashCharts'
import { BridgeVectorsPanel } from '../components/bridge/BridgeVectorsPanel'
import { loadBridgeVectorInputs, type BridgeVectorInputs } from '../lib/bridge/loadBridgeVectors'
import { buildVectors } from '../lib/bridge/vectors'
import { BridgeVectorDaysPanel } from '../components/bridge/BridgeVectorDaysPanel'
import type { VectorReading } from '../lib/bridge/vectorReading'
import { BridgeHeadline } from '../components/bridge/BridgeHeadline'
import { buildHeadline, cashLight, netPositionLight } from '../lib/bridge/headline'
import { loadMercuryCash, mercuryAccountsLine, type MercuryCash } from '../lib/bridge/mercuryCash'
import { carryingDay, carryingSentence, lateWithinDays, receiptsConfidence, type ReceiptBasis } from '../lib/bridge/cashConfidence'
import { BridgeCashConfidence } from '../components/bridge/BridgeCashConfidence'
import { buildReadingGaps } from '../lib/bridge/readingGaps'
import { BridgeReadingGaps } from '../components/bridge/BridgeReadingGaps'
import { buildThisWeek } from '../lib/bridge/thisWeek'
import { BridgeThisWeek } from '../components/bridge/BridgeThisWeek'
import { peopleSummary, readPeopleOpen, writePeopleOpen } from '../lib/bridge/peopleStrip'
import { BridgePeople } from '../components/bridge/BridgePeople'
import { buildMondaySheet, mondaySheetHtml, mondaySheetSubject, mondaySheetText, peopleLines } from '../lib/bridge/mondaySheet'
import { BridgeMondaySheet } from '../components/bridge/BridgeMondaySheet'
import { loadVectorDaysInputs, type VectorDaysInputs } from '../lib/bridge/loadVectorDays'
import { buildVectorGrid, monthStartOf, vectorAnchorStep, vectorRangeFor, vectorRangeLabel, type VectorTimeMode, type VectorZoom } from '../lib/bridge/vectorDays'
import { readVectorDaysMode, writeVectorDaysMode } from '../lib/bridge/vectorDaysModeStorage'
import { formatPayWeekLabel, payWeekContaining } from '../lib/payWeekAnchor'
import { ymdAddDays } from '../utils/dateUtils'
import { buildStageFlow, withFieldPaces, type StageId } from '../lib/bridge/stageFlow'
import { BridgeStages } from '../components/bridge/BridgeStages'
import { BridgePctPrompt } from '../components/bridge/BridgePctPrompt'
import { buildPctPrompt, withPctSet } from '../lib/bridge/pctPrompt'
import { BridgeRule } from '../components/bridge/BridgeRule'
import { answerBridgeCall, buildScorecard, callChip, callForWeek, deskStatus, isStageLink, loadBridgeCalls, recordBridgeCall, scoreCall, type BridgeCall, type CallLink, type CallMove, type CallOutcome } from '../lib/bridge/calls'
import { BridgeLinkDesk } from '../components/bridge/BridgeLinkDesk'
import { BridgeCollectDesk } from '../components/bridge/BridgeCollectDesk'
import { buildCollectPile } from '../lib/bridge/collect/collectPile'
import { buildCollectPayers } from '../lib/bridge/collect/collectPayers'
import { arRowInvoiceId, collectBillsFromAr } from '../lib/bridge/collect/collectBills'
import { loadCollectDeskReads, type CollectDeskReads } from '../lib/bridge/collect/loadCollectDesk'
import { useArLienChips } from '../hooks/useArLienChips'
import { OWED_DOORS } from '../lib/bridge/owedPanel'
import { buildCollectSheet, collectMoveFor } from '../lib/bridge/collect/collectMoves'
import { collectDecisions } from '../lib/bridge/collect/collectDecisions'
import { collectWhatIf } from '../lib/bridge/collect/collectWhatIf'
import { lienArChipHref } from '../lib/jobs/lienArChip'
import { collectReceiptFor } from '../lib/bridge/collect/collectReceipt'
import { collectScorecard } from '../lib/bridge/collect/collectScorecard'
import { loadCollectScorecardReads, type CollectScorecardReads } from '../lib/bridge/collect/loadCollectScorecard'
import { addPaymentChaseTouch, recordPromiseForJobs } from '../lib/jobs/paymentChaseIo'
import type { CollectOutcomeWriter } from '../components/bridge/BridgeCollectOutcome'
import { BridgeLastCall } from '../components/bridge/BridgeLastCall'
import { buildBuildPace, type BuildPaceInput } from '../lib/bridge/buildPace'
import { fieldPaceByHours } from '../lib/bridge/fieldPace'
import { loadBuildPaceInputs } from '../lib/bridge/loadBuildPace'
import { billStageInput, buildBillPile, type BillPileJob } from '../lib/bridge/billPile'
import { loadBillPileJobs } from '../lib/bridge/loadBillPile'
import { useZzTestJobsHidden } from '../lib/jobs/zzTestJobSwitch'
import { buildDemand, type DemandInput } from '../lib/bridge/demandPace'
import { loadDemandInputs } from '../lib/bridge/loadDemandPace'
import { buildDialReading, dialSpec } from '../lib/bridge/dial'
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
import { buildProfitPanel } from '../lib/bridge/profitPanel'
import { BridgeProfitPanel } from '../components/bridge/BridgeProfitPanel'
import { buildOwedPanel } from '../lib/bridge/owedPanel'
import { BridgeOwedPanel } from '../components/bridge/BridgeOwedPanel'
import { buildHoursPanel } from '../lib/bridge/hoursPanel'
import { BridgeHoursPanel } from '../components/bridge/BridgeHoursPanel'
import { buildCashPanel, buildNetPanel } from '../lib/bridge/netCashPanels'
import { BridgeBreakdownPanel } from '../components/bridge/BridgeBreakdownPanel'
import { STAGE_META, STAGE_RULE_LINE } from '../lib/bridge/stageFlow'
import { pageGate } from '../lib/roleGate'

/**
 * The Bridge (v2.2726 — the plain version). Dev only. Where we stand (net
 * position), where cash is going (forecast by date), what would change it.
 * Cash on hand is typed on this page and rolled forward through the bank
 * flows since; the floor is set here too. No ship words on the instruments.
 */

const money = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`
const md = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const DEFAULT_PAY_DAYS = 45
const SUB_LABOR_DEFAULT_DAYS = 14

const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }
const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const big: CSSProperties = { fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, margin: '0.1rem 0' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const inputStyle: CSSProperties = { width: 110, font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.4rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)' }
const btnStyle: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }
const listRow: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }

export default function Bridge() {
  const { user, role, profileName, loading: authLoading } = useAuth()
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
  const [bankError, setBankError] = useState<string | null>(null)
  const [bankLoading, setBankLoading] = useState(false)
  // The People strip (v2.5222): Vectors and the day grid fold under it, closed by default and remembered per browser.
  const [peopleOpen, setPeopleOpen] = useState<boolean>(() => readPeopleOpen())
  // The Monday sheet (v2.5224): `?view=monday` draws the one-screen sheet; Email me this sheet mails it to the caller.
  const [searchParams, setSearchParams] = useSearchParams()
  const sheetView = searchParams.get('view') === 'monday'
  const [emailing, setEmailing] = useState(false)
  const [mailNote, setMailNote] = useState<string | null>(null)
  // The weakest link (link PR 1): the stage pressed; the lit link until someone presses another.
  const [pickedStage, setPickedStage] = useState<CallLink | null>(null)
  // The order (link PR 6): the badge pressed, if any; null closes the modal.
  const [orderFor, setOrderFor] = useState<CallLink | null>(null)
  // Everything else waits (link PR 7): the usual fix pressed, if any; it sets the dial, and dragging the dial clears it.
  const [reflexId, setReflexId] = useState<ReflexId | null>(null)
  // The card panels (link PR 9): which of the three cards is open under the row, if any.
  const [openCard, setOpenCard] = useState<'profit' | 'owed' | 'hours' | null>(null)
  // The breakdowns behind the two charts (link PR 11).
  const [netOpen, setNetOpen] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  // The calls (link PR 2): the week's call holds the link; Friday asks whether it moved.
  const [calls, setCalls] = useState<BridgeCall[] | null>(null)
  const [callsError, setCallsError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [answering, setAnswering] = useState(false)
  const fin = useDashboardFinancials(role === 'dev', refreshKey, role, user?.id ?? null)
  /** ZZ test jobs leave the Bill pile for everyone but a dev who shows them, as on the Dashboard (v2.5834). */
  const hideZz = useZzTestJobsHidden(role)

  useEffect(() => {
    if (role !== 'dev' || !user?.id) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await loadBridgeCalls()
        if (!cancelled) setCalls(rows)
      } catch (e) {
        if (!cancelled) {
          setCalls([])
          setCallsError(formatErrorMessage(e))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, user?.id, refreshKey])

  useEffect(() => {
    if (role !== 'dev' || !user?.id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const d = await loadBridgeData()
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
  }, [role, user?.id, refreshKey])

  useEffect(() => {
    if (role !== 'dev' || !user?.id) return
    let cancelled = false
    setBankLoading(true)
    setBankError(null)
    void (async () => {
      try {
        const b = await loadMercuryCash()
        if (!cancelled) setBank(b)
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
  const cashToday = useMemo(() => (bank ? bank.usd : typedRolled), [bank, typedRolled])

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
        const reads = await loadCollectDeskReads({ jobIds: items.map((i) => i.jobId).filter((id): id is string => !!id), invoiceIds: items.map((i) => arRowInvoiceId(i.key)).filter((id): id is string => !!id), canReadTouches: role === 'dev' })
        if (!cancelled) setCollectReads({ forKey: key, reads })
      } catch {
        if (!cancelled) setCollectReads({ forKey: key, reads: { payAppJobIds: new Set(), gcPayerIds: new Set(), sentByInvoice: new Map(), touches: null } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fin.data, data, role, collectReads, collectReadKey])
  const collectDesk = useMemo(() => {
    if (!fin.data || !data || !collectReads || collectReads.forKey !== collectReadKey) return null
    const r = collectReads.reads
    const bills = collectBillsFromAr({ ar: fin.data.ar.items, collections: fin.data.arCollections.items, sentByInvoice: r.sentByInvoice })
    // The GC pace here rests on the GC payers in the pile, the ones we are collecting from now, not on every small GC on record.
    const gcPaceFromIds = new Set(bills.map((b) => b.payerId).filter((id): id is string => !!id && r.gcPayerIds.has(id)))
    const pile = buildCollectPile({ bills, paySpeeds: data.paySpeeds, promisesByJob: data.promisedByJob, payAppJobIds: r.payAppJobIds, gcPayerIds: r.gcPayerIds, gcPaceFromIds, todayYmd: data.todayYmd })
    return { pile, cut: buildCollectPayers(pile, { touches: r.touches }) }
  }, [fin.data, data, collectReads, collectReadKey])
  const collectJobIds = useMemo(() => (collectDesk ? [...new Set(collectDesk.cut.cut.flatMap((p) => p.bills.map((b) => b.jobId)).filter((id): id is string => !!id))] : []), [collectDesk])
  const collectChips = useArLienChips(collectOpen && collectJobIds.length > 0, collectJobIds, data?.todayYmd ?? '', role, hideZz)
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
  // Receipts: each open AR item on its expected day — promise → customer median → company median → 45 days.
  // Recently late lands within its own pace from today (v2.5219: 7–45 days, 14 with no pace), so late invoices spread instead of piling on one day;
  // late past the doubtful line is not counted (listed with collections).
  const { receipts, doubtful } = useMemo<{ receipts: Array<CashEvent & { source: string; basis: ReceiptBasis }>; doubtful: Array<{ label: string; usd: number; daysLate: number }> }>(() => {
    if (!data || !fin.data) return { receipts: [], doubtful: [] }
    const out: Array<CashEvent & { source: string; basis: ReceiptBasis }> = []
    const doubtful: Array<{ label: string; usd: number; daysLate: number }> = []
    // v2.5857: once the Collect desk's pile is read, each bill's expected day is the pile's: the payer's own pace, the GC pace here, the segment's or the company's.
    const pileByKey = collectDesk ? new Map(collectDesk.pile.bills.map((b) => [b.key, b])) : null
    for (const item of fin.data.ar.items) {
      if (item.amount <= 0) continue
      const promise = item.jobId && data.promisedByJob ? data.promisedByJob[item.jobId] : undefined
      const pileBill = pileByKey?.get(item.key)
      const pileRead = pileBill ? collectReceiptFor(pileBill) : null
      // item.dateYmd is already a day: read as an instant it would be midnight UTC, the evening before.
      const model = pileRead ? null : billedExpectedPayModel({ billedAtIso: null, estBillYmd: item.dateYmd, customerId: item.customerId ?? null }, data.paySpeeds, data.todayYmd, promise ?? null)
      let expectedYmd: string
      let source: string
      let basis: ReceiptBasis
      if (pileRead) {
        expectedYmd = pileRead.expectedYmd
        source = pileRead.source
        basis = pileRead.basis
      } else if (model) {
        expectedYmd = model.expectedYmd
        source = model.source === 'promised' ? 'promised' : model.source === 'customer' ? `pays in ~${model.medianDays}d` : `company pace ~${model.medianDays}d`
        basis = model.source
      } else {
        const base = item.dateYmd ?? data.todayYmd
        expectedYmd = new Date(Date.parse(`${base}T00:00:00Z`) + DEFAULT_PAY_DAYS * 86_400_000).toISOString().slice(0, 10)
        source = `no history · ${DEFAULT_PAY_DAYS}d default`
        basis = 'default'
      }
      const pace = pileRead ? pileRead.paceDays : model && model.source !== 'promised' ? model.medianDays : null
      const graceDays = lateWithinDays(pace)
      const sched = scheduleReceipt(expectedYmd, data.todayYmd, { graceDays })
      if (sched.status === 'doubtful') {
        doubtful.push({ label: item.label, usd: item.amount, daysLate: sched.daysLate })
        continue
      }
      out.push({
        ymd: sched.ymd,
        usd: item.amount,
        label: item.label,
        kind: 'receipt',
        source: sched.status === 'late' ? `${sched.daysLate}d late — assumed within ${graceDays}d${pace != null ? ' by their pace' : ''}` : source,
        basis: sched.status === 'late' ? 'late' : basis,
      })
    }
    return { receipts: out.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0)), doubtful }
  }, [data, fin.data, collectDesk])

  // Bills: supply due dates + payroll Fridays from the loader, plus sub labor owed
  // (the finance hook's AP figure — the same number the Dashboard shows) on the
  // default payable-after horizon.
  const bills = useMemo(() => {
    if (!data) return []
    const out = [...data.bills]
    const sub = fin.data?.ap.subLaborTotal ?? 0
    if (sub > 0) out.push({ ymd: new Date(Date.parse(`${data.todayYmd}T00:00:00Z`) + SUB_LABOR_DEFAULT_DAYS * 86_400_000).toISOString().slice(0, 10), usd: sub, label: 'Sub labor owed' })
    return out.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0))
  }, [data, fin.data])

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
        const v = await loadBuildPaceInputs({ windowStart: data.windowStart, todayYmd: data.todayYmd, officeJobLedgerId: data.officeJobLedgerId })
        if (!cancelled) setBuildInputs(v)
      } catch (e) {
        if (!cancelled) setBuildError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data])
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
        const v = await loadBillPileJobs({ officeJobLedgerId: data.officeJobLedgerId, hideZzTestJobs: hideZz, viewerUserId: user?.id ?? null })
        if (!cancelled) setBillJobs(v)
      } catch (e) {
        if (!cancelled) setBillError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, hideZz, user?.id])
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
        const v = await loadDemandInputs({ windowStart: data.windowStart, todayYmd: data.todayYmd })
        if (!cancelled) setDemandInputs(v)
      } catch (e) {
        if (!cancelled) setDemandError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data])
  const demand = useMemo(() => (demandInputs ? buildDemand(demandInputs) : null), [demandInputs])

  // The calls (link PR 2): the pay week today falls in, and the call that stands for it.
  const thisWeekStart = data ? payWeekContaining(data.todayYmd).start : null
  const thisWeekCall = useMemo(() => (calls && thisWeekStart ? callForWeek(calls, thisWeekStart) : null), [calls, thisWeekStart])

  // The top line's weeks (the eight-week grid on recorded and approved time), read here because the stage cards take the field's pace from it.
  const weeksRange = useMemo(() => (data ? vectorRangeFor('weeks', data.todayYmd) : null), [data])
  useEffect(() => {
    if (!data || !weeksRange) return
    const key = `${weeksRange.start}:${weeksRange.end}`
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
        const v = await loadVectorDaysInputs({ start: weeksRange.start, end: weeksRange.end, todayYmd: data.todayYmd, officeJobLedgerId: data.officeJobLedgerId })
        daysCacheRef.current.set(key, v)
        if (!cancelled) setWeeksInputs(v)
      } catch (e) {
        if (!cancelled) setWeeksError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, weeksRange])
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
    const held = thisWeekCall && isStageLink(thisWeekCall.link) ? thisWeekCall.link : null
    // Build's pace is the larger of built-by-percent and earned-by-hours; Bill's in-rate is what the field earned on recorded time.
    const build = buildPace ? withFieldPaces(buildPace.stageInput, fieldPace?.earnedPerWeekUsd ?? null) : null
    const finishedPerWeek = fieldPace?.earnedPerWeekUsd ?? data.totals.earnedUsd / weeks
    return {
      market: demand?.market ?? null,
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
      heldLinkId: held,
    }
  }, [data, fin.data, receipts, doubtful, thisWeekCall, buildPace, demand, fieldPace, billPile, collectDesk])
  const stageFlow = useMemo(() => (stageInput ? buildStageFlow(stageInput) : null), [stageInput])
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
    const m = demand?.market
    return m && m.bidsInvited + m.estimatesRequested > 0 ? (m.bidsInvitedUsd + m.estimatesRequestedUsd) / (m.bidsInvited + m.estimatesRequested) : null
  }, [litStage, data, billPile, fin.data, stageInput, fieldPace, buildPace, demand])
  const dialSpecNow = useMemo(() => (stageInput && litStage ? dialSpec(stageInput, litStage, { perUnitUsd }) : null), [stageInput, litStage, perUnitUsd])
  const dialReading = useMemo(() => {
    if (!dialSpecNow || !stageInput || !litStage || !data) return null
    const usd = dialUsd[litStage] ?? dialSpecNow.todayUsd
    return buildDialReading(stageInput, litStage, usd, { spec: dialSpecNow, todayYmd: data.todayYmd, dayLabel: md, fieldHoursPerWeek: data.crew.fieldHoursWindow / (BRIDGE_DAYS_BACK / 7) })
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

  // The calls (link PR 2): today's numbers behind the moves, the snapshot a call keeps, the scorecard and the header chip.
  const moveNumbers = useMemo(
    () => ({
      bill: billPile ? billPile.knownUsd : null,
      chase: receipts.filter((r) => r.basis === 'late').reduce((s, r) => s + r.usd, 0) + doubtful.reduce((s, d) => s + d.usd, 0),
      approve: data ? data.crew.pendingClosedHours : null,
      price: data ? data.earned.noRevenueJobs.length : null,
      pct: data ? data.earned.assumedHalfJobs.length : null,
    }),
    [billPile, receipts, doubtful, data],
  )
  const nowReading = useMemo(
    () => ({
      stageWeeks: Object.fromEntries((stageFlow?.stages ?? []).map((s) => [s.id, s.weeks])) as Partial<Record<StageId, number | null>>,
      stagePilesUsd: Object.fromEntries((stageFlow?.stages ?? []).map((s) => [s.id, s.pile.usd])) as Partial<Record<StageId, number | null>>,
      keys: moveNumbers,
    }),
    [stageFlow, moveNumbers],
  )
  const scorecard = useMemo(() => {
    if (!data || !calls || !thisWeekStart) return null
    const c = scoreCall(calls, thisWeekStart)
    return c ? buildScorecard({ call: c, calls, now: nowReading, todayYmd: data.todayYmd, dayLabel: md }) : null
  }, [data, calls, thisWeekStart, nowReading])
  const chip = callChip(scorecard)
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
  // PR G (v2.5858): Friday's reads, once a plan is recorded on Collect: the payments since the plan and the lien papers that moved.
  const [collectScoreReads, setCollectScoreReads] = useState<{ forKey: string; reads: CollectScorecardReads } | null>(null)
  const collectScoreKey = thisWeekCall?.link === 'collect' && collectDesk ? `${thisWeekCall.id}:${thisWeekCall.calledOn}:${refreshKey}:${collectJobIds.join(',')}` : ''
  useEffect(() => {
    if (!collectScoreKey || !thisWeekCall) return
    if (collectScoreReads && collectScoreReads.forKey === collectScoreKey) return
    let cancelled = false
    const key = collectScoreKey
    void (async () => {
      try {
        const reads = await loadCollectScorecardReads({ sinceYmd: thisWeekCall.calledOn, jobIds: collectJobIds })
        if (!cancelled) setCollectScoreReads({ forKey: key, reads })
      } catch {
        if (!cancelled) setCollectScoreReads({ forKey: key, reads: { payments: [], notices: { drafted: 0, signed: 0, mailed: 0, affidavitsFiled: 0 } } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [collectScoreKey, thisWeekCall, collectScoreReads, collectJobIds])
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
    const recordedMoves = thisWeekCall?.link === 'collect' ? thisWeekCall.moves : null
    const sheet = buildCollectSheet(collectDesk.cut, (p) => collectMoveFor(p, { chip: chipFor(p), todayYmd: data.todayYmd, dayLabel: md, lienHref: lienArChipHref, recordedMoves: recordedMoves ? recordedMoves.map((m) => ({ ...m, title: m.title.replace(`${p.payerName}: `, '') })) : null }))
    const decisions = collectDecisions(collectDesk.cut, { chipFor, lienHref: lienArChipHref, customerHref: (id) => `/customers/${id}`, jobsHref: '/jobs?tab=stages', dayLabel: md })
    const collect = stageInput?.collect
    const whatIf = collect ? collectWhatIf({ headlineUsd: collectDesk.pile.headlineUsd, askUsd: sheet.askUsd, paidPerWeekUsd: collect.outPerWeekUsd, billedPerWeekUsd: collect.inPerWeekUsd, windowWeeks: BRIDGE_DAYS_BACK / 7, buildWeeks: stageFlow?.stages.find((s) => s.id === 'build')?.weeks ?? null }) : null
    const scorecard = thisWeekCall?.link === 'collect' && collectScoreReads && collectScoreReads.forKey === collectScoreKey && collectReads ? collectScorecard({ call: thisWeekCall, sheet, touches: collectReads.reads.touches, payments: collectScoreReads.reads.payments, notices: collectScoreReads.reads.notices, todayYmd: data.todayYmd }) : null
    return { sheet, decisions, whatIf, scorecard }
  }, [collectDesk, data, collectChips.chipsByJob, thisWeekCall, stageInput, stageFlow, collectScoreReads, collectScoreKey, collectReads])

  const recordCall = useCallback(
    async (moves: CallMove[], note: string | null) => {
      if (!data || !thisWeekStart || !litLink || !stageFlow) return
      setRecording(true)
      try {
        await recordBridgeCall({
          weekStart: thisWeekStart,
          calledOn: data.todayYmd,
          calledByName: profileName ?? '',
          link: litLink,
          moves,
          measures: { linkWeeks: stageFlow.stages.find((s) => s.id === litLink)?.weeks ?? null, linkPileUsd: stageFlow.stages.find((s) => s.id === litLink)?.pile.usd ?? null, stageWeeks: nowReading.stageWeeks, keys: moveNumbers },
          note,
        })
        setCalls(await loadBridgeCalls())
        showToast(`Recorded: ${litLink} is the link this week`, 'success', 2500)
      } catch (e) {
        showToast(formatErrorMessage(e), 'error', 4000)
      } finally {
        setRecording(false)
      }
    },
    [data, thisWeekStart, litLink, stageFlow, nowReading, moveNumbers, profileName, showToast],
  )
  const answerCall = useCallback(
    async (outcome: CallOutcome, note: string | null) => {
      if (!calls || !thisWeekStart) return
      const c = scoreCall(calls, thisWeekStart)
      if (!c) return
      setAnswering(true)
      try {
        await answerBridgeCall(c.id, outcome, note)
        setCalls(await loadBridgeCalls())
        showToast(outcome === 'moved' ? 'Recorded: the link moved' : 'Recorded: the link did not move', 'success', 2500)
      } catch (e) {
        showToast(formatErrorMessage(e), 'error', 4000)
      } finally {
        setAnswering(false)
      }
    },
    [calls, thisWeekStart, showToast],
  )

  const saveCash = useCallback(async () => {
    const v = Number(cashDraft.replace(/[^0-9.-]/g, ''))
    if (!Number.isFinite(v)) {
      showToast('Cash on hand must be a number', 'error', 2500)
      return
    }
    if (!data) return
    try {
      await saveBridgeCashOnHand(v, data.todayYmd)
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
      await saveBridgeFloor(v)
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
        const v = await loadBridgeVectorInputs(data)
        if (!cancelled) setVectorInputs(v)
      } catch (e) {
        if (!cancelled) setVectorError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data])
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
    if (!data || !daysRange || !peopleOpen) return
    const key = `${daysRange.start}:${daysRange.end}`
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
        const v = await loadVectorDaysInputs({ start: daysRange.start, end: daysRange.end, todayYmd: data.todayYmd, officeJobLedgerId: data.officeJobLedgerId })
        daysCacheRef.current.set(key, v)
        if (!cancelled) setDaysInputs(v)
      } catch (e) {
        if (!cancelled) setDaysError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, daysRange, peopleOpen])
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


  // The Daily profit rate panel (link PR 9): the trend by week, the waterfall, the sources, break-even.
  const profitPanel = useMemo(() => {
    if (!data || !profit) return null
    return buildProfitPanel({
      windowStart: data.windowStart,
      todayYmd: data.todayYmd,
      earnedByDay: data.earnedByDay,
      directByDay: data.directByDay,
      overheadByDay: data.overheadByDay,
      speed: profit.speed,
      contributionMargin: profit.contributionMargin,
      totals: data.totals,
      waitingWeeks: new Set((headline?.weeks ?? []).filter((w) => w.waiting).map((w) => w.start)),
      pendingClosedHours: data.crew.pendingClosedHours,
      unlinkedCard: data.hygiene.unlinkedCard,
      unattributedNoncard: data.hygiene.unattributedNoncard,
      fieldEarnedPerHour: data.crew.fieldHoursWindow > 0 ? data.totals.earnedUsd / data.crew.fieldHoursWindow : null,
      weekLabel: md,
    })
  }, [data, profit, headline])

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
  const climbColor = speed && speed.climbPerDay >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)'
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
  const readingGaps = useMemo(() => {
    if (!data) return []
    const assumedHalfEarnedUsd = data.earned.assumedHalfJobs.reduce((s, id) => s + (data.earned.earnedByJob.get(id) ?? 0), 0)
    const labelById = new Map(data.jobs.map((j) => [j.id, j.label]))
    return buildReadingGaps({
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

  const thisWeek = useMemo(() => {
    if (!data) return []
    const labelById = new Map(data.jobs.map((j) => [j.id, j.label]))
    const late = receipts.filter((r) => r.basis === 'late')
    return buildThisWeek({
      unbilledUsd: billPile?.knownUsd ?? 0,
      unbilledCount: billPile?.knownJobs ?? 0,
      lateReceipts: { count: late.length, usd: late.reduce((sum, r) => sum + r.usd, 0) },
      pendingClosedHours: data.crew.pendingClosedHours,
      pendingClosedSessions: data.crew.pendingClosedSessions,
      payrollWeeklyEstUsd: data.payrollWeeklyEstUsd,
      noContractJobs: data.earned.noRevenueJobs.map((id) => ({ id, label: labelById.get(id) ?? id })),
      assumedHalfJobs: data.earned.assumedHalfJobs.length,
      assumedHalfEarnedUsd: data.earned.assumedHalfJobs.reduce((sum, id) => sum + (data.earned.earnedByJob.get(id) ?? 0), 0),
      fieldEarnedPerHour: data.totals.earnedUsd > 0 && data.crew.fieldHoursWindow > 0 ? data.totals.earnedUsd / data.crew.fieldHoursWindow : null,
      contributionMargin: profit?.contributionMargin ?? null,
      overheadPerDayUsd: profit?.speed.overheadPerDay ?? 0,
      bidsDue: data.levers.bidsDue,
      dayLabel: md,
    })
  }, [data, billPile, receipts, profit])

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

  // The sheet's link lines (link PR 11): the rule, the lit link, the call, the three readings at today's pace.
  const sheetLink = useMemo((): string[] => {
    if (!stageFlow || !stageFlow.linkId) return []
    const s = stageFlow.stages.find((x) => x.id === stageFlow.linkId)
    const out = [STAGE_RULE_LINE]
    if (s) out.push(`${s.name}: ${s.badge}. ${s.pile.headline}. ${s.weeksText}.`)
    if (thisWeekCall) out.push(`This week's call: ${thisWeekCall.link}, recorded ${md(thisWeekCall.calledOn)}${thisWeekCall.calledByName ? ` by ${thisWeekCall.calledByName}` : ''}.`)
    else out.push('No call recorded for this week yet.')
    if (scorecard) out.push(`Last week's call: ${scorecard.linkName}, ${scorecard.verdictText}. ${scorecard.consequence}`)
    // In the mail the readings stand without the dial beside them, so each carries its stage's name.
    if (dialReading && !dialMoved) {
      const dialStageName = STAGE_META[dialReading.spec.stage].name
      for (const l of dialReading.lines) out.push(`${dialStageName} · ${l.head}: ${l.text}`)
    }
    return out
  }, [stageFlow, thisWeekCall, scorecard, dialReading, dialMoved])

  const sheet = useMemo(() => {
    if (!data) return null
    const c = forecast ? carryingDay(forecast, receipts) : null
    const cashRows = [
      ...(c ? [{ label: `${md(c.ymd)} · receipts assumed`, value: `+${shortK(c.receiptsUsd)}` }, ...(c.billsUsd > 0 ? [{ label: `${md(c.ymd)} · bills due`, value: `−${shortK(c.billsUsd)}` }] : [])] : []),
      { label: 'Receipts by a promise or pace', value: shortK(confidence.promisedUsd + confidence.paceUsd) },
    ]
    const netRows = truth
      ? [
          { label: 'Earned, not invoiced', value: `${truth.billingLagUsd >= 0 ? '+' : '−'}${shortK(Math.abs(truth.billingLagUsd))}` },
          { label: 'Costs the paper misses', value: `${truth.costGapUsd >= 0 ? '−' : '+'}${shortK(Math.abs(truth.costGapUsd))}${truth.costGapShare != null ? ` · ${Math.round(truth.costGapShare * 100)}%` : ''}` },
          ...(billPile ? [{ label: 'Finished, unbilled', value: shortK(billPile.knownUsd) }] : [])
        ]
      : []
    return buildMondaySheet({
      todayLabel: md(data.todayYmd),
      weekLabel: vectorWeek ? formatPayWeekLabel(vectorWeek) : '',
      headline,
      net: netLight,
      cash: cashLightRead,
      netRows,
      cashRows,
      moves: thisWeek,
      people: peopleLines(vectorInputs ? vectors : null),
      link: sheetLink,
    })
  }, [data, forecast, receipts, confidence, truth, billPile, vectorWeek, headline, netLight, cashLightRead, thisWeek, vectorInputs, vectors, sheetLink])

  const emailSheet = useCallback(async () => {
    if (!sheet || emailing) return
    setEmailing(true)
    setMailNote(null)
    try {
      const url = `${window.location.origin}/bridge`
      const { data: res, error: err } = await supabase.functions.invoke('bridge-sheet-email', { body: { subject: mondaySheetSubject(sheet), html: mondaySheetHtml(sheet, url), text: mondaySheetText(sheet, url) } })
      if (err) throw new Error(err.message)
      const r = res as { error?: string; to?: string } | null
      if (r && typeof r.error === 'string') throw new Error(r.error)
      setMailNote(`sent to ${r?.to ?? 'you'}`)
      showToast('The Monday sheet is in your inbox', 'success', 2500)
    } catch (e) {
      showToast(formatErrorMessage(e), 'error', 4000)
    } finally {
      setEmailing(false)
    }
  }, [sheet, emailing, showToast])

  // A hard load waits for the role before it decides (`pageGate`).
  const gate = pageGate({ loading: authLoading, user, role }, (r) => r === 'dev')
  if (gate === 'wait') return null
  if (gate === 'away') return <Navigate to="/dashboard" replace />

  const billsByDay = groupByDay(bills)
  const receiptsByDay = groupByDay(receipts)

  return (
    <div style={{ padding: '0.25rem 0 3rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>The Bridge</h1>
        {data ? (
          <span style={det} data-testid="bridge-date">
            {new Date(`${data.todayYmd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
            {vectorWeek ? ` · pay week ${formatPayWeekLabel(vectorWeek)}` : ''}
          </span>
        ) : (
          <span style={det}>Where we stand, where cash is going, what would change it. Dev only.</span>
        )}
        {chip && (
          <a
            href="#bridge-last-call"
            data-testid="bridge-call-chip"
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 999,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              border: `1px solid ${chip.tone === 'red' ? 'var(--text-red-700)' : chip.tone === 'green' ? 'var(--text-green-700)' : chip.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--border)'}`,
              color: chip.tone === 'red' ? 'var(--text-red-700)' : chip.tone === 'green' ? 'var(--text-green-700)' : chip.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)',
            }}
          >
            {chip.text}
          </a>
        )}
        {!sheetView && (
          <button type="button" onClick={() => setSearchParams({ view: 'monday' })} disabled={!sheet} style={{ ...btnStyle, marginLeft: 'auto', borderRadius: 6, padding: '0.25rem 0.7rem' }}>
            Monday sheet
          </button>
        )}
        <button type="button" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading} style={{ ...btnStyle, marginLeft: sheetView ? 'auto' : undefined, borderRadius: 6, padding: '0.25rem 0.7rem' }}>
          {loading ? 'Reading…' : 'Refresh'}
        </button>
      </div>
      {error ? <p style={{ color: 'var(--text-red-700)' }}>{error}</p> : null}
      {!data || !profit || !speed ? (
        <p style={det}>{loading ? 'Reading the last 8 weeks — sessions, bank flows, invoices, payments, the overhead pool…' : '—'}</p>
      ) : sheetView && sheet ? (
        <BridgeMondaySheet sheet={sheet} emailing={emailing} onEmail={() => void emailSheet()} onFull={() => setSearchParams({})} mailNote={mailNote} />
      ) : (
        <>
          {/* The rule (link PR 1): one line the page opens on, the longer reading behind its ? */}
          <BridgeRule />

          {/* The top line (v2.5216): contribution per week, the two constraints as lights */}
          <BridgeHeadline headline={headline} cards={headlineAndCards?.cards} loading={headline == null && weeksError == null && vectorError == null} error={weeksError ?? vectorError} net={netLight} cash={cashLightRead} />

          {/* Where the work piles up (link PR 1): the five stages, the link lit */}
          {shownFlow && <BridgeStages flow={shownFlow} pickedId={litLink && isStageLink(litLink) ? litLink : null} onPick={setPickedStage} onOrder={setOrderFor} />}
          {/* The percents prompt (v2.5245): the Build card's grey jobs, set from the page */}
          {pctPrompt && <BridgePctPrompt prompt={pctPrompt} onSaved={savePct} />}
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

          {/* The link's desk and the call (link PR 2): what the pressed link is, the moves with owners, the record; then last week's call against what moved */}
          {stageFlow && litLink && (
            <BridgeLinkDesk
              link={litLink}
              status={deskStatus({ link: litLink, nominatedId: stageFlow.nominatedId, linkId: stageFlow.linkId, heldStands: stageFlow.heldStands, recorded: thisWeekCall?.link === litLink })}
              todayReading={deskReading}
              moveNumbers={moveNumbers}
              thisWeekCall={thisWeekCall}
              recording={recording}
              onRecord={(moves, note) => void recordCall(moves, note)}
              dayLabel={md}
              door={litLink === 'collect' && fin.data ? { label: 'Break it down', onPress: () => setCollectOpen(true) } : undefined}
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '0.6rem' }}>
            {reflexes && <BridgeWaits reflexes={reflexes} activeId={reflexId} line={reflexLineNow} levers={otherLevers(litLink)} onPress={pressReflex} onReset={resetReflex} />}
            {calls && <BridgeLastCall card={scorecard} answering={answering} onAnswer={(o, n) => void answerCall(o, n)} />}
          </div>
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
                onClose={() => setCollectOpen(false)}
                sheet={collectPlan?.sheet ?? null}
                decisions={collectPlan?.decisions ?? null}
                whatIf={collectPlan?.whatIf ?? null}
                scorecard={collectPlan?.scorecard ?? null}
                thisWeekCall={thisWeekCall}
                recording={recording}
                onRecordPlan={(moves) => void recordCall(moves, 'the Collect desk\u2019s sheet')}
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
          {order && <BridgeOrderModal order={order} note={dialMoved && dialReading ? `at the dial’s pace, ${dialReading.valueText}` : 'at today’s pace'} onClose={closeOrder} />}
          {callsError && <p style={{ ...det, color: 'var(--text-amber-800)' }}>The calls could not be read ({callsError}). Is the bridge_calls migration pushed?</p>}
          {buildError && <p style={{ ...det, color: 'var(--text-amber-800)' }}>Build could not be read ({buildError}).</p>}
          {billError && <p style={{ ...det, color: 'var(--text-amber-800)' }}>The Bill pile could not be read ({billError}).</p>}
          {demandError && <p style={{ ...det, color: 'var(--text-amber-800)' }}>Market and Sales could not be read ({demandError}).</p>}

          {/* This week (v2.5221) beside Fix the reading (v2.5220): the moves and the gaps, each with its door */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
            <BridgeThisWeek moves={thisWeek} />
            <BridgeReadingGaps gaps={readingGaps} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
            <button type="button" onClick={() => setOpenCard((c) => (c === 'profit' ? null : 'profit'))} aria-expanded={openCard === 'profit'} data-testid="bridge-card-profit" style={{ ...panel, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', border: openCard === 'profit' ? '2px solid #2563eb' : panel.border, padding: openCard === 'profit' ? 'calc(0.7rem - 1px) calc(0.9rem - 1px)' : panel.padding }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={label}>Daily profit rate</div>
                <span style={{ marginLeft: 'auto', ...det }}>{openCard === 'profit' ? '▴ close' : '▾ chart'}</span>
              </div>
              <div style={{ ...big, color: climbColor }}>
                {speed.climbPerDay >= 0 ? '+' : '−'}
                {money(Math.abs(speed.climbPerDay))} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>/day · {speed.days}-day avg</span>
              </div>
              <div style={det}>
                earned <b style={{ color: 'var(--text)' }}>{money(speed.earnedPerDay)}</b>/day · costs <b style={{ color: 'var(--text)' }}>{money(speed.burnPerDay)}</b>/day (jobs {money(speed.directPerDay)} + overhead {money(speed.overheadPerDay)} at the 90-day rate)
                {profit.contributionMargin != null && <> · {Math.round(profit.contributionMargin * 100)}% of earned is margin</>}
              </div>
            </button>
            <button type="button" onClick={() => setOpenCard((c) => (c === 'owed' ? null : 'owed'))} aria-expanded={openCard === 'owed'} data-testid="bridge-card-owed" style={{ ...panel, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', border: openCard === 'owed' ? '2px solid #2563eb' : panel.border, padding: openCard === 'owed' ? 'calc(0.7rem - 1px) calc(0.9rem - 1px)' : panel.padding }}>
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
            <button type="button" onClick={() => setOpenCard((c) => (c === 'hours' ? null : 'hours'))} aria-expanded={openCard === 'hours'} data-testid="bridge-card-hours" style={{ ...panel, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', border: openCard === 'hours' ? '2px solid #2563eb' : panel.border, padding: openCard === 'hours' ? 'calc(0.7rem - 1px) calc(0.9rem - 1px)' : panel.padding }}>
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
          {openCard === 'profit' && profitPanel && <BridgeProfitPanel panel={profitPanel} onClose={() => setOpenCard(null)} />}
          {openCard === 'owed' && owedPanel && <BridgeOwedPanel panel={owedPanel} onClose={() => setOpenCard(null)} />}
          {openCard === 'hours' && hoursPanel && <BridgeHoursPanel panel={hoursPanel} onClose={() => setOpenCard(null)} />}

          {/* Net position */}
          <div style={{ ...panel, marginTop: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={label}>Net position — last 8 weeks</span>
              <span style={det}>cash + owed to you (collections excluded) − owed by you</span>
              {netPanel && (
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
            {netOpen && netPanel && <BridgeBreakdownPanel title={`What moved it, ${netPanel.startLabel} to today`} sub="the three parts of net position, each by how much it changed over the window" bars={netPanel.waterfall} sources={netPanel.sources} closing={netPanel.paper} testId="bridge-net-panel" />}
          </div>

          {/* Truth check (v2.3335) */}
          {truth && <TruthCheckPanel truth={truth} windowStartLabel={windowStartLabel} />}

          {/* People (v2.5222): Vectors (v2.3344) and Vectors by the day (v2.4217) under one strip */}
          <BridgePeople
            summary={peopleSummary(vectorInputs ? vectors : null, vectorWeek ? formatPayWeekLabel(vectorWeek) : '', vectorWeek ? vectorWeek.end >= data.todayYmd : false)}
            open={peopleOpen}
            onToggle={() => {
              setPeopleOpen((o) => {
                writePeopleOpen(!o)
                return !o
              })
            }}
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
                      Cash on hand <b style={{ color: 'var(--text)' }}>{shortK(bank.usd)}</b> · the bank's balance at {bankReadAt}
                      {bank.accounts.length > 1 ? ` · ${mercuryAccountsLine(bank.accounts)}` : ''}
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
            {cashOpen && cashPanel && <BridgeBreakdownPanel title="Where the window's cash comes from, and where it goes" sub="today's bank, plus every receipt the forecast expects, less every bill it schedules, is where the line ends" bars={cashPanel.waterfall} sources={cashPanel.sources} closing={cashPanel.lowest} testId="bridge-cash-panel" />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
            <div style={panel}>
              <div style={label}>Bills coming due · next 8 weeks</div>
              <div style={{ ...det, marginTop: '0.2rem' }}>payroll ≈ {money(data.payrollWeeklyEstUsd)}/week (8-week labor average{data.crew.pendingClosedHours > 0 ? ' — reads low while hours await approval' : ''}) · sub labor owed on a {SUB_LABOR_DEFAULT_DAYS}-day horizon · other spend ≈ {money(data.dailyDrainUsd)}/day (office parts, 90-day rate)</div>
              <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                {billsByDay.slice(0, 10).map((b) => (
                  <li key={b.ymd} style={listRow}>
                    <span>
                      {md(b.ymd)} · {b.labels.join(' + ')}
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-red-700)', fontVariantNumeric: 'tabular-nums' }}>−{money(b.usd)}</span>
                  </li>
                ))}
              </ul>
              <div style={{ ...det, marginTop: '0.4rem' }}>Insurance, rent, and card bills aren't scheduled yet — they arrive as bank transfers and only show once sorted.</div>
            </div>
            <div style={panel}>
              <div style={label}>Receipts expected · next 8 weeks</div>
              <div style={{ ...det, marginTop: '0.2rem' }}>promise date → this customer's pay speed → the GC pace here, or their segment's → company pace → {DEFAULT_PAY_DAYS} days · a late invoice assumed within its own pace from today (7–45d, {LATE_RECEIPT_GRACE_DAYS}d with none) · past {DOUBTFUL_AFTER_DAYS}d late not counted</div>
              <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                {receiptsByDay.slice(0, 10).map((r) => (
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
            </div>
          </div>

          <p style={{ ...det, marginTop: '0.8rem', maxWidth: '92ch' }}>
            <b>How it's counted</b> is in the guide <Link to="/help/the-bridge">read the Bridge</Link>. Window {data.windowStart} → {data.todayYmd}: earned {shortK(data.totals.earnedUsd)} · field labor {shortK(data.totals.fieldLaborUsd)} · materials {shortK(data.totals.materialsUsd)} · subs {shortK(data.totals.subLaborUsd)} · overhead {shortK(data.totals.overheadUsd)}.
          </p>
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
