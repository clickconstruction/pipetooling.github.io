/**
 * Banking → Cost batches: the batches that touched a job and the newest batches company-wide
 * (`cost_batches`, with the touching read over `cost_batch_ops`), each with its label, reason,
 * plan, when, by whom, how many ops, the summary by job, its ops on demand, and **Revert** behind a
 * typed confirmation — the "Not yet built" item of `docs/COST_BATCHES.md`. Devs only by RLS.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { formatJobLedgerShortLine } from '../../lib/ledgerDisplayPrefixes'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  COST_BATCH_REVERT_WORD,
  costBatchJobLines,
  costBatchOpWords,
  costBatchRevertReady,
  costBatchSummaryWords,
  type CostBatchOpRow,
  type CostBatchRow,
} from '../../lib/costBatches/costBatchList'
import { COST_BATCH_LIST_LIMIT, fetchCostBatchLists, fetchCostBatchOps, fetchJobWordsByIds, revertCostBatch, type CostMoveJobRow } from '../../lib/costBatches/costMoveReads'

const heading: CSSProperties = { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }
const smallButton: CSSProperties = { padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600 }
const dangerButton: CSSProperties = { ...smallButton, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', border: '1px solid var(--border-red)' }
const field: CSSProperties = { padding: '0.35rem 0.5rem', fontSize: '0.8125rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }
const chip: CSSProperties = { display: 'inline-block', padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700 }

function whenWords(iso: string): string {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return iso
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ms))
}

export type CostBatchListPanelProps = {
  /** The job the Move cost screen is on; null lists only the company-wide batches. */
  jobId: string | null
  /** Bump to reload after an apply or a revert elsewhere on the screen. */
  refreshKey: number
  /** The batch just applied: drawn with a ring so the dev finds it. */
  highlightBatchId: string | null
}

export function CostBatchListPanel({ jobId, refreshKey, highlightBatchId }: CostBatchListPanelProps) {
  const { showToast } = useToastContext()
  const { prefixMap } = useLedgerDisplayPrefixes()
  const [lists, setLists] = useState<{ onJob: CostBatchRow[]; all: CostBatchRow[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobWords, setJobWords] = useState<Map<string, CostMoveJobRow>>(() => new Map())
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchCostBatchLists(jobId)
      .then(async (next) => {
        if (cancelled) return
        setLists(next)
        setError(null)
        const ids = new Set<string>()
        for (const b of [...next.onJob, ...next.all]) for (const id of Object.keys(b.byJob)) ids.add(id)
        if (ids.size > 0) {
          const words = await fetchJobWordsByIds([...ids])
          if (!cancelled) setJobWords(words)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load the cost batches'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [jobId, refreshKey, reloads])

  const jobLabel = useCallback(
    (id: string) => {
      const j = jobWords.get(id)
      return j ? formatJobLedgerShortLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.click_number) : `job ${id.slice(0, 8)}…`
    },
    [jobWords, prefixMap],
  )

  const reload = useCallback(() => setReloads((n) => n + 1), [])

  const onJobIds = useMemo(() => new Set((lists?.onJob ?? []).map((b) => b.id)), [lists])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error ? <p style={{ ...quiet, color: 'var(--text-red-700)' }}>{error}</p> : null}
      {jobId ? (
        <section aria-labelledby="cost-batches-on-job" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 id="cost-batches-on-job" style={heading}>
            Batches that touched this job{lists ? ` (${lists.onJob.length})` : ''}
          </h3>
          {loading && !lists ? <p style={quiet}>Loading…</p> : null}
          {lists && lists.onJob.length === 0 ? <p style={quiet}>This job has not been touched by a cost batch.</p> : null}
          {lists?.onJob.map((b) => <BatchCard key={b.id} batch={b} jobLabel={jobLabel} highlighted={b.id === highlightBatchId} onChanged={reload} onToast={showToast} />)}
        </section>
      ) : null}
      <section aria-labelledby="cost-batches-all" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h3 id="cost-batches-all" style={heading}>
          Every batch{lists ? ` (newest ${Math.min(lists.all.length, COST_BATCH_LIST_LIMIT)})` : ''}
        </h3>
        {loading && !lists ? <p style={quiet}>Loading…</p> : null}
        {lists && lists.all.length === 0 ? <p style={quiet}>There are no cost batches yet.</p> : null}
        {lists?.all
          .filter((b) => !onJobIds.has(b.id))
          .map((b) => <BatchCard key={b.id} batch={b} jobLabel={jobLabel} highlighted={b.id === highlightBatchId} onChanged={reload} onToast={showToast} />)}
        {lists && jobId && lists.all.some((b) => onJobIds.has(b.id)) ? <p style={quiet}>The batches above that touched this job are listed once, in the first section.</p> : null}
      </section>
    </div>
  )
}

function BatchCard({
  batch,
  jobLabel,
  highlighted,
  onChanged,
  onToast,
}: {
  batch: CostBatchRow
  jobLabel: (id: string) => string
  highlighted: boolean
  onChanged: () => void
  onToast: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void
}) {
  const [ops, setOps] = useState<CostBatchOpRow[] | null>(null)
  const [opsOpen, setOpsOpen] = useState(false)
  const [opsLoading, setOpsLoading] = useState(false)
  const [revertOpen, setRevertOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const toggleOps = useCallback(async () => {
    const next = !opsOpen
    setOpsOpen(next)
    if (next && ops === null) {
      setOpsLoading(true)
      try {
        setOps(await fetchCostBatchOps(batch.id))
      } catch (e: unknown) {
        onToast(formatErrorMessage(e, 'Could not load the ops'), 'error')
      } finally {
        setOpsLoading(false)
      }
    }
  }, [opsOpen, ops, batch.id, onToast])

  const ready = costBatchRevertReady(batch, typed, reason)

  const revert = useCallback(async () => {
    if (!ready || busy) return
    setBusy(true)
    try {
      await revertCostBatch(batch.id, reason)
      onToast(`Reverted “${batch.label}”: every row is back where it was.`, 'success')
      setRevertOpen(false)
      setTyped('')
      setReason('')
      onChanged()
    } catch (e: unknown) {
      onToast(formatErrorMessage(e, 'Could not revert the batch'), 'error')
    } finally {
      setBusy(false)
    }
  }, [ready, busy, batch.id, batch.label, reason, onToast, onChanged])

  const byOpCounts = useMemo(() => {
    if (!ops) return undefined
    const counts: Partial<Record<string, number>> = {}
    for (const op of ops) counts[op.opType] = (counts[op.opType] ?? 0) + 1
    return counts
  }, [ops])

  const reverted = batch.revertedAt !== null

  return (
    <article id={`cost-batch-${batch.id}`} aria-label={batch.label} style={{ ...card, border: highlighted ? '2px solid var(--border-blue)' : card.border, opacity: reverted ? 0.8 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>{batch.label}</strong>
        {reverted ? <span style={{ ...chip, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>reverted</span> : <span style={{ ...chip, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }}>applied</span>}
        <span style={quiet}>
          {whenWords(batch.appliedAt)} · {batch.authorLabel} · {batch.opCount} {batch.opCount === 1 ? 'op' : 'ops'}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-base)' }}>{batch.reason}</p>
      {batch.sourceRef ? <p style={quiet}>Plan: {batch.sourceRef}</p> : null}
      <p style={quiet}>{costBatchSummaryWords(batch.byJob, byOpCounts)}</p>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
        {costBatchJobLines(batch.byJob, jobLabel).map((line) => (
          <li key={line.jobId}>
            <span style={{ fontWeight: 600 }}>{line.label}</span> — {line.words}
          </li>
        ))}
      </ul>
      {reverted ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
          Reverted {whenWords(batch.revertedAt ?? '')}
          {batch.revertReason ? ` — ${batch.revertReason}` : ''}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={smallButton} onClick={() => void toggleOps()} aria-expanded={opsOpen}>
          {opsOpen ? 'Hide ops' : `Show ${batch.opCount} ${batch.opCount === 1 ? 'op' : 'ops'}`}
        </button>
        <span style={{ ...quiet, fontFamily: 'ui-monospace, monospace' }}>{batch.id}</span>
        {!reverted ? (
          <button type="button" style={{ ...smallButton, marginLeft: 'auto' }} onClick={() => setRevertOpen((v) => !v)} aria-expanded={revertOpen}>
            Revert…
          </button>
        ) : null}
      </div>
      {opsOpen ? (
        opsLoading ? (
          <p style={quiet}>Loading the ops…</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', maxHeight: 320, overflowY: 'auto' }}>
            {(ops ?? []).map((op) => (
              <li key={op.seq} value={op.seq}>
                <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>{op.opType}</span> {costBatchOpWords(op, jobLabel)}
              </li>
            ))}
          </ol>
        )
      ) : null}
      {revertOpen && !reverted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.6rem', borderRadius: 6, background: 'var(--bg-red-tint)' }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-800)' }}>
            Reverting restores every before-image in reverse order and leaves a note on each touched job. A batch reverts once. Type <strong>{COST_BATCH_REVERT_WORD}</strong> and say why.
          </p>
          <input aria-label={`Type ${COST_BATCH_REVERT_WORD} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={COST_BATCH_REVERT_WORD} style={{ ...field, maxWidth: 200 }} autoComplete="off" />
          <textarea aria-label="Why this batch is reverted" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why — written on the batch and in the notes" style={{ ...field, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" style={{ ...dangerButton, opacity: ready && !busy ? 1 : 0.5 }} disabled={!ready || busy} onClick={() => void revert()}>
              {busy ? 'Reverting…' : `Revert ${batch.opCount} ${batch.opCount === 1 ? 'op' : 'ops'}`}
            </button>
            <button type="button" style={smallButton} onClick={() => setRevertOpen(false)}>
              Keep the batch
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
