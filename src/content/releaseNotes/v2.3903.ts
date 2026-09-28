import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3903',
  date: '2026-09-27',
  title: 'Bids: who opens which tab is one tested rule',
  kind: 'fix',
  highlights: [
    'The Bids page decided who may open it in five places and which tabs each role sees in a dozen more. Those are now one rule with tests for every role and every tab. Nothing you see changed.',
  ],
}

export default note
