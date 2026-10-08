import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4910',
  date: '2026-10-08',
  title: 'People: Review lists archived people by who they are, not their name',
  kind: 'fix',
  highlights: [
    'The Review tab’s person list now checks each pay entry against the People roster by record, like the Hours grid.',
    'Every People tab now decides who is archived the same way.',
  ],
  roles: ['dev'],
}

export default note
