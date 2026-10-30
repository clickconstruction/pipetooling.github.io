import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6154',
  date: '2026-10-30',
  title: 'Office hours: who hears a reply, drawn by the hour (punch list #217)',
  kind: 'feature',
  highlights: [
    'While the office is open around the clock, the Office hours card draws one row per office person with their Push me hours as a bar across the day.',
    'The hours nobody is pushed are a red hatched column through every row, with the times on its edge. A weekend nobody covers is a chip under the rows.',
    'Days with different hours each get their own rows. A press on a name opens your own Push me hours, or the other person’s desk.',
    'The amber line stays under the drawing as its caption. The owner and a dev see it, as before.',
  ],
  roles: ['dev', 'master_technician'],
}

export default note
