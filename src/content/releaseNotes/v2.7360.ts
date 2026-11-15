import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7360',
  date: '2026-11-15',
  title: 'GC difficulty rating, part 6: the site is picked on the bid, and a GC’s record shows what the rating did',
  kind: 'feature',
  highlights: [
    'The site is picked on each bid, not on the GC. On the Pricing tab press Pick under the difficulty chip, or pick it under On this bid when you rate from the Bid Board. The pick becomes field hours on the bid at the price list’s site percent.',
    'A bid to a GC nobody has rated can still carry a site pick.',
    'On a rated GC’s record, What the rating did counts the bids to them since they were rated, how many were won, and the difficulty cost priced in. The office also sees how the jobs ran against the hours priced, and is asked to rate again when hours ran past.',
    'A difficulty line held down by the cap now says so in its own words, and a reason you type keeps the capital you typed.',
  ],
}

export default note
