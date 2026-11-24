import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8492',
  date: '2026-11-24',
  title: 'Bills sent: Not paid says everything that is still out',
  kind: 'feature',
  highlights: [
    'The Not paid tile on Bills sent now counts every bill that is not paid in full: the bills on the list and the bills with no send on record. Before, it left the second kind out.',
    'Under the figure are its two parts, Sent and No send on record, each with its own count and amount. Press a part to see those bills.',
    'The tile says how old the oldest bill is, such as Oldest is 62 days out. A bill with no send is counted from the day it was billed, and the tile says so.',
    'The yellow No send on record tile is now a part of this one, so no bill is counted twice. The yellow box and its chip are as they were.',
  ],
}

export default note
