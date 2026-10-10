import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5198',
  date: '2026-10-10',
  title: 'GC mode: send the customer their schedule',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'On a GC job being built, a dev can send the customer their schedule as a dated letter from the Schedule window.',
    'The letter says the finish, each stage, the dates to meet, what changed this week and what we need from them. It never names a trade or a dollar.',
    'Send a test to yourself first, or print the letter or save it as a PDF. Each letter sent or printed is kept as it went.',
  ],
}

export default note
