import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4489',
  date: '2026-10-04',
  title: 'AIA G702-G703: the form starts with the right party, project and dates',
  kind: 'fix',
  highlights: [
    'TO OWNER is now who the bills go to. On a job that bills its GC that is the GC, with the GC’s own address. Before, it was the customer with the job’s address.',
    'The job’s name and address now sit in a PROJECT block of their own. The APPLICATION NUMBER box no longer starts with the job’s name. You type the number.',
    'Dates read like 10/04/2026. The contract date is the day the job’s contract was signed, and it is empty when there is none. Before, it was the day the job was added, with a time of day.',
    'Retainage starts at 10%. The project number uses the job’s number even when it has no HCP number, and the file’s name carries the application number.',
  ],
}

export default note
