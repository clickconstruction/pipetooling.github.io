import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8251',
  date: '2026-11-21',
  title: 'View as: the server refuses the last seen mark too',
  kind: 'fix',
  highlights: [
    'The server now refuses to record last seen time or app time from a session a dev opened through View as or Imitate.',
    'Before, only the app held it back, so a browser on an older build could still record it.',
    'A person’s own sign-in is never held, whether by password or by an emailed link.',
  ],
}

export default note
