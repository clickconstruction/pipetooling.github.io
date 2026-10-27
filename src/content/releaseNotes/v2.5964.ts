import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5964',
  date: '2026-10-26',
  title: 'Nine more waiting lists say how long each row has waited',
  kind: 'feature',
  highlights: [
    'My Team\'s pending sessions on the Dashboard, and Quickfill\'s sub labor with no job and Missing bill dates, now list the row that has waited longest first. Each row carries an age chip: gray while fresh, amber once it has waited, red once it is late.',
    'The Follow Up queue keeps the order you picked, and its age words now turn amber after a week and red after a month. Unpriced Fixtures, the robots\' price matrices that wait on a person, and the law firm\'s entries waiting on the Legal desk carry the same chip.',
    'Banking\'s grouped approvals lead with the label holding the oldest suggestion, and each group says how long that one has waited. The plain list reads oldest first too.',
    'A sub\'s Your money sheets now read by the day each balance becomes payable, the soonest first, and each says payable after, payable today or payable since that day, in plain grey words.',
  ],
}

export default note
