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
