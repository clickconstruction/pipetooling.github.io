import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6454',
  date: '2026-11-03',
  title: 'The warranty test bed starts from its group’s migrated copy, like the 63 beside it',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The new warranty database test bed was written before the beds learned to start from a saved copy, so it still ran all the migrations itself.',
    'It now starts from its group’s copy in seconds, like the other beds that can.',
  ],
}

export default note
