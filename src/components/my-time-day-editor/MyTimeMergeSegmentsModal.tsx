import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { NO_JOB_BID_LINKED_LABEL } from '../../lib/myTimeDaySavePlan'

export type MergeJobAllocOption = 'upper' | 'lower' | 'unassigned'

export type MyTimeMergeSegmentsModalProps = {
  open: boolean
  /** z-index above My Time dialog (1200). */
  overlayZIndex?: number
  upperJobLabel: string
  lowerJobLabel: string
  /** Initial job selection: segment merged into (above vs below). */
  defaultJobChoice: Extract<MergeJobAllocOption, 'upper' | 'lower'>
  /** Default merged focus text (matches reducer merge order); user may edit before confirm. */
  initialMergedFocusNote: string
  onClose: () => void
  onConfirm: (choice: MergeJobAllocOption, mergedFocusNote: string) => void
}

export function MyTimeMergeSegmentsModal({
  open,
  overlayZIndex = 1300,
  upperJobLabel,
  lowerJobLabel,
  defaultJobChoice,
  initialMergedFocusNote,
  onClose,
  onConfirm,
}: MyTimeMergeSegmentsModalProps) {
  const [choice, setChoice] = useState<MergeJobAllocOption>(defaultJobChoice)
  const [mergedFocusNote, setMergedFocusNote] = useState('')
  const mergeNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (open) {
      setChoice(defaultJobChoice)
      setMergedFocusNote(initialMergedFocusNote)
    }
  }, [open, defaultJobChoice, initialMergedFocusNote])

  useLayoutEffect(() => {
    if (!open) return

    const adjustNoteHeight = () => {
      const el = mergeNoteTextareaRef.current
      if (!el) return
      const minPx = 100
      const maxPx = Math.min(Math.floor(window.innerHeight * 0.5), 420)
      el.style.height = '0px'
      const sh = el.scrollHeight
      const next = Math.max(minPx, Math.min(sh, maxPx))
      el.style.height = `${next}px`
      el.style.overflowY = sh > maxPx ? 'auto' : 'hidden'
    }

    adjustNoteHeight()
    window.addEventListener('resize', adjustNoteHeight)
    return () => window.removeEventListener('resize', adjustNoteHeight)
  }, [open, mergedFocusNote, initialMergedFocusNote])

  if (!open) return null

  const jobCardBase: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    boxSizing: 'border-box',
    minWidth: 0,
    padding: '0.85rem 1rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-page)',
    cursor: 'pointer',
    textAlign: 'left',
    font: 'inherit',
    transition: 'border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease',
  }

  const jobCardSelected: CSSProperties = {
    borderColor: '#2563eb',
    background: 'var(--bg-blue-tint)',
    boxShadow: 'inset 0 0 0 1px #2563eb',
  }

  const jobCardText: CSSProperties = {
    display: 'block',
    width: '100%',
    fontSize: '0.8125rem',
    fontWeight: 500,
    lineHeight: 1.45,
    color: 'var(--text-strong)',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  }

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
          background: 'var(--surface)',
          borderRadius: 12,
          maxWidth: 560,
          width: '100%',
          padding: '1.25rem 1.35rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby="my-time-merge-title"
      >
        <h3
          id="my-time-merge-title"
          style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-strong)' }}
        >
          Combine segments
        </h3>

        <div
          role="radiogroup"
          aria-label="Choose job for merged segment"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 12,
            width: '100%',
          }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={choice === 'upper'}
            aria-label={`Use job: ${upperJobLabel}`}
            onClick={() => setChoice('upper')}
            style={{ ...jobCardBase, ...(choice === 'upper' ? jobCardSelected : {}) }}
          >
            <span style={jobCardText}>{upperJobLabel}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={choice === 'lower'}
            aria-label={`Use job: ${lowerJobLabel}`}
            onClick={() => setChoice('lower')}
            style={{ ...jobCardBase, ...(choice === 'lower' ? jobCardSelected : {}) }}
          >
            <span style={jobCardText}>{lowerJobLabel}</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={choice === 'unassigned'}
            onClick={() => setChoice('unassigned')}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.65rem 1rem',
              borderRadius: 10,
              border: choice === 'unassigned' ? '1px solid #2563eb' : '1px dashed var(--border-strong)',
              background: choice === 'unassigned' ? 'var(--bg-blue-tint)' : 'transparent',
              color: 'var(--text-600)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textAlign: 'center',
              font: 'inherit',
            }}
          >
            {NO_JOB_BID_LINKED_LABEL}
          </button>
        </div>

        <div style={{ marginBottom: 14 }} onClick={(e) => e.stopPropagation()}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 6,
              flexWrap: 'wrap',
            }}
          >
            <label
              id="merge-focus-notes-heading"
              htmlFor="merge-focus-notes-textarea"
              style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}
            >
              Focus notes for merged segment
            </label>
            <button
              type="button"
              onClick={() => setMergedFocusNote(initialMergedFocusNote)}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: 'var(--text-link)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                font: 'inherit',
              }}
            >
              Restore default merge
            </button>
          </div>
          <textarea
            ref={mergeNoteTextareaRef}
            id="merge-focus-notes-textarea"
            value={mergedFocusNote}
            onChange={(e) => setMergedFocusNote(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            rows={1}
            style={{
              width: '100%',
              minHeight: 100,
              resize: 'none',
              boxSizing: 'border-box',
              font: 'inherit',
              fontSize: '0.8125rem',
              lineHeight: 1.45,
              padding: '0.55rem 0.65rem',
              borderRadius: 8,
              border: '1px solid var(--border-strong)',
              color: 'var(--text-strong)',
              overflowX: 'hidden',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 0.95rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              background: 'var(--surface)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(choice, mergedFocusNote)}
            style={{
              padding: '0.5rem 0.95rem',
              border: '1px solid #2563eb',
              borderRadius: 8,
              background: '#2563eb',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            Merge segments
          </button>
        </div>
      </div>
    </div>
  )
}
