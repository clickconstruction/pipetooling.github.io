import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5885',
  date: '2026-10-26',
  title: 'Billed Awaiting Payment reads the lean',
  kind: 'feature',
  roles: ['assistant', 'master_technician', 'dev'],
  highlights: [
    'The station now sorts the customers who owe into three folds: Need a lean, Leaned on or promised, and Not yet past due. A customer needs a lean when a bill is 30 days old and nobody has logged a call, a note or a promise in the owner\'s days, 7 to start.',
    'Every row says its last lean, who made it and when, read from the Payment Chase log the Pipeline already keeps. The count on the station is the customers needing a lean, so zero is a real day.',
    'Log a lean from the row: Couldn\'t reach, or a one-line note. A promise or a longer call opens call mode as before. One line says what moved since the last look.',
    'The Mark saves the note from the rows: who needs a lean, the oldest, how many are waiting on the customer, and what moved.',
  ],
}

export default note
