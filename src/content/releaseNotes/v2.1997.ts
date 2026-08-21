import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1997',
  date: '2026-08-21',
  title: 'Combined-GC names get a cleanup nudge',
  kind: 'feature',
  highlights: [
    'When a call-queue entry\'s builder is a made-up combined name ("Multiple GC\'s", "A / B / C"), the Why we lost and Waiting to hear cards show an amber nudge: set the real primary GC in Edit Bid and put the rest under Also sent to.',
    'Once split, each real GC gets its own queue entry with its own phone number — the combined-name workaround can retire.',
  ],
}

export default note
