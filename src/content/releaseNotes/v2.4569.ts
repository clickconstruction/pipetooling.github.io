import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4569',
  date: '2026-10-05',
  title: 'Bill Customer: View shows a signed lien release with its signature',
  kind: 'fix',
  highlights: [
    'In the Lien releases panel of Bill Customer, View now shows a signed release with the signature on it, like every other View.',
    'Voiding a release from that panel now records who voided it.',
  ],
}

export default note
