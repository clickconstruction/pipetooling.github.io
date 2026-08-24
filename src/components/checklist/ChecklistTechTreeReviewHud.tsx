/**
 * Floating bar for the Map's Review mode: step stage-to-stage in priority
 * order (◀ ▶ / arrow keys), bump the current stage's priority (▲ #n ▼ — the
 * same sort_index ranking every stage number follows), exit with ✕ / Esc.
 * Rendered inside the canvas shell so fullscreen keeps it.
 */

type Props = {
  index: number
  total: number
  title: string
  stageNumber: number
  canEdit: boolean
  busy: boolean
  /** Transient "who traded places" message after a priority bump. */
  flash: string | null
  onPrev: () => void
  onNext: () => void
  onRaise: () => void
  onLower: () => void
  onExit: () => void
}

export function ChecklistTechTreeReviewHud({
  index,
  total,
  title,
  stageNumber,
  canEdit,
  busy,
  flash,
  onPrev,
  onNext,
  onRaise,
  onLower,
  onExit,
}: Props) {
  const navBtn = (label: string, onClick: () => void, disabled: boolean, aria: string) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '1.5px solid var(--border-strong)',
        background: 'var(--surface)',
        color: disabled ? 'var(--text-muted)' : 'var(--text-strong)',
        fontSize: '1rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      className="nodrag nopan"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'calc(100% - 24px)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {flash ? (
        <div
          role="status"
          style={{
            background: '#fbbf24',
            color: '#451a03',
            border: '1px solid #d97706',
            borderRadius: 999,
            fontSize: '0.8125rem',
            fontWeight: 700,
            padding: '5px 14px',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {flash}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 999,
          padding: '8px 12px',
          boxShadow: '0 10px 32px rgba(0,0,0,0.22)',
          maxWidth: '100%',
        }}
      >
        {navBtn('◀', onPrev, busy || index <= 0, 'Previous stage')}
        <span style={{ display: 'grid', gap: 1, textAlign: 'center', minWidth: 120, maxWidth: 220 }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Stage {index + 1} of {total}
          </span>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-strong)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </span>
        </span>
        {canEdit ? (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'var(--bg-amber-tint)',
              border: '1.5px solid #d97706',
              borderRadius: 999,
              padding: '3px 5px',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onRaise}
              disabled={busy || index <= 0}
              title="Raise priority (swap with the stage above)"
              aria-label="Raise priority"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-amber-800)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: busy || index <= 0 ? 'not-allowed' : 'pointer',
                opacity: busy || index <= 0 ? 0.4 : 1,
              }}
            >
              ▲
            </button>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-amber-800)', minWidth: 30, textAlign: 'center' }}>
              {busy ? '…' : `#${stageNumber}`}
            </span>
            <button
              type="button"
              onClick={onLower}
              disabled={busy || index >= total - 1}
              title="Lower priority (swap with the stage below)"
              aria-label="Lower priority"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-amber-800)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: busy || index >= total - 1 ? 'not-allowed' : 'pointer',
                opacity: busy || index >= total - 1 ? 0.4 : 1,
              }}
            >
              ▼
            </button>
          </span>
        ) : null}
        {navBtn('▶', onNext, busy || index >= total - 1, 'Next stage')}
        <button
          type="button"
          onClick={onExit}
          aria-label="Finish review"
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '0 4px',
            whiteSpace: 'nowrap',
          }}
        >
          ✕ Done
        </button>
      </div>
    </div>
  )
}
