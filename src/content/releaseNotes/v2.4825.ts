import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4825',
  date: '2026-10-07',
  title: 'Legal portal: the Lien grid by court',
  kind: 'feature',
  highlights: [
    'The rail beside the firm’s Lien grid now reads by GC or by court. By court, each county lists its justice precincts with their jobs and dollars, so a lawyer can pick out the cases for a court at a glance.',
    'A job over the $20,000 justice limit sits under its county as county court, never under a precinct. Jobs still waiting on a precinct or a county are counted on their own lines.',
    'With every court shown, a band names each court above its rows, on the screen and on the printed grid.',
  ],
}

export default note
