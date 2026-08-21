import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1994',
  date: '2026-08-21',
  title: 'Bids remember every GC you sent them to',
  kind: 'feature',
  highlights: [
    'The Edit Bid form gains an "Also sent to" row under GC/Builder: chips for every other GC bidding the same project, with + Add GC and × to remove.',
    'Point a bid Version at a GC (the multi-GC cover-letter flow) and that GC is recorded as a recipient automatically — existing version GCs were backfilled.',
    'This is the foundation for multi-GC followup: upcoming releases surface these recipients in the call queues, so every GC you sent a bid to gets chased for a bid tab.',
  ],
}

export default note
