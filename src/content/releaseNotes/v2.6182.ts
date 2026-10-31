import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6182',
  date: '2026-10-30',
  title: 'The Development page on a phone: no blank tile, no lone Note chip',
  kind: 'fix',
  highlights: [
    'On a phone the five counts at the top of a Development page sit two a row. The fifth one, Open on bills, now spans the last row instead of leaving a blank cell beside it.',
    'In the History composer the six Source chips sit three a row on a phone, so Note no longer wraps onto a line of its own.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
