/**
 * Move to Collections? / Send back to Billed? (Stages tab decomposition PR 5, v2.3535).
 *
 * Moved verbatim out of `JobsStagesTab.tsx`. The note draft stays controlled by the tab (the
 * openers clear it); the confirm — `set_job_collections_flag`, the toast, the reload and the
 * follow-moves focus — stays in the tab as `onConfirm`. z 80 so it paints over call mode
 * (z 70) when opened from its Collections chip (B6 / J4-7).
 */
import type { JobWithDetails } from '../../types/jobWithDetails'

export type StagesCollectionsConfirmTarget = { job: JobWithDetails; direction: 'to' | 'from' }

function jobLabel(job: JobWithDetails): string {
  return `${(job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`
}

export function StagesCollectionsConfirmModal({
  confirm,
  noteDraft,
  onNoteDraftChange,
  saving,
  onCancel,
  onConfirm,
}: {
  confirm: StagesCollectionsConfirmTarget
  noteDraft: string
  onNoteDraftChange: (value: string) => void
  saving: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 420 }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
          {confirm.direction === 'to' ? 'Move to Collections?' : 'Send back to Billed?'}
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {confirm.direction === 'to'
            ? `Flag ${jobLabel(confirm.job)} as difficult to collect? It stays Billed — this only moves it to the Collections section.`
            : `Return ${jobLabel(confirm.job)} to Billed Awaiting Payment?`}
        </p>
        {confirm.direction === 'to' ? (
          <label style={{ display: 'block', margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
            Note (optional)
            <textarea
              value={noteDraft}
              onChange={(e) => onNoteDraftChange(e.target.value)}
              placeholder="e.g. customer disputing invoice, no response in 60 days"
              rows={3}
              style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </label>
        ) : confirm.job.collections_note ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-red-700)', fontStyle: 'italic' }}>
            Collections note: {confirm.job.collections_note}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onConfirm()}
            style={{
              padding: '0.5rem 1rem',
              background: !saving ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? '…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
