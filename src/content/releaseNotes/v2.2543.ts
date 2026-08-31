import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2543',
  date: '2026-08-31',
  kind: 'feature',
  title: 'Robot bid requests dispatch the robots directly',
  highlights: [
    'When someone requests a robot bid (the green robot icon), the robots now work those bids first — oldest ask on top, and a request never ages out of their queue.',
    'The moment a robot picks a requested bid up, its board icon turns colorful so everyone can see it’s in progress.',
  ],
}

export default note
