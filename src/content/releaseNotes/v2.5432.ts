import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5432',
  date: '2026-10-13',
  title: 'The checks stop testing a pull request’s older code once a newer push arrives',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'When a branch is pushed again, the checks still running on its older code stop, and the runners go to the newest code.',
    'A merge waiting in the queue and the live site’s own build are never stopped.',
    'Nothing about what is tested changes; the same checks run on the code that will land.',
  ],
}

export default note
