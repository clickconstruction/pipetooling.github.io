import type { CSSProperties, MouseEvent } from 'react'
import type { UserTimeOffCellInfo } from '../../lib/userTimeOffByCell'

const baseChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '0.1rem 0.4rem',
  fontSize: '0.6875rem',
  fontWeight: 600,
  borderRadius: 999,
  border: '1px solid',
  marginBottom: 0,
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
}

function chipStyleForVariant(info: UserTimeOffCellInfo): CSSProperties {
  if (info.variant === 'not_coming_in') {
    return { ...baseChipStyle, background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }
  }
  return { ...baseChipStyle, background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }
}

const buttonResetStyle: CSSProperties = {
  appearance: 'none',
  background: 'transparent',
  margin: 0,
  font: 'inherit',
  cursor: 'pointer',
}

/**
 * Small pill rendered at the top of a Schedule Dispatch day cell when the
 * assignee has a `user_time_off` row that overlaps that day.
 *
 * - `not_coming_in` variant + `onClick` → renders as a button so the
 *   dispatcher can click to undo the mark.
 * - `time_off` variant or no `onClick` → renders as a non-interactive span.
 */
export function ScheduleDispatchTimeOffChip({
  info,
  onClick,
  busy = false,
  interactiveTitle,
}: {
  info: UserTimeOffCellInfo
  /** When provided, the chip becomes a clickable button (used to undo "Not coming in"). */
  onClick?: () => void
  /** Disables the click while the parent action is in flight. */
  busy?: boolean
  /** Optional title/aria-label override for the interactive chip (e.g. "Click to mark as coming in"). */
  interactiveTitle?: string
}) {
  const trimmedNote = (info.note ?? '').trim()
  const baseTitle =
    trimmedNote && trimmedNote !== info.label ? `${info.label} — ${trimmedNote}` : info.label

  if (onClick) {
    const title = interactiveTitle ?? baseTitle
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      if (busy) return
      onClick()
    }
    return (
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={handleClick}
        disabled={busy}
        style={{
          ...chipStyleForVariant(info),
          ...buttonResetStyle,
          opacity: busy ? 0.6 : 1,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {info.label}
      </button>
    )
  }

  return (
    <span title={baseTitle} aria-label={baseTitle} style={chipStyleForVariant(info)}>
      {info.label}
    </span>
  )
}
