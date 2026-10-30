/**
 * Banking → Cost batches: the job search the Move cost screen uses twice — for the job whose rows
 * are read, and for the job they move to. The app's own `search_jobs_ledger` behind a box, the
 * results as the ledger lines read everywhere else (`JP523 · Mission Hills - 123 Main`).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { formatJobLedgerSummaryLine } from '../../lib/ledgerDisplayPrefixes'
import { searchJobsForCostMove, type CostMoveJobRow } from '../../lib/costBatches/costMoveReads'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'

const SEARCH_DEBOUNCE_MS = 250

const field: CSSProperties = { padding: '0.4rem 0.6rem', fontSize: '0.875rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', width: '100%', maxWidth: 480, font: 'inherit' }
const rowButton: CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-base)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }

export function CostBatchJobPicker({
  title,
  placeholder = 'Search by number, name or address',
  excludeJobId,
  onPick,
  autoFocus,
}: {
  title: string
  placeholder?: string
  /** A job the list leaves out (the source job, when picking the target). */
  excludeJobId?: string | null
  onPick: (job: CostMoveJobRow) => void
  autoFocus?: boolean
}) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CostMoveJobRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setResults(null)
      setLoading(false)
      setError(null)
      return
    }
    const mine = ++seq.current
    setLoading(true)
    const t = window.setTimeout(() => {
      void searchJobsForCostMove(query)
        .then((rows) => {
          if (seq.current !== mine) return
          setResults(rows.filter((r) => r.id !== excludeJobId))
          setError(null)
        })
        .catch((e: unknown) => {
          if (seq.current !== mine) return
          setError(formatErrorMessage(e, 'Could not search jobs'))
        })
        .finally(() => {
          if (seq.current === mine) setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [q, excludeJobId])

  const inputId = `cost-batch-job-picker-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label htmlFor={inputId} style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
        {title}
      </label>
      <input id={inputId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} style={field} autoComplete="off" />
      {loading ? <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Searching…</p> : null}
      {error ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
      {results && results.length === 0 && !loading ? <EmptyState compact main={`No jobs match ‘${q.trim()}’.`} /> : null}
      {results && results.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: 480 }}>
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" style={rowButton} onClick={() => onPick(r)}>
                {formatJobLedgerSummaryLine(prefixMap, r.service_type_id, r.hcp_number, r.job_name, r.job_address, r.click_number)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
