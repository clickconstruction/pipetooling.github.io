/**
 * Jobs → Subs → Work (v2.2927; was Jobs → Work Orders, the one-row spine of
 * PR 3). Every row is still a sub sheet with the agreement behind it, its
 * money, its rail and the office's next move — but the board is grouped by
 * JOB now, and a job's line items can be read as STAGES: a stage with a
 * window is a row of its own until a work order fulfils it, then it rides on
 * that order's sheet row. "Add a stage…" on a job header, "Set a window…" on
 * a sheet row, and the assembler prefills its dates from the stage.
 * Crew pay sheets never appear here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { subLaborAssignPickerRows, subLaborJobNumberForStorage } from '../../lib/jobs/subLaborJobPicker'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StepCommitmentRow } from '../../lib/workflow/stepCommitments'
import { parseSubWorkOrderSnapshot, sheetWorkOrderLabel } from '../../lib/subWorkOrders/subWorkOrder'
import { buildWorkOrderDocument, renderWorkOrderDocumentHtml, WORK_ORDER_ISSUER } from '../../lib/subWorkOrders/workOrderDocument'
import type { WorkOrderRowLike } from '../../lib/subWorkOrders/workOrderCoverage'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/sheetsNeedingWorkOrder'
import { isRosterSub } from '../../lib/subWorkOrders/rosterSub'
import {
  buildWorkOrderBoard,
  WORK_ORDER_BOARD_FILTERS,
  workOrderBoardFilterFromParam,
  workOrderBoardRowMatches,
  type WorkOrderBoardFilterKey,
  type WorkOrderBoardRow,
  type WorkOrderBoardSheet,
} from '../../lib/subWorkOrders/workOrderBoardRows'
import { SHEET_RAIL_GAP } from '../../lib/subWorkOrders/sheetRailTone'
import { SheetRail } from './SheetRail'
import { SheetStoryModal } from './SheetStoryModal'
import { emitWorkOrderChanged, WORK_ORDER_CHANGED_EVENT } from '../../hooks/useJobWorkOrderCoverage'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { notifySheetWorkOrderOffered } from '../../lib/workflow/workOrderNotifications'
import { resolveSubPortalUrl } from '../../lib/subPortal/resolveSubPortalUrl'
import { ScheduleDispatchAssignJobPickerModal } from '../schedule/ScheduleDispatchAssignJobPickerModal'
import { WorkOrderAssemblerModal, type WorkOrderAssemblerInitial } from './WorkOrderAssemblerModal'
import { buildSubsTabGroups, subsGroupMatches, type SubsJobGroup, type SubsRow, type SubsStage } from '../../lib/subs/subsTabRows'
import { stageWindowByLabel, stageWindowLabel, stageWindowPhase, type StageWindowLike, type StageWindowSpan } from '../../lib/subs/stageWindow'
import { StageWindowEditor } from './StageWindowEditor'
import { answerPatch, askState, pickStillFits, type StageAskWindow } from '../../../supabase/functions/_shared/stageAsk'
import { JobWatchersPopover } from './JobWatchersPopover'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import { jobBillingContextFromJob } from '../../lib/jobBillingContext'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import AddInspectionModal from '../AddInspectionModal'
import { fetchSubOffDaysForRange, fetchSubOrdersForRange } from '../../lib/subs/subDispatchFetch'
import type { SubDispatchOrder } from '../../lib/subs/subDispatch'
import { useSubPortalVisitSummaries } from '../../hooks/useSubPortalVisitSummaries'
import { addCalendarDays, monthOf, type SubsTileKey } from '../../lib/subs/subsTileQueues'
import type { SubSheetStage } from '../../lib/subSheetStage'
import type { SubLaborPaymentTarget } from '../../types/laborJob'
import type { RosterContact, SubsTileActions } from './subsTiles/subsTileActions'
import { HandshakeQueue } from './subsTiles/HandshakeQueue'
import { StagesQueue } from './subsTiles/StagesQueue'
import { OffersQueue } from './subsTiles/OffersQueue'
import { SignedQueue } from './subsTiles/SignedQueue'
import { WindowTextCell, type WindowGcState } from './WindowTextCell'
import { StandingMoveCell, type MoveMenuItem } from './StandingMoveCell'
import { standingMovesForRow, STAGE_ROW_MOVE, type StandingMove } from '../../lib/subs/standingMove'

/** A sheet with its money, its stage and its people — the board derives everything from these. */
type SheetLite = WorkOrderBoardSheet & { assignees?: Array<{ person_id: string }> | null; progress_pct?: number | null; progress_at?: string | null }
type StepLite = { id: string; name: string }

export type JobsSubsWorkViewProps = {
  jobs: JobWithDetails[]
  jobsLoading: boolean
  authUserId: string | undefined
  /** `?wo=<id>` deep link — opens that order once, then the page clears the param. */
  deepLinkWorkOrderId: string | null
  onDeepLinkConsumed: () => void
  /** `?wof=` — the v2.2819 words (`drafts`, `awaiting`, …) or a rail group; Needs You lands on Drafted. */
  initialFilter?: string | null
  /** Sheet › on every row — opens the Sub Labor sheet editor. */
  onOpenSheet?: (sheetId: string) => void
  /**
   * Where the toolbar (+ New work order, search, chips) draws. `undefined` = above the board as before;
   * an element = portalled there (the Work / Pay row, via `JobsSubsTab`); `null` = the host is mounting, draw nothing yet.
   */
  toolbarHost?: HTMLElement | null
  /** Signed-queue moves the page owns (v2.2963): the sheet's stage (Passed → bill) and Make Payment. */
  onSetSheetStage?: (sheetId: string, stage: SubSheetStage) => Promise<boolean> | boolean | void
  onOpenMakePayment?: (target: SubLaborPaymentTarget, defaultAmount: string) => void
  /** Dev only (v2.2963 prototype): the Classic / Compact layout switch on the toolbar. */
  canPrototype?: boolean
}

type BoardLayout = 'classic' | 'compact'
const LAYOUT_KEY = 'subsWorkLayout'

const smallBtn = (tone: 'primary' | 'ghost' | 'danger' = 'ghost', disabled = false) =>
  ({
    padding: '0.25rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: 5,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#9ca3af' : tone === 'primary' ? '#2563eb' : 'var(--surface)',
    color: tone === 'primary' ? 'white' : tone === 'danger' ? 'var(--text-red-700)' : 'var(--text-700)',
    border: tone === 'primary' ? 'none' : '1px solid var(--border-strong)',
    whiteSpace: 'nowrap',
  }) as const

const door = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-blue-700)', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' } as const
const th = { padding: '0.45rem 0.6rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' } as const
const td = { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', verticalAlign: 'middle' } as const
const money = (n: number) => `$${formatCurrency(n)}`

/** Which row (or job header) has the window editor open. */
type WindowEditTarget = { groupKey: string; rowKey: string | null; commitmentId: string | null; stageId: string | null; span: StageWindowSpan | null }

export function JobsSubsWorkView({ jobs, jobsLoading, authUserId, deepLinkWorkOrderId, onDeepLinkConsumed, initialFilter, onOpenSheet, toolbarHost, onSetSheetStage, onOpenMakePayment, canPrototype = false }: JobsSubsWorkViewProps) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const jobForm = useJobFormModal()
  const narrow = useIsNarrowScreen()
  const [rows, setRows] = useState<StepCommitmentRow[]>([])
  const [windows, setWindows] = useState<StageWindowLike[]>([])
  const [windowEdit, setWindowEdit] = useState<WindowEditTarget | null>(null)
  /** job id → GC name for jobs whose Edit Job switch shares stage dates (v2.2933). */
  const [gcSharing, setGcSharing] = useState<Map<string, { gcName: string | null }>>(() => new Map())
  const [bundlePick, setBundlePick] = useState<{ groupKey: string; ids: Set<string> } | null>(null)
  /** The GC ask being answered with the office's own dates (v2.2934). */
  const [askAnswer, setAskAnswer] = useState<{ windowId: string; start: string; end: string; note: string } | null>(null)
  const [windowSaving, setWindowSaving] = useState(false)
  const [sheets, setSheets] = useState<SheetLite[]>([])
  const [roster, setRoster] = useState<NeedsWorkOrderRosterPerson[]>([])
  const [steps, setSteps] = useState<Record<string, StepLite>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<WorkOrderBoardFilterKey>(() => workOrderBoardFilterFromParam(initialFilter) ?? 'all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [assembler, setAssembler] = useState<WorkOrderAssemblerInitial | null>(null)
  const [linkRow, setLinkRow] = useState<WorkOrderBoardRow | null>(null)
  const [storySheetId, setStorySheetId] = useState<string | null>(null)
  /** Which tile's queue is open (v2.2963), and the month the Signed queue shows. */
  const [tile, setTile] = useState<SubsTileKey | null>(null)
  const [signedMonth, setSignedMonth] = useState(() => monthOf(todayYmdInAppTz()))
  const [contacts, setContacts] = useState<Map<string, RosterContact>>(() => new Map())
  const [rosterBench, setRosterBench] = useState<Set<string>>(() => new Set())
  const [availability, setAvailability] = useState<{ orders: SubDispatchOrder[]; offDays: Map<string, string[]>; loading: boolean }>({ orders: [], offDays: new Map(), loading: false })
  const [addInspectionOpen, setAddInspectionOpen] = useState(false)
  /** Prototype (v2.2963): Classic = today's nine columns; Compact = Window track + money stack + Standing → next. */
  const [layout, setLayout] = useState<BoardLayout>(() => {
    try {
      return localStorage.getItem(LAYOUT_KEY) === 'compact' ? 'compact' : 'classic'
    } catch {
      return 'classic'
    }
  })
  const [trackOpenKey, setTrackOpenKey] = useState<string | null>(null)
  const billCustomer = useBillCustomerModal()
  const [linkSearch, setLinkSearch] = useState('')
  const [linkNumber, setLinkNumber] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data: rowsData, error: rowsErr }, { data: sheetsData, error: sheetsErr }, { data: rosterData, error: rosterErr }, { data: usersData, error: usersErr }, { data: windowData, error: windowErr }] = await Promise.all([
        supabase.from('step_commitments').select('*').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1000),
        // Every sheet with its items, payments, stage and assignees — rows are sheets now.
        supabase
          .from('people_labor_jobs')
          .select('id, job_number, job_ledger_id, address, assigned_to_name, labor_rate, stage, payable_after, job_date, created_at, progress_pct, progress_at, items:people_labor_job_items(count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount), payments:people_labor_job_payments(amount), assignees:people_labor_job_assignees(person_id)')
          .order('created_at', { ascending: false })
          .limit(1000),
        // The roster decides which sheets are sub sheets: teammates carry a `kind = 'sub'`
        // row too, so the login's role is what tells crew pay from a sub.
        supabase.from('people').select('id, name, kind, account_user_id, email, phone, end_date').order('id').limit(1000),
        supabase.from('users').select('id, role').order('id').limit(1000),
        // Stages: line items with a window (v2.2927).
        supabase.from('job_stage_windows').select('id, job_id, fixture_id, window_start, window_end, window_by, note, offered_to_gc, bundle_id, asked_start, asked_end, asked_note, asked_at, answered_at, answer, answer_note').limit(2000),
      ])
      if (rowsErr) throw rowsErr
      if (sheetsErr) throw sheetsErr
      if (rosterErr) throw rosterErr
      if (usersErr) throw usersErr
      // The stages table lands with its migration; until it is applied the board still paints, just without stages.
      if (windowErr) console.warn('job_stage_windows unavailable — showing the board without stages', windowErr)
      setWindows(windowErr ? [] : ((windowData ?? []) as StageWindowLike[]))
      // GC sharing per job (v2.2933): the Edit Job switch decides whether the GC column is live.
      const { data: gcRaw } = await supabase.from('jobs_ledger').select('id, gc_shares_stage_dates, gc_customer_id, gc:customers!gc_customer_id(name)').eq('gc_shares_stage_dates', true).limit(2000)
      const gcMap = new Map<string, { gcName: string | null }>()
      for (const j of (gcRaw ?? []) as Array<{ id: string; gc_shares_stage_dates: boolean; gc: { name: string | null } | { name: string | null }[] | null }>) {
        const g = Array.isArray(j.gc) ? j.gc[0] ?? null : j.gc
        gcMap.set(j.id, { gcName: (g?.name ?? '').trim() || null })
      }
      setGcSharing(gcMap)
      const list = (rowsData ?? []) as StepCommitmentRow[]
      setRows(list)
      setSheets((sheetsData ?? []) as SheetLite[])
      const roleByUserId = new Map(((usersData ?? []) as Array<{ id: string; role: string | null }>).map((u) => [u.id, u.role]))
      const rosterList = (rosterData ?? []) as Array<{ id: string; name: string; kind: string; account_user_id: string | null; email: string | null; phone: string | null; end_date: string | null }>
      setRoster(
        rosterList.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          accountRole: p.account_user_id ? (roleByUserId.get(p.account_user_id) ?? null) : null,
        })),
      )
      setContacts(new Map(rosterList.map((p) => [p.id, { email: p.email, phone: p.phone }])))
      setRosterBench(new Set(rosterList.filter((p) => !!p.end_date).map((p) => p.id)))
      const stepIds = Array.from(new Set(list.map((r) => r.step_id).filter((s): s is string => !!s)))
      if (stepIds.length > 0) {
        const { data: stepData } = await supabase.from('project_workflow_steps').select('id, name').in('id', stepIds.slice(0, 300))
        const next: Record<string, StepLite> = {}
        for (const s of (stepData ?? []) as StepLite[]) next[s.id] = s
        setSteps(next)
      } else {
        setSteps({})
      }
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
  }, [load])

  // Deep link: open the named order once the rows and the jobs cache are in.
  useEffect(() => {
    if (!deepLinkWorkOrderId || loading || jobsLoading) return
    const hit = rows.find((r) => r.id === deepLinkWorkOrderId)
    if (hit) setAssembler({ commitmentId: hit.id })
    else showToast('That work order is no longer on the board', 'info')
    onDeepLinkConsumed()
  }, [deepLinkWorkOrderId, loading, jobsLoading, rows, onDeepLinkConsumed, showToast])

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])
  const sheetsById = useMemo(() => new Map(sheets.map((s) => [s.id, s])), [sheets])
  const today = todayYmdInAppTz()

  // The Stages and Offers queues read the same live orders and days off the dispatch lanes read (v2.2963).
  useEffect(() => {
    if (tile !== 'stages' && tile !== 'offers') return
    let cancelled = false
    setAvailability((a) => ({ ...a, loading: true }))
    const start = addCalendarDays(today, -30)
    const end = addCalendarDays(today, 180)
    void Promise.all([fetchSubOrdersForRange(start, end), fetchSubOffDaysForRange(start, end)]).then(([o, d]) => {
      if (cancelled) return
      setAvailability({ orders: o.data, offDays: d.data, loading: false })
    })
    return () => {
      cancelled = true
    }
  }, [tile, today])

  /** Labels for orders with no sheet and no Pipeline job — the snapshot or the step. */
  const orderLabels = useMemo(() => {
    const m = new Map<string, { primary: string; secondary: string | null }>()
    for (const r of rows) {
      if (r.job_id || r.labor_job_id) continue
      const snap = parseSubWorkOrderSnapshot(r.offer_scope_snapshot)
      if (snap?.facts?.jobLabel) m.set(r.id, { primary: snap.facts.jobLabel, secondary: snap.facts.jobAddress ?? null })
      else if (r.step_id) m.set(r.id, { primary: steps[r.step_id]?.name ?? 'Project step', secondary: 'Project step' })
    }
    return m
  }, [rows, steps])

  const board = useMemo(() => {
    const assigneesBySheetId = new Map<string, string[]>()
    for (const s of sheets) {
      const ids = (s.assignees ?? []).map((a) => a.person_id).filter(Boolean)
      if (ids.length > 0) assigneesBySheetId.set(s.id, ids)
    }
    return buildWorkOrderBoard({ sheets, assigneesBySheetId, roster, commitments: rows as WorkOrderRowLike[], jobs, todayYmd: today, orderLabels })
  }, [sheets, roster, rows, jobs, today, orderLabels])

  /** Portal visits for the subs with an offer out — the Offers queue's "seen" column. */
  const sentPersonIds = useMemo(() => board.rows.filter((r) => r.coverage.kind === 'sent' && r.personId).map((r) => r.personId!), [board.rows])
  const { byPerson: visits } = useSubPortalVisitSummaries(sentPersonIds, tile === 'offers')

  /** The stage an order fulfils — name and window — by order id (the Offers and Signed queues). */
  const stageByOrderId = useMemo(() => {
    const fixturesById = new Map(jobs.flatMap((j) => (j.fixtures ?? []).map((f) => [f.id, (f.name ?? '').trim() || 'Line item'] as const)))
    const windowsById = new Map(windows.map((w) => [w.id, w]))
    const m = new Map<string, { name: string; span: StageWindowSpan | null }>()
    for (const r of rows) {
      if (!r.stage_window_id) continue
      const w = windowsById.get(r.stage_window_id)
      if (!w) continue
      m.set(r.id, { name: fixturesById.get(w.fixture_id) ?? 'Line item', span: w.window_start && w.window_end ? { start: w.window_start, end: w.window_end } : null })
    }
    return m
  }, [rows, windows, jobs])

  /** Roster subs for the Stages queue's picker — the board's own roster-sub rule, bench flagged. */
  const pickerSubs = useMemo(
    () =>
      roster
        .filter((p) => isRosterSub(p))
        .map((p) => ({ id: p.id, name: p.name, benched: rosterBench.has(p.id) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [roster, rosterBench],
  )

  /** The board regrouped by job, with stages beside sheets (v2.2927). */
  const subs = useMemo(() => {
    const fixtures = jobs.flatMap((j) => (j.fixtures ?? []).map((f) => ({ id: f.id, job_id: j.id, name: f.name, count: Number(f.count) || 0, line_unit_price: f.line_unit_price == null ? null : Number(f.line_unit_price), sequence_order: Number(f.sequence_order) || 0 })))
    const windowIdByCommitmentId = new Map<string, string>()
    for (const r of rows) if (r.stage_window_id) windowIdByCommitmentId.set(r.id, r.stage_window_id)
    return buildSubsTabGroups({ board: board.rows, windows, windowIdByCommitmentId, fixtures, jobs: jobs.map((j) => ({ id: j.id, hcp_number: j.hcp_number, customer_name: j.customer_name ?? null, job_address: j.job_address ?? null })) })
  }, [board.rows, windows, rows, jobs])

  /** Groups after the search box and the rail-group chips; stage rows only show under All. */
  const visibleGroups = useMemo(() => {
    const q = search.trim()
    return subs.groups
      .filter((g) => subsGroupMatches(g, q))
      .map((g) => ({ ...g, rows: g.rows.filter((r) => (r.kind === 'stage' ? filter === 'all' : filter === 'all' || r.board.group === filter) && (!q || r.kind === 'stage' || workOrderBoardRowMatches(r.board, q) || subsGroupMatches({ ...g, rows: [] }, q))) }))
      .filter((g) => g.rows.length > 0)
  }, [subs.groups, filter, search])
  const visibleRowCount = visibleGroups.reduce((n, g) => n + g.rows.length, 0)

  /** The nudge's sheet label — the row's own words. */
  const labelForOrder = useCallback(
    (r: StepCommitmentRow): string => {
      const row = board.rows.find((x) => x.commitmentId === r.id)
      if (row) return row.primary
      const sheet = r.labor_job_id ? sheetsById.get(r.labor_job_id) : null
      if (sheet) return sheetWorkOrderLabel(sheet)
      return orderLabels.get(r.id)?.primary ?? 'Work order'
    },
    [board.rows, sheetsById, orderLabels],
  )

  async function withdraw(r: StepCommitmentRow) {
    const ok = await confirm({ title: 'Withdraw this offer?', message: `${r.record_id ?? 'The work order'} goes back to a draft. ${r.display_name} will no longer see it on their portal.`, confirmLabel: 'Withdraw' })
    if (!ok) return
    setBusyId(r.id)
    const { error: err } = await supabase.from('step_commitments').update({ status: 'draft', offered_at: null, offer_expires_at: null }).eq('id', r.id)
    setBusyId(null)
    if (err) {
      showToast(`Could not withdraw: ${formatErrorMessage(err)}`, 'error')
      return
    }
    showToast('Offer withdrawn — it is a draft again', 'success')
    emitWorkOrderChanged()
  }

  /** Withdraw without the confirm — for callers that already asked (the tile queues, v2.2963). */
  async function withdrawQuiet(r: StepCommitmentRow): Promise<boolean> {
    const { error: err } = await supabase.from('step_commitments').update({ status: 'draft', offered_at: null, offer_expires_at: null }).eq('id', r.id)
    if (err) {
      showToast(`Could not withdraw: ${formatErrorMessage(err)}`, 'error')
      return false
    }
    emitWorkOrderChanged()
    return true
  }

  /** Push an offer's good-through out by `days` from its current end (or from today once it has lapsed). */
  async function extendOffer(r: StepCommitmentRow, days: number): Promise<boolean> {
    const base = r.offer_expires_at && r.offer_expires_at >= today ? r.offer_expires_at : today
    const next = addCalendarDays(base, days)
    const { error: err } = await supabase.from('step_commitments').update({ offer_expires_at: next }).eq('id', r.id)
    if (err) {
      showToast(`Could not extend: ${formatErrorMessage(err)}`, 'error')
      return false
    }
    showToast(`${r.record_id ?? 'Offer'} now good through ${stageWindowLabel({ start: next, end: next })}`, 'success')
    emitWorkOrderChanged()
    return true
  }

  /** Link a sheet to a Pipeline job without the confirm — the queue's own button already said "Link and send". */
  async function linkSheetToJobQuiet(sheetId: string, job: JobWithDetails): Promise<boolean> {
    const { error: err } = await supabase.from('people_labor_jobs').update({ job_number: job.hcp_number }).eq('id', sheetId)
    if (err) {
      showToast(`Could not link: ${formatErrorMessage(err)}`, 'error')
      return false
    }
    return true
  }

  /** Bill Customer for a job, pre-filled — the Stages board's door, reused by the Signed queue. */
  function billCustomerForJob(jobId: string) {
    const job = jobs.find((j) => j.id === jobId)
    if (!job) return
    if (!jobLedgerHasCustomerForBilling(job.customer_id)) {
      showToast('Link this job to a customer before billing — Edit Job → Customer', 'error')
      return
    }
    if (!billCustomer) {
      showToast('Bill Customer is not available on this page', 'info')
      return
    }
    billCustomer.openBillCustomer({ payload: { kind: 'job', job: jobBillingContextFromJob(job) }, onSuccess: () => emitWorkOrderChanged(), onAfterEnsureSuccess: () => emitWorkOrderChanged() })
  }

  async function discardDraft(r: StepCommitmentRow) {
    const ok = await confirm({ title: 'Discard this draft?', message: `The draft for ${r.display_name} is removed. Nothing was sent.`, confirmLabel: 'Discard', danger: true })
    if (!ok) return
    setBusyId(r.id)
    const { error: err } = await supabase.from('step_commitments').update({ status: 'cancelled' }).eq('id', r.id)
    setBusyId(null)
    if (err) {
      showToast(`Could not discard: ${formatErrorMessage(err)}`, 'error')
      return
    }
    emitWorkOrderChanged()
  }

  async function markSignedOnPaper(r: StepCommitmentRow) {
    const ok = await confirm({
      title: 'Mark as signed on paper?',
      message: `Use this when ${r.display_name} signed a printed copy instead of the portal. The work order counts as signed today${r.job_id && !r.labor_job_id ? ' and their Sub Labor sheet is created from the agreed amount' : ''}.`,
      confirmLabel: 'Mark signed',
    })
    if (!ok) return
    setBusyId(r.id)
    try {
      const { error: err } = await supabase.from('step_commitments').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', r.id)
      if (err) throw err
      if (r.job_id && !r.labor_job_id) {
        const { error: rpcErr } = await supabase.rpc('create_sheet_for_work_order', { p_commitment_id: r.id })
        if (rpcErr) throw rpcErr
      }
      showToast('Marked signed', 'success')
      emitWorkOrderChanged()
    } catch (e) {
      showToast(`Could not mark signed: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function nudge(r: StepCommitmentRow) {
    setBusyId(r.id)
    try {
      const portalUrl = await resolveSubPortalUrl(r.person_id)
      const { data: acct } = await supabase.from('people').select('account_user_id, email').eq('id', r.person_id).maybeSingle()
      const a = acct as { account_user_id?: string | null; email?: string | null } | null
      void notifySheetWorkOrderOffered({
        laborJobId: r.labor_job_id,
        workOrderId: r.id,
        sheetLabel: labelForOrder(r),
        offeredByName: 'The office',
        recipientName: r.display_name,
        recipientEmail: a?.email ?? null,
        recipientUserId: a?.account_user_id ?? null,
        amount: Number(r.amount ?? 0),
        proposedStart: r.proposed_start,
        proposedEnd: r.proposed_end,
        portalUrl,
      })
      showToast(a?.email ? `Reminder sent to ${r.display_name}` : 'No email on the roster — share their portal link instead', a?.email ? 'success' : 'info')
    } finally {
      setBusyId(null)
    }
  }

  function print(r: StepCommitmentRow) {
    if (!r.offer_scope_snapshot) {
      showToast('This draft has no document yet — open it to build one', 'info')
      return
    }
    const doc = buildWorkOrderDocument({ snapshot: r.offer_scope_snapshot, commitment: r, issuer: WORK_ORDER_ISSUER })
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(renderWorkOrderDocumentHtml(doc))
    w.document.close()
  }

  async function linkSheetToJob(row: WorkOrderBoardRow, jobId: string) {
    const job = jobs.find((j) => j.id === jobId)
    if (!job || !row.sheetId) return
    setLinkRow(null)
    const num = subLaborJobNumberForStorage(job)
    const ok = await confirm({
      title: `Link this sheet to #${num}?`,
      message: `The ${row.subName} sheet goes on job ${num} (${job.customer_name ?? 'no customer'}). Its work order, bill and Job Summary all land on that job.`,
      confirmLabel: 'Link',
    })
    if (!ok) return
    setBusyId(row.key)
    // v2.3055: the link is the job id; the number is display text (effective number, so a click-only job links too).
    const { error: err } = await supabase.from('people_labor_jobs').update({ job_ledger_id: job.id, job_number: num || null }).eq('id', row.sheetId)
    setBusyId(null)
    if (err) {
      showToast(`Could not link: ${formatErrorMessage(err)}`, 'error')
      return
    }
    showToast(`Linked to #${num}`, 'success')
    emitWorkOrderChanged()
  }

  /** Upsert the window on (job, line item); an order on the row picks up the stage and, when it had none, the dates. */
  async function saveWindow(jobId: string, stageId: string, span: StageWindowSpan, commitmentId: string | null): Promise<boolean> {
    setWindowSaving(true)
    try {
      const { data, error: upErr } = await supabase
        .from('job_stage_windows')
        .upsert({ job_id: jobId, fixture_id: stageId, window_start: span.start, window_end: span.end, window_by: 'office', created_by: authUserId ?? null }, { onConflict: 'job_id,fixture_id' })
        .select('id')
        .single()
      if (upErr) throw upErr
      const windowId = (data as { id: string }).id
      if (commitmentId) {
        const order = rowsById.get(commitmentId)
        const patch: Record<string, unknown> = { stage_window_id: windowId }
        if (order && !order.proposed_start && !order.proposed_end) {
          patch.proposed_start = span.start
          patch.proposed_end = span.end
        }
        const { error: linkErr } = await supabase.from('step_commitments').update(patch).eq('id', commitmentId)
        if (linkErr) throw linkErr
      }
      setWindowEdit(null)
      showToast(`Window set · ${stageWindowLabel(span)}`, 'success')
      emitWorkOrderChanged()
      return true
    } catch (e) {
      showToast(`Could not set the window: ${formatErrorMessage(e)}`, 'error')
      return false
    } finally {
      setWindowSaving(false)
    }
  }

  async function removeWindow(w: StageWindowLike, stageName: string) {
    const ok = await confirm({ title: `Take ${stageName} off the board?`, message: 'The line item stays on the job. Its window is cleared and any order on it keeps its own dates.', confirmLabel: 'Remove the window' })
    if (!ok) return
    const { error: err } = await supabase.from('job_stage_windows').delete().eq('id', w.id)
    if (err) {
      showToast(`Could not remove the window: ${formatErrorMessage(err)}`, 'error')
      return
    }
    emitWorkOrderChanged()
  }

  /** Answer a GC ask (v2.2934): accept their span or propose ours; a pick that no longer fits becomes a change request to the sub. */
  async function answerGcAsk(w: StageWindowLike, a: Parameters<typeof answerPatch>[1], commitmentId: string | null) {
    const nowIso = new Date().toISOString()
    const patch = answerPatch(w as unknown as StageAskWindow, a, nowIso)
    const q = supabase.from('job_stage_windows').update(patch)
    const { error } = w.bundle_id ? await q.eq('bundle_id', w.bundle_id) : await q.eq('id', w.id)
    if (error) {
      showToast(`Could not answer: ${formatErrorMessage(error)}`, 'error')
      return
    }
    const newWindow = { start: String(patch.window_start), end: String(patch.window_end) }
    const order = commitmentId ? rowsById.get(commitmentId) : null
    const pick = order?.picked_start ? { start: order.picked_start, end: order.picked_end ?? order.picked_start } : null
    if (order && pick && !pickStillFits(pick, newWindow)) {
      const note = a.kind === 'accept' ? `The GC asked for ${stageWindowLabel(newWindow)} — pick your days inside it.` : `The window moved to ${stageWindowLabel(newWindow)}${a.note.trim() ? ` — ${a.note.trim()}` : ''}. Pick your days inside it.`
      await supabase.from('step_commitments').update({ change_requested_at: nowIso, change_requested_note: note }).eq('id', order.id)
      showToast(`Answered · ${order.display_name} is asked to re-pick inside ${stageWindowLabel(newWindow)}`, 'success')
    } else showToast(`Answered · window ${stageWindowLabel(newWindow)}`, 'success')
    setAskAnswer(null)
    emitWorkOrderChanged()
  }

  /** Offer / withdraw stage windows to the GC (v2.2933). A bundle shares one id and goes together. */
  async function offerToGc(windowIds: string[], bundle: boolean) {
    if (windowIds.length === 0) return
    const bundleId = bundle && windowIds.length > 1 ? crypto.randomUUID() : null
    const { error } = await supabase.from('job_stage_windows').update({ offered_to_gc: true, offered_to_gc_at: new Date().toISOString(), ...(bundleId ? { bundle_id: bundleId } : {}) }).in('id', windowIds)
    if (error) {
      showToast(`Could not offer: ${formatErrorMessage(error)}`, 'error')
      return
    }
    setBundlePick(null)
    showToast(bundleId ? `${windowIds.length} stages offered together` : 'Offered — it is on their portal now', 'success')
    emitWorkOrderChanged()
  }
  async function withdrawFromGc(w: StageWindowLike) {
    const ok = await confirm({ title: 'Take this off the GC\'s portal?', message: w.bundle_id ? 'Every stage in the bundle comes off together. Your dates and orders stay as they are.' : 'The GC no longer sees this stage. Your dates and orders stay as they are.', confirmLabel: 'Withdraw' })
    if (!ok) return
    const q = supabase.from('job_stage_windows').update({ offered_to_gc: false, offered_to_gc_at: null, bundle_id: null })
    const { error } = w.bundle_id ? await q.eq('bundle_id', w.bundle_id) : await q.eq('id', w.id)
    if (error) {
      showToast(`Could not withdraw: ${formatErrorMessage(error)}`, 'error')
      return
    }
    emitWorkOrderChanged()
  }

  /** "Draft a work order…" from a stage row: the assembler opens on the job with the stage's dates and amount. */
  function draftForStage(row: Extract<SubsRow, { kind: 'stage' }>) {
    setAssembler({ jobId: row.jobId, stageWindowId: row.window.id, proposedStart: row.span?.start ?? null, proposedEnd: row.span?.end ?? null, amount: row.stage.amount > 0 ? row.stage.amount : null })
  }

  function newJobForSheet(row: WorkOrderBoardRow) {
    if (!jobForm) return
    showToast(`Give the new job number ${row.jobNumber || '…'} and the sheet links itself`, 'info')
    jobForm.openNewJob({ onSaved: () => emitWorkOrderChanged() })
  }

  /** A sheet row's stage (through its order), for the assembler. */
  function stagePrefill(row: WorkOrderBoardRow): Pick<WorkOrderAssemblerInitial, 'stageWindowId' | 'proposedStart' | 'proposedEnd'> {
    const w = row.commitmentId ? windows.find((x) => x.id === rowsById.get(row.commitmentId!)?.stage_window_id) : null
    return w ? { stageWindowId: w.id, proposedStart: w.window_start, proposedEnd: w.window_end } : {}
  }

  /** The button that goes first in the row — the office's next move. */
  function primaryAction(row: WorkOrderBoardRow) {
    const busy = busyId === row.key || (row.commitmentId != null && busyId === row.commitmentId)
    const order = row.commitmentId ? rowsById.get(row.commitmentId) : null
    const b = row.next.button
    if (!b || !row.next.buttonLabel) return null
    const onClick =
      b === 'draft'
        ? () => setAssembler({ jobId: row.jobId, laborJobId: row.sheetId, personId: row.personId, amount: row.agreed > 0 ? row.agreed : null, ...stagePrefill(row) })
        : b === 'nudge'
          ? () => (order ? void nudge(order) : undefined)
          : () => (row.commitmentId ? setAssembler({ commitmentId: row.commitmentId }) : undefined)
    return (
      <button type="button" style={smallBtn('primary', busy)} disabled={busy} onClick={onClick}>
        {row.next.buttonLabel}
      </button>
    )
  }

  function secondaryActions(row: WorkOrderBoardRow) {
    const order = row.commitmentId ? rowsById.get(row.commitmentId) : null
    const busy = busyId === row.key || (order != null && busyId === order.id)
    const c = row.coverage
    const view = (label: string) => (
      <button type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => (order ? setAssembler({ commitmentId: order.id }) : undefined)}>
        {label}
      </button>
    )
    const out: JSX.Element[] = []
    if (order && c.kind === 'draft') {
      out.push(
        <button key="discard" type="button" style={smallBtn('danger', busy)} disabled={busy} onClick={() => void discardDraft(order)}>
          Discard
        </button>,
      )
    } else if (order && c.kind === 'sent') {
      out.push(<span key="view">{view('View')}</span>)
      if (!c.expired && row.next.button !== 'nudge')
        out.push(
          <button key="nudge" type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => void nudge(order)} title="Resend the offer notification">
            Nudge
          </button>,
        )
      out.push(
        <button key="paper" type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => void markSignedOnPaper(order)} title="They signed a printed copy">
          Signed on paper
        </button>,
        <button key="withdraw" type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => void withdraw(order)}>
          Withdraw
        </button>,
      )
    } else if (order && c.kind === 'signed') {
      out.push(
        <button key="print" type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => print(order)}>
          Print
        </button>,
      )
    } else if (order && c.kind === 'declined') {
      out.push(
        <button key="print" type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => print(order)}>
          Print
        </button>,
      )
    }
    if (row.sheetId && onOpenSheet) {
      out.push(
        <button key="sheet" type="button" style={door} onClick={() => onOpenSheet(row.sheetId!)} title="Open the Sub Labor sheet">
          Sheet ›
        </button>,
      )
    }
    return out
  }

  /** "50% along" from the sub's own report (v2.2931). */
  const progressChip = (sheetId: string | null) => {
    const sh = sheetId ? sheetsById.get(sheetId) : null
    if (!sh || sh.progress_pct == null || sh.progress_pct >= 100) return null
    return (
      <span title={sh.progress_at ? `reported ${sh.progress_at.slice(0, 10)} from their portal` : 'from their portal'} style={{ marginLeft: 6, display: 'inline-block', padding: '0 6px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, background: 'var(--bg-subtle)', color: 'var(--text-700)', border: '1px solid var(--border)', verticalAlign: 1 }}>
        {sh.progress_pct}% along
      </span>
    )
  }

  /** First column: the sub (and the stage the order fulfils) on a sheet row; the stage on a stage row. */
  const firstCell = (r: SubsRow) =>
    r.kind === 'stage' ? (
      <>
        <div style={{ fontWeight: 600 }}>{r.stage.name}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>line item{r.stage.amount > 0 ? ` · ${money(r.stage.amount)}` : ''} · no order yet</div>
      </>
    ) : (
      <>
        <div style={{ fontWeight: 600 }}>
          {r.board.subName || <span style={{ color: 'var(--text-faint)' }}>no sub named</span>}
          {progressChip(r.board.sheetId)}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {r.stage ? `${r.stage.name} · ` : ''}
          {r.board.recordId ? (
            <button type="button" style={{ ...door, fontSize: '0.7rem' }} onClick={() => (r.board.commitmentId ? setAssembler({ commitmentId: r.board.commitmentId }) : undefined)} title="Open the signed record">
              {r.board.recordId} ›
            </button>
          ) : (
            'sheet'
          )}
        </div>
        {linkAffordance(r.board)}
      </>
    )

  /** "picked Sep 9 – Sep 10 by the sub · " when the row's order carries a pick (v2.2928). */
  const pickedLine = (r: SubsRow) => {
    const order = r.board?.commitmentId ? rowsById.get(r.board.commitmentId) : null
    if (!order?.picked_start) return null
    const span = { start: order.picked_start, end: order.picked_end ?? order.picked_start }
    return (
      <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>
        picked {stageWindowLabel(span)} {order.picked_by === 'office' ? 'by the office' : 'by the sub'} ·{' '}
      </span>
    )
  }

  /** The window column: the span and who set it, or the way to set one. */
  const windowCell = (g: SubsJobGroup, r: SubsRow) => {
    const editing = windowEdit && windowEdit.groupKey === g.key && windowEdit.rowKey === r.key
    if (editing) return null
    const w = r.window
    if (w && askState(w as unknown as StageAskWindow) === 'open') {
      const asked = { start: w.asked_start!, end: w.asked_end! }
      const answering = askAnswer && askAnswer.windowId === w.id ? askAnswer : null
      return (
        <div style={{ display: 'grid', gap: 4 }} data-testid="gc-ask">
          <div style={{ fontSize: '0.78rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-amber-800)' }}>GC asked {stageWindowLabel(asked)}</span>
            {w.asked_note ? <span style={{ color: 'var(--text-muted)' }}> · “{w.asked_note}”</span> : null}
            {r.span ? <span style={{ color: 'var(--text-muted)' }}> · now {stageWindowLabel(r.span)}</span> : null}
          </div>
          {answering ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" value={answering.start} onChange={(e) => setAskAnswer({ ...answering, start: e.target.value })} aria-label="Answer start" style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.78rem', background: 'var(--surface)', color: 'var(--text-900)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>to</span>
              <input type="date" value={answering.end} onChange={(e) => setAskAnswer({ ...answering, end: e.target.value })} aria-label="Answer end" style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.78rem', background: 'var(--surface)', color: 'var(--text-900)' }} />
              <input value={answering.note} onChange={(e) => setAskAnswer({ ...answering, note: e.target.value.slice(0, 300) })} placeholder="Why (the GC reads this)" style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.78rem', background: 'var(--surface)', color: 'var(--text-900)', minWidth: 160 }} />
              <button type="button" style={smallBtn('primary', !answering.start || !answering.end || answering.end < answering.start)} disabled={!answering.start || !answering.end || answering.end < answering.start} onClick={() => void answerGcAsk(w, { kind: 'propose', start: answering.start, end: answering.end, note: answering.note }, r.board?.commitmentId ?? null)}>
                Propose
              </button>
              <button type="button" style={smallBtn('ghost')} onClick={() => setAskAnswer(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" style={smallBtn('primary')} onClick={() => void answerGcAsk(w, { kind: 'accept' }, r.board?.commitmentId ?? null)}>
                Accept {stageWindowLabel(asked)}
              </button>
              <button type="button" style={smallBtn('ghost')} onClick={() => setAskAnswer({ windowId: w.id, start: w.window_start ?? asked.start, end: w.window_end ?? asked.end, note: '' })}>
                Answer with…
              </button>
            </div>
          )}
        </div>
      )
    }
    if (r.span) {
      const phase = stageWindowPhase(r.span, today)
      return (
        <>
          <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', background: phase === 'past' ? 'var(--bg-subtle)' : 'var(--bg-green-tint)', color: phase === 'past' ? 'var(--text-muted)' : 'var(--text-green-700)', border: '1px solid var(--border)' }}>
            {stageWindowLabel(r.span)}
          </span>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {pickedLine(r)}
            {stageWindowByLabel(r.window?.window_by)}{phase === 'past' ? ' · passed' : ''}{r.window && askState(r.window as unknown as StageAskWindow) === 'proposed' ? ` · office answered the GC's ask for ${stageWindowLabel({ start: r.window.asked_start!, end: r.window.asked_end! })}` : ''}
            {r.window && g.jobId ? (
              <>
                {' · '}
                <button type="button" style={{ ...door, fontSize: '0.7rem' }} onClick={() => setWindowEdit({ groupKey: g.key, rowKey: r.key, commitmentId: r.board?.commitmentId ?? null, stageId: r.stage?.id ?? null, span: r.span })}>
                  Change
                </button>
              </>
            ) : null}
          </div>
        </>
      )
    }
    if (!g.jobId) return <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>link the job first</span>
    const choices = r.stage ? [r.stage] : g.freeFixtures
    if (choices.length === 0) return <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>no line items to read as a stage</span>
    return (
      <button type="button" style={smallBtn('ghost')} onClick={() => setWindowEdit({ groupKey: g.key, rowKey: r.key, commitmentId: r.board?.commitmentId ?? null, stageId: r.stage?.id ?? null, span: null })}>
        Set a window…
      </button>
    )
  }

  /** The GC column (v2.2933): off for the job, Offer to GC, or Shown · Withdraw. */
  const gcCell = (g: SubsJobGroup, r: SubsRow) => {
    const share = g.jobId ? gcSharing.get(g.jobId) : undefined
    if (!g.jobId) return <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>—</span>
    if (!share) return <span title="Edit Job → GC/Builder → Share stage dates with this GC" style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>off for this job</span>
    if (!r.window) return <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>set a window first</span>
    if (r.window.offered_to_gc) {
      return (
        <>
          <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', border: '1px solid var(--border-green)', whiteSpace: 'nowrap' }}>Shown{r.window.bundle_id ? ' · bundle' : ''}</span>
          <div>
            <button type="button" style={{ ...door, fontSize: '0.7rem' }} onClick={() => void withdrawFromGc(r.window!)}>
              Withdraw
            </button>
          </div>
        </>
      )
    }
    return (
      <button type="button" style={smallBtn('primary')} onClick={() => void offerToGc([r.window!.id], false)} title={`Show this stage and its window on ${share.gcName ?? 'the GC'}'s portal`}>
        Offer to GC
      </button>
    )
  }

  const linkAffordance = (row: WorkOrderBoardRow) =>
    row.notInPipeline ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }} title="This sheet's job number has no Pipeline row">
            Not in Pipeline
          </span>
          <button type="button" style={door} onClick={() => { setLinkSearch(''); setLinkNumber(''); setLinkRow(row) }}>
            Link to a job…
          </button>
          {jobForm ? (
            <button type="button" style={door} onClick={() => newJobForSheet(row)}>
              New job…
            </button>
          ) : null}
        </div>
      ) : null
  /** One column for the money (v2.2963): agreed on top, paid in green, open in red — they read as a stack. */
  const moneyStack = (agreed: number | null, paid: number | null, open: number | null, unpriced: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
      <span>{unpriced ? <span style={{ color: 'var(--text-faint)' }}>unpriced</span> : agreed == null ? <span style={{ color: 'var(--text-faint)' }}>—</span> : money(agreed)}</span>
      <span style={{ color: paid != null && paid > 0 ? 'var(--text-green-700)' : 'var(--text-faint)', fontWeight: paid != null && paid > 0 ? 600 : 400 }}>{paid == null ? '—' : money(paid)}</span>
      <span style={{ color: !unpriced && open != null && open > 0 ? 'var(--text-red-700)' : 'var(--text-faint)', fontWeight: !unpriced && open != null && open > 0 ? 700 : 400 }}>{unpriced || open == null ? '—' : money(open)}</span>
    </div>
  )
  const openCell = (row: WorkOrderBoardRow) => (row.unpriced ? <span style={{ color: 'var(--text-faint)' }}>—</span> : <span style={{ fontWeight: 700, color: row.open > 0 && row.group === 'no_agreement' ? 'var(--text-red-700)' : 'inherit' }}>{money(row.open)}</span>)
  const nextCell = (row: WorkOrderBoardRow) => (
    <>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: row.next.button === 'nudge' || row.next.button === 'reoffer' ? 'var(--text-amber-800)' : 'inherit' }}>{row.next.label}</div>
      {row.next.hint ? <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.next.hint}</div> : null}
    </>
  )

  /** A stage row's own "Where it stands" and "Next" — no rail yet, the order is the next move. */
  const stageStanding = (r: Extract<SubsRow, { kind: 'stage' }>) => (
    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.span ? (stageWindowPhase(r.span, today) === 'past' ? 'Window passed · no order' : 'Window set · no order yet') : 'No window yet'}</span>
  )
  const stageNext = () => (
    <>
      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Draft a work order</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>the window comes along as its dates</div>
    </>
  )
  const stageActions = (r: Extract<SubsRow, { kind: 'stage' }>) => (
    <>
      <button type="button" style={smallBtn('primary')} onClick={() => draftForStage(r)}>
        Draft a work order…
      </button>
      <button type="button" style={smallBtn('ghost')} onClick={() => void removeWindow(r.window, r.stage.name)} title="Clear the window; the line item stays on the job">
        Remove
      </button>
    </>
  )

  const editorFor = (g: SubsJobGroup, rowKey: string | null) => {
    if (!windowEdit || windowEdit.groupKey !== g.key || windowEdit.rowKey !== rowKey || !g.jobId) return null
    const jobId = g.jobId
    const fixed = windowEdit.stageId ? g.rows.find((r) => r.stage?.id === windowEdit.stageId)?.stage ?? null : null
    const choices: SubsStage[] = fixed ? [fixed] : g.freeFixtures
    return (
      <StageWindowEditor
        stages={choices}
        initialStageId={windowEdit.stageId}
        initialSpan={windowEdit.span}
        todayYmd={today}
        saving={windowSaving}
        onSave={(stageId, span) => void saveWindow(jobId, stageId, span, windowEdit.commitmentId)}
        onCancel={() => setWindowEdit(null)}
      />
    )
  }

  const groupHeader = (g: SubsJobGroup) => {
    const adding = windowEdit && windowEdit.groupKey === g.key && windowEdit.rowKey === null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.45rem 0.6rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{g.primary}</span>
          {g.secondary ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> · {g.secondary}</span> : null}
          <span style={{ fontSize: '0.72rem', color: g.attention > 0 ? SHEET_RAIL_GAP : 'var(--text-muted)', marginLeft: 8 }}>
            {g.rows.length} row{g.rows.length === 1 ? '' : 's'}{g.attention > 0 ? ` · ${g.attention} need${g.attention === 1 ? 's' : ''} you` : ''}
          </span>
        </div>
        {g.jobId ? <span style={{ marginLeft: 'auto' }}><JobWatchersPopover jobId={g.jobId} authUserId={authUserId} compact /></span> : null}
        {g.jobId && g.freeFixtures.length > 0 && !adding ? (
          <button type="button" style={{ ...door, marginLeft: g.jobId ? 0 : 'auto' }} onClick={() => setWindowEdit({ groupKey: g.key, rowKey: null, commitmentId: null, stageId: null, span: null })} title="Read one of this job's line items as a stage and give it a window">
            + Add a stage…
          </button>
        ) : null}
        {adding ? <div style={{ flexBasis: '100%' }}>{editorFor(g, null)}</div> : null}
      </div>
    )
  }

  // ── Compact prototype (v2.2963): the Window track + Standing → next ────────────
  /** What one row says about its dates: our window (or the order's proposed span), the sub's pick, an open GC ask, and the GC chip's state. */
  const windowDataFor = (g: SubsJobGroup, r: SubsRow) => {
    const w = r.window
    const order = r.board?.commitmentId ? rowsById.get(r.board.commitmentId) ?? null : null
    const window = r.span ?? (order?.proposed_start && order.proposed_end ? { start: order.proposed_start, end: order.proposed_end } : null)
    const pick = order?.picked_start ? { start: order.picked_start, end: order.picked_end ?? order.picked_start } : null
    const askOpen = !!w && !!w.asked_start && !!w.asked_end && askState(w as unknown as StageAskWindow) === 'open'
    const ask = askOpen && w ? { start: w.asked_start!, end: w.asked_end! } : null
    const share = g.jobId ? gcSharing.get(g.jobId) : undefined
    const gc: WindowGcState = !g.jobId ? 'none' : !share ? 'off' : !w ? 'none' : askOpen ? 'asked' : w.offered_to_gc ? 'shown' : 'offer'
    return { window, pick, ask, gc, gcName: share?.gcName ?? null, order }
  }

  /** The GC chip's Offer: one confirm, then the same write the GC column made. */
  async function offerToGcFromRow(g: SubsJobGroup, r: SubsRow) {
    if (!r.window) return
    const share = g.jobId ? gcSharing.get(g.jobId) : undefined
    const stage = r.stage?.name ?? 'this stage'
    const ok = await confirm({ title: `Show ${stage} on ${share?.gcName ?? "the GC"}'s portal?`, message: `${share?.gcName ?? 'The GC'} will see the stage and its window${r.span ? ` (${stageWindowLabel(r.span)})` : ''} and can ask for other dates. Your orders stay as they are.`, confirmLabel: 'Offer' })
    if (!ok) return
    await offerToGc([r.window.id], false)
  }

  const moveFor = (r: SubsRow): { primary: StandingMove; second: StandingMove | null } =>
    r.kind === 'stage' ? { primary: STAGE_ROW_MOVE, second: null } : standingMovesForRow(r.board, { todayYmd: today, customerName: jobs.find((j) => j.id === r.board.jobId)?.customer_name ?? null })

  /** Every move is a write or a modal this board already has. */
  const runMove = (r: SubsRow, m: StandingMove) => {
    if (r.kind === 'stage') {
      draftForStage(r)
      return
    }
    const row = r.board
    const order = row.commitmentId ? rowsById.get(row.commitmentId) ?? null : null
    switch (m.kind) {
      case 'draft':
        setAssembler({ jobId: row.jobId, laborJobId: row.sheetId, personId: row.personId, amount: row.agreed > 0 ? row.agreed : null, ...stagePrefill(row) })
        return
      case 'price':
      case 'send':
      case 'view':
      case 'resend':
      case 'reoffer':
        if (row.commitmentId) setAssembler({ commitmentId: row.commitmentId })
        return
      case 'nudge':
        if (order) void nudge(order)
        return
      case 'inspection':
        setAddInspectionOpen(true)
        return
      case 'passed':
        if (row.sheetId && onSetSheetStage) void Promise.resolve(onSetSheetStage(row.sheetId, 'customer_pay')).then(() => emitWorkOrderChanged())
        return
      case 'bill':
        if (row.jobId) billCustomerForJob(row.jobId)
        return
      case 'pay':
        if (row.sheetId && onOpenMakePayment) onOpenMakePayment({ id: row.sheetId, contractor: row.subName, hcp: row.jobNumber || '—', totalCost: row.agreed, paid: row.paid, outstanding: Math.max(0, row.open) }, row.open > 0 ? String(row.open) : '')
        return
      default:
        return
    }
  }

  /** The ⋯ menu: what the actions column held, grouped, the destructive one last. */
  const menuFor = (g: SubsJobGroup, r: SubsRow): MoveMenuItem[] => {
    const items: MoveMenuItem[] = []
    if (r.kind === 'stage') {
      items.push({ label: 'Change window…', onClick: () => setWindowEdit({ groupKey: g.key, rowKey: r.key, commitmentId: null, stageId: r.stage.id, span: r.span }) })
      items.push('sep')
      items.push({ label: 'Remove the window', danger: true, onClick: () => void removeWindow(r.window, r.stage.name) })
      return items
    }
    const row = r.board
    const order = row.commitmentId ? rowsById.get(row.commitmentId) ?? null : null
    const c = row.coverage
    if (order && c.kind === 'draft') items.push({ label: 'Open the draft', onClick: () => setAssembler({ commitmentId: order.id }) })
    if (order && c.kind === 'sent') {
      items.push({ label: 'View the offer', onClick: () => setAssembler({ commitmentId: order.id }) })
      items.push({ label: 'Nudge', onClick: () => void nudge(order) })
      items.push({ label: 'Extend +7 days', onClick: () => void extendOffer(order, 7) })
      items.push({ label: 'Signed on paper…', onClick: () => void markSignedOnPaper(order) })
    }
    if (order && (c.kind === 'signed' || c.kind === 'declined')) {
      items.push({ label: 'View the record', onClick: () => setAssembler({ commitmentId: order.id }) })
      items.push({ label: 'Print', onClick: () => print(order) })
    }
    if (row.sheetId) {
      items.push({ label: 'Sheet story', onClick: () => setStorySheetId(row.sheetId) })
      if (onOpenSheet) items.push({ label: 'Open the sheet ›', onClick: () => onOpenSheet(row.sheetId!) })
    }
    if (row.notInPipeline) {
      items.push('sep')
      items.push({
        label: 'Link to a job…',
        onClick: () => {
          setLinkSearch('')
          setLinkNumber('')
          setLinkRow(row)
        },
      })
      if (jobForm) items.push({ label: 'New job…', onClick: () => newJobForSheet(row) })
    }
    if (order && c.kind === 'draft') {
      items.push('sep')
      items.push({ label: 'Discard the draft', danger: true, onClick: () => void discardDraft(order) })
    }
    if (order && c.kind === 'sent') {
      items.push('sep')
      items.push({ label: 'Withdraw', danger: true, onClick: () => void withdraw(order) })
    }
    return items
  }

  const compactTable = (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1040, fontVariantNumeric: 'tabular-nums' }}>
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr>
            <th style={th}>Sub · stage</th>
            <th style={th}>Window</th>
            <th style={{ ...th, textAlign: 'right' }}>
              Agreed
              <span style={{ display: 'block', color: 'var(--text-green-700)' }}>Paid</span>
              <span style={{ display: 'block', color: 'var(--text-red-700)' }}>Open</span>
            </th>
            <th style={th}>Where it stands → next</th>
          </tr>
        </thead>
        <tbody>
          {visibleGroups.map((g) => (
            <FragmentRows key={g.key}>
              <tr>
                <td colSpan={4} style={{ padding: 0 }}>
                  {groupHeader(g)}
                </td>
              </tr>
              {g.rows.map((r) => {
                const editor = editorFor(g, r.key)
                const d = windowDataFor(g, r)
                const mv = moveFor(r)
                const isOpen = trackOpenKey === r.key
                const busy = r.kind === 'sheet' && (busyId === r.board.key || (r.board.commitmentId != null && busyId === r.board.commitmentId))
                const w = r.window
                return (
                  <FragmentRows key={r.key}>
                    <tr>
                      <td style={td}>{firstCell(r)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap', overflow: 'visible' }}>
                        <WindowTextCell
                          window={d.window}
                          passed={d.window ? stageWindowPhase(d.window, today) === 'past' : false}
                          windowBy={w ? (w.window_by === 'gc' ? 'gc' : 'office') : null}
                          pick={d.pick}
                          pickBy={d.order?.picked_start ? (d.order.picked_by === 'office' ? 'office' : 'sub') : null}
                          ask={d.ask && w ? { span: d.ask, note: w.asked_note ?? null } : null}
                          gc={{ state: d.gc, gcName: d.gcName }}
                          onOpenDates={() => setTrackOpenKey(isOpen ? null : r.key)}
                          onChange={w && g.jobId ? () => setWindowEdit({ groupKey: g.key, rowKey: r.key, commitmentId: r.board?.commitmentId ?? null, stageId: r.stage?.id ?? null, span: r.span }) : undefined}
                          onOfferToGc={w ? () => void offerToGcFromRow(g, r) : undefined}
                          onOpenGc={() => setTrackOpenKey(isOpen ? null : r.key)}
                          onAccept={w ? () => void answerGcAsk(w, { kind: 'accept' }, r.board?.commitmentId ?? null) : undefined}
                          onAnswer={
                            w && d.ask
                              ? () => {
                                  setAskAnswer({ windowId: w.id, start: w.window_start ?? d.ask!.start, end: w.window_end ?? d.ask!.end, note: '' })
                                  setTrackOpenKey(r.key)
                                }
                              : undefined
                          }
                          setWindow={windowCell(g, r)}
                          busy={busy}
                        >
                          {isOpen ? (
                            <div role="dialog" aria-label="Window details" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20, minWidth: 320, maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.22)', padding: '0.7rem 0.8rem', display: 'grid', gap: 8 }}>
                              {windowCell(g, r)}
                              {gcCell(g, r)}
                              <button type="button" style={{ ...smallBtn('ghost'), justifySelf: 'end' }} onClick={() => setTrackOpenKey(null)}>
                                Close
                              </button>
                            </div>
                          ) : null}
                        </WindowTextCell>
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.kind === 'stage' ? moneyStack(r.stage.amount > 0 ? r.stage.amount : null, null, null, r.stage.amount <= 0) : moneyStack(r.board.agreed, r.board.paid, r.board.open, r.board.unpriced)}</td>
                      <td style={td}>
                        <StandingMoveCell
                          standing={r.kind === 'stage' ? stageStanding(r) : <SheetRail rail={r.board.rail} labelBelow onClick={r.board.sheetId ? () => setStorySheetId(r.board.sheetId) : undefined} />}
                          primary={mv.primary}
                          second={mv.second}
                          onPrimary={() => runMove(r, mv.primary)}
                          onSecond={mv.second ? () => runMove(r, mv.second!) : undefined}
                          menu={menuFor(g, r)}
                          busy={busy}
                        />
                      </td>
                    </tr>
                    {editor ? (
                      <tr>
                        <td colSpan={4} style={{ ...td, background: 'var(--bg-subtle)' }}>
                          {editor}
                        </td>
                      </tr>
                    ) : null}
                  </FragmentRows>
                )
              })}
            </FragmentRows>
          ))}
        </tbody>
      </table>
    </div>
  )

  /** Everything a tile queue may do — each entry is a write this board already performs (v2.2963). */
  const tileActions: SubsTileActions = {
    changed: () => emitWorkOrderChanged(),
    openAssembler: (initial) => setAssembler(initial),
    withdraw,
    withdrawQuiet,
    nudge,
    markSignedOnPaper,
    print,
    saveWindow,
    removeWindow,
    answerGcAsk: (w, a, c) => answerGcAsk(w, a, c),
    linkSheetToJobQuiet,
    newJobForSheet,
    extendOffer,
    openSheet: onOpenSheet,
    setSheetStage: onSetSheetStage,
    openMakePayment: onOpenMakePayment,
    billCustomer: billCustomerForJob,
    openAddInspection: () => setAddInspectionOpen(true),
  }
  /** Escape / ✕ / backdrop on the queue — ignored while the assembler or the inspection modal sits above it. */
  const closeTile = () => {
    if (assembler != null || addInspectionOpen) return
    setTile(null)
    setSignedMonth(monthOf(today))
  }

  const tiles = (
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: narrow ? 8 : 10, marginBottom: '0.9rem' }}>
      {(
        [
          { key: 'handshake', k: 'On a handshake', v: money(board.tiles.handshakeUsd), red: board.tiles.handshakeUsd > 0, s: `${board.tiles.handshakeCount} sub sheet${board.tiles.handshakeCount === 1 ? '' : 's'} working with nothing signed`, door: 'Get it in writing ›' },
          { key: 'stages', k: 'Stages waiting', v: String(subs.counts.stagesOpen), red: false, s: subs.counts.stagesOpen === 0 ? 'every window has an order behind it' : 'windows with no work order yet', door: 'Put a sub on each ›' },
          { key: 'offers', k: 'Offers out', v: String(board.tiles.offersOut), red: false, s: board.tiles.offersOut === 0 ? 'none waiting on a signature' : 'waiting on a signature', door: 'Chase the signatures ›' },
          { key: 'signed', k: 'Signed this month', v: String(board.tiles.signedThisMonth), red: false, s: board.tiles.signedThisMonth === 0 ? 'the first one starts the record' : 'agreements on file', door: "What's next on each ›" },
        ] as const
      ).map((t) => (
        <button key={t.key} type="button" onClick={() => setTile(t.key)} title={t.door} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: narrow ? '0.45rem 0.65rem' : '0.55rem 0.8rem', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', display: 'block', width: '100%', minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{t.k}</div>
          <div style={{ fontSize: narrow ? '1.05rem' : '1.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: t.red ? 'var(--text-red-700)' : 'inherit' }}>{t.v}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.s}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-blue-700)', fontWeight: 600, marginTop: 3 }}>{t.door}</div>
        </button>
      ))}
    </div>
  )

  const rowEditor = (g: SubsJobGroup, r: SubsRow) => editorFor(g, r.key)

  /** Rare case: several stages on the same dates → one card on the GC portal (v2.2933). */
  const bundleFoot = (g: SubsJobGroup) => {
    if (!g.jobId || !gcSharing.get(g.jobId)) return null
    const candidates = g.rows.filter((r) => r.window && !r.window.offered_to_gc)
    if (candidates.length < 2) return null
    const picking = bundlePick && bundlePick.groupKey === g.key ? bundlePick : null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '0.35rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>Rare case — several stages on the same dates:</span>
        {picking ? (
          <>
            {candidates.map((r) => (
              <label key={r.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-700)' }}>
                <input type="checkbox" checked={picking.ids.has(r.window!.id)} onChange={(e) => setBundlePick({ groupKey: g.key, ids: new Set(e.target.checked ? [...picking.ids, r.window!.id] : [...picking.ids].filter((id) => id !== r.window!.id)) })} />
                {r.stage?.name ?? 'stage'}
              </label>
            ))}
            <button type="button" style={smallBtn('primary', picking.ids.size < 2)} disabled={picking.ids.size < 2} onClick={() => void offerToGc([...picking.ids], true)}>
              Offer {picking.ids.size} together
            </button>
            <button type="button" style={smallBtn('ghost')} onClick={() => setBundlePick(null)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" style={smallBtn('ghost')} onClick={() => setBundlePick({ groupKey: g.key, ids: new Set() })}>
            Offer several together…
          </button>
        )}
      </div>
    )
  }

  const table = (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1160, fontVariantNumeric: 'tabular-nums' }}>
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr>
            <th style={th}>Sub · stage</th>
            <th style={th}>Window</th>
            <th style={{ ...th, textAlign: 'right' }} title="Agreed · Paid (green) · Open (red)">
              Agreed
              <span style={{ display: 'block', color: 'var(--text-green-700)' }}>Paid</span>
              <span style={{ display: 'block', color: 'var(--text-red-700)' }}>Open</span>
            </th>
            <th style={th}>Where it stands</th>
            <th style={th}>Next</th>
            <th style={th}>GC portal</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {visibleGroups.map((g) => (
            <FragmentRows key={g.key}>
              <tr>
                <td colSpan={7} style={{ padding: 0 }}>
                  {groupHeader(g)}
                  {bundleFoot(g)}
                </td>
              </tr>
              {g.rows.map((r) => {
                const editor = rowEditor(g, r)
                return (
                  <FragmentRows key={r.key}>
                    <tr>
                      <td style={td}>{firstCell(r)}</td>
                      <td style={td}>{windowCell(g, r)}</td>
                      {r.kind === 'stage' ? (
                        <>
                          <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{moneyStack(r.stage.amount > 0 ? r.stage.amount : null, null, null, r.stage.amount <= 0)}</td>
                          <td style={td}>{stageStanding(r)}</td>
                          <td style={td}>{stageNext()}</td>
                          <td style={td}>{gcCell(g, r)}</td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>{stageActions(r)}</div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{moneyStack(r.board.agreed, r.board.paid, r.board.open, r.board.unpriced)}</td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>
                            <SheetRail rail={r.board.rail} labelBelow onClick={r.board.sheetId ? () => setStorySheetId(r.board.sheetId) : undefined} />
                          </td>
                          <td style={td}>{nextCell(r.board)}</td>
                          <td style={td}>{gcCell(g, r)}</td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                              {primaryAction(r.board)}
                              {secondaryActions(r.board)}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                    {editor ? (
                      <tr>
                        <td colSpan={7} style={{ ...td, background: 'var(--bg-subtle)' }}>{editor}</td>
                      </tr>
                    ) : null}
                  </FragmentRows>
                )
              })}
            </FragmentRows>
          ))}
        </tbody>
      </table>
    </div>
  )

  const label = (t: string) => <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{t}</div>
  const cards = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {visibleGroups.map((g) => (
        <div key={g.key} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {groupHeader(g)}
          {bundleFoot(g)}
          {g.rows.map((r) => (
            <div key={r.key} style={{ padding: '0.6rem 0.7rem', borderTop: '1px solid var(--border)', display: 'grid', gap: 6 }}>
              <div>{firstCell(r)}</div>
              <div>
                {label('Window')}
                {windowCell(g, r)}
                {rowEditor(g, r)}
              </div>
              <div>
                {label('GC portal')}
                {gcCell(g, r)}
              </div>
              {r.kind === 'stage' ? (
                <>
                  <div style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>{label('Agreed')}{r.stage.amount > 0 ? money(r.stage.amount) : <span style={{ color: 'var(--text-faint)' }}>unpriced</span>}</div>
                  <div>{stageStanding(r)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 auto' }}>{stageNext()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{stageActions(r)}</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                    <div>{label('Agreed')}{r.board.unpriced ? <span style={{ color: 'var(--text-faint)' }}>unpriced</span> : money(r.board.agreed)}</div>
                    <div>{label('Paid')}{money(r.board.paid)}</div>
                    <div>{label('Open')}{openCell(r.board)}</div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <SheetRail rail={r.board.rail} compact labelBelow onClick={r.board.sheetId ? () => setStorySheetId(r.board.sheetId) : undefined} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 auto' }}>{nextCell(r.board)}</div>
                    {primaryAction(r.board)}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{secondaryActions(r.board)}</div>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  /** + New work order, the search box and the rail-group chips — inline above the board, or on the Work / Pay row when a host is given. */
  const toolbar = (
    <>
      <button type="button" style={{ ...smallBtn('primary'), padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }} onClick={() => setAssembler({})}>
        + New work order
      </button>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search job, sub, customer, or WO number"
        style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', flex: '1 1 220px', minWidth: 160, fontSize: '0.8125rem', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {WORK_ORDER_BOARD_FILTERS.map((f) => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: active ? '1px solid #2563eb' : '1px solid var(--border-strong)',
                background: active ? '#2563eb' : 'var(--surface)',
                color: active ? 'white' : 'var(--text-700)',
              }}
            >
              {f.label} <span style={{ opacity: 0.75 }}>{board.counts[f.key]}</span>
            </button>
          )
        })}
      </div>
      {canPrototype ? (
        <div role="tablist" aria-label="Board layout" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', marginLeft: 4 }}>
          {(['classic', 'compact'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={layout === k}
              title={k === 'compact' ? 'Prototype: the Window track and Standing → next in one cell' : "Today's board"}
              onClick={() => {
                setLayout(k)
                try {
                  localStorage.setItem(LAYOUT_KEY, k)
                } catch {
                  /* per-viewer convenience only */
                }
              }}
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: layout === k ? 'var(--bg-subtle)' : 'var(--surface)', color: layout === k ? 'var(--text-base)' : 'var(--text-muted)' }}
            >
              {k === 'classic' ? 'Classic' : 'Compact · prototype'}
            </button>
          ))}
        </div>
      ) : null}
    </>
  )

  return (
    <div>
      {tiles}
      {toolbarHost === undefined ? <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>{toolbar}</div> : toolbarHost ? createPortal(toolbar, toolbarHost) : null}

      {error ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p> : null}

      {loading || jobsLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading work orders…</p>
      ) : subs.groups.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing on the board — every sub sheet is either paid up or has an agreement behind it, and no stage has a window. Draft a work order with + New work order, or open a job's line items as stages from its Edit Job form's job number here.</p>
      ) : visibleRowCount === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing matches this filter.</p>
      ) : narrow ? (
        cards
      ) : canPrototype && layout === 'compact' ? (
        compactTable
      ) : (
        table
      )}

      <p style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Crew pay sheets (a teammate on the sheet) never need a work order and are not listed here — they carry their own label on the Pay view. A stage is one of the job's line items with a window; it stays a row of its own until a work order fulfils it.
      </p>

      {linkRow ? (
        <ScheduleDispatchAssignJobPickerModal
          open
          onClose={() => setLinkRow(null)}
          title={`Which job is the ${linkRow.subName} sheet for?`}
          subtitle={`Sheet #${linkRow.jobNumber || '—'} · ${linkRow.secondary ?? ''} — pick the Pipeline job it belongs to`}
          jobRows={subLaborAssignPickerRows(jobs, linkSearch, linkNumber)}
          searchValue={linkSearch}
          onSearchChange={setLinkSearch}
          numberQuery={linkNumber}
          onNumberQueryChange={setLinkNumber}
          searchPlaceholder="Search job # / name / address / customer"
          onPickJob={(jobId) => void linkSheetToJob(linkRow, jobId)}
        />
      ) : null}

      {tile === 'handshake' ? <HandshakeQueue board={board.rows} jobs={jobs} contacts={contacts} authUserId={authUserId} todayYmd={today} actions={tileActions} onClose={closeTile} /> : null}
      {tile === 'stages' ? <StagesQueue groups={subs.groups} jobs={jobs} subs={pickerSubs} contacts={contacts} orders={availability.orders} offDaysByPerson={availability.offDays} availabilityLoading={availability.loading} authUserId={authUserId} todayYmd={today} actions={tileActions} onClose={closeTile} /> : null}
      {tile === 'offers' ? <OffersQueue board={board.rows} ordersById={rowsById} stageByOrderId={stageByOrderId} jobs={jobs} contacts={contacts} visits={visits} authUserId={authUserId} todayYmd={today} actions={tileActions} onClose={closeTile} /> : null}
      {tile === 'signed' ? <SignedQueue key={signedMonth} board={board.rows} ordersById={rowsById} stageByOrderId={stageByOrderId} jobs={jobs} month={signedMonth} currentMonth={monthOf(today)} onMonthChange={setSignedMonth} actions={tileActions} onClose={closeTile} /> : null}
      <AddInspectionModal
        open={addInspectionOpen}
        onClose={() => setAddInspectionOpen(false)}
        onSaved={() => {
          setAddInspectionOpen(false)
          emitWorkOrderChanged()
        }}
        authUserId={authUserId ?? null}
      />
      <WorkOrderAssemblerModal open={assembler != null} onClose={() => setAssembler(null)} jobs={jobs} initial={assembler} authUserId={authUserId} onChanged={() => void load()} />
      <SheetStoryModal sheetId={storySheetId} onClose={() => setStorySheetId(null)} jobs={jobs} authUserId={authUserId} onOpenSheet={onOpenSheet} onSheetChanged={() => void load()} />
    </div>
  )
}

/** A keyed fragment for table groups (React.Fragment with a key, named for readability). */
function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export default JobsSubsWorkView
