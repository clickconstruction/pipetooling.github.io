import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7941',
  date: '2026-11-19',
  title: 'Permit news moves to Followup, with a red count and one press to answer',
  kind: 'feature',
  highlights: [
    'The strip Permit news on your bids is gone from the top of the Bid Board. A red number beside Followup counts the news on your own bids that nobody has answered. Press it to open the new Permit news lens.',
    'Each card names the kind of news, the bid, what the city shows and why it looks like your bid. A tick is a match the records show, and a question mark is what they do not say.',
    'One press answers a card. Another name on a plumbing permit asks Did we lose this bid?, with We lost it…, Still waiting and Not our job. Every other card takes Got it or Not our job.',
    'An answered card folds to one line with Undo. Not our job takes the permit off the bid for everyone, and Answered on your bids lists who said what, with a way to take it back.',
  ],
}

export default note
