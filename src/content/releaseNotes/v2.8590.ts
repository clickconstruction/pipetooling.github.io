import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8590',
  date: '2026-11-25',
  title: 'Accounts Receivable opens with nothing picked',
  kind: 'fix',
  highlights: [
    'The window used to pick the first deposit in the list by itself, so its bills filled in and Apply was live on a row nobody chose.',
    'It now opens reading Select a bank transaction. Press a deposit and it opens on the right, as before.',
    'Switching between To match and All, or taking a Returned tick off a row, no longer picks a row for you either.',
    'A link that names a deposit still opens on that deposit.',
  ],
}

export default note
