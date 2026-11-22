/**
 * A row of the Dashboard's Your people card, laid out so it fits a phone (the phone walk of 2026-11-21).
 *
 * The row is a ring, the person's name with their open card under it, and at the right a chip with **🔔 Remind**. The
 * chip and the press were one group that could not shrink or wrap. Beside a long chip (*nothing moved · oldest 1
 * days*) that group was 284 px in a row with 247 to give: the name's column went to nothing, its words broke one to
 * a line, and Remind hung 27 px out of the card, which made the whole Dashboard 2 px wider than a 375 px phone.
 *
 * Now the row wraps. The name asks for `YOUR_PEOPLE_NAME_ROOM` before it gives any up, so when the chip and the press
 * do not fit beside it they drop to a line of their own, at the right. On that line the group may shrink to the row,
 * and then the press goes under the chip. With room for everything, as at a desk, the row is the one line it was.
 *
 * Pure: the three style objects. `DashboardYourPeopleSection.tsx` draws them.
 */
import type { CSSProperties } from 'react'

/** The room a name keeps before the chip and Remind move to their own line: about a first name, a count and *open*. */
export const YOUR_PEOPLE_NAME_ROOM = '9rem'

/** The row: one line when everything fits, two when it does not. */
export const YOUR_PEOPLE_ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.35rem 0.65rem',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '0.45rem 0.6rem',
}

/** The name and the open card under it: takes the room that is left, and keeps `YOUR_PEOPLE_NAME_ROOM` of it. */
export const YOUR_PEOPLE_NAME: CSSProperties = { flex: `1 1 ${YOUR_PEOPLE_NAME_ROOM}`, minWidth: 0, textDecoration: 'none', color: 'inherit' }

/** The chip and Remind: at the right, never wider than the row, the press under the chip when the row is that narrow. */
export const YOUR_PEOPLE_ACTS: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'center',
  flex: '0 1 auto',
  minWidth: 0,
  maxWidth: '100%',
  marginLeft: 'auto',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}
