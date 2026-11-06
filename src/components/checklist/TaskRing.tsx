import type { RingState } from '../../lib/taskProgress'
import { ringWords } from '../../lib/taskProgress'

/**
 * Task cards (#273, PR 3): the ring in the tick box's seat. It reads the one number (`ringState`): empty with no digits
 * while nothing has moved, the percent as it fills in blue, a green ✓ once done. A press opens the % sheet on an open
 * card and reopens a done one; without `onPress` it is a reading, not a press. The blue is the classic press blue
 * under white words and the green the done fill, the pair every card already wears.
 */
export function TaskRing({
  state,
  size = 48,
  onPress,
  title,
}: {
  state: RingState
  size?: number
  onPress?: () => void
  /** The card's title, for the reader who cannot see the ring. */
  title?: string
}) {
  const r = 19
  const circ = 2 * Math.PI * r
  const dash = (circ * state.percent) / 100
  const words = `${ringWords(state)}${title ? `: ${title}` : ''}`
  const digits = state.done ? '✓' : state.untouched ? '' : String(state.percent)
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={!onPress}
      aria-label={state.done ? `Done, tap to reopen: ${title ?? ''}`.trim() : `${words}. Set where it stands`}
      aria-pressed={state.done}
      data-task-ring
      data-percent={state.percent}
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: onPress ? 'pointer' : 'default',
        display: 'inline-block',
      }}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--text-600)" strokeWidth={state.untouched ? 2.5 : 5} opacity={state.untouched ? 1 : 0.35} />
        {state.percent > 0 ? (
          <circle cx="24" cy="24" r={r} fill="none" stroke={state.done ? '#16a34a' : '#2563eb'} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
        ) : null}
      </svg>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800,
          fontSize: size >= 44 ? '0.8rem' : size >= 34 ? '0.68rem' : '0.6rem',
          fontVariantNumeric: 'tabular-nums',
          color: state.done ? 'var(--text-green-700)' : 'var(--text-strong)',
          lineHeight: 1,
        }}
      >
        {digits}
      </span>
    </button>
  )
}
