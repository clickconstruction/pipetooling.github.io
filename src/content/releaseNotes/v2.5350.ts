import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5350',
  date: '2026-10-12',
  title: 'Messages: a place for the emails that reach bids@, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'An email that reaches bids@ can now be kept on its sender’s thread once, with its files and links.',
    'A new address gets its own Who is this? row, and the files are kept in a private place only the office reads.',
    'Nothing reads bids@ yet: the reader stays off until it is tested.',
  ],
}

export default note
