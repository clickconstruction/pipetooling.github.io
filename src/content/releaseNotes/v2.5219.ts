import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5219',
  date: '2026-10-10',
  title: 'The Bridge says how sure its cash forecast is',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Under the cash chart a band shows how much of the expected money rests on a promise, on a pay pace, or on a late invoice assumed to land.',
    'When one day carries most of the window’s receipts, a line names it, what else falls due that day, and that it is the day to watch.',
    'A late invoice is now assumed to land within that customer’s own pay pace, 7 to 45 days, instead of every late invoice landing on the same day two weeks out.',
  ],
}

export default note
