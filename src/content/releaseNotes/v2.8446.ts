import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8446',
  date: '2026-11-24',
  title: 'Bills sent: a chip with nothing to chase says so',
  kind: 'fix',
  highlights: [
    'Press Did not arrive when every send arrived, and the list reads Nothing waiting on a resend. Before, it read No sends match the filters, which looked like a search that missed.',
    'Not paid and No send on record say their good news the same way when nothing is under them.',
    'Each offers See every send to go back to the whole list.',
  ],
}

export default note
