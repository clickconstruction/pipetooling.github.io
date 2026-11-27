/**
 * The heights a thumb needs (punch list #189, PR 3; the walk of 2026-10-26 at 375 px found 33 px percent chips, 21 px
 * filter pills and 20 px text links on the five screens a tech touches daily). One source for the sizes, so the
 * render test that holds them and the surfaces that draw them cannot drift. Pure.
 */
import type { CSSProperties } from 'react'

/** Every daily press a tech makes stands at least this tall: a fingertip. */
export const PHONE_PRESS_MIN_HEIGHT = 44

/** A filter pill a tech presses perhaps once a week stands at least this tall on a phone. */
export const PHONE_PILL_MIN_HEIGHT = 32

/**
 * The job window's activity pills (All · Notes · Reports · ＋ Report): the office's small chip at a desk, a 32 px pill
 * with room for a fingertip on a phone. The colours stay the caller's.
 */
export function activityPillStyle(narrow: boolean): CSSProperties {
  return narrow
    ? { minHeight: PHONE_PILL_MIN_HEIGHT, padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999 }
    : { padding: '0.15rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 999 }
}

/**
 * Whether the pills over a job's updates keep to one row that slides sideways, or wrap (2026-11-20). On a phone the
 * row that carries the Customer pill ran 55 px past the card, and a wrap left Customer alone on a second row. At a
 * desk, and on a row without Customer, the pills wrap as they did.
 */
export function activityPillsOnOneRow({ narrow, withCustomer }: { narrow: boolean; withCustomer: boolean }): boolean {
  return narrow && withCustomer
}

/**
 * The trims that let a tech's five pills stand whole on one row of a 390 px phone: the height stays a fingertip's,
 * the sides come in to the desk chip's. A row still too long for the card (a smaller phone, three-figure counts, the
 * office's eight pills) slides.
 *   - `pill`: a drawn pill's padding.
 *   - `word`: a dim word's padding. It has no outline to keep clear of.
 *   - `gap`: between pills.
 *   - `countGap`: between a pill's word and its count.
 *   - `fadeSlack`: how much may hide past the edge before the strip draws its fade. A dim word's own side padding
 *     and border hide first, and nothing is lost with them.
 */
export const ONE_ROW_PILLS = {
  pill: '0.3rem 0.5rem',
  word: '0.3rem 0.25rem',
  gap: '0.125rem',
  countGap: '0.25rem',
  fadeSlack: 6,
} as const

/** The width at and under which a screen is a phone's: the app's 640 px line (`useIsMobile`). */
export const PHONE_SCREEN_MAX_WIDTH = 640

/** How tall a press drawn as words in a line of words stands: one line of the portal's 0.85rem words. */
export const IN_LINE_PRESS_DRAWN = 18

/** The shortest a link drawn as words stands: one line of 0.75rem words. Its padding is worked out from this. */
export const IN_LINE_LINK_DRAWN = 14

/** The padding over and under a fold's line (`summary`), which stands about 17 px as drawn: its words sit in the middle of 44. */
export const FOLD_LINE_PAD = 13

/** The padding over and under a file picker, which stands about 21 px as drawn. */
export const FILE_PICKER_PAD = 11

/**
 * One style rule that makes every press inside a shell stand a fingertip tall on a phone, and changes nothing at a
 * desk (finding 290, the walk of 2026-11-27: the trade portal's presses stood about 30 px at every width). `shell` is
 * the selector of the element that wraps the page, so a press outside it is left as it is.
 *
 *   - A button stands 44 px tall. The rule is marked important because a button that sets its own smaller height in
 *     its style would win otherwise.
 *   - A button that sits in a line of words carries `data-press-in-line`: it grows the same, and its margin gives the
 *     growth back, as `thumbInLine` does, so the line stays as tall as it was drawn.
 *   - A link drawn as words (*Call*, *Open ↗*) is drawn as it was. Its padding grows what a finger can hit to 44 px
 *     or more, and its margin gives the padding back where the link is a block, so nothing around it moves.
 *
 * The four presses that are not buttons or links (the follow-up, 2026-11-27, on a read of the portal at 375 px that
 * found them at 17 to 32 px): each stands 44 px tall too.
 *   - A tick or a radio is pressed by its label, so the label grows. The box itself keeps its size.
 *   - A pick (`select`). It takes a set height, not a least one (finding 335, the simulator's look of 2026-11-27):
 *     Safari on an iPhone gives a pick whose height is left to it a least height of its own, over the page's, so the
 *     two picks of the quote form stood 30 px there while a desk Chrome read 44. A height the page sets is kept.
 *   - A fold's line (`summary`). It takes padding and never a flex, which would lose its marker.
 *   - A file picker.
 * A field a person types in is not a press, and it is left as it is.
 */
export function phoneThumbPressesCss(shell: string): string {
  const back = thumbInLine(IN_LINE_PRESS_DRAWN).marginTop
  const pad = -thumbInLine(IN_LINE_LINK_DRAWN).marginTop
  return (
    `@media (max-width: ${PHONE_SCREEN_MAX_WIDTH}px) { ` +
    `${shell} button { min-height: ${PHONE_PRESS_MIN_HEIGHT}px !important; } ` +
    `${shell} button[data-press-in-line] { margin-top: ${back}px; margin-bottom: ${back}px; } ` +
    `${shell} a[href] { padding-top: ${pad}px; padding-bottom: ${pad}px; margin-top: -${pad}px; margin-bottom: -${pad}px; } ` +
    `${shell} label:has(input[type="checkbox"]), ${shell} label:has(input[type="radio"]) { min-height: ${PHONE_PRESS_MIN_HEIGHT}px !important; } ` +
    `${shell} select { box-sizing: border-box; height: ${PHONE_PRESS_MIN_HEIGHT}px !important; } ` +
    `${shell} summary { box-sizing: border-box; min-height: ${PHONE_PRESS_MIN_HEIGHT}px; padding-top: ${FOLD_LINE_PAD}px; padding-bottom: ${FOLD_LINE_PAD}px; } ` +
    `${shell} input[type="file"] { box-sizing: border-box; min-height: ${PHONE_PRESS_MIN_HEIGHT}px !important; padding-top: ${FILE_PICKER_PAD}px; padding-bottom: ${FILE_PICKER_PAD}px; } }`
  )
}

/**
 * A press that sits in a line of words or in a bar (the phone walk of 2026-11-21: a job's number at 28 px on a Lien
 * desk row, *Worked later? ›* at 28, a sheet's × at 27). On a phone it stands a fingertip tall, and the margin gives
 * back what it grew by, so the line or the bar around it stays as tall as it was drawn and nothing under it moves.
 * `drawn` is the height the press had. A press already a fingertip tall takes no margin.
 */
export function thumbInLine(drawn: number): { minHeight: number; marginTop: number; marginBottom: number } {
  const back = Math.max(0, PHONE_PRESS_MIN_HEIGHT - drawn) / 2
  const margin = back === 0 ? 0 : -back
  return { minHeight: PHONE_PRESS_MIN_HEIGHT, marginTop: margin, marginBottom: margin }
}
