import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6629',
  date: '2026-11-07',
  title: 'The signed hours statement is the paper the office printed',
  kind: 'fix',
  roles: ['dev', 'controller'],
  highlights: [
    'The PDF a worker signs now draws the same way as the printed paper: the facts in one band across the top, the rate stated once when it is the same all period, one line per day with the in and out together, hours to two decimals, a long note on its own line under its day.',
    'A charged statement sent for signature is titled Statement of hours charged and carries its Charged band, so the signed copy agrees with the printed one. Before, it signed as a statement of hours worked with no Charged band.',
    'The worker’s signature line and the company’s line run the full width with a Date column, as on the print.',
  ],
}

export default note
