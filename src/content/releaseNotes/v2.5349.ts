import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5349',
  date: '2026-10-12',
  title: 'Messages: reading an email that reaches bids@, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules for reading an email into a person’s thread are written: who it is from, its words, its files and links, and the job its subject names.',
    'A copy one of us forwards lands on the person who first sent it. Newsletters and notices are left in Gmail.',
    'Nothing reads bids@ yet, and nothing on screen changes.',
  ],
}

export default note
