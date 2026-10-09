import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5101',
  date: '2026-10-09',
  title: 'Contracts: one spouse signs through the link, the other on paper, and both signatures stay',
  kind: 'fix',
  highlights: [
    'A PDF emailed to sign by hand keeps its link. When the customer signed there first, filing the paper no longer replaces that signature or its consent record.',
    'The filing sheet shows the link signature in place of the Signed by box. The person who signed the paper goes in Second signer.',
    'The Contract window shows each signature its own way, and History and Documents name both. Email a copy sends the paper on file.',
  ],
}

export default note
