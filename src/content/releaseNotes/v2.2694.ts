import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2694',
  date: '2026-09-03',
  title: 'Hours approvals: one queue for every week',
  kind: 'feature',
  highlights: [
    'People → Hours gains an Approvals button that opens every pending clock session at once — all weeks, not just the one on screen — grouped by person and then by week, oldest stall first.',
    'Flags on the sessions worth a look before you approve: a long day (over 12 hours), a near-zero punch (under a minute), and a session with no job or bid. Tick "Flagged only" to work just those.',
    'Approve one session, a whole week, a whole person, or everything — each button says the count and the hours it is about to add to payroll. Reject, Edit, and Assign a job live on every row.',
    'The Dashboard "clock sessions are waiting on approval" item now opens this queue instead of the week view, and the Hours grid\'s amber banner gets an "All weeks" button.',
  ],
}

export default note
