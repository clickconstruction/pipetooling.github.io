import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7047',
  date: '2026-11-12',
  title: 'Pipeline: a billed row no longer gives up on a lien early, and asks to serve a filed one',
  kind: 'fix',
  highlights: [
    'When a notice window has closed but the affidavit can still be filed, the row now reads Send the late notice by the affidavit’s day. It used to read Lien gone, while the job’s Lien window said a late notice could still go.',
    'Once the affidavit’s own day has passed, the row reads Lien gone, as before.',
    'A filed lien whose copy is not served reads Serve the affidavit by its last day, as soon as the board loads. Before, that showed only after the Lien desk had been opened.',
    'A filed lien whose copy is served reads Lien filed, with the day it was served under it.',
  ],
}

export default note
