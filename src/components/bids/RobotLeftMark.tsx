import type { CSSProperties } from 'react'
import { ROBOT_LEFT_MARK_TEXT } from '../../lib/bids/robotLeftToYou'

/**
 * The left-to-you mark (v2.5751, punch list #142): the ring's shape, dashed and empty, with
 * *you* inside — the card's word for a bid a person took off the robots. It sits where the robot
 * icon sits, at the icon's size, so the column never shifts. Purely presentational: the caller's
 * button carries the tooltip, the label and the tap that opens the sheet.
 */
export function RobotLeftMark({ size = 26 }: { size?: number }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: '1.5px dashed var(--border-strong)',
    display: 'inline-grid',
    placeItems: 'center',
    flex: 'none',
    fontSize: Math.max(8, Math.round(size * 0.36)),
    fontWeight: 700,
    letterSpacing: '0.02em',
    lineHeight: 1,
    color: 'var(--text-muted)',
    background: 'var(--surface)',
  }
  return (
    <span style={style} aria-hidden data-testid="robot-left-mark">
      {ROBOT_LEFT_MARK_TEXT}
    </span>
  )
}
