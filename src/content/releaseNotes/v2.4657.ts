import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4657',
  date: '2026-10-06',
  title: 'Contracts: a paper signed by two is filed as two signatures',
  kind: 'feature',
  highlights: [
    'Filing a signed contract has a Second signer box. It starts with the second signer the draft named, and you clear it when only one person signed. A builder’s subcontract starts with the GC as the signer.',
    'The record keeps both signatures. The Contract window, Documents and the customer portal name both people.',
    'One signed paper for several jobs carries both names to every job it covers, and to a job added to it later.',
    'If the second signer already signed through the link, the filing keeps that signature.',
  ],
}

export default note
