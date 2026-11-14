import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7233',
  date: '2026-11-13',
  title: 'Updates reach the site again: the app’s main file had outgrown its offline copy',
  kind: 'fix',
  highlights: [
    'The app keeps a copy of its files on each phone and computer, so it still opens with no signal. That copy took no file over 8 MB.',
    'The app’s main file grew past 8 MB, so each update stopped before it reached the site.',
    'The copy takes up to 9 MB now, so updates reach the site again and the app still opens with no signal.',
  ],
}

export default note
