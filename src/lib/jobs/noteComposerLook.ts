/**
 * How the job's note composer is drawn on a phone (the owner's phone walk of 2026-11-21: "I don't love how many
 * boxes are going on here. I think we have limited space on mobile and we're not using enough here.").
 *
 * In the job window's Activity section the note box sat four borders deep: the section's card, the panel's own
 * box, the composer's tinted box, then the box you type in. Each layer also cost side padding, so the box was 273 px
 * wide on a 375 px phone. Where the host already draws the card, the card is the one box: the panel and the composer
 * are flat, and the box you type in runs the card's full inner width. A desk keeps every box. Pure.
 */
import { PHONE_PRESS_MIN_HEIGHT } from '../phonePress'

/** The hint at a desk, where there is an Enter key to speak of. */
export const NOTE_PLACEHOLDER_DESK = 'Type a note… (Enter to post, Shift+Enter for new line)'
/** A phone's keyboard posts nothing on Enter, and the hint wrapped onto a second line there. */
export const NOTE_PLACEHOLDER_PHONE = 'Type a note…'

export type NoteComposerLook = {
  /** The host's card is the one box: the panel and the composer lose their border, fill, radius and side padding. */
  flat: boolean
  placeholder: string
  /** The note box's words. 16 px on a phone, where an iPhone zooms the page into a smaller field. */
  boxFontSize: string
  /** The least height of every press in the composer, in px; null at a desk, where each keeps its own. */
  pressMinHeight: number | null
}

export function noteComposerLook(input: {
  /** Phone width, by the job window's own test (`useNarrowViewport640`). */
  phone: boolean
  /** The panel sits inside a card its host draws: the job window's Activity fold, the crew window's Notes fold. */
  hostCard: boolean
}): NoteComposerLook {
  if (!input.phone) return { flat: false, placeholder: NOTE_PLACEHOLDER_DESK, boxFontSize: '0.875rem', pressMinHeight: null }
  return { flat: input.hostCard, placeholder: NOTE_PLACEHOLDER_PHONE, boxFontSize: '1rem', pressMinHeight: PHONE_PRESS_MIN_HEIGHT }
}
