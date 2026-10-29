import type { CSSProperties } from 'react'
import { useOutbox } from '../../hooks/useOutbox'
import { clockPressLineWords } from '../../lib/offline/clockPressLine'
import type { OutboxStateStore } from '../../lib/offline/outboxState'

const LINE: CSSProperties = { margin: '0.25rem 0 0', fontSize: '0.8125rem', lineHeight: 1.35 }
const TONES: Record<'amber' | 'green' | 'red', CSSProperties> = {
  amber: { color: 'var(--text-amber-800)' },
  green: { color: 'var(--text-green-700)' },
  red: { color: 'var(--text-red-700)' },
}

/**
 * The line beside the clock (punch list #163 PR 2; #183's rule, *the line beside the control
 * flips with the strip*): amber *Clock in pressed at 7:58 AM · waiting to send* while the press is
 * on the phone, green *Clock in 7:58 AM · sent 8:11 AM ✓* for the rest of the day once it landed,
 * red *Clock in 7:58 AM · could not be sent · Fix* if it comes to that. Nothing when no clock
 * press went through the queue today.
 */
export function ClockPressLine({ store, onFix, style }: { store?: OutboxStateStore; onFix?: () => void; style?: CSSProperties }) {
  const presses = useOutbox(store)
  const words = clockPressLineWords(presses, Date.now())
  if (!words) return null
  return (
    <p data-testid="clock-press-line" data-tone={words.tone} style={{ ...LINE, ...TONES[words.tone], ...style }}>
      {words.text}
      {words.fix && onFix ? (
        <>
          {' · '}
          <button type="button" onClick={onFix} style={{ font: 'inherit', fontWeight: 700, color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
            Fix
          </button>
        </>
      ) : null}
    </p>
  )
}

export default ClockPressLine
