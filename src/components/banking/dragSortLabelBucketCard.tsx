import { forwardRef } from 'react'
import { INTERNAL_TRANSFERS_DEFAULT_KEY } from '../../lib/dragSortDefaultLabels'

export function formatUsdDragSortBucket(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function truncateLabelDescriptionForCard(text: string, maxLen: number): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`
}

export function scheduleCBadgeForCard(trimmed: string): string {
  return `[C${trimmed}]`
}

export type DragSortLabelBucketVisualState = 'idle' | 'droppableHover' | 'clickableHover'

export type DragSortLabelBucketCardProps = {
  labelName: string
  scheduleCLine: string | null
  description: string | null
  count: number
  amountSum: number
  expanded: boolean
  visualState?: DragSortLabelBucketVisualState
  onDelete?: () => void
  /** Sidebar list vs modal grid spacing */
  variant: 'sidebar' | 'grid'
  /**
   * Optional `mercury_drag_sort_labels.default_key` for built-ins. Used only
   * to flag non-Schedule-C built-ins (currently just **Internal Transfers**)
   * with a subtle slate accent so they read as "not a deductible bucket".
   */
  defaultKey?: string | null
}

function paletteForVisual(
  visualState: DragSortLabelBucketVisualState,
  isInternalTransfers: boolean,
): { border: string; bg: string } {
  if (visualState === 'droppableHover' || visualState === 'clickableHover') {
    return { border: '#2563eb', bg: '#eff6ff' }
  }
  if (isInternalTransfers) {
    // Slate accent — visually distinct from the other neutral / Schedule C
    // buckets so users grok this isn't an expense category.
    return { border: '#94a3b8', bg: '#f1f5f9' }
  }
  return { border: '#d1d5db', bg: '#f9fafb' }
}

function DragSortBucketStatsFooter({
  count,
  amountSum,
  scheduleTrim,
}: {
  count: number
  amountSum: number
  scheduleTrim: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: '0.35rem',
      }}
    >
      <span style={{ fontSize: '0.75rem', color: '#64748b', minWidth: 0 }}>
        {count} tx · {formatUsdDragSortBucket(amountSum)}
      </span>
      {scheduleTrim ? (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#334155',
            marginLeft: 'auto',
          }}
        >
          {scheduleCBadgeForCard(scheduleTrim)}
        </span>
      ) : null}
    </div>
  )
}

function DragSortBucketStatsInlineCluster({
  count,
  amountSum,
  scheduleTrim,
}: {
  count: number
  amountSum: number
  scheduleTrim: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: '0.35rem',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '0.75rem', color: '#64748b', minWidth: 0 }}>
        {count} tx · {formatUsdDragSortBucket(amountSum)}
      </span>
      {scheduleTrim ? (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
          {scheduleCBadgeForCard(scheduleTrim)}
        </span>
      ) : null}
    </div>
  )
}

export const DragSortLabelBucketCard = forwardRef<HTMLDivElement, DragSortLabelBucketCardProps>(
  function DragSortLabelBucketCard(
    {
      labelName,
      scheduleCLine,
      description,
      count,
      amountSum,
      expanded,
      visualState = 'idle',
      onDelete,
      variant,
      defaultKey = null,
    },
    ref,
  ) {
    const descTrim = description?.trim() ?? ''
    const scheduleTrim = scheduleCLine?.trim() ?? ''
    const isInternalTransfers = defaultKey === INTERNAL_TRANSFERS_DEFAULT_KEY
    const { border, bg } = paletteForVisual(visualState, isInternalTransfers)

    return (
      <div
        ref={ref}
        style={{
          width: variant === 'grid' ? '100%' : undefined,
          minWidth: variant === 'grid' ? 'min(14rem, 100%)' : undefined,
          boxSizing: 'border-box',
          padding: expanded ? '0.75rem' : '0.5rem 0.75rem',
          borderRadius: 8,
          border: `2px dashed ${border}`,
          background: bg,
          marginBottom: variant === 'sidebar' ? '0.65rem' : 0,
          display: 'flex',
          flexDirection: 'column',
          gap: expanded ? 8 : 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              minWidth: 0,
              flex: '1 1 auto',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: '#0f172a',
              wordBreak: 'break-word',
            }}
          >
            {labelName}
          </div>
          {expanded && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              style={{
                flexShrink: 0,
                padding: '2px 6px',
                fontSize: '0.7rem',
                color: '#b91c1c',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Delete
            </button>
          ) : null}
          {variant === 'grid' && expanded ? (
            <DragSortBucketStatsInlineCluster
              count={count}
              amountSum={amountSum}
              scheduleTrim={scheduleTrim}
            />
          ) : null}
        </div>
        {expanded ? (
          variant === 'grid' ? (
            descTrim ? (
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  wordBreak: 'break-word',
                }}
                title={descTrim.length > 100 ? descTrim : undefined}
              >
                {truncateLabelDescriptionForCard(descTrim, 100)}
              </div>
            ) : null
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {descTrim ? (
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: '#64748b',
                    wordBreak: 'break-word',
                  }}
                  title={descTrim.length > 100 ? descTrim : undefined}
                >
                  {truncateLabelDescriptionForCard(descTrim, 100)}
                </div>
              ) : null}
              <DragSortBucketStatsFooter count={count} amountSum={amountSum} scheduleTrim={scheduleTrim} />
            </div>
          )
        ) : null}
      </div>
    )
  },
)
