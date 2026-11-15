import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7294',
  date: '2026-11-15',
  title: 'The customer portals stop carrying the database table list',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. Four kernels the portals read named a database row in a way the copy could not write out, so every portal was still sent up with the 315 KB list of tables the kernels know.',
    'Each of the four now names its rows plainly, and the copy writes them out. The customer portal is sent up at 1.33 MB where it was 1.65 MB, and 3.01 MB two days ago. The other thirteen fell by the same.',
  ],
}

export default note
