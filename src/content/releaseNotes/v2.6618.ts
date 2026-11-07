import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6618',
  date: '2026-11-06',
  title: 'The punch list opens with a Shortlist: every open card by group, smallest first',
  kind: 'feature',
  highlights: [
    'The punch list now opens with a Shortlist: every open card by group, smallest first, one line each with its number, its size letter and its name. Press the number to jump to the card below. The page filter applies to it too.',
    'The letter is read from the card’s own size words, so the list is always as fresh as the board: a train takes its whole letter, a card with parts takes its biggest part, and a card that names what is left takes that. A card whose size names no letter reads a dash and sorts last in its group.',
    'Hide the shortlist folds it to one line and the device remembers. A link to the punch list ending in #shortlist lands on it, and the same list can be printed as a table for a chat.',
  ],
}

export default note
