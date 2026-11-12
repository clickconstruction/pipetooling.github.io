import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7034',
  date: '2026-11-12',
  title: 'Updates reach the live site again',
  kind: 'fix',
  highlights: [
    'For part of the afternoon of November 12, finished changes merged but did not reach clicktooling.com. A check that runs before each update was looking for a file by its old name. It now checks for what it means, so the updates that waited go out with the next one.',
    'Nothing in the app itself changes.',
  ],
}

export default note
