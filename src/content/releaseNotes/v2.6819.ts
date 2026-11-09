import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6819',
  date: '2026-11-09',
  title: "A supply house bill's row says what was read off its PDF, and Look shows the paper beside the lines",
  kind: 'feature',
  highlights: [
    'On Materials → Supply houses, each bill has a Lines cell. A bill filled from its PDF keeps the lines the reader saw, and the cell says *6 lines · adds up* when they sum to the paper, or names the gap: *5 lines · $12.40 short of the subtotal*.',
    'Look opens the paper beside the lines read. The strip at the top says which sum is off and by how much. A line whose own arithmetic fails is marked. Fix a number or type the missing line under the list, and the strip turns green before you save.',
    'Count it as read anyway keeps the gap beside the lines with your name, so a bill the reader could not add up still counts toward what the company buys once a person has looked.',
    'Only bills that add up, or that a person counted as read, will count in what we buy. A bill with no PDF reads *No PDF on this bill*; one the sweep has not read yet reads *No lines yet*.',
  ],
}

export default note
