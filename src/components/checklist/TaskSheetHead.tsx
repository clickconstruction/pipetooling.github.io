import { Circle, X } from 'lucide-react'

/**
 * The head of a task's sheet (v2.8034 on More, v2.8057 on the windows behind its choices): the title in the middle,
 * Close at its right, and under them the task the sheet is about, on one line in a quiet pill with the ring of its
 * own tick. A long task is cut with an ellipsis and keeps its whole words on `title`. One head, so the sheet a person
 * opens and the window its choice opens read as one thing.
 */
export function TaskSheetHead({
  title,
  labelId,
  taskTitle,
  onClose,
}: {
  title: string
  /** The id the dialog names itself by (`aria-labelledby`). */
  labelId: string
  /** The task this is about. Empty draws no pill. */
  taskTitle: string
  onClose: () => void
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 36px', alignItems: 'center' }}>
        <span aria-hidden="true" />
        <h2 id={labelId} style={{ margin: 0, fontSize: '1.125rem', textAlign: 'center' }}>
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, border: 'none', borderRadius: 18, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {taskTitle ? (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 14px' }}>
          <span data-choice-task title={taskTitle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '5px 12px', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-strong)', fontSize: '0.8125rem', lineHeight: 1.3 }}>
            <Circle size={13} strokeWidth={2.25} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{taskTitle}</span>
          </span>
        </div>
      ) : (
        <div style={{ height: 12 }} />
      )}
    </>
  )
}
