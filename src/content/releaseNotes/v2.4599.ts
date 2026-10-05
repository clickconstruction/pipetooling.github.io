import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4599',
  date: '2026-10-05',
  title: 'Submittals: the GC’s review page no longer takes answers from the office',
  kind: 'fix',
  highlights: [
    'Signed in to the app, you could open a GC’s review link, say who you were and approve rows, and the room recorded it as the GC’s answer. It no longer does.',
    'The page now says "You are signed in as the office" and points you to the Submittals tab, where you type in an answer they gave you.',
    'Reviewers outside the company see no change.',
  ],
}

export default note
