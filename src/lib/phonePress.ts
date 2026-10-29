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
