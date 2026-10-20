import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5202',
  date: '2026-10-10',
  title: 'GC mode: the office looks first at a certificate a trade partner sends, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A certificate a trade partner sends from its portal will wait as received. It counts for nothing until the office marks it good.',
    'One waits at a time. A second one sent replaces it.',
    'Nothing sends one yet. The portal’s form and the office’s Mark it good come next.',
  ],
}

export default note
