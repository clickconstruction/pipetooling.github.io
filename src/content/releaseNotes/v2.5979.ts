import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5979',
  date: '2026-10-27',
  title: 'Bid Costs fits on a phone',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller', 'assistant', 'estimator'],
  highlights: [
    'On a phone, Bids → Bid Costs was wider than the screen, so the whole page slid sideways.',
    'The four buttons at the top that switch the view sat on one line too long for a phone. They now wrap, and History & forecast moves to a second line.',
    'Tablets and desktops look the same as before.',
  ],
}

export default note
