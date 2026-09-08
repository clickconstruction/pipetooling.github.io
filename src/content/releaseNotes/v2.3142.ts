import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3142',
  date: '2026-09-08',
  title: 'The bid form tells you whether the robots can bid it',
  kind: 'feature',
  highlights: [
    'Under Job Plans, a line now says “Robots will shadow this bid within the hour” with what it checked, or “Robots can’t open these plans yet” with the exact fix — an unshared Drive file, a wrong division, a missing distance — plus Copy intake address and Check again buttons.',
    'A “Don’t let robots shadow this bid” checkbox keeps a bid out of the robot queue and out of the coverage count; the Bid Board shows it muted.',
    'Distance to Office now fills itself on save whenever it is blank and the bid has an address, not only when the address field is edited. 25 live bids were filled in.',
  ],
}

export default note
