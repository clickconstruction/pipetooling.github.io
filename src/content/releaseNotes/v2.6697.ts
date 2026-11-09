import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6697',
  date: '2026-11-08',
  title: 'Legal desk: a claim line can be settlement only',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A claim line can be marked Settlement only when you add or edit it: claimed in an offer, not in the demand. The line wears a chip on the table, on the desk and on the firm’s portal, and a sentence under the table says what it adds up to.',
    'How much?, What’s left for us?, the firm’s total demand and the printed packets leave a settlement-only line out. The claim bar and What each path nets keep it, since those are the settlement’s figures.',
    'Lines already typed are in the demand as before.',
  ],
}

export default note
