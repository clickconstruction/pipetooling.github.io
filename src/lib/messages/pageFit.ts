/**
 * The Messages page fits a phone (the phone walk of 2026-11-21, punch lists #324 and #348).
 *
 * The page, a lane's list and a day inside *Went out today* were each a grid with no columns named. Such a grid has
 * one column as wide as the widest thing in it wants to be, and a row whose words are held to one line wants to be as
 * wide as the words: 990 px for one long line under *Went out today*. So at 375 px the whole page was 1,014 px wide
 * and the top bar, the status row and every card ran off the right edge. `ONE_COLUMN` is a column that takes the
 * room it is given and no more; the row inside then cuts its one line with dots, as it was written to.
 *
 * A *Waiting on them* row is a name with its last words at the left and a chip over three presses at the right. The
 * right side is 264 px that cannot give, so on a phone the name was left almost no room. The row now wraps: the name asks for
 * `WAITING_NAME_ROOM` before it gives any up, and when the right side does not fit beside it, it drops to a line of
 * its own, at the right. With room for both, as at a desk, the row is the one line it was.
 *
 * A *Went out today* row ends in when the line went, and for a mail sent from a mailbox that is a line of a hundred
 * letters: the hour, who wrote to whom, and from which box. It was held to one line, 660 px, beside a name left
 * nothing. That row wraps the same way, with `WENT_OUT_NAME_ROOM` for the name, and its last line may break. A short
 * *9:58 AM · Sam* still sits beside the name on a phone.
 *
 * Pure: the styles the page and its two lanes draw.
 */
import type { CSSProperties } from 'react'

/** A grid's one column, as wide as the grid and never as wide as its widest child wants. */
export const ONE_COLUMN = 'minmax(0, 1fr)'

/** A lane's list of rows, and a day's rows inside *Went out today*. */
export const LANE_LIST: CSSProperties = { display: 'grid', gridTemplateColumns: ONE_COLUMN, gap: '0.5rem' }

/** The room a *Waiting on them* name keeps before the chip and the presses move to their own line. */
export const WAITING_NAME_ROOM = '11rem'

/** The row's own layout: one line when both sides fit, two when they do not. */
export const WAITING_ROW_FIT: CSSProperties = { display: 'flex', flexWrap: 'wrap' }

/** The name and the last words under it. */
export const WAITING_NAME_FIT: CSSProperties = { flex: `1 1 ${WAITING_NAME_ROOM}`, minWidth: 0 }

/** The chip over the presses: at the right, and never wider than the row. */
export const WAITING_ACTS_FIT: CSSProperties = { marginLeft: 'auto', minWidth: 0, maxWidth: '100%' }

/** The room a *Went out today* name keeps: less than a waiting name's, so a short hour still sits beside it at 375 px. */
export const WENT_OUT_NAME_ROOM = '9rem'

/** Laid over the row's own style: it may wrap, with less air between its two lines than between its columns. */
export const WENT_OUT_ROW_FIT: CSSProperties = { flexWrap: 'wrap', gap: '0.2rem 0.6rem' }

/** The name with the line's words under it, the words cut with dots inside the column they are given. */
export const WENT_OUT_NAME_FIT: CSSProperties = { display: 'grid', gridTemplateColumns: ONE_COLUMN, gap: '0.05rem', flex: `1 1 ${WENT_OUT_NAME_ROOM}`, minWidth: 0 }

/** When it went, and the delivery mark under it: at the right, never wider than the row, breaking where it must. */
export const WENT_OUT_WHEN_FIT: CSSProperties = { marginLeft: 'auto', minWidth: 0, maxWidth: '100%', textAlign: 'right', overflowWrap: 'anywhere', display: 'grid', justifyItems: 'end', gap: '0.1rem' }

/**
 * A name that is one unbroken run of letters, an email address standing in for a name nobody has typed yet: it may
 * break where it must. At 320 px such a name stood 34 px out of its row.
 */
export const LONG_NAME_FIT: CSSProperties = { overflowWrap: 'anywhere', minWidth: 0 }
