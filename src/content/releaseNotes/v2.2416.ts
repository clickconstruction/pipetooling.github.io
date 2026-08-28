import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2416',
  date: '2026-08-28',
  title: 'Due dates, submitted-to, and ITB links per GC',
  kind: 'feature',
  highlights: [
    'Every GC card in Edit Bid gains its own due date & time, submitted-to contact, and ITB links — a bid going to three builders no longer shares one due date.',
    'The bid-level due date becomes the earliest due among GCs you haven\'t sent to yet (once a GC\'s letter goes out, their deadline stops driving the board) — bids without per-GC dues keep working exactly as before.',
    'Board urgency, due chips, and follow-up lenses read the same roll-up automatically.',
  ],
}

export default note
