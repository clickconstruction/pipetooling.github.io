import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3320',
  date: '2026-09-11',
  title: 'Bank transfer card: "direct deposit", straight rules, the kind beside the number',
  kind: 'fix',
  highlights: [
    'The collapsed "Prefer to pay by bank transfer?" line on the customer statement now reads "ACH (direct deposit) • wire • check", so a customer who knows it as direct deposit sees their word before opening it. The opened card\'s first line says the same.',
    'Every line of the opened card now has one rule straight across — the Account and Bank lines used to break it where a second line stacked underneath. The account kind ("Business checking") sits to the right of the number, and the note about the bank\'s partner name moved under the grid as its own sentence.',
  ],
}

export default note
