import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6312',
  date: '2026-11-01',
  title: 'Papers with the plans, the ground: a spec, a schedule or a task list is kept beside the set it goes with',
  kind: 'feature',
  highlights: [
    'The register that holds a part’s plan sets now also holds the papers that come with them: specs, submittals, schedules, scopes, change orders, meeting notes, task lists, reports and sheets, from the GC, the architect, the engineer, a supplier or us.',
    'A paper says which set it goes with, can be marked as owed to us while we wait on it, and can hand the question it raised to the estimators or Dispatch and read the answer back.',
    'Keeping a paper writes one line on the site’s History for the day it came, so the plans and the papers read as one stream. A paper can never become the set a part builds from.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
