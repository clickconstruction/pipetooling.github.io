import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7136',
  date: '2026-11-13',
  title: 'Bids: a fixed price in the text you share with a teammate reads as one price for the line',
  kind: 'fix',
  highlights: [
    'Copy for text, in Share with a teammate on the Pricing tab, drew a fixed-price row as a sum that did not add up, like 3 × $5,000 = $5,000.',
    'That row now reads Mobilize — 3, fixed price $5,000: the count as stored, then the one price for the whole line.',
    'Every fixed-price row reads this way, a count of 1 too. Other rows, each line total and the total read as before.',
    'The email, the Pricing tab and what the GC receives are unchanged.',
  ],
}

export default note
