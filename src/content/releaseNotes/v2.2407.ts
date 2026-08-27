import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2407',
  date: '2026-08-27',
  title: 'Sent lives with each GC',
  kind: 'feature',
  highlights: [
    'On a bid with versions, Edit Bid\'s single "Bid Date Sent" box is now a per-GC panel — one row per GC with Mark sent, ✎ Date… to set or correct when that letter actually went out, and Un-send.',
    'The bid\'s board date is a roll-up now: the FIRST send, kept in sync automatically. Un-sending the last GC returns the bid to Unsent/Working.',
    'Marking a second GC sent from the Cover Letter no longer overwrites the board value or moves the sent date — the value stays with the bid\'s own GC, and the date stays "when it first left the building".',
  ],
}

export default note
