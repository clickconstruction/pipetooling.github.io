/**
 * The update pill over typed words (punch list #85, Diane, 2026-11-24): *the pill's Reload should warn first
 * when words are typed*, and take the person to each place they typed before they confirm.
 *
 * Since v2.8499 typed words hold the update's own reload, so the pill is what a person sees on exactly the
 * pages that hold words. Its **Reload** was a press that emptied them at once.
 *
 * Three states. `ready` is the pill as it always was. A press on **Reload** with typed words on the page
 * reloads nothing: the pill goes to `showing`, the page walks through each place (`typedTextTour.ts`) and the
 * press, now **Reload anyway**, is dead. When the walk ends the pill is `shown` and the press is live. A
 * press on it reloads: the person has seen what goes and said yes.
 *
 * A touch anywhere off the pill puts it back to `ready`. The person went to send or clear their words, and
 * the next press on **Reload** looks at the page again. Pure.
 */
export type UpdatePillWarn = 'ready' | 'showing' | 'shown'

export const UPDATE_PILL_READY_WORDS = 'A new version is ready.'
export const UPDATE_PILL_TYPED_WORDS = 'Reloading clears what you typed.'
export const UPDATE_PILL_PRESS = 'Reload'
export const UPDATE_PILL_CONFIRM = 'Reload anyway'

export type UpdatePillView = {
  words: string
  press: string
  /** The press cannot be used yet: the walk is still showing what was typed. */
  pressDead: boolean
  /** The pill carries the warning, so its line may wrap and its press says what it does. */
  warned: boolean
}

export function updatePillView(warn: UpdatePillWarn): UpdatePillView {
  if (warn === 'ready') return { words: UPDATE_PILL_READY_WORDS, press: UPDATE_PILL_PRESS, pressDead: false, warned: false }
  return { words: UPDATE_PILL_TYPED_WORDS, press: UPDATE_PILL_CONFIRM, pressDead: warn === 'showing', warned: true }
}

export type UpdatePillPress =
  /** Reload now. */
  | 'reload'
  /** Reload nothing: warn, and show what was typed. */
  | 'show'
  /** A press on the dead press. Nothing happens. */
  | 'nothing'

/** What a press on the pill's first button does. `typedText` is the page as it is at the press. */
export function updatePillPress(warn: UpdatePillWarn, typedText: boolean): UpdatePillPress {
  if (warn === 'showing') return 'nothing'
  if (warn === 'shown') return 'reload'
  return typedText ? 'show' : 'reload'
}
