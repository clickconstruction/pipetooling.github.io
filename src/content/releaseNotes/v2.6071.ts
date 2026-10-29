import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6071',
  date: '2026-10-29',
  title: 'Quickfill: Fill them in puts your own card purchases on a job',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'The Fill them in rows on Quickfill’s Today’s lines now include your own card purchases that have waited over two days with no job. They come first, oldest first, each with the day you bought it, the store, Mercury’s category and your memo.',
    'The card shows your jobs from the day before the swipe through the day after. Tap one to put the whole charge on it, or two to split it evenly and edit the amounts. Another job finds any job by number, name or street.',
    'Save and next writes the same split the tally’s Sort screen writes, and the purchases line’s count falls with it. Undo clears the split. Open Job Parts Tally is one press away for anything else.',
    'The purchases line is your own, so the owner’s and the controller’s station opens on the rows too when their own purchases are waiting.',
  ],
}

export default note
