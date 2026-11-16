/**
 * Reserve stickers from the Materials strip (punch list #329, PR 2, v2.7272): a run belongs to the job its new
 * boxes go on, so the press asks *Which job?* as Print labels does, over the jobs the on-site desk holds, then opens
 * that job's stickers window (`PrintStickersModal`). One job skips the question. A job with no box yet is listed too:
 * stickers come before boxes, and the first run is often for a site the app has not seen.
 */
import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import type { OnSiteFindJob } from '../../lib/materials/onSiteFind'
import { labelBoxes } from '../../lib/materials/onSiteFind'
import { PRINT_STICKERS_LABEL } from '../../lib/materials/stickerRun'
import PrintStickersModal from './PrintStickersModal'
import { PRINT_LABELS_WINDOW_WIDTH } from './PrintLabelsWindow'

type Props = {
  jobs: ReadonlyArray<OnSiteFindJob>
  role: string | null | undefined
  loading: boolean
  failure: { error: string | null; raw: unknown; retry: () => void }
  /** Where the first job's boxes are added, offered when the desk holds no job. */
  onAddFirst?: () => void
  onClose: () => void
}

/** Beside a job: how many boxes it holds today, or that it has none yet, since a run may come before the first. */
function boxCountWords(n: number): string {
  return n === 0 ? 'no box yet' : n === 1 ? '1 box' : `${n} boxes`
}

const row: CSSProperties = { minHeight: 48, width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.9rem', borderRadius: 10, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }

export default function PrintStickersWindow({ jobs, role, loading, failure, onAddFirst, onClose }: Props) {
  const sorted = [...jobs].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  const [picked, setPicked] = useState<string | null>(null)
  const only = sorted.length === 1 ? sorted[0]! : null
  const job = sorted.find((j) => j.jobId === picked) ?? (picked == null ? only : null)
  if (job) {
    return <PrintStickersModal jobId={job.jobId} jobLabel={job.label} role={role} onClose={onClose} />
  }
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={PRINT_STICKERS_LABEL} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: `min(${PRINT_LABELS_WINDOW_WIDTH}px, 100%)`, maxHeight: 'min(90vh, 100%)', overflowX: 'hidden', overflowY: 'auto', padding: '1rem 1.25rem 1.25rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.75rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', flex: '1 1 auto' }}>{PRINT_STICKERS_LABEL}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36 }}>×</button>
        </div>
        <OfflineRetryPanel failure={failure.error ? recoveryFailureFromError(failure.raw, 'The jobs did not load.') : null} onRetry={failure.retry} surface="materials-print-stickers" idempotent />
        {loading && sorted.length === 0 ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading the jobs…</p> : null}
        {!loading && !failure.error && sorted.length === 0 ? (
          <EmptyState compact main="No job has anything on site yet." next={onAddFirst ? { label: 'On site', onPress: onAddFirst } : undefined} tail={onAddFirst ? `opens a job’s page, where ${PRINT_STICKERS_LABEL} prints its first run.` : 'A job’s own Materials page prints its first run.'} />
        ) : null}
        {sorted.length > 0 ? (
          <>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Which job? New boxes made from the stickers go on it.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.5rem' }}>
              {sorted.map((j) => (
                <button key={j.jobId} type="button" style={row} onClick={() => setPicked(j.jobId)} data-testid="print-stickers-job">
                  <span style={{ flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.25 }}>{j.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.85rem', flex: '0 0 auto', whiteSpace: 'nowrap' }}>{boxCountWords(labelBoxes(j).length)}</span>
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
