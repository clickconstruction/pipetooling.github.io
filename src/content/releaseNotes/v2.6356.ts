import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6356',
  date: '2026-11-02',
  title: 'Every set of plans says what changed from the one before it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The New set form asks What changed when a set replaces the one a part builds from: which sheets or areas moved, and what it means for our work. The memo keeps who sent it and where the file is.',
    'On a job’s Documents tab and on the development’s Plans look, the change line reads under each set, between it and the set before it. An older set with none shows Write what changed, so the office can fill in the sets already on a site.',
    'The History line a part switch writes now ends with what changed, so a crew reading the job the next morning reads what moved, not only which set.',
  ],
}

export default note
