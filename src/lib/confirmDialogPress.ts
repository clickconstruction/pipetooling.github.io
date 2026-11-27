import type { CSSProperties } from 'react'

/** The height a thumb needs (Apple's 44 pt), the floor every phone press in the app keeps. */
export const CONFIRM_PRESS_PHONE_MIN_PX = 44

/**
 * The size of a confirm window's two presses, Cancel and the act: the shared one
 * (`ConfirmDialogContext`) and the older `ConfirmDialog` component's plain window.
 * At a desk they keep the look they always had, 35.5 px from their padding and words. At a phone's
 * width (640 px and under) they stand 44 px tall, the words centred, so a thumb lands on them. The
 * colours are the window's own and stay there. Pure.
 */
export function confirmPressSize(narrow: boolean): CSSProperties {
  return narrow
    ? { padding: '0.5rem 1rem', minHeight: CONFIRM_PRESS_PHONE_MIN_PX, boxSizing: 'border-box' }
    : { padding: '0.5rem 1rem' }
}

/**
 * Which press a confirm window opens with the focus on, so which one Enter presses (finding 339, a walk of
 * 2026-11-27, and the person's word the same day: a red confirm opens on Cancel).
 *
 * A plain confirm opens on the press that acts, as it always did: Enter does the thing asked for. A red one opens on
 * Cancel. Red means the act cannot be taken back, and until this a stray Enter on **Remove from the bench** removed.
 * `cancelIsSafe` asks for Cancel on any confirm, and still paints Cancel blue. Red alone moves the focus and paints
 * nothing. Escape cancels every confirm, as before. Pure.
 */
export function confirmOpensOn(options: { danger?: boolean; cancelIsSafe?: boolean }): 'cancel' | 'confirm' {
  return options.cancelIsSafe || options.danger ? 'cancel' : 'confirm'
}
