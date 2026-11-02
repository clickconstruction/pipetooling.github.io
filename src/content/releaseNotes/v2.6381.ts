import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6381',
  date: '2026-11-02',
  title: 'Put many jobs on a part of the site in one press, each job named so a person can pick',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Under the Plans look’s jobs on no part, each job is a row with its number and its name, sorted by name so one building’s jobs sit together. Tick the jobs that belong on one part, pick the part, and one press reads Put 3 jobs on Lodge.',
    'The page writes the part onto each ticked job, one at a time, and names any job that would not take it afterwards. Tick all and Clear sit beside the list.',
    'A reader with no right to write still sees the jobs as doors, as before.',
  ],
}

export default note
