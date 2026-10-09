import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5008',
  date: '2026-10-09',
  title: 'Edit Job: a payment moved here and then removed says so',
  kind: 'fix',
  highlights: [
    'A payment moved onto a job and later removed left its moved-here line sitting over no payment.',
    'Now a second grey line sits right under it, like $1.00 removed · Robert.',
    'The line says removed, never unlinked, when no bill held the payment.',
  ],
}

export default note
