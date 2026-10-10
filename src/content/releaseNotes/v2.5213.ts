import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5213',
  date: '2026-10-11',
  title: 'GC mode: our contract can be signed on a job that already started',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Get started now keeps Send to sign and Mark it signed on our contract until it is signed, even after the job started.',
    'Before, a job started without Start anyway could never mark its contract signed, so Bill the customer stayed shut.',
  ],
}

export default note
