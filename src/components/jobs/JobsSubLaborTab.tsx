import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { buildJobWorkOrderCoverage, type JobWorkOrderCoverage, type WorkOrderRowLike } from '../../lib/subWorkOrders/workOrderCoverage'
import { buildSheetRail, sheetNextAction, type SheetNextAction, type SheetRail as SheetRailShape } from '../../lib/subWorkOrders/sheetRail'
import { isRosterSubSheet, type NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/sheetsNeedingWorkOrder'
import { sheetParties, type SheetParties } from '../../lib/subWorkOrders/sheetParties'
import { buildSubLaborPayRun, payRunFilterMatches, sheetPayWhen, PAY_RUN_FILTERS, PAY_RUN_FILTER_HINT, PAY_RUN_FILTER_LABEL, PAY_RUN_SEGMENTS, PAY_RUN_SEGMENT_LABEL, type PayRunFilter, type PayRunSegment, type PayRunSub, type SheetPayWhen } from '../../lib/subWorkOrders/subLaborPayRun'
import { SHEET_RAIL_GAP } from '../../lib/subWorkOrders/sheetRailTone'
import { normalizePersonNameKey } from '../../lib/personNameKey'
import { useRosterSubKinds } from '../../hooks/useRosterSubKinds'
import { emitWorkOrderChanged, WORK_ORDER_CHANGED_EVENT } from '../../hooks/useJobWorkOrderCoverage'
import { SheetRail } from './SheetRail'
import { SheetStoryModal } from './SheetStoryModal'
import { LienWaiverSendModal, type LienWaiverSendTarget } from './LienWaiverSendModal'
import { WorkOrderAssemblerModal, type WorkOrderAssemblerInitial } from './WorkOrderAssemblerModal'
import SubPortalGlobeButton from '../people/SubPortalGlobeButton'
import { SubPortalVisitLine } from '../people/SubPortalVisitLine'
import { SubPortalVisitsModal } from '../people/SubPortalVisitsModal'
import { useSubPortalVisitSummaries } from '../../hooks/useSubPortalVisitSummaries'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { effectiveSubSheetStage, SUB_SHEET_STAGE_AUTO_REASON_LABEL, subSheetWorkEndYmd } from '../../lib/subSheetStageDerived'
import {
  SUB_SHEET_STAGES,
  SUB_SHEET_STAGE_HINT,
  SUB_SHEET_STAGE_LABEL,
  SUB_SHEET_STAGE_TONE,
  nextSubSheetStage,
  normalizeSubSheetStage,
  normalizeSubSheetStageSource,
  subSheetStageStamp,
  type SubSheetStage,
  type SubSheetStageTone,
} from '../../lib/subSheetStage'
import { AmountSmallCents } from '../AmountSmallCents'
import { lineLaborCost } from '../../lib/peopleLaborJobItemLineCost'
import { normalizeUrl } from '../../lib/projectsForecastStageLineItems'
import {
  subLaborJobBalance,
  subLaborJobMatchesSearch,
  type SubLaborOutstandingByPerson,
  type SubLaborSheetAssignee,
} from '../../lib/subLaborOutstanding'
import type {
  LaborJob,
  SubLaborBackchargeTarget,
  SubLaborPaymentTarget,
} from '../../types/laborJob'

export type JobsSubLaborTabProps = {
  error: string | null
  subLaborSearch: string
  onSubLaborSearchChange: (value: string) => void
  laborJobs: LaborJob[]
  laborJobsLoading: boolean
  laborJobNamesByHcp: Record<string, string>
  /** Pipeline jobs — job-anchored work orders cover every sheet on their job; the assembler needs the list. */
  jobs: JobWithDetails[]
  authUserId: string | undefined
  /** Junction assignees per sheet — with the roster, tells a crew pay sheet from a sub sheet. */
  laborJobAssigneesByJobId: ReadonlyMap<string, readonly SubLaborSheetAssignee[]>
  subLaborDueTotal: number
  /** Still passed by Jobs.tsx (its header total); the pay run here groups on its own. */
  subLaborOutstandingByPerson?: SubLaborOutstandingByPerson
  onNewLaborJob: () => void
  onEditLaborJob: (job: LaborJob) => void
  onPrintJobSubSheet: (job: LaborJob) => void
  onUpdateLaborJobDate: (id: string, date: string | null) => void
  /** Move a sheet's stage (v2.2767) — either direction; the trigger posts the Activity line. */
  onSetLaborJobStage: (id: string, stage: SubSheetStage) => void | Promise<unknown>
  /** Seed + open the parent-owned Make Payment modal. */
  onOpenMakePayment: (target: SubLaborPaymentTarget, defaultAmount: string) => void
  /** Seed + open the parent-owned Backcharge modal. */
  onOpenBackcharge: (target: SubLaborBackchargeTarget) => void
  /** The sheet story changed a stage or a payable-after date — reload the ledger. */
  onReloadLaborJobs?: () => void
}

export default function JobsSubLaborTab({
  error,
  subLaborSearch,
  onSubLaborSearchChange,
  laborJobs,
  laborJobsLoading,
  laborJobNamesByHcp,
  jobs,
  authUserId,
  laborJobAssigneesByJobId,
  subLaborDueTotal,
  onNewLaborJob,
  onEditLaborJob,
  onPrintJobSubSheet,
  onUpdateLaborJobDate,
  onSetLaborJobStage,
  onOpenMakePayment,
  onOpenBackcharge,
  onReloadLaborJobs,
}: JobsSubLaborTabProps) {
  const [expandedSubLaborJobIds, setExpandedSubLaborJobIds] = useState<Set<string>>(new Set())
  const [stageMenuJobId, setStageMenuJobId] = useState<string | null>(null)
  /** Every live work order (one-row spine, PR 4): sheet-anchored ones cover their sheet, job-anchored ones every sheet on the job. */
  const [commitments, setCommitments] = useState<WorkOrderRowLike[]>([])
  const loadCommitments = useCallback(async () => {
    const { data, error } = await supabase
      .from('step_commitments')
      .select('id, status, amount, display_name, job_id, labor_job_id, step_id, record_id, offered_at, offer_expires_at, signed_at, accepted_at, declined_at, decline_reason, created_at, person_id, picked_end, proposed_end')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) return
    setCommitments((data ?? []) as WorkOrderRowLike[])
  }, [])
  useEffect(() => {
    void loadCommitments()
    const onChanged = () => void loadCommitments()
    window.addEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
  }, [loadCommitments])
  const { roster } = useRosterSubKinds()
  const [assembler, setAssembler] = useState<WorkOrderAssemblerInitial | null>(null)
  const [storySheetId, setStorySheetId] = useState<string | null>(null)
  /** Send a lien waiver from a pay row (v2.2970): the sheet + job facts the picker seeds into the form. */
  const [lienWaiverFor, setLienWaiverFor] = useState<LienWaiverSendTarget | null>(null)
  useEffect(() => {
    if (!stageMenuJobId) return
    const close = () => setStageMenuJobId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [stageMenuJobId])
  const [filter, setFilter] = useState<PayRunFilter>('due')
  /** The ⋯ menu open on one ledger row. */
  const [menuJobId, setMenuJobId] = useState<string | null>(null)
  /** Inline payable-after editor on one row. */
  const [payableEdit, setPayableEdit] = useState<{ id: string; value: string } | null>(null)
  const [payableBusy, setPayableBusy] = useState(false)
  const [payRunDay, setPayRunDay] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const today = todayYmdInAppTz()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('app_settings').select('key, value_text').eq('key', 'sub_pay_run_day').maybeSingle()
      if (!cancelled) setPayRunDay(((data as { value_text?: string | null } | null)?.value_text ?? '').trim() || null)
    })()
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    if (!menuJobId) return
    const close = () => setMenuJobId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuJobId])
  useEffect(() => {
    if (!focusKey) return
    const t = window.setTimeout(() => setFocusKey(null), 2600)
    return () => window.clearTimeout(t)
  }, [focusKey])

  const spine = useMemo(() => {
    const personById = new Map(roster.map((p) => [p.id, p]))
    const personByNameKey = new Map<string, NeedsWorkOrderRosterPerson>()
    for (const p of roster) {
      const k = normalizePersonNameKey(p.name)
      if (k && !personByNameKey.has(k)) personByNameKey.set(k, p)
    }
    const jobsByNumber = new Map(jobs.map((j) => [j.hcp_number.trim().toLowerCase(), j]))
    const bySheet = new Map<string, WorkOrderRowLike[]>()
    const byJob = new Map<string, WorkOrderRowLike[]>()
    for (const r of commitments) {
      if (r.labor_job_id) bySheet.set(r.labor_job_id, [...(bySheet.get(r.labor_job_id) ?? []), r])
      else if (r.job_id) byJob.set(r.job_id, [...(byJob.get(r.job_id) ?? []), r])
    }
    const assigneeIds = new Map<string, string[]>()
    for (const [id, list] of laborJobAssigneesByJobId) assigneeIds.set(id, list.map((a) => a.personId))
    return { personById, personByNameKey, jobsByNumber, bySheet, byJob, assigneeIds }
  }, [roster, jobs, commitments, laborJobAssigneesByJobId])

  /** The rail, the office's next move, who the sheet is for, and the rule its money is under — one call per row. */
  const spineFor = useCallback(
    (job: LaborJob, bal: { totalCost: number; paid: number; backcharges: number; balance: number }): { coverage: JobWorkOrderCoverage; rail: SheetRailShape; next: SheetNextAction; crew: boolean; jobId: string | null; personId: string | null; parties: SheetParties; payWhen: SheetPayWhen; stageView: LaborJob } => {
      const pipelineJob = spine.jobsByNumber.get((job.job_number ?? '').trim().toLowerCase()) ?? null
      const covering = [...(spine.bySheet.get(job.id) ?? []), ...(pipelineJob ? (spine.byJob.get(pipelineJob.id) ?? []) : [])]
      const coverage = buildJobWorkOrderCoverage(covering, today)
      // Crew pay for the rail (four dots, no agreement needed): any teammate on the sheet — the standing rule.
      const crewRail = roster.length > 0 && !isRosterSubSheet(job, spine.assigneeIds, spine.personById, spine.personByNameKey)
      const unpriced = bal.totalCost === 0 && bal.paid === 0 && bal.backcharges === 0
      const open = Math.max(0, bal.balance)
      // The stage the facts already know (v2.3064): 100% from the portal or an ended signed window → Waiting on inspection, unless hand-nudged back after.
      const eff = effectiveSubSheetStage({ stage: job.stage, stageSource: job.stage_source, stageChangedAt: job.stage_changed_at ?? null, progressPct: job.progress_pct ?? null, progressAt: job.progress_at ?? null, workEndYmd: subSheetWorkEndYmd(covering), todayYmd: today })
      const stageView: LaborJob = eff.derived ? { ...job, stage: eff.stage, stage_source: 'auto', stage_changed_at: eff.changedAt, stage_changed_by: null, stage_changed_by_name: null, stage_note: null, stage_auto_reason: eff.reason } : job
      const rail = buildSheetRail({ coverage, sheetStage: eff.stage, payableAfter: job.payable_after ?? null, agreed: bal.totalCost, open, unpriced, crewPay: crewRail })
      // Subs-only naming: the sheet is the roster sub's; teammates ride along as "with …". No sub at all = a crew sheet.
      const parties = sheetParties(job, laborJobAssigneesByJobId.get(job.id), spine)
      const crew = roster.length > 0 && parties.crew
      const next = sheetNextAction(rail, coverage, { subName: parties.label || job.assigned_to_name, agreed: bal.totalCost, open, unpriced, todayYmd: today })
      const ids = spine.assigneeIds.get(job.id) ?? []
      const personId = ids.length === 1 ? ids[0]! : null
      const inv = pipelineJob?.invoices ?? null
      const bills = pipelineJob ? { out: (inv ?? []).filter((i) => i.status && i.status !== 'draft').length, paid: (inv ?? []).filter((i) => i.status === 'paid').length } : null
      const payWhen = sheetPayWhen({ stage: eff.stage, payableAfter: job.payable_after ?? null, payHoldReason: job.pay_hold_reason ?? null, bills, gap: rail.gap, crew, balance: bal.balance, unpriced, todayYmd: today })
      return { coverage, rail, next, crew, jobId: pipelineJob?.id ?? null, personId, parties, payWhen, stageView }
    },
    [spine, roster.length, today, laborJobAssigneesByJobId],
  )

  /** Every sheet the search leaves, with its balance and its spine. */
  const rows = useMemo(
    () =>
      laborJobs
        .filter((job) => subLaborJobMatchesSearch(job, subLaborSearch, laborJobNamesByHcp))
        .map((job) => {
          const bal = subLaborJobBalance(job)
          return { job, ...bal, ...spineFor(job, bal) }
        }),
    [laborJobs, subLaborSearch, laborJobNamesByHcp, spineFor],
  )
  type LedgerRow = (typeof rows)[number]
  const rowById = useMemo(() => new Map(rows.map((r) => [r.job.id, r])), [rows])

  /** The pay run: tiles + one row per sub. */
  const payRun = useMemo(
    () =>
      buildSubLaborPayRun(
        rows.map((r) => ({ id: r.job.id, subKey: r.parties.key || normalizePersonNameKey(r.job.assigned_to_name), subName: r.parties.label || r.job.assigned_to_name, personId: !r.crew && r.parties.contractors.length === 1 ? (r.parties.contractors[0]!.id ?? null) : null, teammates: r.parties.teammates.map((p) => p.name).filter(Boolean), crew: r.crew, balance: r.balance, payWhen: r.payWhen })),
        { payRunDay, todayYmd: today },
      ),
    [rows, payRunDay, today],
  )
  const crewOpen = useMemo(() => rows.filter((r) => r.crew && r.balance > 0).reduce((n, r) => n + r.balance, 0), [rows])

  // Did the sub look? One RPC for every sub on the run; the line under the name opens the trail.
  const visitPersonIds = useMemo(() => payRun.subs.map((s) => s.personId).filter((id): id is string => !!id), [payRun.subs])
  const visits = useSubPortalVisitSummaries(visitPersonIds)
  const [visitsFor, setVisitsFor] = useState<{ personId: string; name: string } | null>(null)

  /** The ledger: rows the chip leaves, grouped under their sub in the pay run's order, payable first inside a group. */
  const groups = useMemo(() => {
    const order = new Map(payRun.subs.map((s, i) => [s.key, i]))
    const byKey = new Map<string, LedgerRow[]>()
    for (const r of rows) {
      if (!payRunFilterMatches(filter, r.payWhen)) continue
      const k = r.parties.key || normalizePersonNameKey(r.job.assigned_to_name)
      byKey.set(k, [...(byKey.get(k) ?? []), r])
    }
    return [...byKey.entries()]
      .sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999))
      .map(([key, list]) => ({
        key,
        sub: payRun.subs.find((s) => s.key === key) ?? null,
        rows: list.sort((a, b) => a.payWhen.rank - b.payWhen.rank || b.balance - a.balance || (a.job.job_number ?? '').localeCompare(b.job.job_number ?? '')),
      }))
  }, [rows, filter, payRun.subs])

  const groupDomId = (key: string) => `sublabor-group-${encodeURIComponent(key).replace(/%/g, '_')}`

  /** What the lien-waiver picker needs from a row: the sub, the sheet's payments and balance, and the pipeline job's owner and address. */
  function lienWaiverTarget(r: LedgerRow): LienWaiverSendTarget {
    const pipelineJob = r.jobId ? jobs.find((j) => j.id === r.jobId) ?? null : null
    const subName = (r.parties.contractors[0]?.name ?? r.parties.label ?? r.job.assigned_to_name ?? '').trim() || r.job.assigned_to_name
    return {
      sheetId: r.job.id,
      personId: r.personId,
      subName,
      sheetLabel: r.job.job_number?.trim() || 'Sheet',
      jobNumber: r.job.job_number?.trim() || null,
      clickNumber: pipelineJob?.click_number ? `J${pipelineJob.click_number}` : null,
      project: (pipelineJob?.job_name ?? r.job.project_name ?? laborJobNamesByHcp[(r.job.job_number ?? '').trim()] ?? '').trim() || null,
      owner: (pipelineJob?.customer_name ?? '').trim() || null,
      location: (pipelineJob?.job_address ?? r.job.address ?? '').trim() || null,
      payments: (r.job.payments ?? []).map((p) => ({ amount: Number(p.amount) || 0, payment_date: p.payment_date ?? null, created_at: p.created_at })),
      balance: r.balance,
    }
  }
  function payTarget(r: LedgerRow): SubLaborPaymentTarget {
    return { id: r.job.id, contractor: r.job.assigned_to_name, hcp: r.job.job_number ?? '—', totalCost: r.totalCost, paid: r.paid, outstanding: Math.max(0, r.balance) }
  }
  /** Pay from the top: Make Payment on the sub's biggest ready sheet; the button moves to the next one after. */
  function payReady(sub: PayRunSub) {
    const first = sub.readySheetIds.map((id) => rowById.get(id)).find(Boolean)
    if (!first) return
    onOpenMakePayment(payTarget(first), first.balance > 0 ? String(first.balance) : '')
  }
  function draftFor(sub: PayRunSub) {
    const r = rows.filter((x) => (x.parties.key || normalizePersonNameKey(x.job.assigned_to_name)) === sub.key && x.rail.gap).sort((a, b) => b.balance - a.balance)[0]
    if (!r) return
    setAssembler({ jobId: r.jobId, laborJobId: r.job.id, personId: r.personId, amount: r.totalCost > 0 ? r.totalCost : null })
  }
  function jumpTo(key: string) {
    setFilter('due')
    setFocusKey(key)
    window.setTimeout(() => document.getElementById(groupDomId(key))?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 30)
  }
  async function savePayableAfter(id: string, value: string | null) {
    setPayableBusy(true)
    try {
      const { error: err } = await supabase.from('people_labor_jobs').update({ payable_after: value }).eq('id', id)
      if (err) throw err
      setPayableEdit(null)
      onReloadLaborJobs?.()
    } finally {
      setPayableBusy(false)
    }
  }

  const tileStyle = (tone?: 'ready' | 'blocked'): CSSProperties => ({
    border: `1px solid ${tone === 'ready' ? 'var(--border-green)' : 'var(--border)'}`,
    borderRadius: 8,
    padding: '0.55rem 0.85rem',
    background: tone === 'ready' ? 'var(--bg-green-tint)' : 'var(--bg-subtle)',
    minWidth: 0,
  })
  const btnPay: CSSProperties = { padding: '0.3rem 0.7rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }
  const btnBlue: CSSProperties = { padding: '0.3rem 0.7rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }
  const btnGhost: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.75rem' }
  const menuItem: CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.7rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'inherit' }
  const SEGMENT_COLOR: Record<PayRunSegment, string> = { ready: '#059669', queued: '#6ee7b7', wait: '#d97706', work: 'var(--text-faint)', hold: '#dc2626', gap: 'repeating-linear-gradient(45deg, #dc2626 0 4px, transparent 4px 8px)' }
  const TONE: Record<SheetPayWhen['tone'], { bg: string; fg: string }> = {
    green: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)' },
    blue: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-700)' },
    amber: { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)' },
    red: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)' },
    violet: { bg: 'var(--bg-violet-100)', fg: 'var(--text-violet-700)' },
    gray: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' },
  }
  const tag = (label: string, tone: SheetPayWhen['tone'], title?: string) => (
    <span title={title} style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: TONE[tone].bg, color: TONE[tone].fg, whiteSpace: 'nowrap' }}>{label}</span>
  )

  return (
    <div>
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={onNewLaborJob} style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>
            New Sub Labor
          </button>
          <input
            type="search"
            placeholder="Search contractor, HCP, address…"
            value={subLaborSearch}
            onChange={(e) => onSubLaborSearchChange(e.target.value)}
            style={{ flex: '1 1 240px', minWidth: 200, padding: '0.4rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 600 }}>
          Sub Labor Due: <AmountSmallCents value={subLaborDueTotal} />
        </div>
      </div>

      {/* The Friday question — four tiles from what the sheets already store. */}
      {!laborJobsLoading && laborJobs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: '1.1rem' }}>
          <div style={tileStyle()}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>Owed to subs</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}><AmountSmallCents value={payRun.tiles.owed} /></div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {payRun.tiles.owedSubs} sub{payRun.tiles.owedSubs === 1 ? '' : 's'} · {payRun.tiles.owedSheets} sheet{payRun.tiles.owedSheets === 1 ? '' : 's'}
              {crewOpen > 0 ? <> · + <AmountSmallCents value={crewOpen} /> crew pay via payroll</> : null}
            </div>
          </div>
          <div style={tileStyle('ready')}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>Ready to pay now</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-green-700)' }}><AmountSmallCents value={payRun.tiles.ready} /></div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{payRun.tiles.readySheets} sheet{payRun.tiles.readySheets === 1 ? '' : 's'} · customer paid or date reached</div>
          </div>
          <div style={tileStyle()}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>{payRun.tiles.queuedDayLabel ? `Queued for ${payRun.tiles.queuedDayLabel}` : 'Queued for the pay run'}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}><AmountSmallCents value={payRun.tiles.queued} /></div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {payRun.tiles.queuedSheets} sheet{payRun.tiles.queuedSheets === 1 ? '' : 's'} · payable-after set
              {!payRunDay ? <> · <span title="Settings → Sub portal → pay-run day">no pay-run day set</span></> : null}
            </div>
          </div>
          <div style={tileStyle('blocked')}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>Not payable yet</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-red-700)' }}><AmountSmallCents value={payRun.tiles.blocked} /></div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{payRun.tiles.blockedReasons.length > 0 ? payRun.tiles.blockedReasons.join(' · ') : 'nothing blocked'}</div>
          </div>
        </div>
      )}

      {/* Who's owed — name first, the bar is the reason, Pay from the top. */}
      {!laborJobsLoading && laborJobs.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Who's owed</div>
          {payRun.subs.filter((s) => s.owed > 0 || s.crew).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>All contractors are paid up.</p>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {payRun.subs
                .filter((s) => s.owed > 0 || s.crew)
                .map((s) => {
                  const segs = PAY_RUN_SEGMENTS.filter((k) => s.segments[k] > 0)
                  return (
                    <div key={s.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.3fr) 120px minmax(200px, 2fr) auto', gap: 14, alignItems: 'center', padding: '0.55rem 0.85rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <button type="button" onClick={() => jumpTo(s.key)} title="Jump to their sheets" style={{ ...btnGhost, fontSize: '0.875rem', color: 'inherit', textAlign: 'left' }}>
                          {s.name.trim() || <span style={{ color: 'var(--text-muted)' }}>(No name)</span>}
                        </button>
                        {s.personId ? <span style={{ marginLeft: 6, verticalAlign: 'middle' }} title="Their portal — the page this money reads from"><SubPortalGlobeButton personId={s.personId} personName={s.name} size={14} /></span> : null}
                        {s.crew ? <span style={{ marginLeft: 6 }}>{tag('Crew pay', 'violet', 'No roster sub on these sheets — pays through payroll')}</span> : null}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {s.sheetCount} sheet{s.sheetCount === 1 ? '' : 's'}
                          {s.teammates.length > 0 ? ` · with ${s.teammates.join(', ')}` : ''}
                        </div>
                        {s.personId ? <SubPortalVisitLine summary={visits.byPerson.get(s.personId)} onOpen={() => setVisitsFor({ personId: s.personId!, name: s.name })} /> : null}
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 700, color: s.owed > 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{s.owed > 0 ? <AmountSmallCents value={s.owed} /> : '—'}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden', background: 'var(--border)' }} title={segs.map((k) => `${PAY_RUN_SEGMENT_LABEL[k]} $${formatCurrency(s.segments[k])}`).join(' · ')}>
                          {s.crew ? <i style={{ display: 'block', height: '100%', width: '100%', background: SEGMENT_COLOR.work }} /> : segs.map((k) => <i key={k} style={{ display: 'block', height: '100%', width: `${(s.segments[k] / s.owed) * 100}%`, background: SEGMENT_COLOR[k] }} />)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{s.whyNot}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {s.action.kind === 'pay' ? (
                          <button type="button" style={btnPay} onClick={() => payReady(s)} title={s.action.sheets > 1 ? `${s.action.sheets} sheets are ready — opens the biggest first; the button moves to the next one after` : 'Opens Make Payment on the ready sheet'}>
                            Pay <AmountSmallCents value={s.action.amount} />{s.action.sheets > 1 ? ` · ${s.action.sheets} sheets` : ''}
                          </button>
                        ) : s.action.kind === 'draft' ? (
                          <button type="button" style={btnBlue} onClick={() => draftFor(s)}>Draft a work order…</button>
                        ) : (
                          s.action.text
                        )}
                      </div>
                    </div>
                  )
                })}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '0.4rem 0.85rem', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>
                {PAY_RUN_SEGMENTS.map((k) => (
                  <span key={k}><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 4, verticalAlign: -1, background: SEGMENT_COLOR[k] }} />{PAY_RUN_SEGMENT_LABEL[k]}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter chips with counts — "All due" is the old "Only show due". */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
        {PAY_RUN_FILTERS.map((f) => {
          const on = filter === f
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              title={PAY_RUN_FILTER_HINT[f]}
              onClick={() => setFilter(f)}
              style={{ border: `1px solid ${on ? 'var(--text-700)' : 'var(--border-strong)'}`, background: on ? 'var(--text-700)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text-700)', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {PAY_RUN_FILTER_LABEL[f]} <span style={{ opacity: 0.7 }}>{payRun.counts[f]}</span>
            </button>
          )
        })}
      </div>

      {laborJobsLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading sub sheet ledger…</p>
      ) : laborJobs.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No jobs yet. Click New Sub Labor to add one.</p>
      ) : groups.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{filter === 'due' ? 'No payments due.' : filter === 'gap' ? 'Every sub sheet with money open has an agreement behind it.' : filter === 'ready' ? 'Nothing is ready to pay right now.' : 'No matching sheets.'}</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
          <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.6rem 0.75rem', width: 32, borderBottom: '1px solid var(--border)' }} />
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Agreed</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Paid</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Due</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Where it stands</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Pay when</th>
                <th style={{ padding: '0.6rem 0.75rem', width: 44, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((g) => {
                const sub = g.sub
                const focused = focusKey === g.key
                const header = (
                  <tr key={`g-${g.key}`} id={groupDomId(g.key)} style={{ background: 'var(--bg-subtle)', boxShadow: focused ? 'inset 4px 0 0 #b5651d' : undefined, transition: 'box-shadow 0.3s' }}>
                    <td colSpan={8} style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>{sub?.name.trim() || g.rows[0]!.parties.label || g.rows[0]!.job.assigned_to_name || <span style={{ color: 'var(--text-muted)' }}>(No name)</span>}</span>
                        {sub?.personId ? <span title="Their portal" style={{ display: 'inline-flex' }}><SubPortalGlobeButton personId={sub.personId} personName={sub.name} size={14} /></span> : null}
                        {sub?.crew ? tag('Crew pay', 'violet', 'No roster sub on these sheets — pays through payroll') : null}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {g.rows.length} sheet{g.rows.length === 1 ? '' : 's'}
                          {sub && sub.teammates.length > 0 ? ` · with ${sub.teammates.join(', ')}` : ''}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: sub && sub.owed > 0 ? 'var(--text-red-700)' : 'var(--text-muted)', fontWeight: 600 }}>{sub && sub.owed > 0 ? <>owed <AmountSmallCents value={sub.owed} /></> : sub?.crew ? 'payroll' : 'paid up'}</span>
                        {sub?.action.kind === 'pay' ? (
                          <button type="button" style={{ ...btnPay, padding: '0.2rem 0.6rem' }} onClick={() => payReady(sub)}>
                            Pay <AmountSmallCents value={sub.action.amount} />{sub.action.sheets > 1 ? ` · ${sub.action.sheets} sheets` : ''}
                          </button>
                        ) : sub?.action.kind === 'draft' ? (
                          <button type="button" style={{ ...btnBlue, padding: '0.2rem 0.6rem' }} onClick={() => draftFor(sub)}>Draft a work order…</button>
                        ) : sub && sub.action.kind === 'note' && sub.action.text && sub.owed > 0 ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub.action.text}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
                const body = g.rows.flatMap((r) => {
                  const { job, totalCost, paid, backcharges, balance, rail, next, coverage, jobId, personId, parties, payWhen, stageView } = r
                  const jobRate = job.labor_rate ?? 0
                  const dateInputValue = job.job_date ?? (job.created_at ? job.created_at.slice(0, 10) : '')
                  const expanded = expandedSubLaborJobIds.has(job.id)
                  const toggle = () => {
                    setExpandedSubLaborJobIds((prev) => {
                      const nextSet = new Set(prev)
                      if (nextSet.has(job.id)) nextSet.delete(job.id)
                      else nextSet.add(job.id)
                      return nextSet
                    })
                  }
                  const editing = payableEdit?.id === job.id
                  const canQueue = payWhen.kind === 'wait' || payWhen.kind === 'queued' || payWhen.kind === 'ready'
                  return [
                    <tr key={job.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: expanded ? 'var(--bg-subtle)' : undefined }} onClick={toggle}>
                      <td style={{ padding: '0.75rem', width: 32 }}>{expanded ? '▼' : '▶'}</td>
                      <td style={{ padding: '0.75rem', maxWidth: 260 }}>
                        <div style={{ lineHeight: 1.4 }}>
                          <div style={{ fontWeight: 500 }}>
                            {job.job_number ?? '—'}
                            {laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()] ? <> | {laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()]}</> : null}
                            {job.project_id ? (
                              <a
                                href={`/workflows/${job.project_id}${job.step_id ? `#step-${job.step_id}` : ''}`}
                                onClick={(e) => e.stopPropagation()}
                                title={job.project_name ? `Project: ${job.project_name}` : 'Open project workflow'}
                                style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-link)', background: 'var(--bg-blue-tint)', borderRadius: 999, padding: '0.05rem 0.5rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
                              >
                                {job.project_name ?? 'Project'}
                              </a>
                            ) : null}
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {job.address ? (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }} title={job.address} onClick={(e) => e.stopPropagation()}>
                                {job.address}
                              </a>
                            ) : (
                              '—'
                            )}
                            {parties.withLabel ? <span title="Teammates on this sheet — the sub is the contractor; they rode along"> · {parties.withLabel}</span> : null}
                            {coverage.kind === 'signed' && coverage.recordId ? <span> · ✍ {coverage.recordId}</span> : null}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalCost > 0 ? <AmountSmallCents value={totalCost} /> : <span style={{ color: 'var(--text-faint)' }}>unpriced</span>}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{paid > 0 ? <AmountSmallCents value={paid} /> : '—'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem' }}>
                        {totalCost > 0 ? (
                          balance > 0 ? (
                            <span style={{ color: rail.gap ? SHEET_RAIL_GAP : 'var(--text-red-700)', fontWeight: rail.gap ? 700 : 500 }}><AmountSmallCents value={balance} /> due</span>
                          ) : balance < 0 ? (
                            <span style={{ color: 'var(--text-green-600)' }}>Over <AmountSmallCents value={-balance} /></span>
                          ) : (
                            <span style={{ color: 'var(--text-green-600)' }}>Paid</span>
                          )
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <SubSheetStageCell
                          job={stageView}
                          rail={rail}
                          paid={totalCost > 0 && balance <= 0}
                          menuOpen={stageMenuJobId === job.id}
                          onToggleMenu={() => setStageMenuJobId((cur) => (cur === job.id ? null : job.id))}
                          onPick={(stage) => {
                            setStageMenuJobId(null)
                            void onSetLaborJobStage(job.id, stage)
                          }}
                          onOpenStory={() => setStorySheetId(job.id)}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                        <div>{tag(payWhen.label, payWhen.tone, PAY_RUN_FILTER_HINT[payWhen.kind === 'work' || payWhen.kind === 'walk' || payWhen.kind === 'hold' ? 'due' : payWhen.kind === 'unpriced' || payWhen.kind === 'paid' ? 'paid' : payWhen.kind])}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                          {payWhen.detail}
                          {payWhen.kind === 'gap' && next.button && next.button !== 'nudge' && next.buttonLabel ? (
                            <div>
                              <button
                                type="button"
                                onClick={() => (next.button === 'draft' ? setAssembler({ jobId, laborJobId: job.id, personId, amount: totalCost > 0 ? totalCost : null }) : setAssembler({ commitmentId: coverage.kind === 'none' ? null : coverage.id }))}
                                style={{ ...btnBlue, marginTop: 4, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                              >
                                {next.buttonLabel}
                              </button>
                            </div>
                          ) : null}
                          {canQueue && !editing ? (
                            <div>
                              <button type="button" style={btnGhost} onClick={() => setPayableEdit({ id: job.id, value: job.payable_after ?? '' })}>
                                {job.payable_after ? 'change payable after…' : 'set payable after…'}
                              </button>
                            </div>
                          ) : null}
                          {editing ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                              <input type="date" value={payableEdit.value} onChange={(e) => setPayableEdit({ id: job.id, value: e.target.value })} style={{ padding: '0.15rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.75rem' }} />
                              <button type="button" style={{ ...btnPay, padding: '0.15rem 0.5rem', fontSize: '0.72rem' }} disabled={payableBusy || !payableEdit.value} onClick={() => void savePayableAfter(job.id, payableEdit.value)}>Queue</button>
                              {job.payable_after ? <button type="button" style={btnGhost} disabled={payableBusy} onClick={() => void savePayableAfter(job.id, null)}>Clear</button> : null}
                              <button type="button" style={{ ...btnGhost, color: 'var(--text-muted)' }} onClick={() => setPayableEdit(null)}>Cancel</button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td style={{ padding: '0.5rem', verticalAlign: 'middle', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" aria-label="More" title="Edit · Print · Payment · Back-charge · Story · Lien waiver" onClick={() => setMenuJobId((cur) => (cur === job.id ? null : job.id))} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 4, width: 30, height: 26, cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>
                          ⋯
                        </button>
                        {menuJobId === job.id ? (
                          <div role="menu" style={{ position: 'absolute', right: 8, top: '100%', zIndex: 20, minWidth: 170, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px -10px rgba(0,0,0,0.35)', padding: '0.25rem' }}>
                            {balance > 0 ? <button type="button" role="menuitem" style={{ ...menuItem, color: 'var(--text-green-700)', fontWeight: 600 }} onClick={() => { setMenuJobId(null); onOpenMakePayment(payTarget(r), String(balance)) }}>Payment…</button> : null}
                            <button type="button" role="menuitem" style={menuItem} onClick={() => { setMenuJobId(null); onOpenBackcharge({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost, paid }) }}>Back-charge…</button>
                            <button type="button" role="menuitem" style={menuItem} onClick={() => { setMenuJobId(null); onEditLaborJob(job) }}>Edit sheet</button>
                            <button type="button" role="menuitem" style={menuItem} onClick={() => { setMenuJobId(null); onPrintJobSubSheet(job) }}>Print</button>
                            <button type="button" role="menuitem" style={menuItem} onClick={() => { setMenuJobId(null); setStorySheetId(job.id) }}>Story…</button>
                            <button type="button" role="menuitem" style={menuItem} onClick={() => { setMenuJobId(null); setLienWaiverFor(lienWaiverTarget(r)) }}>Lien waiver…</button>
                          </div>
                        ) : null}
                      </td>
                    </tr>,
                    ...(expanded
                      ? [
                          <tr key={`${job.id}-expand`}>
                            <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', verticalAlign: 'top' }}>
                              <div onClick={(e) => e.stopPropagation()} style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 1rem', fontSize: '0.875rem' }}>
                                  <span style={{ fontWeight: 500 }}>
                                    Total cost: <AmountSmallCents value={totalCost} /> · Paid: <AmountSmallCents value={paid} /> · Backcharges: <AmountSmallCents value={backcharges} />
                                  </span>
                                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                    Sheet date
                                    <input type="date" value={dateInputValue} onChange={(e) => onUpdateLaborJobDate(job.id, e.target.value || null)} style={{ padding: '0.2rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }} />
                                  </label>
                                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {balance > 0 ? <button type="button" style={btnPay} onClick={() => onOpenMakePayment(payTarget(r), String(balance))}>Payment…</button> : null}
                                    <button type="button" style={{ ...btnBlue, background: '#dc2626' }} onClick={() => onOpenBackcharge({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost, paid })}>Back-charge…</button>
                                    <button type="button" style={{ ...btnBlue, background: 'var(--bg-200)', color: 'var(--text-700)' }} onClick={() => onEditLaborJob(job)}>Edit</button>
                                    <button type="button" style={{ ...btnBlue, background: '#0ea5e9' }} onClick={() => onPrintJobSubSheet(job)}>Print</button>
                                    <button type="button" style={{ ...btnBlue, background: 'var(--bg-200)', color: 'var(--text-700)' }} onClick={() => setLienWaiverFor(lienWaiverTarget(r))}>Lien waiver…</button>
                                  </span>
                                </div>
                                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Invoice link</h4>
                                {job.invoice_link?.trim() ? (
                                  <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
                                    <a href={normalizeUrl(job.invoice_link)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
                                      {job.invoice_link}
                                    </a>
                                  </p>
                                ) : (
                                  <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-faint)' }}>No invoice linked.</p>
                                )}
                                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Specific Work (Line Items)</h4>
                                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead style={{ background: 'var(--bg-subtle)' }}>
                                      <tr>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Count</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>hrs/unit</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Labor Hours</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Rate</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Cost</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(job.items ?? []).map((i, idx) => {
                                        const hrs = Number(i.hrs_per_unit) || 0
                                        const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
                                        const rate = i.labor_rate != null ? Number(i.labor_rate) : jobRate
                                        const cost = lineLaborCost(i, jobRate)
                                        const isDirect = i.direct_labor_amount != null && Number.isFinite(Number(i.direct_labor_amount))
                                        return (
                                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>{i.fixture ?? '—'}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{isDirect ? '—' : Number(i.count)}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{isDirect ? '—' : hrs.toFixed(2)}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{isDirect ? '—' : laborHrs.toFixed(2)}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{isDirect ? '—' : <AmountSmallCents value={rate} />}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}><AmountSmallCents value={cost} /></td>
                                          </tr>
                                        )
                                      })}
                                      {(job.items ?? []).length === 0 && (
                                        <tr><td colSpan={6} style={{ padding: '0.75rem', color: 'var(--text-faint)', fontSize: '0.875rem' }}>No line items yet</td></tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Payments</h4>
                                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead style={{ background: 'var(--bg-subtle)' }}>
                                      <tr>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Type</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Amount</th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Memo</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(job.payments ?? []).map((p) => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>{p.payment_date ? new Date(p.payment_date + 'T00:00:00').toLocaleDateString() : p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>{Number(p.amount) < 0 ? 'Backcharge' : 'Payment'}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}><AmountSmallCents value={Number(p.amount)} /></td>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>{p.memo?.trim() ? p.memo : '—'}</td>
                                        </tr>
                                      ))}
                                      {(job.payments ?? []).length === 0 && (
                                        <tr><td colSpan={4} style={{ padding: '0.75rem', color: 'var(--text-faint)', fontSize: '0.875rem' }}>No payments yet</td></tr>
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
                })
                return [header, ...body]
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        The rail is the one the sub sees on their portal — Work · Pre-inspection · Post-inspection: Trigger draw · Paid — with the office's Drafted · Sent · Signed in front of it. A dashed red run means work is happening with nothing signed. Click the current dot to move the stage. <b>Pay when</b> reads the rule the sheet is under: Ready once the customer has paid or the payable-after date has arrived, Queued while that date is ahead.
      </p>
      <WorkOrderAssemblerModal open={assembler != null} onClose={() => setAssembler(null)} jobs={jobs} initial={assembler} authUserId={authUserId} onChanged={() => { void loadCommitments(); emitWorkOrderChanged() }} />
      <SubPortalVisitsModal personId={visitsFor?.personId ?? null} personName={visitsFor?.name ?? ''} onClose={() => { setVisitsFor(null); visits.reload() }} />
      {lienWaiverFor ? <LienWaiverSendModal target={lienWaiverFor} onClose={() => setLienWaiverFor(null)} /> : null}
      <SheetStoryModal sheetId={storySheetId} onClose={() => setStorySheetId(null)} jobs={jobs} authUserId={authUserId} onOpenSheet={(id) => { const j = laborJobs.find((x) => x.id === id); if (j) onEditLaborJob(j) }} onSheetChanged={() => { void loadCommitments(); onReloadLaborJobs?.() }} />
    </div>
  )
}

const STAGE_CHIP_TONES: Record<SubSheetStageTone | 'green', { bg: string; fg: string; border: string }> = {
  amber: { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)', border: 'var(--border-amber)' },
  violet: { bg: 'var(--bg-violet-100)', fg: 'var(--text-violet-700)', border: 'var(--border-violet)' },
  blue: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-700)', border: '#93c5fd' },
  green: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', border: '#6ee7b7' },
}

/**
 * The stage chip on a ledger row (v2.2767): click the chip for the four
 * stages (jump or step back), the → advances one. A paid sheet (open ≤ $0)
 * reads "Paid" and cannot be moved — the stage is moot once the money moved.
 */
function SubSheetStageCell({
  job,
  rail,
  paid,
  menuOpen,
  onToggleMenu,
  onPick,
  onOpenStory,
}: {
  job: LaborJob
  rail: SheetRailShape
  paid: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onPick: (stage: SubSheetStage) => void
  onOpenStory?: () => void
}) {
  const stage = normalizeSubSheetStage(job.stage)
  const next = nextSubSheetStage(stage)
  const stamp = subSheetStageStamp({
    source: normalizeSubSheetStageSource(job.stage_source),
    changedAt: job.stage_changed_at ?? null,
    changedByName: job.stage_changed_by_name ?? null,
    contractorName: job.assigned_to_name,
  })
  const tone = STAGE_CHIP_TONES[paid ? 'green' : SUB_SHEET_STAGE_TONE[stage]]
  const title = [paid ? 'Paid — the balance is $0' : SUB_SHEET_STAGE_LABEL[stage], stamp ? `last moved by ${stamp}` : null, job.stage_note ? `“${job.stage_note}”` : null]
    .filter(Boolean)
    .join(' · ')
  if (paid) {
    return <SheetRail rail={rail} title={title} onClick={onOpenStory} />
  }
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        <SheetRail rail={rail} title={`${title} · click the current dot to move the stage`} onCurrentClick={onToggleMenu} onClick={onOpenStory} />
        {job.stage_source === 'portal' ? <span style={{ fontSize: '0.68rem', fontWeight: 600, color: tone.fg }} title="The sub moved it from their portal">· sub</span> : null}
        {job.stage_source === 'auto' ? <span style={{ fontSize: '0.68rem', fontWeight: 600, color: tone.fg }} title={`Moved by the facts — ${job.stage_auto_reason ? SUB_SHEET_STAGE_AUTO_REASON_LABEL[job.stage_auto_reason] : 'the evidence'}. Move it by hand to keep your own call.`}>· auto</span> : null}
        {next ? (
          <button
            type="button"
            title={`Move to ${SUB_SHEET_STAGE_LABEL[next]}`}
            aria-label={`Move to ${SUB_SHEET_STAGE_LABEL[next]}`}
            onClick={() => onPick(next)}
            style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 999, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700, color: tone.fg, cursor: 'pointer' }}
          >
            →
          </button>
        ) : null}
      </span>
      {stamp ? (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'nowrap' }} title={job.stage_note ?? undefined}>
          {stamp}
          {job.stage_note ? ' ✎' : ''}
        </div>
      ) : null}
      {menuOpen && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4, width: 260, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px -10px rgba(0,0,0,0.3)', padding: '0.3rem', fontSize: '0.8125rem' }}
        >
          {SUB_SHEET_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === stage}
              onClick={() => onPick(s)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', borderRadius: 5, border: 'none', background: s === stage ? 'var(--bg-subtle)' : 'transparent', color: 'var(--text-900)', fontWeight: s === stage ? 700 : 500, cursor: 'pointer', font: 'inherit' }}
            >
              <span>{SUB_SHEET_STAGE_LABEL[s]}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.72rem' }}>{SUB_SHEET_STAGE_HINT[s]}</span>
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', margin: '0.3rem 0.2rem 0', padding: '0.35rem 0.4rem 0.1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Paid sets itself at $0 open · every move posts to the job&#8217;s Activity feed
          </div>
        </div>
      )}
    </div>
  )
}
