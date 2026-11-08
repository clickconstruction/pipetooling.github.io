import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6681',
  date: '2026-11-08',
  title: 'Legal desk: the packet prints the claim table',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Print packet now carries The claim under Account, above the ledger: the open bills, the retainage held, every typed line with its basis and its document, and the total. The firm reads the same rows the desk shows and no longer re-types them from the letters.',
    'The claim table on the Account tab wears a chip that says it prints with the packet.',
    'The settlement floor the card planned to set against the claim was retired earlier, when the owner decided the attorney settles for what can be had. The claim feeds the money bars and What each path nets instead.',
  ],
}

export default note
