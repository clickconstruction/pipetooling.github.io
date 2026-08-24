import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2212',
  date: '2026-08-23',
  title: 'Partner statement: acknowledgment removed; Full ledger lines up',
  kind: 'fix',
  highlights: [
    'The statement page no longer asks for sign-off: the "Acknowledge statement" button, the green "acknowledged" stamp, the "last statement awaiting your sign-off" section, the amber dot on the nav receipt, and the Dashboard nudge are all gone. Print / save PDF stays.',
    'The Full ledger\'s AMOUNT and BALANCE headers now sit exactly over their numbers.',
  ],
}

export default note
