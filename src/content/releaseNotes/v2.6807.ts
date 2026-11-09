import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6807',
  date: '2026-11-09',
  title: 'The Bridge leaves ZZ test jobs out of its own figures',
  kind: 'fix',
  highlights: [
    'A ZZ test job left in a stage by a test pass no longer counts on the Bridge. Its bills leave the billed weeks and its payments leave the paid weeks. Hours clocked on it are no job worked and earn nothing.',
    'The Bill desk leaves a test job\'s bills out of its leaks, its fast lane and its scorecard.',
    'The Monday sheet email follows the same rule, so the mail and the page still agree.',
    'A dev who shows ZZ test jobs in the Pipeline\'s Hide groups… still sees them here, as on the Dashboard.',
  ],
}

export default note
