import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2832',
  date: '2026-09-05',
  title: 'Job Summary — leakage flags: write-downs and collections',
  kind: 'feature',
  highlights: [
    'Jobs whose bill was agreed down carry a ✂ write-down chip, and the totals strip says how much was written down across the window. Jobs flagged for collections and not yet paid carry a ⚑ collections chip and a count.',
    'The Ahead view’s tile now reads "Won, not marked started" — bids stay on it until their outcome is set to started or complete.',
  ],
}

export default note
