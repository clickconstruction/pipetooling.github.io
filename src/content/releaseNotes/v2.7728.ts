import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7728',
  date: '2026-11-17',
  title: 'Bids: the Pricing tab has a test that opens it on a priced bid',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, a new test opens the Pricing tab on a small priced bid and checks each part of the screen draws.',
    'It checks the figures on the bar, the rows, the tools, the cards, the lock on a sent bid and the windows the tab opens.',
    'Nothing changes on screen. The next changes to the Pricing file are checked against it.',
  ],
}

export default note
