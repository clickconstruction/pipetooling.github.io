import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5469',
  date: '2026-10-13',
  title: 'Messages: calls and texts know which of our two numbers they came through, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A call or a text keeps the number of ours it came to: the company number, or the bids number once it has one.',
    'A STOP to one of our numbers stops texts from that number only.',
    'Nothing changes yet: every text still goes from the company number until a second number is set up.',
  ],
}

export default note
