import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7330',
  date: '2026-11-15',
  title: 'The Lien desk’s Board: the rule behind it (PR 1 of 4)',
  kind: 'feature',
  highlights: [
    'The ground for the Lien desk’s Board: the whole month read as two columns of bins, monthly notices on the left and lien affidavits on the right, every job a chip in the bin of its stage.',
    'Each chip knows its day, how many stages it still has to pass, and whether it will make its day as it stands: a chip with more stages left than working days is marked at risk.',
    'Four tiles are worked out above the columns: what is due by the next day, what waits on the leader, what is in the mail, and what is unpaid on the desk.',
    'Nothing shows on the desk yet. The next change draws the Board at the top of To do in place of the lien month strip and the steps.',
  ],
}

export default note
