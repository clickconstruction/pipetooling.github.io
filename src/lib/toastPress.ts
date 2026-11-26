/**
 * A toast's two presses on a phone (punch list #426, the live walk of 2026-11-24): **Undo** after a swipe stood 55 by
 * 26 px and the × 13 by 24, on a note that leaves by itself in ten seconds. At a phone's width each stands a fingertip
 * tall. The margins give back what each grew by, as `thumbInLine` does for a press in a bar, so the toast is as tall
 * and as wide as it was drawn and nothing in it moves. At a desk every function here adds nothing. Pure.
 */
import type { CSSProperties } from 'react'
import { PHONE_PRESS_MIN_HEIGHT, thumbInLine } from './phonePress'

/** A desk takes nothing: one frozen object, so the toast's spread is a no-op there. */
const DESK: CSSProperties = Object.freeze({})

/** The action press as a desk draws it, in px tall: 0.8125rem words, 0.25rem above and below, a 1 px edge. */
export const TOAST_ACTION_DRAWN_HEIGHT = 26

/** The × as it is drawn, in px: a 1.5rem glyph on a line as tall as itself. */
export const TOAST_DISMISS_DRAWN = { width: 14, height: 24 } as const

/** The toast's one action, **Undo** or its like: a fingertip tall on a phone. */
export function toastActionPress(narrow: boolean): CSSProperties {
  return narrow ? { ...thumbInLine(TOAST_ACTION_DRAWN_HEIGHT), boxSizing: 'border-box' } : DESK
}

/**
 * The toast's ×: a fingertip's square on a phone, with the glyph in its middle. It grows into the gap beside it and
 * into the toast's own padding, so the glyph stays where it was drawn.
 */
export function toastDismissPress(narrow: boolean): CSSProperties {
  if (!narrow) return DESK
  const side = -(PHONE_PRESS_MIN_HEIGHT - TOAST_DISMISS_DRAWN.width) / 2
  return {
    ...thumbInLine(TOAST_DISMISS_DRAWN.height),
    minWidth: PHONE_PRESS_MIN_HEIGHT,
    marginLeft: side,
    marginRight: side,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
  }
}

/**
 * The role a toast's words carry, so a screen reader says them (punch list #445). A refusal or a failure is an alert,
 * which interrupts. A done or a note is a status, which waits its turn. The centre toast is a dialog that already
 * names its words, so there they carry no role and are not said twice. The role sits on the words alone, never on the
 * card, so the × and the action press are not read out with them.
 */
export function toastLiveRole(type: 'info' | 'warning' | 'error' | 'success', dialog: boolean): 'alert' | 'status' | undefined {
  if (dialog) return undefined
  return type === 'error' || type === 'warning' ? 'alert' : 'status'
}
