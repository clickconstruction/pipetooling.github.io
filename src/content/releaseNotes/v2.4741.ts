import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4741',
  date: '2026-10-06',
  title: 'Lien desk: the old caller search code is removed',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The phone button stopped searching in v2.4731. The code it left behind is now removed.',
    'The find box still lists every old letter that matches under Also sent. Nothing changes on screen.',
  ],
}

export default note
