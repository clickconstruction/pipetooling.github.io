/**
 * The presses at the top of the Bid window on a phone (punch list #426, the live walk of 2026-11-24): **Copy for
 * text** and **Edit bid** stood 33 px tall and the ✕ 30 by 33. Since one press on a My Bids row opens this window, its
 * ✕ is the way back on every bid. At a phone's width (640 px and under) each stands a fingertip tall, and the ✕ as
 * wide. At a desk every function here adds nothing. The height is `phonePress.ts`'s, the one source for it. Pure.
 */
import type { CSSProperties } from 'react'
import { PHONE_PRESS_MIN_HEIGHT } from '../phonePress'

/** A desk takes nothing: one frozen object, so the window's spread is a no-op there. */
const DESK: CSSProperties = Object.freeze({})

/** **Copy for text** and **Edit bid**: a fingertip tall on a phone, their words centred as a button centres them. */
export function bidWindowHeadPress(narrow: boolean): CSSProperties {
  return narrow ? { minHeight: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' } : DESK
}

/** The window's ✕: a fingertip's square on a phone. */
export function bidWindowClosePress(narrow: boolean): CSSProperties {
  return narrow ? { minHeight: PHONE_PRESS_MIN_HEIGHT, minWidth: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' } : DESK
}
