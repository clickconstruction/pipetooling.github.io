import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6129',
  date: '2026-10-30',
  title: 'Fill them in keeps to the line you opened, and an unpriced draft can be discarded',
  kind: 'fix',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'A line’s Fill them in now keeps to that line’s rows. Save and Skip bring up its next row, not the first row of the whole deck. When none is left, the deck walks the rest.',
    'Discard the draft works on a sub work order that has no price yet. The database used to refuse it, so a draft nobody needed kept its line on Needs you.',
  ],
}

export default note
