import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7134',
  date: '2026-11-13',
  title: 'Updates reach the site again: the app’s code check had outgrown its memory',
  kind: 'fix',
  highlights: [
    'Before each update goes out, a check reads all of the app’s code. The app had grown past the memory that check was given, so it stopped halfway.',
    'New changes then stopped reaching the site, and the checks on changes still waiting to go in failed too.',
    'The check has more room now, so updates reach the site again.',
  ],
}

export default note
