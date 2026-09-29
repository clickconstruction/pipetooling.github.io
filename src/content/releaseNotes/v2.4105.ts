import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4105',
  date: '2026-09-29',
  title: 'Submittals by hand: a row lands only when you save it, and the schedule is typed right here',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    '+ Add a row by hand opens the editor first; the row exists only when you press Save, so Cancel leaves nothing behind.',
    'On a bid with no schedule, the line under the bid name and the Build Rev 1 card now say “type or paste the fixture schedule” and open the schedule box here, instead of sending you to Pricing.',
  ],
}

export default note
