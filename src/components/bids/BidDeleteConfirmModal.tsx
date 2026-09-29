/**
 * The Bids page's Delete bid window: type the project name to confirm (punch list #51, PR 5 —
 * moved out of `src/pages/Bids.tsx` verbatim). The page opens it over the Bid window and owns
 * what it says and does: the typed value, the error, the delete in flight (`useBidEditController`'s
 * `deleteBid`, which checks the name again) and Cancel.
 */
export function BidDeleteConfirmModal({
  projectName,
  confirmValue,
  onConfirmValueChange,
  error,
  deleting,
  onDelete,
  onCancel,
}: {
  /** The bid's project name; the confirm button waits until it is typed. */
  projectName: string | null
  confirmValue: string
  onConfirmValueChange: (value: string) => void
  error: string | null
  deleting: boolean
  onDelete: () => void
  onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
        <h2 style={{ marginTop: 0 }}>Delete bid</h2>
        <p style={{ marginBottom: '1rem' }}>
          {projectName
            ? <>Type the project name <strong>{projectName}</strong> to confirm.</>
            : 'This bid has no project name; leave the field empty to confirm.'}
        </p>
        <input
          type="text"
          value={confirmValue}
          onChange={(e) => onConfirmValueChange(e.target.value)}
          placeholder={projectName ? 'Project name' : 'No project name'}
          disabled={deleting}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
          autoComplete="off"
        />
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting || confirmValue.trim() !== (projectName ?? '').trim()}
            style={{ padding: '0.5rem 1rem', color: 'var(--text-red-700)', background: 'var(--surface)', border: '1px solid #b91c1c', borderRadius: 4, cursor: deleting || confirmValue.trim() !== (projectName ?? '').trim() ? 'not-allowed' : 'pointer' }}
          >
            {deleting ? 'Deleting…' : 'Delete bid'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: deleting ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
