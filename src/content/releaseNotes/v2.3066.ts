import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3066',
  date: '2026-09-07',
  title: 'Bids for primaries: the board and the customer lenses, nothing else',
  kind: 'fix',
  highlights: [
    'A primary (customer-side principal) now sees only the Bid Board, RFI, Change Order and Lien Release tabs. Pricing, Cover Letter, Followup, Working, Estimators, Robots and the Counts / Takeoffs / Labor workbench are hidden, and a deep link to any of them lands on the board with a note.',
    'The board analytics — the pulse, the weekly chart, "where everyone stands" and the people cards — are office-only; primaries and superintendents no longer see company-wide sent value, win rates or other people\'s records.',
    'No New Bid button for primaries.',
  ],
}

export default note
