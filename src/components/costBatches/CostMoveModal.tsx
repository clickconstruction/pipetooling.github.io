/**
 * The Move cost window (devs, v2.6115): the rows ticked on one job go to another job as one
 * recorded, reversible cost batch through `cost_batch_apply` — no hand-built payload. Opened from
 * the job window's Costs tab (`JobWindowCostMovePanel`), the owner's shape of the tool (2026-10-30:
 * see every cost on a job, click, a window appears, the cost goes to the other job).
 *
 * The dev picks the job the rows go to, writes the reason and the plan's name, and the kernels in
 * `lib/costBatches/` build the batch: `allocate` with `from_job_id` for a bank row, `supply_repoint`,
 * `clock_repoint`, one `thread_note` on each job in the house form. **Dry-run** calls the RPC with
 * `p_dry_run = true` and the window lays the reply's `by_job` beside the plan's own summary, to the
 * cent. **Apply** is live only after a matching dry run of this exact plan and the dev's word that
 * the summary was read; it runs the dry run once more and writes only when it still matches.
 */
import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { formatJobLedgerShortLine, formatJobLedgerSummaryLine } from '../../lib/ledgerDisplayPrefixes'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { countedLabel } from '../../lib/batchWords'
import { summarizeCostBatchOps } from '../../lib/costBatches/costBatchPayload'
import { COST_BATCH_FIELD_LABELS, compareDryRunToPlan, costBatchPlanSignature, type CostBatchApplyResult, type CostBatchComparison } from '../../lib/costBatches/costBatchDryRunCompare'
import { costBatchJobLines } from '../../lib/costBatches/costBatchList'
import { buildCostMovePlan, costMoveDefaultAllocationNote, usd, type CostMoveJobWords } from '../../lib/costBatches/costMovePlan'
import { costMoveTotals, costMoveTotalsWords, type CostMoveRow } from '../../lib/costBatches/costMoveRows'
import { applyCostBatch, dryRunCostBatch, type CostMoveJobRow } from '../../lib/costBatches/costMoveReads'
import { CostBatchJobPicker } from './CostBatchJobPicker'

/** Above the job window (1010) and the windows it opens itself (the pay application at 1030). */
export const COST_MOVE_MODAL_Z_INDEX = 1100

const body: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.75rem' }
const h3: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const field: CSSProperties = { padding: '0.4rem 0.6rem', fontSize: '0.875rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }
const labelStyle: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const button: CSSProperties = { padding: '0.4rem 0.9rem', fontSize: '0.8125rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600 }
const primaryButton: CSSProperties = { ...button, background: '#2563eb', color: '#ffffff', border: '1px solid transparent' }
const table: CSSProperties = { borderCollapse: 'collapse', fontSize: '0.8125rem' }
const th: CSSProperties = { textAlign: 'left', padding: '0.25rem 0.6rem', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }
const td: CSSProperties = { padding: '0.25rem 0.6rem', borderBottom: '1px solid var(--border)', color: 'var(--text-base)' }
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

type DryRunState = {
  /** `costBatchPlanSignature` of the payload the dry run was made with. */
  signature: string
  result: CostBatchApplyResult
  comparison: CostBatchComparison
}

export type CostMoveApplied = { batchId: string; label: string }

export type CostMoveModalProps = {
  /** The job the rows are on. */
  sourceJob: CostMoveJobRow
  /** The rows ticked on it — the window moves these and nothing else. */
  rows: readonly CostMoveRow[]
  onRequestClose: () => void
  /** The batch was written: the caller reads its rows and its batch list again. The window stays up with the result. */
  onApplied: (applied: CostMoveApplied) => void
  zIndex?: number
}

export function CostMoveModal({ sourceJob, rows, onRequestClose, onApplied, zIndex = COST_MOVE_MODAL_Z_INDEX }: CostMoveModalProps) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const { prefixMap } = useLedgerDisplayPrefixes()

  const [target, setTarget] = useState<CostMoveJobRow | null>(null)
  const [reason, setReason] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const todayYmd = useMemo(() => todayYmdInAppTz(), [])
  const [allocationNote, setAllocationNote] = useState(() => costMoveDefaultAllocationNote(todayYmd))

  const [dryRun, setDryRun] = useState<DryRunState | null>(null)
  const [dryRunning, setDryRunning] = useState(false)
  const [readSummary, setReadSummary] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<CostMoveApplied | null>(null)

  const totals = useMemo(() => costMoveTotals(rows), [rows])

  const jobWords = useCallback(
    (j: CostMoveJobRow): CostMoveJobWords => ({ id: j.id, label: formatJobLedgerShortLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.click_number) }),
    [prefixMap],
  )
  const jobLabel = useCallback(
    (id: string): string => {
      if (sourceJob.id === id) return jobWords(sourceJob).label
      if (target && target.id === id) return jobWords(target).label
      return `job ${id.slice(0, 8)}…`
    },
    [sourceJob, target, jobWords],
  )

  const plan = useMemo(() => {
    if (!target || !user) return null
    return buildCostMovePlan({ todayYmd, sourceJob: jobWords(sourceJob), targetJob: jobWords(target), rows, reason, sourceRef, authorUserId: user.id, allocationNote })
  }, [target, user, todayYmd, jobWords, sourceJob, rows, reason, sourceRef, allocationNote])

  const planSummary = useMemo(() => (plan?.payload ? summarizeCostBatchOps(plan.payload.ops) : null), [plan])
  const signature = plan?.payload ? costBatchPlanSignature(plan.payload) : null
  const dryRunCurrent = dryRun !== null && signature !== null && dryRun.signature === signature
  const canApply = dryRunCurrent && dryRun.comparison.matches && readSummary && !applying && !dryRunning && !applied
  const opsCount = plan?.payload?.ops.length ?? 0

  const runDryRun = useCallback(async (): Promise<DryRunState | null> => {
    if (!plan?.payload || !planSummary || !signature) return null
    setDryRunning(true)
    try {
      const result = await dryRunCostBatch(plan.payload)
      const comparison = compareDryRunToPlan(planSummary, result, jobLabel)
      const next = { signature, result, comparison }
      setDryRun(next)
      setReadSummary(false)
      return next
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The dry run was refused'), 'error', 9000)
      setDryRun(null)
      return null
    } finally {
      setDryRunning(false)
    }
  }, [plan, planSummary, signature, jobLabel, showToast])

  const runApply = useCallback(async () => {
    if (!canApply || !plan?.payload) return
    setApplying(true)
    try {
      // The dry run once more, right before the write: the rows may have moved since the first one.
      const again = await runDryRun()
      if (!again) return
      if (!again.comparison.matches) {
        showToast('The dry run no longer matches the plan. Read the new summary before applying.', 'warning', 9000)
        return
      }
      const result = await applyCostBatch(plan.payload)
      if (!result.batchId) throw new Error('Apply replied without a batch id.')
      const done = { batchId: result.batchId, label: plan.payload.label }
      setApplied(done)
      showToast(`Applied “${plan.payload.label}” — batch ${result.batchId.slice(0, 8)}…`, 'success', 8000)
      onApplied(done)
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Apply was refused'), 'error', 9000)
    } finally {
      setApplying(false)
    }
  }, [canApply, plan, runDryRun, showToast, onApplied])

  const title = applied ? 'Cost moved' : `Move ${totals.all.rows} ${totals.all.rows === 1 ? 'row' : 'rows'} to another job`

  const footer = applied ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" style={primaryButton} onClick={onRequestClose}>
        Done
      </button>
    </div>
  ) : (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" style={{ ...button, opacity: plan?.payload && !dryRunning && !applying ? 1 : 0.5 }} disabled={!plan?.payload || dryRunning || applying} onClick={() => void runDryRun()}>
        {dryRunning ? 'Dry-running…' : countedLabel('Dry-run', opsCount, 'op')}
      </button>
      {dryRun && dryRunCurrent ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
          <input type="checkbox" checked={readSummary} onChange={(e) => setReadSummary(e.target.checked)} disabled={!dryRun.comparison.matches} aria-label="I read the dry run’s summary" />I read the dry run’s summary
        </label>
      ) : null}
      <button type="button" style={{ ...primaryButton, opacity: canApply ? 1 : 0.5, marginLeft: 'auto' }} disabled={!canApply} onClick={() => void runApply()}>
        {applying ? 'Applying…' : countedLabel('Apply', opsCount, 'op')}
      </button>
      {dryRun && !dryRunCurrent ? <span style={{ ...quiet, color: 'var(--text-amber-800)', width: '100%' }}>The plan changed since the dry run. Dry-run it again.</span> : null}
    </div>
  )

  return (
    <ResponsiveModalShell title={title} onRequestClose={onRequestClose} footer={footer} maxWidthDesktop={760} zIndex={zIndex}>
      <div style={body}>
        <p style={quiet}>
          From <strong style={{ color: 'var(--text-strong)' }}>{formatJobLedgerSummaryLine(prefixMap, sourceJob.service_type_id, sourceJob.hcp_number, sourceJob.job_name, sourceJob.job_address, sourceJob.click_number)}</strong>: {costMoveTotalsWords(totals)}.
        </p>

        {applied ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-green-700)', fontWeight: 600 }}>
            Applied “{applied.label}” as batch <code>{applied.batchId}</code>. The job’s rows and its batch list are read again behind this window; the batch has a Revert there.
          </p>
        ) : (
          <>
            <section aria-labelledby="cost-move-target" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 id="cost-move-target" style={h3}>
                To
              </h3>
              {!target ? (
                <CostBatchJobPicker title="The job the rows move to" excludeJobId={sourceJob.id} onPick={setTarget} autoFocus />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--text-strong)' }}>{formatJobLedgerSummaryLine(prefixMap, target.service_type_id, target.hcp_number, target.job_name, target.job_address, target.click_number)}</strong>
                  <button type="button" style={button} onClick={() => setTarget(null)}>
                    Change job
                  </button>
                </div>
              )}
            </section>

            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <label style={labelStyle}>
                <span>Reason — kept on the batch and in both notes</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} style={{ ...field, resize: 'vertical' }} placeholder="Owner decision 2026-10-29: the trip rows belong to the rough-in draw." />
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={labelStyle}>
                  <span>Plan (source_ref) — the file or note the plan is written in</span>
                  <input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} style={field} placeholder="HCP583-Sort_v4_2026-10-29.md" />
                </label>
                <label style={labelStyle}>
                  <span>Note on each moved bank allocation</span>
                  <input value={allocationNote} onChange={(e) => setAllocationNote(e.target.value)} style={field} />
                </label>
              </div>
            </div>
          </>
        )}

        {!applied && plan ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', borderRadius: 6, background: 'var(--bg-subtle)' }}>
            {plan.problems.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
                {plan.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
            {plan.payload && planSummary ? (
              <>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>{plan.payload.label}</p>
                <p style={quiet}>
                  {planSummary.opCount} ops · {planSummary.byOp.allocate} allocate · {planSummary.byOp.supply_repoint} supply_repoint · {planSummary.byOp.clock_repoint} clock_repoint · {planSummary.byOp.thread_note} thread_note
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
                  {costBatchJobLines(planSummary.byJob, jobLabel).map((line) => (
                    <li key={line.jobId}>
                      <span style={{ fontWeight: 600 }}>{line.label}</span> — {line.words}
                    </li>
                  ))}
                  {Object.entries(planSummary.releasedFrom).map(([id, dollars]) => (
                    <li key={`released-${id}`}>
                      <span style={{ fontWeight: 600 }}>{jobLabel(id)}</span> — releases {usd(dollars)} of bank allocations
                    </li>
                  ))}
                </ul>
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-link)' }}>The two notes, as they will read</summary>
                  <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
                    {plan.ops
                      .filter((op) => op.op === 'thread_note')
                      .map((op) => (
                        <li key={op.op === 'thread_note' ? `${op.job_id}:${op.body.slice(0, 40)}` : ''} style={{ marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 600 }}>{op.op === 'thread_note' ? jobLabel(op.job_id) : ''}</span>: {op.op === 'thread_note' ? op.body : ''}
                        </li>
                      ))}
                  </ul>
                </details>
              </>
            ) : null}
            {plan.move.skipped.length > 0 ? (
              <p style={{ ...quiet, color: 'var(--text-amber-800)' }}>
                {plan.move.skipped.length} ticked {plan.move.skipped.length === 1 ? 'row stays' : 'rows stay'} where {plan.move.skipped.length === 1 ? 'it is' : 'they are'}: {[...new Set(plan.move.skipped.map((s) => s.why))].join(' ')}
              </p>
            ) : null}
          </div>
        ) : !applied ? (
          <p style={quiet}>{!target ? 'Pick the job the rows move to, and the plan appears here.' : 'Sign in as a dev to plan a batch.'}</p>
        ) : null}

        {!applied && dryRun && dryRunCurrent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} aria-live="polite">
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: dryRun.comparison.matches ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
              {dryRun.comparison.matches ? `Dry run matches the plan to the cent — ${dryRun.result.opCount} ops, every write performed and unwound.` : 'Dry run does not match the plan.'}
            </p>
            {dryRun.comparison.problems.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
                {dryRun.comparison.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
            <div style={{ overflowX: 'auto' }}>
              <table style={table} aria-label="Dry run against the plan">
                <thead>
                  <tr>
                    <th style={th}>Job</th>
                    <th style={th}>Field</th>
                    <th style={{ ...th, textAlign: 'right' }}>Plan</th>
                    <th style={{ ...th, textAlign: 'right' }}>Dry run</th>
                    <th style={th}>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {dryRun.comparison.lines
                    .filter((l) => l.plan !== 0 || l.dryRun !== 0)
                    .map((l) => (
                      <tr key={`${l.jobId}:${l.field}`}>
                        <td style={td}>{jobLabel(l.jobId)}</td>
                        <td style={td}>{COST_BATCH_FIELD_LABELS[l.field]}</td>
                        <td style={tdNum}>{l.field === 'allocated' || l.field === 'otherCharges' ? usd(l.plan) : l.plan}</td>
                        <td style={tdNum}>{l.field === 'allocated' || l.field === 'otherCharges' ? usd(l.dryRun) : l.dryRun}</td>
                        <td style={{ ...td, color: l.ok ? 'var(--text-green-700)' : 'var(--text-red-700)', fontWeight: 700 }}>{l.ok ? '✓' : '✗'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}
