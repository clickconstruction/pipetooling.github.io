import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6885',
  date: '2026-11-10',
  title: 'Box photos follow their job in Drive when Materials on site are moved',
  kind: 'fix',
  highlights: [
    'When a dev moves everything a job holds on site to another job, the box photos went with their boxes in the app, but their files stayed in the first job’s Drive photo folder.',
    'The files now move too, into the new job’s photo folder, right after the move. Every photo still opens from its box, as it did before.',
    'A file that cannot be moved, such as one someone put in Drive’s trash, is held with its reason and the rest still move.',
    'A job combine does not move the files yet. That is the next step.',
  ],
}

export default note
