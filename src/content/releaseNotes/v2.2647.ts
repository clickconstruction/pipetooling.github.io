import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2647',
  date: '2026-09-02',
  title: 'Superintendents can post job notes',
  kind: 'fix',
  highlights: [
    'Posting a note on a job — including the Arrived and Leaving buttons — no longer fails for superintendents. It works on jobs where you are on the crew, on the schedule, or assigned to the project.',
    'Superintendents also now see the plain notes other people posted in the job activity feed, not just the system events.',
  ],
}

export default note
