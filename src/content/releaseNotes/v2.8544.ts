import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8544',
  date: '2026-11-24',
  title: 'Cards and footers for the team: a ZZ test person is left out',
  kind: 'fix',
  highlights: [
    'The team list no longer shows a person whose name starts with ZZ. It already left out a sample, a twin and the walk tester.',
    'Before, a test person with a photo and an email stood ready and ticked, so Make cards would have made one for them.',
    'One person at a time is unchanged. A test person’s own card can still be opened from People, Users.',
  ],
}

export default note
