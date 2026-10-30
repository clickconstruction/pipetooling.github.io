/**
 * Banking → Cost batches (dev-only, v2.6115): the audit of every cost batch — `cost_batches` with
 * its ops — newest first, each with its label, reason, plan, when, by whom, the summary by job,
 * its ops on demand and **Revert** behind the typed word; `?job=` (or the picker) adds the batches
 * that touched one job. This is `docs/COST_BATCHES.md`'s "Not yet built" list. The move itself is
 * made on the job: the job window's Costs tab lists every cost row on it and **Move N rows…**
 * opens the Move cost window (`CostMoveModal`). Self-contained like the Visuals tab: zero props,
 * own reads, the parent dispatcher skips its master fetch while here.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { formatJobLedgerSummaryLine } from '../../lib/ledgerDisplayPrefixes'
import { formatErrorMessage } from '../../utils/errorHandling'
import { fetchCostMoveJob, type CostMoveJobRow } from '../../lib/costBatches/costMoveReads'
import { CostBatchJobPicker } from '../costBatches/CostBatchJobPicker'
import { CostBatchListPanel } from '../costBatches/CostBatchListPanel'

const page: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1.5rem' }
const h2: CSSProperties = { margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }
const button: CSSProperties = { padding: '0.35rem 0.8rem', fontSize: '0.8125rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600 }

export function BankingCostBatchesTab() {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const [searchParams, setSearchParams] = useSearchParams()
  const jobId = searchParams.get('job')

  const [job, setJob] = useState<CostMoveJobRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  // The job's words for its heading, read on every change of `?job=`.
  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setLoadError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchCostMoveJob(jobId)
      .then((j) => {
        if (cancelled) return
        setJob(j)
        setLoadError(j ? null : 'That job id is not in the ledger.')
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(formatErrorMessage(e, 'Could not load the job'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [jobId])

  return (
    <div style={page}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <h2 style={h2}>Cost batches</h2>
        <p style={quiet}>
          Devs only. Every recorded move of job cost through <code>cost_batch_apply</code>, newest first, each with its ops and a Revert. To move cost, open the job’s window → Costs: every cost row on the job is listed there, and <strong>Move N rows…</strong> opens the window that plans, dry-runs and applies the batch. Contract: docs/COST_BATCHES.md.
        </p>
      </header>

      <section aria-labelledby="cost-batches-job" style={card}>
        <h3 id="cost-batches-job" style={{ ...h2, fontSize: '1rem' }}>
          The batches that touched one job
        </h3>
        {!jobId ? (
          <CostBatchJobPicker title="Pick a job to see the batches that touched it" onPick={(j) => setJobParam(j.id)} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text-strong)' }}>{job ? formatJobLedgerSummaryLine(prefixMap, job.service_type_id, job.hcp_number, job.job_name, job.job_address, job.click_number) : loading ? 'Loading…' : `job ${jobId.slice(0, 8)}…`}</strong>
            <button type="button" style={button} onClick={() => setJobParam(null)}>
              Change job
            </button>
          </div>
        )}
        {loadError ? <p style={{ ...quiet, color: 'var(--text-red-700)' }}>{loadError}</p> : null}
      </section>

      <section aria-labelledby="cost-batches-list" style={card}>
        <h3 id="cost-batches-list" style={{ ...h2, fontSize: '1rem' }}>
          Batches
        </h3>
        <CostBatchListPanel jobId={jobId} showEveryBatch refreshKey={0} highlightBatchId={null} />
      </section>
    </div>
  )
}
