import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6675',
  date: '2026-11-08',
  title: 'Messages: the bids@ reader keeps each email as the sender laid it out',
  kind: 'feature',
  highlights: [
    'Every email that reaches bids@ or the team box now has its formatted copy kept beside its words: the sender’s tables, numbered lists and linked words, as they came.',
    'Nothing changes on screen yet. The next release adds a Rich text · Plain switch to the message window that draws the kept copy.',
    'Emails read before this release have no formatted copy and stay as plain words.',
  ],
}

export default note
