import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7528',
  date: '2026-11-16',
  title: 'Liens: one scan of a whole stack is split into a PDF for each lien (punch list #366)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Add the stamped scans now takes one PDF of the whole stack. Pick it, press It holds several liens: split it, and the window shows a picture of every page.',
    'Each page starts in order, one page a lien, with the lien’s recording number under it to read against the clerk’s stamp. Press a picture to open that page full size.',
    'Mark a page Not an affidavit for a clerk’s receipt, or Same lien as the page before for a second sheet, and the pages after it follow by themselves.',
    'One press saves each lien’s pages as a PDF of their own in that lien’s job folder. The stack itself is saved nowhere, so a big stack is fine.',
  ],
}

export default note
