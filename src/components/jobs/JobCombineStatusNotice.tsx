import { combineStatusPreview } from '../../lib/jobs/jobCombineNote'
import type { JobStatusPctPair } from './useJobStatusPctPair'

/**
 * Source-vs-target status/% panel shown above the destructive confirm in the
 * Combine flow and the Delete-job migrate modal (v2.2068). The operator must
 * see "source is Ready to bill at 100%, target is Billed" before the source's
 * marks are discarded — pair comes from useJobStatusPctPair, wording from
 * combineStatusPreview.
 */
export function JobCombineStatusNotice(props: { pair: JobStatusPctPair | null; loading: boolean }) {
  if (props.loading) {
    return (
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Checking job statuses…</p>
    )
  }
  if (!props.pair) return null
  const preview = combineStatusPreview(props.pair.source, props.pair.target)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {preview.warning ? (
        <p
          style={{
            margin: '0 0 0.5rem',
            fontSize: '0.8125rem',
            color: 'var(--text-amber-800)',
            lineHeight: 1.45,
            background: 'var(--bg-amber-tint)',
            padding: '0.65rem 0.75rem',
            borderRadius: 6,
            border: '1px solid var(--border-amber-soft)',
          }}
        >
          {preview.warning}
        </p>
      ) : null}
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{preview.keeps}</p>
    </div>
  )
}
