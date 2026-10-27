import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5886',
  date: '2026-10-26',
  title: 'Prospects: who is past their day, not how many there are',
  kind: 'feature',
  roles: ['assistant', 'master_technician', 'dev', 'estimator'],
  highlights: [
    'The Prospects station now reads each prospect\'s last touch and the callbacks we promised. Promised and missed comes first, then Past their days, then On time, where the warmth buckets and the team chart now live.',
    'How long a prospect may go without a touch depends on its warmth: warm 3 every 7 days, warm 2 every 14, warm 1 every 30, warm 0 every 60. The owner\'s numbers, changed by a dev on the station.',
    'The count on the station is the prospects past their day, not every prospect, so it moves and zero is a real day. One line says what moved since the last look.',
    'The Mark saves the note from the rows: how many are past, who was promised and missed, the oldest, and the days per warmth.',
  ],
}

export default note
