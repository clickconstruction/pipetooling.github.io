import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3349',
  date: '2026-09-11',
  title: 'Split by line: tag each line item with who pays, and make one bill per payer',
  kind: 'feature',
  highlights: [
    'Set a job\'s "Bills go to" to Split by line and every work line on the Bill tab gets a Pays toggle — the customer or the GC.',
    'One click, "Make 2 bills by payer", carves a Ready-to-Bill draft per payer from every unbilled line, each already addressed. No more second job at the same address to bill the other party.',
    'Hours, costs, Burn and the Job Summary stay on one job number.',
  ],
}

export default note
