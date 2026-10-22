import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5731',
  date: '2026-10-22',
  title: 'Messages: the walk kit’s server half',
  kind: 'infra',
  highlights: [
    'Groundwork for the walk kit, the test that runs the whole Messages loop on the company’s own inbox and number. A new server function makes the hidden tester account, reads and answers from the bids inbox, texts from the bids number, and cleans up after the walk.',
    'It opens only to a session that holds the dev login secret, and nothing it answers ever carries a key, a token or a whole link.',
    'Nothing changes for anyone today. The walk itself ships with the next release.',
  ],
}

export default note
