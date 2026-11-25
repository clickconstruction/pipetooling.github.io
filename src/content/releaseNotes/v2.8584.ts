import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8584',
  date: '2026-11-25',
  title: 'Accounts Receivable: the offer after an Apply lands the pane too',
  kind: 'fix',
  highlights: [
    'After an Apply covers a check that came back, the app offers to close its case. That close now lands like every other.',
    'If you had that case open when you pressed the offer, the next case opens. Before, the first deposit could be picked by itself.',
    'If you had moved on to another deposit, you stay on it.',
  ],
}

export default note
