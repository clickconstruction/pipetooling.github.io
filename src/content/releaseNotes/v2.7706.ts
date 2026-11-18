import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7706',
  date: '2026-11-17',
  title: 'Documents: every bid shows all of its fixture lines',
  kind: 'fix',
  highlights: [
    'On the Documents page, the Bids tab reads the fixture counts for all of the bids it lists. Before, the read stopped at a thousand lines, so bids lower on the list showed too few fixtures or none.',
    'Searching Documents for a fixture now finds those bids too.',
  ],
}

export default note
