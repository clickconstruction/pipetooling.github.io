import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4570',
  date: '2026-10-05',
  title: 'Legal desk: Write down opens on the account\'s largest open bill',
  kind: 'fix',
  highlights: [
    'Write down… at the top of an account now opens on the largest open bill line of the whole account, as the guide says.',
    'Before, it used the first job on the account. If that job had no billed line it said there was nothing to write down, even when another job had one.',
  ],
}

export default note
