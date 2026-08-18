import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  RECENTLY_ADDED_LIMIT,
  buildRecentlyAddedRows,
  type RecentlyAddedJobRow,
  type RecentlyAddedLeanJob,
} from '../../lib/jobs/recentlyAddedJobs'
import { labelJobsLedgerStatusForDashboard, type JobsLedgerPipelineStatus } from '../../lib/jobsLedgerStatusPipeline'

/**
 * Pipeline "Recently added" view (v2.1809): flat list of the last 100 jobs by
 * time added, ANY status — including Paid, which the board lazy-loads. Its
 * own lean one-shot query (never the board cache), fetched fresh on every
 * mount; the tab mounts this only while the view is open. Read surface —
 * rows open the Job Detail modal.
 */

const STATUS_CHIP: Record<JobsLedgerPipelineStatus, { bg: string; fg: string }> = {
  waiting: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  working: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-link)' },
  ready_to_bill: { bg: 'var(--bg-indigo-100)', fg: 'var(--text-indigo-800)' },
  billed: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  paid: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' },
}

export default function JobsRecentlyAddedList({ onOpenJob }: { onOpenJob: (jobId: string) => void }) {
  const [rows, setRows] = useState<RecentlyAddedJobRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger')
              .select('id, hcp_number, click_number, job_name, customer_name, status, created_at, job_address, gc_customer:gc_customer_id(id, name)')
              .order('created_at', { ascending: false })
              .limit(RECENTLY_ADDED_LIMIT),
          'recently added jobs',
        )
        if (!cancelled) setRows(buildRecentlyAddedRows((data ?? []) as unknown as RecentlyAddedLeanJob[]))
      } catch (e: unknown) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load recently added jobs'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginTop: '0.5rem' }}>
      <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>
          Recently added — last {RECENTLY_ADDED_LIMIT} jobs, any status
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>newest first · click a row to open the job</span>
      </div>
      {error ? (
        <p style={{ margin: 0, padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-red-600)' }}>{error}</p>
      ) : rows == null ? (
        <p role="status" style={{ margin: 0, padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No jobs yet.</p>
      ) : (
        <>
          {rows.map((r) => {
            const chip = r.status ? STATUS_CHIP[r.status] : { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' }
            const statusLabel = r.status ? labelJobsLedgerStatusForDashboard(r.status) : '—'
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenJob(r.id)}
                aria-label={`Open job ${r.label} ${r.jobName || r.customerName || ''}`.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  // Wrap on phones: the name keeps real width and the status
                  // chip + added stamp drop to a second line instead of
                  // crushing the name to two letters.
                  flexWrap: 'wrap',
                  gap: 10,
                  width: '100%',
                  padding: '7px 14px',
                  border: 'none',
                  borderTop: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap', minWidth: 44 }}>{r.label}</span>
                <span style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>
                    {r.jobName || r.customerName || '(unnamed)'}
                    {r.customerName && r.jobName && r.customerName !== r.jobName ? (
                      <span style={{ color: 'var(--text-faint)' }}> · {r.customerName}</span>
                    ) : null}
                  </span>
                  {r.address || r.gcName ? (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {r.address}
                      {r.address && r.gcName ? ' · ' : ''}
                      {r.gcName ? <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>GC: {r.gcName}</span> : null}
                    </span>
                  ) : null}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 18,
                    padding: '0 8px',
                    borderRadius: 9999,
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    background: chip.bg,
                    color: chip.fg,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {statusLabel}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)', fontSize: '0.78rem', whiteSpace: 'nowrap', minWidth: 88, textAlign: 'right' }}>
                  {r.addedLabel}
                </span>
              </button>
            )
          })}
          <div style={{ padding: '8px 14px 10px', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            Showing {rows.length} — older than these? Use search; this view is for "I just added it, where did it go".
          </div>
        </>
      )}
    </div>
  )
}
