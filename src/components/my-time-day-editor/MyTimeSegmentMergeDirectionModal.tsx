import type { CSSProperties } from 'react'

export type MyTimeSegmentMergeDirectionModalProps = {
  open: boolean
  onClose: () => void
  mergeUpVisible: boolean
  mergeDownVisible: boolean
  onMergeUp: () => void
  onMergeDown: () => void
  disabled?: boolean
  /** When set, Merge up is disabled (e.g. incompatible clock row metadata). */
  mergeUpBlocked?: boolean
  mergeUpBlockedTitle?: string
  mergeDownBlocked?: boolean
  mergeDownBlockedTitle?: string
  /** When true, title is “Segment actions” and a Reject row is shown (compact mobile × flow). */
  showReject?: boolean
  onReject?: () => void
  rejectDisabled?: boolean
  /** Above Assign popover (1250); below full-screen My Time flows if any. */
  overlayZIndex?: number
}

const actionBtn: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.55rem 0.85rem',
  fontSize: '0.8125rem',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  background: 'white',
  color: '#374151',
  cursor: 'pointer',
  textAlign: 'center',
  font: 'inherit',
}

export function MyTimeSegmentMergeDirectionModal({
  open,
  onClose,
  mergeUpVisible,
  mergeDownVisible,
  onMergeUp,
  onMergeDown,
  disabled = false,
  mergeUpBlocked = false,
  mergeUpBlockedTitle,
  mergeDownBlocked = false,
  mergeDownBlockedTitle,
  showReject = false,
  onReject,
  rejectDisabled = false,
  overlayZIndex = 1260,
}: MyTimeSegmentMergeDirectionModalProps) {
  if (!open) return null

  const titleText = showReject ? 'Segment actions' : 'Merge'
  const rejectBusy = rejectDisabled

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
        padding: 16,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          maxWidth: 360,
          width: '100%',
          padding: '1.1rem 1.2rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby="my-time-merge-direction-title"
      >
        <h3
          id="my-time-merge-direction-title"
          style={{ margin: '0 0 0.85rem', fontSize: '1rem', fontWeight: 700, color: '#111827' }}
        >
          {titleText}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mergeUpVisible ? (
            <button
              type="button"
              disabled={disabled || mergeUpBlocked}
              title={mergeUpBlocked ? mergeUpBlockedTitle : undefined}
              aria-label={mergeUpBlocked && mergeUpBlockedTitle ? mergeUpBlockedTitle : undefined}
              style={{
                ...actionBtn,
                cursor: disabled || mergeUpBlocked ? 'not-allowed' : 'pointer',
                opacity: disabled || mergeUpBlocked ? 0.6 : 1,
              }}
              onClick={() => {
                if (mergeUpBlocked) return
                onMergeUp()
                onClose()
              }}
            >
              Merge up
            </button>
          ) : null}
          {mergeDownVisible ? (
            <button
              type="button"
              disabled={disabled || mergeDownBlocked}
              title={mergeDownBlocked ? mergeDownBlockedTitle : undefined}
              aria-label={mergeDownBlocked && mergeDownBlockedTitle ? mergeDownBlockedTitle : undefined}
              style={{
                ...actionBtn,
                cursor: disabled || mergeDownBlocked ? 'not-allowed' : 'pointer',
                opacity: disabled || mergeDownBlocked ? 0.6 : 1,
              }}
              onClick={() => {
                if (mergeDownBlocked) return
                onMergeDown()
                onClose()
              }}
            >
              Merge down
            </button>
          ) : null}
          {showReject ? (
            <button
              type="button"
              disabled={disabled || rejectBusy}
              style={{
                ...actionBtn,
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#b91c1c',
                fontWeight: 600,
                cursor: disabled || rejectBusy ? 'not-allowed' : 'pointer',
                opacity: disabled || rejectBusy ? 0.6 : 1,
              }}
              onClick={() => {
                onReject?.()
                onClose()
              }}
            >
              Reject session
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 12,
            display: 'block',
            width: '100%',
            padding: '0.5rem 0.85rem',
            fontSize: '0.8125rem',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#f9fafb',
            color: '#4b5563',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
