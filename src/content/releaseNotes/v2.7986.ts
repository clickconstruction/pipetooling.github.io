import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7986',
  date: '2026-11-19',
  title: 'Papers: Send for signature keeps who signs',
  kind: 'feature',
  highlights: [
    'The Send for signature window has two new boxes: Signer name and Title (optional). Signer name opens on the person the paper is for.',
    'The paper now keeps the signer’s name, their title and the address the link went to.',
    'Sending again opens on the same name and title. The email itself has not changed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
