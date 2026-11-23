import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8323',
  date: '2026-11-22',
  title: 'Papers: the record of who opened a signed form outlives its paper',
  kind: 'infra',
  highlights: [
    'The app writes down each time someone opens a signed form. That record used to be deleted with its paper.',
    'Now it stays. It still says which paper it was and who the paper was with.',
    'Who can read that record has not changed.',
  ],
}

export default note
