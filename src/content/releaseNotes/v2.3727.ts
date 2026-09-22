import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3727',
  date: '2026-09-22',
  title: 'Day book: estimators, and the estimating strip',
  kind: 'feature',
  highlights: [
    'Estimators are on the Day book on the days they clock into a bid, with their own lines: Sent 2 bids · BP483 BP485 · to 3 GCs · $412,000, Priced, Recorded a best effort, Asked 4 houses for prices · 1 quote in, Audited, Answered robot questions, Followed up GCs. The clock line names the bid.',
    'Pick one person and an Estimating strip appears: sent, after due date, decided, hit rate over the trailing 90 days by value, lost with no reason, no follow-up in 7 days, prices asked → in, robot delta, and hours per $100k sent — each against that person’s own earlier window. Nothing compares two estimators.',
    'A hit rate on fewer than five decided bids shows its count and reads grey: two decisions are not a rate.',
    'An Estimating chip narrows the list; the Month view gains an Estimating row; the range strip counts bids sent.',
  ],
}

export default note
