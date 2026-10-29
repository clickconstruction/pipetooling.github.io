import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6065',
  date: '2026-10-29',
  title: 'Where everyone stands makes room for a crowded end on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, when several names crowd one end of the Bid Board’s Where everyone stands band, the band hangs a third row of name tags, so every name reads whole instead of hiding under its neighbor.',
    'The band grows by about 24 px only when the third row is used. On a desk it draws exactly as before.',
    'The caption under the band, 0% – 100% Won rate, now reads below the last row of names on every screen instead of under the first row.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
