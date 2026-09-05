import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2844',
  date: '2026-09-05',
  title: 'Superintendents see only the work orders on their own jobs',
  kind: 'fix',
  highlights: [
    'A superintendent now sees and edits sub work orders only on jobs they are assigned to — through the project or as a member of the job\'s team. Work orders on other crews\' jobs no longer show up in their job window or Dashboard counts.',
    'Follows the projects fix: work orders attached to a workflow step already followed the project; this closes the same gap for work orders attached to a sheet or drafted straight on a job.',
    'Nothing changes for the office — masters, assistants, controllers, and estimators keep the full Work Orders board; subs still see their own.',
  ],
}

export default note
