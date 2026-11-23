import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8351',
  date: '2026-11-23',
  title: 'Dashboard: swipe a report left to mark it opened',
  kind: 'feature',
  highlights: [
    'On a phone, swipe a report on Recent Reports to the left to mark it opened. It is the same swipe that hides a bid on My Bids: pull until the strip turns blue, then let go.',
    'The report moves to Opened, with Undo for ten seconds. The bottom of the card says how to swipe, beside the press that marks every new report at once.',
    'At a desk, Mark opened stays a word press on each report.',
  ],
}

export default note
