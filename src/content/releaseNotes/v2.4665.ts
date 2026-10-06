import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4665',
  date: '2026-10-06',
  title: 'Groundwork: card charges carry when they were bought',
  kind: 'infra',
  highlights: [
    'The card-charge read behind People → Spending and the Tally queue now carries when each card was used, not only when the bank posted the charge.',
    'The bank often posts a charge hours later, and often on the next day. The Tally queue will use the purchase time to keep a day of store runs together.',
    'Nothing on screen changes yet.',
  ],
}

export default note
