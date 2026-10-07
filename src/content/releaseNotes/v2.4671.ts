import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4671',
  date: '2026-10-06',
  title: 'People: one list decides who is archived on every tab',
  kind: 'fix',
  highlights: [
    'Offsets, Contracts, Review, the Teams filter and the Hours grid now ask the People roster who is archived.',
    'A person who shares a name with someone archived is no longer hidden as archived.',
    'A roster entry archived without an app login now also leaves the Teams filter, the Hours grid and Review.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
