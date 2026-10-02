import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4446',
  date: '2026-10-02',
  title: 'Lien desk on a phone: Already mailed opens as its own page',
  kind: 'fix',
  highlights: [
    'On a phone the Lien desk’s “Already mailed? Record it…” box was cramped, and its fields cut off their own words.',
    'It now opens as its own page over the desk, the same page the Lien window uses. Every box is full width.',
    'Back returns to the notice. A computer keeps the box it had.',
  ],
}

export default note
