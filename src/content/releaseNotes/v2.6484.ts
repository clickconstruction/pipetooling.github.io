import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6484',
  date: '2026-11-04',
  title: 'The charges screens count only the days a standing would fix, and a failed read leaves the column unpriced',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'The Charges window, the Statement of charges window and the hours statement window count only the days that price at nothing because nobody out counts as anything. A day with no rate on the card, or a flat rate not set, no longer counts against the standings.',
    'When the Job Summary cannot read who counts as what, its Charges and Premium cells stay a dash and their title names the reason, instead of pricing every day at nothing and naming everyone as nobody.',
    'A controller or a pay-approved master reads the names in the callout and the words to ask a dev, with no link to a settings tab or a desk row they cannot open. A dev keeps the links.',
    'The guide says a dev sets Charged as and who counts as what.',
  ],
}

export default note
