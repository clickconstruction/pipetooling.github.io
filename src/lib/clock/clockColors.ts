import { ORANGE_UNDER_WORDS, WORDS_ON_ORANGE } from '../orangeUnderWords'

/**
 * The clock-in accent (v2.3193): the one orange that means "you are about to
 * start the clock" — the visible Clock In button, the Clock In modal's top
 * stripe and focus rings, and the Job Mode card's manual Clock In. Advance
 * actions on the card (Start First Job, Next Job) stay green; they move a tech
 * along a schedule that already exists rather than starting the clock.
 */
export const CLOCK_IN_ACCENT_ORANGE = '#ff6600'

/**
 * The clock-in orange under words (v2.6186): the Clock In button, Complete Clock
 * In, the Job Mode card's manual Clock In and the Currently in strip's head fill
 * with safety orange's deep shade (lib/orangeUnderWords) under white words,
 * 4.59:1. White on `#ff6600` read 2.94:1 (What everyone sees, punch list #194);
 * v2.5981 gave it near-black words instead, but the owner likes white on orange.
 * The modal's stripe and focus rings keep `CLOCK_IN_ACCENT_ORANGE`.
 */
export const CLOCK_IN_ACCENT_UNDER_WORDS = ORANGE_UNDER_WORDS

/** The words on the clock-in orange: white (v2.6186), safety orange's own pairing. */
export const CLOCK_IN_ACCENT_TEXT = WORDS_ON_ORANGE
