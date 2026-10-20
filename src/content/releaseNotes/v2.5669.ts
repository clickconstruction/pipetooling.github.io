import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5669',
  date: '2026-10-20',
  title: 'Pricing: an alternate price shows its own prices the first time you open it',
  kind: 'fix',
  highlights: [
    'Switching between price cards on the Workbench could show the card you opened as "No prices yet" at $0, with every row blank, until you clicked back and forth. It most often happened right after typing a price into the other card.',
    'The card you open now always shows its own prices. A price you just typed is still saved on the card you typed it into.',
    'While a card’s prices are on their way it reads … instead of "No prices yet", so it no longer offers to copy prices over a price that has them.',
  ],
}

export default note
