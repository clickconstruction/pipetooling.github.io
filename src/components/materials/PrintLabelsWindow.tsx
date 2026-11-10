/**
 * Print labels from anywhere (punch list #304): labels belong to a job, so the press asks *Which
 * job?* with the jobs that hold a box, then opens that job's labels window (`LabelsPrintModal`) on
 * the rows the on-site store already holds. One job with boxes skips the question. Whoever may open
 * a job's boxes may print its labels: a label shows a stencil and a code, no money.
 */
import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { labelBoxes, labelCountWords, type OnSiteFindJob } from '../../lib/materials/onSiteFind'
import LabelsPrintModal from './LabelsPrintModal'

type Props = {
  jobs: ReadonlyArray<OnSiteFindJob>
  loading: boolean
  failure: { error: string | null; raw: unknown; retry: () => void }
  /** Open straight on this job (a row's Labels press). */
  jobId?: string | null
  /** Where the first box is added, offered when no job has one. */
  onAddFirst?: () => void
  onClose: () => void
}

const row: CSSProperties = { minHeight: 48, width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.9rem', borderRadius: 10, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }

export default function PrintLabelsWindow({ jobs, loading, failure, jobId = null, onAddFirst, onClose }: Props) {
  const withBoxes = jobs.filter((j) => labelBoxes(j).length > 0).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  const [picked, setPicked] = useState<string | null>(jobId)
  const only = withBoxes.length === 1 ? withBoxes[0]! : null
  const job = withBoxes.find((j) => j.jobId === picked) ?? (picked == null ? only : null)
  if (job) {
    return <LabelsPrintModal jobLabel={job.label} containers={labelBoxes(job)} lines={[...job.lines]} places={job.places} only={null} onClose={onClose} />
  }
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Print labels" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: 'min(460px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1rem 1.25rem 1.25rem', display: 'grid', gap: '0.75rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', flex: '1 1 auto' }}>Print labels</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36 }}>×</button>
        </div>
        <OfflineRetryPanel failure={failure.error ? recoveryFailureFromError(failure.raw, 'The boxes did not load.') : null} onRetry={failure.retry} surface="materials-print-labels" idempotent />
        {loading && withBoxes.length === 0 ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading the boxes…</p> : null}
        {!loading && !failure.error && withBoxes.length === 0 ? (
          <EmptyState compact main="No job has a cage or a box yet." next={onAddFirst ? { label: 'On site', onPress: onAddFirst } : undefined} tail={onAddFirst ? 'adds the first, and its label prints from here.' : 'The first one added on site prints from here.'} />
        ) : null}
        {withBoxes.length > 0 ? (
          <>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Which job?</p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {withBoxes.map((j) => (
                <button key={j.jobId} type="button" style={row} onClick={() => setPicked(j.jobId)} data-testid="print-labels-job">
                  <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.85rem', flex: '0 0 auto' }}>{labelCountWords(labelBoxes(j).length)}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
