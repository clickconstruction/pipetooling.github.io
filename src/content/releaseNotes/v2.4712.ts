import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4712',
  date: '2026-10-06',
  title: 'Legal desk: replace the law firm in one step',
  kind: 'feature',
  highlights: [
    'The firm\'s window on the Legal desk has Replace with a new firm. You add the new firm, and the old one is retired in the same step.',
    'Before you press it, the window says what happens: the old firm\'s portal link stops working, its people stop getting emails, and its history stays.',
    'While an account is still with the old firm, it asks you to pull that account back first, and takes you to it on the desk.',
    'Only a dev can replace the firm, as with every change to it. A blank contingency or filing cost is no longer saved as zero.',
  ],
}

export default note
