import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2184',
  date: '2026-08-23',
  title: 'Quickfill: the section bar is back, and phones get a jump strip',
  kind: 'fix',
  highlights: [
    'The floating section bar at the bottom of Quickfill (and Dashboard) was hiding behind the Dispatch-mode footer — it now sits above it.',
    'On a phone the jump buttons are one row you flick sideways with a tally under it ("3 of 19 fresh · 16 need a look"), so the first section starts under the search box instead of a full screen down.',
    'Every section header has a small ✓ Mark — same as the big button at the foot, without scrolling a long list. The who/when stamp on each jump chip now sits inside the chip instead of covering its last letters.',
  ],
}

export default note
