import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4470',
  date: '2026-10-03',
  title: 'Bids: a version, a decision or a note in the evening keeps its day',
  kind: 'fix',
  highlights: [
    'On a bid sent before per-GC sends, a version made on the evening of the send day read as added after the bid went out. It now counts as sent with the bid.',
    'The Audits tab stamped a note left after 7 pm Central with the next day. Bid Costs did the same for an unsent bid’s start and for the day a bid was decided.',
    'A GC’s lien notice on the customer review, a price request with no day of its own and the robot queue’s decided month read that next day too.',
    'The robot’s reference check counts a reference’s age from its day on the company’s calendar, in the app and on the robot’s scorecard.',
  ],
}

export default note
