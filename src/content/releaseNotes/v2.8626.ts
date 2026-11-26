import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8626',
  date: '2026-11-26',
  title: 'Activity and tasks: the developer can delete a test job’s note and a test task’s comment',
  kind: 'fix',
  highlights: [
    'A posted note has no delete, so a note a walk posted on a ZZ Test job stood on its Activity for good. The same for a comment on a test task’s day.',
    'A developer now reads Delete… beside a note on a ZZ test job and beside a comment on a ZZ task. A note another tag names as its answer stays. Deleted records keeps the note.',
    'Nothing changes for the office or the crews. Notes and comments post as they did.',
  ],
}

export default note
