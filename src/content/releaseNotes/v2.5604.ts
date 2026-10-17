import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5604',
  date: '2026-10-17',
  title: 'Prospects: paste a sub from Google Maps',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'New Prospect has a Paste from Google Maps box. Paste what Share copies, the name, the address and the link, and the company block fills itself with the source set to Google Maps.',
    'The card shows Maps ↗ beside the website, and a sub’s license. The same Google Maps place typed twice is caught as a double, whatever the spelling.',
  ],
}

export default note
