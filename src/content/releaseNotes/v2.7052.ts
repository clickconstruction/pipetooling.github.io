import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7052',
  date: '2026-11-12',
  title: 'Bills sent: a bill that never went out is shown, and older sends are on the list',
  kind: 'feature',
  highlights: [
    'A yellow box at the top of Bills sent lists every bill that was made and has no send on record, with the job, the customer and the amount.',
    'The list now goes back before October 5. An older email shows its time and says the address was not kept.',
    'A bill entered from Housecall Pro shows on its day and says the app has the day only. A text with the pay link shows the number and whether it was delivered.',
    'New chips narrow the list to texts, Housecall Pro bills, or the bills with no send on record.',
  ],
}

export default note
