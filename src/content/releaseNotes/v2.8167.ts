import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8167',
  date: '2026-11-21',
  title: 'Lien desk: a sent notice names its months at the top of its pane',
  kind: 'fix',
  highlights: [
    'On a notice in Sent, the line that pins to the top of the pane read No month picked. The Months on this job bar read no months. Both were wrong, since the notice went out for its months.',
    'Both now read the months the notice named, like Jul + Aug.',
    'A sent notice whose record keeps no month reads no month named. It no longer reads as a month the office still has to pick.',
  ],
}

export default note
