import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5954',
  date: '2026-10-26',
  title: 'An evening call reads as today, not tomorrow',
  kind: 'fix',
  highlights: [
    'A call logged after 7 PM read as tomorrow on the Dashboard’s call card and under Billed Awaiting Payment: couldn’t reach · Oct 27 for a call made on Oct 26. It now reads today, with every older call’s age counted on the office’s own calendar.',
    'A can’t-reach snooze logged in the evening ran one day long, and its Touched pill named tomorrow. Both now count from the day of the call.',
  ],
}

export default note
