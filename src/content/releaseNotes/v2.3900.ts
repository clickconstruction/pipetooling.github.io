import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3900',
  date: '2026-09-27',
  title: 'Controller access, batch 5: the remaining actions and group membership',
  kind: 'fix',
  highlights: [
    'A controller can now change a job’s status, edit workflow steps, read report lists, share schedules, make PO codes and merge customers — the remaining actions an assistant already had.',
    'A controller can be added to the Dispatch and Estimator inbox groups and can be an activity viewer.',
    'This completes the set: the controller role now has everything the assistant role has.',
  ],
}

export default note
