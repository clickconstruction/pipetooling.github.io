import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7748',
  date: '2026-11-18',
  title: 'Estimates: saving a draft keeps the page up',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Save draft no longer blanks the estimate for a moment. The page stays where you are: the same spot, the open sections still open, the boxes as you left them.',
    'Picking a customer used to blank the page too. It now saves behind the page, and the cursor stays in the customer box.',
    'Typing over a picked customer\'s name to look for another used to empty the box after the first letter. The box now keeps what you type.',
    'Words typed while a save is still running stay in the box, and the draft saves them a moment later by itself.',
  ],
}

export default note
