import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6915',
  date: '2026-11-11',
  title: 'Box photos follow their job in Drive after a combine, by themselves',
  kind: 'fix',
  highlights: [
    'When two jobs are combined, the box photos went to the job you kept, but their files stayed in the removed job’s Drive folder.',
    'The files now follow by themselves, within a few minutes of the combine. Nobody has to press anything, and every photo still opens from its box.',
    'A file that cannot be moved, such as one someone put in Drive’s trash, is tried again the next day.',
  ],
}

export default note
