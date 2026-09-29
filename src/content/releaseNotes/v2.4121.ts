import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4121',
  date: '2026-09-29',
  title: 'Walk me through it: the page scrolls under the tour',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The walkthrough on Bids → Submittals (and the one on Pricing) froze the page the moment it opened, so every stop below the fold stayed out of reach and the wheel did nothing. The page now scrolls under the tour, and each stop brings its own controls into view.',
    'Clicks on the page are still held while the tour is open; Esc, Skip tour or Done close it.',
  ],
}

export default note
