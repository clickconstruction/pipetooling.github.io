import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7876',
  date: '2026-11-18',
  title: 'A map far down a page stays on Google Maps',
  kind: 'fix',
  highlights: [
    'A map low on a long page no longer switches to OpenStreetMap before you scroll to it. Your jobs on a map on the Dashboard is the one this hit.',
    'Google draws a map only once it is near the screen. The app used to take that wait for a map that had failed.',
    'A map that Google cannot draw still switches to OpenStreetMap, as before.',
  ],
}

export default note
