import type { ReactNode } from 'react'

type Props = {
  testId?: string
  /** First line: the GC (or development), with whatever rides beside the name. */
  name: ReactNode
  /** Second line: what is owed. */
  meta: ReactNode
  /** The GC's three steps; omitted for a row the week asks nothing of. */
  steps?: ReactNode
  /** The one thing to do next. */
  action?: ReactNode
  /** A broken promise — the red edge. */
  late?: boolean
  expanded: boolean
  onToggle: () => void
  /** Whose bills the row opens, for the chevron's label. */
  toggleName: string
  /** The opened row: the statement's chips, its actions and its bills. */
  children?: ReactNode
}

/**
 * One line of GC Review's list: name and balance, the steps, the next thing to
 * do — and its bills folded inside, one click away. The row opens on a click
 * anywhere that is not itself a control. Styles: `.gcReviewRow*`.
 */
export default function GcReviewRow({ testId, name, meta, steps, action, late, expanded, onToggle, toggleName, children }: Props) {
  return (
    <div
      className="gcReviewRow"
      data-testid={testId}
      data-open={expanded ? 'yes' : undefined}
      data-late={late ? 'yes' : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a, select, input, label, [data-row-detail]')) return
        onToggle()
      }}
    >
      <button type="button" className="gcReviewRowToggle" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} ${toggleName}’s bills`} onClick={onToggle}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="gcReviewRowName">
        <span className="gcReviewRowTitle">{name}</span>
        <span className="gcReviewRowMeta">{meta}</span>
      </span>
      {steps ? <span className="gcReviewRowSteps">{steps}</span> : <span aria-hidden />}
      <span className="gcReviewRowAction">{action}</span>
      {expanded ? (
        <div className="gcReviewRowDetail" data-row-detail>
          {children}
        </div>
      ) : null}
    </div>
  )
}
