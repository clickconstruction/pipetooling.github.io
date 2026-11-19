import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7892',
  date: '2026-11-18',
  title: 'Lien desk: voiding a filed lien puts its paper back',
  kind: 'fix',
  highlights: [
    'A lien recorded as filed by mistake can be taken back cleanly. Void its record and the lien returns to Ready to file by itself, for everyone in the office. Until now it stayed on the Board under Served with no lien on file.',
    'The leader’s approval stands. His name, his day and how he approved stay on the paper, so nobody asks him again. A paper nobody had approved goes back to a draft.',
    'Back from the clerk has Take it back on every recorded line. It asks first. Confirm take back voids that filing, and the line opens again for the right number.',
    'The Lien window’s Void now says where the paper went.',
  ],
}

export default note
