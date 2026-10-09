import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5038',
  date: '2026-10-09',
  title: 'GC mode: back-charges and a trade partner’s change requests, in the database',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database can now hold a charge to a trade partner, such as cleanup or damage, on the work it signed for.',
    'The company has five days to agree or dispute it from its portal. The office keeps or drops it with a note.',
    'A trade partner can also ask for a change on its signed work. The office makes it a change order or turns it down.',
    'Each one acts only on the company the link belongs to. The screens come next.',
  ],
}

export default note
