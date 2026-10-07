import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4695',
  date: '2026-10-06',
  title: 'Updates reach the app again',
  kind: 'fix',
  highlights: [
    'New versions of the app stopped going out this morning. A change made the app\'s main download too large to keep for offline use, so every update failed to publish.',
    'The lien rules window now loads the first time you open it, which brings the main download back under the limit. Everything merged since this morning goes out with this update.',
  ],
}

export default note
