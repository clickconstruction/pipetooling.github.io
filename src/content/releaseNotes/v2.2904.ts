import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2904',
  date: '2026-09-05',
  title: 'A job\'s birth is in its activity feed, price edits carry an author, every RFQ has a creator',
  kind: 'feature',
  highlights: [
    'Job → Activity now starts with the job\'s own birth — "Job opened" or "Job opened from bid B398" with who opened it. Every existing job got its birth row too (dated when it was created, no name).',
    'Bids → Pricing: every assigned book price and every hand-typed unit price now remembers who last set it and when, so "who dropped this to 38%?" has an answer in the database.',
    'An RFQ (or a bid note) can no longer land with no creator — the database fills in whoever is signed in when a screen forgets to.',
    'New Bid\'s hand-typed Last Contact now leaves a matching line in the bid\'s notes ledger instead of a date nothing explains.',
  ],
}

export default note
