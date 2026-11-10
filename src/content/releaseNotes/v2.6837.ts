import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6837',
  date: '2026-11-10',
  title: 'Permits: on a phone the skim card starts near the top of the screen',
  kind: 'fix',
  highlights: [
    'On a phone, Skim no longer puts the city, the value filter and Pull now above the card. They wait on Ledger. The card’s pictures, title, value, address and who pulled it now show above Keep and Pass without a scroll.',
    'The strip of Skim, Kept, Pursuing and Closed stays on one line on a phone and slides sideways.',
  ],
}

export default note
