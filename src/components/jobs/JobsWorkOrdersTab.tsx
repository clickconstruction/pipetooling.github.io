/**
 * Jobs → Work Orders (one-row spine, PR 3 — every row is a sub sheet). The
 * agreements board: Job · Sub · Agreed · Paid · Open · the rail · Next ·
 * actions, grouped by how far left the rail's dot sits — working with no
 * agreement first, then drafted, sent, signed (collapsed). Declined and
 * expired offers are red states in the first group, not filters. Crew pay
 * sheets never appear here. Every row opens its sheet; a signed order's
 * number opens the record; "Draft a work order…" opens the assembler on the
 * sheet with its total as the price.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { subLaborAssignPickerRows } from '../../lib/jobs/subLaborJobPicker'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StepCommitmentRow } from '../../lib/workflow/stepCommitments'
import { parseSubWorkOrderSnapshot, sheetWorkOrderLabel } from '../../lib/subWorkOrders/subWorkOrder'
import { buildWorkOrderDocument, renderWorkOrderDocumentHtml, WORK_ORDER_ISSUER } from '../../lib/subWorkOrders/workOrderDocument'
import type { WorkOrderRowLike } from '../../lib/subWorkOrders/workOrderCoverage'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/sheetsNeedingWorkOrder'
import {
  buildWorkOrderBoard,
  SHEET_RAIL_GROUP_LABEL,
  WORK_ORDER_BOARD_FILTERS,
  WORK_ORDER_BOARD_GROUPS,
  workOrderBoardFilterFromParam,
  workOrderBoardRowMatches,
  type WorkOrderBoardFilterKey,
  type WorkOrderBoardRow,
  type WorkOrderBoardSheet,
} from '../../lib/subWorkOrders/workOrderBoardRows'
import { SHEET_RAIL_GAP } from '../../lib/subWorkOrders/sheetRailTone'
import { SheetRail } from './SheetRail'
import { emitWorkOrderChanged, WORK_ORDER_CHANGED_EVENT } from '../../hooks/useJobWorkOrderCoverage'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { notifySheetWorkOrderOffered } from '../../lib/workflow/workOrderNotifications'
import { resolveSubPortalUrl } from '../../lib/subPortal/resolveSubPortalUrl'
import { ScheduleDispatchAssignJobPickerModal } from '../schedule/ScheduleDispatchAssignJobPickerModal'
import { WorkOrderAssemblerModal, type WorkOrderAssemblerInitial } from './WorkOrderAssemblerModal'

/** A sheet with its money, its stage and its people — the board derives everything from these. */
type SheetLite = WorkOrderBoardSheet & { assignees?: Array<{ person_id: string }> | null }
type StepLite = { id: string; name: string }

export type JobsWorkOrdersTabProps = {
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
}

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

export function JobsWorkOrdersTab({ jobs, jobsLoading, authUserId, deepLinkWorkOrderId, onDeepLinkConsumed, initialFilter, onOpenSheet }: JobsWorkOrdersTabProps) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const jobForm = useJobFormModal()
  const narrow = useIsNarrowScreen()
  const [rows, setRows] = useState<StepCommitmentRow[]>([])
  const [sheets, setSheets] = useState<SheetLite[]>([])
  const [roster, setRoster] = useState<NeedsWorkOrderRosterPerson[]>([])
  const [steps, setSteps] = useState<Record<string, StepLite>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<WorkOrderBoardFilterKey>(() => workOrderBoardFilterFromParam(initialFilter) ?? 'all')
  const [search, setSearch] = useState('')
  const [signedOpen, setSignedOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [assembler, setAssembler] = useState<WorkOrderAssemblerInitial | null>(null)
  const [linkRow, setLinkRow] = useState<WorkOrderBoardRow | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkNumber, setLinkNumber] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data: rowsData, error: rowsErr }, { data: sheetsData, error: sheetsErr }, { data: rosterData, error: rosterErr }, { data: usersData, error: usersErr }] = await Promise.all([
        supabase.from('step_commitments').select('*').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1000),
        // Every sheet with its items, payments, stage and assignees — rows are sheets now.
        supabase
          .from('people_labor_jobs')
          .select('id, job_number, address, assigned_to_name, labor_rate, stage, payable_after, job_date, created_at, items:people_labor_job_items(count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount), payments:people_labor_job_payments(amount), assignees:people_labor_job_assignees(person_id)')
          .order('created_at', { ascending: false })
          .limit(1000),
        // The roster decides which sheets are sub sheets: teammates carry a `kind = 'sub'`
        // row too, so the login's role is what tells crew pay from a sub.
        supabase.from('people').select('id, name, kind, account_user_id').order('id').limit(1000),
        supabase.from('users').select('id, role').order('id').limit(1000),
      ])
      if (rowsErr) throw rowsErr
      if (sheetsErr) throw sheetsErr
      if (rosterErr) throw rosterErr
      if (usersErr) throw usersErr
      const list = (rowsData ?? []) as StepCommitmentRow[]
      setRows(list)
      setSheets((sheetsData ?? []) as SheetLite[])
      const roleByUserId = new Map(((usersData ?? []) as Array<{ id: string; role: string | null }>).map((u) => [u.id, u.role]))
      setRoster(
        ((rosterData ?? []) as Array<{ id: string; name: string; kind: string; account_user_id: string | null }>).map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          accountRole: p.account_user_id ? (roleByUserId.get(p.account_user_id) ?? null) : null,
        })),
      )
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

  const visible = useMemo(() => {
    const q = search.trim()
    return board.rows.filter((r) => (filter === 'all' || r.group === filter) && workOrderBoardRowMatches(r, q))
  }, [board, filter, search])
  const searching = search.trim() !== ''

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
    const ok = await confirm({
      title: `Link this sheet to #${job.hcp_number}?`,
      message: `The ${row.subName} sheet's job number becomes ${job.hcp_number} (${job.customer_name ?? 'no customer'}). Its work order, bill and Job Summary all land on that job.`,
      confirmLabel: 'Link',
    })
    if (!ok) return
    setBusyId(row.key)
    const { error: err } = await supabase.from('people_labor_jobs').update({ job_number: job.hcp_number }).eq('id', row.sheetId)
    setBusyId(null)
    if (err) {
      showToast(`Could not link: ${formatErrorMessage(err)}`, 'error')
      return
    }
    showToast(`Linked to #${job.hcp_number}`, 'success')
    emitWorkOrderChanged()
  }

  function newJobForSheet(row: WorkOrderBoardRow) {
    if (!jobForm) return
    showToast(`Give the new job number ${row.jobNumber || '…'} and the sheet links itself`, 'info')
    jobForm.openNewJob({ onSaved: () => emitWorkOrderChanged() })
  }

  /** The button that goes first in the row — the office's next move. */
  function primaryAction(row: WorkOrderBoardRow) {
    const busy = busyId === row.key || (row.commitmentId != null && busyId === row.commitmentId)
    const order = row.commitmentId ? rowsById.get(row.commitmentId) : null
    const b = row.next.button
    if (!b || !row.next.buttonLabel) return null
    const onClick =
      b === 'draft'
        ? () => setAssembler({ jobId: row.jobId, laborJobId: row.sheetId, amount: row.agreed > 0 ? row.agreed : null })
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

  const jobCell = (row: WorkOrderBoardRow) => (
    <>
      <div style={{ fontWeight: 600 }}>{row.primary}</div>
      {row.secondary ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.secondary}</div> : null}
      {row.notInPipeline ? (
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
      ) : null}
    </>
  )
  const subCell = (row: WorkOrderBoardRow) => (
    <>
      <div>{row.subName || <span style={{ color: 'var(--text-faint)' }}>no sub named</span>}</div>
      {row.recordId ? (
        <button type="button" style={{ ...door, fontSize: '0.7rem' }} onClick={() => (row.commitmentId ? setAssembler({ commitmentId: row.commitmentId }) : undefined)} title="Open the signed record">
          {row.recordId} ›
        </button>
      ) : null}
    </>
  )
  const openCell = (row: WorkOrderBoardRow) => (row.unpriced ? <span style={{ color: 'var(--text-faint)' }}>—</span> : <span style={{ fontWeight: 700, color: row.open > 0 && row.group === 'no_agreement' ? 'var(--text-red-700)' : 'inherit' }}>{money(row.open)}</span>)
  const nextCell = (row: WorkOrderBoardRow) => (
    <>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: row.next.button === 'nudge' || row.next.button === 'reoffer' ? 'var(--text-amber-800)' : 'inherit' }}>{row.next.label}</div>
      {row.next.hint ? <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.next.hint}</div> : null}
    </>
  )

  const groupHeader = (g: (typeof WORK_ORDER_BOARD_GROUPS)[number], n: number) => {
    const collapsible = g === 'signed' && filter === 'all' && !searching
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.35rem 0.6rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 700, color: g === 'no_agreement' && n > 0 ? SHEET_RAIL_GAP : 'var(--text-muted)' }}>
        <span>
          {SHEET_RAIL_GROUP_LABEL[g]} · {n}
        </span>
        {collapsible && n > 0 ? (
          <button type="button" style={{ ...door, marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }} onClick={() => setSignedOpen((v) => !v)}>
            {signedOpen ? 'Hide ▴' : `Show ${n} ▾`}
          </button>
        ) : null}
      </div>
    )
  }

  const groupsToRender = WORK_ORDER_BOARD_GROUPS.map((g) => ({ g, list: visible.filter((r) => r.group === g) })).filter(({ g, list }) => list.length > 0 || (filter === 'all' && !searching && g !== 'signed') || filter === g)

  const tiles = (
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: '0.9rem' }}>
      {[
        { k: 'On a handshake', v: money(board.tiles.handshakeUsd), red: board.tiles.handshakeUsd > 0, s: `${board.tiles.handshakeCount} sub sheet${board.tiles.handshakeCount === 1 ? '' : 's'} working with nothing signed` },
        { k: 'Offers out', v: String(board.tiles.offersOut), red: false, s: board.tiles.offersOut === 0 ? 'none waiting on a signature' : 'waiting on a signature' },
        { k: 'Signed this month', v: String(board.tiles.signedThisMonth), red: false, s: board.tiles.signedThisMonth === 0 ? 'the first one starts the record' : 'agreements on file' },
      ].map((t) => (
        <div key={t.k} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.8rem', background: 'var(--surface)' }}>
          <div style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{t.k}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: t.red ? 'var(--text-red-700)' : 'inherit' }}>{t.v}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.s}</div>
        </div>
      ))}
    </div>
  )

  const table = (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 960, fontVariantNumeric: 'tabular-nums' }}>
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr>
            <th style={th}>Job</th>
            <th style={th}>Sub</th>
            <th style={{ ...th, textAlign: 'right' }}>Agreed</th>
            <th style={{ ...th, textAlign: 'right' }}>Paid</th>
            <th style={{ ...th, textAlign: 'right' }}>Open</th>
            <th style={th}>Where it stands</th>
            <th style={th}>Next</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {groupsToRender.map(({ g, list }) => {
            const hidden = g === 'signed' && filter === 'all' && !searching && !signedOpen
            return (
              <FragmentRows key={g}>
                <tr>
                  <td colSpan={8} style={{ padding: 0 }}>
                    {groupHeader(g, list.length)}
                  </td>
                </tr>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...td, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {g === 'no_agreement' ? 'Every sub sheet with money open has an agreement behind it.' : g === 'drafted' ? 'Nothing drafted. A draft is a work order with no price yet — it appears here the moment you start one.' : g === 'sent' ? 'No offers out.' : 'Nothing signed yet.'}
                    </td>
                  </tr>
                ) : hidden ? null : (
                  list.map((row) => (
                    <tr key={row.key}>
                      <td style={td}>{jobCell(row)}</td>
                      <td style={td}>{subCell(row)}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{row.unpriced ? <span style={{ color: 'var(--text-faint)' }}>unpriced</span> : money(row.agreed)}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.paid)}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{openCell(row)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <SheetRail rail={row.rail} />
                      </td>
                      <td style={td}>{nextCell(row)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                          {primaryAction(row)}
                          {secondaryActions(row)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </FragmentRows>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const cards = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groupsToRender.map(({ g, list }) => {
        const hidden = g === 'signed' && filter === 'all' && !searching && !signedOpen
        return (
          <div key={g} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {groupHeader(g, list.length)}
            {list.length === 0 ? (
              <div style={{ padding: '0.5rem 0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{g === 'no_agreement' ? 'Every sub sheet with money open has an agreement behind it.' : 'Nothing here.'}</div>
            ) : hidden ? null : (
              list.map((row) => (
                <div key={row.key} style={{ padding: '0.6rem 0.7rem', borderTop: '1px solid var(--border)', display: 'grid', gap: 6 }}>
                  <div>{jobCell(row)}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{subCell(row)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                    <div><div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Agreed</div>{row.unpriced ? <span style={{ color: 'var(--text-faint)' }}>unpriced</span> : money(row.agreed)}</div>
                    <div><div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Paid</div>{money(row.paid)}</div>
                    <div><div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Open</div>{openCell(row)}</div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <SheetRail rail={row.rail} compact />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 auto' }}>{nextCell(row)}</div>
                    {primaryAction(row)}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{secondaryActions(row)}</div>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div>
      {tiles}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
        <button type="button" style={{ ...smallBtn('primary'), padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }} onClick={() => setAssembler({})}>
          + New work order
        </button>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job, sub, customer, or WO number"
          style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', minWidth: 220, fontSize: '0.8125rem' }}
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
      </div>

      {error ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p> : null}

      {loading || jobsLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading work orders…</p>
      ) : board.rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing on the board — every sub sheet is either paid up or has an agreement behind it. Draft a work order for a new job with + New work order.</p>
      ) : visible.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing matches this filter.</p>
      ) : narrow ? (
        cards
      ) : (
        table
      )}

      <p style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Crew pay sheets (a teammate on the sheet) never need a work order and are not listed here — they carry their own label on Sub Labor.
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

      <WorkOrderAssemblerModal open={assembler != null} onClose={() => setAssembler(null)} jobs={jobs} initial={assembler} authUserId={authUserId} onChanged={() => void load()} />
    </div>
  )
}

/** A keyed fragment for table groups (React.Fragment with a key, named for readability). */
function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export default JobsWorkOrdersTab
