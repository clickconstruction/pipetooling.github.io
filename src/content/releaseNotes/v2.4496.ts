import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4496',
  date: '2026-10-04',
  title: 'Job window: the contract and lien paper on the Documents tab',
  kind: 'feature',
  highlights: [
    'The Documents tab now lists the job’s contracts with their status. A signed one opens the Contract window on that record.',
    'It also lists the job’s lien paper: lien notices, the affidavit, demand letters and releases of lien, each with its day and amount.',
    'A release of lien opens the page as it was signed. A notice or a demand letter opens the Lien window on its tab.',
    'One tab now holds a job’s pay applications, bills, contract, test reports, lien paper and folders.',
  ],
}

export default note
