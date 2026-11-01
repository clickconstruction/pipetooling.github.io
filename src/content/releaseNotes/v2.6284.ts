import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6284',
  date: '2026-11-01',
  title: 'One Drive folder per job, under its customer',
  kind: 'feature',
  highlights: [
    'Every job’s Drive folder now sits under its customer’s folder, named by the office’s pattern: Jobs › the customer › the job. A job with no customer yet sits under No customer yet and moves when one is set.',
    'A folder sweep runs every ten minutes and places what is new or has changed: it makes the folder a new job is missing, moves a folder under the right customer, and renames one to the pattern. Links keep working through a move or a rename.',
    'The first photo on a job with no folder makes the folder itself, so a photo no longer waits on a press.',
    'A folder in someone’s My Drive is held, not moved: the app can make folders there but cannot save a file. The job, the photo and the folder check now say so in the same words, with the fix.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
