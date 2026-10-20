import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5126',
  date: '2026-10-09',
  title: 'GC mode: a trade partner signs its statement of work, in the database',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database can now record a trade partner signing its statement of work from its portal.',
    'It signs only work the office sent it, and only once the company has signed our master agreement.',
    'The signature keeps the name, the time, the drawing if there is one, and where it was signed from.',
    'It acts only on the company the link belongs to. The portal’s sign screen comes next.',
  ],
}

export default note
