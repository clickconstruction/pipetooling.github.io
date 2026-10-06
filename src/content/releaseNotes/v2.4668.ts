import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4668',
  date: '2026-10-06',
  title: 'Job Parts Tally: a purchase’s jobs come from the day it was bought',
  kind: 'fix',
  highlights: [
    'The bank posts a card purchase hours after it happens, often the next day. The windows that offer a purchase’s jobs now use the day it was bought.',
    'The Assign window and Sort mode list the jobs from that day. When the purchase posted on a later day, the Assign window shows both dates.',
    'In Sort mode, the jobs you clocked on the day you bought it now come first.',
  ],
}

export default note
