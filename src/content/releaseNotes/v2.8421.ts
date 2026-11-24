import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8421',
  date: '2026-11-23',
  title: 'Help: a guide’s short address opens the guide',
  kind: 'fix',
  highlights: [
    'A guide’s address written as /help/ and the guide’s name now opens that guide. Before, it opened the Dashboard with no word about the guide.',
    'An address that points at one heading of a guide still lands on that heading.',
  ],
}

export default note
