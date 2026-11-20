import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7969',
  date: '2026-11-19',
  title: 'Papers: a mail kept as a paper takes only its real files',
  kind: 'fix',
  highlights: [
    'Keep this mail as a paper no longer copies a signature’s logo into the paper’s folder in Drive. The small picture Gmail adds for a Google Drive link stays out too.',
    'The line under the mail says how many pictures were left out. The real files land as before.',
    'A picture left out is still on the mail, where it opens as before.',
  ],
}

export default note
