import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7867',
  date: '2026-11-18',
  title: 'Trips: put an Extra trip on a bill from the job’s Bill tab',
  kind: 'feature',
  highlights: [
    'A job’s Bill tab now lists its Extra trips that are on no bill, under Line Items. You no longer have to open the site’s page to find them.',
    'Put on a bill beside a trip opens the same small window, with this job already chosen. The new line is picked for you, so Bill the 1 picked is one more press.',
    '+ Trip in the same place keeps a trip nobody kept yet, with this job picked and its billing on Extra.',
    'The list shows on a job that is in a development.',
  ],
}

export default note
