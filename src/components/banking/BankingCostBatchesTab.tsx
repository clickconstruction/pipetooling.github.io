/**
 * Banking → Cost batches (dev-only): move one job's cost rows onto other jobs through
 * `cost_batch_apply` without a hand-built payload, and read or revert the batches.
 *
 * The screen reads every cost row on a chosen job by source (`?job=` or the picker), the dev ticks
 * rows — by hand, by source, by card, by date range — picks the job they go to, writes the reason
 * and the plan's name, and the kernels build the batch: `allocate` with `from_job_id` for bank rows,
 * `supply_repoint`, `clock_repoint`, one `thread_note` on each job. **Dry run** calls the RPC with
 * `p_dry_run = true` and the screen lays the reply's `by_job` beside the plan's own summary, to the
 * cent. **Apply** is live only after a matching dry run of this exact plan and the dev's word that
 * the summary was read; it runs the dry run once more and writes only when it still matches. The
 * batch list below is `docs/COST_BATCHES.md`'s "Not yet built" screen. Self-contained like the
 * Visuals tab: zero props, own reads, the parent dispatcher skips its master fetch while here.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { formatJobLedgerShortLine, formatJobLedgerSummaryLine } from '../../lib/ledgerDisplayPrefixes'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { countedLabel } from '../../lib/batchWords'
import { summarizeCostBatchOps } from '../../lib/costBatches/costBatchPayload'
import { COST_BATCH_FIELD_LABELS, compareDryRunToPlan, costBatchPlanSignature, type CostBatchApplyResult, type CostBatchComparison } from '../../lib/costBatches/costBatchDryRunCompare'
import { costBatchJobLines } from '../../lib/costBatches/costBatchList'
import { buildCostMovePlan, costMoveDefaultAllocationNote, usd, type CostMoveJobWords } from '../../lib/costBatches/costMovePlan'
import { COST_MOVE_SOURCES, COST_MOVE_SOURCE_NOUNS, costMoveCardsPresent, costMoveKeysByCard, costMoveKeysByDateRange, costMoveKeysBySource, costMoveRowKey, costMoveTotals, costMoveTotalsWords, type CostMoveRow } from '../../lib/costBatches/costMoveRows'
import { applyCostBatch, dryRunCostBatch, fetchCostMoveJob, fetchCostMoveRows, type CostMoveJobRow } from '../../lib/costBatches/costMoveReads'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { CostBatchJobPicker } from './CostBatchJobPicker'
import { CostMoveRowsTables } from './CostMoveRowsTables'
import { CostBatchListPanel } from './CostBatchListPanel'

const page: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1.5rem' }
const h2: CSSProperties = { margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }
const field: CSSProperties = { padding: '0.4rem 0.6rem', fontSize: '0.875rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }
const labelStyle: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const button: CSSProperties = { padding: '0.35rem 0.8rem', fontSize: '0.8125rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600 }
const primaryButton: CSSProperties = { ...button, background: '#2563eb', color: 'var(--text-on-bright-solid)', border: '1px solid transparent' }
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

export function BankingCostBatchesTab() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const { prefixMap } = useLedgerDisplayPrefixes()
  const { nicknameByDebitCard } = useMercuryLedgerNicknames()
  const [searchParams, setSearchParams] = useSearchParams()
  const jobId = searchParams.get('job')

  const [job, setJob] = useState<CostMoveJobRow | null>(null)
  const [rawRows, setRawRows] = useState<CostMoveRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [target, setTarget] = useState<CostMoveJobRow | null>(null)
  const [reason, setReason] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const todayYmd = useMemo(() => todayYmdInAppTz(), [])
  const [allocationNote, setAllocationNote] = useState(() => costMoveDefaultAllocationNote(todayYmd))

  const [cardPick, setCardPick] = useState('')
  const [fromYmd, setFromYmd] = useState('')
  const [toYmd, setToYmd] = useState('')

  const [dryRun, setDryRun] = useState<DryRunState | null>(null)
  const [dryRunning, setDryRunning] = useState(false)
  const [readSummary, setReadSummary] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<{ batchId: string; label: string } | null>(null)
  const [batchesRefresh, setBatchesRefresh] = useState(0)

  const setJobParam = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (id) p.set('job', id)
          else p.delete('job')
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  // The job and its rows, read again on every change of job and on Reload.
  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setRawRows(null)
      setLoadError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [j, rows] = await Promise.all([fetchCostMoveJob(jobId), fetchCostMoveRows(jobId, {})])
        if (cancelled) return
        setJob(j)
        setRawRows(rows)
        setLoadError(j ? null : 'That job id is not in the ledger.')
      } catch (e: unknown) {
        if (!cancelled) setLoadError(formatErrorMessage(e, 'Could not load the job’s cost rows'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId, reloads])

  // A new job or a reload starts the selection and the dry run over.
  useEffect(() => {
    setSelected(new Set())
    setDryRun(null)
    setReadSummary(false)
    setApplied(null)
  }, [jobId, reloads])

  // Card nicknames are read beside the rows and may land after them: resolve them at render.
  const rows = useMemo<CostMoveRow[]>(
    () => (rawRows ?? []).map((r) => (r.source === 'bank' && r.cardId ? { ...r, cardNickname: nicknameByDebitCard[r.cardId] ?? null } : r)),
    [rawRows, nicknameByDebitCard],
  )

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(costMoveRowKey(r))), [rows, selected])
  const selectedTotals = useMemo(() => costMoveTotals(selectedRows), [selectedRows])
  const cards = useMemo(() => costMoveCardsPresent(rows), [rows])

  const jobWords = useCallback(
    (j: CostMoveJobRow): CostMoveJobWords => ({ id: j.id, label: formatJobLedgerShortLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.click_number) }),
    [prefixMap],
  )
  const jobLabel = useCallback(
    (id: string): string => {
      if (job && job.id === id) return jobWords(job).label
      if (target && target.id === id) return jobWords(target).label
      return `job ${id.slice(0, 8)}…`
    },
    [job, target, jobWords],
  )

  const plan = useMemo(() => {
    if (!job || !target || !user) return null
    return buildCostMovePlan({ todayYmd, sourceJob: jobWords(job), targetJob: jobWords(target), rows: selectedRows, reason, sourceRef, authorUserId: user.id, allocationNote })
  }, [job, target, user, todayYmd, jobWords, selectedRows, reason, sourceRef, allocationNote])

  const planSummary = useMemo(() => (plan?.payload ? summarizeCostBatchOps(plan.payload.ops) : null), [plan])
  const signature = plan?.payload ? costBatchPlanSignature(plan.payload) : null
  const dryRunCurrent = dryRun !== null && signature !== null && dryRun.signature === signature
  const canApply = dryRunCurrent && dryRun.comparison.matches && readSummary && !applying && !dryRunning

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const setMany = useCallback((keys: readonly string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const k of keys) if (on) next.add(k)
      else next.delete(k)
      return next
    })
  }, [])

  const cardKeys = useMemo(() => (cardPick === '' ? [] : costMoveKeysByCard(rows, cardPick === '__none__' ? null : cardPick)), [rows, cardPick])
  const rangeKeys = useMemo(() => (fromYmd || toYmd ? costMoveKeysByDateRange(rows, fromYmd, toYmd) : []), [rows, fromYmd, toYmd])

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
      setApplied({ batchId: result.batchId, label: plan.payload.label })
      showToast(`Applied “${plan.payload.label}” — batch ${result.batchId.slice(0, 8)}…`, 'success', 8000)
      setBatchesRefresh((n) => n + 1)
      setReloads((n) => n + 1)
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Apply was refused'), 'error', 9000)
    } finally {
      setApplying(false)
    }
  }, [canApply, plan, runDryRun, showToast])

  const opsCount = plan?.payload?.ops.length ?? 0

  return (
    <div style={page}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <h2 style={h2}>Cost batches</h2>
        <p style={quiet}>
          Devs only. Move a job’s cost rows onto other jobs as one recorded, reversible batch through <code>cost_batch_apply</code>: tick rows, pick the job they go to, dry-run, read the summary, apply. Every batch is listed below with a Revert. Contract: docs/COST_BATCHES.md.
        </p>
      </header>

      <section aria-labelledby="move-cost-source" style={card}>
        <h3 id="move-cost-source" style={{ ...h2, fontSize: '1rem' }}>
          The job the rows are on
        </h3>
        {!jobId ? (
          <CostBatchJobPicker title="Pick the job whose rows you are moving" onPick={(j) => setJobParam(j.id)} autoFocus />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text-strong)' }}>{job ? formatJobLedgerSummaryLine(prefixMap, job.service_type_id, job.hcp_number, job.job_name, job.job_address, job.click_number) : loading ? 'Loading…' : `job ${jobId.slice(0, 8)}…`}</strong>
            <button type="button" style={button} onClick={() => setJobParam(null)}>
              Change job
            </button>
            <button type="button" style={button} onClick={() => setReloads((n) => n + 1)} disabled={loading}>
              {loading ? 'Reading…' : 'Read the rows again'}
            </button>
          </div>
        )}
        {loadError ? <p style={{ ...quiet, color: 'var(--text-red-700)' }}>{loadError}</p> : null}
      </section>

      {jobId && rawRows ? (
        <>
          <section aria-labelledby="move-cost-pick" style={card}>
            <h3 id="move-cost-pick" style={{ ...h2, fontSize: '1rem' }}>
              Tick the rows to move
            </h3>
            <p style={quiet}>On the job: {costMoveTotalsWords(costMoveTotals(rows))}</p>
            <p style={{ ...quiet, color: 'var(--text-strong)' }}>Ticked: {costMoveTotalsWords(selectedTotals)}</p>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={labelStyle}>
                <span>By source</span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {COST_MOVE_SOURCES.filter((s) => s !== 'other').map((s) => {
                    const keys = costMoveKeysBySource(rows, s)
                    const allOn = keys.length > 0 && keys.every((k) => selected.has(k))
                    return (
                      <button key={s} type="button" style={{ ...button, opacity: keys.length === 0 ? 0.5 : 1 }} disabled={keys.length === 0} onClick={() => setMany(keys, !allOn)}>
                        {countedLabel(allOn ? 'Untick' : 'Tick', keys.length, COST_MOVE_SOURCE_NOUNS[s])}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label style={labelStyle}>
                <span>By card</span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <select value={cardPick} onChange={(e) => setCardPick(e.target.value)} style={field} aria-label="Card">
                    <option value="">Pick a card…</option>
                    {cards.map((c) => (
                      <option key={c.cardId ?? '__none__'} value={c.cardId ?? '__none__'}>
                        {c.cardId ? (c.nickname ?? formatMercuryDebitCardIdCompact(c.cardId)) : 'No card (ACH, wire, check)'} · {c.rows} {c.rows === 1 ? 'row' : 'rows'}
                      </option>
                    ))}
                  </select>
                  <button type="button" style={{ ...button, opacity: cardKeys.length === 0 ? 0.5 : 1 }} disabled={cardKeys.length === 0} onClick={() => setMany(cardKeys, true)}>
                    {countedLabel('Tick', cardKeys.length, 'row')}
                  </button>
                </div>
              </label>
              <div style={labelStyle}>
                <span>By date</span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="date" value={fromYmd} onChange={(e) => setFromYmd(e.target.value)} style={field} aria-label="From date" />
                  <span style={quiet}>to</span>
                  <input type="date" value={toYmd} onChange={(e) => setToYmd(e.target.value)} style={field} aria-label="To date" />
                  <button type="button" style={{ ...button, opacity: rangeKeys.length === 0 ? 0.5 : 1 }} disabled={rangeKeys.length === 0} onClick={() => setMany(rangeKeys, true)}>
                    {countedLabel('Tick', rangeKeys.length, 'row')}
                  </button>
                </div>
              </div>
              <button type="button" style={{ ...button, opacity: selected.size === 0 ? 0.5 : 1 }} disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
                {countedLabel('Untick', selected.size, 'row')}
              </button>
            </div>
            <CostMoveRowsTables rows={rows} selected={selected} onToggle={toggle} onSetMany={setMany} />
          </section>

          <section aria-labelledby="move-cost-plan" style={card}>
            <h3 id="move-cost-plan" style={{ ...h2, fontSize: '1rem' }}>
              Move {selectedTotals.all.rows} ticked {selectedTotals.all.rows === 1 ? 'row' : 'rows'} to…
            </h3>
            {!target ? (
              <CostBatchJobPicker title="The job the rows move to" excludeJobId={jobId} onPick={setTarget} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text-strong)' }}>{formatJobLedgerSummaryLine(prefixMap, target.service_type_id, target.hcp_number, target.job_name, target.job_address, target.click_number)}</strong>
                <button type="button" style={button} onClick={() => setTarget(null)}>
                  Change target
                </button>
              </div>
            )}
            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
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

            {plan ? (
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
            ) : (
              <p style={quiet}>{!target ? 'Pick the job the rows move to, and the plan appears here.' : 'Sign in as a dev to plan a batch.'}</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={{ ...button, opacity: plan?.payload && !dryRunning && !applying ? 1 : 0.5 }} disabled={!plan?.payload || dryRunning || applying} onClick={() => void runDryRun()}>
                {dryRunning ? 'Dry-running…' : countedLabel('Dry-run', opsCount, 'op')}
              </button>
              {dryRun && dryRunCurrent ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
                  <input type="checkbox" checked={readSummary} onChange={(e) => setReadSummary(e.target.checked)} disabled={!dryRun.comparison.matches} aria-label="I read the dry run’s summary" />I read the dry run’s summary
                </label>
              ) : null}
              <button type="button" style={{ ...primaryButton, opacity: canApply ? 1 : 0.5 }} disabled={!canApply} onClick={() => void runApply()}>
                {applying ? 'Applying…' : countedLabel('Apply', opsCount, 'op')}
              </button>
              {dryRun && !dryRunCurrent ? <span style={{ ...quiet, color: 'var(--text-amber-800)' }}>The plan changed since the dry run. Dry-run it again.</span> : null}
            </div>

            {dryRun && dryRunCurrent ? (
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

            {applied ? (
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-green-700)', fontWeight: 600 }}>
                Applied “{applied.label}” as batch <code>{applied.batchId}</code>.{' '}
                <a href={`#cost-batch-${applied.batchId}`} style={{ color: 'var(--text-link)' }}>
                  See it in the list
                </a>
                .
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      <section aria-labelledby="cost-batches-list" style={card}>
        <h3 id="cost-batches-list" style={{ ...h2, fontSize: '1rem' }}>
          Batches
        </h3>
        <CostBatchListPanel jobId={jobId} refreshKey={batchesRefresh} highlightBatchId={applied?.batchId ?? null} />
      </section>
    </div>
  )
}
