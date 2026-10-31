import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6151',
  date: '2026-10-30',
  title: 'The Messages count reads in dark mode',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'In dark mode the count on Messages in the header drew its white number on a pale red, hard to read. The badge now keeps the same deep red in both themes, so the number reads in dark mode as it does in light.',
    'Nothing else about the badge changed: the same count, on the same corner of the word.',
  ],
}

export default note
