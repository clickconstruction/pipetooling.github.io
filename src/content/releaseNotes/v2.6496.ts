import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6496',
  date: '2026-11-04',
  title: 'Assign work finds a job by its number again on the phone',
  kind: 'fix',
  highlights: [
    'Dispatch mode’s Assign work sheet, the Add job to schedule you open on a phone, finds a job again when you type its number in the search box. A job made in the app carries a Click number and no HCP number, and the search box read the HCP number alone, so a newer job read No jobs match.',
    'The # press beside the search box matched both kinds of number all along, and still does.',
    'The Schedule hub’s Add job to schedule matches a Click number the same way.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
}

export default note
