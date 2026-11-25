import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8570',
  date: '2026-11-25',
  title: 'Dev seat: a job is still found by a number it had before',
  kind: 'fix',
  highlights: [
    'A job number changed through the dev seat is now kept as a number the job had before. A search for the old number still finds the job.',
    'The dev seat can add an old number to a job whose number already changed, and take one off again.',
    'The dev seat can bring a sub labor sheet up to date when its job’s number has changed. The sheet stays on its job, with its lines and payments as they were.',
  ],
}

export default note
