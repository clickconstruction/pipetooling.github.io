import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2943',
  date: '2026-09-06',
  title: 'Corpus health pack — every well-recorded bid teaches the robots',
  kind: 'feature',
  highlights: [
    'Marking a bid lost without a reason now nudges right there — "Add why: an uncategorized loss can\'t teach the robots" — on Edit Bid, the quick lost panel, and the per-GC Sent panel; the six reason chips are already in your hand, so it\'s one tap.',
    'The Bid Board\'s lost rows carry the same chips inline: an unexplained loss shows the nudge and the picker on its "Why did we lose?" strip — no modal, one tap records the reason (with the usual suggestion from your note).',
    'The Counts tab header now wears a bid\'s reference grade (A/B/C/D/X) once it\'s sent or decided, with a plain line naming the gap when it\'s below A — like "no priced rows — robots can\'t learn pricing from this bid".',
    'The robot Scoreboard grew a "shadow coverage" pill: live bids a shadow run could still lock blind against vs how many already have one — every uncovered bid is a free future grade-A reference.',
  ],
}

export default note
