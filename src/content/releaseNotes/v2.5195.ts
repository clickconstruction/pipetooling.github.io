import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5195',
  date: '2026-10-10',
  title: 'GC mode: a call log for each customer, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database can now keep a log of the office’s calls, texts, emails and notes with a GC customer.',
    'Only the office reads and adds to it, a line is never changed, and each line keeps who wrote it.',
    'Nothing on screen changes yet. The customer window’s Activity comes next.',
  ],
}

export default note
