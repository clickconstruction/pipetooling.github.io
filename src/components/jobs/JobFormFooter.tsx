import {
  jobFormAutosaveStatusColor,
  jobFormAutosaveStatusWords,
  type JobFormAutosaveAggregate,
  type JobFormCloseFlushState,
} from '../../lib/jobs/jobFormFooter'

export type JobFormFooterProps = {
  /** Edit mode (a job is open); false on New Job. */
  editing: boolean
  /** Phone footer layout (v2.1239): status line above one deliberate button row. */
  narrowViewport: boolean
  /** In the Job window the window's ✕ replaces the footer Close. */
  embedded: boolean
  showDelete: boolean
  /** The open job is being deleted right now. */
  deleting: boolean
  migratingJob: boolean
  closeFlushState: JobFormCloseFlushState
  editAutosaveAggregate: JobFormAutosaveAggregate
  undoAvailable: boolean
  undoConfirmOpen: boolean
  jobFormCanSubmit: boolean
  jobFormMissingFields: string[]
  /** New Job's create is in flight. */
  saving: boolean
  /** The guarded close — also the banner's "Retry and close". */
  onClose: () => void
  onKeepEditing: () => void
  onCloseWithoutSaving: () => void
  onDelete: () => void
  onUndo: () => void
  onUndoConfirmOpenChange: (open: boolean) => void
  onCreateJob: () => void
}

/**
 * The job form's close-flush banner and footer (§15 of the Job form map), out of the shell whole.
 * Every flag, the undo, the guarded close and the create stay the shell's; this draws them.
 */
export function JobFormFooter({
  editing,
  narrowViewport,
  embedded,
  showDelete,
  deleting,
  migratingJob,
  closeFlushState,
  editAutosaveAggregate,
  undoAvailable,
  undoConfirmOpen,
  jobFormCanSubmit,
  jobFormMissingFields,
  saving,
  onClose,
  onKeepEditing,
  onCloseWithoutSaving,
  onDelete,
  onUndo,
  onUndoConfirmOpenChange,
  onCreateJob,
}: JobFormFooterProps) {
  // Footer pieces shared by both layouts (v2.1239): desktop keeps the
  // two-cluster space-between row; phone edit mode stacks a full-width
  // centered status line over one deliberate [Delete][Undo][Close] row.
  const narrowEditFooter = editing && narrowViewport
  const deleteButton = showDelete ? (
    <button
      type="button"
      onClick={onDelete}
      disabled={deleting || migratingJob}
      style={{
        padding: '0.5rem 1rem',
        flexShrink: 0,
        background: deleting || migratingJob ? 'var(--bg-muted)' : 'var(--bg-red-100)',
        color: deleting || migratingJob ? 'var(--text-faint)' : 'var(--text-red-700)',
        border: 'none',
        borderRadius: 4,
        cursor: deleting || migratingJob ? 'not-allowed' : 'pointer',
      }}
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  ) : null
  const undoConfirmCluster = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.8rem',
        ...(narrowEditFooter ? { justifyContent: 'center', flexWrap: 'wrap' as const } : {}),
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>Revert everything since opening?</span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          padding: '0.3rem 0.7rem',
          background: 'var(--bg-red-100)',
          color: 'var(--text-red-700)',
          border: '1px solid var(--border-red)',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: '0.8rem',
        }}
      >
        Revert
      </button>
      <button
        type="button"
        onClick={() => onUndoConfirmOpenChange(false)}
        style={{
          padding: '0.3rem 0.7rem',
          background: 'var(--bg-200)',
          color: 'var(--text-700)',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: '0.8rem',
        }}
      >
        Keep
      </button>
    </span>
  )
  const undoButton = (
    <button
      type="button"
      onClick={() => onUndoConfirmOpenChange(true)}
      disabled={!undoAvailable}
      title={
        undoAvailable
          ? 'Revert every change made since this modal was opened (or since the last invoice was created/deleted)'
          : 'Nothing to undo'
      }
      style={{
        padding: '0.5rem 1rem',
        flexShrink: 0,
        background: 'transparent',
        color: undoAvailable ? 'var(--text-700)' : 'var(--text-faint)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        cursor: undoAvailable ? 'pointer' : 'not-allowed',
      }}
    >
      {narrowEditFooter ? 'Undo' : 'Undo changes'}
    </button>
  )
  const requiredList =
    !jobFormCanSubmit && !saving && jobFormMissingFields.length > 0 ? (
      <span
        style={{
          fontSize: '0.8rem',
          color: '#FF6600',
          display: 'inline-block',
          ...(narrowEditFooter ? { textAlign: 'center' as const } : {}),
        }}
      >
        <span style={{ display: 'block' }}>Required:</span>
        {jobFormMissingFields.map((f) => (
          <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>
            {f}
          </span>
        ))}
      </span>
    ) : null
  const statusSpan = (
    <span
      aria-live="polite"
      style={{
        fontSize: '0.8rem',
        fontWeight: 500,
        ...(narrowEditFooter ? { textAlign: 'center' as const } : {}),
        color: jobFormAutosaveStatusColor(editAutosaveAggregate),
      }}
    >
      {jobFormAutosaveStatusWords(editAutosaveAggregate)}
    </span>
  )
  // Embedded: the window's ✕ (wired to the same guarded close) replaces
  // the footer Close.
  const closeButton = embedded ? null : (
    <button
      type="button"
      onClick={onClose}
      disabled={closeFlushState === 'saving'}
      style={{
        padding: '0.5rem 1rem',
        ...(narrowEditFooter ? { flex: 1, fontWeight: 500 } : {}),
        background: 'var(--bg-200)',
        color: closeFlushState === 'saving' ? 'var(--text-faint)' : 'var(--text-700)',
        border: 'none',
        borderRadius: 4,
        cursor: closeFlushState === 'saving' ? 'wait' : 'pointer',
      }}
    >
      {closeFlushState === 'saving' ? 'Saving…' : editing ? 'Close' : 'Cancel'}
    </button>
  )
  return (
    <>
      {closeFlushState === 'error' && (
        <div
          role="alert"
          style={{
            marginTop: '1.25rem',
            padding: '0.6rem 0.75rem',
            background: 'var(--bg-red-100)',
            border: '1px solid var(--border-red)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', fontWeight: 500 }}>
            Your latest changes could not be saved — the server may not have responded. They may or may not have
            saved.
          </span>
          <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.3rem 0.7rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Retry and close
            </button>
            <button
              type="button"
              onClick={onKeepEditing}
              style={{
                padding: '0.3rem 0.7rem',
                background: 'var(--bg-200)',
                color: 'var(--text-700)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={onCloseWithoutSaving}
              style={{
                padding: '0.3rem 0.7rem',
                background: 'transparent',
                color: 'var(--text-red-700)',
                border: '1px solid var(--border-red)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Close without saving
            </button>
          </span>
        </div>
      )}
      {narrowEditFooter ? (
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {requiredList}
          {statusSpan}
          {undoConfirmOpen ? undoConfirmCluster : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {deleteButton}
            {!undoConfirmOpen ? undoButton : null}
            {closeButton}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            marginTop: '1.25rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>{deleteButton}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {editing ? (undoConfirmOpen ? undoConfirmCluster : undoButton) : null}
            {requiredList}
            {/* Edit mode ends [status → Close] so Close anchors the corner (v2.1235);
                create mode keeps the conventional [Cancel → Create Job]. */}
            {editing ? (
              <>
                {statusSpan}
                {closeButton}
              </>
            ) : (
              <>
                {closeButton}
                <button
                  type="button"
                  onClick={onCreateJob}
                  disabled={!jobFormCanSubmit || saving}
                  title={!jobFormCanSubmit ? `Required: ${jobFormMissingFields.join(', ')}` : undefined}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: jobFormCanSubmit && !saving ? 'pointer' : 'not-allowed',
                    fontWeight: 500,
                  }}
                >
                  {saving ? 'Creating…' : 'Create Job'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
