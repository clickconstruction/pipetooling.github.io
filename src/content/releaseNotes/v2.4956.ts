import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4956',
  date: '2026-10-08',
  title: 'GC mode: the schedule read back from its rows',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The GC mode schedule can now be read back from the database as the screens will show it: every bar, wait, move, walk, baseline and record of one job, with the version every change sends back.',
    'Nothing shows it yet. The Schedule tab reads it next, and the presses that write come after it.',
  ],
}

export default note
