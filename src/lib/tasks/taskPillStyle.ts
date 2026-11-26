import type { CSSProperties } from 'react'
import { phoneTall } from '../phonePressFloor'

/**
 * The quiet press of a task card (punch list #369): the New task window's Add row, brought to Checklist → Today. A
 * card's extras wait as grey pills with their names on them, and one that is open or set is lit in the window's blue.
 * One home, so the card's own note press and the page's extras beside it cannot drift apart.
 *
 * 32 px at a desk and a thumb's 44 on a phone (`phoneTall`): the phone walk of 2026-11-21 read ＋ Note, 📷 Photo,
 * 🗺 Map and ⋯ More at 32 on the Next card.
 */
export const TASK_PILL_STYLE: CSSProperties = {
  font: 'inherit',
  fontSize: 12.5,
  minHeight: phoneTall(32),
  padding: '4px 11px',
  borderRadius: 999,
  border: '1px solid transparent',
  background: 'var(--bg-muted)',
  color: 'var(--text-700)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

/** Laid over `TASK_PILL_STYLE` while the pill's thing is open or set. The whole border, since React clears a longhand it no longer sees. */
export const TASK_PILL_LIT_STYLE: CSSProperties = {
  background: 'var(--bg-blue-tint)',
  border: '1px solid #2563eb',
  color: 'var(--text-blue-800)',
  fontWeight: 700,
}

/**
 * Where a task row's presses sit (punch list #369). At a desk a row's presses stand at the right of its words, in a
 * box held to 55% of the row. On a phone four presses filled that box two by two and left the words about 75 points:
 * a done line wrapped to four lines and the green line under it to four more. So on a phone the presses take a row of
 * their own under the words, the shape the Next card has at every width.
 */
export function taskPressesUnderWords(lead: boolean, phone: boolean): boolean {
  return lead || phone
}
