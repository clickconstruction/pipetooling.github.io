/**
 * The presses of Documents → Agreements on a phone (punch list #403, the audit's look notes; measured again on a
 * harness at 390 px on 2026-11-24): a line's name stood 24 px tall, a chip and a line's act 27.8, the party picker's ×
 * 20.7 by 21.6 and **Send email** 33.5. At a phone's width (640 px and under) each stands a fingertip tall. At a desk
 * every function here adds nothing, so the look there is the caller's own. The height is `phonePress.ts`'s, the one
 * source for it. Pure.
 */
import type { CSSProperties } from 'react'
import { PHONE_PRESS_MIN_HEIGHT, thumbInLine } from '../phonePress'

/** A desk takes nothing: one frozen object, so a caller's spread is a no-op there. */
const DESK: CSSProperties = Object.freeze({})

/**
 * A press with its own box: a line's act (Send again, Take back), Contract library, Show more, Send a paper, and the
 * Send window's Cancel and Send email. Its words stay centred as a button centres them, and the row grows with it.
 */
export function paperPressFloor(narrow: boolean): CSSProperties {
  return narrow ? { minHeight: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' } : DESK
}

/** A chip that picks a kind, a state or a list. A short one (*All*) is as wide as it is tall, so it stays a pill. */
export function paperChipFloor(narrow: boolean): CSSProperties {
  return narrow ? { minHeight: PHONE_PRESS_MIN_HEIGHT, minWidth: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' } : DESK
}

/**
 * A line's name, when it is a press: on the Agreements tab and on a company's own page (`PartyPapers.tsx`). The words
 * sit in the middle of the fingertip's height, level with the tag beside them, and the line grows with the press.
 */
export function paperNamePress(narrow: boolean): CSSProperties {
  return narrow ? { display: 'inline-flex', alignItems: 'center', minHeight: PHONE_PRESS_MIN_HEIGHT } : DESK
}

/** The party picker's × as it is drawn at a desk, in px: what the phone's margins give back. */
export const PARTY_PICKER_CLOSE_DRAWN = { width: 21, height: 22 } as const

/**
 * The party picker's ×: a thumb's square on a phone. The margins give back what it grew by on every side, as a phone
 * sheet's × does (`PhoneSheet.tsx`), so the title row is as tall as it was and the × is drawn where it was.
 */
export function partyPickerClosePress(narrow: boolean): CSSProperties {
  if (!narrow) return DESK
  const side = -(PHONE_PRESS_MIN_HEIGHT - PARTY_PICKER_CLOSE_DRAWN.width) / 2
  return { ...thumbInLine(PARTY_PICKER_CLOSE_DRAWN.height), minWidth: PHONE_PRESS_MIN_HEIGHT, marginLeft: side, marginRight: side }
}
