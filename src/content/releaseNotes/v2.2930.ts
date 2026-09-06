import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2930',
  date: '2026-09-06',
  title: 'Your days on the sub portal',
  kind: 'feature',
  highlights: [
    'The sub portal gained Your days: the coming weeks as weekday cells, each saying "one job", "two jobs" or "off". Tap a day to see every job on it with the address and a Map link. A sub can be on two or three jobs in a day, so the day is the unit.',
    '"Mark this day off" lives inside the day. A booked day warns first; marking it off anyway drops a dispatch line — "Behar marked Sep 22 off — #1004 · Top-out is scheduled over it" — so the office can move it or call.',
    'Days off show on the Forecast Sub Board as stripes, with a red outline on any booking over one, and as hatched cells on the dispatch Subs lanes, so nobody offers a sub work on a day they said no to.',
  ],
}

export default note
