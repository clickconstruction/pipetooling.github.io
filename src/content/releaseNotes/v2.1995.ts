import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1995',
  date: '2026-08-21',
  title: 'Multi-GC bids show up in every call queue',
  kind: 'feature',
  highlights: [
    'A bid sent to three GCs is now three chances at a bid tab: the Why we lost and Waiting to hear queues list the bid under every GC it went to, each with that GC\'s own phone number.',
    'The bid card shows "also sent to: …" so you always know who else has the number — one recorded reason or contact clears the bid across every GC\'s queue.',
    'The Bid Board\'s GC column grows a "+N GCs" chip on multi-GC bids; hover it to see the full send list.',
  ],
}

export default note
