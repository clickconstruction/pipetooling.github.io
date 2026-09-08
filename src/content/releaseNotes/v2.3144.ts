import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3144',
  date: '2026-09-08',
  title: 'Superintendents see only their own projects’ jobs on the Dashboard',
  kind: 'fix',
  highlights: [
    'The Dashboard’s Superintendent Jobs list, and the “Your jobs on a map” pins that come from it, now show only jobs on projects you are assigned to — not every project-linked job in the company.',
    'Only waiting and working jobs appear, matching the Assigned Jobs list; billed and paid jobs drop off.',
    'Map pins for superintendent jobs are colored from the job’s real status.',
  ],
}

export default note
