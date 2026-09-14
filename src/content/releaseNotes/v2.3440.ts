import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3440',
  date: '2026-09-14',
  title: 'New Job asks which houses the job will buy from, and carries over a same-property account',
  kind: 'feature',
  highlights: [
    'Right after a new job saves (after the contract question), the office picks the supply houses it will buy from — Ferguson, Reece, Moore — and the ask goes to Dispatch that day, so the account is open before the first parts run. None needed and Later are one tap.',
    'When another job at the same address already has an open account at a house, the prompt offers to carry it over instead of asking Curly twice — the reference, how it was opened and the rep come along, with a note naming the job it came from.',
    'This closes the five-part train: the record and the roster, the strip and the ask, the PO moment, the invoice default and the evidence card, and now the question on the new job.',
  ],
}

export default note
