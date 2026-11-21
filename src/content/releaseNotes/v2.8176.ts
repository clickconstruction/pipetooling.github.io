import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8176',
  date: '2026-11-21',
  title: 'View as no longer marks the person as seen or syncs their clock',
  kind: 'fix',
  highlights: [
    'A dev looking through View as no longer sets that person’s last seen time or adds to their time in the app.',
    'View as no longer runs the salaried clock sync as that person. The server’s own schedule still fills their day.',
    'Both start again the moment the dev is back in their own account.',
    'A button the dev presses while viewing as someone still saves as that person, as before.',
  ],
}

export default note
