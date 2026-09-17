import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3569',
  date: '2026-09-17',
  title: 'Pipeline loads with half the requests — the card-charge loader stops running on a board that never shows it',
  kind: 'fix',
  highlights: [
    'Opening Jobs → Pipeline used to pull every card charge and its transactions for a column only the Parts and Job Summary tabs show — about 80 of the 146 requests behind one visit. It no longer does; Parts and Job Summary still load them.',
    'The row helpers that read the whole list (crew position, thread stats, the map\'s geocoder, the budget footings) now wait for the list to finish loading instead of re-asking as each section lands.',
    'Measured on the dev server: 146 requests → 67, last response 4.8 s → 3.2 s.',
  ],
}

export default note
