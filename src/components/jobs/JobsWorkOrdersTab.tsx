import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StepCommitmentRow } from '../../lib/workflow/stepCommitments'
import { parseSubWorkOrderSnapshot, sheetWorkOrderLabel } from '../../lib/subWorkOrders/subWorkOrder'
import { buildWorkOrderDocument, renderWorkOrderDocumentHtml, WORK_ORDER_ISSUER } from '../../lib/subWorkOrders/workOrderDocument'
import {
  buildJobWorkOrderCoverage,
  jobsNeedingWorkOrder,
  workOrderBoardBucket,
  type JobWorkOrderCoverage,
  type WorkOrderBoardFilter,
  type WorkOrderRowLike,
} from '../../lib/subWorkOrders/workOrderCoverage'
import { emitWorkOrderChanged, WORK_ORDER_CHANGED_EVENT } from '../../hooks/useJobWorkOrderCoverage'
import { notifySheetWorkOrderOffered } from '../../lib/workflow/workOrderNotifications'
import { resolveSubPortalUrl } from '../../lib/subPortal/resolveSubPortalUrl'
import { WorkOrderAssemblerModal, type WorkOrderAssemblerInitial } from './WorkOrderAssemblerModal'

/**
 * Jobs → Work Orders (Work Orders tab, PR 2 — v2.2819): the board of every
 * sub work order — drafts waiting on a price, offers awaiting a signature,
 * signed records, declines — plus the jobs that carry sub labor but have no
 * work order yet. Every row opens the assembler; the assembler is where the
 * document is built and sent, this board is where the office sees where each
 * one stands.
 */

type SheetLite = { id: string; job_number: string | null; address: string; assigned_to_name: string; paid_at: string | null }
type StepLite = { id: string; name: string }

export type JobsWorkOrdersTabProps = {
  jobs: JobWithDetails[]
  jobsLoading: boolean
  authUserId: string | undefined
  /** `?wo=<id>` deep link — opens that order once, then the page clears the param. */
  deepLinkWorkOrderId: string | null
  onDeepLinkConsumed: () => void
}

const FILTERS: Array<{ key: WorkOrderBoardFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'awaiting', label: 'Awaiting signature' },
  { key: 'signed', label: 'Signed' },
  { key: 'declined', label: 'Declined' },
  { key: 'expired', label: 'Expired' },
]

const bucketChip = (bucket: Exclude<WorkOrderBoardFilter, 'all'>, unpriced: boolean) => {
  const tone: Record<Exclude<WorkOrderBoardFilter, 'all'>, { bg: string; fg: string; label: string }> = {
    drafts: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', label: unpriced ? 'Draft · needs a price' : 'Draft' },
    awaiting: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', label: 'Awaiting signature' },
    signed: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', label: '✍ Signed' },
    declined: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)', label: 'Declined' },
    expired: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)', label: 'Offer expired' },
  }
  const t = tone[bucket]
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, background: t.bg, color: t.fg, whiteSpace: 'nowrap' }}>
      {t.label}
    </span>
  )
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

const th = { padding: '0.45rem 0.6rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' } as const
const td = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', verticalAlign: 'top' } as const

function ymd(v: string | null | undefined): string {
  return (v ?? '').slice(0, 10)
}

export function JobsWorkOrdersTab({ jobs, jobsLoading, authUserId, deepLinkWorkOrderId, onDeepLinkConsumed }: JobsWorkOrdersTabProps) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const [rows, setRows] = useState<StepCommitmentRow[]>([])
  const [sheets, setSheets] = useState<SheetLite[]>([])
  const [steps, setSteps] = useState<Record<string, StepLite>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<WorkOrderBoardFilter>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [assembler, setAssembler] = useState<WorkOrderAssemblerInitial | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data: rowsData, error: rowsErr }, { data: sheetsData, error: sheetsErr }] = await Promise.all([
        supabase.from('step_commitments').select('*').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1000),
        // Every sheet: the board labels sheet-anchored orders by job number + address,
        // and unpaid sheets are what tell us which jobs still need a work order.
        supabase.from('people_labor_jobs').select('id, job_number, address, assigned_to_name, paid_at').order('created_at', { ascending: false }).limit(1000),
      ])
      if (rowsErr) throw rowsErr
      if (sheetsErr) throw sheetsErr
      const list = (rowsData ?? []) as StepCommitmentRow[]
      setRows(list)
      setSheets((sheetsData ?? []) as SheetLite[])
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

  // Deep link: open the named order once the rows are in.
  useEffect(() => {
    if (!deepLinkWorkOrderId || loading) return
    const hit = rows.find((r) => r.id === deepLinkWorkOrderId)
    if (hit) setAssembler({ commitmentId: hit.id })
    else showToast('That work order is no longer on the board', 'info')
    onDeepLinkConsumed()
  }, [deepLinkWorkOrderId, loading, rows, onDeepLinkConsumed, showToast])

  const jobsById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const jobsByNumber = useMemo(() => new Map(jobs.map((j) => [j.hcp_number.trim().toLowerCase(), j])), [jobs])
  const sheetsById = useMemo(() => new Map(sheets.map((s) => [s.id, s])), [sheets])
  const today = todayYmdInAppTz()

  /** Which job a row belongs to — direct anchor, else its sheet's job number. */
  const jobForRow = useCallback(
    (r: StepCommitmentRow): JobWithDetails | null => {
      if (r.job_id) return jobsById.get(r.job_id) ?? null
      const sheet = r.labor_job_id ? sheetsById.get(r.labor_job_id) : null
      const num = (sheet?.job_number ?? '').trim().toLowerCase()
      return num ? (jobsByNumber.get(num) ?? null) : null
    },
    [jobsById, sheetsById, jobsByNumber],
  )

  const rowLabel = useCallback(
    (r: StepCommitmentRow): { primary: string; secondary: string | null } => {
      const job = jobForRow(r)
      if (job) return { primary: `#${job.hcp_number} · ${job.customer_name ?? 'No customer'}`, secondary: job.job_address || null }
      const snap = parseSubWorkOrderSnapshot(r.offer_scope_snapshot)
      if (snap?.facts?.jobLabel) return { primary: snap.facts.jobLabel, secondary: snap.facts.jobAddress ?? null }
      const sheet = r.labor_job_id ? sheetsById.get(r.labor_job_id) : null
      if (sheet) return { primary: sheetWorkOrderLabel(sheet), secondary: 'Sub Labor sheet' }
      if (r.step_id) return { primary: steps[r.step_id]?.name ?? 'Project step', secondary: 'Project step' }
      return { primary: 'Unanchored', secondary: null }
    },
    [jobForRow, sheetsById, steps],
  )

  const bucketed = useMemo(
    () =>
      rows
        .map((r) => ({ r, bucket: workOrderBoardBucket(r as WorkOrderRowLike, today), label: rowLabel(r) }))
        .filter((x): x is { r: StepCommitmentRow; bucket: Exclude<WorkOrderBoardFilter, 'all'>; label: { primary: string; secondary: string | null } } => x.bucket != null),
    [rows, today, rowLabel],
  )
  const counts = useMemo(() => {
    const c: Record<WorkOrderBoardFilter, number> = { all: bucketed.length, drafts: 0, awaiting: 0, signed: 0, declined: 0, expired: 0 }
    for (const b of bucketed) c[b.bucket] += 1
    return c
  }, [bucketed])
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bucketed.filter((b) => {
      if (filter !== 'all' && b.bucket !== filter) return false
      if (!q) return true
      const hay = [b.r.record_id ?? '', b.r.display_name, b.label.primary, b.label.secondary ?? ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [bucketed, filter, search])

  /** Jobs with unpaid sub labor and no live or signed work order. */
  const needsWorkOrder = useMemo(() => {
    const byJob = new Map<string, WorkOrderRowLike[]>()
    for (const r of rows) {
      const job = jobForRow(r)
      if (!job) continue
      const list = byJob.get(job.id) ?? []
      list.push(r as WorkOrderRowLike)
      byJob.set(job.id, list)
    }
    const coverage = new Map<string, JobWorkOrderCoverage>()
    for (const [id, list] of byJob) coverage.set(id, buildJobWorkOrderCoverage(list, today))
    const unpaidNumbers = new Set(sheets.filter((s) => !s.paid_at && (s.job_number ?? '').trim()).map((s) => (s.job_number ?? '').trim().toLowerCase()))
    return jobsNeedingWorkOrder(jobs, unpaidNumbers, coverage).map((j) => {
      const full = jobsById.get(j.id)
      const subNames = Array.from(new Set(sheets.filter((s) => (s.job_number ?? '').trim().toLowerCase() === j.hcp_number.trim().toLowerCase() && !s.paid_at).map((s) => s.assigned_to_name.trim()).filter(Boolean)))
      return { id: j.id, hcp: j.hcp_number, customer: full?.customer_name ?? null, address: full?.job_address ?? null, subNames }
    })
  }, [rows, jobs, sheets, jobForRow, today, jobsById])

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
    const ok = await confirm({ title: 'Discard this draft?', message: `The draft for ${r.display_name} is removed from the board. Nothing was sent, so nothing reaches the sub.`, confirmLabel: 'Discard', danger: true })
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
      const label = rowLabel(r)
      void notifySheetWorkOrderOffered({
        laborJobId: r.labor_job_id,
        workOrderId: r.id,
        sheetLabel: label.primary,
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
      showToast('This work order has no saved document yet', 'info')
      return
    }
    const doc = buildWorkOrderDocument({ snapshot: r.offer_scope_snapshot, commitment: r, issuer: WORK_ORDER_ISSUER })
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(renderWorkOrderDocumentHtml(doc))
    w.document.close()
  }

  const rowActions = (r: StepCommitmentRow, bucket: Exclude<WorkOrderBoardFilter, 'all'>) => {
    const busy = busyId === r.id
    const open = (label: string, tone: 'primary' | 'ghost' = 'ghost') => (
      <button type="button" style={smallBtn(tone, busy)} disabled={busy} onClick={() => setAssembler({ commitmentId: r.id })}>
        {label}
      </button>
    )
    if (bucket === 'drafts')
      return (
        <>
          {open(r.amount == null ? 'Set a price…' : 'Edit', 'primary')}
          <button type="button" style={smallBtn('danger', busy)} disabled={busy} onClick={() => void discardDraft(r)}>
            Discard
          </button>
        </>
      )
    if (bucket === 'awaiting' || bucket === 'expired')
      return (
        <>
          {open('View')}
          <button type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => void nudge(r)} title="Resend the offer notification">
            Nudge
          </button>
          <button type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => void markSignedOnPaper(r)} title="They signed a printed copy">
            Signed on paper
          </button>
          <button type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => void withdraw(r)}>
            Withdraw
          </button>
        </>
      )
    if (bucket === 'signed')
      return (
        <>
          {open('View')}
          <button type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => print(r)}>
            Print
          </button>
        </>
      )
    return (
      <>
        {open('Re-offer…', 'primary')}
        <button type="button" style={smallBtn('ghost', busy)} disabled={busy} onClick={() => print(r)}>
          Print
        </button>
      </>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
        <button type="button" style={{ ...smallBtn('primary'), padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }} onClick={() => setAssembler({})}>
          + New work order
        </button>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job, sub, or WO number"
          style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', minWidth: 220, fontSize: '0.8125rem' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {FILTERS.map((f) => {
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
                  border: `1px solid ${active ? '#2563eb' : 'var(--border)'}`,
                  background: active ? '#2563eb' : 'var(--surface)',
                  color: active ? 'white' : 'var(--text-700)',
                }}
              >
                {f.label}
                {counts[f.key] > 0 ? <span style={{ marginLeft: 5, opacity: 0.8 }}>{counts[f.key]}</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      {error ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p> : null}

      {needsWorkOrder.length > 0 && filter === 'all' && !search.trim() ? (
        <div style={{ marginBottom: '1.1rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.6rem 0.8rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)', marginBottom: '0.35rem' }}>
            Needs a work order · {needsWorkOrder.length} job{needsWorkOrder.length === 1 ? '' : 's'} with unpaid sub labor and nothing signed
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {needsWorkOrder.slice(0, 12).map((j) => (
              <div key={j.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', fontSize: '0.8125rem' }}>
                <span style={{ fontWeight: 600 }}>#{j.hcp}</span>
                <span>{j.customer ?? 'No customer'}</span>
                <span style={{ color: 'var(--text-muted)' }}>{j.address ?? ''}</span>
                {j.subNames.length > 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>sheet: {j.subNames.join(', ')}</span> : null}
                <button type="button" style={{ ...smallBtn('primary'), marginLeft: 'auto' }} onClick={() => setAssembler({ jobId: j.id })}>
                  Draft a work order…
                </button>
              </div>
            ))}
            {needsWorkOrder.length > 12 ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ {needsWorkOrder.length - 12} more — search a job number above to find it</div> : null}
          </div>
        </div>
      ) : null}

      {loading || jobsLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading work orders…</p>
      ) : visible.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {bucketed.length === 0 ? 'No work orders yet. Draft one for a job, or draft from the "Needs a work order" list when a sheet is waiting.' : 'Nothing matches this filter.'}
        </p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760, fontVariantNumeric: 'tabular-nums' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={th}>WO</th>
                <th style={th}>Job</th>
                <th style={th}>Sub</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={th}>Status</th>
                <th style={th}>When</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ r, bucket, label }) => {
                const when =
                  bucket === 'signed'
                    ? `signed ${ymd(r.signed_at ?? r.accepted_at) || '—'}`
                    : bucket === 'awaiting' || bucket === 'expired'
                      ? `sent ${ymd(r.offered_at) || '—'}${r.offer_expires_at ? ` · through ${ymd(r.offer_expires_at)}` : ''}`
                      : bucket === 'declined'
                        ? `declined ${ymd(r.declined_at) || '—'}${r.decline_reason ? ` · “${r.decline_reason}”` : ''}`
                        : `drafted ${ymd(r.created_at)}`
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.record_id ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                    <td style={td}>
                      <div>{label.primary}</div>
                      {label.secondary ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label.secondary}</div> : null}
                    </td>
                    <td style={td}>{r.display_name}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.amount == null ? <span style={{ color: 'var(--text-faint)' }}>unpriced</span> : `$${formatCurrency(Number(r.amount))}`}</td>
                    <td style={td}>{bucketChip(bucket, r.amount == null)}</td>
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{when}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>{rowActions(r, bucket)}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <WorkOrderAssemblerModal open={assembler != null} onClose={() => setAssembler(null)} jobs={jobs} initial={assembler} authUserId={authUserId} onChanged={() => void load()} />
    </div>
  )
}

export default JobsWorkOrdersTab
