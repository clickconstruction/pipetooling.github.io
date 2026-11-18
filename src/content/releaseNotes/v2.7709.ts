import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7709',
  date: '2026-11-17',
  title: 'Painted maps: a list that is closed while it loads no longer finishes behind your back',
  kind: 'fix',
  highlights: [
    'Close a job, a development, a map or the Documents page while its painted maps are still loading, and the late answer is now dropped.',
    'Nothing on screen changes. The lists, the layer on the map and Try again read as before.',
    'This ends a rare failure in the checks that run before each update goes out, so updates wait less.',
  ],
}

export default note
