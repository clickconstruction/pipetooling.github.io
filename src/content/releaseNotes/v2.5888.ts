import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5888',
  date: '2026-10-26',
  title: 'Field photos: the count reaches the mark, with an age',
  kind: 'fix',
  roles: ['assistant', 'master_technician', 'dev'],
  highlights: [
    'The Field photos → Drive station\'s count now reaches every mark, the round\'s included. It used to sit inside the strip, which is collapsed when the round marks the station, so the history showed a look and no number.',
    'Each estimate still holding photos shows its days in storage, red past 7 days, and the Next line names the oldest.',
    'One line says what moved since the last look: new sets, sets moved to Drive, sets still here. The Mark saves the note from the rows, a clean day as zero.',
  ],
}

export default note
