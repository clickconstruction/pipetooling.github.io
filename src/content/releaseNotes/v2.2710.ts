import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2710',
  date: '2026-09-03',
  title: 'Person Desk: the whole person, and a Person tab',
  kind: 'feature',
  highlights: [
    'The drawer now holds everything: Field (the truck they hold, housing, licenses), Paperwork (every document with its state, the clock-in nag, and packet assignment), Records (HR file freshness, write-ups and attendance incidents, a Rate door), and today\'s Schedule.',
    'People → Person: the same desk as a page. The roster rail on the left carries attention dots — amber for sessions waiting, paperwork unsent or expiring, or a missing roster row; red for expired paperwork — with a Needs attention group on top.',
    'Hand off a vehicle or park it in the motor pool, assign or end housing, and assign a packet right from the desk; sending and uploading signed copies stay on Contracts, one tap away.',
    'Open file on the Records row lands on that person\'s HR file.',
  ],
}

export default note
